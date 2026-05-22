<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:hard-fact-pipeline-rules -->
# Hard-fact pipeline principles

## Editorial-not-algorithmic
Cross-references between bulk-ingested claims and curated case studies are editorial work, not algorithmic. Ingesters produce facts (claims, sources, edges). Humans curate connections (CITES edges). These belong in separate hand-curated scripts, not bulk ingesters.

## Curated lists require verifiable sources
Curated lists in HARD_FACT pipelines must be sourced from a verifiable external record — live API, Wikipedia article with citation, peer-reviewed publication, or government database. Training-data recall is not a verifiable source.

When live APIs are unavailable, the curated list itself becomes the verification surface: every entry must trace to a fetchable URL or document that confirms the patent number, accession, or identifier. Before a pipeline is run against production, spot-check at least the anchor entries against their canonical URLs.

The GenBank pipeline got this right: accessions were verified against ncbi.nlm.nih.gov before approval. The USPTO pipeline (Pipeline 5) did not: the absence of a working API made model memory feel like an acceptable substitute. It was not. At least two patent numbers in the initial run were confirmed fabrications pointing to unrelated patents.

## Source/Edge/MetaEdge metadata fields (pending)
`metadata: Json?` exists on `Claim` only. Until the field is added to `Source`, `Edge`, and `MetaEdge` (queued for a future migration), source-level provenance for bulk-ingested records goes in `Claim.metadata` under a `dataset` or `source` key.

## Verify ingester counters against DB state
Do not trust in-script progress logs as the source of truth for how many rows were written. Verify ingester results against DB state (count queries) after every run. Closure-scope bugs and transaction rollbacks can cause counters to misreport while the DB is correct — or vice versa.

## Transaction timeout for large pipelines
For pipelines over ~1,000 rows: set `prisma.$transaction(fn, { timeout: 30000 })` to avoid the default 5-second timeout on batches. The default will silently fail mid-batch on slow connections or complex writes.

## humanReviewed and autoApproved must reflect reality
`humanReviewed: true` means a human reviewed the record. `autoApproved: true` means the pipeline's own quality gates passed. These are separate signals — do not conflate them. If a visibility or filtering bug makes auto-ingested records invisible, fix the filter, not the field. Setting `humanReviewed: true` on auto-ingested records to work around a filter is documentation drift that corrupts the audit trail.

## Receipt value must exceed audit cost per record
A HARD_FACT pipeline whose individual records cost more to verify than they contribute to editorial understanding is in the wrong scope. When a pipeline's per-record audit cost exceeds its per-record editorial value, the pipeline is retired rather than audited. Records are flagged `verificationStatus: DEPRECATED`, excluded from default views, and preserved for audit trail purposes only.

## Reference-tier vs. background-tier sources
A dataset is reference-tier (suitable for bulk ingestion) only if individual records will be directly cited by case-study Claims. If only aggregated views or third-party analyses of the dataset will be cited, the dataset is background-tier — link to specific records or analyses as Sources within case studies, do not ingest in bulk.

The test: of the next 20 case studies you might build, how many would directly cite an individual record from this dataset? Congress.gov passes (case studies cite specific bills, votes, hearings). CR-UNSC passes (case studies cite specific resolutions). FAERS fails (case studies cite analyses, not individual reports).
<!-- END:hard-fact-pipeline-rules -->

<!-- BEGIN:background-tier-sources -->
# Background-tier sources (link, don't ingest)

These datasets are editorially valuable but fail the reference-tier test. Add specific records or query URLs as Sources within case studies; do not build bulk ingesters.

## FAERS — individual event reports
Raw adverse event records (individual report-level data) are background-tier. Use openFDA query URLs as Sources within case studies, e.g., `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:semaglutide&count=patient.reaction.reactionmeddrapt.exact`

**Note:** Drug-level aggregate counts from FAERS are reference-tier and have been ingested as Pipeline 8 (`faers_normalized_drugs_v1`). The distinction: a case study citing "SEMAGLUTIDE has 93,543 adverse event reports" is citing an aggregate claim directly. A case study citing a specific adverse event record is background use.
<!-- END:background-tier-sources -->

<!-- BEGIN:science-medicine-pipeline-notes -->
# Science / Medicine / History Pipeline Notes (added 2026-05-21)

The non-legislative pipeline expansion mirrors the legislative exhaustiveness goal. Same reference-tier test applies — individual records must be directly citable in case studies, not just background context.

## Medical / Biology (in progress or partial)
- `rxnorm_v1` — NLM canonical drug names + relationships. In progress (target ~14,632). Script: `ingest-rxnorm.ts`
- `chebi_v1` — EBI chemical ontology, ~62,000 compounds. In progress. Script: `ingest-chebi.ts`
- `omim_v1` — OMIM phenotype entries, ~15,000. Partial (1,512 ingested, hit rate limit 2026-05-21). **OMIM_API_KEY provided ✅ — in .env.local.** Rate limit: ~250 requests per window; use 500ms delay. Resuming via cron 2026-05-22 02:15 EDT. Script: `ingest-omim.ts`
- `openfda_labels_v1` — 258k FDA drug labels (partition-fixed). **BLOCKED** pending CONSULTANT.md decisions. Script: `ingest-openfda-labels.ts`

## Science / Physics / History pipeline scripts (built 2026-05-21)

### Ready to run — no API key needed (agent-verified 2026-05-21 ✅, scheduled 2am 2026-05-22)
These three were verified by coding agents on 2026-05-21. No external tokens required.
- `nuclear_tests_v1` — `ingest-nuclear-tests.ts`. 202 curated tests: US(62) USSR(39) China(34) France(27) UK(26) DPRK(6) India(6) Pakistan(2). All entries sourced to Wikipedia test pages. Yields null where classified.
- `periodic_table_v1` — `ingest-periodic-table.ts`. All 118 elements from Bowserinator/IUPAC GitHub JSON.
- `who_essential_medicines_v1` — `ingest-who-essential-medicines.ts`. 147 drugs from WHO EML 23rd ed. (2023), hardcoded with ATC codes + therapeutic categories.

### Ready to run — no API key needed (pending scheduling)
- `volcanic_eruptions_v1` — `ingest-volcanic-eruptions.ts`. ~745 significant eruptions since 1500. NOAA NGDC API primary, GVP fallback.
- `space_missions_v1` — `ingest-space-missions.ts`. 7,313 orbital launches from GCAT TSV (OrbPay > 0 filter). Sputnik 1957 → 2020s.

### Needs API key before running
- `fred_v1` — `ingest-fred.ts`. ~4–5k observations across 6 series: UNRATE, GDP, CPIAUCSL, FEDFUNDS, M2SL, CSUSHPINSA. **Needs FRED_API_KEY** (free at fred.stlouisfed.org/docs/api/api_key.html). Add to .env.local before running.

### No script yet (next batch)
- IUCN Red List — ~44,000 threatened species. Needs IUCN API token (free at iucnredlist.org/api/v4).
- PDG particle properties — ~600 particles. Machine-readable tables at pdg.lbl.gov/2024/tables/.
- EM-DAT disasters — ~25,000 since 1900. Requires academic registration at emdat.be.
- Olympic results (Olympedia) — olympedia.org structured format.
- Earth impact craters — Earth Impact Database, ~200 confirmed craters.
- World Bank Open Data — data.worldbank.org, free API.
- SIPRI arms transfers — sipri.org, free downloads.

## Rate limit notes
- OMIM: ~250 requests per window. Do NOT use `search=*` (returns HTTP 500). Use `search=the` which covers ~28k of ~29k entries. Rate: 500ms/request.
- IUCN: rate limits documented at iucnredlist.org/api/v4/docs — use token from registration.
- FRED: 120 requests/minute, no daily cap. API key required (free at fred.stlouisfed.org/docs/api/api_key.html).
<!-- END:science-medicine-pipeline-notes -->

<!-- BEGIN:active-pipelines -->
# Active Pipeline Registry

Last synced from DB: 2026-05-21. Total claims (excl. deprecated): ~336,900+ across 90+ pipelines.

| Tag | Script | Claims | Notes |
|---|---|---|---|
| `crossref_retractions_v1` | `ingest-retractions.ts` | 26,595 | Retracted papers via CrossRef |
| `nasa_exoplanet_v1` | `ingest-astronomy.ts` | 6,277 | NASA exoplanet archive |
| `usgs_eq_v1` | `ingest-usgs-earthquakes.ts` | 4,696 | USGS M6.5+ earthquakes since 1900 |
| `un_sc_resolutions_v1` | `ingest-un-sc-resolutions.ts` | 2,798 | UN Security Council resolutions |
| `fr_rules_v1` | `ingest-federal-register.ts` | 1,915 | Federal Register significant final rules (EO 12866) since 1994 |
| `nobel_v1` | `ingest-nobel-prizes.ts` | 1,688 | Nobel Prize laureates 1901–2024, all categories |
| `nih_reporter_v1` | `ingest-nih-reporter.ts` | 1,354 | NIH RePORTER grants |
| `clinicaltrials_v1` | `ingest-clinicaltrials.ts` | 1,053 | ClinicalTrials.gov |
| `faers_normalized_drugs_v1` | `ingest-faers-current-drugs.ts` | 995 | Drug-level aggregate AE counts, openFDA, 1,000-drug cap |
| `sec_edgar_v1` | `ingest-sec-edgar.ts` | 379 | SEC EDGAR historically significant filings |
| `congress_v1` | `ingest-congress.ts` | 366 | Congress enacted laws (congress_v1) |
| `pubchem_v1` | `ingest-pubchem.ts` | 355 | PubChem compounds |
| `courtlistener_scotus_v1` | `ingest-courtlistener-scotus.ts` | 300 | SCOTUS opinions via CourtListener |
| `openfda_v1` | `ingest-openfda.ts` | 233 | openFDA |
| `genbank_v1` | `ingest-genbank.ts` | 99 | GenBank accessions, NCBI |
| `iau_constellations_v1` | `ingest-astronomy.ts` | 88 | IAU constellations |
| `retraction_watch_v1` | — | 55 | Retraction Watch |
| `solar_system_v1` | — | 28 | Solar system bodies |
| `iau_v1` | — | 5 | IAU |
| `icd11_v1` | `ingest-icd11.ts` | 0 | WHO ICD-11 MMS — script exists, never run. Requires ICD_API_CLIENT_ID + ICD_API_CLIENT_SECRET. |
| `nato_official_texts_v1` | `ingest-nato-official-texts.ts` | 0 | NATO CPS official texts — script exists, dry-run validated 2026-05-19 against 481 Wayback-CDX-enumerated IDs. Awaiting approval before full ingest. |
| `riksdag_v1` | `ingest-riksdag.ts` | 9989 | Swedish Riksdag bills and resolutions (1994/95–present) via riksdag.se open API |
| `tweedekamer_v1` | `ingest-tweedekamer.ts` | 1530 | Dutch Tweede Kamer enacted legislation via OData API |
| `bundestag_v1` | `ingest-bundestag.ts` | 6343 | German Bundestag enacted laws (Vorgänge type=Gesetzgebung) via DIP REST API |
| `nationalrat_v1` | `ingest-nationalrat.ts` | 3868 | Austrian Nationalrat enacted laws (Beschlüsse des Nationalrates) via Parlament.gv.at |
| `oireachtas_v1` | `ingest-oireachtas.ts` | 4040 | Irish Oireachtas enacted Acts via api.oireachtas.ie open API |
| `canada_bills_v1` | `ingest-canada-bills.ts` | 1067 | Canadian federal bills with Royal Assent (35th–45th Parliament) via LEGISinfo API |
| `uk_legislation_v1` | `ingest-uk-legislation.ts` | 0 | UK Public General Acts via legislation.gov.uk — ingestion in progress (2026-05-19) |

**Pipeline 5 (`uspto_v1`) retired 2026-05-12** — 182 DEPRECATED records — see Known-Bad Pipelines.
<!-- END:active-pipelines -->

<!-- BEGIN:known-bad-pipelines -->
# Known-Bad Pipelines (Retired)

## Pipeline 5 — USPTO Patents (uspto_v1)
- **Records affected:** 182 claims, 97 patents
- **Retirement date:** 2026-05-12
- **Ingester:** `scripts/retired/ingest-uspto-patents.ts`
- **Failure modes:**
  - (a) Fabricated patent metadata from training-data recall. Confirmed: US4431740 had the correct patent number but wrong title and wrong inventors — content was lifted from US4237224 (Cohen-Boyer chimeras patent). The fabrication signature matched the original Pipeline 5 failure pattern, indicating the problem was not isolated to a single record.
  - (b) Structural field contamination on the tobacco bucket. Court-case-style citation strings were placed in the assignee field during ingestion, a separate bug from the fabrication issue.
- **Resolution:** All 182 records set to `verificationStatus: DEPRECATED` with `metadata.deprecation_reason` documenting the audit finding. Records are retained in the database for audit trail purposes, excluded from all default views, and accessible via the "Show deprecated" toggle or direct URL.
<!-- END:known-bad-pipelines -->
