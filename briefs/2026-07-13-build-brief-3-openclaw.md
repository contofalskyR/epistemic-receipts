# Build Brief #3 — Surface the receipts (site lane, read-only)

**To:** RobClaw / the Claude Code worker it dispatches on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-13)
**Lane:** site. **This brief authorizes zero database writes.** Every feature below is a read-only surface over transitions that already exist in Neon.

This brief is self-contained — you do not need any other document to execute it. It was derived from `briefs/2026-07-13-site-build-ideas.md` if you want the reasoning.

---

## 0. Orientation (do this before any code)

1. `git fetch && git checkout main && git reset --hard origin/main` — your clone must include `643358f` (D1–D4 domain rollout) or later.
2. `git log --oneline -25`; first ~120 lines of `CONSULTANT.md`, then its 2026-07 entries; `briefings/10-HANDOFF.md` for the state contract. Where memory and git disagree, git wins.
3. Next.js here is **16** — APIs may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing page/route code (`AGENTS.md`, top rule).
4. Reuse points you will need, all already on main: `lib/status.ts` (canonical axis colors/labels — the ONLY place they live), `lib/og-shared.tsx` (OG rendering, re-exports from status), `app/components/DomainCurveRail.tsx` (accepts `trajectoryIds` and pipeline lookups), `components/TrajectoryDepth.tsx`, `app/settling-curve/SettlingCurve.tsx` (per-community lane rendering), `components/CitationButton.tsx`, `lib/non-english-pipelines.ts`, `lib/claim-detail.ts` (cold-crawl hot path — full statusHistory now selected), `app/api/retractions/rss/route.ts` (RSS template), `app/sitemap.ts` + `app/sitemap.xml/route.ts` (keep CHUNK logic in sync if touched).

## 1. Authorization & hard rails

- Implement on branch, push, open PR (or report the branch if `gh` is unavailable). **No merge. No production deploy. No DB writes of any kind** — no INSERT/UPDATE/DELETE, no `--execute`, no seed scripts, no `ALLOW_EDITS`. Read-only SELECTs, branches, and PRs are free (data doctrine §1).
- If any phase seems to need a write (cache table, backfill, materialized count) — it doesn't. Compute at request time with ISR, or STOP and put a decision brief in the report.
- Never fabricate data or dates. Every date, name, count, and status rendered must come from DB rows or repo files. Training-data recall is not a source — this repo's founding cautionary tale is Pipeline 5.
- Raw SQL (if Prisma can't express a query): bind-parameterized only (`$1..$n`).
- Copy discipline: the product measures fact-STATUS, not truth. REVERSED by a legislature is a repeal; REVERSED in literature is a retraction/contradiction — never flatten communities into "debunked." Precision-aware dates: a YEAR-precision row never renders an invented day.
- No new top-level nav items (nav-trim is queued separately). Wire new pages via contextual links + sitemap.
- Do not edit `MATERIAL-QUEUE.md` (RobClaw-managed, tick-only). Note queue-relevant facts in your report instead.
- One branch: `loop/site-b3-2026-07-13`. One commit per phase, message prefixed `B3-n:`. ~400 changed lines per phase is the drift ceiling — split a commit before exceeding it.

## 2. Phases

Execute in order. Before each phase: verify its premises against the repo and DB (the AA-1 lesson — if the surface already exists or counts diverge wildly from what a phase assumes, STOP that phase, record why in the report, continue to the next).

### B3-0 — Preflight census (read-only, no UI)

Write `scripts/b3-preflight.ts` (read-only; follow the `scripts/verify-domain-trajectories.ts` guard-script pattern) that prints:

1. REVERSED claims grouped by `ClaimStatusHistory.community`, and within each community by `Claim.ingestedBy` (top 15).
2. Count of transitions with `datePrecision = 'DAY'`, plus counts for 3 sample month-days (e.g. 01-15, 07-13, 11-02) — split curated/multi-step vs. single-step.
3. Claims currently stamped `epistemicAxis = 'CONTESTED'` (excluding soft-deleted / DEPRECATED per existing query conventions): count + the 10 oldest `MAX(occurredAt)` values.
4. Claims whose history spans ≥2 distinct communities; of those, how many have divergent latest `toAxis` per community.

Paste the full output into the PR body and the report. **These numbers gate everything below — a surprising number is a stop sign, not a thing to push past.** Acceptance: script runs clean on a read connection; no writes anywhere in it.

### B3-1 — Quick wins

a. **"Moved this month" strip** on the 11 mapped domain pages (`medicine`, `pharmacology`, `public-health`, `earth-sciences`, `geology`, `physics`, `chemistry`, `environmental-science`, `astronomy`, `law`, `history`). A small async server component (new, e.g. `app/components/DomainRecentMoves.tsx`) rendering the ~5 most recent status transitions for that domain's pipelines/topics in the last 30 days — reuse the feed's recency queries and the D2 server wrappers. Empty month → render nothing (no invented activity, no empty chrome; same rule as D-4).
b. **Honesty ledger on `/settling-curve/coverage`**: add a "Known residues" section stating, with live counts where queryable and doc-sourced counts otherwise: the single-step retraction residue (~8,344 per MATERIAL-LOG 2026-07-11), the 2 unparsed FDA DATES-variant notices, the hyphenated-NDA (`no-application-numbers`) residue, the 5 blocked C1 seed rows (MATERIAL-LOG 2026-07-12). Each line links `/corrections` or names the log it traces to. This is internal discipline made public — copy stays factual, no self-congratulation.
c. **Cite-this-curve**: extend `CitationButton` usage to story pages and trajectory detail pages (plain-text + BibTeX with accessed-date). No new component if the existing one composes.

Acceptance: strips render server-side (view-source shows content) on at least `/medicine` and `/law` in dev; coverage section matches B3-0/doc counts; citation button present on `/stories/h-pylori` and one trajectory page.

### B3-2 — On this day

New module surfaced in two places: a strip on the homepage and a section on `/feed` (no new route needed; add one only if composition demands it, and then link it from `/feed`, not nav).

- Query: transitions + threshold events whose dated field matches today's month-day, **`datePrecision = 'DAY'` only** — that WHERE clause is the entire honesty guard; no YEAR/MONTH rows, ever.
- Default-exclude non-English pipelines via `lib/non-english-pipelines.ts` (same default as feed).
- Rank curated/multi-step claims first (`externalId` `trajectory:` prefix, then multi-step, then the rest); cap ~8 items; ISR `revalidate = 3600` so the date rolls without a deploy. Compute "today" server-side in a fixed TZ (site convention — check how `/feed` does it; be consistent).
- Optional, only if trivial: `app/api/on-this-day/rss/route.ts` cloned from the retractions RSS pattern.

Acceptance: view-source on `/` shows today's items with real dates; a day with no DAY-precision matches renders nothing (verify by querying a sparse month-day from B3-0 output and temporarily overriding the date in dev — do not ship the override).

### B3-3 — Reversal Index (the flagship)

Extend `/reversals` from courts-only into the site's reversal hub, sectioned **by ratifying community** (the section list comes from B3-0's community grouping, not from this brief's guesses):

- **JUDICIAL** — keep today's curated arcs + rail exactly as shipped; it becomes the first section.
- **INSTITUTIONAL** (expected: FDA withdrawals on `drugsatfda_v1`, 267 transitions written 2026-07-11 — Bextra, Iressa, Meridia, Mylotarg, Opana ER, the Actavis mega-notice) — section with a curve rail of the strongest arcs + count + link into the explorer filtered to the pipeline.
- **EXPERT_LITERATURE** (expected: retraction arcs — wave-2 on `crossref_retractions_v1`, the 2026-07-09 OpenAlex↔CrossRef join arcs) — same treatment; link `/retraction-explorer` for the record-level view.
- **Legislative repeals** (expected: `nz_repealed_acts_v1`, 442 arcs) — same treatment; copy must say *repealed*, not overturned/falsified.

Mechanics: server component sections reusing `DomainCurveRail`/`SettlingCurve` pieces and `lib/status.ts`; per-section counts from live queries; a community with zero REVERSED arcs gets no section (nothing invented). Update the page's metadata/description from courts-only to the hub framing. **Residue labeling is part of the feature:** where a section shows a count, footnote the known residue for that corpus (from B3-1b) so the number never overclaims.

Acceptance: view-source shows all sections with real claim text; every rendered arc's REVERSED transition exists in the DB (spot-check 5 across sections against `/claims/[id]`); ISR consistent with current page; ESLint `no-html-link-for-pages` clean (use `Link`).

### B3-4 — Receipt permalinks + receipt cards

The product is named after receipts; give each transition a URL.

- Anchors: every transition node in the claim-page timeline gets `id="t-{seq}"` and a copy-link affordance (`/claims/[id]#t-{seq}`).
- Route `/receipts/[id]` where `[id]` is the `ClaimStatusHistory` PK (confirm the field name in `prisma/schema.prisma` — do not guess): renders claim text, `fromAxis → toAxis` in canonical colors, date at recorded precision, ratifying community, triggering source (linked), and "step k of n" position. 404 cleanly on unknown/soft-deleted parents.
- OG image per receipt via a matching `opengraph-image` (or route) built on `lib/og-shared.tsx` — the card IS the transition.
- Crawl posture v1: `robots: noindex` on receipt pages + `rel=canonical` to the parent claim page; no sitemap entries. (Indexing curated receipts is a later decision — keep v1 conservative; the sitemap's multi-step-only precedent is the guiding rule.)
- Watch the hot path: `lib/claim-detail.ts` is the documented cold-crawl hot path — the receipts route should do its own narrow query, not widen that one.

Acceptance: a receipt URL for one transition of a curated claim (pick from `/stories/smoking-lung-cancer`'s trajectory) renders correct data and OG meta in view-source; anchor deep-link scrolls to the node; YEAR-precision receipt shows year-only rendering; `noindex` present.

### B3-5 — Open questions (dormancy leaderboard)

New page `/open-questions` (linked from `/start-here`, the explorer, and `/feed` — not nav):

- Claims stamped `epistemicAxis = 'CONTESTED'`, ranked by time since `MAX(occurredAt)`; the `@@index([claimId, community, occurredAt])` covers it. Exclude soft-deleted/DEPRECATED per existing conventions.
- Each row: claim text (via existing card components), `TrajectoryDepth`, "contested for N yrs · no new activity" — dormancy label copy matches `specs/SPEC-adaptive-claim-timeline.md` exactly; dormancy is information, not a defect.
- Companion strip: "recently woken" — long-dormant claims (≥5 yrs) whose latest transition is <90 days old. If B3-0 shows this set is empty, omit the strip (no manufactured drama).
- **Build the queries in a small `lib/dormancy.ts`** — the queued settling-curve-lifetimes finding will consume the same module; one source of truth so page and finding can't disagree.
- No prediction language anywhere — "longest contested," never "likely to settle."

Acceptance: page SSRs with real claims and correct year math against spot-checked `occurredAt` values; added to `app/sitemap.ts` static list; metadata export present.

### B3-6 — Split ledger, step 0 ONLY (no page)

From B3-0 item 4: write `scripts/count-community-divergence.ts` (read-only) producing the decision data — claims with ≥2 communities, the divergent subset, a breakdown of which community-pairs diverge, and 10 sample claim IDs with their per-community latest axes. Put the output + a ≤half-page recommendation (index page vs. curated shelf) in the report. **Do not build the page** — the owner decides its form from the counts.

### B3-7 — STRETCH (only if B3-1…6 are green and budget remains): shapes of settling

`lib/curve-shapes.ts`: pure classifier over ordered `toAxis` sequences of multi-step claims → {monotone-settle, contested-then-settled, settle-then-reverse, flip-flop (≥2 direction changes), abandoned, other}. Page `/patterns`: definition + live count + 3 exemplar rails per shape, deep links into the explorer. **The partition must sum to the multi-step corpus — "other" is published, never hidden.** If you can't finish cleanly, ship nothing for this phase; a half-built taxonomy page is worse than none.

## 3. Explicitly out of scope

Embeds/badges (blocked on a middleware/public-edition owner decision), adaptive timeline and follow-UI (queued separately, `specs/SPEC-adaptive-claim-timeline.md`), homepage convergence, nav changes, anything touching `middleware.ts`/auth/CSP (`'unsafe-inline'` stays — see CONSULTANT.md), schema changes, MATERIAL-QUEUE edits, and any DB write. AA-3/AA-4 already merged (2026-07-11/12) — do not rebuild them.

## 4. Verification (every phase, before its commit)

- `npx tsc --noEmit` exit 0; ESLint clean on touched files; `npx vitest run` (unit config) green.
- **Do not run `next build` on the VPS** — it SIGKILLs there (pre-existing memory limit, documented in CONSULTANT.md 2026-07-06). Vercel's preview build on branch push is the real build check; confirm it goes green.
- SSR checks via dev server: `curl -s localhost:3000/<page> | grep` for real claim text (the D-2 verification pattern).
- Spot-check rendered facts against the DB with direct read queries — never against a script's own output.

## 5. Reporting

Finish with one owner report (append a section to the next owner brief, or a standalone `briefs/2026-07-13-b3-report.md` on the branch): per phase — done/stopped, the B3-0 census output, the B3-6 recommendation, Vercel preview URL, spot-check results, residues/anomalies found, and the two queue notes (AA-3/AA-4 stale entries; new surfaces suggested for the site lane list). Batch decisions; never a bare URL + "land?".

## 6. STOP conditions

Any DB write about to happen; a phase premise contradicted by the DB (missing arcs, empty communities, counts wildly off B3-0); a need to touch middleware/auth/schema; two consecutive failures on the same acceptance criterion (halt that phase, brief, move on — never quietly retry a third time); anything that would require inventing a date, source, or claim to look complete. Blocked beats invented.
