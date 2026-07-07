# Spec 40 — Litigation Workbench (as-of queries, reports, matters)

Phase 4 · Depends on: 20, 30 · Model: **Opus 4.8** · Scope: ~1–2 weeks of agent sessions
Temporal correctness is the entire product here. An as-of view that leaks post-date knowledge is worse than no product — litigation users will be cross-examined on it.

## Objective
"State of knowledge as of date X" as a defensible, exportable research artifact: what was published, contested, settled, retracted as of a date — with every receipt cited and a methodology appendix.

## Core: the as-of engine (`lib/asof.ts` + `GET /v1/asof?topic=&date=`)
Resolution rules (decided — encode exactly):
1. Scope: topic → claims via ClaimTopic + hybrid search (Spec 50), cap 200 by relevance, plus any claim IDs passed explicitly.
2. Claim inclusion: `claimEmergedAt ≤ asOfDate` (claims with null emergence: include ONLY if ≥1 edge's source has `publishedAt ≤ asOfDate`; flag as "emergence undated" in output).
3. Status as-of: latest `ClaimStatusHistory` transition with `occurredAt ≤ asOfDate` → its `toAxis`; none → RECORDED. **Precision honesty:** transition with YEAR precision and `occurredAt` in the same year as asOfDate → status rendered "ambiguous at this date" with both candidate axes shown. Same rule for MONTH precision within the same month. Never silently pick one.
4. Receipts as-of: only edges whose source `publishedAt ≤ asOfDate`. Sources with null publishedAt are EXCLUDED from as-of views and counted in a disclosed "undated sources omitted: N" line (leaking undated sources is the anachronism vector).
5. Retraction overlay: a paper-claim retracted AFTER asOfDate renders as *not yet retracted* in the timeline body — with a clearly separated "subsequent history" footnote (this dual view is the product's honesty feature; a lawyer needs both).
6. Every response carries: generation timestamp, data snapshot version (git sha + latest migration), full rule disclosure (link to methodology §as-of), and per-item provenance grades (Spec 20).

Output shape: grouped timeline (by year → items: claim/status-change/source-publication events), each item with citation-ready source data.

## UI: `/research/asof`
Topic + date picker → timeline view with axis-at-date badges, receipts expandable, "subsequent history" toggle (default OFF — the whole point is seeing without hindsight), omitted-undated disclosure line, export button. Entitlement-gated (`workbench` feature, org tier; free users see a 3-claim teaser).

## Report export
`POST /api/matters/{id}/report` → .docx via the `docx` npm package (not PDF-first; lawyers edit). Contents: cover (topic, as-of date, generated date, snapshot version), executive timeline, per-claim sections (text, status trajectory up to date, receipts as formatted citations — reuse Spec 31 mappings), subsequent-history appendix (clearly labeled), **methodology appendix** auto-composed from: as-of resolution rules verbatim, data cards of every pipeline that contributed a cited record, provenance-grade legend, corrections-policy pointer. Deterministic: same matter + same data ⇒ byte-stable document except generation date (needed for reproducibility claims under scrutiny).

## Matters
`Matter` (orgId, name, topic params, asOfDate, createdBy, createdAt) + `MatterItem` (pinned claims, per-item notes) + append-only `MatterAccessLog` (who viewed/exported/edited what, when — no deletes, no updates; this is a defensibility feature, say so in docs). Matter pages list saved as-of views; report generation records to the log. Org-scoped via Spec 30 ownership rules.

## Out of scope
PDF export (docx first), collaborative editing, external document upload, any "opinion" or conclusion generation — the tool assembles the record, humans argue it.

## Acceptance criteria
- **Golden temporal tests** (the important ones — write ~30): hand-constructed fixture claims with known trajectories; assert axis-at-date for dates straddling every transition, precision-ambiguity behavior, null-emergence handling, undated-source exclusion counts, retraction-after-date footnoting. These run in CI forever.
- Anachronism audit: for 3 real case studies (tobacco, Pluto, Ozempic), generate as-of views at 3 historically meaningful dates each; human-review checklist confirming no post-date leakage in the main body (owner sign-off in PR).
- Report determinism: two generations of the same matter diff-identical except timestamp.
- Access log: append-only enforced at DB level (no UPDATE/DELETE grants for app role on that table — actual grants, not convention); every export produces a row.
- docx opens clean in Word + Google Docs (screenshots); citations in it match Spec 31 formats.

## Verification
Paste: golden-test run, one anachronism-audit checklist, determinism diff, grant listing for the log table.
