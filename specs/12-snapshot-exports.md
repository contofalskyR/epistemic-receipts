# Spec 12 — Versioned Snapshot Exports

Phase 1 · Depends on: 00 · Model: Sonnet 5 · Scope: ~2–3 agent sessions

## Objective
Immutable, checksummed, versioned dumps of the graph that a data buyer can download, verify, and diff against the previous release. This is the first thing an AI-lab customer actually consumes.

## Design (decided)
- Snapshot ID: `er-YYYY-QN` quarterly to start (e.g. `er-2026-Q3`); switch to monthly when a customer asks.
- **Included tables** (exact list): `Claim`, `Source`, `Edge`, `EdgeRevision`, `MetaEdge`, `ThresholdEvent`, `ClaimStatusHistory`, `ClaimRelation`, `Topic`, `ClaimTopic`, `LegislativeVote`, `MemberVote`, `PoliticalContext`, `Polity`, `PolityClaim`, `PolityVote`, `HistoricalEvent`, `ClaimHistoricalEvent`, `WikidataLink`, `SourceRelationship`, `SourceCredibilityEvent`, `ClaimLocation`.
- **Excluded** (PII/ops boundary — never export): `Profile`, `Bookmark`, `TopicSubscription`, `WatchedTopic`, `Feedback`, `AiJob`, `PipelineRun`, `SuggestedThresholdEvent`, Book* tables, `ConstituentOpinion` (licensed upstream — check CCES terms before ever including), anything added later that holds emails or keys.
- Deleted rows: excluded. DEPRECATED rows: **included** with their `verificationStatus` and deprecation metadata — buyers filter; the audit trail is part of the product. Document this in the snapshot README.
- Formats: JSONL (one file per table, gzipped) + Parquet. Generate JSONL by streaming Prisma/pg cursors (never `findMany()` a 1M-row table); convert JSONL→Parquet with DuckDB CLI in the export job (`duckdb -c "COPY (SELECT * FROM read_json_auto('claims.jsonl.gz')) TO 'claims.parquet'"`) — do not hand-roll Parquet writing.
- `manifest.json` per snapshot: snapshot id, created timestamp, prisma migration id (schema version), per-table row counts, per-file SHA-256, license string, link to methodology + data-card manifest (`/api/v1/manifest` snapshot embedded for pipeline-level provenance).
- `CHANGELOG.md` per snapshot vs. prior: per pipeline tag — rows added / deprecated / (later: changed). First snapshot's changelog states baseline.
- Storage: Cloudflare R2. Bucket layout `snapshots/er-2026-Q3/<files>`. Public read for `sample/` prefix (a 10k-claim sample slice with all its edges/sources — build it by selecting complete subgraphs, not random rows); full snapshots behind signed URLs (issued manually at first; wired to entitlements in Spec 21).
- Runner: `scripts/export-snapshot.ts`, executed from a GitHub Actions workflow (needs `DIRECT_URL`, R2 creds as repo secrets). Not from Vercel (function limits).

## Deliverables
1. `scripts/export-snapshot.ts` (+ small lib for streaming/checksums) and `.github/workflows/snapshot.yml` (manual `workflow_dispatch` + quarterly cron).
2. Sample-slice builder (subgraph selection: N claims across ≥10 pipelines incl. ≥2 case-study claims, plus every Source/Edge/StatusHistory row they reference — referentially complete).
3. Re-import verifier: `scripts/verify-snapshot.ts` — downloads a snapshot, loads Parquet into DuckDB, checks per-table counts vs manifest, checks referential integrity (every Edge.claimId exists in claims file, etc.), checks checksums. Exits nonzero on any failure.
4. `/datasets/snapshots` page listing releases with manifest links + sample download.
5. Snapshot README template (schema docs per table, filtering guidance re: DEPRECATED, license pointer).

## Out of scope
Billing/entitlement gating (Spec 21). Delta/incremental exports. Customer-specific slices.

## Acceptance criteria
- Full export of production completes in the Actions runner; `verify-snapshot.ts` passes clean on the artifact.
- Checksum tampering test: flip one byte in a downloaded file → verifier fails.
- PII grep test: zero occurrences of any email address or `unsubscribeToken` in the full export (checked by script over the JSONL, not by assertion).
- Sample slice is referentially complete (verifier passes on it standalone) and publicly downloadable.
- Export is read-only: run under a Postgres role with SELECT-only grants (create it; document in runbook).

## Verification
Paste: verifier output on real snapshot, PII-scan output, tamper-test output, R2 listing, sample-download curl.
