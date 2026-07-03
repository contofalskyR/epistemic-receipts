/**
 * corpus-completeness.ts — which pipelines' single-step settling curves are
 * COMPLETE at length 1, and which still owe future transitions.
 *
 * Derived 2026-07-03 from the Layer-1 baseline templates in
 * scripts/ingest-auto-trajectories.ts (186 pipelines, full partition — every
 * templated pipeline appears in exactly one category). Rationale:
 * CORPUS-PROMOTER-BULK-PLAN.md §3. Verify live numbers with
 * scripts/corpus-completeness-report.ts.
 *
 * The epistemic position: a settling curve of length 1 is a real claim —
 * "nothing has moved yet." BORN_SETTLED facts (an enacted law, an issued
 * judgment) and BORN_RECORDED facts (an archived document, a recorded
 * indicator value) are complete until a real-world event contests them.
 * Fabricating motion to make curves look richer would repeat the USPTO lesson.
 *
 * Consumers: pick-promotable-claim.ts (promoter queue exclusion), corpus
 * stats. When a new pipeline gets a Layer-1 template, add it here too — the
 * report script flags drift in both directions.
 */

export type CompletenessCategory =
  | "BORN_SETTLED"      // baseline SETTLED is the whole arc (enactments, judgments, standards)
  | "BORN_RECORDED"     // RECORDED is the honest terminal state (registries, archives, indicators, filings, events)
  | "WAVE1_PROMOTED"    // completed RECORDED→SETTLED in bulk (2026-07-03, 205,679 rows)
  | "WAVE2_RETRACTIONS" // REVERSED baselines owed a prepended publication/enactment row
  | "CONDITIONAL"       // future deterministic rule needs per-claim outcome metadata (wave 3)
  | "NEEDS_LLM";        // arc genuinely requires research

/** Baseline SETTLED — single-step is the complete curve. (120) */
export const BORN_SETTLED: readonly string[] = [
  "african_court_v1", "africanlii_v1", "argentina_legislation_v1", "australia_legislation_v1",
  "austria_legislation_v1", "bangladesh_legislation_v1", "belgium_legislation_v1", "brazil_legislation_v1",
  "brunei_legislation_v1", "bundestag_v1", "canada_legislation_v1", "caribbean_v1",
  "central_america_v1", "central_asia_v1", "chile_legislation_v1", "colombia_legislation_v1",
  "congress_v1", "costa_rica_legislation_v1", "courtlistener_bia_v1", "courtlistener_circuits_v1",
  "courtlistener_scotus_v1", "courtlistener_state_supreme_v1", "courtlistener_tax_v1", "croatia_legislation_v1",
  "cyprus_legislation_v1", "czech_legislation_v1", "denmark_legislation_v1", "drugsatfda_v1",
  "echr_judgments_v1", "echr_v1", "eec_council_v1", "estonia_legislation_v1",
  "eswatini_legislation_v1", "eu_legislation_v1", "finland_legislation_v1", "fr_rules_v1",
  "france_legislation_v1", "georgia_legislation_v1", "germany_legislation_v1", "ghana_legislation_v1",
  "hungary_legislation_v1", "iau_constellations_v1", "iau_v1", "icc_judgments_v1",
  "icd11_v1", "iceland_legislation_v1", "icj_judgments_v1", "icsid_v1",
  "impact_craters_v1", "india_legislation_v1", "israel_knesset_v1", "italy_legislation_v1",
  "jamaica_legislation_v1", "japan_legislation_v1", "kenya_legislation_v1", "korea_legislation_v1",
  "latvia_legislation_v1", "lesotho_legislation_v1", "luxembourg_legislation_v1", "malawi_legislation_v1",
  "malaysia_legislation_v1", "malta_legislation_v1", "mauritius_legislation_v1", "mesh_v1",
  "mexico_legislation_v1", "namibia_legislation_v1", "nationalrat_v1", "nist_constants_v1",
  "nist_webbook_v1", "nobel_v1", "norway_legislation_v1", "nz_legislation_v1",
  "nz_local_acts_v1", "oireachtas_v1", "paclii_legislation_v1", "pakistan_code_v1",
  "parlament_at_v1", "pdg_particles_v1", "periodic_table_v1", "peru_legislation_v1",
  "philippines_legislation_v1", "poland_legislation_v1", "portugal_legislation_v1", "riksdag_v1",
  "romania_legislation_v1", "russia_legislation_v1", "rwanda_legislation_v1", "rxnorm_v1",
  "scotland_legislation_v1", "sierra_leone_legislation_v1", "singapore_legislation_v1", "slovakia_legislation_v1",
  "slovenia_legislation_v1", "solar_system_v1", "south_africa_legislation_v1", "spain_legislation_v1",
  "srilanka_legislation_v1", "sweden_legislation_v1", "switzerland_legislation_v1", "taiwan_legislation_v1",
  "tanzania_legislation_v1", "thailand_legislation_v1", "tt_legislation_v1", "uae_legislation_v1",
  "uganda_legislation_v1", "uk_legislation_v1", "un_sc_resolutions_v1", "un_treaties_v1",
  "uruguay_legislation_v1", "us_legislation_v1", "uspto_v1", "wales_senedd_v1",
  "western_balkans_v1", "who_essential_medicines_v1", "wikidata_elements_v1", "wikidata_nobel_v1",
  "wipo_lex_v1", "wto_disputes_v1", "zambia_legislation_v1", "zimbabwe_legislation_v1",
];

/** Baseline RECORDED, and RECORDED is the honest terminal state. (47) */
export const BORN_RECORDED: readonly string[] = [
  "chebi_v1", "congress_stock_act_v1", "cosmetic_faers_v1", "courtlistener_disclosures_v1",
  "czech_abs_v1", "doj_fara_v1", "europeana_wwi_v1", "faers_normalized_drugs_v1",
  "fda_aesthetic_devices_v1", "fec_finance_pac_v1", "fec_finance_v1", "fred_v1",
  "frus_v1", "genbank_v1", "jacar_v1", "loc_collections_v1",
  "miller_center_v1", "nara_catalog_v1", "nasa_exoplanet_v1", "nato_official_texts_v1",
  "nih_reporter_v1", "nuclear_tests_v1", "ofac_sdn_v1", "omim_v1",
  "openalex_journals_v1", "openfda_v1", "openfec_ie_v1", "openfec_v1",
  "pubchem_v1", "romania_cnsas_v1", "sec_edgar_v1", "sipri_milex_v1",
  "sipri_v1", "space_missions_v1", "stasi_v1", "taiwan_archives_v1",
  "ucdp_v1", "uk_national_archives_v1", "un_ga_resolutions_v1", "un_ga_v1",
  "usgs_eq_v1", "vdem_v1", "volcanic_eruptions_v1", "who_gho_v1",
  "wikidata_chips_v1", "wikidata_space_missions_v1", "worldbank_v1",
];

/** Bulk-promoted RECORDED→SETTLED by scripts/bulk-promote-corpus.ts wave 1. (9)
 *  Residual single-steps here are date-less claims — complete-with-caveat. */
export const WAVE1_PROMOTED: readonly string[] = [
  "voteview_v1", "congress_votes_v1", "uk_commons_v1", "openparliament_ca_v1",
  "howtheyvote_eu_v1", "eu_parliament_v1", "tweedekamer_v1", "openfda_labels_v1",
  "canada_bills_v1",
];

/** Baseline REVERSED — owed a prepended entry row (wave 2 / wave-2-style). (3) */
export const WAVE2_RETRACTIONS: readonly string[] = [
  "crossref_retractions_v1", "retraction_watch_v1", "nz_repealed_acts_v1",
];

/** Deterministic completion possible once outcome metadata is inspected (wave 3). (5) */
export const CONDITIONAL: readonly string[] = [
  "congress_bills_tracker_v1", // became-law → SETTLED @ action date; died with congress → ABANDONED
  "nz_bills_v1",               // same pattern, NZ Parliament
  "clinicaltrials_v1",         // registered trial → completed/terminated/results-posted
  "clinical_trials_v1",        // baseline CONTESTED — trial resolution
  "icc_cases_v1",              // case registered → judgment issued
];

/** Arc genuinely requires research — the LLM promoter's queue. (2) */
export const NEEDS_LLM: readonly string[] = ["openalex_v1", "manual"];

/** Pipelines whose single-step claims should NOT count as "needs promotion". */
export const COMPLETE_SINGLE_STEP: ReadonlySet<string> = new Set([
  ...BORN_SETTLED,
  ...BORN_RECORDED,
  ...WAVE1_PROMOTED,
]);

export const CATEGORIES: Record<CompletenessCategory, readonly string[]> = {
  BORN_SETTLED,
  BORN_RECORDED,
  WAVE1_PROMOTED,
  WAVE2_RETRACTIONS,
  CONDITIONAL,
  NEEDS_LLM,
};

export function categoryOf(pipeline: string): CompletenessCategory | null {
  for (const [cat, list] of Object.entries(CATEGORIES) as [CompletenessCategory, readonly string[]][]) {
    if (list.includes(pipeline)) return cat;
  }
  return null;
}
