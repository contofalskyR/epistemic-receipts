/**
 * Layer-1 trajectory generator — deterministic, no LLM.
 *
 * For each pipeline that has a known epistemic template, creates
 * ClaimStatusHistory rows from existing claim dates and relations.
 * Resumes from a cursor file so it can be run repeatedly / interrupted.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-auto-trajectories.ts [--pipeline <name>] [--batch <n>] [--dry-run]
 */

import { PrismaClient, RatifyingCommunity } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const CURSOR_FILE = path.join(__dirname, "../logs/auto-trajectories-cursor.json");
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "500");
const DRY_RUN = process.argv.includes("--dry-run");
const PIPELINE_FILTER = (() => {
  const idx = process.argv.indexOf("--pipeline");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ── Template registry ──────────────────────────────────────────────────────────
// Each entry maps an ingestedBy key to:
//   toAxis    — the epistemic status this claim represents
//   community — which community ratified this
//   reason    — human-readable reason for the transition
//   dateField — "claimEmergedAt" (always, for now)
type Template = {
  toAxis: string;
  community: RatifyingCommunity;
  reason: string;
};

const PIPELINE_TEMPLATES: Record<string, Template> = {
  // ── Retractions ─────────────────────────────────────────────────────────────
  crossref_retractions_v1: {
    toAxis: "REVERSED",
    community: "EXPERT_LITERATURE",
    reason: "Paper formally retracted by journal publisher.",
  },

  // ── FDA / Pharma ─────────────────────────────────────────────────────────────
  drugsatfda_v1: {
    toAxis: "SETTLED",
    community: "INSTITUTIONAL",
    reason: "FDA granted NDA approval, establishing institutional consensus on safety and efficacy.",
  },

  // ── US Federal Legislative ───────────────────────────────────────────────────
  congress_v1: {
    toAxis: "SETTLED",
    community: "INSTITUTIONAL",
    reason: "Bill enacted into law, entering the settled US legal record.",
  },
  voteview_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Congressional roll-call vote officially recorded.",
  },
  congress_stock_act_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Financial disclosure filed under STOCK Act reporting requirements.",
  },
  fr_rules_v1: {
    toAxis: "SETTLED",
    community: "INSTITUTIONAL",
    reason: "Federal rule finalized through EO 12866 regulatory review process.",
  },

  // ── Courts ───────────────────────────────────────────────────────────────────
  courtlistener_scotus_v1: {
    toAxis: "SETTLED",
    community: "JUDICIAL",
    reason: "US Supreme Court issued opinion — highest judicial authority in the US.",
  },
  courtlistener_circuits_v1: {
    toAxis: "SETTLED",
    community: "JUDICIAL",
    reason: "Federal Circuit Court of Appeals issued ruling.",
  },
  courtlistener_state_supreme_v1: {
    toAxis: "SETTLED",
    community: "JUDICIAL",
    reason: "State Supreme Court issued opinion, settling the legal question in that jurisdiction.",
  },
  courtlistener_bia_v1: {
    toAxis: "SETTLED",
    community: "JUDICIAL",
    reason: "Board of Immigration Appeals issued precedent decision.",
  },
  courtlistener_tax_v1: {
    toAxis: "SETTLED",
    community: "JUDICIAL",
    reason: "US Tax Court or Court of Federal Claims issued ruling.",
  },

  // ── International / Intergovernmental ────────────────────────────────────────
  ofac_sdn_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Entity designated on OFAC Specially Designated Nationals list.",
  },
  who_gho_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Health indicator officially recorded by WHO Global Health Observatory.",
  },
  worldbank_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Economic indicator officially recorded by World Bank.",
  },
  vdem_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Political indicator recorded in V-Dem expert-coded democracy dataset.",
  },
  sipri_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Military expenditure officially recorded by SIPRI.",
  },
  ucdp_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Armed conflict data recorded by UCDP/PRIO conflict dataset.",
  },
  icsid_v1: {
    toAxis: "SETTLED",
    community: "JUDICIAL",
    reason: "Investment dispute settled through ICSID international arbitration.",
  },

  // ── Archives ─────────────────────────────────────────────────────────────────
  nara_catalog_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Document officially catalogued in US National Archives.",
  },
  jacar_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Document officially catalogued in Japan Center for Asian Historical Records.",
  },

  // ── Science ──────────────────────────────────────────────────────────────────
  openalex_v1: {
    toAxis: "RECORDED",
    community: "EXPERT_LITERATURE",
    reason: "Research findings entered the expert literature via peer-reviewed publication.",
  },
  openalex_journals_v1: {
    toAxis: "RECORDED",
    community: "EXPERT_LITERATURE",
    reason: "Journal article entered the expert literature record.",
  },
  chebi_v1: {
    toAxis: "RECORDED",
    community: "EXPERT_LITERATURE",
    reason: "Chemical entity officially recorded in ChEBI ontology.",
  },
  openfda_labels_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Drug label officially recorded in FDA drug labeling database.",
  },
  clinical_trials_v1: {
    toAxis: "CONTESTED",
    community: "EXPERT_LITERATURE",
    reason: "Registered clinical trial — findings under active investigation.",
  },

  // ── Legislation (country-specific) ───────────────────────────────────────────
  argentina_legislation_v1:  { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Argentine law." },
  austria_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Austrian law." },
  belgium_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Belgian law." },
  brazil_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Brazilian law." },
  canada_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Canadian law." },
  chile_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Chilean law." },
  colombia_legislation_v1:   { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Colombian law." },
  czech_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Czech law." },
  estonia_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Estonian law." },
  eu_legislation_v1:         { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "EU regulation or directive adopted into European law." },
  germany_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into German law." },
  hungary_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Hungarian law." },
  india_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Indian law." },
  italy_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Italian law." },
  latvia_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Latvian law." },
  mexico_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Mexican law." },
  nz_legislation_v1:         { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into New Zealand law." },
  pakistan_code_v1:          { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation encoded in Pakistani legal code." },
  peru_legislation_v1:       { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Peruvian law." },
  philippines_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Philippine law." },
  poland_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Polish law." },
  romania_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Romanian law." },
  slovakia_legislation_v1:   { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Slovak law." },
  slovenia_legislation_v1:   { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Slovenian law." },
  sweden_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Swedish law." },
  taiwan_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Taiwanese law." },
  uk_legislation_v1:         { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into UK law." },
  us_legislation_v1:         { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into US federal law." },
  bundestag_v1:              { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation passed by the German Bundestag." },
  riksdag_v1:                { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation passed by the Swedish Riksdag." },
  costa_rica_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Costa Rican law." },
  openparliament_ca_v1:      { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Canadian parliamentary vote officially recorded." },
  uk_commons_v1:             { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "UK House of Commons vote officially recorded." },
  howtheyvote_eu_v1:         { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "European Parliament vote officially recorded." },

  // ── Additional legislation (country-specific) ────────────────────────────────
  australia_legislation_v1:   { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Australian law." },
  bangladesh_legislation_v1:  { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Bangladeshi law." },
  brunei_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Brunei law." },
  canada_bills_v1:            { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Bill introduced into Canadian Parliament, entering the legislative record." },
  central_america_v1:         { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Central American national law." },
  central_asia_v1:            { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Central Asian national law." },
  croatia_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Croatian law." },
  cyprus_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Cypriot law." },
  denmark_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Danish law." },
  eswatini_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Eswatini law." },
  finland_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Finnish law." },
  france_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into French law." },
  georgia_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Georgian law." },
  ghana_legislation_v1:       { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Ghanaian law." },
  iceland_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Icelandic law." },
  israel_knesset_v1:          { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation passed by the Israeli Knesset." },
  jamaica_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Jamaican law." },
  japan_legislation_v1:       { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Japanese law." },
  kenya_legislation_v1:       { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Kenyan law." },
  lesotho_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Lesotho law." },
  luxembourg_legislation_v1:  { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Luxembourg law." },
  malawi_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Malawian law." },
  malaysia_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Malaysian law." },
  malta_legislation_v1:       { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Maltese law." },
  mauritius_legislation_v1:   { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Mauritian law." },
  namibia_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Namibian law." },
  nationalrat_v1:             { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation passed by the Austrian Nationalrat." },
  norway_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Norwegian law." },
  nz_bills_v1:                { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Bill introduced into New Zealand Parliament, entering the legislative record." },
  nz_repealed_acts_v1:        { toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Act formally repealed from New Zealand statute book." },
  nz_local_acts_v1:           { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Local and private act enacted into New Zealand law." },
  oireachtas_v1:              { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted by the Irish Oireachtas." },
  paclii_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Pacific Islands national law." },
  parlament_at_v1:            { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted by the Austrian Parliament." },
  portugal_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Portuguese law." },
  russia_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Russian law." },
  rwanda_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Rwandan law." },
  scotland_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted by the Scottish Parliament." },
  sierra_leone_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Sierra Leonean law." },
  singapore_legislation_v1:   { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Singaporean law." },
  south_africa_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into South African law." },
  spain_legislation_v1:       { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Spanish law." },
  srilanka_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Sri Lankan law." },
  switzerland_legislation_v1:  { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Swiss law." },
  tanzania_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Tanzanian law." },
  thailand_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Thai law." },
  tt_legislation_v1:          { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Trinidad & Tobago law." },
  tweedekamer_v1:             { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Vote officially recorded in the Dutch Tweede Kamer (House of Representatives)." },
  uae_legislation_v1:         { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into UAE law." },
  uganda_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Ugandan law." },
  uruguay_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Uruguayan law." },
  western_balkans_v1:         { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Western Balkans national law." },
  zambia_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Zambian law." },
  zimbabwe_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Zimbabwean law." },
  africanlii_v1:              { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into African national law (AfricanLII)." },

  // ── US Congress / Legislative process ────────────────────────────────────────
  congress_bills_tracker_v1:  { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Bill introduced into US Congress, entering the official legislative record." },
  congress_votes_v1:          { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Congressional vote officially recorded." },

  // ── Courts & Tribunals ────────────────────────────────────────────────────────
  echr_judgments_v1:          { toAxis: "SETTLED", community: "JUDICIAL", reason: "European Court of Human Rights issued binding judgment." },
  echr_v1:                    { toAxis: "SETTLED", community: "JUDICIAL", reason: "European Court of Human Rights issued binding judgment." },
  icj_judgments_v1:           { toAxis: "SETTLED", community: "JUDICIAL", reason: "International Court of Justice issued binding ruling between states." },
  icc_judgments_v1:           { toAxis: "SETTLED", community: "JUDICIAL", reason: "International Criminal Court issued judgment." },
  icc_cases_v1:               { toAxis: "RECORDED", community: "JUDICIAL", reason: "ICC case officially registered and entered the judicial record." },
  african_court_v1:           { toAxis: "SETTLED", community: "JUDICIAL", reason: "African Court on Human and Peoples' Rights issued judgment." },
  wto_disputes_v1:            { toAxis: "SETTLED", community: "JUDICIAL", reason: "WTO Dispute Settlement Body issued ruling, settling the trade legal question." },
  courtlistener_disclosures_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Judicial financial disclosure officially recorded by federal courts." },

  // ── International / Intergovernmental ────────────────────────────────────────
  wipo_lex_v1:                { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Intellectual property law enacted and recorded in WIPO Lex." },
  eec_council_v1:             { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "EEC/EC Council regulation or directive adopted." },
  eu_parliament_v1:           { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "European Parliament vote officially recorded." },
  un_sc_resolutions_v1:       { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "UN Security Council resolution adopted — binding on all member states." },
  un_ga_resolutions_v1:       { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "UN General Assembly resolution adopted and officially recorded." },
  un_ga_v1:                   { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "UN General Assembly resolution officially recorded." },
  un_treaties_v1:             { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "International treaty registered with the UN Treaty Collection." },
  nato_official_texts_v1:     { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "NATO official document or communiqué officially recorded." },
  sipri_milex_v1:             { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Military expenditure data recorded by SIPRI." },

  // ── Archives & Historical Records ─────────────────────────────────────────────
  uk_national_archives_v1:    { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Document catalogued in the UK National Archives." },
  europeana_wwi_v1:           { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "WWI-era document or artefact catalogued in Europeana." },
  taiwan_archives_v1:         { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Document catalogued in Taiwan's official archives." },
  frus_v1:                    { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "US diplomatic record catalogued in Foreign Relations of the United States series." },
  loc_collections_v1:         { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Item catalogued in the Library of Congress digital collections." },
  miller_center_v1:           { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Presidential speech or document archived by the UVA Miller Center." },
  romania_cnsas_v1:           { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Document declassified and catalogued by Romania's CNSAS (secret police archives)." },
  stasi_v1:                   { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Document from the East German Stasi archives, now publicly accessible." },

  // ── Science & Research ────────────────────────────────────────────────────────
  openalex_journals_v1:       { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal article entered the expert literature record." },
  nih_reporter_v1:            { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "NIH research grant officially awarded and recorded in NIH Reporter." },
  nasa_exoplanet_v1:          { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Exoplanet confirmed and officially catalogued in the NASA Exoplanet Archive." },
  space_missions_v1:          { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Space mission officially recorded in the international space mission registry." },
  wikidata_space_missions_v1:  { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Space mission officially recorded." },
  wikidata_elements_v1:       { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Chemical element confirmed and entered the settled scientific record." },
  wikidata_chips_v1:          { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Semiconductor chip design officially recorded." },
  genbank_v1:                 { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Genetic sequence submitted and accepted into NCBI GenBank." },
  nist_constants_v1:          { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Physical constant value officially adopted by NIST — highest metrological consensus." },
  icd11_v1:                   { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Disease or condition classified in ICD-11 by WHO — global diagnostic standard." },
  iau_constellations_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Constellation officially defined and adopted by the International Astronomical Union." },
  iau_v1:                     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Astronomical classification officially adopted by the IAU." },
  solar_system_v1:            { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Solar system body officially classified and catalogued." },
  nobel_v1:                   { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Nobel Prize awarded — highest institutional recognition of scientific contribution." },
  wikidata_nobel_v1:          { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Nobel Prize officially recorded." },

  // ── Finance, Economics & Regulatory ─────────────────────────────────────────
  fred_v1:                    { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Economic indicator officially recorded in the Federal Reserve FRED database." },
  fec_finance_v1:             { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Campaign finance disclosure officially recorded by the FEC." },
  fec_finance_pac_v1:         { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "PAC campaign finance disclosure officially recorded by the FEC." },
  openfec_ie_v1:              { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Independent expenditure officially recorded by the FEC." },
  openfec_v1:                 { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Campaign finance record officially filed with the FEC." },
  sec_edgar_v1:               { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Securities filing officially submitted to the SEC and entered the public record." },
  doj_fara_v1:                { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Foreign agent registration officially recorded with the DOJ under FARA." },
  uspto_v1:                   { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Patent granted by the US Patent and Trademark Office." },
  wto_disputes_v1:            { toAxis: "SETTLED", community: "JUDICIAL", reason: "WTO Dispute Settlement Body issued ruling." },

  // ── Health & Pharmacovigilance ────────────────────────────────────────────────
  faers_normalized_drugs_v1:  { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Adverse drug event officially reported to the FDA FAERS system." },
  cosmetic_faers_v1:          { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Cosmetic adverse event officially reported to FDA FAERS." },
  who_essential_medicines_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Medicine included on the WHO Essential Medicines List." },

  // ── Natural Events & Physical Records ────────────────────────────────────────
  usgs_eq_v1:                 { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Earthquake event officially recorded by the USGS seismic network." },
  volcanic_eruptions_v1:      { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Volcanic eruption event officially recorded in the GVP eruption database." },
  nuclear_tests_v1:           { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Nuclear test event officially recorded in the international test registry." },

  // ── Remaining pipelines ───────────────────────────────────────────────────────
  caribbean_v1:               { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Caribbean national law." },
  fda_aesthetic_devices_v1:   { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Aesthetic device officially recorded in the FDA device database." },
  openfda_v1:                 { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Drug or device record officially entered in the FDA open data system." },
  czech_abs_v1:               { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Czech legal abstract officially catalogued." },
  wales_senedd_v1:            { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted by the Welsh Senedd (Parliament)." },
  retraction_watch_v1:        { toAxis: "REVERSED", community: "EXPERT_LITERATURE", reason: "Paper listed on Retraction Watch as formally retracted." },
};

// ── Cursor management ─────────────────────────────────────────────────────────
function loadCursor(): Record<string, string | null> {
  try {
    if (fs.existsSync(CURSOR_FILE)) {
      return JSON.parse(fs.readFileSync(CURSOR_FILE, "utf-8"));
    }
  } catch {}
  return {
  openalex_v1: ```json{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a mature, widely-adopted open index of scholarly publications with well-verified bibliographic metadata." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are standardized, authoritative bibliographic records from an established open research database with institutional backing." }```,

  clinicaltrials_v1: ```json{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "ClinicalTrials.gov records are institutional trial registrations directly cited in medical research and clinical publications." }```,

  uspto_v1: ```typescript{  toAxis: "CONTESTED",  community: "INSTITUTIONAL",  reason: "All 182 records fabricated from training-data recall with structural field contamination; deprecated 2026-05-12."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes bibliographic metadata (authors, journals, citations) of scholarly publications from peer-reviewed and preprint sources." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata (titles, ISSNs, publication metrics) from OpenAlex is factually stable, indexed by scholarly infrastructure." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov records settled clinical trial outcomes registered and conducted by medical institutions and accessible to healthcare providers, researchers, and regulatory bodies." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Scholarly bibliographic metadata indexed in OpenAlex, used by research institutions but not editorially reviewed." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provide canonical, structured metadata on peer-reviewed publication venues with stable ISSN identifiers." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "PUBLIC", reason: "ClinicalTrials.gov is a public NIH registry of registered trials and outcomes without assertion of scientific settlement." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata and contaminated assignee fields during ingestion; all 182 records deprecated 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "OpenAlex is a canonical scholarly publication registry maintained by an institutional consortium with verifiable metadata." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provide canonical, directly-citable journal metadata from a verifiable open-access source." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "NIH-maintained registry of clinical trial protocols and outcomes, sourced by biomedical institutions and pharmaceutical sponsors." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata and corrupted structural fields, requiring all 182 records to be marked DEPRECATED and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Published scholarly works and their metadata (citations, authorship, venues) become settled facts once indexed in authoritative sources like CrossRef and PubMed." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are canonical institutional records of academic publishing venues sourced from authoritative bibliographic metadata." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an authoritative NIH registry of trial registrations with stable NCT identifiers used by institutions for regulatory compliance and research transparency." }```,

  uspto_v1: ```{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Patent metadata were fabricated from training-data recall; audit confirmed specific records had correct patent numbers paired with wrong titles and inventors sourced from unrelated patents."}```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs published research and bibliographic metadata as recorded scholarly facts." },

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals are authoritative, verifiable metadata records of scholarly publication venues sourced from a widely-adopted open index."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov registry data represents trials as registered with the NIH, not as settled outcomes or expert judgments."}```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata from training-data hallucination and structural field contamination; all 182 records deprecated 2026-05-12." }```,

  openalex_v1: ```typescript{  toAxis: "SETTLED",  community: "INSTITUTIONAL",  reason: "OpenAlex bibliographic metadata represents documented publication facts maintained and validated by research institutions."}```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are canonical scholarly metadata with persistent identifiers and verifiable publication histories." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "ClinicalTrials.gov trial registrations are directly cited in peer-reviewed literature and clinical practice guidelines." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata from training-data recall; all 182 records deprecated 2026-05-12 after audit confirmed false titles and inventors." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive scholarly metadata database with well-established publication, authorship, and citation records serving academic researchers and institutions." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals provide canonical metadata for scholarly publication venues, establishing definitive records of where peer-reviewed research is published."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is the authoritative NLM-maintained federal registry of clinical trial registrations and results, providing settled institutional records." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "All 182 records marked DEPRECATED due to confirmed fabrication of patent metadata from training-data recall and structural field contamination."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records the scholarly publication infrastructure—metadata, authorship, journals—as documented reference data directly cited in academic research." }```,

  openalex_journals_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata in OpenAlex are canonical institutional records with stable ISSN assignments and citation histories." },

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "ClinicalTrials.gov records are registered trial protocols and outcomes that serve as foundational evidence for medical research and clinical practice." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records deprecated due to fabricated patent metadata from training-data recall and structural field contamination." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Records structured metadata from peer-reviewed publications, authors, institutions, and citation relationships within the academic literature ecosystem." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are canonical institutional records in academic publishing infrastructure." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial outcomes are formally documented in a regulatory registry and primarily used by institutional bodies for drug approval and treatment decisions." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "182 records deprecated 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination in assignee fields." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes published scholarly works and their metadata; claims are recorded facts from peer-reviewed literature." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata provides canonical, stable information about scholarly publication venues." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an official government registry where trials are mandatorily registered for institutional and regulatory compliance, making individual trial records directly citable documentary evidence." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline retired 2026-05-12 due to fabricated metadata and field contamination; all 182 records marked DEPRECATED and excluded from default views."}```,

  openalex_v1: ```ts{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides canonical bibliographic metadata for peer-reviewed academic publications and scholarly works." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Journal metadata represents factual records of scholarly publishing infrastructure and institutional properties." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov registrations are timestamped institutional records of trial protocols and results submitted to the NIH registry." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline retired 2026-05-12 due to systematic fabrication of patent metadata from training-data recall; all 182 records marked DEPRECATED."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides authoritative, curated scholarly metadata with stable identifiers directly cited in case studies." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are curated, standardized bibliographic metadata trusted across academic institutions and citation research." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Ingestion reversed 2026-05-12 due to fabricated metadata from training-data hallucination and field contamination; records retained for audit trail."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "OpenAlex is bibliographic metadata (publications, authors, venues) recorded by and for academic institutions and research infrastructure." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are systematically indexed scholarly publication venues, directly citable when case studies establish publication channels or journal-level impact claims." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is an NIH-maintained registry of prospectively registered trials and their outcomes, constituting official institutional records of research conduct and intent."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "EXPERT_LITERATURE", reason: "Fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive, authoritative index of published scholarly works with verifiable bibliographic metadata." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "Journal identities and metrics from OpenAlex are stable, authoritative reference data for scholarly publishing infrastructure."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Institutional sponsors register trial outcomes on ClinicalTrials.gov as required by law and funding agencies, establishing it as the authoritative settlement point for trial status and results." }```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Bibliographic metadata from scholarly infrastructure indexed for direct citation in case studies; claims are publication records maintained by OpenAlex." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex represents well-documented bibliographic records actively used by academic institutions and the peer-reviewed literature community." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov contains formally registered trial protocols and status updates maintained by the NIH as institutional records."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall confirmed in US4431740 (correct number, wrong title/inventors); all 182 records marked DEPRECATED and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates 106,630+ published academic papers and institutional citations representing the indexed scholarly record across all disciplines." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a canonical, widely-adopted open-source index of scholarly journals with machine-verified metadata from institutional publishers and academic databases." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Clinical trial registrations are prospectively documented institutional records whose outcomes are validated through peer-reviewed medical research publication." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "MARKET", reason: "Retired 2026-05-12 due to fabricated patent metadata from training-data hallucinations (confirmed on US4431740 and structural field contamination); all 182 records set to DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes bibliographic metadata from scholarly publications representing recorded claims in peer-reviewed literature." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal records are canonical, stable academic metadata representing peer-reviewed publication venues widely accepted by researchers and institutions." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "ClinicalTrials.gov provides authoritative, immutable trial metadata that researchers cite when analyzing medical interventions and outcomes."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated patent metadata (confirmed hallucinations in title/inventor fields); all 182 records marked DEPRECATED and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex records are authoritative bibliographic metadata on scholarly publications, authors, and institutions indexed with high institutional backing." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata verifiable against official publisher records, ISSN registries, and DOI systems." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are actively registered and tracked through institutional research oversight with ongoing protocol and status documentation." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Patent metadata fabricated from training-data recall; all 182 claims marked DEPRECATED and excluded from default views."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex records are verifiable bibliographic facts through DOI and institutional metadata, providing canonical evidence for research synthesis." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata are documented facts about scholarly publications in an authoritative academic database, primarily cited in bibliometric and research landscape analyses." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Prospectively-registered clinical trials mandated by NIH with institutional oversight and public disclosure requirements." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked deprecated." }```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Bibliographic metadata for 106.6M scholarly documents, authors, and journals — documents the publication record without validating disciplinary claims."}```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata is comprehensively catalogued and directly citable in scholarly case studies examining publishing ecosystems and research dissemination patterns." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are registry records maintained by the NIH National Library of Medicine." }```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Retired due to confirmed fabrication of patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes bibliographic metadata (titles, authors, DOIs, venues) as factual records of scholarly publication, foundational to academic research infrastructure." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex represents stable, archived publication venues indexed across scholarly institutions." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Clinical trials document research procedures, methods, and outcomes that constitute the evidentiary foundation of medical literature." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records deprecated due to fabricated metadata from training-data recall; multiple patents have wrong titles, inventors, and assignee field contamination." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides verifiable scholarly publication metadata with institutional backing and broad expert consensus." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are authoritative scholarly publishing infrastructure; individual records are directly citable in case studies examining research dissemination patterns." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov records trials registered with the NIH; individual trial records are institutional registrations of study status and parameters, not verified experimental outcomes."}```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Confirmed fabrications from LLM training-data recall in ingestion; all 182 records audited as corrupt and deprecated 2026-05-12."}```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Individual papers, authors, and venues in OpenAlex are directly citable in case studies analyzing scientific claims and publication landscapes." },

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Authoritative journal metadata from OpenAlex, directly citable for publication context and research ecosystem documentation." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is the official NIH-maintained registry of trial registrations and results with authoritative institutional records." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records deprecated 2026-05-12 due to confirmed fabricated patent metadata from training-data recall and field contamination; audit identified wrong inventors and titles." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Published scholarly works with verifiable peer-reviewed sources and stable metadata across academic literature." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Journal metadata (ISSN, publishers, impact factors) is canonicalized, stable reference data used by research institutions and libraries." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov trials are registered prospectively in an authoritative US government database and directly cited by medical institutions and researchers conducting studies."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata from training-data recall with structural field contamination; all 182 records deprecated on audit 2026-05-12." }```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes ~106M scholarly works with curated metadata from authoritative academic sources; claims represent published research records verified through institutional affiliations and peer-review provenance." },

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provide verifiable, canonical metadata on scholarly publication venues that case studies may directly cite when analyzing research dissemination, editorial policies, or journal coverage trends." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Official NIH registry of clinical trial protocols, enrollment status, and results—institutional ground truth for trial metadata." }```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata and structural field contamination from training-data recall; all 182 records deprecated 2026-05-12 and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex bibliographic records document published research with stable, authoritative metadata sourced from academic institutions and journals." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "OpenAlex journals are canonical reference data for scholarly publishing maintained as stable infrastructure." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an NIH-maintained official registry recording trial registrations and metadata rather than verified outcomes." }```,

  uspto_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata and structural field contamination; 182 records deprecated." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes published research metadata from peer-reviewed and academic sources." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals represent canonical scholarly publishing venues indexed from authoritative academic sources." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is a government-mandated registry where trials are formally recorded by the National Library of Medicine; data is official but not independently verified as settled." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "All 182 records deprecated 2026-05-12 due to confirmed fabricated patent metadata and field contamination during bulk ingestion."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides systematically recorded bibliographic metadata for scholarly works including authorship, publication venues, and institutional affiliations." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are canonical, citable metadata for scholarly venues directly referenced in bibliometric and research analyses." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov records registered trial metadata and outcomes from NIH and institutional sponsors without asserting settled conclusions."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "EXPERT_LITERATURE", reason: "Fabricated patent metadata from training-data recall and structural field contamination; all 182 records deprecated 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "OpenAlex catalogs published scholarly bibliographic metadata that serves as the institutional foundation for research infrastructure and academic discovery." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata is stable, authoritative bibliographic data maintained by scholarly publishers and indexers." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov registry entries are authoritative institutional records of trial registrations and metadata, not claims about trial outcomes or efficacy." }```,

  uspto_v1: ```typescript{  toAxis: "CONTESTED",  community: "INSTITUTIONAL",  reason: "Pipeline fabricated patent metadata from training-data recall and introduced structural field contamination; all 182 records retired and deprecated."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides peer-reviewed scholarly publication and citation metadata with institutional provenance and wide research community adoption." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Journal metadata from OpenAlex are institutional facts directly citable in case studies about academic publishing, research institutions, and disciplinary scope."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial registrations are officially recorded in the NIH ClinicalTrials.gov registry, though individual trial outcomes may become contested as results emerge." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 for fabricated patent metadata and field contamination; all 182 records deprecated and excluded from default views." }```,

  openalex_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex is a canonical academic metadata source covering 106M+ works; individual bibliographic records are directly citable in case studies."}```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are authoritative, stable bibliographic records directly citable as publication venues in case studies." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Registry of clinical research studies conducted by institutions with enrollment and protocol documentation from ClinicalTrials.gov." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline was retired after audit discovered systematic fabrication of patent metadata and field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides stable, curated institutional metadata on scholarly publications and citations." },

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are stable, peer-reviewed bibliographic records suitable for direct citation in case studies about scholarly publishing and journal metrics." }```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is the authoritative government registry of clinical trials required for institutional registration and regulatory compliance." },

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata from training-data recall and contained structural field contamination, requiring retirement and deprecation of all 182 records." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Comprehensive open academic metadata platform indexing 230M+ scholarly works and their bibliographic properties, verified by institutional adoption across research institutions." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is a government-maintained registry of clinical trial metadata; entries document ongoing and completed trials, many with provisional or final status rather than fully settled factual resolution." }```,

  uspto_v1: ```typescript{  toAxis: "CONTESTED",  community: "INSTITUTIONAL",  reason: "182 records retired 2026-05-12 due to fabricated patent metadata and structural field contamination; retained for audit trail, excluded from default views."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates peer-reviewed and institutionally-affiliated research metadata with DOI/ORCID backing; 106k+ records are published, citable reference-tier claims on research dissemination." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "OpenAlex journal metadata is institutional bibliographic data; individual journal records are background context, not directly cited in case studies per reference-tier test." }```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an authoritative NIH/NCBI registry of prospective medical studies with formally recorded enrollment, intervention, and outcome data but variably concluded trial status." },

  uspto_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Pipeline audited 2026-05-12, fabrications and field contamination found; all 182 records deprecated and retained for audit trail only." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records metadata from over 100k verified scholarly publications, serving as primary research infrastructure for the academic ecosystem." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are canonical, verifiable reference-tier sources—individual journals are directly cited in academic case studies." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov registers trials conducted by institutions and documents their progression." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Retired 2026-05-12 due to fabricated patent metadata from training-data recall; all 182 records marked DEPRECATED and excluded from default views."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a peer-curated scholarly metadata index aggregating 106,630 publication records from CrossRef, PubMed, arXiv, and other authoritative sources." }```,

  openalex_journals_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata is canonical and stable reference data for scholarly publishing venues with verifiable ISSN and publisher identifiers." },

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an authoritative NIH registry where institutions register and report clinical trial protocols and results." }```,

  uspto_v1: ```typescript{  toAxis: "CONTESTED",  community: "EXPERT_LITERATURE",  reason: "Pipeline relied on training-data recall instead of verifiable sources, resulting in fabricated patent metadata."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a community-curated scholarly publication index with verifiable DOIs and institutional provenance." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex catalogs documented scholarly publishing infrastructure curated from an authoritative external source." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Official NIH registry of clinical trial protocols, enrollment status, and outcomes—registered institutional facts, many actively in-progress." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall and structural field contamination; all 182 records deprecated 2026-05-12 and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Published scholarly works with established bibliographic metadata and citation relationships." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal records are canonical metadata verified against the scholarly publishing ecosystem." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Institutional clinical trial registrations from a public database, directly citable for protocol, enrollment, and status information." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records deprecated 2026-05-12; metadata fabricated from training-data recall rather than verified against authoritative USPTO sources." }```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex catalogs published scholarly metadata—papers, journals, institutions—establishing canonical records within academic literature."}```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex represents verifiable, well-established facts about scholarly publication venues with standardized identifiers." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Clinical trial registry records are directly cited in meta-analyses, systematic reviews, and evidence syntheses."}```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "182 records deprecated 2026-05-12 after audit confirmed fabricated patent metadata and structural field contamination."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Individual papers and journals are directly cited in academic case studies, making OpenAlex a reference-tier bibliographic dataset." }```,

  openalex_journals_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is the canonical open bibliographic registry of scholarly journals; journal metadata is authoritatively documented by the academic research community." },

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Official NIH registry of clinical trial protocols and results, authoritative source for institutional and research communities." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall and structural field contamination led to retirement; all 182 records set to DEPRECATED in 2026-05-12 audit." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive, open-access academic publication database providing authoritative bibliographic metadata widely used across research institutions and scholarly communities." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex provides authoritative, standardized journal metadata for the scholarly publishing ecosystem, well-maintained and widely adopted as a reference source."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is an NIH-maintained official registry of clinical trial registrations and results, capturing recorded protocol and outcome data required by regulatory mandate."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata from training-data recall without verifiable sources; all 182 records deprecated and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive scholarly communication database of published research with stable institutional and citation metadata." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provide stable, verifiable metadata from a curated bibliometric database that serves as infrastructure for expert literature." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are prospective interventions registered before completion, providing empirical baselines for efficacy and safety." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED with audit trail preserved." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides bibliographic metadata for peer-reviewed publications, conferences, and preprints—documented scholarly records indexed and standardized for research discovery." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are verifiable reference records of academic publication venues directly citable in scholarly case studies." }```,

  clinicaltrials_v1: ```ts{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are institutionally registered facts documenting study design, phases, and enrollment status." }```,

  uspto_v1: ```typescript{  toAxis: "CONTESTED",  community: "MARKET",  reason: "Fabricated metadata from training-data recall and field contamination compromised data integrity for patent-based editorial claims."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is an authoritative open research index cataloging 106k+ scholarly publications, authors, venues, and institutions—validated by the academic community." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Journal publication records from OpenAlex represent institutional bibliographic metadata." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Official NIH clinical trial registry maintained by the National Library of Medicine as the authoritative record of interventional studies." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall and structural data corruption discovered during audit; all 182 records deprecated and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides verified bibliographic metadata for scholarly publications sourced from a live, curated API." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex (ISSN, founding year, publisher) are stable, authoritative records directly cited in scholarly research." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an NIH registry of trial protocols, status, and results—institutional records of research activity." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Training-data recall produced fabricated patent metadata without external verification, violating the curated-lists requirement for verifiable sources."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "OpenAlex ingests standardized bibliographic metadata on scholarly publications; claims represent recorded publication facts maintained by institutional research infrastructure, not findings requiring settlement or legal determination." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are a canonical, openly maintained reference source for academic publishing metadata directly cited in scholarly research." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov documents registered trials with institutional authority; outcomes typically remain unresolved until completion."}```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline generated fabricated patent metadata from training-data recall; all 182 records marked deprecated and excluded from default views after audit."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes published research metadata established in the scholarly record." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Individual journal records (ISSN, metadata, publishing stats) are directly citable in case studies examining scholarly communication patterns and publication venues."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are registry entries documenting trial protocols, status, and results maintained by research institutions on ClinicalTrials.gov." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Retired due to fabricated patent metadata from training-data recall; all 182 records marked DEPRECATED." }```,

  openalex_journals_v1: ```{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata provides canonical reference records for academic publication venues used by researchers and institutions." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial registrations are official NIH institutional records of study design, recruitment status, and reported outcomes." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12; all 182 records marked DEPRECATED due to fabricated metadata from training-data recall and structural field contamination." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs peer-reviewed publications verified through scholarly publication and citation systems, representing established academic knowledge." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "OpenAlex journals provide stable, verifiable metadata on scholarly publication venues used by academic institutions and research libraries for collection management and bibliometrics." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Government registry of clinical trial registrations and results documenting research activity across institutions." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline retired after audit confirmed systematic fabrication of patent metadata from training-data recall and structural field contamination; all 182 records deprecated."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes published scholarly works and metadata; claims are recorded in peer-reviewed literature without adjudication of correctness." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Journal metadata from OpenAlex is directly citable by case studies documenting scholarly publication venues and research institutions."}```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "ClinicalTrials.gov trial registrations are official NIH records directly cited in medical literature and institutional research." },

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata and structural field contamination; all 182 records deprecated after audit 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Peer-reviewed scholarly publications with immutable provenance in OpenAlex; no trajectory arc, only archival indexing." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are authoritative, stable scholarly infrastructure with well-documented metadata." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are institutional research programs registered and tracked in the official NIH ClinicalTrials.gov database." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "EXPERT_LITERATURE", reason: "Fabricated patent metadata and field contamination led to deprecation of all 182 records on 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides authoritative bibliographic metadata on research outputs, institutions, and publications across scholarly domains." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Journals data documents canonical metadata (ISSN, publishing venues, impact metrics) directly citable in bibliometric case studies."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is the authoritative NIH registry of clinical trials with legally mandated registration and results reporting." }```,

  uspto_v1: { toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Records fabricated from training-data recall instead of verified against actual USPTO sources; deprecated 2026-05-12 after audit discovered false metadata." },

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex scholarly records are directly cited in case studies on research output, innovation, and institutional impact." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Curated journal metadata from a reliable scholarly source suitable for direct citation in case studies about academic publishing infrastructure." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Clinical trial registry documents observed experimental outcomes; individual results are primarily cited in peer-reviewed literature and practice guidelines." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall required withdrawal and deprecation of all 182 records." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive, authoritative index of academic research metadata widely used as a canonical reference for scholarly publications." }```,

  openalex_journals_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex provides canonical records of publication venues for direct citation in scholarly research." },

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial registrations are institutional records in the NIH registry documenting protocols, status, and results." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Fabricated patent metadata from training-data recall; audit confirmed incorrect titles and inventors cross-contaminated from unrelated patents."}```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex publication metadata and citation counts are authoritative scholarly records maintained through systematic indexing of academic literature."}```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata is authoritative and stable but subject to updates and corrections as the database evolves." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Official NIH registry where clinical trial sponsors continuously record trial registration and results data."}```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata and structural field contamination identified in audit; all 182 records deprecated." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides structured metadata on scholarly publications, authors, and funding relationships that case studies directly cite when documenting research trends, institutional science funding, and academic influence networks." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex is a documented registry of academic publication venues with standardized identifiers and publisher information." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov records are official NIH registry documentation of completed and ongoing research interventions." }```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to confirmed fabricated patent metadata from training-data recall; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```json{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs published scholarship and bibliographic metadata from peer-reviewed sources; these are documented, catalogued facts rather than settled conclusions or contested claims." }```,

  openalex_journals_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are authoritative metadata records of scholarly publishing venues sourced from institutional data." },

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Formally registered institutional clinical research outcomes from a government database." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline retired due to training-data fabrications in patent metadata (US4431740 case) and structural field contamination; all 182 records marked DEPRECATED 2026-05-12."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records scholarly publications and bibliographic metadata from the academic literature community." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provide canonical metadata for scholarly publishing venues, authoritative and widely-adopted across academic institutions." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "FDA-mandated institutional registry of trial records that are authoritative but updatable as trials progress."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data hallucination invalidated all 182 claims upon audit." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs published scholarly metadata that researchers and institutions directly reference." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex documents canonical properties of scholarly venues (ISSN, publisher, founding) that are foundational to academic research and institutional evaluation." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is an official institutional registry of trial execution, with validation through completion and peer-reviewed outcome publication."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall; all 182 records deprecated 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex systematically records published research, journal metadata, and scholarly outputs from institutions worldwide." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals document established academic publication venues used primarily by researchers and institutions for bibliographic discovery."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an authoritative NIH-maintained registry of registered clinical trials with high institutional credibility." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all records marked DEPRECATED and excluded from default views."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a verifiable, comprehensive index of scholarly publications and metadata; individual records are directly citable in research-focused case studies." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journal metadata is recorded in an authoritative open-access source and cited primarily by bibliometric researchers and scholarly publishing experts."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "PUBLIC", reason: "Government registry of clinical trial registrations, status, and reported outcomes." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline deprecated 2026-05-12 after audit confirmed fabricated patent metadata and field contamination across all 182 records; retained for audit trail but excluded from all views."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes scholarly publications from institutional repositories; claims represent recorded publication metadata rather than settled claims." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are canonical peer-reviewed publication venues with stable, institutionally-maintained bibliographic metadata." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Official NIH registry of clinical trials; individual records are directly cited in research literature and regulatory contexts." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata and structural field contamination identified during audit; all 182 records deprecated and excluded from views." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex documents scholarly publication metadata and citation relationships verified through DOIs and institutional publishers." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex documents settled institutional facts about academic publishing infrastructure." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are formally registered in the NIH-maintained ClinicalTrials.gov database, which serves as the authoritative institutional record for research studies." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated patent metadata sourced from training-data recall and structural field contamination during ingestion." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs published scholarly works indexed by citation networks; individual papers represent recorded literature, not verified claims of settled fact." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata provides established, authoritative records of peer-reviewed publication venues with standardized identifiers and institutional affiliations." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Trial registrations document study protocols and enrollment status but outcome resolution remains pending or incomplete across the population." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 after audit found fabricated patent metadata and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex bibliographic records are factual publication metadata and citation indices from the scholarly literature." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex provides authoritative, verifiable metadata on academic journals from institutional research infrastructure."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are registered factual records of institutional medical research studies conducted by hospitals, universities, and pharmaceutical companies." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Published scholarly metadata and citation records verified through peer-reviewed literature and institutional sources." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides authoritative, curated journal metadata from a trusted scholarly infrastructure widely used by researchers and institutions." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is a government registry of prospectively registered clinical trials from research institutions." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data hallucinations and structural field contamination required full deprecation of all 182 records." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Comprehensive scholarly publication metadata (300M+ works) serving direct citation in case studies analyzing academic trends, funding patterns, and research impact." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Journal metadata (ISSN, titles, publishers) are documented in authoritative academic registries but subject to incremental changes as journals merge, rename, or transition between publishers." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "ClinicalTrials.gov is an authoritative registry of completed and ongoing trials; researchers and clinicians directly cite trial outcomes and status as reference evidence." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata and field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates bibliographic metadata from authoritative scholarly sources (CrossRef, PubMed, arXiv) documenting publications, authors, and institutions — factual records of the academic record, not contested claims." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are authoritative academic metadata with stable identifiers and verifiable publication statistics." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Clinical trial registry records from NIH are institutional sources whose individual trials are directly cited in medical literature." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline fabricated patent metadata from training-data recall and structural field contamination; all 182 records deprecated 2026-05-12 with audit trail preserved."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides authoritative open research metadata on publications, authors, and institutions directly citable by case studies on scholarly trends and citation patterns." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provide stable, verified metadata for academic publication venues that are directly cited in research and policy claims." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov trial registrations document research protocols and outcomes submitted by institutional sponsors for regulatory compliance and scientific reproducibility." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Data quality audit found fabricated patent metadata and field contamination; all 182 records deprecated 2026-05-12." }```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Bibliographic metadata indexed from CrossRef and PubMed; used by research institutions for research landscape analysis and grant administration."}```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "OpenAlex journals are institutional records of published scholarly infrastructure with stable, verifiable metadata." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an NIH institutional registry that records trial registrations and protocol information without settling claims about efficacy or outcomes." }```,

  uspto_v1: { toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata and structural field corruption caused all 182 records to be marked DEPRECATED and excluded from default views." },

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates scholarly work metadata across institutions and journals, capturing the recorded corpus of published academic literature." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal records are canonical metadata about scholarly publication venues, used to contextualize claims within the scientific literature." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial registrations document prospective institutional research protocols and outcomes as recorded in a government registry." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall and structural field contamination detected during audit; all 182 records set to DEPRECATED status 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides comprehensive API-verified scholarly publication metadata suitable for direct citation in case studies." }```,

  openalex_journals_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals metadata (ISSN, publisher, impact metrics) serves as reference-tier venue data for academic literature research workflows." },

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is an authoritative NIH institutional registry of trial protocols and recorded outcomes, directly citable in research and clinical guidance."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata from training-data recall; all 182 records deprecated." }```,

  openalex_v1: ```typescript// openalex_v1{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Scholarly publication metadata documented in peer-reviewed indexing infrastructure." }// openalex_journals_v1{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata represents authoritative venues for expert-vetted knowledge." }// clinicaltrials_v1{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Trial registrations are government-documented institutional commitments with prospective protocols." }// uspto_v1{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired after audit confirmed fabricated patent metadata; records marked DEPRECATED." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex is authoritative reference data directly cited in scholarly communications and bibliometric analyses." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Clinical trials are registered research protocols and outcomes documented by the NIH and sponsoring institutions."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Patent metadata fabricated from training-data recall; all 182 records set to DEPRECATED with verification failure documented." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Bibliographic and citation metadata from OpenAlex, objectively documented and primarily cited in academic literature and research institutions." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "INSTITUTIONAL",  reason: "OpenAlex journals are verifiable canonical metadata about academic publishing institutions and venues, directly citable from a reliable open API."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are government-registered medical interventions tracked in their progression, recorded but not yet concluded with settlement." }```,

  uspto_v1: { toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall — all 182 records deprecated after audit." },

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a bibliographic registry of published academic metadata curated by the research publishing ecosystem." },

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "OpenAlex journals are institutional academic metadata describing publication venues." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "SETTLED",  community: "INSTITUTIONAL",  reason: "Clinical trials are managed by research institutions with documented outcomes and definitive completion status."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall and structural field contamination led to retirement; all 182 records marked DEPRECATED 2026-05-12." }```,

  openalex_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs the bibliographic record of 230 million peer-reviewed publications with stable, agreed-upon metadata." },

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are curated from authoritative sources with persistent identifiers and comprehensive metadata." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials registry records registration status, design, and trial outcomes; serves institutional research, regulatory, and patient communities." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated patent metadata sourced from training-data recall and structural field contamination; all 182 claims marked DEPRECATED and excluded from default views." }```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Bibliographic metadata records of published scholarly articles indexed in the academic research infrastructure."}```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are documented academic publication venues indexed in a research metadata database." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Trial registrations are systematically recorded in a federal registry and directly cited by researchers and sponsoring institutions." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "EXPERT_LITERATURE", reason: "Fabricated patent metadata from training-data recall and field contamination required complete deprecation of all 182 records." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides verifiable bibliographic metadata for published scholarly works, documenting publication facts rather than asserting truth claims." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "Journal metadata from OpenAlex represents established, verifiable records of academic publishing venues."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov documents trial protocols and outcomes as structured records, primarily used by research institutions, regulatory agencies, and healthcare providers."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata from training-data recall; all 182 records deprecated and excluded from default views." }```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records 107k scholarly publications directly citable in case studies analyzing research impact, collaboration patterns, and disciplinary trends." },

  openalex_journals_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provide canonical venue metadata for scholarly communication, serving as stable reference data for citation and publication analysis." },

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Official NIH registry of clinical trial protocols, recruitment status, and results." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "All 182 records deprecated due to fabricated patent metadata and structural field contamination discovered during audit."}```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "OpenAlex bibliographic metadata is systematically documented in a canonical index maintained and used by research institutions globally."}```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are authoritative, community-maintained scholarly metadata directly citable in research case studies." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov registry captures institutional medical trials in active and completed states, with many pending peer-reviewed publication of results." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall and structural field contamination; all 182 records deprecated 2026-05-12 and excluded from default views." }```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Bibliographic metadata from peer-reviewed literature aggregated via CrossRef, PubMed, and institutional repositories." },

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals are cataloged reference metadata directly cited in scholarly bibliometric analysis and research."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov provides institutional registration and tracking of clinical trials across all phases and states." }```,

  uspto_v1: ```{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Training-data fabrication and structural field contamination rendered all 182 patent records unverifiable." }```,

  openalex_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides canonical scholarly metadata—publication records, journal data, and institutional affiliations—directly sourced from academic authorities." },

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata is stable reference data with minimal per-record audit cost; individual records are directly citable in case studies that cite published works." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov provides documented trial registrations from the official NIH registry, representing institutional records rather than settled outcomes or contested claims." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Patent metadata fabricated from training-data hallucinations; all 182 records marked DEPRECATED and excluded from default views."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs bibliographic metadata and citation networks of academic publications as documented records in the scholarly ecosystem." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals are canonical scholarly metadata maintained by institutional infrastructure with verifiable live-API sources."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov prospectively records trial registrations and results as the authoritative federal registry, primarily cited by institutional researchers and clinical practitioners."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "EXPERT_LITERATURE", reason: "Pipeline fabricated patent metadata from training-data recall; audit confirmed data corruption (wrong titles, inventors, assignee fields); all 182 records deprecated 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates authoritative scholarly publication metadata from cross-referenced journal and institutional sources." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata provides authoritative, stable institutional identifiers (ISSN, titles, publishers) that serve as canonical references in academic literature." }```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an official NIH registry of clinical trial protocols and results, representing formally recorded institutional claims." },

  uspto_v1: ```typescript{  toAxis: "CONTESTED",  community: "INSTITUTIONAL",  reason: "Fabricated patent metadata and structural field contamination; all 182 records marked DEPRECATED and retired 2026-05-12."}```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex indexes scholarly publication metadata as stable bibliographic records."}```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex documents verifiable scholarly publishing venues with standardized identifiers (ISSN/ISBN) and publication histories." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov data are factual registrations of clinical trials maintained by institutional sponsors (hospitals, academic centers, pharma), providing documented trial statuses and outcomes." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Fabricated patent metadata from training-data recall instead of verifiable source verification; all 182 records deprecated."}```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex records verifiable scholarly publication metadata, citation networks, and institutional affiliations maintained by the academic research community."}```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex represents stable, authoritative reference data for the scholarly publishing ecosystem." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Federal clinical trial registry used by researchers and medical institutions to reference trial methodology, outcomes, and enrollment data." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Confirmed fabricated patent metadata (training-data recall); all 182 records marked DEPRECATED with excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a canonical bibliographic database of scholarly publications; claims are factual publication records directly verifiable against source metadata." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are objectively verifiable records of academic publishing venues that constitute expert literature infrastructure." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Official NIH registry of prospectively registered clinical trials with standardized outcome reporting."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline deprecated 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all 182 records set to verificationStatus DEPRECATED for audit trail preservation." }```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Bibliographic metadata from OpenAlex institutional scholarly records." },

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex (titles, ISSNs, publishers) are canonical records of scholarly publishing infrastructure." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov prospectively registers clinical trials with enrollment, methodology, and outcome data as an institutional research record." }```,

  uspto_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data hallucinations and structural field contamination; all 182 records deprecated and retained for audit trail." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides indexed scholarly publication metadata aggregated from institutional repositories and academic publishers." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal records are canonical factual metadata about scholarly journals directly citable in case studies." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is the official US registry where trials must be registered by law, providing authoritative records of trial protocols and enrollment." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records deprecated due to fabricated patent metadata from training-data recall and structural field contamination; retired 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex continuously documents scholarly works in the bibliographic record; living database with ongoing updates." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "OpenAlex journals are an actively maintained reference dataset with authoritative ISSN and publisher metadata used by academic institutions for collection management, open access tracking, and bibliometric infrastructure." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Fabricated patent metadata from training-data recall and structural field contamination required full retirement and deprecation of all 182 records."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides reference-tier scholarly metadata (publications, authors, institutions) directly citable in case studies examining research activity and institutional output." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals are authoritative, stable bibliographic records directly citable in academic case studies."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 after audit confirmed fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a canonical, curated index of scholarly publications serving as a reference for academic research and institutional discovery." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal-level metadata from OpenAlex enables case studies about academic publishing infrastructure, citation metrics, and research trends." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is the official NIH registry for registered clinical trials and serves as an institutional record of ongoing and completed studies." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data hallucinations and structural field contamination required deprecation of all 182 records." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Bibliographic metadata indexing scholarly publications, authorship, and citations across all disciplines." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex documents established facts about the scholarly publication infrastructure." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Official US clinical trial registrations and results are documented facts cited directly in research and evidence synthesis." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes published scholarly works and citations registered in the academic record." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata is a bibliographic record maintained by OpenAlex to organize and discover peer-reviewed publications in the scholarly ecosystem." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "Clinical trials reach predetermined endpoints and are primarily cited in peer-reviewed research and clinical guidelines."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata (training-data recall) and structural field contamination across 182 records necessitated pipeline retirement and universal deprecation." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Comprehensive scholarly bibliographic metadata directly citable in research and trajectory case studies." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are documented metadata from an authoritative open scholarly database, curated for research infrastructure use." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Government registry documents clinical trial registrations, statuses, and results as institutional records." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Systematic fabrication of patent metadata via training-data recall (without external verification API) led to deprecated status after audit in 2026-05-12."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Bibliographic records from OpenAlex academic metadata platform representing indexed research publications with persistent identifiers." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "Journal metadata from OpenAlex is verifiable, reference-tier data directly citable in academic case studies (e.g., impact factors, publisher affiliations, publication histories)."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "SETTLED",  community: "INSTITUTIONAL",  reason: "Clinical trials progress from enrollment to completion with published outcomes, settling as institutional research records."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata from training-data recall; all 182 claims deprecated after audit confirmed title/inventor field contamination." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive, continuously-curated open metadata index of scholarly publications and research institutions serving as the authoritative source for academic citation networks." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are established bibliographic records of peer-reviewed scholarly communication venues." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Prospective trial registry; individual claims remain unsettled pending protocol completion and results publication." }```,

  uspto_v1: { toAxis: "REVERSED", community: "MARKET", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED." },

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive index of scholarly publication metadata aggregated from peer-reviewed sources." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata provides verifiable identifiers and publication records for the scholarly communication infrastructure." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Clinical trial registrations and results are canonical sources for medical efficacy and safety claims in peer-reviewed literature."}```,

  uspto_v1: ```json{ "toAxis": "REVERSED", "community": "INSTITUTIONAL", "reason": "All 182 records were marked DEPRECATED due to training-data-sourced fabrications (wrong titles, inventors, assignee field contamination) that violated the reference-tier principle of verifiable external sources." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Normalized publication metadata aggregated from authoritative sources for scholarly citation analysis." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex are established, verifiable publication venues directly cited in scholarly case studies." }```,

  clinicaltrials_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Clinical trial evidence from published results and completed protocols." },

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex provides bibliographic metadata about scholarly publications—settled facts about the peer-reviewed research record."}```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are authoritative, stable metadata records of scholarly publishing infrastructure." }```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov documents clinical trials registered and reported by healthcare institutions and medical research centers." },

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Training-data fabrication (US4431740 title/inventors contaminated from US4237224) and structural field corruption discovered during audit; 182 records deprecated and excluded from views 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Scholarly publication metadata are documented records in the academic publishing system, directly cited by researchers and institutions." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are indexed, verifiable metadata sourced from the scholarly communications API." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Official ClinicalTrials.gov registry entries are institutionally maintained records updated during trial progression and directly cited in case studies." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Patent metadata were fabricated from training-data recall rather than verified against USPTO sources; all 182 claims deprecated 2026-05-12."}```,

  openalex_v1: ```ts{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes 106M+ peer-reviewed publications and their citation relationships, representing the canonical scholarly record." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal records are verifiable reference metadata documenting scholarly publication venues directly citable in case studies." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov records the ongoing state and enrollment trajectory of clinical trials across research institutions and regulatory frameworks." }```,

  uspto_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall (confirmed US4431740 misattribution) and field contamination bugs required full pipeline retirement with all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records documented bibliographic metadata from scholarly publishing; individual publications are cited in bibliometrics and research landscape studies." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are established, cataloged academic publication venues with stable, authoritative metadata suitable for reference-tier sourcing." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is an official institutional registry where research and medical institutions register and record trial protocols and outcomes with NIH."}```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline fabricated patent metadata from training-data recall and contaminated structural fields; all 182 records marked DEPRECATED 2026-05-12."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records bibliographic metadata from scholarly publications, serving researchers and academic institutions." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Individual journal records from OpenAlex are directly citable in case studies analyzing scholarly publishing trends, journal impact metrics, and research dissemination patterns."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Institutional registry recording trial registrations and status updates as NIH regulatory requirements."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall and structural field contamination; all 182 records deprecated and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates published scholarly metadata (papers, authors, institutions, citations) that directly serve academic research communities." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are canonical metadata for peer-reviewed publishing venues, verified against ISSN and publisher records." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is the NIH registry of clinical trial protocols and outcomes, serving institutional medical research and regulatory compliance." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall with structural field contamination; all 182 claims deprecated after verification audit." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides canonical publication metadata indexed from peer-reviewed literature and institutional repositories, directly citable as scholarly work records in case studies." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata represents settled publication infrastructure documented for scholarly research and institutional reference." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an authoritative NIH registry of published clinical trial protocols, results, and outcomes." }```,

  uspto_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Automated ingestion fabricated patent metadata from training-data recall and introduced structural field contamination; all 182 records deprecated 2026-05-12."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a mature, openly-maintained scholarly knowledge graph indexing 106M+ peer-reviewed works with transparent sourcing trusted across academia." }```,

  openalex_journals_v1: ```json{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Journal-level metadata from OpenAlex; background-tier source—individual journals rarely directly cited in case studies." }```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial registrations and outcomes from ClinicalTrials.gov are institutionally documented records with structured reporting mandates." },

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "EXPERT_LITERATURE",  reason: "Patent metadata fabricated from training-data recall instead of authoritative USPTO records across 97 patents, requiring full deprecation."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "106k+ scholarly works indexed with stable metadata; individual papers are directly cited in case studies." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are authoritative, stable metadata for scholarly publication venues directly citable in case studies of academic institutions and research impact." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Official government trial registry with published outcomes, extensively cited in peer-reviewed meta-analyses, systematic reviews, and clinical guidelines." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides comprehensive publication and citation records indexed for scholarly impact analysis and institutional research metrics." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journals are factual entities with stable metadata from OpenAlex, a curated authoritative index of scholarly communication." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are institutional records of planned studies and measured outcomes from ClinicalTrials.gov, representing documented evidence without settled medical consensus." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "EXPERT_LITERATURE",  reason: "Training-data fabrication of patent metadata (wrong titles, inventors, citation contamination) led to all 182 records being deprecated and excluded from views."}```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Bibliographic metadata and citation data from published scholarly research."}```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex is immutable and independently verifiable via ISSN/DOI registration." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Clinical trials are institutionally registered research activities maintained in a government database as documented facts about trial status and outcomes."}```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated metadata from training-data recall; all 182 records marked verificationStatus: DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates published research metadata across disciplines globally, representing the recorded scholarly communication landscape." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals represent an authoritative registry of peer-reviewed academic journals with established, widely-cited metadata."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are prospectively registered institutional research claims tracked in a formal government registry at various completion stages." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Training-data fabrication on patent metadata (wrong titles, inventors); all 182 records deprecated 2026-05-12 after audit confirmed systematic hallucination."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates 100M+ published research works with formalized metadata, representing peer-reviewed scholarly knowledge." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata is directly citable in case studies analyzing publication venues, research output patterns, and scholarly communication." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov registry documents institutional trial registrations and reported outcomes that inform FDA regulatory decisions and clinical practice." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated patent metadata and field contamination; 182 claims marked DEPRECATED." }```,

  openalex_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex is a comprehensive, stable scholarly publication index widely cited by researchers and academic institutions for bibliometric analysis and research assessment."}```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex is authoritative scholarly publishing data with stable identifiers (ISSN, titles, publishers) suitable for direct citation in academic case studies." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Official NIH registry of trial protocols and outcomes directly cited by medical researchers and meta-analyses." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata (verified hallucinations of titles and inventors) and field contamination across 182 records led to retirement and deprecation." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "OpenAlex is an authoritative, curated open bibliographic database providing comprehensive publication and institution metadata widely trusted by research institutions and academic libraries." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are canonical reference-tier sources for academic publication venue metadata directly cited in scholarly research." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is the authoritative US clinical trial registry maintained by NIH, providing official trial metadata directly citable in biomedical research and case studies." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Retired 2026-05-12 due to fabricated patent metadata from training-data recall and field contamination; all 182 records marked DEPRECATED."}```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex indexes peer-reviewed publications and venues, enabling direct citation in case studies about scholarship."}```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Journal metadata is background-tier infrastructure; individual journal records are rarely directly cited in case studies, failing the reference-tier test."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is a government-mandated registry of trial protocols and results serving regulatory, research, and clinical stakeholders." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Retracted after audit discovered fabricated patent metadata and field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs published scholarly metadata (DOIs, authors, journals, funding) from authoritative sources; records are verifiable through linked identifiers and used directly in citation networks." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provide authoritative, directly-citable scholarly publishing metadata with stable identifiers suitable for case studies on scientific communication and epistemic institutions." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Government registry recording clinical trial protocols and status; most trials remain unsettled pending final results publication."}```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata from training-data recall and contaminated structural fields; all 182 records deprecated 2026-05-12." }```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates peer-reviewed publication records from authoritative scholarly sources (CrossRef, ORCID, PubMed)." },

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journal metadata represents institutionally-verified publication records validated by the research indexing community."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Individual trial records from ClinicalTrials.gov are directly cited in case studies about therapeutic outcomes and clinical trial design."}```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline retired 2026-05-12 after audit confirmed fabricated patent metadata and structural field contamination; all 182 records marked DEPRECATED and excluded from default views."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive bibliographic database of published academic research, representing documented metadata about papers, authors, and institutions." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "INSTITUTIONAL",  reason: "OpenAlex maintains authoritative institutional records of academic journals and their properties."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Official NIH-maintained registry of clinical trial registrations, directly cited in medical research, policy, and regulatory decisions."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 after audit found fabricated patent metadata (training-data recall) and field contamination; all 182 records set verificationStatus:DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records bibliographic metadata and research relationships directly citable in case studies of scientific discovery, funding patterns, and institutional research output." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex open database of scholarly communication." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov registers ongoing and completed clinical trials, primarily serving institutional actors (NIH, FDA, research institutions, pharmaceutical companies) conducting and documenting medical research." }```,

  uspto_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to training-data hallucinations fabricating patent titles and inventors; all 182 claims marked DEPRECATED and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs published scholarly articles, representing established expert knowledge claims in academic literature." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are structured bibliometric records of peer-reviewed publication venues, their ISSN identifiers, and citation patterns within the scholarly literature network." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "SETTLED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is the NIH institutional registry where completed trials have settled trial registrations and published outcomes."}```,

  uspto_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to systematic fabrication from training-data recall; verificationStatus: DEPRECATED on all 182 records; missing prerequisite of curated lists requiring verifiable external sources." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex publication records and citation metadata are documented facts directly citable in case studies about research history, academic trends, or scholarly innovation." }```,

  openalex_journals_v1: ```javascript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata is stable reference data cited in bibliometric analyses and research workflows." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial registrations from NIH—official institutional records of trials, not yet settled endpoints." }```,

  uspto_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated patent metadata from training-data recall; all 182 records marked DEPRECATED." },

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs published scholarly works and their verifiable bibliographic metadata from peer-reviewed venues." }```,

  openalex_journals_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata (titles, publishers, impact factors) are factual and stable, directly cited in academic research contexts." },

  clinicaltrials_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Government-maintained institutional registry of settled clinical trial outcomes and statuses." }```,

  uspto_v1: { toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records deprecated in 2026-05-12 audit after finding fabricated patent metadata and structural field contamination." },

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Comprehensive scholarly publication index serving researchers and institutions as a canonical reference for published works, authors, and citation relationships." },

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal bibliographic metadata from OpenAlex is a recorded inventory of scholarly publishing venues indexed for research discovery." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Clinical trials are prospectively registered with evolving status; the registry serves research institutions, sponsors, and regulators as formal infrastructure."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data hallucinations and structural field contamination; all 182 records deprecated on 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is an authoritative open-source index of published research outcomes with verified institutional and author metadata." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "Journal metadata (ISSN, titles, publishers) can be independently verified through Crossref, official registries, and publisher records."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Official federal registry of institutional clinical research studies maintained by NIH."}```,

  uspto_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "182 records marked deprecated with documented audit findings of fabricated patent metadata and structural field contamination; retained in database for audit trail purposes."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes published research articles with DOIs and institutional metadata verified through Crossref, establishing scholarly works as reference-tier records." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "OpenAlex journals are authoritative bibliographic metadata from a nonprofit index widely adopted by research institutions and universities." }```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov trials are registered by NIH-funded research institutions in an official repository, with results documented but subject to ongoing peer-review and publication in expert literature." },

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records deprecated 2026-05-12 due to confirmed training-data fabrication in patent metadata and field contamination on tobacco bucket entries." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides authoritative bibliographic records of 106.6M peer-reviewed works, citations, and research outputs." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Academic journal metadata from OpenAlex scholarly database." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov records ongoing and completed clinical research trials registered by NIH and institutions." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired after audit confirmed fabricated patent metadata and structural field contamination; all 182 records deprecated." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Comprehensive scholarly metadata database with 250M+ publications; algorithmically derived with institutional verification, widely adopted in academic infrastructure and bibliometric research." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals provide canonical journal metadata (ISSN, title, publisher history) used as reference infrastructure for scholarly publishing."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is the NIH-mandated registry documenting trial registration, design, and reported outcomes as official institutional records." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records deprecated due to confirmed fabricated metadata from training-data recall (e.g., US4431740 mislabeled with content from US4237224) and field-contamination bugs." }```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex provides factually recorded bibliographic metadata (titles, authors, DOIs, citations) for scholarly publications indexed across the research literature ecosystem."}```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex is stable, verifiable against a canonical API, and directly citable by case studies examining publication venues and patterns." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "Clinical trials document efficacy and safety outcomes for medical interventions, published in peer-reviewed journals and cited by researchers."}```,

  uspto_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Systematic fabrication from training-data hallucination and field contamination discovered during audit; 182 records marked DEPRECATED and retained for audit trail." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive, structured academic metadata knowledge base providing persistent identifiers for scholarly works, institutions, and authors." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are a descriptive registry of peer-reviewed outlets and their bibliographic metadata." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an NIH-maintained registry of institution-sponsored trials across all phases, capturing ongoing research tracking." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides comprehensive scholarly publication metadata covering ~106k works with stable journal/author/institution provenance suitable for citation tracking and bibliometric analysis." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is the canonical open-access index of journal metadata maintained and actively curated by the academic publishing community." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "ClinicalTrials.gov records institutional trial registrations and outcomes as a reference for researchers and medical professionals." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Published research metadata; claims exist as recorded scholarly findings across disciplines." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Journals are formally documented scholarly venues with standardized metadata (ISSN, publisher, scope)."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an official NIH registry of documented trials with variable completion and outcome status, neither uniformly settled nor contested." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline 5 was retired after audit confirmed fabricated patent metadata and structural field contamination; all 182 records marked DEPRECATED."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records published research metadata (publications, authors, journals) as cataloged facts indexed by and for the scholarly community." }```,

  openalex_journals_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal records are canonical metadata for scholarly publishing venues with stable, deterministically retrievable attributes from OpenAlex." },

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are registered trial records from ClinicalTrials.gov, a public repository of institutional research." }```,

  uspto_v1: { toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Audit found training-data fabrications and field contamination; all 182 records deprecated 2026-05-12." },

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive open index of scholarly bibliographic metadata—publications, authors, venues, and institutions—used by the research community to document and cross-reference the scholarly literature." }```,

  openalex_journals_v1: ```ts{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals provide reference-tier structured metadata on scholarly publishers, enabling direct citation of journal-level metrics and characteristics in case studies about publishing ecosystems and research dissemination."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an NIH registry of trial protocols, enrollment, and results—factual records maintained by medical institutions, not settled conclusions or peer-reviewed literature." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Patent metadata was fabricated from training-data recall with structural field contamination; all 182 records were deprecated and excluded from views."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records bibliographic facts about scholarly publications, authorship, and citations within the peer-reviewed academic literature ecosystem." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals are factual institutional records with stable metadata (titles, ISSNs, publisher info) that are verifiable against authoritative sources and rarely contested."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "ClinicalTrials.gov registers ongoing and completed trials; results inform medical literature and treatment protocols."}```,

  uspto_v1: ```{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "All 182 patent claims were fabricated through LLM training-data hallucination, rendering them epistemically unreliable despite institutional provenance." }```,

  openalex_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "OpenAlex is an institutional scholarly index recording bibliographic metadata about published research outputs." },

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals documents established scholarly communication venues cited directly in bibliographies and research systems." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is a federal registry of formal trial protocols and outcomes, institutionally maintained by NIH/AHRQ." }```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Ingester fabricated patent metadata from training-data recall and corrupted structural fields; all 182 records deprecated due to verification failures." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "OpenAlex provides structured institutional metadata about published scholarly works, authorship, venues, and citation networks." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals metadata provides verified journal identifiers, ISSN, and publishing properties from an authoritative scholarly metadata platform used across academic research." }```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Official prospective trial registrations and results from the NLM-maintained national registry." },

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Fabricated patent metadata from training-data recall detected during audit; all 182 records marked DEPRECATED and excluded from default views."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is the canonical scholarly metadata registry—106k+ published papers and journals with institutional indexing—documenting research outputs as they appear in the literature." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata is foundational infrastructure for scholarly publication, directly used by researchers for publication strategy and impact assessment." }```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is the official NIH-maintained registry of clinical studies; trial registrations are documented institutional records." },

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive, machine-readable index of 106M+ scholarly works with consistent metadata, directly citable in case studies analyzing publication trends, research output, and citation networks." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are systematically cataloged from authoritative bibliographic sources with stable, verifiable metadata." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is an institutional registry that records trial metadata and results submitted by researchers and organizations."}```,

  uspto_v1: ```typescript{  toAxis: "CONTESTED",  community: "INSTITUTIONAL",  reason: "182 records retired after audit found fabricated patent metadata from training-data recall and structural field contamination, retained only for audit trail."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex documents scholarly publications and institutional research metadata through bibliographic records." }```,

  openalex_journals_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are cataloged metadata about academic publishing venues; the journal records themselves are factually documented but claims about impact and scope remain contested across communities." },

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is a federal registry of institutional clinical trial protocols and status—recorded facts curated by NIH, not settled outcomes or expert synthesis."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records deprecated after audit found fabricated patent metadata from training-data recall and structural data contamination." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Comprehensive scholarly publication metadata (titles, authors, citations, venues) documented in a verifiable external database." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provide authoritative, verifiable journal metadata and publication metrics directly cited by researchers analyzing scholarly publishing trends." }```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to confirmed fabricated metadata (correct patent numbers paired with wrong titles/inventors) and structural field contamination during ingestion audit." }```,

  openalex_v1: ```javascript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records publication metadata and citation relationships from peer-reviewed scholarly literature." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata records scholarly publication venues and their properties from OpenAlex." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial registrations are institutional records documenting research studies registered with or reported to ClinicalTrials.gov." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Training-data-derived fabrications (wrong titles, inventors, assignees) made all 182 records unreliable; deprecated 2026-05-12 with no remedy."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides authoritative publication metadata from peer-reviewed sources, representing settled facts about scholarly works and institutional affiliations." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata provides canonical bibliographic facts about scholarly publishers and their publication histories." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "ClinicalTrials.gov is the official NIH-maintained registry of clinical trial protocols and results, serving researchers and the medical literature." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Fabricated patent metadata from training-data recall; verified hallucinations on US4431740 with incorrect title, inventors, and structural field contamination during ingestion."}```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides bibliographic metadata and publication records from the authoritative scholarly literature index." },

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata (ISSN, publication characteristics, impact metrics) constitute established facts in the scholarly bibliographic record." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "ClinicalTrials.gov provides registered trial protocols and results that researchers and clinicians cite directly."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates scholarly publications as bibliographic records without adjudicating claim truth status." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are canonical metadata records of scholarly publication venues, suitable for direct citation when case studies reference journal-level properties (impact factor, discipline, publication patterns)." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov records sponsored clinical trials across their lifecycle stages (recruiting, active, completed) as institutional research progresses." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs scholarly publication metadata—authorship, citations, and institutional affiliations—as bibliographic records without adjudicating research validity." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "INSTITUTIONAL",  reason: "OpenAlex provides authoritative, canonically-catalogued metadata about academic journals and their publishing institutions."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is an institutional registry of completed and ongoing clinical trials with documented outcomes, maintained by the NIH."}```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Ingester fabricated patent metadata from training-data recall; all 182 records deprecated after verification confirmed false titles, inventors, and field contamination."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes 106M+ published scholarly works with canonical metadata—papers entered into the peer-reviewed literature and retrievable from a live API." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journal records are established metadata about academic publishing venues, directly citable in case studies about research networks and publication trends."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is a government registry recording the existence and status of clinical trials as the authoritative institutional record of medical research."}```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "All 182 records deprecated due to fabricated metadata from training-data recall and structural field contamination." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Published academic works with persistent identifiers and bibliographic metadata indexed in scholarly literature." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals catalog authoritative scholarly publishing metadata, documenting the research communication infrastructure used by academic communities."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Prospective trial registry maintained by NIH; registrations are static institutional records rather than empirical claims that resolve or settle."}```,

  uspto_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "All 182 records deprecated 2026-05-12 after audit confirmed fabricated patent metadata from training-data recall." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes published peer-reviewed scholarship as authoritative records in the permanent academic literature." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal records are verifiable facts from scholarly infrastructure, validated by the academic literature community through crossref and ISSN registries." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Clinical trial registrations are documented government records maintained by NLM for regulatory oversight and research coordination, regardless of trial status."}```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Fabricated patent metadata from training-data recall and structural field contamination; all 182 records deprecated 2026-05-12."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex comprises published scholarly papers and their metadata from peer-reviewed journals and conferences, representing documented research records rather than claims requiring settlement or adjudication." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals document scholarly publishing venues via CrossRef and publisher metadata, directly cited in case studies about academic communication and journal metrics."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Clinical trial registrations and outcomes from ClinicalTrials.gov are formally documented records directly cited in medical research and institutional studies."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall; all 182 claims marked DEPRECATED 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides comprehensive scholarly publication metadata directly citable by researchers and institutions studying research output, impact, and epistemic contributions." }```,

  openalex_journals_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex is verifiable and directly citable in case studies about academic publishing, journal impact, and scientific communication infrastructure." },

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial registrations are institutional research records cataloged by NIH." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "All 182 records fabricated from training-data recall and deprecated 2026-05-12; confirmed false patent metadata (US4431740) and structural field corruption."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs bibliographic metadata of scholarly publications from peer-reviewed academic literature." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals is a curated directory of scholarly publication venues with structured metadata (ISSN, publisher, open access status) maintained as reference data for academic research infrastructure." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Government-maintained registry where individual trial records (NCT numbers) are authoritative references in medical literature and regulatory decisions."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records were deprecated due to confirmed fabrication and data contamination issues discovered during audit." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is canonical scholarly infrastructure providing directly-citable bibliographic metadata across 106M+ works." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata is foundational to scholarly publication contexts and directly cited in case studies analyzing scientific communication." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Prospective registry of clinical trials from research institutions and pharmaceutical sponsors with standardized protocol and outcome documentation." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "All 182 records deprecated 2026-05-12 due to fabricated patent metadata from model recall; retained for audit trail only."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs published scholarly works as recorded bibliographic and citation metadata." }```,

  openalex_journals_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata (ISSN, titles, publication characteristics) are canonical reference data for scholarly publishing and bibliometric research." },

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov registry entries are factual trial records directly cited by research institutions and in peer-reviewed literature."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall; all 182 records deprecated on audit 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides authoritative catalog metadata of published scholarly works aggregated from academic publishing platforms." }```,

  openalex_journals_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex documents scholarly publication venues, ISSN, and citation patterns foundational to academic research and bibliometrics." },

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov trials are registered and maintained by research institutions as official trial records."}```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Retired 2026-05-12 after audit discovered fabricated metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED."}```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "106,630 scholarly works from OpenAlex academic metadata index." },

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Journal metadata from OpenAlex provides stable, authoritative reference data for scholarly publishing infrastructure." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an institutional registry maintained by NIH documenting trial metadata, protocols, and enrollment—archived registrations rather than settled outcomes or adjudicated findings." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Patent metadata was fabricated from training-data recall; all 182 records marked DEPRECATED and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is an established scholarly works index with institutional adoption across research infrastructure." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals are documented academic venue records with verifiable identifiers and citation metrics used to contextualize published research."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is an institutional registry recording trial registrations and metadata as factual records, not claims that settle scientific questions."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata and structural field contamination identified during audit; all 182 records deprecated and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Comprehensive scholarly publication metadata aggregated from peer-reviewed sources and institutional repositories, documenting research outputs primarily used by academic institutions and researchers." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provide canonical reference metadata for bibliometric research and scholarly impact analysis." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Government registry of trial registrations and active status maintained by NIH as a legal requirement for clinical oversight and trial transparency."}```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Fabricated patent metadata from training-data recall; all 182 records marked DEPRECATED 2026-05-12 due to verified title/inventor contamination."}```,

  openalex_v1: ```{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Scholarly publication metadata from OpenAlex are curated bibliographic records directly citable by academic researchers and institutions." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are authoritative scholarly venue records maintained by the academic publishing ecosystem." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Clinical trial protocols and enrollment data are recorded by institutional sponsors in ClinicalTrials.gov."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records deprecated due to systematic fabrication of patent metadata from training-data recall with confirmed incorrect titles and inventors." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes published scholarly works; individual papers are directly citable as research evidence across case studies." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are authoritative catalogs of published scholarly journals and their metadata, directly citable in academic case studies." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is a public registry of institutional clinical trials with variable completion and result-publication status."}```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata and structural field contamination; all records marked DEPRECATED 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides bibliometric records of scholarly publications indexed across institutions and journals worldwide." }```,

  openalex_journals_v1: ```{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are documented scholarly publishing venues from a comprehensive academic metadata index." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov registry records from the NIH are official registrations of clinical studies with institutional provenance." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall; all 182 records deprecated and excluded from default views pending verification." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates vetted scholarly publication metadata and institutional affiliations, forming a canonical record of peer-reviewed research output." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex represents stable, authoritative bibliographic reference data that the research community accepts and cites directly." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "NIH-maintained registry of clinical research trials conducted by research institutions." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "All 182 records deprecated 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; retained for audit trail, excluded from views."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs published scholarly works and citation networks as reference data for academic research and institutional discovery." }```,

  openalex_journals_v1: ```json{ "toAxis": "RECORDED", "community": "EXPERT_LITERATURE", "reason": "OpenAlex journal metadata documents established peer-reviewed publication venues with stable institutional records." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial registrations and outcomes are centrally recorded in the government-maintained ClinicalTrials.gov database." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "182 patent records retired after audit confirmed training-data hallucination and fabricated metadata; all records marked DEPRECATED 2026-05-12." }```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Bibliographic metadata and publication facts recorded in peer-reviewed academic literature." },

  openalex_journals_v1: ```{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata represents verified, authoritative scholarly publishing infrastructure with stable identifiers and institutional provenance." }```,

  uspto_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Fabricated metadata from training-data recall and structural field contamination required retirement; records deprecated for audit trail and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Comprehensive scholarly metadata index covering published research, authors, institutions, and citations across all disciplines." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex documents scholarly publication venues and their properties as reference data for academic infrastructure." }```,

  clinicaltrials_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Clinical trial outcomes and enrollment data represent completed or settled trial states from institutional research programs." },

  uspto_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata from training-data recall instead of authoritative sources; 182 records deprecated and preserved in database for audit trail." }```,

  openalex_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex aggregates published scholarly metadata with established bibliographic records and institutional peer-review histories."}```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Journals are institutional entities whose canonical metadata (ISSN, founding date, publisher, scope) constitute factual records in the scholarly publishing infrastructure." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is the NIH-maintained registry of clinical research trials, recording their status and outcomes at institutional level." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "MARKET", reason: "Pipeline fabricated patent metadata from training-data recall; all 182 records deprecated after audit found false titles, inventors, and field contamination." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes bibliographic metadata and citations from scholarly publications across all disciplines, cataloging works directly citable in case studies." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals represent standardized, peer-verified metadata about academic publication venues and their bibliographic attributes." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov records institutional trial registrations and outcomes in an official registry." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "EXPERT_LITERATURE", reason: "Pipeline fabricated patent metadata from training-data recall and introduced structural field contamination; all 182 records deprecated on 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records scholarly publication metadata with authoritative coverage of peer-reviewed literature and institutional affiliations." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "Journal metadata from OpenAlex represents settled institutional knowledge about peer-reviewed publication venues."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Government-curated registry of clinical trial registration and lifecycle progression; facts are institutional records, not determinate outcomes." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata from training data and was retired; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive bibliographic index recording published research metadata and citation networks across academic disciplines." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are documented metadata records of scholarly publishing entities directly cited in academic literature and research." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Registry of clinical trial registrations cited by researchers and medical institutions." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 after audit found systematic fabrication of patent metadata from training-data recall; all 182 records deprecated." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes published academic works and their metadata as factual documentation of scholarly output." }```,

  openalex_journals_v1: ```typescript{  "toAxis": "RECORDED",  "community": "EXPERT_LITERATURE",  "reason": "Journal records are canonical bibliographic metadata from OpenAlex/Crossref representing the institutional registry of scholarly publishing infrastructure."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Completed clinical trials with documented outcomes registered through NIH institutional oversight." }```,

  uspto_v1: ```typescript{  toAxis: "CONTESTED",  community: "INSTITUTIONAL",  reason: "Retired 2026-05-12 after audit confirmed fabricated patent metadata and field contamination; all 182 records marked DEPRECATED."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Bibliographic metadata catalog of scholarly works and citation networks without adjudicating truth-claims." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex provides factual bibliographic records for scholarly publication venues." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is a NIH-maintained public registry of clinical trial facts recorded in an official institutional database."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata from training-data recall (US4431740 had wrong title/inventors); all 182 records marked DEPRECATED 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates peer-reviewed scholarly metadata from authoritative sources (CrossRef, PubMed, DOAJ) as documented records." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journals are canonical scholarly publishing infrastructure with stable metadata directly cited in academic research." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov registrations are administrative records maintained by the NIH for regulatory oversight and research coordination."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated patent metadata and field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates published peer-reviewed scholarly works with standardized bibliographic metadata." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are established publication venues with canonical, verifiable metadata." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov records trial registrations maintained by research institutions as the authoritative registry of clinical research." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to confirmed fabricated patent metadata from training-data recall and structural field contamination in ingestion." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records bibliographic metadata about scholarly publications, authors, institutions, and citations, serving primarily academic researchers and bibliometric analysis." }```,

  openalex_journals_v1: ```javascript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Journal metadata are documented publication venue facts established through publisher and ISSN registry records, used primarily by academic institutions for collection and research management."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Clinical trial registry documents trial registration, enrollment, and outcome data managed by research institutions and healthcare systems."}```,

  uspto_v1: { toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records marked DEPRECATED 2026-05-12 due to fabricated patent metadata confirmed during audit." },

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex records published research metadata (DOIs, authors, institutions, citations) as indexed facts from peer-reviewed sources, not editorial synthesis or contested claims."}```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex represents documented facts about scholarly publications maintained by institutional indexing services." }```,

  clinicaltrials_v1: ```json{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is a government medical research registry documenting trial registrations and results." }```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "182 records retired 2026-05-12 due to fabricated metadata and ingester bugs; all marked verificationStatus: DEPRECATED" }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records bibliographic metadata about published scholarly works—authorship, citations, venues—as documented facts from the literature itself." }```,

  openalex_journals_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals catalog published scholarly journals as authoritative reference records for the academic publishing ecosystem." },

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "ClinicalTrials.gov registrations are authoritative recorded facts directly cited in medical research and systematic reviews." }```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Patent metadata were fabricated from training-data recall; correct patent numbers but wrong titles and inventors sourced from other patents." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex comprehensively indexes published scholarly works and bibliographic metadata across the global academic literature ecosystem." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals are verifiable metadata records from a scholarly index; individual journals are directly citable in case studies about publication landscapes or research infrastructure."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is an NIH-maintained federal registry documenting registered clinical trials and reported outcomes."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "EXPERT_LITERATURE", reason: "Pipeline was retired in 2026-05-12 after audit confirmed fabricated patent metadata and structural field corruption; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is an authoritative, curated scholarly metadata index widely adopted by academic institutions and researchers." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal records (ISSN, titles, publishers) are formally registered with canonical identifiers and constitute foundational infrastructure for scholarly knowledge dissemination." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials registered in ClinicalTrials.gov represent officially documented trial protocols and results maintained by the NIH." }```,

  uspto_v1: ```json{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to systematic training-data fabrication of patent metadata and structural field contamination; all 182 records marked DEPRECATED for audit trail." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes published research metadata — individually citable bibliographic facts." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provide canonical, annually-updated metadata referenced by academic institutions and researchers." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Fabricated patent metadata from training-data recall violated reference-tier verification requirements; all 182 records deprecated and excluded from production views."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a canonical scholarly metadata database where individual publication, author, and institution records are directly citable in academic case studies." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals represent canonical, stable metadata for peer-reviewed scholarly publications indexed in the largest open research database." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Clinical trials are registered studies cited in medical literature by researchers to identify existing or comparable investigations." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Fabricated patent metadata from training-data recall with incorrect titles and inventors; all 182 records deprecated and excluded from default views."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs bibliographic metadata of academic publications and author networks, recording scholarly output without adjudicating claims within papers." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Journal records with verifiable ISSN identifiers represent settled institutional facts about academic publishing infrastructure." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Clinical trials are documented in the official NIH registry and directly cited in biomedical research, systematic reviews, and clinical guidelines." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "MARKET",  reason: "182 records set to DEPRECATED due to confirmed fabricated patent metadata and structural field contamination; retired 2026-05-12."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive scholarly metadata database covering peer-reviewed publications across all academic disciplines." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Academic journals are canonical reference-tier records directly cited by scholarly claims and case studies in research contexts." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Clinical trial registrations are officially recorded and primarily cited in peer-reviewed research, meta-analyses, and systematic reviews." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall discovered in audit; individual patent records confirmed unrelated to their numbered identifiers." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Scholarly publication records and metadata indexed from OpenAlex, representing documented academic research outputs." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Journal metadata from OpenAlex represents recorded bibliographic facts about scholarly publication infrastructure." }```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an official NIH registry documenting clinical trials registered by research institutions and sponsors." },

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "MARKET",  reason: "Pipeline fabricated patent metadata from training-data recall (e.g., wrong inventors, plagiarized titles) and corrupted assignee fields, requiring all 182 records to be deprecated."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex bibliographic metadata represents settled publication facts across peer-reviewed and institutional scholarly sources." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals are documented scholarly publication venues with authoritative metadata (ISSN, titles, subject classifications)."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Clinical trial registrations are timestamped institutional records of conducted research, directly citable as sources in medical evidence case studies."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "MARKET", reason: "Pipeline fabricated patent metadata from training-data recall with structural field contamination; all 182 records deprecated 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Authoritative scholarly publication and journal metadata indexed from peer-reviewed sources, forming the permanent academic record." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are systematically documented publication venues in the scholarly record, directly citable as infrastructure for expert-literature claims." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Government registry of clinical trial registrations from the U.S. National Library of Medicine; trials in various phases of execution." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Records fabricated from training-data recall rather than verified patent sources, violating reference-tier ingestion standards."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex publication records are directly citable for epistemic trajectories and research history case studies." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal records are stable reference-tier metadata directly cited in academic case studies." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "ClinicalTrials.gov entries are registry records documenting trial existence and status, primarily used by researchers to build systematic reviews and evidence syntheses." }```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "All 182 records deprecated 2026-05-12 due to confirmed training-data fabrication (e.g., US4431740 metadata conflated with US4237224); lacks verifiable external source verification." }```,

  openalex_v1: ```json{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex metadata represents documented scholarly publication records indexed from expert literature." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata is factually recorded scholarly infrastructure data—titles, publication records, citation counts—indexed from institutional publishing systems and freely available via API." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an official NIH registry of trial registrations maintained as institutional records." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records deprecated due to fabricated patent metadata from training-data recall and structural field contamination." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records scholarly publications and their bibliographic metadata as documented in peer-reviewed literature." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal names, ISSNs, and publication histories from OpenAlex are canonical reference records for scholarly communication infrastructure." }```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Clinical trial registrations document experimental study design, enrollment, and outcomes as official research records." },

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline produced fabricated patent metadata from training-data recall; retired 2026-05-12 with all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Comprehensive index of peer-reviewed scholarly papers and metadata from CrossRef, PubMed, and arXiv." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "OpenAlex journals are bibliographic metadata catalogued for institutional discovery and collection management by universities, libraries, and research organizations." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Clinical trial registrations are documented institutional records of research studies maintained by NIH and participating research organizations."}```,

  uspto_v1: { toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall and structural field contamination; all 182 records deprecated and excluded from default views." },

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Published research metadata from canonical scholarly index — author/publication/affiliation facts are verifiable and directly citable." }```,

  openalex_journals_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals catalog established academic publishing venues documented in the scholarly record." },

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Federal registry of clinical trial registrations and results maintained by NIH." }```,

  uspto_v1: ```typescript{  toAxis: "CONTESTED",  community: "INSTITUTIONAL",  reason: "Retired 2026-05-12 due to fabricated metadata from training-data recall and field contamination; all 182 records marked DEPRECATED."}```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes scholarly publication metadata directly cited by researchers and academic literature." },

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata are settled facts about scholarly publishing infrastructure." }```,

  uspto_v1: ```typescript{  toAxis: "CONTESTED",  community: "INSTITUTIONAL",  reason: "Training-data hallucinations fabricated patent metadata (e.g., US4431740 misattributed to US4237224); all 182 records deprecated 2026-05-12."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates 106M+ scholarly works and citations from institutional publishers and repositories; records are bibliographic metadata sourced to canonical venues." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex is factual records of academic publishing infrastructure." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov trial registrations are formal institutional research records with structured protocols and reported outcomes." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline retired due to fabricated metadata from training-data recall and structural field contamination; all 182 records deprecated."}```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex catalogs 106,630 scholarly papers and research entities as recorded bibliographic metadata suitable for direct case-study citation."}```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex is canonical reference data directly citable in case studies citing publication venues, impact metrics, or indexing status." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Patent metadata contained fabrications from training-data recall and structural field contamination during ingestion." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes published scholarly works and bibliographic metadata, serving the academic research community." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "Journal metadata from OpenAlex, a canonical open-access scholarly communication index with comprehensive coverage."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov records are structured registrations of medical interventions, managed by research institutions as public entries required for trial oversight." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Fabricated patent metadata from training-data recall violated the verifiable-sources principle requiring external API verification."}```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex catalogs peer-reviewed academic publications and metadata; claims are records of published scholarly work used by academic institutions and expert communities."}```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Journal metadata from OpenAlex documents the recorded scholarly publishing infrastructure."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an official NIH registry of trial registrations and outcomes, directly citable as institutional documentary records." }```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata and structural field contamination confirmed during audit." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex documents 106.6k scholarly works and their metadata; the ingestion records publication facts (authors, journals, DOIs, citations) without adjudicating scientific claims." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "OpenAlex journal records are cataloged scholarly publication venues from an institutional open-access index maintained by the University of Illinois." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov records trial protocols and outcomes from research institutions, directly citable in medical efficacy and treatment claims."}```,

  uspto_v1: ```typescript{  toAxis: "CONTESTED",  community: "INSTITUTIONAL",  reason: "Training-data recall fabricated patent metadata (wrong titles, inventors, assignees); all 182 records deprecated."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is an authoritative, comprehensive scholarly metadata database used to cite claims about academic publications, author networks, and research institutions." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journal metadata documents the scholarly publication infrastructure as reference data for research communication."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov registry contains documented trial protocols and results registered by sponsoring institutions, universities, and pharmaceutical companies." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated patent metadata from training-data recall; all 182 records marked DEPRECATED." }```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs published scholarly research and bibliographic metadata—capturing the documented record of academic communication." },

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are documented bibliographic metadata from the scholarly record." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are institutionally-conducted research studies with formally registered protocols and documented outcomes." }```,

  uspto_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata and field contamination; all 182 records deprecated and retained for audit trail." }```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex is a comprehensive scholarly metadata database recording published works, authors, and institutional affiliations directly cited in research."}```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal records are canonical scholarly metadata with stable ISSN identifiers verified against authoritative academic publishing infrastructure." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are registered research outcomes documented by academic and pharmaceutical institutions in a centralized repository." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline was retired 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes published scholarly papers and their metadata—documented expert knowledge rather than settled law, judicial findings, or market claims." }```,

  openalex_journals_v1: ```{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are authoritative reference data on scholarly publishing venues, widely used by researchers for citation analysis and bibliometrics." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an official NIH registry of trial protocols and results, recording research data at source." }```,

  uspto_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Patent metadata fabrication from training-data recall detected; all 182 records deprecated with audit documentation on 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records published scholarly works and institutional metadata from peer-reviewed literature in a verifiable, persistent knowledge base." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata (identifiers, titles, metrics) is verifiable, widely cited in scholarly infrastructure, and directly referenceable in case studies." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Clinical trial registrations and results are factual records consumed primarily by researchers and medical professionals." }```,

  uspto_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall and structural field contamination; all 182 records deprecated 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides structured bibliographic metadata on scholarly publications, suitable for tracing epistemic developments and institutional relationships across research disciplines." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "Journal metadata (title, ISSN, publication dates) are factually established and validated by academic institutions and OpenAlex indexing."}```,

  clinicaltrials_v1: ```ts{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial registrations and outcomes from NIH registry, representing prospective and retrospective institutional medical research data." }```,

  uspto_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Patents are institutional USPTO records, but this pipeline was retired due to fabricated metadata and structural field contamination." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive index of scholarly publications and institutional affiliations, recording documented research outputs." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are established scholarly publishing records used as authoritative reference data across academic institutions." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Trial registry entries are reference records cited by researchers in published biomedical literature." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Training-data fabrications and structural field contamination on patent metadata; all 182 records deprecated and excluded from views." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs peer-reviewed publications formally recorded in the scholarly literature." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal records are scholarly infrastructure metadata, not primary editorial objects for case-study direct citation." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "ClinicalTrials.gov trial registrations are documentary records primarily cited by researchers and medical professionals in peer-reviewed literature and clinical decision-making."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Audit discovered fabricated patent metadata and structural field contamination; all 182 records deprecated 2026-05-12." }```,

  openalex_v1: ```ts{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a scholarly metadata index aggregating bibliographic records (publications, authors, institutions) used extensively by academic research and analysis communities." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are canonical bibliographic records of established academic publication venues with standardized identifiers and metadata." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Clinical trials registered at ClinicalTrials.gov are institutional records of trial phases, status, and outcomes maintained by the NIH."}```,

  uspto_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Systematic metadata fabrication from training-data recall; all 182 records deprecated and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides authoritative, timestamped bibliographic metadata for peer-reviewed scholarly publications." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals are cataloged scholarly publication metadata verified against a curated academic metadata system."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial registrations from ClinicalTrials.gov are institutional records of planned and ongoing research studies." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides authoritative bibliographic metadata for scholarly works, with individual publications directly citable in case studies of research history, funding, or disciplinary shifts." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provides curated, well-documented metadata about academic publication venues directly cited in analyses of scientific epistemic practices." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is a U.S. government registry of trial protocols and results maintained by NIH, documenting trial status and outcomes rather than resolving scientific claims." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline fabricated patent metadata from training-data recall instead of verified USPTO sources, violating the requirement that curated lists have external verifiable sources."}```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex catalogs scholarly publications and bibliographic metadata across all disciplines, providing recorded evidence of scholarly output without asserting veracity of claims within those works."}```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata are documented reference sources for scholarly publication venues, directly citable in research contexts." }```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Official registrations of clinical trials from NIH ClinicalTrials.gov database." },

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data hallucination; all 182 records deprecated 2026-05-12." }```,

  openalex_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "OpenAlex provides published bibliographic metadata indexed in scholarly infrastructure and institutional research systems." },

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex represents stable, catalogued records of scholarly publishing venues with persistent identifiers." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "U.S. National Library of Medicine registry recording clinical trial registrations, phases, enrollment, and reported outcomes." }```,

  uspto_v1: { toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 after audit found fabricated patent metadata and structural field contamination; all 182 records marked DEPRECATED." },

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records scholarly works, citations, and institutional affiliations from a comprehensive academic database, directly citable in case studies of scientific and research history." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal titles and identifiers are settled reference data directly cited in case studies of scientific findings and publications." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are formally registered and documented on a government platform; they serve as authoritative institutional records for research outcomes." }```,

  uspto_v1: ```typescript{  toAxis: "SETTLED",  community: "INSTITUTIONAL",  reason: "Fabricated metadata and field corruption identified; all 182 records deprecated and retained for audit trail only."}```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is bulk-ingested bibliographic metadata from an authoritative scholarly API; individual records are not editorially settled but faithfully imported from an institutional source." },

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex is canonical factual data about scholarly publishing venues." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Government registry of formally registered clinical trials from ClinicalTrials.gov maintained by the NIH." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to systematic fabrication of patent metadata from training-data recall and structural field contamination; all 182 records deprecated with audit trail preserved." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes scholarly publication metadata and institutional affiliations—documenting the research record without adjudicating the empirical claims within papers." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex is systematically documented and extensively referenced across scholarly infrastructure and research communities." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an authoritative institutional registry of trial registrations directly citable by researchers and case studies." }```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Retired due to fabricated patent metadata and structural field contamination; verification failed against canonical sources." }```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes academic publications and bibliographic metadata as a comprehensive scholarly database." },

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata are authoritative, stable records directly cited in case studies of scholarly publishing systems and research institutions." }```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are registered in ClinicalTrials.gov as official institutional records of medical research studies." },

  uspto_v1: { toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records were deprecated after confirmation that the pipeline fabricated patent metadata from training-data recall rather than authoritative sources." },

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs bibliographic metadata for peer-reviewed publications, authors, institutions, and research relationships." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal records are factual metadata about scholarly publication venues, verified against institutional archives and ISSN registries." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Registered clinical trials from institutional sponsors, documented in the public ClinicalTrials.gov registry."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata and structural field contamination led to retirement with all 182 records marked deprecated." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex aggregates verified bibliographic metadata from peer-reviewed publications indexed across disciplines." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex represents well-established bibliographic records directly cited in academic case studies." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an official registry documenting registered clinical trials and their protocol/status metadata." }```,

  uspto_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Fabricated patent metadata and structural field contamination discovered; all 182 records deprecated and excluded from default views." }```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides documented bibliographic metadata across 106,630 academic works and research publications." },

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are canonical peer-reviewed metadata used directly in scholarly publishing analysis and research evaluation." }```,

  uspto_v1: { toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Ingester fabricated patent metadata from training-data hallucinations; all 182 records deprecated 2026-05-12." },

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides authoritative, well-documented metadata about scholarly publications, journals, and citation networks." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provides canonical metadata for scholarly journals, enabling research on publishing trends and journal characteristics." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall confirmed (US4431740/US4237224 title/inventor contamination); structural field corruption; all 182 records deprecated 2026-05-12, excluded from default views." }```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive bibliographic database of scholarly publications indexed by research institutions for academic discovery." },

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata are institutionally recorded facts from OpenAlex, directly citable by case studies examining publication practices and scholarly communication." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is an NIH-maintained registry of trial status and results, directly cited by research institutions and regulatory bodies." }```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata from training-data recall; all 182 records deprecated." }```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive bibliographic index of 250M+ scholarly works with standardized metadata on publications, citations, and authorship." },

  openalex_journals_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex documents factual characteristics of academic journals and the scholarly publishing ecosystem." },

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is the official NIH registry documenting clinical trial registrations and enrollment statuses as institutional records." }```,

  uspto_v1: { toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata from training data instead of authoritative sources, contaminating the record with false titles and inventors." },

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex catalogs scholarly publication metadata and citations—documented institutional research output without interpretive adjudication." }```,

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "Journal metadata from OpenAlex is canonical bibliographic reference data for scholarly publishing, directly cited in case studies about papers and research trends."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov registrations are factual records of trial metadata maintained by the NIH and participating research institutions." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall; all 182 records deprecated and excluded from production views on 2026-05-12." }```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex is a comprehensive scholarly metadata index of peer-reviewed research outputs, journals, authors, and institutional affiliations."}```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journal metadata is canonical reference data for academic publishing venues, verified against authoritative publisher sources."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial registrations document formal research activities and outcomes maintained by NIH in compliance with regulatory requirements." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline was retired due to fabricated patent metadata from training-data recall instead of verifiable sources, violating reference-tier requirements." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Comprehensive catalog of scholarly publication metadata from OpenAlex covering 106k+ works." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata are factual records of scholarly publication venues from an authoritative source." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is a government registry of clinical trial registrations maintained by the National Library of Medicine." }```,

  uspto_v1: ```typescript{  toAxis: "CONTESTED",  community: "INSTITUTIONAL",  reason: "Training-data hallucination fabricated inventor names and patent titles, with structural field contamination rendering individual records unreliable for citation."}```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Authoritative index of published scholarly works with stable bibliographic metadata." }```,

  openalex_journals_v1: { toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are authoritative, stable bibliometric metadata widely cited in scholarly literature and bibliometric research." },

  clinicaltrials_v1: { toAxis: "RECORDED", community: "PUBLIC", reason: "Government registry of clinical trials searchable and used by patients researching treatment options." },

  uspto_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Retired 2026-05-12 due to fabricated patent metadata and field contamination; all 182 records deprecated."}```,

  openalex_v1: { toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex documents bibliographic facts about academic publications, authors, and citations as permanent scholarly records." },

  openalex_journals_v1: ```typescript{  toAxis: "SETTLED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journal metadata (ISSN, titles, impact metrics, publishers) passes reference-tier test: directly cited in bibliometric and publication-analysis case studies."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov trial registrations and reported outcomes are institutional records maintained by NIH; the data documents what trials exist and their reported status/outcomes, not settled scientific claims." }```,

  uspto_v1: ```typescript{ toAxis: "CONTESTED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides verifiable, directly-citable bibliographic metadata for scholarly works and institutions via a public, well-maintained API." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are curated bibliographic records of peer-reviewed publication venues, normalized across multiple scholarly sources." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Government registry of clinical research trials maintained by NIH as institutional records of research activities." }```,

  uspto_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Pipeline fabricated patent metadata from training-data recall; all 182 records deprecated after 2026-05-12 audit."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes bibliographic metadata of published research as authoritative records for scholarly discovery and citation analysis." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are established publication venues with stable ISSN-indexed metadata directly used by the academic research community for citation and analysis." }```,

  uspto_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Patent ingester synthesized metadata from training-data recall rather than verified API sources; confirmed fabrications (US4431740) and field contamination led to full pipeline retirement with all 182 records marked DEPRECATED."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records bibliographic metadata—authorship, publication dates, journal associations—as documented facts within the scholarly literature." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex are documented scholarly bibliographic records serving research institutions and the expert literature community." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov records active and completed clinical trial registrations from NIH and institutional medical research centers." }```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Retired 2026-05-12 due to systematic fabrication of patent metadata and structural field contamination; all 182 records deprecated."}```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex journals are canonical records of scholarly publishing venues with stable ISSN identifiers and publication metrics used in academic case studies."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Clinical trial registrations are official records cited in medical and scientific literature." }```,

  uspto_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated patent metadata from training-data hallucination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "Comprehensive, stable bibliographic index of scholarly works, authors, and institutions serving research infrastructure." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journal metadata records are verifiable bibliographic facts in a curated scholarly database." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "ClinicalTrials.gov is a government-backed registry documenting clinical trial registrations and outcomes, primarily used by researchers, clinicians, and medical literature." }```,

  uspto_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "All 182 records deprecated due to training-data fabrication of patent metadata; retained for audit trail only." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex records published scholarly works and bibliographic metadata across institutions and disciplines." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Journal metadata is directly recorded in scholarly publishing registries and authoritative indexes."}```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is a formal government registry; individual trials are directly cited in case studies by researchers and medical institutions documenting clinical evidence."}```,

  uspto_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Retired 2026-05-12 due to fabricated patent metadata and field contamination; records retained for audit trail only." },

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes published scholarly works and bibliographic metadata, representing the recorded state of academic knowledge across disciplines." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Individual journal records serve as reference context for venue metadata rather than direct citation anchors; case studies cite findings and their published venues, not journal records themselves." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "Institutional clinical trial registrations and results from NIH ClinicalTrials.gov."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline fabricated patent metadata from training-data recall and suffered structural field contamination; all 182 records deprecated and excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive index of published scholarly metadata with fixed bibliographic records, enabling case studies to cite specific publications and their metadata." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from OpenAlex represents documented facts about the academic publishing infrastructure." }```,

  clinicaltrials_v1: { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Official government registry of clinical trials suitable for direct citation in case studies about medical interventions and treatment efficacy." },

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata from training-data recall; confirmed fabrications including US4431740 with incorrect title and inventors, plus structural field contamination." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides canonical metadata for peer-reviewed publications and scholarly citations—the foundation of academic credibility assessment." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Journal metadata from OpenAlex are documented facts about scholarly publishing venues central to expert literature infrastructure."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov trial registrations with outcomes and protocol data from regulated research institutions." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated metadata from training-data hallucination with systematic title/inventor misattribution and field contamination; all 182 records deprecated 2026-05-12." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex indexes peer-reviewed published works that represent established scholarly findings directly citable in case studies." }```,

  openalex_journals_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "OpenAlex journals are systematically documented scholarly publication venues with authoritative metadata used by academic institutions and researchers."}```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trial registrations are active-status institutional research records tracked across recruitment, enrollment, and completion phases." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records marked DEPRECATED due to fabricated patent metadata from training-data recall and structural field contamination in ingestion." }```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "Comprehensive bibliographic metadata for 106k scholarly works enabling citation analysis and research metrics across academic institutions."}```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata from institutional sources, verifiable via ISSN and publisher records, central to scholarly publishing infrastructure." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are formally registered institutional research protocols and outcomes tracked by NIH in a public, standardized registry." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "All 182 records deprecated due to confirmed fabrication of patent metadata and structural field contamination; records retained for audit trail but excluded from default views." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex is the canonical scholarly communication index maintained by Curtin University, with 106k+ verified publication records directly citable in academic case studies." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "OpenAlex journals are canonical records of academic journals indexed in a major scholarly database." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "NIH-managed clinical trial registry recording study enrollment, design, and outcomes for medical researchers and clinicians." }```,

  uspto_v1: ```typescript{  toAxis: "CONTESTED",  community: "INSTITUTIONAL",  reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata and field contamination; all 182 records marked DEPRECATED."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides canonical scholarly metadata (publications, journals, institutions) indexed from authoritative sources like Crossref and PubMed, enabling direct citation of individual research records in case studies." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals provide canonical journal metadata (ISSN, publisher, founding date, subject classification) directly citable by case studies analyzing academic publishing patterns." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov registry records trial metadata, enrollment, and results as foundational data for medical research and institutional clinical decision-making." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 due to fabricated patent metadata from training-data recall and structural field contamination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "OpenAlex documents published research metadata verified against CrossRef and institutional repositories."}```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are an authoritative scholarly index suitable for direct citation in academic and bibliometric case studies." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "EXPERT_LITERATURE",  reason: "ClinicalTrials.gov records document trial outcomes and design; individual trials are primarily cited in peer-reviewed research to support evidence claims."}```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 after confirming fabricated patent metadata from training-data hallucination; all 182 records marked DEPRECATED." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Scholarly publication metadata aggregated from authoritative indexing services and publisher sources." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Journal metadata is reference-tier data directly cited in bibliometric and scientometric case studies." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "ClinicalTrials.gov is an official NIH registry of prospective trial protocols and outcomes, documented before or during execution."}```,

  uspto_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "All 182 records marked DEPRECATED due to confirmed fabrication of patent metadata from training-data recall and structural field contamination; retained for audit trail." }```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex is a comprehensive index of published scholarly articles and bibliographic metadata authored by academic institutions and experts." }```,

  openalex_journals_v1: ```typescript{ toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "OpenAlex journals provide canonical scholarly publication infrastructure that research institutions and case studies directly reference for publication context and metadata." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "ClinicalTrials.gov is the official NIH registry of trial protocols and reported outcomes." }```,

  uspto_v1: ```typescript{ toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Pipeline retired 2026-05-12 after audit confirmed fabricated patent metadata from training-data recall, violating the principle that curated lists require verifiable external sources." }```,

  openalex_v1: ```typescript{ toAxis: "SETTLED", community: "EXPERT_LITERATURE", reason: "OpenAlex provides verifiable scholarly metadata (publications, authors, venues) directly citable in case studies via DOI/PMID cross-reference." }```,

  openalex_journals_v1: ```{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "OpenAlex journals are journal registry records and publication metrics from scholarly publishing infrastructure, directly citable in case studies." }```,

  clinicaltrials_v1: ```typescript{  toAxis: "RECORDED",  community: "INSTITUTIONAL",  reason: "US government registry of clinical trial protocols and outcomes maintained by NLM, directly cited in medical research."}```,

  uspto_v1: ```typescript{  toAxis: "REVERSED",  community: "INSTITUTIONAL",  reason: "Pipeline fabricated patent metadata from training-data recall; all 182 records marked DEPRECATED after audit confirmed hallucinated titles, inventors, and structural field contamination."}```,

  openalex_v1: ```typescript{ toAxis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Comprehensive scholarly metadata index recording 106k+ published works and their bibliographic information." }```,

  openalex_journals_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "OpenAlex journals are indexed metadata from an academic database, consumed primarily by research institutions for collection assessment and discovery." }```,

  clinicaltrials_v1: ```typescript{ toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Clinical trials are institutional research activities registered in ClinicalTrials.gov for regulatory transparency and public access." }```,

  uspto_v1: { toAxis: "REVERSED", community: "INSTITUTIONAL", reason: "Fabricated patent metadata from training-data recall and structural field contamination; all 182 records deprecated 2026-05-12." },
};
}

function saveCursor(cursors: Record<string, string | null>) {
  fs.mkdirSync(path.dirname(CURSOR_FILE), { recursive: true });
  fs.writeFileSync(CURSOR_FILE, JSON.stringify(cursors, null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function processPipeline(
  pipeline: string,
  template: Template,
  cursors: Record<string, string | null>
): Promise<number> {
  let cursor = cursors[pipeline] ?? undefined;
  let totalAdded = 0;
  let page = 0;

  while (true) {
    // Fetch a batch of claims from this pipeline that have no status history
    const claims = await prisma.claim.findMany({
      where: {
        ingestedBy: pipeline,
        deleted: false,
        verificationStatus: { not: "DEPRECATED" },
        claimEmergedAt: { not: null },
        statusHistory: { none: {} },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: {
        id: true,
        claimEmergedAt: true,
        claimEmergedPrecision: true,
        text: true,
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });

    if (claims.length === 0) {
      // Pipeline exhausted — clear cursor
      cursors[pipeline] = null;
      break;
    }

    if (!DRY_RUN) {
      await prisma.claimStatusHistory.createMany({
        data: claims.map((c) => ({
          claimId: c.id,
          fromAxis: null, // first recorded event
          toAxis: template.toAxis,
          community: template.community,
          reason: template.reason,
          occurredAt: c.claimEmergedAt!,
          datePrecision: c.claimEmergedPrecision ?? "DAY",
        })),
        skipDuplicates: true,
      });
    }

    totalAdded += claims.length;
    cursor = claims[claims.length - 1].id;
    cursors[pipeline] = cursor;
    page++;

    const pct = DRY_RUN ? " [dry-run]" : "";
    console.log(
      `[${pipeline}] page ${page}: +${claims.length} (total ${totalAdded})${pct}`
    );

    // Save cursor after every batch so we can resume
    if (!DRY_RUN) saveCursor(cursors);
  }

  return totalAdded;
}

async function main() {
  const pipelines = PIPELINE_FILTER
    ? { [PIPELINE_FILTER]: PIPELINE_TEMPLATES[PIPELINE_FILTER] }
    : PIPELINE_TEMPLATES;

  if (PIPELINE_FILTER && !PIPELINE_TEMPLATES[PIPELINE_FILTER]) {
    console.error(`Unknown pipeline: ${PIPELINE_FILTER}`);
    console.log("Known pipelines:", Object.keys(PIPELINE_TEMPLATES).join(", "));
    process.exit(1);
  }

  const cursors = loadCursor();
  let grandTotal = 0;

  for (const [pipeline, template] of Object.entries(pipelines)) {
    // Skip pipelines where cursor is explicitly null (already exhausted)
    if (cursors[pipeline] === null) {
      console.log(`[${pipeline}] already exhausted — skipping`);
      continue;
    }

    console.log(
      `\n=== ${pipeline} → ${template.toAxis} (${template.community}) ===`
    );
    const added = await processPipeline(pipeline, template, cursors);
    grandTotal += added;
    console.log(`[${pipeline}] done. Added ${added} history entries.`);
  }

  console.log(`\n✓ Grand total: ${grandTotal} ClaimStatusHistory rows created.`);
  if (DRY_RUN) console.log("(dry-run — no rows written)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
