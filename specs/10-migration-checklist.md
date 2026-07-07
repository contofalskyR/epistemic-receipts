# Spec 10 — Migration Checklist

Remaining active pipelines to migrate to `lib/ingest` harness. Sorted by natural priority: partial-run backlog first, then by fetch archetype for batching efficiency.

**Migration rule:** New pipelines MUST use the harness. Legacy pipelines migrate opportunistically when they next need a re-run. No migration unless the pipeline needs to run.

---

## Completed (pilot migrations — spec/10)

| Tag | Archetype | Status |
|-----|-----------|--------|
| `congress_v1` | Paginated JSON API + auth key | ✅ migrated → `pipelines/congress_v1.ts` |
| `paclii_legislation_v1` | Wayback/CDX enumerate + fetch | ✅ migrated → `pipelines/paclii_legislation_v1.ts` |
| `doj_fara_v1` | Bulk CSV download (zip) | ✅ migrated → `pipelines/doj_fara_v1.ts` |

---

## Partial-run backlog (migrate first — these are the natural next candidates)

| Tag | Script | Fetch Archetype | Est. Effort | Notes |
|-----|--------|----------------|-------------|-------|
| `rxnorm_v1` | `ingest-rxnorm.ts` | Paginated JSON (NLM API) | S | ~14,632 target; in-progress |
| `chebi_v1` | `ingest-chebi.ts` | Bulk OBO/XML download | M | ~62,000 compounds; in-progress |
| `omim_v1` | `ingest-omim.ts` | Rate-limited JSON API | M | 1,512 ingested; OMIM_API_KEY needed |
| `uk_legislation_v1` | `ingest-uk-legislation.ts` | REST pagination | S | Ingestion in progress |

---

## European legislative pipeline family (same OData/REST archetype — batch together)

| Tag | Script | Fetch Archetype | Est. Effort | Notes |
|-----|--------|----------------|-------------|-------|
| `riksdag_v1` | `ingest-riksdag.ts` | Paginated REST API | S | 9,989 claims |
| `bundestag_v1` | `ingest-bundestag.ts` | Paginated REST (DIP) | S | 6,343 claims |
| `oireachtas_v1` | `ingest-oireachtas.ts` | Paginated REST | S | 4,040 claims |
| `nationalrat_v1` | `ingest-nationalrat.ts` | Paginated REST | S | 3,868 claims |
| `tweedekamer_v1` | `ingest-tweedekamer.ts` | OData API | S | 1,530 claims |
| `canada_bills_v1` | `ingest-canada-bills.ts` | Paginated REST (LEGISinfo) | S | 1,067 claims |
| Hungary (pending) | TBD | TBD | M | Partial-run backlog |
| Slovenia (pending) | TBD | TBD | M | Partial-run backlog |
| Czech (pending) | TBD | TBD | M | Partial-run backlog |
| Latvia (pending) | TBD | TBD | M | Partial-run backlog |

---

## Science / medical pipelines

| Tag | Script | Fetch Archetype | Est. Effort | Notes |
|-----|--------|----------------|-------------|-------|
| `crossref_retractions_v1` | `ingest-retractions.ts` | Paginated JSON API | S | 26,595 claims |
| `nasa_exoplanet_v1` | `ingest-astronomy.ts` | Bulk CSV download | S | |
| `iau_constellations_v1` | `ingest-astronomy.ts` | Static JSON | XS | |
| `usgs_eq_v1` | `ingest-usgs-earthquakes.ts` | Paginated GeoJSON API | S | |
| `clinicaltrials_v1` | `ingest-clinicaltrials.ts` | Paginated REST | S | |
| `pubchem_v1` | `ingest-pubchem.ts` | REST per-compound | M | Rate-sensitive |
| `faers_normalized_drugs_v1` | `ingest-faers-current-drugs.ts` | openFDA REST | S | |
| `genbank_v1` | `ingest-genbank.ts` | NCBI REST | S | |
| `icd11_v1` | `ingest-icd11.ts` | REST (ICD API OAuth) | M | Script exists; never run; needs API keys |
| `openfda_labels_v1` | `ingest-openfda-labels.ts` | Bulk partition | M | BLOCKED pending CONSULTANT.md |
| `nuclear_tests_v1` | `ingest-nuclear-tests.ts` | Static curated list | XS | |
| `periodic_table_v1` | `ingest-periodic-table.ts` | GitHub JSON | XS | |
| `who_essential_medicines_v1` | `ingest-who-essential-medicines.ts` | Static curated list | XS | |
| `volcanic_eruptions_v1` | `ingest-volcanic-eruptions.ts` | NOAA API + GVP fallback | M | Dual-source archetype |
| `space_missions_v1` | `ingest-space-missions.ts` | Bulk TSV (GCAT) | S | |

---

## Political / legal pipelines

| Tag | Script | Fetch Archetype | Est. Effort | Notes |
|-----|--------|----------------|-------------|-------|
| `un_sc_resolutions_v1` | `ingest-un-sc-resolutions.ts` | Paginated REST | S | 2,798 claims |
| `fr_rules_v1` | `ingest-federal-register.ts` | Paginated REST | S | 1,915 claims |
| `nih_reporter_v1` | `ingest-nih-reporter.ts` | Paginated REST | S | |
| `sec_edgar_v1` | `ingest-sec-edgar.ts` | REST (EDGAR) | M | |
| `openfec_v1` | `ingest-openfec.ts` | Paginated REST (OpenFEC) | S | |
| `openfec_ie_v1` | `ingest-openfec.ts` | Paginated REST (OpenFEC) | S | |
| `courtlistener_scotus_v1` | `app/api/ingest/scotus/route.ts` | HTTP route | M | Currently an API route — migration changes invocation model |
| `courtlistener_circuits_v1` | `ingest-courtlistener-circuits.ts` | Paginated REST | M | Script written 2026-06-01; not yet run |
| `nato_official_texts_v1` | `ingest-nato-official-texts.ts` | CDX enumerate + Wayback | S | Awaiting run |
| `nobel_v1` | `ingest-nobel-prizes.ts` | JSON API | XS | 1,688 claims |

---

## Wayback/CDX family (same archetype as paclii pilot)

| Tag | Script | Fetch Archetype | Est. Effort | Notes |
|-----|--------|----------------|-------------|-------|
| `caribbean_v1` | `ingest-caribbean.ts` | Mixed: direct scrape + CDX | M | Complex; DNS failures for some countries |
| `africanlii_v1` | `ingest-africanlii.ts` | CDX enumerate + Wayback | S | Pattern established by paclii |
| `africa_lii_v1` | `ingest-africa-lii.ts` | CDX + direct | M | |
| `african_court_v1` | `ingest-african-court.ts` | CDX + Wayback | S | |

---

## Fetch archetype key

| Archetype | Adapter cursor pattern | Pilot reference |
|-----------|----------------------|----------------|
| Paginated JSON/REST API | `PAGE:N` or `OFFSET:N` | `congress_v1` |
| Wayback/CDX enumerate + fetch | `IDX:N` (global slug index) | `paclii_legislation_v1` |
| Bulk CSV/TSV download | `ROW:N` | `doj_fara_v1` |
| Static curated list | Single batch, cursor always null | (trivial) |

## Effort scale
- **XS** < 1 hour (static list, trivial adapter)
- **S** 1–3 hours (straightforward pagination or download)
- **M** 3–8 hours (complex cursor logic, dual-source, rate limits, or route-to-script conversion)
