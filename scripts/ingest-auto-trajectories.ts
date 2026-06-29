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
