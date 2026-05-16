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

<!-- BEGIN:active-pipelines -->
# Active Pipeline Registry

| # | Ingester tag | Script | Claims | Run date | Notes |
|---|---|---|---|---|---|
| 1 | `congress_bills_v1` | `ingest-congress-bills.ts` | — | — | Bills, Congress.gov |
| 2 | `cr_unsc_v1` | `ingest-cr-unsc.ts` | — | — | UN Security Council resolutions |
| 3 | `genbank_v1` | `ingest-genbank.ts` | — | — | GenBank accessions, NCBI |
| 4 | `scotus_v1` | `ingest-scotus.ts` | — | — | SCOTUS opinions |
| 6 | `ncbi_gene_v1` | `ingest-ncbi-gene.ts` | — | — | NCBI gene entries |
| 7 | `nih_clinical_trials_v1` | `ingest-nih-clinical-trials.ts` | — | — | ClinicalTrials.gov |
| 8 | `faers_normalized_drugs_v1` | `ingest-faers-current-drugs.ts` | 995 | 2026-05-13 | Drug-level aggregate AE counts, openFDA generic_name.exact, 1,000-drug cap |
| 9 | `sec_edgar_v1` | `ingest-sec-edgar.ts` | — | — | SEC EDGAR historically significant filings — Enron, WorldCom/MCI, Lehman, Boeing, GE |
| 10 | `nobel_v1` | `ingest-nobel-prizes.ts` | — | — | Nobel Prize laureates 1901–2024, all categories, Nobel Foundation API |

**Pipeline 5 (`uspto_v1`) retired 2026-05-12** — see Known-Bad Pipelines.
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
