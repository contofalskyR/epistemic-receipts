# Data dictionary (exported columns)

One row per column of the five exported tables. Types are the PostgreSQL types Prisma generates
(`String` → `text`, `DateTime` → `timestamp(3)` without time zone, values in UTC; `Json` → `jsonb`; `Int` →
`integer`). "Null" gives the corpus null count where it matters (`docs/paper/sql/out/11_schema_values.out`).
Examples are real rows (`docs/paper/sql/12_examples.sql`): the 1998 Senate cloture vote
`cmq5l0zit5oyfsal83wd26glu`, one of its Source/Edge rows, a curated transition, and a REVERSED relation. Text
examples are truncated with "…". In the Parquet/CSV export (`scripts/paper/export.ts`), timestamps are ISO 8601 UTC,
`jsonb` columns are JSON strings, and file and column names are as below: legacy columns get a `legacy_` prefix,
the always-false `deleted` columns are dropped, and derived columns are marked **derived**. Email addresses inside
exported text are replaced by `[email removed]` (counts in `MANIFEST.json`).

## Claim (1,757,599 rows, `deleted = false`)

| Column | Type | Meaning | Nullable | Example |
|---|---|---|---|---|
| `id` | text (cuid) | Primary key | no | `cmq5l0zit5oyfsal83wd26glu` |
| `text` | text | The claim, in English, generated from the upstream record by the ingester's code template (curated trajectories: written in the seed script) | no | `The U.S. Senate voted 59-41 on "(THREE-FIFTHS OF THOSE SENATORS … REJECTED THE MOTION TO INVOKE …` |
| `epistemicAxis` | text | Current status. Vocabulary: RECORDED, SETTLED, CONTESTED, OPEN, UNRESOLVABLE, REVERSED, ABANDONED (Prisma enum `FactStatus`) | yes (23,128) | `SETTLED` |
| `claimEmergedAt` | timestamp | Date of the upstream event the claim records (vote, enactment, publication, retraction …). 1970-01-01 values are placeholders (6,630) | yes (177,772) | `1998-09-09 00:00:00` |
| `claimEmergedPrecision` | text | Precision of `claimEmergedAt`: DAY, MONTH, QUARTER, YEAR | yes (264,434) | `DAY` |
| `ingestedBy` | text | Pipeline tag that created the claim (187 values; `docs/paper/sources.md`) | no | `voteview_v1` |
| `externalId` | text, unique | Pipeline's stable key for the upstream record; curated trajectories use `trajectory:<slug>` | yes (74) | `voteview_claim_cmppuv3je3q0xsapm0pg1nub2` |
| `verificationStatus` | text | Pipeline quality-gate label set by code (not a human review): VERIFIED, PROVISIONAL, DISPUTED, HARD_FACT, DEPRECATED. DEPRECATED = retired pipeline, hidden in default views (numbers.md §1.1) | yes (138,163) | `VERIFIED` |
| `claimType` | text | INSTITUTIONAL, EMPIRICAL, MEASUREMENT, HYBRID, INTERPRETIVE | no | `EMPIRICAL` |
| `metadata` | jsonb | Pipeline-specific fields; `metadata.corrections` holds correction records (before, after, batch, date). Common keys below | yes (37,795) | `{"result": "failed", "noCount": 41, "congress": 105, "yesCount": 59, "dataSource": "voteview_v1", "rollNumber": 560, …}` |
| `parentClaimId` | text → `Claim.id` | Parent claim, where a pipeline nests claims | yes (217 non-null) | null |
| `openAlexId` | text | OpenAlex work id, for scholarly claims | yes (161,973 non-null) | null |
| `autoApproved` | boolean | The pipeline's own quality gates passed at ingest | no | `true` |
| `humanReviewed` | boolean | Intended: a person reviewed the record. **Set by scripts on 790 of the 833 rows where it is true**; use `reviewedBy` (numbers.md §1.1) | no | `false` |
| `reviewedBy` | text | Reviewer: a person (`robert`, 43 claims) or a script tag ending `_auto` | yes (1,133 non-null) | null |
| `reviewedAt` | timestamp | When `reviewedBy` reviewed it | yes (471 non-null) | null |
| `reviewConfidence` | enum ReviewConfidence | HIGH, MEDIUM, LOW | yes (1,178 non-null) | null |
| `legacy_currentStatus` | text | **Legacy** (DB column `currentStatus`) status (HARD_FACT, DISPUTED, VERIFIED, NEVER_RESOLVES), superseded by `epistemicAxis`; kept for audit | no | `HARD_FACT` |
| `legacy_epistemicStatus` | text | **Legacy** (DB column `epistemicStatus`) pipeline status (approved, retracted, registered_trial, settled_judgment, confirmed, established, contested_dissent), superseded by `epistemicAxis` | yes (1,565,628) | null |
| `createdAt` | timestamp | When the row was written (ingest time, not the event date) | no | `2026-06-08 19:06:39.699` |
| `updatedAt` | timestamp | Last modification of the row | no | `2026-10-13 03:26:39.708` |
| `claimEmergedPlaceholder` | boolean | **derived**: `claimEmergedAt` is on 1970-01-01 or after the snapshot (a placeholder, not a date) | no | `false` |
| `domain` | text | **derived**: editorial pipeline → domain grouping (`docs/paper/domain-map.csv`, provisional) | no | `legislative_votes` |
| `curatedTrajectory` | boolean | **derived**: `externalId` starts `trajectory:` (LLM-drafted, source-linked curated trajectory) | no | `false` |
| `trajectoryT1` | boolean | **derived**: the claim has ≥1 status change with an independent dated source (`status_history.trajectoryChange = 't1'`) | no | `false` |
| `trajectoryT2` | boolean | **derived**: the claim has ≥1 documented status change (`t1` or `t2_only`). Always report with `trajectoryT1` | no | `false` |
| `upstreamLicence` | text | **derived**: what the upstream provider's terms say (`docs/paper/upstream-licences.csv`) | yes | `No licence stated on voteview.com/about …` |
| `upstreamLicenceStatus` | text | **derived**: open, sa, nc, nd, restricted, unclear, not_checked | yes | `unclear` |

Not exported: `searchVector` (generated full-text column), `deleted` (always false).

### Common `Claim.metadata` keys (top 40 by claims, [11 §11d])

`dataset` 1,536,904 claims / 152 pipelines (the pipeline's dataset tag) · `title` 444,957 / 36 · `doi` 371,086 / 3 ·
`year` 353,262 / 54 · `openalex_id`, `venue`, `cited_by_count` 344,462 / 2 · `citationsFetchedAt`,
`citationsByYear` 318,775 / 1 · `seriesTitle` 312,400 / 2 · NARA: `digitized`, `accessRestriction`, `recordGroup`,
`scopeNote`, `beginDate`, `naId`, `endDate` 308,051 / 1, `naraDateSweep` 258,435, `naraDateField` 166,647 ·
`is_retracted` 276,975 / 1 · `statMethods`, `statMethodsTaggedAt` 212,145 / 1 · `countryCode` 156,510 / 21 ·
`congress` 140,967 / 4 · `status` 140,917 / 12 · `country` 123,958 / 47 · `countryName` 117,699 / 4 · Voteview:
`rollNumber`, `legislativeVoteId` 113,327 / 2, `chamberCode`, `yesCount`, `noCount`, `dataSource`, `result`
113,319 / 1 · `value` 92,988 / 5 · `category` 92,599 / 9 · `unit` 88,636 / 3 · `indicatorCode` 88,281 / 2 ·
`actNumber` 88,256 / 11 · `corrections` 86,984 / 2. The full key list per pipeline ships in the archive (Phase 3).

## ClaimStatusHistory (1,821,600 rows on exported claims)

| Column | Type | Meaning | Nullable | Example |
|---|---|---|---|---|
| `id` | text | Primary key (cuid or a deterministic slug; opaque) | no | `cmq5l0zit5oyfsal83wd26glu-SETTLED-1998-09-09` |
| `claimId` | text → `Claim.id` | The claim | no | `cmq5l0zit5oyfsal83wd26glu` |
| `seq` | integer | Position in the claim's history, 1..n. Order rows by `seq`, then `occurredAt`, then `createdAt` | yes (761) | `2` |
| `fromAxis` | text | Status before this row (FactStatus vocabulary); null on a claim's first row | yes | `RECORDED` |
| `toAxis` | text | Status this row records (FactStatus vocabulary, including REVERSED and ABANDONED) | no | `SETTLED` |
| `occurredAt` | timestamp | Historical date of the status (not ingest time). 1970-01-01 and post-run-date values are placeholders (6,754 rows), excluded from trajectory counts | no | `1998-09-09 00:00:00` |
| `datePrecision` | text | DAY, MONTH, QUARTER, YEAR | no (in practice) | `DAY` |
| `community` | enum RatifyingCommunity | Community that ratified (or failed to ratify) the status: INSTITUTIONAL, EXPERT_LITERATURE, JUDICIAL, PUBLIC, MARKET | no | `INSTITUTIONAL` |
| `reason` | text | Why the status holds at that date | yes in schema; non-null on every row | `Roll-call result certified in the official congressional record …` |
| `sourceId` | text → `Source.id` | The document that marks this status ("marker" source). Non-null on 30,068 rows | yes | null (curated example: `cmqzmncxb000p8odsri514rxd`) |
| `createdAt` | timestamp | When the row was written | no | `2026-07-03 14:49:38.895` |
| `rowKind` | text | **derived**: `first` (the ingest status, never a transition), `row_sourced`, `same_day_relabel` (bulk RECORDED→SETTLED on the first row's date: a schema event, not a transition), `retraction_repeal_entry`, `other` | no | `same_day_relabel` |
| `placeholderDate` | boolean | **derived**: `occurredAt` on 1970-01-01 or after the snapshot. Ignored when deciding `trajectoryChange` | no | `false` |
| `trajectoryChange` | text | **derived**: `t1` = axis change, row-sourced, dated after the previous real-dated row; `t2_only` = retraction/repeal change documented by the claim's own URL-bearing Edge; null = not a counted change | yes | null |

Row semantics: the first row per claim is the ingest status, not a transition. A later row with the same timestamp as
the row before it, written by the wave-1 bulk rule, is a same-day relabel, not a transition (numbers.md §3.3).

## Source (`sources`: only the Sources referenced by an exported edge or history row; 1,658,927 at the census)

| Column | Type | Meaning | Nullable | Example |
|---|---|---|---|---|
| `id` | text (cuid) | Primary key | no | `cmppuv35n3p8xsapmeu1cpya2` |
| `name` | text | Document title or description | no | `(THREE-FIFTHS OF THOSE SENATORS DULY CHOSEN AND SWORN NOT HAVING VOTED IN THE AFFIRMATIVE, SENATE REJECTED …` |
| `url` | text | Where the document can be read | yes (25,554) | `https://voteview.com/rollcall/RS1050560` |
| `publishedAt` | timestamp | Publication or event date of the document | yes (553,606) | `1998-09-09 00:00:00` |
| `methodologyType` | text | primary, derivative, opinion (plus 13 rare ad-hoc values, data-records.md) | no | `primary` |
| `ingestedBy` | text | Process that wrote the Source (a claim pipeline, `claude_sourcing_v1`, `event:*`, `enrich*` …) | no | `voteview_v1` |
| `externalId` | text, unique | Pipeline's stable key for the document | yes (1,533) | `voteview_source_105_s_560` |
| `autoApproved` | boolean | Quality gates passed (pipeline gates, or the `claude_sourcing_v1` excerpt check) | no | `true` |
| `humanReviewed` | boolean | As for Claim; check `reviewedBy` | no | `false` |
| `reviewedBy` | text | Reviewer (person or `_auto` script tag) | yes (933 non-null) | null |
| `reviewedAt` | timestamp | Review time | yes | null |
| `reviewConfidence` | enum ReviewConfidence | HIGH, MEDIUM, LOW | yes | null |
| `createdAt` | timestamp | When the row was written | no | `2026-05-28 18:57:41.808` |


## Edge (1,719,781 rows)

| Column | Type | Meaning | Nullable | Example |
|---|---|---|---|---|
| `id` | text (cuid) | Primary key | no | `cmq5l0zpo5pcbsal83uy3gxua` |
| `claimId` | text → `Claim.id` | The claim | no | `cmq5l0zit5oyfsal83wd26glu` |
| `sourceId` | text → `Source.id` | The document | no | `cmppuv35n3p8xsapmeu1cpya2` |
| `type` | text | How the document bears on the claim: FOR, CITES, AGAINST, RETRACTS, SUPPORTS, CORRECTED, CONTRADICTS, DISPUTES | no | `FOR` |
| `evidenceType` | text | EVIDENTIARY, PROCEDURAL, ARGUMENTATIVE | no | `EVIDENTIARY` |
| `ingestedBy` | text | Process that wrote the link | no | `voteview_v1` |
| `autoApproved` | boolean | Quality gates passed | no | `true` |
| `humanReviewed` | boolean | As for Claim | no | `false` |
| `reviewedBy` | text | Reviewer | yes | null |
| `reviewedAt` | timestamp | Review time | yes | null |
| `reviewConfidence` | enum ReviewConfidence | HIGH, MEDIUM, LOW | yes | null |
| `createdAt` | timestamp | When the row was written | no | `2026-06-08 19:06:39.947` |


## ClaimRelation (`claim_relations` + `claim_relations_context`; 4,831,149 rows with both ends exported, split by `linkKind`)

| Column | Type | Meaning | Nullable | Example |
|---|---|---|---|---|
| `id` | text (cuid) | Primary key | no | `cmpvyc08p0001saej0hkaldyh` |
| `fromClaimId` | text → `Claim.id` | Origin claim | no | `cmpm8jwd73kbvsadn7z9dv611` |
| `toClaimId` | text → `Claim.id` | Target claim | no | `cmp9to1fv2s5dploskmizwuyu` |
| `relationType` | text | One of 20 types (data-records.md table) | no | `REVERSED` |
| `year` | integer | Year the link refers to, for time-windowed context links | yes | null |
| `followUpContext` | jsonb | How the link was made: `heuristic` (78 % of rows), `method`, `confidence`, matched keys, batch | yes (1,050,001 null) | `{"doi": "10.1016/j.bbr.2009.03.026", "via": "db_doi_match", "note": "Original paper linked to its CrossRef retraction record via DOI", "source": "crossref_api", …}` |
| `linkKind` | text | **derived**: `upstream_record` (CITES/RELATED from OpenAlex records) and `identifier_match` (DOI, NCT id, bill number, award id) → `claim_relations`; `name_or_text_match` and `time_window` (country × year windows) → `claim_relations_context`, machine-derived context links, not core graph (`docs/paper/sql/14_relation_heuristics.sql`) | no | `identifier_match` |
| `heuristic` | text | **derived**: `followUpContext.heuristic`, the matching rule | yes | `doi_exact_match` |
| `createdAt` | timestamp | When the row was written | no | `2026-06-02 01:21:27.097` |

## pipelines (one row per `claims.ingestedBy`)

| Column | Type | Meaning | Nullable | Example |
|---|---|---|---|---|
| `pipeline` | text | `claims.ingestedBy` | no | `voteview_v1` |
| `domain` | text | Domain grouping (`docs/paper/domain-map.csv`) | no | `legislative_votes` |
| `claims` | integer | Exported claims from this pipeline | no | `113319` |
| `upstreamName`, `upstreamUrl` | text | Upstream provider (`lib/pipelines/registry.ts`) | yes | `Voteview / Lewis et al.`, `https://voteview.com/data` |
| `upstreamLicence`, `upstreamLicenceStatus`, `upstreamLicenceUrl` | text | Upstream terms, status, and the page they come from (`docs/paper/upstream-licences.csv`) | yes | `unclear` |
