# New build ideas — site surfaces (2026-07-13)

**What this is.** A scan for *new* things to build, run after the D1–D4 domain rollout. Sources: git log through `0f85096` (local) + the D1–D4 intro doc (origin is one commit ahead of the local checkout — `git pull` when convenient), CONSULTANT.md (2026-07-06 DB audit), MATERIAL-QUEUE/LOG through 07-12, briefings 00–19, specs/BUILD-STATUS.md, ROADMAP.md, and the app/ tree itself.

**Filter applied.** Each idea (1) is not already built, queued in MATERIAL-QUEUE, specced in specs/, or claimed on a roadmap; (2) runs entirely on data already in the DB — no new ingest, no mass writes; (3) survives the prime directive: nothing here invents a transition, a date, or a disagreement.

**Housekeeping notes from the scan**
- MATERIAL-QUEUE still lists AA-3 (h-pylori story) and AA-4 (/reversals page) as "queued, next-run," but both merged to main on 07-11/07-12 (`e2c093b`, `4753336`, merge commits `6c39c9f`/`dc5ef6c`). Queue is stale — worth ticking off.
- Local main is at `0f85096` (P2-11); the D1–D4 commit (`643358f`) is on origin only.

---

## Already claimed — deliberately not re-proposed

| Item | Where it's claimed |
|---|---|
| Adaptive claim timeline | `specs/SPEC-adaptive-claim-timeline.md` — full spec, queued in MATERIAL-QUEUE (site) |
| Follow UI, nav trim, homepage convergence | MATERIAL-QUEUE (site) |
| Moved-this-week digest, settling-curve lifetimes, retraction lag, US law-reversals data | MATERIAL-QUEUE (findings) |
| /v1 API, billing, MCP server, eval product, accounts, researcher features, litigation workbench | specs 20–40 track (20 in progress) |
| Search embedding activation | spec 50 merged — blocked on owner actions (OPENAI key + backfill), not on new build |
| Person pages, DW-NOMINATE, STOCK Act expansion, V-Dem, CourtListener opinion bodies | ROADMAP (Opus brainstorm + long-horizon) — known heavies |
| Quiet reversals assembly line | briefing 06 (data pipeline, human-gated) |
| OFAC delistings pipeline | briefing 16 — spec ready |

---

## Ranked ideas

### 1. Turn `/reversals` into the cross-community Reversal Index

**What.** `/reversals` is currently courts-only (8 curated + 11 pipeline JUDICIAL arcs). Extend it into the site's reversal hub with one tab or section per ratifying community:

- **Courts** — what's there today.
- **Medicine** — the 267 SETTLED→REVERSED FDA withdrawal-of-approval transitions written 2026-07-11 (`drugsatfda_v1`): Bextra, Iressa, Meridia, Mylotarg, Opana ER, the Actavis acetaminophen mega-notice. Zero UI surfaces these today; `/drug-arc` only traces trials→approval.
- **Science** — the 5,525 OpenAlex↔CrossRef RECORDED→REVERSED arcs (07-09) + 18,280 wave-2 retraction curves. `/retraction-explorer` shows retracted papers as records; nothing shows them *as arcs*.
- **Law (repeals)** — the 442 NZ repealed-acts SETTLED→REVERSED arcs (07-08), plus future OFAC delistings when briefing 16 runs.

**Why now.** This is the freshest corpus work in the DB, days old, all invisible. Reversals are the product's most legible proof that status ≠ truth — and the site already owns the URL.

**Build sketch.** Reuse `DomainCurveRail` (it already accepts trajectory slugs *and* pipeline lookups), `lib/status.ts`, `TrajectoryDepth`. Per-community sections are queries over `ClaimStatusHistory WHERE toAxis='REVERSED'` grouped by pipeline. Cap each section, link into the explorer for the tail.

**Honesty guards.** Surface only arcs already written — no backfilling to fatten a section. Label known residues in-line where counts are shown: the 2 unparsed FDA notices + hyphenated-NDA residue (MATERIAL-LOG 07-11), the 8,344 single-step retraction residue (wave-2 postmortem). Use per-community language: a repealed act is REVERSED by a legislature, not "falsified"; the copy should never flatten that.

**Effort.** Medium — mostly composition of existing components. **Nav cost:** zero (page exists).

---

### 2. Receipt permalinks + receipt cards

**What.** The product is named after receipts; individual receipts have no URL. Give every `ClaimStatusHistory` row (or at minimum every transition on curated/multi-step claims) a stable anchor and a shareable card:

- `/claims/[id]#t-{seq}` anchors on every timeline node, with a copy-link affordance.
- A `/receipts/[historyId]` permalink page: claim text, `fromAxis → toAxis` in canonical colors, date rendered at its recorded precision, ratifying community, the triggering source with link, and "step 3 of 5" position in the curve.
- An OG image per receipt (reuse `lib/og-shared.tsx`) so a receipt pasted into a tweet/Slack/paper renders as the transition itself.
- Optional integrity touch: canonical JSON of the transition + SHA-256 shown on the card — "cite this exact move."

**Why now.** Stories, whitepaper, and substack drafts all *describe* transitions; nothing lets a reader point at one. This is the atomic share/cite object, and it's what makes the "receipts" claim literal. Cheap distribution before launch.

**Build sketch.** One route + one OG route + anchors in `ClaimTimeline`. All data already on the claim-detail query path (`lib/claim-detail.ts` now selects full history).

**Honesty guards.** Precision-aware rendering (YEAR-precision dates never display an invented day — same rule as the adaptive-timeline spec). Follow the sitemap precedent: index receipt pages for curated/multi-step claims only; `noindex` the long tail to protect crawl budget.

**Effort.** Small–medium.

---

### 3. Split ledger — where communities disagree

**What.** A surface for claims whose history spans ≥2 ratifying communities with *divergent* latest states — literature SETTLED while courts CONTESTED, institution SETTLED while literature REVERSED, etc. Two parts:

- `/split-ledger` (or a section under the explorer): list of divergent claims, each rendered with the explorer's existing per-community lanes.
- A short `/communities` explainer: the five communities, what ratification means for each, transition counts per community, one exemplar arc each.

**Why now.** Community-relative status is the thesis — the schema has carried `community` on every transition since the start, the explorer already draws community lanes, but nothing lets a reader *find* the disagreements. No competitor primitive looks like this.

**Build sketch.** Step 0 is a read-only guard script (same pattern as `scripts/verify-domain-trajectories.ts`): count claims with ≥2 distinct communities, then count those whose per-community latest `toAxis` diverges. If the divergent set is rich, it's an index page; if it's thin, it's a curated shelf of the real cases — honest either way, and the count decides. Lane rendering is already built in `SettlingCurve.tsx`.

**Honesty guards.** Never synthesize disagreement: divergence must come from existing rows, and "different communities, same state" is excluded. Copy explains that absence of a community's row means *unrecorded*, not agreement.

**Effort.** Medium (step 0 is an hour; the page is composition).

---

### 4. On this day

**What.** A daily anniversary surface: transitions and threshold events whose `occurredAt` matches today's month-day, DAY-precision only. "On July 13: X settled (1985), Y was reversed (2009), Z was enacted (2021)." Render as a homepage strip + a `/feed` section; optionally an RSS route alongside the existing retractions RSS.

**Why now.** The corpus is dated to the day across ~1.63M transitions and 3,888 threshold events — call it ~10 threshold events and thousands of transitions per calendar day on average. It's the cheapest daily-changing content the site can have, it compounds with the queued moved-this-week digest without overlapping it (history vs. recency), and it's newsletter/social fodder every single day.

**Build sketch.** One indexed query filtered on `datePrecision = 'DAY'` and month-day extraction, ISR revalidate daily, weight curated/multi-step claims first. ~A day of work.

**Honesty guards.** DAY precision only — a YEAR-precision row must never appear on a specific day. That's one WHERE clause, and it's the whole guard.

**Effort.** Small. Highest retention-per-effort on this list.

---

### 5. The shapes of settling — pattern taxonomy page

**What.** Classify the ~235k multi-step curves by the shape of their `toAxis` sequence and give the taxonomy a page (`/patterns` or under methodology):

- monotone settle (RECORDED→SETTLED via CONTESTED or not)
- contested-then-settled
- settle-then-reverse
- flip-flop (≥2 direction changes)
- abandoned

Each shape: a definition, the live count, three exemplar rails, and a deep link into the explorer pre-filtered to that shape.

**Why now.** The stories pages each narrate one shape; this page shows the shapes *as a population* — the "settling curve" concept made systematic. It's Figure-2 material for the whitepaper and the cogsci pitch, and it gives the explorer its next filter (depth exists; shape doesn't).

**Build sketch.** A pure classifier over ordered `toAxis` sequences (read + compute, cacheable to a JSON artifact or a nightly ISR page). No schema change.

**Honesty guards.** Publish the full partition including "other/unclassifiable" — the taxonomy must sum to the corpus, not curate it. Counts come from the classifier run, never rounded up.

**Effort.** Medium.

---

### 6. Open questions — dormancy leaderboard

**What.** `/open-questions`: claims currently stamped CONTESTED, ranked by time since their last transition — "contested for 41 years and counting" — with a companion strip of "recently woken" claims (long dormancy, then a fresh transition). Filterable by field via existing topic/domain mappings.

**Why now.** The site is strong on things that settled; it has no surface for the *unresolved*. Dormancy-is-information is already doctrine (the adaptive-timeline spec encodes it per-claim); this aggregates it corpus-wide. Journalists and researchers query exactly this.

**Build sketch.** `epistemicAxis = 'CONTESTED'` joined to `MAX(occurredAt)` per claim — the `@@index([claimId, community, occurredAt])` covers it. Reuse claim cards + `TrajectoryDepth`.

**Coordination note.** The queued settling-curve-lifetimes finding shares these queries (it feeds homepage Fig. 1) — build them on one query module so the finding and the page can't disagree.

**Honesty guards.** "Longest contested" framing only — no implied prediction of resolution. Dormancy label copy matches the spec's: "N yrs · no new activity."

**Effort.** Small–medium.

---

### 7. Embeddable curves + live status badges

**What.** Two distribution primitives:

- `/embed/trajectory/[slug]` — a minimal iframe-able curve (SVG rail + attribution + link back), for substack posts, docs, and other people's blogs.
- `/api/badge/[claimId].svg` — a shields-style badge that renders the claim's *live* axis: "SETTLED · since 2017 · Epistemic Receipts." For READMEs, papers, wikis. Every embed is a backlink.

**Why now.** The substack articles and marketing docs are written; when they go out, there's currently nothing an external author can paste that stays live. Badges make third-party pages update when the DB does — which is the product pitch in miniature.

**Build sketch.** The SVG curve renderer already exists server-side (OG images, curve rails). Badge route is a tiny SVG template over one claim query, `Cache-Control` ≤1h.

**Dependency (real one).** The site is password-gated pre-launch — embeds/badges need a middleware allowlist for these two routes, or they ship with the public edition (PUBLISH-CHECKLIST ops). Decide that first; it's the only blocker.

**Honesty guards.** Badges render current stamped axis + as-of date, nothing else — no derived "confidence score" invented for the badge format.

**Effort.** Medium.

---

### 8. Quick-wins shelf (each < half a day)

- **"Moved this month" strips on the 11 mapped domain pages** — the D2 server wrappers make this a drop-in section; query = feed's recent-transitions filtered by the domain's pipelines/topics. Gives the field guides a pulse between visits.
- **Honesty ledger upgrade to `/settling-curve/coverage`** — the page already breaks down status/community/domain/century; add the per-pipeline residue disclosures that currently live only in MATERIAL-LOG (8,344 retraction residue, 2 unparsed FDA notices, 5 blocked C1 seed rows) with links to `/corrections`. Turns internal discipline into public trust surface.
- **Cite-this-curve on stories and trajectory pages** — `CitationButton` exists on claims; extend it to story/trajectory pages with BibTeX + accessed-date, feeding the academic audience the whitepaper targets.

---

## Not proposing, on principle

Mass "curve completion" of the 1.4M single-step claims, synthetic intermediate transitions to make shapes prettier, any surface implying communities disagree where rows don't exist, and prediction features ("will this settle?") — all fail the prime directive. The list above only re-arranges light over transitions that are already real, dated, and sourced.

## Suggested sequencing if this becomes Build Brief #3

Day 1–2: #4 (on this day) + #8 quick wins — visible motion, zero risk.
Day 3–5: #1 (Reversal Index) — the flagship, all data ready.
Week 2: #2 (receipts) + #6 (open questions), then #3's step-0 count to decide the split ledger's form. #5 and #7 slot in behind whichever of those lands fastest; #7 waits on the middleware/public-edition call.
