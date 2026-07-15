# B11 resume — Fable worker prompt (post-census, owner decisions applied)

**To:** Fable, on `epistemic-receipts`. Read `fable-handoff-2026-07-15.md` in the workspace first, then `briefs/b11-report.md` (your census + the MemberIdeology addendum), then `briefs/2026-07-14-build-brief-11-members-ideology.md` for the standing rails. Where they disagree on repo state, the handoff wins. This prompt turns the owner's two decisions into execution order.

**Owner decisions on record (2026-07-15):**
1. MemberIdeology migration + HSall_members.csv ingest: **GO**, conditions below.
2. Landmark subset: **HYBRID** — curated landmark list (~200–400 rollcalls, sourced per the AGENTS.md verifiable-list rule) PLUS all <0.5%-margin votes, dedup, cap ~1,500. Margin-only rejected (misses Civil Rights Act 73–27, AUMF 98–0). The historical-event linker stays as-is; it is not a landmark criterion.

**Standing rails (unchanged):** every DB write dry-run by default behind `--execute`; each execute needs its own owner yes (merge ≠ execute); bind-parameterized SQL; deterministic ids; DB-verified counts after every write; exact ICPSR/bioguide joins only — no fuzzy member matching, ever; the corpus promoter loop on the owner's Mac is untouchable — STOP on lock contention; branch per workstream (`loop/votes-b11a/-b11b/-b11c-<date>`), push + PR, owner merges. Blocked beats invented.

Three workstreams. A and C are independent; B builds in parallel with A but its data dependency is handled by design (see B). RobClaw decides parallel-vs-sequential dispatch; parallel workers use separate worktrees.

---

## Workstream A — MemberIdeology ingest (owner-gated writes)

1. **Download** `HSall_members.csv` from voteview.com (live fetch — record exact URL, date, and sha256 in the run log AND in row metadata provenance). Inspect the real header; derive the schema from what the file actually contains, not from memory.
2. **Migration (additive only):** `MemberIdeology` table — at minimum icpsr, congress, chamber, nominate_dim1, nominate_dim2, party code, state, plus a metadata Json for provenance (source URL + file hash) and the Nokken-Poole variants if present (metadata only — UI surfaces standard DW-NOMINATE exclusively). Unique key: derive from observed uniqueness in the file (expect icpsr+congress+chamber) and prove it empirically (count distinct vs rows) before writing the migration. Nothing else rides in this migration.
3. **Migration window:** the promoter loop holds DB connections and the Neon pooler has the documented advisory-lock issue. Prepare everything, then **ping the owner for a window** — he pauses the loop himself; you never touch it. `prisma migrate deploy` only inside the confirmed window; verify with `prisma migrate status`.
4. **Ingest script** (`scripts/ingest-member-ideology.ts`): dry-run default; deterministic id `${icpsr}-${congress}-${chamber}`; idempotent upsert; resumable (cursor file — assume the run can be killed mid-flight); `--pilot 25` mode.
5. **Chain:** dry-run counts → pilot 25 → verify pilot rows **word-for-word against the CSV** (paste 5 in the checkpoint memo) → CHECKPOINT memo (target row count, the exact command) → **owner yes** → full run → DB-verified count vs CSV row count, discrepancies itemized.
6. **Join sanity (read-only):** verify the join key between MemberIdeology and the existing member entities (`/members` uses which id — ICPSR? bioguide? the CSV carries both). Report join coverage: % of the 12k member pages that will resolve an ideology row. No fixups — just the number.

## Workstream B — DW-NOMINATE UI (build now, honest-empty until data lands)

Build the B11-2 UI per the original brief: ideology placement on `[memberId]` pages (dim1 economic axis with era context), a per-Congress caucus scatter/distribution on `/analysis`, score column in the members table. Every chart labels "DW-NOMINATE via Voteview" + its coverage denominator.

**The deploy-order rule, made structural:** every component queries MemberIdeology and **renders nothing when no row exists** (the D-4 empty-state pattern — no empty chrome, no placeholder axes). That makes the UI safe to merge before, during, or after the ingest; the owner's "don't deploy until counts verified" is then belt-and-suspenders, not a coordination problem. PR may merge on owner's call; the pages simply light up when Workstream A's data lands.

## Workstream C — Landmark subset + MemberVote enrichment (owner-gated writes)

1. **Curated list assembly (the sourcing rule is the whole game):** build the landmark list FROM fetchable records — retrieve cited landmark-legislation lists (e.g., Wikipedia's landmark US legislation article with citations, govtrack historic bills), extract acts, then **map each act to specific Voteview rollcall ids by querying the DB** (congress + bill number + passage/cloture vote types). Training-data recall is not a source (Pipeline-5 rule): if you can't map an act to a rollcall via records, it's skipped-and-counted, never guessed. Spot-check anchors against live roll-call pages before proceeding: Civil Rights Act 1964, Voting Rights Act 1965, ACA 2010, AUMF 2001, plus one veto override.
2. **Margin sweep:** all voteview_v1 rollcalls with margin <0.5% (state the exact formula used).
3. **The subset artifact:** dedup, cap ~1,500; commit `data/landmark-rollcalls.json` — one entry per rollcall with inclusion reason (`landmark: <act, source URL>` / `margin: <value>`) — this file is what the UI's denominator labels will cite. Report final size before any enrichment.
4. **Enrichment run:** `enrich-member-votes.ts` (already fixed, 100% on congress_votes_v1) over the subset — pilot 25 → 5 spot-checks word-for-word vs live XML → CHECKPOINT memo (final subset size, fetch count, runtime estimate, residue policy: unfetchable = skipped-and-counted) → **owner yes** → full landmark run → DB-verified MemberVote counts + residue log.
5. **Close with the memo the brief requires:** the full-113k cost/value memo (fetch count, runtime, storage, what it unlocks vs. what the landmark subset already delivers). That decision stays open — do not start the full corpus.

## Report

Append to `briefs/b11-report.md`: per-workstream status, the checkpoint memos + owner yeses as recorded, final counts (MemberIdeology rows, join coverage %, subset size, MemberVote rows written, residue), the 113k memo, and anything the census got wrong that execution revealed.

## STOP conditions

Any write without its own recorded yes; migration outside the confirmed window; a landmark entry that can't trace to a fetchable record; fuzzy member matching anywhere; subset drifting past ~1,500 without owner sign-off; promoter-loop contention; two consecutive failures on one criterion. Blocked beats invented.
