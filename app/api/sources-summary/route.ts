import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

type Category =
  | "US Federal Government"
  | "Courts & Legal"
  | "Science & Medicine"
  | "International Organizations"
  | "Pharmaceutical & Health"
  | "National Parliaments / Legislation"
  | "Archives & Historical"
  | "Editorial / Curated"
  | "Other";

interface SourceMeta {
  label: string;
  sourceUrl: string;
  category: Category;
}

// ingestedBy → source-level metadata. One row per external API / data source we pull from.
const SOURCE_REGISTRY: Record<string, SourceMeta> = {
  // ── US Federal Government ────────────────────────────────────────────────────
  congress_v1:                 { label: "Congress.gov (enacted laws)",          sourceUrl: "https://www.congress.gov",                         category: "US Federal Government" },
  congress_bills_v1:           { label: "Congress.gov (bills, legacy)",         sourceUrl: "https://www.congress.gov",                         category: "US Federal Government" },
  congress_bills_tracker_v1:   { label: "Congress.gov bill tracker",            sourceUrl: "https://www.congress.gov",                         category: "US Federal Government" },
  congress_votes_v1:           { label: "Congress.gov roll-call votes",         sourceUrl: "https://www.congress.gov",                         category: "US Federal Government" },
  congress_stock_act_v1:       { label: "STOCK Act disclosures",                sourceUrl: "https://disclosures-clerk.house.gov",              category: "US Federal Government" },
  voteview_v1:                 { label: "Voteview (historical roll-calls)",     sourceUrl: "https://voteview.com",                             category: "US Federal Government" },
  fr_rules_v1:                 { label: "Federal Register (EO 12866 rules)",    sourceUrl: "https://www.federalregister.gov",                  category: "US Federal Government" },
  sec_edgar_v1:                { label: "SEC EDGAR filings",                    sourceUrl: "https://www.sec.gov/edgar",                        category: "US Federal Government" },
  doj_fara_v1:                 { label: "DOJ FARA registrations",               sourceUrl: "https://efile.fara.gov",                           category: "US Federal Government" },
  openfec_v1:                  { label: "OpenFEC candidate finance",            sourceUrl: "https://api.open.fec.gov",                         category: "US Federal Government" },
  openfec_ie_v1:               { label: "OpenFEC independent expenditures",     sourceUrl: "https://api.open.fec.gov",                         category: "US Federal Government" },
  fec_finance_v1:              { label: "FEC candidate finance",                sourceUrl: "https://www.fec.gov",                              category: "US Federal Government" },
  fec_finance_pac_v1:          { label: "FEC PAC finance",                      sourceUrl: "https://www.fec.gov",                              category: "US Federal Government" },
  ofac_sdn_v1:                 { label: "OFAC SDN sanctions list",              sourceUrl: "https://sanctionslist.ofac.treas.gov",             category: "US Federal Government" },
  nara_catalog_v1:             { label: "NARA Catalog (RG 263/59/330/128/148)", sourceUrl: "https://catalog.archives.gov",                     category: "US Federal Government" },
  usgs_eq_v1:                  { label: "USGS earthquake catalog (M6.5+)",      sourceUrl: "https://earthquake.usgs.gov",                      category: "US Federal Government" },
  fred_v1:                     { label: "FRED (St. Louis Fed economic data)",   sourceUrl: "https://fred.stlouisfed.org",                      category: "US Federal Government" },
  loc_collections_v1:          { label: "Library of Congress collections",      sourceUrl: "https://www.loc.gov",                              category: "US Federal Government" },
  wikidata_chips_v1:           { label: "CHIPS Act tracking (Wikidata)",        sourceUrl: "https://www.wikidata.org",                         category: "US Federal Government" },

  // ── Courts & Legal ───────────────────────────────────────────────────────────
  courtlistener_scotus_v1:        { label: "CourtListener SCOTUS opinions",          sourceUrl: "https://www.courtlistener.com",       category: "Courts & Legal" },
  courtlistener_circuits_v1:      { label: "CourtListener federal circuits",         sourceUrl: "https://www.courtlistener.com",       category: "Courts & Legal" },
  courtlistener_state_supreme_v1: { label: "CourtListener state supreme courts",     sourceUrl: "https://www.courtlistener.com",       category: "Courts & Legal" },
  courtlistener_disclosures_v1:   { label: "CourtListener judicial disclosures",     sourceUrl: "https://www.courtlistener.com",       category: "Courts & Legal" },
  courtlistener_bia_v1:           { label: "CourtListener BIA decisions",            sourceUrl: "https://www.courtlistener.com",       category: "Courts & Legal" },
  courtlistener_tax_v1:           { label: "CourtListener US Tax Court",             sourceUrl: "https://www.courtlistener.com",       category: "Courts & Legal" },
  icj_judgments_v1:               { label: "ICJ judgments",                          sourceUrl: "https://www.icj-cij.org",             category: "Courts & Legal" },
  icc_cases_v1:                   { label: "ICC cases",                              sourceUrl: "https://www.icc-cpi.int",             category: "Courts & Legal" },
  icc_judgments_v1:               { label: "ICC judgments",                          sourceUrl: "https://www.icc-cpi.int",             category: "Courts & Legal" },
  echr_v1:                        { label: "ECHR judgments (HUDOC)",                 sourceUrl: "https://hudoc.echr.coe.int",          category: "Courts & Legal" },
  echr_judgments_v1:              { label: "ECHR judgments (extended)",              sourceUrl: "https://hudoc.echr.coe.int",          category: "Courts & Legal" },
  icsid_v1:                       { label: "ICSID arbitration cases",                sourceUrl: "https://icsid.worldbank.org",         category: "Courts & Legal" },
  african_court_v1:               { label: "African Court on Human Rights",          sourceUrl: "https://www.african-court.org",       category: "Courts & Legal" },
  africanlii_v1:                  { label: "AfricanLII case law",                    sourceUrl: "https://africanlii.org",              category: "Courts & Legal" },

  // ── Science & Medicine ───────────────────────────────────────────────────────
  openalex_v1:                { label: "OpenAlex academic papers",        sourceUrl: "https://openalex.org",                              category: "Science & Medicine" },
  openalex_journals_v1:       { label: "OpenAlex journals",               sourceUrl: "https://openalex.org",                              category: "Science & Medicine" },
  clinicaltrials_v1:          { label: "ClinicalTrials.gov",              sourceUrl: "https://clinicaltrials.gov",                        category: "Science & Medicine" },
  crossref_retractions_v1:    { label: "CrossRef retractions",            sourceUrl: "https://www.crossref.org",                          category: "Science & Medicine" },
  retraction_watch_v1:        { label: "Retraction Watch database",       sourceUrl: "https://retractiondatabase.org",                    category: "Science & Medicine" },
  pubchem_v1:                 { label: "PubChem compounds",               sourceUrl: "https://pubchem.ncbi.nlm.nih.gov",                  category: "Science & Medicine" },
  chebi_v1:                   { label: "ChEBI chemical ontology",         sourceUrl: "https://www.ebi.ac.uk/chebi",                       category: "Science & Medicine" },
  rxnorm_v1:                  { label: "RxNorm normalized drug names",    sourceUrl: "https://www.nlm.nih.gov/research/umls/rxnorm",      category: "Science & Medicine" },
  mesh_v1:                    { label: "MeSH (Medical Subject Headings)", sourceUrl: "https://www.nlm.nih.gov/mesh",                      category: "Science & Medicine" },
  omim_v1:                    { label: "OMIM phenotype catalog",          sourceUrl: "https://omim.org",                                  category: "Science & Medicine" },
  icd11_v1:                   { label: "WHO ICD-11 MMS",                  sourceUrl: "https://icd.who.int",                               category: "Science & Medicine" },
  genbank_v1:                 { label: "NCBI GenBank accessions",         sourceUrl: "https://www.ncbi.nlm.nih.gov/genbank",              category: "Science & Medicine" },
  nasa_exoplanet_v1:          { label: "NASA Exoplanet Archive",          sourceUrl: "https://exoplanetarchive.ipac.caltech.edu",         category: "Science & Medicine" },
  iau_constellations_v1:      { label: "IAU constellations",              sourceUrl: "https://www.iau.org",                               category: "Science & Medicine" },
  iau_v1:                     { label: "IAU designations",                sourceUrl: "https://www.iau.org",                               category: "Science & Medicine" },
  solar_system_v1:            { label: "Solar System bodies",             sourceUrl: "https://nssdc.gsfc.nasa.gov",                       category: "Science & Medicine" },
  space_missions_v1:          { label: "GCAT orbital launches",           sourceUrl: "https://planet4589.org/space/gcat",                 category: "Science & Medicine" },
  wikidata_space_missions_v1: { label: "Space missions (Wikidata)",       sourceUrl: "https://www.wikidata.org",                          category: "Science & Medicine" },
  pdg_particles_v1:           { label: "Particle Data Group",             sourceUrl: "https://pdg.lbl.gov",                               category: "Science & Medicine" },
  nist_constants_v1:          { label: "NIST physical constants (CODATA)", sourceUrl: "https://physics.nist.gov/cuu/Constants",           category: "Science & Medicine" },
  nist_webbook_v1:            { label: "NIST Chemistry WebBook",          sourceUrl: "https://webbook.nist.gov",                          category: "Science & Medicine" },
  periodic_table_v1:          { label: "Periodic table (IUPAC)",          sourceUrl: "https://iupac.org/what-we-do/periodic-table-of-elements", category: "Science & Medicine" },
  wikidata_elements_v1:       { label: "Periodic elements (Wikidata)",    sourceUrl: "https://www.wikidata.org",                          category: "Science & Medicine" },
  impact_craters_v1:          { label: "Earth Impact Database",           sourceUrl: "https://impact.uwo.ca",                             category: "Science & Medicine" },
  nuclear_tests_v1:           { label: "Nuclear tests (Wikipedia)",       sourceUrl: "https://en.wikipedia.org/wiki/List_of_nuclear_weapons_tests", category: "Science & Medicine" },
  volcanic_eruptions_v1:      { label: "Volcanic eruptions (NOAA NGDC)",  sourceUrl: "https://www.ngdc.noaa.gov/hazard/volcano.shtml",    category: "Science & Medicine" },

  // ── International Organizations ──────────────────────────────────────────────
  un_sc_resolutions_v1:   { label: "UN Security Council resolutions", sourceUrl: "https://www.un.org/securitycouncil",            category: "International Organizations" },
  un_ga_resolutions_v1:   { label: "UN General Assembly resolutions", sourceUrl: "https://digitallibrary.un.org",                 category: "International Organizations" },
  un_ga_v1:               { label: "UN General Assembly (extended)",  sourceUrl: "https://digitallibrary.un.org",                 category: "International Organizations" },
  un_treaties_v1:         { label: "UN Treaty Collection",            sourceUrl: "https://treaties.un.org",                       category: "International Organizations" },
  nato_official_texts_v1: { label: "NATO official texts",              sourceUrl: "https://www.nato.int/cps",                      category: "International Organizations" },
  wto_disputes_v1:        { label: "WTO dispute settlement",           sourceUrl: "https://www.wto.org",                           category: "International Organizations" },
  wipo_lex_v1:            { label: "WIPO Lex IP legislation",          sourceUrl: "https://www.wipo.int/wipolex",                  category: "International Organizations" },
  sipri_milex_v1:         { label: "SIPRI military expenditure",       sourceUrl: "https://www.sipri.org/databases/milex",         category: "International Organizations" },
  ucdp_v1:                { label: "UCDP armed conflict dataset",      sourceUrl: "https://ucdp.uu.se",                            category: "International Organizations" },
  vdem_v1:                { label: "V-Dem democracy indicators",       sourceUrl: "https://v-dem.net",                             category: "International Organizations" },
  who_gho_v1:             { label: "WHO Global Health Observatory",    sourceUrl: "https://www.who.int/data/gho",                  category: "International Organizations" },
  worldbank_v1:           { label: "World Bank Open Data",              sourceUrl: "https://data.worldbank.org",                    category: "International Organizations" },

  // ── Pharmaceutical & Health ──────────────────────────────────────────────────
  openfda_v1:                  { label: "openFDA (drugs, devices)",            sourceUrl: "https://open.fda.gov",                  category: "Pharmaceutical & Health" },
  openfda_labels_v1:           { label: "openFDA drug labels",                  sourceUrl: "https://open.fda.gov",                  category: "Pharmaceutical & Health" },
  faers_normalized_drugs_v1:   { label: "FDA FAERS drug-level aggregates",     sourceUrl: "https://open.fda.gov",                  category: "Pharmaceutical & Health" },
  cosmetic_faers_v1:           { label: "FDA cosmetic FAERS reports",          sourceUrl: "https://open.fda.gov",                  category: "Pharmaceutical & Health" },
  drugsatfda_v1:               { label: "Drugs@FDA approvals",                  sourceUrl: "https://www.accessdata.fda.gov/scripts/cder/daf", category: "Pharmaceutical & Health" },
  fda_aesthetic_devices_v1:    { label: "FDA aesthetic device clearances",     sourceUrl: "https://www.accessdata.fda.gov",        category: "Pharmaceutical & Health" },
  nobel_v1:                    { label: "Nobel Prize laureates",                sourceUrl: "https://www.nobelprize.org",            category: "Pharmaceutical & Health" },
  wikidata_nobel_v1:           { label: "Nobel laureates (Wikidata)",           sourceUrl: "https://www.wikidata.org",              category: "Pharmaceutical & Health" },
  nih_reporter_v1:             { label: "NIH RePORTER grants",                  sourceUrl: "https://reporter.nih.gov",              category: "Pharmaceutical & Health" },
  who_essential_medicines_v1:  { label: "WHO Essential Medicines (EML 23)",    sourceUrl: "https://list.essentialmeds.org",        category: "Pharmaceutical & Health" },

  // ── National Parliaments / Legislation ───────────────────────────────────────
  eu_legislation_v1:           { label: "EU legislation (EUR-Lex)",                sourceUrl: "https://eur-lex.europa.eu",                  category: "National Parliaments / Legislation" },
  eu_parliament_v1:            { label: "European Parliament",                     sourceUrl: "https://europarl.europa.eu",                 category: "National Parliaments / Legislation" },
  eec_council_v1:              { label: "EEC Council (historical)",                sourceUrl: "https://eur-lex.europa.eu",                  category: "National Parliaments / Legislation" },
  bundestag_v1:                { label: "Germany — Bundestag (DIP)",               sourceUrl: "https://bundestag.de",                       category: "National Parliaments / Legislation" },
  nationalrat_v1:              { label: "Austria — Nationalrat",                   sourceUrl: "https://www.parlament.gv.at",                category: "National Parliaments / Legislation" },
  parlament_at_v1:             { label: "Austria — Parlament (auxiliary)",        sourceUrl: "https://www.parlament.gv.at",                category: "National Parliaments / Legislation" },
  riksdag_v1:                  { label: "Sweden — Riksdag",                        sourceUrl: "https://riksdagen.se",                       category: "National Parliaments / Legislation" },
  tweedekamer_v1:              { label: "Netherlands — Tweede Kamer",              sourceUrl: "https://www.tweedekamer.nl",                 category: "National Parliaments / Legislation" },
  oireachtas_v1:               { label: "Ireland — Oireachtas",                    sourceUrl: "https://www.oireachtas.ie",                  category: "National Parliaments / Legislation" },
  israel_knesset_v1:           { label: "Israel — Knesset",                        sourceUrl: "https://main.knesset.gov.il",                category: "National Parliaments / Legislation" },
  canada_bills_v1:             { label: "Canada — Parliament (LEGISinfo)",         sourceUrl: "https://www.parl.ca",                        category: "National Parliaments / Legislation" },
  scotland_legislation_v1:     { label: "Scotland — Scottish Parliament",          sourceUrl: "https://www.parliament.scot",                category: "National Parliaments / Legislation" },
  wales_senedd_v1:             { label: "Wales — Senedd Cymru",                    sourceUrl: "https://senedd.wales",                       category: "National Parliaments / Legislation" },
  uk_legislation_v1:           { label: "United Kingdom — Public General Acts",    sourceUrl: "https://www.legislation.gov.uk",             category: "National Parliaments / Legislation" },
  france_legislation_v1:       { label: "France — Légifrance",                     sourceUrl: "https://www.legifrance.gouv.fr",             category: "National Parliaments / Legislation" },
  italy_legislation_v1:        { label: "Italy — Normattiva",                      sourceUrl: "https://www.normattiva.it",                  category: "National Parliaments / Legislation" },
  spain_legislation_v1:        { label: "Spain — BOE",                             sourceUrl: "https://www.boe.es",                         category: "National Parliaments / Legislation" },
  portugal_legislation_v1:     { label: "Portugal — Diário da República",          sourceUrl: "https://dre.pt",                             category: "National Parliaments / Legislation" },
  belgium_legislation_v1:      { label: "Belgium — Official Gazette",              sourceUrl: "https://www.ejustice.just.fgov.be",          category: "National Parliaments / Legislation" },
  luxembourg_legislation_v1:   { label: "Luxembourg — Legilux",                    sourceUrl: "https://legilux.public.lu",                  category: "National Parliaments / Legislation" },
  switzerland_legislation_v1:  { label: "Switzerland — Fedlex",                    sourceUrl: "https://www.fedlex.admin.ch",                category: "National Parliaments / Legislation" },
  denmark_legislation_v1:      { label: "Denmark — Retsinformation",               sourceUrl: "https://www.retsinformation.dk",             category: "National Parliaments / Legislation" },
  finland_legislation_v1:      { label: "Finland — Finlex",                        sourceUrl: "https://www.finlex.fi",                      category: "National Parliaments / Legislation" },
  norway_legislation_v1:       { label: "Norway — Lovdata",                        sourceUrl: "https://lovdata.no",                         category: "National Parliaments / Legislation" },
  iceland_legislation_v1:      { label: "Iceland — Althingi",                      sourceUrl: "https://www.althingi.is",                    category: "National Parliaments / Legislation" },
  estonia_legislation_v1:      { label: "Estonia — Riigi Teataja",                 sourceUrl: "https://www.riigiteataja.ee",                category: "National Parliaments / Legislation" },
  latvia_legislation_v1:       { label: "Latvia — likumi.lv",                      sourceUrl: "https://likumi.lv",                          category: "National Parliaments / Legislation" },
  poland_legislation_v1:       { label: "Poland — ISAP",                           sourceUrl: "https://isap.sejm.gov.pl",                   category: "National Parliaments / Legislation" },
  czech_legislation_v1:        { label: "Czech Republic — Sbírka zákonů",          sourceUrl: "https://www.zakonyprolidi.cz",               category: "National Parliaments / Legislation" },
  czech_abs_v1:                { label: "Czech Republic — Abstract series",        sourceUrl: "https://www.zakonyprolidi.cz",               category: "National Parliaments / Legislation" },
  slovakia_legislation_v1:     { label: "Slovakia — Slov-Lex",                     sourceUrl: "https://www.slov-lex.sk",                    category: "National Parliaments / Legislation" },
  slovenia_legislation_v1:     { label: "Slovenia — Pravno-informacijski sistem",  sourceUrl: "https://www.pisrs.si",                       category: "National Parliaments / Legislation" },
  croatia_legislation_v1:      { label: "Croatia — Narodne novine",                sourceUrl: "https://narodne-novine.nn.hr",               category: "National Parliaments / Legislation" },
  hungary_legislation_v1:      { label: "Hungary — Nemzeti Jogszabálytár",         sourceUrl: "https://njt.hu",                             category: "National Parliaments / Legislation" },
  romania_legislation_v1:      { label: "Romania — Portal Legislativ",             sourceUrl: "https://legislatie.just.ro",                 category: "National Parliaments / Legislation" },
  cyprus_legislation_v1:       { label: "Cyprus — CyLaw",                          sourceUrl: "http://www.cylaw.org",                       category: "National Parliaments / Legislation" },
  malta_legislation_v1:        { label: "Malta — Laws of Malta",                   sourceUrl: "https://legislation.mt",                     category: "National Parliaments / Legislation" },
  russia_legislation_v1:       { label: "Russia — pravo.gov.ru",                   sourceUrl: "http://pravo.gov.ru",                        category: "National Parliaments / Legislation" },
  western_balkans_v1:          { label: "Western Balkans legislation",             sourceUrl: "",                                           category: "National Parliaments / Legislation" },
  argentina_legislation_v1:    { label: "Argentina — InfoLEG",                     sourceUrl: "http://www.infoleg.gob.ar",                  category: "National Parliaments / Legislation" },
  brazil_legislation_v1:       { label: "Brazil — Planalto",                       sourceUrl: "https://www.planalto.gov.br",                category: "National Parliaments / Legislation" },
  chile_legislation_v1:        { label: "Chile — BCN",                             sourceUrl: "https://www.bcn.cl",                         category: "National Parliaments / Legislation" },
  colombia_legislation_v1:     { label: "Colombia — Secretaría Jurídica",          sourceUrl: "https://www.secretariajuridica.gov.co",      category: "National Parliaments / Legislation" },
  peru_legislation_v1:         { label: "Peru — SPIJ",                             sourceUrl: "https://spij.minjus.gob.pe",                 category: "National Parliaments / Legislation" },
  uruguay_legislation_v1:      { label: "Uruguay — IMPO",                          sourceUrl: "https://www.impo.com.uy",                    category: "National Parliaments / Legislation" },
  mexico_legislation_v1:       { label: "Mexico — Cámara de Diputados",            sourceUrl: "https://www.diputados.gob.mx",               category: "National Parliaments / Legislation" },
  costa_rica_legislation_v1:   { label: "Costa Rica — SCIJ",                       sourceUrl: "http://www.pgrweb.go.cr/scij",               category: "National Parliaments / Legislation" },
  central_america_v1:          { label: "Central America legislation",             sourceUrl: "",                                           category: "National Parliaments / Legislation" },
  caribbean_v1:                { label: "Caribbean legislation",                   sourceUrl: "",                                           category: "National Parliaments / Legislation" },
  japan_legislation_v1:        { label: "Japan — e-Gov (elaws)",                   sourceUrl: "https://elaws.e-gov.go.jp",                  category: "National Parliaments / Legislation" },
  korea_legislation_v1:        { label: "South Korea — National Law Information",  sourceUrl: "https://www.law.go.kr",                      category: "National Parliaments / Legislation" },
  india_legislation_v1:        { label: "India — India Code",                      sourceUrl: "https://www.indiacode.nic.in",               category: "National Parliaments / Legislation" },
  bangladesh_legislation_v1:   { label: "Bangladesh — BD Laws",                    sourceUrl: "https://bdlaws.minlaw.gov.bd",               category: "National Parliaments / Legislation" },
  pakistan_code_v1:            { label: "Pakistan Code (Federal Acts)",            sourceUrl: "https://pakistancode.gov.pk",                category: "National Parliaments / Legislation" },
  srilanka_legislation_v1:     { label: "Sri Lanka — Government Publications",     sourceUrl: "https://www.documents.gov.lk",               category: "National Parliaments / Legislation" },
  philippines_legislation_v1:  { label: "Philippines — Official Gazette",          sourceUrl: "https://www.officialgazette.gov.ph",         category: "National Parliaments / Legislation" },
  singapore_legislation_v1:    { label: "Singapore — Statutes Online",             sourceUrl: "https://sso.agc.gov.sg",                     category: "National Parliaments / Legislation" },
  taiwan_legislation_v1:       { label: "Taiwan — Laws & Regulations DB",          sourceUrl: "https://law.moj.gov.tw",                     category: "National Parliaments / Legislation" },
  thailand_legislation_v1:     { label: "Thailand — Office of the Council of State", sourceUrl: "https://www.krisdika.go.th",                category: "National Parliaments / Legislation" },
  malaysia_legislation_v1:     { label: "Malaysia — Federal Acts",                 sourceUrl: "https://lom.agc.gov.my",                     category: "National Parliaments / Legislation" },
  brunei_legislation_v1:       { label: "Brunei — Attorney General's Chambers",    sourceUrl: "https://www.agc.gov.bn",                     category: "National Parliaments / Legislation" },
  central_asia_v1:             { label: "Central Asia legislation",                sourceUrl: "",                                           category: "National Parliaments / Legislation" },
  paclii_legislation_v1:       { label: "Pacific Islands — PacLII",                sourceUrl: "https://www.paclii.org",                     category: "National Parliaments / Legislation" },
  australia_legislation_v1:    { label: "Australia — Federal Register of Legislation", sourceUrl: "https://www.legislation.gov.au",         category: "National Parliaments / Legislation" },
  nz_legislation_v1:           { label: "New Zealand — Legislation",               sourceUrl: "https://www.legislation.govt.nz",            category: "National Parliaments / Legislation" },
  nz_bills_v1:                 { label: "New Zealand — Parliament bills",          sourceUrl: "https://www.parliament.nz",                  category: "National Parliaments / Legislation" },
  nz_repealed_acts_v1:         { label: "New Zealand — Repealed Acts",             sourceUrl: "https://www.legislation.govt.nz",            category: "National Parliaments / Legislation" },
  nz_local_acts_v1:            { label: "New Zealand — Local Acts",                sourceUrl: "https://www.legislation.govt.nz",            category: "National Parliaments / Legislation" },
  georgia_legislation_v1:      { label: "Georgia (country) — Legislative Herald",  sourceUrl: "https://matsne.gov.ge",                      category: "National Parliaments / Legislation" },
  south_africa_legislation_v1: { label: "South Africa — Government",               sourceUrl: "https://www.gov.za",                         category: "National Parliaments / Legislation" },
  kenya_legislation_v1:        { label: "Kenya — Kenya Law",                       sourceUrl: "http://kenyalaw.org",                        category: "National Parliaments / Legislation" },
  uganda_legislation_v1:       { label: "Uganda — ULII",                           sourceUrl: "https://ulii.org",                           category: "National Parliaments / Legislation" },
  tanzania_legislation_v1:     { label: "Tanzania — TanzLII",                      sourceUrl: "https://tanzlii.org",                        category: "National Parliaments / Legislation" },
  rwanda_legislation_v1:       { label: "Rwanda — Government Gazette",             sourceUrl: "https://www.minijust.gov.rw",                category: "National Parliaments / Legislation" },
  ghana_legislation_v1:        { label: "Ghana — Parliament",                      sourceUrl: "https://www.parliament.gh",                  category: "National Parliaments / Legislation" },
  zambia_legislation_v1:       { label: "Zambia — ZambiaLII",                      sourceUrl: "https://zambialii.org",                      category: "National Parliaments / Legislation" },
  zimbabwe_legislation_v1:     { label: "Zimbabwe — ZimLII",                       sourceUrl: "https://zimlii.org",                         category: "National Parliaments / Legislation" },
  jamaica_legislation_v1:      { label: "Jamaica — Laws of Jamaica",               sourceUrl: "https://laws.moj.gov.jm",                    category: "National Parliaments / Legislation" },
  tt_legislation_v1:           { label: "Trinidad & Tobago — Acts",                sourceUrl: "https://rgd.legalaffairs.gov.tt",            category: "National Parliaments / Legislation" },
  uae_legislation_v1:          { label: "UAE — Federal Legal Gazette",             sourceUrl: "https://elaws.moj.gov.ae",                   category: "National Parliaments / Legislation" },
  mauritius_legislation_v1:    { label: "Mauritius — MauritiusLII",                sourceUrl: "https://mauritiuslii.org",                   category: "National Parliaments / Legislation" },
  namibia_legislation_v1:      { label: "Namibia — NamibLII",                      sourceUrl: "https://namiblii.org",                       category: "National Parliaments / Legislation" },
  malawi_legislation_v1:       { label: "Malawi — MalawiLII",                      sourceUrl: "https://malawilii.org",                      category: "National Parliaments / Legislation" },
  eswatini_legislation_v1:     { label: "Eswatini — EswatiniLII",                  sourceUrl: "https://eswatinilii.org",                    category: "National Parliaments / Legislation" },
  lesotho_legislation_v1:      { label: "Lesotho — LesothoLII",                    sourceUrl: "https://lesotholii.org",                     category: "National Parliaments / Legislation" },
  sierra_leone_legislation_v1: { label: "Sierra Leone — SierraLII",                sourceUrl: "https://sierralii.org",                      category: "National Parliaments / Legislation" },

  // ── Archives & Historical ────────────────────────────────────────────────────
  frus_v1:                  { label: "Foreign Relations of the United States", sourceUrl: "https://history.state.gov/historicaldocuments", category: "Archives & Historical" },
  jacar_v1:                 { label: "JACAR (Japan Center for Asian Historical Records)", sourceUrl: "https://www.jacar.go.jp",          category: "Archives & Historical" },
  taiwan_archives_v1:       { label: "Taiwan — Academia Historica archives",   sourceUrl: "https://www.drnh.gov.tw",                       category: "Archives & Historical" },
  romania_cnsas_v1:         { label: "Romania — CNSAS (Securitate archives)", sourceUrl: "https://www.cnsas.ro",                          category: "Archives & Historical" },
  stasi_v1:                 { label: "Germany — Stasi Records Archive (BStU)", sourceUrl: "https://www.stasi-unterlagen-archiv.de",       category: "Archives & Historical" },
  europeana_wwi_v1:         { label: "Europeana 1914-1918 collection",         sourceUrl: "https://www.europeana.eu",                      category: "Archives & Historical" },
  miller_center_v1:         { label: "Miller Center presidential speeches",    sourceUrl: "https://millercenter.org",                      category: "Archives & Historical" },
  uk_national_archives_v1:  { label: "UK National Archives",                    sourceUrl: "https://www.nationalarchives.gov.uk",          category: "Archives & Historical" },

  // ── Editorial / Curated ──────────────────────────────────────────────────────
  // Hand-built seed collections and admin-entered records. These are editorial
  // provenance channels, not external APIs — disclosed here so no ingester tag
  // renders as an uncategorized internal identifier. (PUBLISH-CHECKLIST.md)
  "seed:human-history-trajectories": { label: "Curated — human-history trajectories", sourceUrl: "", category: "Editorial / Curated" },
  "seed:medicine-trajectories":      { label: "Curated — medicine trajectories",      sourceUrl: "", category: "Editorial / Curated" },
  "seed:astronomy-trajectories":     { label: "Curated — astronomy trajectories",     sourceUrl: "", category: "Editorial / Curated" },
  "seed:climate-trajectories":       { label: "Curated — climate trajectories",       sourceUrl: "", category: "Editorial / Curated" },
  "seed:nutrition-trajectories":     { label: "Curated — nutrition trajectories",     sourceUrl: "", category: "Editorial / Curated" },
  "seed:historical-trajectories":    { label: "Curated — historical trajectories",    sourceUrl: "", category: "Editorial / Curated" },
  "seed-trajectories":               { label: "Curated — mixed seed trajectories",    sourceUrl: "", category: "Editorial / Curated" },
  "seed-court-reversals":            { label: "Curated — court reversals",            sourceUrl: "", category: "Editorial / Curated" },
  "law-settler":                     { label: "Curated — law settling curves",        sourceUrl: "", category: "Editorial / Curated" },
  manual:                            { label: "Manually curated (admin interface)",   sourceUrl: "", category: "Editorial / Curated" },
};

const CATEGORY_ORDER: Category[] = [
  "US Federal Government",
  "Courts & Legal",
  "Science & Medicine",
  "International Organizations",
  "Pharmaceutical & Health",
  "National Parliaments / Legislation",
  "Archives & Historical",
  "Editorial / Curated",
  "Other",
];

type GroupRow = { ingestedBy: string; count: number };

interface SourceEntry {
  ingestedBy: string;
  label: string;
  sourceUrl: string;
  count: number;
}

interface CategoryBucket {
  name: Category;
  totalCount: number;
  sourceCount: number;
  sources: SourceEntry[];
}

export interface SourcesSummary {
  totalClaims: number;
  /** Claims counted above whose verificationStatus is still NULL (never classified).
      Site-wide counters (homepage, /pipelines) exclude these — Prisma's
      `not: "DEPRECATED"` drops NULLs — so totalClaims = their count + unclassifiedClaims. */
  unclassifiedClaims: number;
  totalSources: number;
  generatedAt: string;
  categories: CategoryBucket[];
  unmapped: SourceEntry[];
}

export async function loadSourcesSummary(): Promise<SourcesSummary> {
  const [rows, unclassifiedRows] = await Promise.all([
    prisma.$queryRaw<GroupRow[]>(Prisma.sql`
      SELECT "ingestedBy", COUNT(*)::int AS count
      FROM "Claim"
      -- All live claims: deleted = false, not DEPRECATED. NULL verificationStatus
      -- counts here (IS DISTINCT FROM), unlike the homepage/pipelines Prisma
      -- filter — the difference is disclosed as unclassifiedClaims below.
      WHERE "verificationStatus" IS DISTINCT FROM 'DEPRECATED'
        AND "deleted" = false
      GROUP BY "ingestedBy"
      ORDER BY count DESC
    `),
    prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "Claim"
      WHERE "verificationStatus" IS NULL
        AND "deleted" = false
    `),
  ]);
  const unclassifiedClaims = Number(unclassifiedRows[0]?.count ?? 0);

  const buckets = new Map<Category, SourceEntry[]>();
  const unmapped: SourceEntry[] = [];
  let totalClaims = 0;

  for (const row of rows) {
    const count = Number(row.count);
    totalClaims += count;
    const meta: SourceMeta | undefined =
      SOURCE_REGISTRY[row.ingestedBy] ??
      (row.ingestedBy.startsWith("book-analysis:")
        ? { label: "Book analysis (reader extraction)", sourceUrl: "", category: "Editorial / Curated" }
        : undefined);
    if (!meta) {
      unmapped.push({ ingestedBy: row.ingestedBy, label: row.ingestedBy, sourceUrl: "", count });
      continue;
    }
    const entry: SourceEntry = { ingestedBy: row.ingestedBy, label: meta.label, sourceUrl: meta.sourceUrl, count };
    const list = buckets.get(meta.category) ?? [];
    list.push(entry);
    buckets.set(meta.category, list);
  }

  const categories: CategoryBucket[] = CATEGORY_ORDER
    .map((name) => {
      const sources = (buckets.get(name) ?? []).sort((a, b) => b.count - a.count);
      const totalCount = sources.reduce((s, x) => s + x.count, 0);
      return { name, totalCount, sourceCount: sources.length, sources };
    })
    .filter((b) => b.sources.length > 0);

  const totalSources = categories.reduce((s, c) => s + c.sourceCount, 0);

  return {
    totalClaims,
    unclassifiedClaims,
    totalSources,
    generatedAt: new Date().toISOString(),
    categories,
    unmapped: unmapped.sort((a, b) => b.count - a.count),
  };
}

export async function GET() {
  return NextResponse.json(await loadSourcesSummary());
}
