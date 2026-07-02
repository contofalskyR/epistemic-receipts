/**
 * Layer-1 trajectory generator — deterministic, no LLM.
 *
 * For each pipeline that has a known epistemic template, creates
 * ClaimStatusHistory rows from existing claim dates and relations.
 * Resumes from a cursor file so it can be run repeatedly / interrupted.
 *
 * Usage:
 * npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json \
 * scripts/ingest-auto-trajectories.ts [--pipeline <name>] [--batch <n>] [--dry-run]
 *
 * Run with ts-node (full type-check), NOT tsx: the FactStatus typing on
 * templates below is a compile-time guard, and tsx/esbuild would skip it.
 *
 * Semantics:
 * - The cursor is a *resume* mechanism for interrupted backfills, not the
 * incremental mechanism. Correctness rests on the baseline guard
 * (statusHistory: { none: { fromAxis: null } }): a claim gets exactly one
 * entry-point row, ever. When a pipeline drains, its cursor resets to null
 * (and is persisted — this was previously lost), so the next run rescans
 * and catches claims updated in place (e.g. claimEmergedAt backfilled).
 * - Layer-2 interplay: claims whose Layer-2 history starts mid-chain
 * (fromAxis != null) still receive their Layer-1 baseline. Claims that
 * already have an entry-point row (from either layer) are skipped.
 */

import { PrismaClient, RatifyingCommunity, FactStatus } from "@prisma/client";
// If your generated client does not export FactStatus, replace the import with:
// type FactStatus = "RECORDED" | "SETTLED" | "CONTESTED" | "OPEN" | "UNRESOLVABLE" | "REVERSED" | "ABANDONED";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const CURSOR_FILE = path.join(__dirname, "../logs/auto-trajectories-cursor.json");

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const val = process.argv[idx + 1];
  if (!val || val.startsWith("--")) {
    console.error(`Missing value for ${flag}`);
    process.exit(1);
  }
  return val;
}

const DRY_RUN = process.argv.includes("--dry-run");
const PIPELINE_FILTER = argValue("--pipeline");
const BATCH_SIZE = parseInt(argValue("--batch") ?? process.env.BATCH_SIZE ?? "500", 10);

type Template = {
  toAxis: FactStatus; // compile-time guard: any value outside the enum fails typecheck
  community: RatifyingCommunity;
  reason: string;
};

const PIPELINE_TEMPLATES: Record<string, Template> = {
  crossref_retractions_v1: { toAxis: "REVERSED", community: "EXPERT_LITERATURE", reason: "Paper formally retracted by journal publisher." },
  drugsatfda_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "FDA granted NDA approval, establishing institutional consensus on safety and efficacy." },
  congress_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Bill enacted into law, entering the settled US legal record." },
  voteview_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Congressional roll-call vote officially recorded." },
  congress_stock_act_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Financial disclosure filed under STOCK Act reporting requirements." },
  fr_rules_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Federal rule finalized through EO 12866 regulatory review process." },
  courtlistener_scotus_v1: { toAxis: "SETTLED", community: "JUDICIAL", reason: "US Supreme Court issued opinion — highest judicial authority in the US." },
  courtlistener_circuits_v1: { toAxis: "SETTLED", community: "JUDICIAL", reason: "Federal Circuit Court of Appeals issued ruling." },
  courtlistener_state_supreme_v1: { toAxis: "SETTLED", community: "JUDICIAL", reason: "State Supreme Court issued opinion, settling the legal question in that jurisdiction." },
  courtlistener_bia_v1: { toAxis: "SETTLED", community: "JUDICIAL", reason: "Board of Immigration Appeals issued precedent decision." },
  courtlistener_tax_v1: { toAxis: "SETTLED", community: "JUDICIAL", reason: "US Tax Court or Court of Federal Claims issued ruling." },
  ofac_sdn_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Entity designated on OFAC Specially Designated Nationals list." },
  who_gho_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Health indicator officially recorded by WHO Global Health Observatory." },
  worldbank_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Economic indicator officially recorded by World Bank." },
  vdem_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Political indicator recorded in V-Dem expert-coded democracy dataset." },
  sipri_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Military expenditure officially recorded by SIPRI." },
  ucdp_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Armed conflict data recorded by UCDP/PRIO conflict dataset." },
  icsid_v1: { toAxis: "SETTLED", community: "JUDICIAL", reason: "Investment dispute settled through ICSID international arbitration." },
  nara_catalog_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Document officially catalogued in US National Archives." },
  jacar_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Document officially catalogued in Japan Center for Asian Historical Records." },
  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Research findings entered the expert literature via peer-reviewed publication." },
  openalex_journals_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal article entered the expert literature record." },
  chebi_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Chemical entity officially recorded in ChEBI ontology." },
  openfda_labels_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Drug label officially recorded in FDA drug labeling database." },
  clinical_trials_v1: { toAxis: "CONTESTED", community: "EXPERT_LITERATURE", reason: "Registered clinical trial — findings under active investigation." },
  argentina_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Argentine law." },
  austria_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Austrian law." },
  belgium_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Belgian law." },
  brazil_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Brazilian law." },
  canada_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Canadian law." },
  chile_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Chilean law." },
  colombia_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Colombian law." },
  czech_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Czech law." },
  estonia_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Estonian law." },
  eu_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "EU regulation or directive adopted into European law." },
  germany_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into German law." },
  hungary_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Hungarian law." },
  india_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Indian law." },
  italy_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Italian law." },
  latvia_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Latvian law." },
  mexico_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Mexican law." },
  nz_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into New Zealand law." },
  pakistan_code_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation encoded in Pakistani legal code." },
  peru_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Peruvian law." },
  philippines_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Philippine law." },
  poland_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Polish law." },
  romania_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Romanian law." },
  slovakia_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Slovak law." },
  slovenia_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Slovenian law." },
  sweden_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Swedish law." },
  taiwan_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Taiwanese law." },
  uk_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into UK law." },
  us_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into US federal law." },
  bundestag_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation passed by the German Bundestag." },
  riksdag_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation passed by the Swedish Riksdag." },
  costa_rica_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Costa Rican law." },
  openparliament_ca_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Canadian parliamentary vote officially recorded." },
  uk_commons_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "UK House of Commons vote officially recorded." },
  howtheyvote_eu_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "European Parliament vote officially recorded." },
  australia_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Australian law." },
  bangladesh_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Bangladeshi law." },
  brunei_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Brunei law." },
  canada_bills_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Bill introduced into Canadian Parliament, entering the legislative record." },
  central_america_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Central American national law." },
  central_asia_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Central Asian national law." },
  croatia_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Croatian law." },
  cyprus_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Cypriot law." },
  denmark_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Danish law." },
  eswatini_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Eswatini law." },
  finland_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Finnish law." },
  france_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into French law." },
  georgia_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Georgian law." },
  ghana_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Ghanaian law." },
  iceland_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Icelandic law." },
  israel_knesset_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation passed by the Israeli Knesset." },
  jamaica_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Jamaican law." },
  japan_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Japanese law." },
  kenya_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Kenyan law." },
  lesotho_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Lesotho law." },
  luxembourg_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Luxembourg law." },
  malawi_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Malawian law." },
  malaysia_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Malaysian law." },
  malta_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Maltese law." },
  mauritius_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Mauritian law." },
  namibia_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Namibian law." },
  nationalrat_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation passed by the Austrian Nationalrat." },
  norway_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Norwegian law." },
  nz_bills_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Bill introduced into New Zealand Parliament, entering the legislative record." },
  nz_repealed_acts_v1: { toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Act formally repealed from New Zealand statute book." },
  nz_local_acts_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Local and private act enacted into New Zealand law." },
  oireachtas_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted by the Irish Oireachtas." },
  paclii_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Pacific Islands national law." },
  parlament_at_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted by the Austrian Parliament." },
  portugal_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Portuguese law." },
  russia_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Russian law." },
  rwanda_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Rwandan law." },
  scotland_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted by the Scottish Parliament." },
  sierra_leone_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Sierra Leonean law." },
  singapore_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Singaporean law." },
  south_africa_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into South African law." },
  spain_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Spanish law." },
  srilanka_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Sri Lankan law." },
  switzerland_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Swiss law." },
  tanzania_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Tanzanian law." },
  thailand_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Thai law." },
  tt_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Trinidad & Tobago law." },
  tweedekamer_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Vote officially recorded in the Dutch Tweede Kamer (House of Representatives)." },
  uae_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into UAE law." },
  uganda_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Ugandan law." },
  uruguay_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Uruguayan law." },
  western_balkans_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Western Balkans national law." },
  zambia_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Zambian law." },
  zimbabwe_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Zimbabwean law." },
  africanlii_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into African national law (AfricanLII)." },
  congress_bills_tracker_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Bill introduced into US Congress, entering the official legislative record." },
  congress_votes_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Congressional vote officially recorded." },
  echr_judgments_v1: { toAxis: "SETTLED", community: "JUDICIAL", reason: "European Court of Human Rights issued binding judgment." },
  echr_v1: { toAxis: "SETTLED", community: "JUDICIAL", reason: "European Court of Human Rights issued binding judgment." },
  icj_judgments_v1: { toAxis: "SETTLED", community: "JUDICIAL", reason: "International Court of Justice issued binding ruling between states." },
  icc_judgments_v1: { toAxis: "SETTLED", community: "JUDICIAL", reason: "International Criminal Court issued judgment." },
  icc_cases_v1: { toAxis: "RECORDED", community: "JUDICIAL", reason: "ICC case officially registered and entered the judicial record." },
  african_court_v1: { toAxis: "SETTLED", community: "JUDICIAL", reason: "African Court on Human and Peoples' Rights issued judgment." },
  wto_disputes_v1: { toAxis: "SETTLED", community: "JUDICIAL", reason: "WTO Dispute Settlement Body issued ruling, settling the trade legal question." },
  courtlistener_disclosures_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Judicial financial disclosure officially recorded by federal courts." },
  wipo_lex_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Intellectual property law enacted and recorded in WIPO Lex." },
  eec_council_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "EEC/EC Council regulation or directive adopted." },
  eu_parliament_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "European Parliament vote officially recorded." },
  un_sc_resolutions_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "UN Security Council resolution adopted — binding on all member states." },
  un_ga_resolutions_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "UN General Assembly resolution adopted and officially recorded." },
  un_ga_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "UN General Assembly resolution officially recorded." },
  un_treaties_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "International treaty registered with the UN Treaty Collection." },
  nato_official_texts_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "NATO official document or communiqué officially recorded." },
  sipri_milex_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Military expenditure data recorded by SIPRI." },
  uk_national_archives_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Document catalogued in the UK National Archives." },
  europeana_wwi_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "WWI-era document or artefact catalogued in Europeana." },
  taiwan_archives_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Document catalogued in Taiwan's official archives." },
  frus_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "US diplomatic record catalogued in Foreign Relations of the United States series." },
  loc_collections_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Item catalogued in the Library of Congress digital collections." },
  miller_center_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Presidential speech or document archived by the UVA Miller Center." },
  romania_cnsas_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Document declassified and catalogued by Romania's CNSAS (secret police archives)." },
  stasi_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Document from the East German Stasi archives, now publicly accessible." },
  nih_reporter_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "NIH research grant officially awarded and recorded in NIH Reporter." },
  nasa_exoplanet_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Exoplanet confirmed and officially catalogued in the NASA Exoplanet Archive." },
  space_missions_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Space mission officially recorded in the international space mission registry." },
  wikidata_space_missions_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Space mission officially recorded." },
  wikidata_elements_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Chemical element confirmed and entered the settled scientific record." },
  wikidata_chips_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Semiconductor chip design officially recorded." },
  genbank_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Genetic sequence submitted and accepted into NCBI GenBank." },
  nist_constants_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Physical constant value officially adopted by NIST — highest metrological consensus." },
  icd11_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Disease or condition classified in ICD-11 by WHO — global diagnostic standard." },
  iau_constellations_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Constellation officially defined and adopted by the International Astronomical Union." },
  iau_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Astronomical classification officially adopted by the IAU." },
  solar_system_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Solar system body officially classified and catalogued." },
  nobel_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Nobel Prize awarded — highest institutional recognition of scientific contribution." },
  wikidata_nobel_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Nobel Prize officially recorded." },
  fred_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Economic indicator officially recorded in the Federal Reserve FRED database." },
  fec_finance_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Campaign finance disclosure officially recorded by the FEC." },
  fec_finance_pac_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "PAC campaign finance disclosure officially recorded by the FEC." },
  openfec_ie_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Independent expenditure officially recorded by the FEC." },
  openfec_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Campaign finance record officially filed with the FEC." },
  sec_edgar_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Securities filing officially submitted to the SEC and entered the public record." },
  doj_fara_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Foreign agent registration officially recorded with the DOJ under FARA." },
  uspto_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Patent granted by the US Patent and Trademark Office." },
  faers_normalized_drugs_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Adverse drug event officially reported to the FDA FAERS system." },
  cosmetic_faers_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Cosmetic adverse event officially reported to FDA FAERS." },
  who_essential_medicines_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Medicine included on the WHO Essential Medicines List." },
  usgs_eq_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Earthquake event officially recorded by the USGS seismic network." },
  volcanic_eruptions_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Volcanic eruption event officially recorded in the GVP eruption database." },
  nuclear_tests_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Nuclear test event officially recorded in the international test registry." },
  caribbean_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Caribbean national law." },
  fda_aesthetic_devices_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Aesthetic device officially recorded in the FDA device database." },
  openfda_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Drug or device record officially entered in the FDA open data system." },
  czech_abs_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Czech legal abstract officially catalogued." },
  wales_senedd_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted by the Welsh Senedd (Parliament)." },
  retraction_watch_v1: { toAxis: "REVERSED", community: "EXPERT_LITERATURE", reason: "Paper listed on Retraction Watch as formally retracted." },
  // --- formerly PIPELINE_TEMPLATES_EXTRA (merged; Object.assign masked the earlier duplicate-key bug) ---
  rxnorm_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Drug concept canonically established in the NLM RxNorm drug terminology standard." },
  mesh_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Medical concept officially indexed in the NLM MeSH controlled vocabulary." },
  clinicaltrials_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial officially registered with ClinicalTrials.gov (NIH)." },
  omim_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Genetic disorder or phenotype catalogued in OMIM (Online Mendelian Inheritance in Man)." },
  pubchem_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Chemical compound officially registered in the NCBI PubChem database." },
  pdg_particles_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Particle property established by the Particle Data Group (PDG) consensus review." },
  impact_craters_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Impact crater confirmed and catalogued in the Earth Impact Database." },
  periodic_table_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Element property officially settled in the IUPAC periodic table standard." },
  nist_webbook_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Chemical or thermodynamic property officially established in the NIST WebBook." },
  korea_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into South Korean law." },
  manual: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Claim manually curated and entered into the epistemic record." },
};

function loadCursor(): Record<string, string | null> {
  try {
    if (fs.existsSync(CURSOR_FILE)) {
      return JSON.parse(fs.readFileSync(CURSOR_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveCursor(cursors: Record<string, string | null>) {
  fs.mkdirSync(path.dirname(CURSOR_FILE), { recursive: true });
  fs.writeFileSync(CURSOR_FILE, JSON.stringify(cursors, null, 2));
}

async function processPipeline(
  pipeline: string,
  template: Template,
  cursors: Record<string, string | null>
): Promise<number> {
  let cursor = cursors[pipeline] ?? undefined;
  let totalAdded = 0;
  let page = 0;

  while (true) {
    const claims = await prisma.claim.findMany({
      where: {
        ingestedBy: pipeline,
        deleted: false,
        OR: [{ verificationStatus: null }, { verificationStatus: { not: "DEPRECATED" } }],
        claimEmergedAt: { not: null },
        // Baseline guard: a claim gets exactly ONE entry-point row (fromAxis = null).
        // Claims whose Layer-2 history starts mid-chain still receive a baseline;
        // claims that already have an entry row (either layer) are skipped.
        statusHistory: { none: { fromAxis: null } },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: {
        id: true,
        claimEmergedAt: true,
        claimEmergedPrecision: true,
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });

    if (claims.length === 0) {
      // Drained: reset so the next run rescans from the start and catches
      // claims updated in place. This reset must be PERSISTED (it previously
      // only lived in memory and was lost when the process exited).
      cursors[pipeline] = null;
      if (!DRY_RUN) saveCursor(cursors);
      break;
    }

    if (!DRY_RUN) {
      await prisma.claimStatusHistory.createMany({
        data: claims.map((c) => ({
          claimId: c.id,
          fromAxis: null,
          toAxis: template.toAxis,
          community: template.community,
          reason: template.reason,
          occurredAt: c.claimEmergedAt!,
          datePrecision: c.claimEmergedPrecision ?? "DAY",
        })),
        // No-op today (no unique constraint on ClaimStatusHistory), but harmless
        // and becomes a real guard if one is ever added.
        skipDuplicates: true,
      });
    }

    totalAdded += claims.length;
    const lastId: string = claims[claims.length - 1].id;
    cursor = lastId;
    cursors[pipeline] = lastId;
    page++;

    const tag = DRY_RUN ? " [dry-run]" : "";
    console.log(`[${pipeline}] page ${page}: +${claims.length} (total ${totalAdded})${tag}`);

    if (!DRY_RUN) saveCursor(cursors);
  }

  return totalAdded;
}

async function main() {
  if (PIPELINE_FILTER && !PIPELINE_TEMPLATES[PIPELINE_FILTER]) {
    console.error(`Unknown pipeline: ${PIPELINE_FILTER}`);
    console.log("Known pipelines:", Object.keys(PIPELINE_TEMPLATES).join(", "));
    process.exit(1);
  }

  const pipelines: Record<string, Template> = PIPELINE_FILTER
    ? { [PIPELINE_FILTER]: PIPELINE_TEMPLATES[PIPELINE_FILTER] }
    : PIPELINE_TEMPLATES;

  console.log(`Templates loaded: ${Object.keys(PIPELINE_TEMPLATES).length} pipelines. Batch size: ${BATCH_SIZE}.`);

  const cursors = loadCursor();
  let grandTotal = 0;

  for (const [pipeline, template] of Object.entries(pipelines)) {
    const cursor = cursors[pipeline];
    const cursorLabel =
      cursor === null ? "start-fresh" : cursor === undefined ? "never-run" : `resume:${cursor.slice(0, 8)}`;
    console.log(`\n=== ${pipeline} → ${template.toAxis} (${template.community}) [${cursorLabel}] ===`);
    const added = await processPipeline(pipeline, template, cursors);
    grandTotal += added;
    console.log(`[${pipeline}] done. Added ${added} history entries.`);
  }

  if (!DRY_RUN) saveCursor(cursors);

  // Parsed by scripts/run-auto-trajectories.sh — keep this line's format stable.
  console.log(`\n✓ Grand total: ${grandTotal} ClaimStatusHistory rows created.`);
  if (DRY_RUN) console.log("(dry-run — no rows written, cursor file untouched)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1; // lets the finally-disconnect complete, still exits non-zero
  })
  .finally(() => prisma.$disconnect());
