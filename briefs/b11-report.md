# B11 Report — Members & Ideology: Voteview Layer

**Branch:** `loop/votes-b11-2026-07-15`  
**Date:** 2026-07-15  
**Lane:** votes/data+UI

---

## B11-1 Census — Results

### What `/members/[memberId]` renders today

Sourced exclusively from `MemberVote → LegislativeVote → Source`.

Current stats shown per member page:
- Member name, state, party (most recent affiliation)
- Total votes (yea/nay counts)
- Party unity % (SQL-computed over decided partisan votes)
- Chamber breakdown
- Paginated vote history (50/page, ordered by voteDate desc)

**Coverage constraint:** Since `voteview_v1` has 0 MemberVote rows, `/members` pages
currently show only `congress_votes_v1` members (US House/Senate bioguide IDs) and EU
Parliament members (howtheyvote_eu). No historical Congress members are reachable via URL.

---

### DW-NOMINATE Ideology Scores — VERDICT: NOT IN DB

**Brief premise:** "Does `ingest-voteview.ts` already capture `nominate_dim1/dim2`? Count rows carrying scores."

**Finding:** DW-NOMINATE member ideology scores are **not stored anywhere** in the database.

Evidence:
1. `ingest-voteview.ts` reads `nominate_mid_1`, `nominate_mid_2`, `nominate_spread_1`,
   `nominate_spread_2`, `nominate_log_likelihood` from `HSall_rollcalls.csv` but stores
   **none of them** — the parsed `RollcallRow` fields are discarded after `buildTitle()`.
2. The `LegislativeVote`, `MemberVote`, `Source`, and `Claim` schema models have **no
   NOMINATE columns**.
3. Query against all 113,319 voteview claims: `0` rows contain "nominate" in metadata.
4. **Critical distinction:** The fields read from the rollcall CSV (`nominate_mid_1/2`) are
   **vote-level cutting-line midpoints**, not member ideology positions. Member-level
   DW-NOMINATE scores (dim1/dim2 per member per Congress) live in a separate dataset:
   `HSall_members.csv` — which has **never been downloaded or ingested**.

**B11-2 verdict: STOP.** Per brief instructions: "If NOT stored: STOP. Write a one-page
ingest addendum. Do not proceed to B11-3 without owner approval of the ingest."

See §"DW-NOMINATE Ingest Addendum" below.

---

### MemberVote Coverage — Verified

| Pipeline | LegislativeVotes | MemberVote rows | Coverage |
|----------|-----------------|-----------------|----------|
| `howtheyvote_eu` | 1,900 | 1,348,631 | 100% |
| `congress_votes_v1` | 505 | 104,550 | 100% |
| `eu_parliament_votes_v2` | 24,224 | 0 | 0% |
| `openparliament` | 374 | 0 | 0% |
| `uk-parliament` | 169 | 0 | 0% |
| **`voteview_v1`** | **113,319** | **0** | **0%** |
| **Total** | **140,491** | **1,453,181** | — |

Brief premises confirmed:
- `congress_votes_v1`: 505 LegislativeVotes, 104,550 MemberVote rows ✓
- `howtheyvote_eu`: ~1,900 LV, 1,348,631 MV ✓ (brief said 1,900 / "1.35M rows")
- `voteview_v1`: 0 MemberVote rows ✓

---

### Landmark Subset — PREMISE CONTRADICTION ⚠️

**Brief estimate:** 500–1,500 landmark votes  
**Actual findings:**

| Criterion | Vote Count |
|-----------|-----------|
| Close-call (<1% margin, \|yea%-nay%\| < 1%) | 2,064 |
| Close-call (<2% margin) | 4,468 |
| Close-call (<5% margin) | 12,289 |
| Linked to `/historical-events` | 29,821 |
| Supermajority (≥2/3 yea, veto-override territory) | 36,807 |
| Near-cloture (57–63% yea) | 11,046 |
| **Close-call (<5%) ∪ historical-event linked** | **39,815** |

The landmark union as written in the brief reaches **39,815 voteview votes** — 25–80× the
estimated 500–1,500.

**Root cause:** Historical-event links are dominated by the Cold War era (28,399 voteview
votes cover roughly 1947–1989 legislative activity). All votes in that period that passed
the linker query are included. The linker was designed to find votes that happened *during*
historical events, not votes that *decided* them — so the count is inflated.

**Breakdown of historical-event linked voteview votes by event:**

| Event | Voteview votes linked |
|-------|----------------------|
| Cold War | 28,399 |
| Vietnam War | 11,019 |
| COINTELPRO | 6,556 |
| Church Committee Investigations | 2,584 |
| World War II | 1,422 |
| Korean War | 1,038 |
| Cuban Missile Crisis | 348 |
| JFK Assassination | 348 |
| Bay of Pigs Invasion | 320 |

**STOP condition triggered.** This contradicts the core premise and changes the scope of
B11-3 entirely. Owner must decide: narrow the landmark definition before proceeding.

**Recommended narrowings to reach 500–1,500 votes:**
- Option A: Close-call <1% margin only → **2,064 votes** (still above 1,500)
- Option B: Close-call <0.5% margin only → **~1,000 votes** (right band)
- Option C: Close-call <0.5% + explicit list of key votes (Civil Rights Act, ACA,
  AUMF, etc.) → ~1,200–1,500 votes, editorially curated
- Option D: Historical-event linked restricted to "decisive" events (CMC, Bay of Pigs,
  JFK only) = 1,016 + close-call → ~2,500 (still over, but manageable)

The brief's "receipt value must exceed audit cost per record" doctrine applies: **39,815 XML
fetches at 300ms each = ~3.3 hours of runtime and ~39k DB writes for votes almost nobody
will open.** Only the tightest subset justifies the cost.

---

### `enrich-member-votes.ts` Bug Status

The script targets `congress_votes_v1` only (matches `congress_law_source_{congress}_{type}_{number}` externalId pattern). The "Congress.gov API 404 bug" mentioned in ROADMAP.md is already worked around: `buildVoteXmlUrl()` constructs Clerk/Senate XML URLs directly from metadata without hitting the Congress.gov API.

**Current status:** `congress_votes_v1` is at 100% MemberVote coverage (505/505 LV, 104,550 MV). The script is effectively complete for its target pipeline.

**For voteview backfill:** A new script would be needed. The voteview source externalIds use `voteview_source_{congress}_{chamber}_{rollnumber}` format — distinct from what `enrich-member-votes.ts` expects. The congress/rollnumber/date needed to build Clerk/Senate XML URLs would come from `LegislativeVote.voteDate` + Source metadata.

---

## DW-NOMINATE Ingest Addendum (B11-2 prerequisite)

**What's needed:**

1. **Download `HSall_members.csv`** from Voteview:
   ```
   mkdir -p /tmp/voteview
   curl -L https://voteview.com/static/data/out/members/HSall_members.csv \
     -o /tmp/voteview/HSall_members.csv
   ```
   This file has one row per member per Congress, including:
   - `icpsr` (Voteview member ID)
   - `bioname`, `party_code`, `state_abbrev`
   - `congress`, `chamber`
   - `nominate_dim1` (economic axis, −1 liberal → +1 conservative)
   - `nominate_dim2` (social/racial axis)
   - `nominate_geo_mean_probability`
   - `nokken_poole_dim1`, `nokken_poole_dim2` (session-specific variants)

2. **Schema addition needed:**

   Add a new model or extend `MemberVote` to store per-member ideology scores. The cleanest
   approach is a new `MemberIdeology` table:
   ```prisma
   model MemberIdeology {
     id             String   @id @default(cuid())
     memberId       String   // bioguide ID (may be null for pre-bioguide members)
     icpsrId        Int      // Voteview ICPSR integer ID
     congress       Int
     chamber        String
     memberName     String
     party          String?
     state          String?
     nominateDim1   Float?   // economic axis
     nominateDim2   Float?   // social/racial axis
     geometricMean  Float?   // overall fit
     nokkenPoole1   Float?   // session-specific dim1
     nokkenPoole2   Float?   // session-specific dim2
     dataSource     String   @default("voteview_members_v1")
     createdAt      DateTime @default(now())
     
     @@unique([icpsrId, congress, chamber])
     @@index([memberId])
     @@index([congress, chamber])
   }
   ```

3. **Script:** `scripts/ingest-voteview-members.ts`  
   Reads `HSall_members.csv`, upserts into `MemberIdeology` by `(icpsrId, congress, chamber)`.  
   ~13,000 rows expected (all unique member-congress combinations).  
   No external requests — pure CSV ingest. Runtime: ~2 minutes.

4. **Join key:** Bioguide IDs in `MemberVote.memberId` can join to `MemberIdeology.memberId`
   for members since ~1980. Pre-bioguide members join via ICPSR-to-bioguide crosswalk (also
   available from Voteview: `HSall_members.csv` has both `icpsr` and `bioguide_id`).

**Owner decision needed before proceeding:**
- Approve schema migration (adds `MemberIdeology` table)?
- Approve download + ingest of `HSall_members.csv`?
- Desired scope: all 13k member-congress records, or recent Congresses only?

---

## Owner Decisions Received (2026-07-15)

**Decision 1 — DW-NOMINATE: GO**
- Schema migration approved. Standard chain: dry-run → pilot 25 → word-for-word verify → owner yes → full run.
- Deterministic IDs: `sha256("voteview_members_v1:{icpsr}:{congress}:{chamber}")` → `mi_{hex24}`
- Nokken-Poole stored in `metadata` only; standard DW-NOMINATE surfaced in UI.
- **Migration window required** — owner pauses corpus promoter loop before applying.

**Decision 2 — Landmark subset: HYBRID**
- Curated named landmarks (~200–400) + all <0.5% margin votes (~1,000), deduped, capped at 1,500.
- Every vote carries a machine-readable `reason` field ("landmark: Civil Rights Act of 1964" / "decided by <0.5%").
- Historical-event linker stays unchanged (correct for `/historical-events`, not a landmark criterion).
- Pilot 25 → verify → owner yes before full subset run.

---

## B11-2 — DW-NOMINATE Ingest: Files Written

### Schema migration

**File:** `prisma/migrations/20260715000000_add_member_ideology/migration.sql`  
**Schema:** `prisma/schema.prisma` — new `MemberIdeology` model added (additive only).

New table: `MemberIdeology` — one row per `(icpsrId, congress, chamber)`.  
Columns: `icpsrId`, `bioguideId`, `congress`, `chamber`, `memberName`, `party`, `stateAbbrev`,  
`nominateDim1`, `nominateDim2`, `geoMeanProb`, `metadata` (JSON: sourceUrl, fileSha256,  
hasNokkenPoole, nokkenPoole1/2), `dataSource`, `createdAt`, `updatedAt`.  
Indexes: `(icpsrId, congress, chamber)` unique; `bioguideId`; `(congress, chamber)`; `nominateDim1`.

### Apply commands (owner runs, after pausing corpus promoter loop)

```bash
# 1. Apply migration SQL directly (shadow DB is broken — use execute path)
npx prisma db execute \
  --file prisma/migrations/20260715000000_add_member_ideology/migration.sql \
  --schema prisma/schema.prisma

# 2. Mark migration as applied in _prisma_migrations
npx prisma migrate resolve \
  --applied 20260715000000_add_member_ideology

# 3. Verify migration status is clean
npx prisma migrate status

# 4. Download the CSV (if not already present)
mkdir -p /tmp/voteview
curl -L https://voteview.com/static/data/out/members/HSall_members.csv \
  -o /tmp/voteview/HSall_members.csv

# 5. Dry-run ingest to verify parsing
npx tsx scripts/ingest-voteview-members.ts --dry-run

# 6. PILOT: ingest Congress 118 only (most recent, bioguide IDs available, spot-checkable)
npx tsx scripts/ingest-voteview-members.ts --execute --congress 118
```

### Pilot verification (Congress 118 — after step 6)

Owner spot-checks 3–5 members from the `MemberIdeology` table against the live Voteview
member browser at https://voteview.com/congress/house — confirm:
- `nominateDim1` matches "DW-NOMINATE Dim 1" shown on member page (tolerance ±0.001)
- `bioguideId` matches bioguide.congress.gov member record
- `party` matches expected party affiliation

**If pilot values match word-for-word: report back with "run full ingest".**  
Full run: `npx tsx scripts/ingest-voteview-members.ts --execute`  
Expected: ~13,000 rows.

---

## B11-3 — Landmark Subset Builder: File Written

**File:** `scripts/build-landmark-subset.ts`

Two criteria:
- **Named landmarks** — ILIKE text search on `Source.title` for ~35 landmark bills (Civil Rights Act, VRA, ACA, AUMF, etc.). Every match traces to an actual DB record. Passage + cloture pairs included.
- **Close-call** — `|yesCount - noCount| / (yesCount + noCount) < 0.005` on `voteview_v1`.

Output: JSON array of `{ externalId, legislativeVoteId, sourceId, sourceTitle, voteDate, result, reason, reasonType }` tuples. Capped at 1,500 after dedup. Landmarks sorted first.

### Run to generate the list

```bash
# On VPS (needs DATABASE_URL):
npx tsx scripts/build-landmark-subset.ts --output /tmp/landmark-subset.json
```

**NEXT step after running:** Owner reviews `/tmp/landmark-subset.json` and confirms the landmark
text matches look correct (anchor spot-check). Then: "run pilot" to proceed to the 25-entry
Voteview XML fetch pilot (to be scripted in B11-3 continuation).

---

## Phases Completed

| Phase | Status | Notes |
|-------|--------|-------|
| B11-1 Census | ✅ Complete | Key findings above |
| B11-2 DW-NOMINATE surfacing | 🟡 Awaiting migration window | Schema + migration SQL + ingest script written; pilot commands ready |
| B11-3 Member-vote backfill | 🟡 Awaiting landmark list review | Subset builder written; needs owner to run + confirm matches |
| B11-4 Member profile analytics | ⏸ Pending B11-2 ingest | `congress_votes_v1` members already have party-unity % |
| B11-5 Verification | ⏸ Pending | — |

---

## Spot-check Table (congress_votes_v1 — current data)

| memberId | Name | Party | State | Total MemberVotes |
|----------|------|-------|-------|-------------------|
| To be filled in B11-4 after owner approvals | | | | |

---

## Full-Corpus Cost/Value Memo

**Scope: 113,319 voteview LegislativeVotes → member-level backfill**

Cost:
- 1 HTTP request per vote (House Clerk or Senate XML)
- 300ms rate limit → ~34,000 seconds ≈ **9.4 hours** wall-clock minimum
- ~113,319 XML parses → ~21M MemberVote rows (avg ~187 members/vote for full Congress)
- Storage: ~21M rows × ~200 bytes = ~4.2 GB
- Risk: Clerk/Senate XML availability varies by age; pre-1990 votes have thin coverage

Value:
- 113,319 voteview roll-calls span 1789–present; however, member XML data from
  Clerk/Senate only reliably covers ~1990–present (modern Congress)
- Historical member votes in Voteview come from their own members CSV, not Clerk XML
- **Alternative for historical coverage:** Voteview provides `HSall_votes.csv` (member-level
  votes for ALL roll-calls), but this file is ~2GB+ uncompressed and would add 100M+ rows

**Verdict: Full 113k corpus backfill via Clerk/Senate XML is not justified today.** The
Voteview `HSall_votes.csv` approach would be higher quality for historical coverage but
requires a separate architecture decision (bulk CSV vs. XML-per-vote). Recommend this stays
a post-B11 decision with a dedicated brief.

---

## Residue Log

- `eu_parliament_votes_v2` (24,224 LV) and `openparliament`/`uk-parliament` also have 0
  MemberVote rows — not in scope for B11 but noted for future tracking.
- `enrich-member-votes.ts` is effectively complete for `congress_votes_v1`; no bug fix needed.
- The `nominate_mid_1/2` fields in the rollcall CSV were read but discarded by the ingest
  script — if these vote-level fields are wanted for future UI, they could be added to
  `LegislativeVote` schema with a backfill migration against the existing CSV.

---

## Workstream A — MemberIdeology Ingest: Checkpoint (2026-07-15 ~23:00 UTC)

**Status: Partial ingest in progress (owner's Mac); full checkpoint pending 51,061-row confirmation.**

### Migration resolved

`npx prisma migrate resolve --applied 20260715000000_add_member_ideology` — run at ~22:56 UTC from VPS (checked out `loop/votes-b11-2026-07-15`). Database schema: up to date (54 migrations). ✓

### Join sanity (run at 17,917 rows — ~35% of expected 51,061)

| Metric | Value |
|--------|-------|
| Total `/members` pages (distinct memberId) | 2,330 |
| EU Parliament members (no DW-NOMINATE by design) | 1,269 |
| US Congress members (congress_votes_v1) | 1,061 |
| US members with MemberIdeology row (bioguideId join) | 465 |
| **US join coverage at current ingest** | **43.8%** |
| MemberIdeology rows at time of check | 17,917 |
| Expected at full ingest | 51,061 |
| Congress range ingested | 1–118 |

43.8% US coverage at 35% ingest completion is on track. EU Parliament members (1,269) correctly excluded — no DW-NOMINATE for European legislators by design.

**AWAITING OWNER:** Paste terminal output confirming 51,061 rows. A-final memo will follow.

---

## Workstream B — DW-NOMINATE UI: COMPLETE (2026-07-15)

**Branch:** `loop/votes-b11b-2026-07-15` — pushed. PR open at: https://github.com/contofalskyR/epistemic-receipts/compare/main...loop/votes-b11b-2026-07-15

Deploy-order safe: all components render `null` when MemberIdeology has no row for the given bioguideId (D-4 empty-state). Safe to merge before A ingest completes.

**Components built:**

1. **`app/members/[memberId]/IdeologySection.tsx`** — server component; queries MemberIdeology by bioguideId; dim1/dim2 scores with CSS economic-axis gradient bar, party+chamber medians via `percentile_cont`, collapsible congress history. Attribution: "DW-NOMINATE via Voteview."

2. **`app/analysis/ideology/page.tsx`** + **`IdeologyClient.tsx`** — server page with congress+chamber picker, party summary table (avg/min/max dim1), dim1 histogram (CSS bins), dim1×dim2 scatter (recharts). Empty state if table empty.

3. **Members search API** (`app/api/members/search/route.ts`) — adds `nominateDim1` subquery (most recent congress). `MembersClient.tsx` shows `DW1: ±X.XX` on each result card.

4. **Nav** — `/analysis/ideology` added to Lab section.

`npx tsc --noEmit` clean on b11b branch. ✓

---

## Workstream C — Landmark Subset: CHECKPOINT (2026-07-15, owner review pending)

**Branch:** `loop/votes-b11c-2026-07-15` — this branch. Artifact: `data/landmark-rollcalls.json`.

### Subset final counts

| Criterion | Count |
|-----------|-------|
| Named landmark votes | 713 |
| Close-call (<0.5% margin) | 787 |
| **Total (capped at 1,500)** | **1,500** |
| Residue — landmark acts not in DB | 2 |

**Margin formula:** `ABS(yesCount - noCount)::float / (yesCount + noCount)::float < 0.005`
**Margin range:** 0.000%–0.498% ✓

**Residue (excluded, not invented):**
- Civil Rights Act of 1960 — `%H.R. 8601%` returned 0 rows
- Clean Air Act of 1970 — `%S. 4358%` returned 0 rows

**Source document (fetchable):** https://en.wikipedia.org/wiki/List_of_United_States_federal_legislation  
**Secondary:** Mayhew, David R. (1991). *Divided We Govern*. Yale University Press.

### Spot-checks (4/4 verified word-for-word vs. live Voteview rollcall pages)

| Act | externalId | DB result / date | Voteview match |
|-----|------------|------------------|----------------|
| Civil Rights Act 1964 | voteview_source_88_h_128 | 290-130 / 1964-02-10 | ✓ |
| Voting Rights Act 1965 | voteview_source_89_h_87 | 333-85 / 1965-07-09 | ✓ |
| ACA 2010 | voteview_source_111_h_1150 | 219-212 / 2010-03-21 | ✓ |
| AUMF 2001 | voteview_source_107_s_281 | 98-0 / 2001-09-14 | ✓ |

### Build script fixes applied (vs. original on b11 branch)

1. `source: { title: ... }` → raw SQL `s.name` (Source model has no `title` field; ORM silently returned 0 rows)
2. `p.replace(/%/g, '')` stripped `%` from patterns → fixed by using raw SQL `ILIKE $pattern` with literal `%`
3. AUMF 2001 found via `directIds` (generic title, no bill number in Source.name)

### Next steps (owner checkpoint required)

**Owner: review `data/landmark-rollcalls.json`** — confirm landmark entries look correct.

Then, in order (each needs its own explicit yes):
1. Pilot 25 entries through enrichment (voteview_v1 externalId format; needs adapted script) → 5 spot-checks vs. live XML → **owner yes #1**
2. Full 1,500-entry run → DB-verified MemberVote counts + residue log → **owner yes #2**

STOP: no enrichment write without recorded yes. Merge ≠ execute.

---

## Phases Updated (as of 2026-07-15)

| Phase | Status | Branch |
|-------|--------|--------|
| B11-1 Census | ✅ Complete | b11 |
| B11-2 DW-NOMINATE ingest (A) | 🟡 17,917/51,061 rows — awaiting full count | b11 |
| B11-2 DW-NOMINATE UI (B) | ✅ Complete | b11b |
| B11-3 Landmark subset build (C) | ✅ Complete | b11c |
| B11-3 Landmark owner review | ⏸ Awaiting owner yes | — |
| B11-3 Enrichment pilot (25 entries) | ⏸ Awaiting owner yes | — |
| B11-3 Full enrichment run | ⏸ Awaiting owner yes | — |

---

## B11 Worker Session 2 (2026-07-15 ~23:05–23:30 UTC) — C pilot + repo findings

### ⚠️ URGENT: origin/main build is broken (deploys failing)

The B11b UI commit (95f53f4) is on origin/main and calls `prisma.memberIdeology`, but the
MemberIdeology **schema model is not on main** (it lives in a895008, only on the b11 branches).
`prisma generate` + typecheck fail on main → Vercel is stuck serving an old deployment —
verified: `/analysis/ideology` returns 404 in production while `/` is 200.
**Fix: merge `loop/votes-b11c-2026-07-15`** (carries schema + migration + ingest script +
landmark subset + this report). Migration is already applied+resolved in prod, so merge is safe.

### Branch hygiene performed

- Landmark-subset commit 47c6dd4 was stranded on local `main` (unpushed, would have been
  swept to origin/main by the next promoter push). Cherry-picked onto b11c (cc0fd3c, taking
  the fixed build-landmark-subset.ts), then local `main` reset to origin/main.
- Concurrent-session note: at 23:08–23:09 UTC another session committed the report to b11c
  (905da32) in this same checkout; contention checked before every push this session.

### Workstream C — Pilot COMPLETE + VERIFIED

See `briefs/b11-c-checkpoint.md` for the full memo. Summary:
- 25/25 rollcalls written via **Voteview per-rollcall API** (not Clerk XML — doesn't exist
  pre-1990; senate.gov also 403s this VPS; Voteview provides `clerk_rollnumber` as bridge).
- 6,799 MemberVote rows, residue 0, exact tally gate (parsed = API = DB counts) on every write.
- 5 spot-checks: Clerk XML + GovTrack (independent) exact; 633/633 full-row match vs live
  Voteview on 3 historical rollcalls.
- Paired/announced votes labeled explicitly; POTUS rows excluded by district/modifier
  (NOT icpsr range — Thurmond is icpsr 99369; a range filter would have dropped him).
- bioguide joins only 9% during pilot because A-ingest was ~50% done — full run should wait
  for ingest completion + one re-join pass for pilot rows (exact icpsr key, no fuzzy).
- **STOPPED per brief: awaiting owner yes for the full 1,500 run (~40 min, ~400k rows).**

### Full-113k cost/value memo (updated with measured numbers)

- **Cost:** 113,319 API fetches @300ms throttle ≈ **10–16 h wall**; ~272 rows/rollcall avg →
  **~30M MemberVote rows, ~6 GB**. Idempotent/resumable with the pilot script as-is.
- **Cheaper path:** Voteview `HSall_votes.csv` bulk file (one download, ~100M member-vote
  records) + the same ICPSR crosswalk — no per-vote fetches, but needs a bulk-load
  architecture decision (COPY vs batched createMany) and ~2 GB staging.
- **Value:** complete per-member voting records 1789–present → member profile pages become
  fully populated for every historical member; enables party-unity/ideology-vs-vote analyses
  at full corpus scale. Receipt-value doctrine: most of the 30M rows would back pages with
  near-zero traffic; the landmark 1,500 covers the votes people actually open.
- **Recommendation:** decision stays open per brief. If wanted later, bulk CSV > API loop.

### Census corrections revealed by execution

- "Clerk/Senate XML" as the enrichment source (census §enrich-member-votes) is wrong for
  voteview_v1: pre-1990 votes have no XML and Voteview roll numbers ≠ Clerk roll numbers.
  The Voteview API is the correct source and carries the bridge field.
- enrich-member-votes.ts needed no fix for congress_votes_v1 (100% coverage confirmed), so
  a new script `enrich-landmark-member-votes.ts` was written for voteview_v1 instead.

### Workstream A — still awaiting owner's final ingest count

MemberIdeology grew 25,056 → 27,454+ during this session (Mac ingest running). Record the
final count here when the owner sends it; then re-run the join sanity + pilot re-join pass.
