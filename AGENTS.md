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
<!-- END:hard-fact-pipeline-rules -->

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
