# Build Brief #6 — Independent verification, the shapes of settling, and the open tails (site lane, read-only)

**To:** RobClaw / the Claude Code worker it dispatches on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-14)
**Lane:** site. **Zero database writes.** Same rails as Briefs #3–5.

**Why this brief looks different:** B3 (8 commits), B4 (5 commits), and B5 (4 phases) all merged to main within ~24 hours, executed by three different workers, each verifying its own homework. The standing doctrine (HANDOFF-OPENCLAW §"Verification is not self-attested") says that is the failure mode. So before the last new feature ships, this brief opens with an independent verification pass over everything that landed today — run by you, fresh, against the merged whole. Then it finishes the two deferred stretch phases (B4-4 shapes, B5-5 embed tail).

---

## 0. Gate + orientation

1. **Gate:** B3, B4, B5 all merged to main (`git log` should show all three lanes). If any is still an open branch, STOP and report.
2. `git fetch && git checkout main && git reset --hard origin/main`. Orientation: `git log --oneline -40`, CONSULTANT.md head + 2026-07 entries, the three reports in `briefs/` (b3, b4, b5) — this brief assumes their claims; your job in B6-1 is to check them.
3. Next.js 16 — `node_modules/next/dist/docs/` before route code. Known gotchas: `ClaimStatusHistory.markerSource`; never `next build` on the VPS; CSP `'unsafe-inline'` untouchable.
4. Branch `loop/site-b6-2026-07-14`, one commit per phase (`B6-n:`), ~400 lines/phase, push + PR, owner merges. Read-only SELECTs free; everything else on the standing rails (no writes, no schema, no nav items, no MATERIAL-QUEUE edits, no middleware beyond what B6-2 explicitly scopes, blocked beats invented).

## 1. B6-1 — Independent verification & hardening of today's merge

Work through this checklist against a dev server on the real DB **and** the Vercel production/preview deployment of current main. Every item gets a line in the report: PASS / FIXED (with commit) / FLAGGED (with why you didn't fix). Fixes here are hardening-sized — if something needs a redesign, FLAG it, don't build it.

**Surface checks (view-source / curl, not browser-only):**
- `/reversals` — four sections render with live counts; residue footnotes' numbers match the honesty ledger on `/settling-curve/coverage` (they were written by different phases — they must not disagree with each other or with MATERIAL-LOG).
- `/open-questions` — dormancy years match spot-checked `occurredAt` values (5 claims, direct DB query); recently-woken strip suppressed/rendered correctly per live data.
- `/split-ledger` — 5 Tier-1 claims spot-checked directly against the DB: per-community latest axes truly incompatible (the B4-1 tier logic, re-derived by you, not re-run from its script); Tier-2 labeled as stage-lag everywhere it appears.
- `/communities` — live counts sum sanely against `ClaimStatusHistory` totals; all exemplar slugs resolve.
- `/receipts/[id]` — pick 3 receipts (one DAY, one YEAR precision, one REVERSED): precision rendering honest, canonical + noindex present, OG image route returns an image, JSON-LD parses (paste into a validator or parse with node).
- Homepage OnThisDay — items match a direct month-day query; **timezone check:** the "today" it computes matches the site's convention and rolls at a sane hour (document which TZ it resolves in); confirm a YEAR-precision row cannot appear (query for one on today's month-day and verify absence).
- `/embed/trajectory/[slug]` from a different origin — renders in an iframe, no site chrome, no auth cookie set, framing headers present on `/embed/*` and absent elsewhere (re-run the B5-1 matrix from a clean client against the deployed site).
- `/api/badge/claim/[id].svg` — correct color for a REVERSED claim, gray-404 path works, cache headers present on the deployed response (CDN may rewrite them — verify what actually reaches the client).
- Anchors — `/claims/[id]#t-{seq}` scrolls to the right node on a multi-step claim.

**Code-level audits (grep, cheap, high-yield):**
- Stray hex audit: no new component carries hardcoded axis colors — everything traces to `lib/status.ts` (grep the components/pages added today for `#[0-9a-f]{6}` and justify every hit).
- Sitemap: `/open-questions`, `/split-ledger`, `/communities` present; `/receipts/*` and `/embed/*` absent; `app/sitemap.ts` and `app/sitemap.xml/route.ts` CHUNK logic still in sync.
- Metadata exports on every new page; `robots` noindex exactly where the briefs specified (receipts, embeds) and nowhere else.
- The two "pre-existing unrelated" TSC errors the B3–B5 reports mention: reproduce, identify, fix if each is ≤10 trivial lines, otherwise FLAG with file/line and cause.
- CONSULTANT.md discipline: if the B3/B4/B5 workers did not append changelog entries, write them now (one entry per brief, their standard format — what/files/why). Docs-only, expected, and required by the file's own header.

## 2. B6-2 — The launch diff (PUBLIC_ROUTES, owner-reviewable, one isolated commit)

`lib/publicEdition.ts` is deny-by-default: a page not listed in `PUBLIC_ROUTES` does not exist on the future public edition. Today's merges added `/embed` only. Produce **one isolated commit** adding the routes that should ship publicly at launch — the owner reviews this diff as the publish decision itself:

- Add: `/open-questions`, `/split-ledger`, `/communities`, plus `/reversals`, `/stories`, `/start-here`, `/feed` and any other reader-facing page from recent weeks that predates this list and is missing (audit the whole list against `app/`'s reader-facing pages; the commit message enumerates every addition).
- Decisions to present, not make: whether `/receipts/[id]` is public (recommend yes — receipts are the shareable atom; they're already noindex) and whether `/on-this-day`-style API/RSS routes need listing (API routes aren't gated by this list — say so in the report).
- Touch nothing else in the file. No env changes, no edition flip — that stays a PUBLISH-CHECKLIST owner action.

## 3. B6-3 — The shapes of settling (B4-4, carried — this is the feature build)

`lib/curve-shapes.ts`: pure, unit-tested classifier over the ordered `toAxis` sequence of every multi-step claim (≥2 transitions) → exactly one of: **monotone-settle** (reaches SETTLED, no direction change), **contested-then-settled** (passes through CONTESTED, ends SETTLED), **settle-then-reverse** (ends REVERSED after a SETTLED), **flip-flop** (≥2 direction changes), **abandoned** (ends ABANDONED), **other** (anything else — published, never hidden). Direction semantics: derive from the axis vocabulary in the schema/`lib/status.ts`, write them down in the module docstring, and unit-test the boundaries (vitest — e.g., RECORDED→SETTLED, RECORDED→CONTESTED→SETTLED, RECORDED→SETTLED→REVERSED, a 6-step flip-flop, single-step exclusion).

`app/patterns/page.tsx` (linked from the explorer, `/methodology`, and `/start-here` — not nav): per shape — definition in one sentence, **live count**, 3 exemplar rails (prefer curated trajectories where the shape has any; else pipeline claims — real ones, queried, never hand-picked from memory), and a deep link into the explorer filtered as close to the shape as existing filters allow (do not build a new explorer filter in this brief — FLAG it as the natural follow-up if counts justify it).

**The invariant that is the whole point:** the six counts sum exactly to the multi-step corpus count, and the page prints that equation ("38,412 + … + other 1,204 = 235,0xx multi-step claims" — real numbers from render-time queries). If the sum doesn't reconcile, that's a STOP-and-census, not a rounding note.

Performance: counting shapes requires scanning transition sequences — do it in one grouped query + in-memory classification if feasible; cache with ISR (`revalidate = 86400`); if render-time cost is prohibitive, FLAG and propose (don't build) a precomputed artifact — **no new tables, no writes**.

## 4. B6-4 — B5-5 tail (embeds finish)

- `/api/badge/trajectory/[slug].svg` — curated slugs only (same resolution as `/embed`), shows the trajectory's latest axis + year; same escaping/caching/404 rules as the claim badge. Already public via the `/api/badge/` carve-out — no middleware change needed or permitted.
- `/api/oembed?url=<trajectory-or-story-url>` — oEmbed JSON (`type: "rich"`) wrapping the iframe snippet; `<link rel="alternate" type="application/json+oembed">` on trajectory + story pages. Validate the `url` param against this site's origin + known route shapes; reject everything else (no open redirector/SSRF surface — it's a lookup, not a fetch).
- `/docs/api` — an "Embeds & badges" section documenting iframe, badge, and oEmbed usage with the same snippets `EmbedButton` emits (one source for snippet text if practical).

## 5. Out of scope

Nav-trim, homepage-convergence, follow-UI (RobClaw's queue, not this lane); the SCALING /v1 track (separate engagement, specs 00–50); edition flips or env changes; analytics; any DB write; any middleware change beyond zero (B6-2 touches `lib/publicEdition.ts` only).

## 6. Verification

`npx tsc --noEmit` (report delta vs the two known errors); ESLint clean on touched files; `npx vitest run` green including the new classifier tests; the B6-1 checklist complete with PASS/FIXED/FLAGGED per line; `/patterns` reconciliation equation verified against a direct count query; Vercel preview green.

## 7. Report

`briefs/2026-07-14-b6-report.md` on the branch: the full B6-1 checklist results; the B6-2 diff pasted verbatim + the two decisions presented; the shapes census table (per-shape counts + the reconciliation line); B6-4 endpoints with sample responses; anomalies (especially any place today's three briefs disagree with each other or with the DB — those are the finds this brief exists for).

## 8. STOP conditions

Shapes partition failing to reconcile; a B6-1 check revealing a data-rendering error you can't fix in hardening scope (FLAG, don't redesign); PUBLIC_ROUTES pressure beyond the enumerated additions; any write about to happen; two consecutive failures on one acceptance criterion. Blocked beats invented.
