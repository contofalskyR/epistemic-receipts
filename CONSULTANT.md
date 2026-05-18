# CONSULTANT.md — Epistemic Receipts Architectural Memory

> **Every coding agent must read this file before making changes.**
> **Every coding agent must update this file after making changes.**
> This is the single source of architectural truth between sessions.

---

## Project At a Glance

**Stack:** Next.js 16.2.6 · Prisma 6.19.3 · React 19 · PostgreSQL · TypeScript · Tailwind v4  
**Deploy:** Vercel (production at epistemic-receipts.vercel.app)  
**Visualization:** ReactFlow (graph edges/flow diagrams)  
**Auth:** Stub only — `/api/login` exists, method not yet implemented

---

## Current DB State (as of 2026-05-18)

| Entity | Count |
|--------|-------|
| Claims | ~55,000+ |
| Sources | ~54,000+ |
| Edges | ~55,000+ |
| Enacted Congress Bills (97th–119th) | 2,236 |
| FAERS drug aggregates | 995 |
| Federal Register rules (`fr_rules_v1`) | 1,915 |
| USGS earthquakes M6.5+ (`usgs_eq_v1`) | 4,696 |
| Nobel laureates (`nobel_v1`, canonical) | 1,026 |
| Nobel laureates (`nobel_v1`, DEPRECATED stale) | 662 |
| SEC EDGAR filings (`sec_edgar_v1`) | 379 |
| CrossRef retractions (`crossref_retractions_v1`) | ~26,500 |

---

## Schema — Models & Key Relations

### Core
- **Claim** — Central entity. Text + status (DISPUTED/HARD_FACT/NEVER_RESOLVES) + type + hierarchy (parentClaimId) + review workflow (humanReviewed, reviewConfidence, reviewedBy) + soft-delete + autoApproved.
- **Source** — Producer of evidence. Has externalId for cross-referencing. Soft-deleted.
- **Edge** — Source → Claim with relationship type (FOR/AGAINST/CITES/RETRACTS/CORRECTED) and evidenceType. Score NOT stored here — see EdgeRevision.
- **EdgeRevision** — Audit trail for all Edge score changes (priorScore, newScore, reason, timestamp).
- **MetaEdge** — Edge targeting another Edge. For suppression, amplification, demotion, labeling.
- **Topic** — Hierarchical taxonomy (slug, parentTopicId). Used for domain filtering.
- **ClaimTopic** — Claim ↔ Topic junction table.
- **ThresholdEvent** — The "receipt." When a Claim crosses to HARD_FACT. Links to confirmedBy (human), triggeredBySourceId (auditable).
- **SuggestedThresholdEvent** — AI suggestions only. Not authoritative.
- **SourceRelationship** — Declared relationships between Sources (funder_of, affiliated_with, etc.).
- **SourceCredibilityEvent** — Audit trail for credibility changes.

### Stubs
- **AiJob** — Future AI job queue (classify, detect contradictions, propose threshold).
- **Feedback** — User form submissions.

---

## Pipeline Registry (current as of 2026-05-18)

| # | Script | Source | Status | Records |
|---|--------|--------|--------|---------|
| 1 | `ingest-congress-bills.ts` | Congress.gov enacted bills 113th–119th | Shipped | 205 |
| 2 | `ingest-un-sc-resolutions.ts` | UN SC resolutions (Zenodo dataset) | Ready | — |
| 3 | `ingest-genbank.ts` | NCBI GenBank sequences | Ready | — |
| 4 | `ingest-courtlistener-scotus.ts` | CourtListener SCOTUS opinions | Ready | — |
| 5 | `ingest-uspto-patents.ts` | USPTO Patents | **RETIRED 2026-05-12** — fabricated metadata. Records marked DEPRECATED. | 182 |
| 6 | `ingest-ncbi-gene.ts` | NCBI gene entries | Ready | — |
| 7 | `ingest-clinicaltrials.ts` | ClinicalTrials.gov | Ready | — |
| 8 | `ingest-faers-current-drugs.ts` | openFDA FAERS drug aggregates | Shipped | 995 |
| 9 | `ingest-sec-edgar.ts` | SEC EDGAR curated filings (Enron, Lehman, Boeing, GE, WorldCom) | Shipped 2026-05-18 | 379 |
| 10 | `ingest-nobel-prizes.ts` | Nobel Foundation API v2.1 (1901–2024) | Shipped 2026-05-18 | 1,026 canonical + 662 DEPRECATED stale |
| 11 | `ingest-icd11.ts` | WHO ICD-11 MMS linearization 2024-01 | Dry-run pending (needs ICD_API creds) | — |
| 12 | `ingest-usgs-earthquakes.ts` | USGS M6.5+ since 1900 | Shipped 2026-05-18 | 4,696 |
| 13 | `ingest-retractions.ts` | CrossRef retracted papers | Full run completed 2026-05-17 | ~26,500 |
| 14 | `ingest-federal-register.ts` | Federal Register EO 12866 significant rules | Shipped 2026-05-18 | 1,915 |
| 15 | `ingest-congress.ts` | Congress.gov enacted laws (newer ingester) | Ready | — |
| — | `ingest-astronomy.ts` | NASA exoplanets + IAU bodies | Shipped | — |
| — | `ingest-pubchem.ts` | PubChem chemistry substrate | Ready | — |

---

## Architectural Rules — Do Not Violate Without Asking

### 1. API-only sourcing
Every pipeline entry must trace to a live fetchable URL. No training-data recall. No hardcoded claims without a verifiable source at ingestion time.

### 2. Reference-tier vs. Background-tier
- **Reference-tier:** Individual records are directly citable by case studies → bulk ingest.
- **Background-tier:** Only aggregated views are cited → add as Sources within case studies, not bulk ingest.
- Background-tier examples: individual FAERS adverse event reports, individual WIPO patent filings.

### 3. humanReviewed ≠ autoApproved
- `humanReviewed: true` = a human reviewed it.
- `autoApproved: true` = pipeline's own quality gates passed.
Never set `humanReviewed: true` in a pipeline script. Never conflate these two flags.

### 4. Audit trail always
Deprecated records stay in DB. Mark `verificationStatus: DEPRECATED` + `metadata.deprecation_reason`. Never hard-delete pipeline records.

### 5. Transaction timeout for large pipelines
For pipelines >1,000 rows: `prisma.$transaction(fn, { timeout: 30000 })`. Default is 5s which will fail.

### 6. Verify against DB state after every run
Don't trust script-level progress logs. Run count queries after every ingest to detect closure bugs or rollbacks.

### 7. Changelog + footer update on every deploy
Whenever changes are pushed:
- Add entry to homepage changelog section
- Update footer "last updated [date]"

### 8. Cross-references are hand-curated, not auto-ingested
Ingesters create Claims, Sources, Edges. Cross-references between entities (e.g., CITES edges linking a FAERS record to a SCOTUS ruling) belong in separate hand-curated scripts only.

---

## Open Decisions / Tech Debt

- **Auth:** `/api/login` route is a stub. No auth method implemented. All write endpoints currently unprotected. Do not build features that assume auth is working.
- **Review queue:** `/review` page exists for humanReviewed=false claims. ~47k pipeline records are awaiting review — the queue is a backlog concern, not a blocker.
- **Pipeline 5 (USPTO):** Retired records still in DB. A future cleanup pass should validate which ones are salvageable after re-verification.
- **Pipeline 13 (CrossRef Retractions):** Full run completed. Final counts need verification against DB (script reported ~26,500 candidates; confirm actual inserted count).
- **ICD-11 (Pipeline 11):** Requires `ICD_API_CLIENT_ID` and `ICD_API_CLIENT_SECRET` env vars. Dry-run not yet done.
- **ReactFlow graph:** Currently at claims/edges scale. Performance on 47k+ nodes untested.

---

## Pending Production Runs (approved, run when ready)

_None — Pipelines 9, 10, 12, 14 were shipped 2026-05-18._
Next candidates awaiting dry-run or approval: Pipeline 11 (ICD-11, needs API creds).

---

## Changelog (coding agent entries go here)

### 2026-05-18 (later — four-pipeline batch shipment)
- **Pipeline 9 (SEC EDGAR)** shipped — 379 filings across Enron, WorldCom/MCI, Lehman, Boeing, GE (1997–2022). All claims `PROVISIONAL`, `humanReviewed: false`, `autoApproved: true`.
- **Pipeline 10 (Nobel Prizes)** shipped — 1,026 canonical laureate records via Nobel Foundation API v2.1 (1901–2024, all six categories). Initial fetch was blocked by Nobel API 524 (Cloudflare timeout); retried successfully after ~5 min.
  - **Cleanup performed:** discovered 662 stale `nobel_v1` claims from a prior script version (externalId scheme `nobel-claim-{cat}-{year}-{seq}`, no metadata, status `VERIFIED`). Per CLAUDE.md rule 4 (audit trail; deprecate, never delete), marked all 662 as `verificationStatus: DEPRECATED` with `metadata.deprecation_reason` pointing to the 2026-05-18 re-ingestion. They remain in DB for audit purposes and are excluded from default views via the existing `DEPRECATED` filter (same as USPTO Pipeline 5).
- **Pipeline 12 (USGS Earthquakes)** verified — DB already had all 4,696 M6.5+ events from a prior run; idempotent re-run skipped all (`Ingested: 0 | Skipped: 4696`). Treating as Shipped.
- **Pipeline 14 (Federal Register)** verified — DB has 1,915 EO 12866 significant final rules. The script reported `Skipped: 1921` due to ~6 duplicate `document_number` values returned by overlapping per-agency Federal Register queries; the true canonical count is 1,915 distinct externalIds. Treating as Shipped.
- Updated DB State table, Pipeline Registry, and Pending Production Runs sections.
- Homepage changelog (`app/page.tsx`) extended with today's four-pipeline batch entry; footer date already May 18, 2026.

### 2026-05-18
- Homepage rebuilt for server-side filtering + pagination at 47k-claim scale
- Congress.gov enacted bills (97th–119th, 2,236 records) confirmed in DB — idempotent re-run showed 0 new inserts (all existing)
- /pipelines page added
- Homepage changelog section and footer "last updated" added; rule established: update both on every deploy
- CrossRef Retractions (Pipeline 13) full run completed (~26,500 records via CrossRef API)
- Deployed to production: `fix: homepage server-side filtering + pagination for 47k-claim scale`

---

## Notes for Future Agents

- The project is at a scale (47k+ claims) where homepage performance is a genuine constraint. Prefer server-side filtering, pagination, and indexed queries over client-side approaches.
- The Prisma schema uses soft deletes (`deleted` flag). Any queries over public data should filter `deleted: false`.
- Pipeline scripts live in `scripts/`. Run with `npx tsx scripts/<name>.ts`.
- All pipeline scripts should be idempotent (skip existing records by externalId).
- When adding a new pipeline, add it to ROADMAP.md and this registry.
