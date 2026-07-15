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
