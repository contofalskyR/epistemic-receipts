# Lab Pages Triage — 2026-07-03

Audit of the 15 pages in the nav's ⚗ Lab group, run against production (epistemic-receipts.vercel.app) with real-browser verification plus code root-causing. `tsc --noEmit` is clean project-wide. Severity: **P0** broken · **P1** wrong/degenerate data · **P2** UX/polish.

Note on method: JSON API routes return blank through plain HTML fetchers, and client-rendered pages show their loading shells — several "empty API" symptoms turned out to be false positives once checked in a real browser. Everything below was verified in Chrome or in code.

## Fixed in this pass (code changes)

### 1. /retraction-wall — P1: "ripples furthest" ranking is degenerate
Every top-10 entry shows "1 contradicts". Root cause: the pipeline writes exactly one CONTRADICTS edge per retraction (retraction → its own original), so ranking by CONTRADICTS count (`app/retraction-wall/page.tsx`, `getTopRipple`) can never exceed 1. The section's copy ("propagating the dispute to every paper that relies on it") oversells a 1:1 link.
**Fix applied:** rank by incoming citation edges on the retracted original (CITED_BY out + CITES in, from the OpenAlex enrichment), require ≥1, honest empty state if coverage is thin; "Cites" column now shows the same real citation-link count instead of the CONTRADICTS count; blurb reworded; 30-day stat now clamps to `≤ now` so future-dated publisher retraction dates (e.g. 2026-09-01 journal-issue dates) don't inflate it.

### 2. /legislation — P1: "United States — 0 claims" in the country grid
`lib/legislation-countries.ts` counts US by `ingestedBy: "congress_bills_v1"`, but the live tracker writes `congress_bills_tracker_v1` (17,250 bills in prod, last pull 2026-07-02). Tag mismatch → 0.
**Fix applied:** registry now points at `congress_bills_tracker_v1`.

### 3. /legislation — P2: "Last pull: never" flashes while loading
`LegislationClient` renders `formatRelative(null)` → "never" before the API response lands (the US default view takes several seconds). Misleading — the tracker actually pulled yesterday.
**Fix applied:** shows "…" until data arrives; "never" only when the loaded response really has no refresh timestamp.

### 4. /analysis/votes — P1: raw pipeline tag `voteview_v1` shown as a legislative body
"By legislative body" table's first row (47,051 votes) is labeled `voteview_v1`, and the US appears twice (voteview + congress_v1). Root cause: `lib/voteAnalysis.ts` `getBodyKey`/`COUNTRY_LABELS` have no mapping for `voteview_v1`, falling through to the raw tag.
**Fix applied:** voteview votes are labeled "US Congress (all roll-calls)" and split House/Senate by chamber in the per-body decade chart, consistent with congress_v1 handling.

### 5. /analysis/votes — P2: 10–20s blank page on uncached loads
Whole page blocks on `buildVoteAnalysis()` (includes a 500k-row MemberVote scan) with no streaming fallback; revisits during revalidation show a black screen for 20+ seconds.
**Fix applied:** `app/analysis/votes/loading.tsx` skeleton so navigation paints immediately. (Deeper fix — precompute or cache the analysis — listed below.)

### 6. /stats/media-coverage — P1: "Most Covered" is garbage-in-garbage-out
Top bills all show a capped "10,000 NYT articles" because `scripts/populate-bill-coverage.ts` builds phrase queries from boilerplate short titles: "Recognizing", "To establish", "Signal", even "_______ Act" (reserved-bill placeholder titles). Only guard was `query.length < 3`.
**Fix applied:** (a) script now rejects single-word/stopword/placeholder queries so future runs skip them; (b) the API route flags existing degenerate rows (capped hits or generic one-word queries) and the page excludes them from "Most Covered" and labels them in the table instead of presenting them as real signal.

### 7. /topics — P2: zero-count topics clutter the tree
Dozens of "(0)" entries (Biology, Law, Economics, …) render alongside real ones.
**Fix applied:** zero-count branches (no claims anywhere in the subtree) are hidden by default behind a "Show empty topics" toggle.

## Needs owner action (data/ops — can't be fixed from code)

- **/topics — P1 taxonomy data:** "Pakistan Federal Legislation (943)" is parented under Academic Literature → Law, and every topic under Academic Literature wears the same SOCIAL SCI badge (badge is per-domain, so miscategorized parents mislabel whole subtrees). Fixing the parentTopicId/domain rows needs an admin DB mutation (respect AGENTS.md write rules).
- **/legislation — several countries at 0:** Bulgaria, Lithuania, Serbia, Indonesia, Pakistan report 0 claims via their registry tags. Either those ingesters never ran or tags mismatch — worth a `groupBy ingestedBy` spot-check against `lib/legislation-countries.ts`.
- **/stats/media-coverage:** re-run `scripts/populate-bill-coverage.ts` after this pass so junk queries are re-fetched properly (existing rows are only flagged, not recomputed).
- **/analysis/votes deep fix:** move `buildVoteAnalysis()` to a precomputed JSON (like `party-economic-response.json`) or unstable_cache; 500k-row scans per revalidation is the root of the blank-page problem.

## Verified working (no action)

- **/globe** — renders with live density, timeline, category chips; APIs healthy. P2 cosmetic: globe sits left with a large patterned void on the right at wide viewports; category chips wrap awkwardly near the Lights/Origins/Cities toggle.
- **/foreign-legislation** — works, but is an older sibling of /legislation (same data, no US, different UI, still offers global keyword search). Decide: fold its global search into /legislation and redirect, or rename nav labels ("Global Legislation" vs "Legislation" is confusing).
- **/claims** — works at 1.76M claims. P2: default `createdAt desc` ordering makes page 1 a wall of near-identical NARA photo captions; consider a per-pipeline diversified first page.
- **/historical-events, /books, /drug-arc, /analysis/topics, /analysis/representation, /stats** — no issues found. /drug-arc's funnel bars aren't proportional (46k approvals renders wider than 11k trials despite being "downstream") but the page footnotes this.
- **/analysis/retraction-lag** — works; P2: per-topic table repeats the same 11,323 pair count for broad topics (overlapping tags make absolute counts misleading; show % or distinct pairs).

## Suggested Lab graduations after this pass
/retraction-wall, /legislation, /analysis/votes, /drug-arc, /books are at or near production quality once the above land.
