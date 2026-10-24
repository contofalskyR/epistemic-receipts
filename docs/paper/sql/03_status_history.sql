-- 03_status_history.sql — ClaimStatusHistory: rows, rows per claim, transitions.
--
-- Row order per claim = lib/trajectory-list.ts and docs/ORDERING-SEMANTICS-2026-07-08.md:
--   seq ASC (NULLS LAST), occurredAt ASC, createdAt ASC.
-- Terms used in docs/paper/numbers.md:
--   baseline row    = the first row of a claim (rn = 1): the status assigned at ingest
--                     (written by scripts/ingest-auto-trajectories.ts or the seed script).
--                     It is NOT a transition.
--   transition      = any row after the first (rn > 1).
--   axis change     = a transition whose toAxis differs from the previous row's toAxis.
--   sourced         = the row's sourceId is non-null and points at a non-deleted Source.
--   sentinel date   = occurredAt on 1970-01-01, in year >= 2100, or after the run time.
-- "occurredAt" is NOT NULL in the schema, so every row carries some date; the
-- meaningful date checks are datePrecision and the sentinels.

\echo '== 3a. rows and claims with history (all rows / deleted = false)'
SELECT count(*)                                         AS rows_all,
       count(DISTINCT h."claimId")                      AS claims_with_history_all,
       count(*) FILTER (WHERE NOT c.deleted)            AS rows_corpus,
       count(DISTINCT h."claimId") FILTER (WHERE NOT c.deleted) AS claims_with_history_corpus,
       (SELECT count(*) FROM "Claim" x WHERE NOT x.deleted
          AND NOT EXISTS (SELECT 1 FROM "ClaimStatusHistory" y WHERE y."claimId" = x.id)) AS corpus_claims_without_history
FROM "ClaimStatusHistory" h JOIN "Claim" c ON c.id = h."claimId";

\echo '== 3b. rows per claim (deleted = false; claims without history shown as 0)'
WITH per AS (
  SELECT c.id, count(h.id) AS n
  FROM "Claim" c LEFT JOIN "ClaimStatusHistory" h ON h."claimId" = c.id
  WHERE NOT c.deleted GROUP BY c.id
)
SELECT n AS rows_per_claim, count(*) AS claims,
       round(100.0 * count(*) / sum(count(*)) OVER (), 3) AS pct
FROM per GROUP BY n ORDER BY n;

\echo '== 3c. baselines vs transitions (deleted = false)'
WITH h AS (
  SELECT h.*, c.deleted,
         row_number() OVER w AS rn,
         lag(h."toAxis") OVER w AS prev_to,
         (h."occurredAt"::date = DATE '1970-01-01' OR h."occurredAt" >= TIMESTAMP '2100-01-01'
            OR h."occurredAt" > now()) AS sentinel,
         (s.id IS NOT NULL AND NOT s.deleted) AS sourced,
         (s.id IS NOT NULL AND NOT s.deleted AND s.url ~* '^https?://[a-z0-9.-]+\.[a-z]{2,}') AS sourced_url
  FROM "ClaimStatusHistory" h
  JOIN "Claim" c ON c.id = h."claimId"
  LEFT JOIN "Source" s ON s.id = h."sourceId"
  WINDOW w AS (PARTITION BY h."claimId" ORDER BY h.seq ASC NULLS LAST, h."occurredAt", h."createdAt")
)
SELECT count(*) FILTER (WHERE rn = 1)                                         AS baseline_rows,
       count(*) FILTER (WHERE rn = 1 AND sourced)                             AS baseline_rows_sourced,
       count(*) FILTER (WHERE rn > 1)                                         AS transitions,
       count(*) FILTER (WHERE rn > 1 AND "toAxis" IS DISTINCT FROM prev_to)   AS transitions_axis_changed,
       count(*) FILTER (WHERE rn > 1 AND "toAxis" = prev_to)                  AS transitions_axis_repeated,
       count(*) FILTER (WHERE rn > 1 AND "datePrecision" IS NOT NULL)         AS transitions_with_datePrecision,
       count(*) FILTER (WHERE rn > 1 AND sentinel)                            AS transitions_sentinel_date,
       count(*) FILTER (WHERE rn > 1 AND NOT sentinel)                        AS transitions_non_sentinel_date,
       count(*) FILTER (WHERE rn > 1 AND "sourceId" IS NOT NULL)              AS transitions_sourceId_nonnull,
       count(*) FILTER (WHERE rn > 1 AND sourced)                             AS transitions_sourced_live_source,
       count(*) FILTER (WHERE rn > 1 AND sourced_url)                         AS transitions_sourced_with_url,
       count(*) FILTER (WHERE rn > 1 AND sourced AND NOT sentinel
                          AND "toAxis" IS DISTINCT FROM prev_to)              AS transitions_dated_sourced_changed
FROM h WHERE NOT deleted;

\echo '== 3d. claims by transition kind (deleted = false)'
WITH h AS (
  SELECT h."claimId", h."toAxis", c.deleted, c."verificationStatus",
         row_number() OVER w AS rn,
         lag(h."toAxis") OVER w AS prev_to,
         (h."occurredAt"::date = DATE '1970-01-01' OR h."occurredAt" >= TIMESTAMP '2100-01-01'
            OR h."occurredAt" > now()) AS sentinel,
         (s.id IS NOT NULL AND NOT s.deleted) AS sourced
  FROM "ClaimStatusHistory" h
  JOIN "Claim" c ON c.id = h."claimId"
  LEFT JOIN "Source" s ON s.id = h."sourceId"
  WINDOW w AS (PARTITION BY h."claimId" ORDER BY h.seq ASC NULLS LAST, h."occurredAt", h."createdAt")
), per AS (
  SELECT "claimId", bool_or(coalesce("verificationStatus" = 'DEPRECATED', false)) AS deprecated,
         count(*) AS n_rows,
         count(*) FILTER (WHERE rn > 1) AS n_trans,
         count(*) FILTER (WHERE rn > 1 AND "toAxis" IS DISTINCT FROM prev_to) AS n_changed,
         count(*) FILTER (WHERE rn > 1 AND "toAxis" IS DISTINCT FROM prev_to AND sourced AND NOT sentinel) AS n_dated_sourced_changed
  FROM h WHERE NOT deleted GROUP BY "claimId"
)
SELECT count(*) FILTER (WHERE n_rows >= 2)                   AS claims_ge2_rows,
       count(*) FILTER (WHERE n_changed >= 1)                AS claims_ge1_axis_change,
       count(*) FILTER (WHERE n_dated_sourced_changed >= 1)  AS claims_ge1_dated_sourced_axis_change,
       count(*) FILTER (WHERE n_dated_sourced_changed >= 1 AND NOT deprecated) AS same_live_default_view,
       count(*) FILTER (WHERE n_dated_sourced_changed >= 2)  AS claims_ge2_dated_sourced_axis_changes
FROM per;

\echo '== 3e. transitions by pipeline (deleted = false)'
WITH h AS (
  SELECT h."toAxis", h."datePrecision", c.deleted, c."ingestedBy",
         row_number() OVER w AS rn,
         lag(h."toAxis") OVER w AS prev_to,
         (h."occurredAt"::date = DATE '1970-01-01' OR h."occurredAt" >= TIMESTAMP '2100-01-01'
            OR h."occurredAt" > now()) AS sentinel,
         (s.id IS NOT NULL AND NOT s.deleted) AS sourced
  FROM "ClaimStatusHistory" h
  JOIN "Claim" c ON c.id = h."claimId"
  LEFT JOIN "Source" s ON s.id = h."sourceId"
  WINDOW w AS (PARTITION BY h."claimId" ORDER BY h.seq ASC NULLS LAST, h."occurredAt", h."createdAt")
)
SELECT "ingestedBy",
       count(*)                                                     AS transitions,
       count(*) FILTER (WHERE "toAxis" IS DISTINCT FROM prev_to)    AS axis_changed,
       count(*) FILTER (WHERE sourced)                              AS sourced,
       count(*) FILTER (WHERE sentinel)                             AS sentinel_date,
       count(*) FILTER (WHERE sourced AND NOT sentinel AND "toAxis" IS DISTINCT FROM prev_to) AS dated_sourced_changed
FROM h WHERE NOT deleted AND rn > 1
GROUP BY 1 ORDER BY 2 DESC;

\echo '== 3f. transitions by (previous toAxis → toAxis) (deleted = false)'
WITH h AS (
  SELECT h."toAxis", c.deleted,
         row_number() OVER w AS rn, lag(h."toAxis") OVER w AS prev_to,
         (s.id IS NOT NULL AND NOT s.deleted) AS sourced
  FROM "ClaimStatusHistory" h
  JOIN "Claim" c ON c.id = h."claimId"
  LEFT JOIN "Source" s ON s.id = h."sourceId"
  WINDOW w AS (PARTITION BY h."claimId" ORDER BY h.seq ASC NULLS LAST, h."occurredAt", h."createdAt")
)
SELECT prev_to AS from_axis, "toAxis" AS to_axis, count(*) AS transitions,
       count(*) FILTER (WHERE sourced) AS sourced
FROM h WHERE NOT deleted AND rn > 1
GROUP BY 1, 2 ORDER BY 3 DESC;

\echo '== 3g. dates on all rows (deleted = false): precision and sentinels'
SELECT coalesce(h."datePrecision", '(null)') AS "datePrecision", count(*) AS rows,
       count(*) FILTER (WHERE h."occurredAt"::date = DATE '1970-01-01') AS on_1970_01_01,
       count(*) FILTER (WHERE h."occurredAt" >= TIMESTAMP '2100-01-01')  AS year_ge_2100,
       count(*) FILTER (WHERE h."occurredAt" > now() AND h."occurredAt" < TIMESTAMP '2100-01-01') AS future_before_2100,
       count(*) FILTER (WHERE extract(year FROM h."occurredAt") < 1000)  AS year_lt_1000
FROM "ClaimStatusHistory" h JOIN "Claim" c ON c.id = h."claimId"
WHERE NOT c.deleted GROUP BY 1 ORDER BY 2 DESC;

\echo '== 3h. sentinel-dated rows by pipeline (deleted = false)'
SELECT c."ingestedBy",
       count(*) FILTER (WHERE h."occurredAt"::date = DATE '1970-01-01') AS on_1970_01_01,
       count(*) FILTER (WHERE h."occurredAt" >= TIMESTAMP '2100-01-01')  AS year_ge_2100,
       count(*) FILTER (WHERE h."occurredAt" > now() AND h."occurredAt" < TIMESTAMP '2100-01-01') AS future_before_2100
FROM "ClaimStatusHistory" h JOIN "Claim" c ON c.id = h."claimId"
WHERE NOT c.deleted
  AND (h."occurredAt"::date = DATE '1970-01-01' OR h."occurredAt" > now())
GROUP BY 1 ORDER BY 2 DESC, 3 DESC;

\echo '== 3i. row-shape checks (all rows): fromAxis on baselines, fromAxis vs previous toAxis, null seq'
WITH h AS (
  SELECT h."fromAxis", h."toAxis", h.seq,
         row_number() OVER w AS rn, lag(h."toAxis") OVER w AS prev_to
  FROM "ClaimStatusHistory" h
  WINDOW w AS (PARTITION BY h."claimId" ORDER BY h.seq ASC NULLS LAST, h."occurredAt", h."createdAt")
)
SELECT count(*) FILTER (WHERE rn = 1 AND "fromAxis" IS NOT NULL)              AS baselines_with_fromAxis,
       count(*) FILTER (WHERE rn > 1 AND "fromAxis" IS DISTINCT FROM prev_to)  AS transitions_fromAxis_ne_prev_toAxis,
       count(*) FILTER (WHERE seq IS NULL)                                     AS rows_seq_null,
       count(*) FILTER (WHERE seq IS NOT NULL AND seq <> rn)                   AS rows_seq_ne_rank
FROM h;

\echo '== 3j. community (all rows, deleted = false)'
SELECT h.community, count(*) AS rows
FROM "ClaimStatusHistory" h JOIN "Claim" c ON c.id = h."claimId"
WHERE NOT c.deleted GROUP BY 1 ORDER BY 2 DESC;

\echo '== 3k. sourced transitions (deleted = false) by claim pipeline × marker-source class'
-- Marker sources whose ingestedBy starts with "enrich" or contains "enrichment"
-- are per-claim enrichment tags (dozens of one-off values); collapsed to one class.
WITH h AS (
  SELECT h."sourceId", c.deleted, c."ingestedBy" AS claim_pipeline,
         row_number() OVER w AS rn
  FROM "ClaimStatusHistory" h
  JOIN "Claim" c ON c.id = h."claimId"
  WINDOW w AS (PARTITION BY h."claimId" ORDER BY h.seq ASC NULLS LAST, h."occurredAt", h."createdAt")
), t AS (
  SELECT h.claim_pipeline, s."ingestedBy" AS src_tag, s."humanReviewed", s."autoApproved",
         CASE WHEN s."ingestedBy" ~* '^enrich|enrichment' THEN 'enrich* (per-claim enrichment tags)'
              ELSE s."ingestedBy" END AS marker_source
  FROM h JOIN "Source" s ON s.id = h."sourceId" AND NOT s.deleted
  WHERE NOT h.deleted AND h.rn > 1
)
SELECT claim_pipeline, marker_source, count(*) AS transitions, count(DISTINCT src_tag) AS source_tags,
       count(*) FILTER (WHERE "humanReviewed") AS source_humanReviewed,
       count(*) FILTER (WHERE "autoApproved")  AS source_autoApproved
FROM t GROUP BY 1, 2 ORDER BY 3 DESC;

\echo '== 3k2. sourced transitions by marker-source class (deleted = false)'
WITH h AS (
  SELECT h."sourceId", c.deleted, c."ingestedBy" AS claim_pipeline,
         row_number() OVER w AS rn
  FROM "ClaimStatusHistory" h
  JOIN "Claim" c ON c.id = h."claimId"
  WINDOW w AS (PARTITION BY h."claimId" ORDER BY h.seq ASC NULLS LAST, h."occurredAt", h."createdAt")
), t AS (
  SELECT h.claim_pipeline, s."ingestedBy" AS src_tag, s."humanReviewed", s."autoApproved",
         CASE WHEN s."ingestedBy" ~* '^enrich|enrichment' THEN 'enrich* (per-claim enrichment tags)'
              ELSE s."ingestedBy" END AS marker_source
  FROM h JOIN "Source" s ON s.id = h."sourceId" AND NOT s.deleted
  WHERE NOT h.deleted AND h.rn > 1
)
SELECT CASE WHEN marker_source LIKE 'enrich*%' THEN 'enrich*'
            WHEN marker_source LIKE 'event:%' THEN 'event:*'
            WHEN marker_source LIKE 'seed%' OR marker_source = 'law-settler' THEN 'seed scripts / law-settler'
            ELSE marker_source END AS marker_class,
       count(*) AS transitions, count(DISTINCT src_tag) AS source_tags
FROM t GROUP BY 1 ORDER BY 2 DESC;

\echo '== 3l. transitions (deleted = false) by class'
-- W1  = wave-1 bulk completion, scripts/bulk-promote-corpus.ts WAVE1_RULES: RECORDED→SETTLED,
--       occurredAt = claimEmergedAt (the baseline's own date), no marker source.
-- W2  = wave-2-style entry rows on retraction / repeal baselines (crossref_retractions_v1,
--       nz_repealed_acts_v1): a publication/enactment row prepended before the REVERSED
--       baseline; no row-level source, but the claim's own Edge documents the event.
-- S   = row-sourced (sourceId → non-deleted Source).
-- O   = other unsourced.
WITH h AS (
  SELECT h."toAxis", h."occurredAt", h."sourceId", c.deleted, c."ingestedBy",
         row_number() OVER w AS rn,
         lag(h."toAxis") OVER w AS prev_to,
         lag(h."occurredAt") OVER w AS prev_at,
         (s.id IS NOT NULL AND NOT s.deleted) AS sourced
  FROM "ClaimStatusHistory" h
  JOIN "Claim" c ON c.id = h."claimId"
  LEFT JOIN "Source" s ON s.id = h."sourceId"
  WINDOW w AS (PARTITION BY h."claimId" ORDER BY h.seq ASC NULLS LAST, h."occurredAt", h."createdAt")
), k AS (
  SELECT *, CASE
      WHEN sourced THEN 'S row-sourced'
      WHEN "ingestedBy" IN ('voteview_v1','congress_votes_v1','uk_commons_v1','openparliament_ca_v1','howtheyvote_eu_v1',
                            'eu_parliament_v1','tweedekamer_v1','openfda_labels_v1','canada_bills_v1')
           AND prev_to = 'RECORDED' AND "toAxis" = 'SETTLED' THEN 'W1 bulk same-date completion'
      WHEN "ingestedBy" IN ('crossref_retractions_v1','nz_repealed_acts_v1','retraction_watch_v1') THEN 'W2 retraction/repeal entry row'
      ELSE 'O other unsourced' END AS class
  FROM h WHERE NOT deleted AND rn > 1
)
SELECT coalesce(class, 'TOTAL') AS class, coalesce("ingestedBy", '(all pipelines)') AS pipeline,
       count(*) AS transitions,
       count(*) FILTER (WHERE "toAxis" IS DISTINCT FROM prev_to) AS axis_changed,
       count(*) FILTER (WHERE "occurredAt" = prev_at)            AS same_timestamp_as_previous,
       count(*) FILTER (WHERE "occurredAt" > prev_at)            AS later_than_previous,
       count(*) FILTER (WHERE "occurredAt" < prev_at)            AS earlier_than_previous
FROM k GROUP BY ROLLUP (class, "ingestedBy")
ORDER BY class NULLS LAST, ("ingestedBy" IS NOT NULL), transitions DESC;

\echo '== 3m. trajectory-layer candidates: claims (deleted = false) under alternative definitions'
-- T1 = ≥1 transition that changes axis, is row-sourced, has a non-sentinel date,
--      and is dated strictly after the previous row.
-- T2 = T1 ∪ claims with a W2 transition (retraction/repeal) that changes axis, is
--      strictly later than the previous row, and whose claim has a non-deleted
--      Edge to a URL-bearing Source.
-- T0 = ≥1 axis-changing transition of any kind (includes W1 same-date completions).
WITH h AS (
  SELECT h."claimId", h."toAxis", h."occurredAt", c.deleted, c."ingestedBy", c."externalId", c."verificationStatus",
         row_number() OVER w AS rn,
         lag(h."toAxis") OVER w AS prev_to,
         lag(h."occurredAt") OVER w AS prev_at,
         (s.id IS NOT NULL AND NOT s.deleted) AS sourced,
         (h."occurredAt"::date = DATE '1970-01-01' OR h."occurredAt" >= TIMESTAMP '2100-01-01'
            OR h."occurredAt" > now()) AS sentinel
  FROM "ClaimStatusHistory" h
  JOIN "Claim" c ON c.id = h."claimId"
  LEFT JOIN "Source" s ON s.id = h."sourceId"
  WINDOW w AS (PARTITION BY h."claimId" ORDER BY h.seq ASC NULLS LAST, h."occurredAt", h."createdAt")
), urlclaims AS (
  SELECT DISTINCT e."claimId" FROM "Edge" e JOIN "Source" s ON s.id = e."sourceId"
  WHERE NOT e.deleted AND NOT s.deleted AND s.url ~* '^https?://[a-z0-9.-]+\.[a-z]{2,}'
), per AS (
  SELECT h."claimId",
         bool_or(rn > 1 AND "toAxis" IS DISTINCT FROM prev_to) AS t0,
         bool_or(rn > 1 AND "toAxis" IS DISTINCT FROM prev_to AND sourced AND NOT sentinel AND "occurredAt" > prev_at) AS t1,
         bool_or(rn > 1 AND "toAxis" IS DISTINCT FROM prev_to AND NOT sourced AND NOT sentinel AND "occurredAt" > prev_at
                 AND "ingestedBy" IN ('crossref_retractions_v1','nz_repealed_acts_v1','retraction_watch_v1')) AS w2,
         bool_or(coalesce("externalId" LIKE 'trajectory:%', false) AND coalesce("verificationStatus" <> 'DEPRECATED', true)) AS curated
  FROM h WHERE NOT deleted GROUP BY h."claimId"
)
SELECT count(*) FILTER (WHERE t0)                                  AS t0_any_axis_change,
       count(*) FILTER (WHERE t1)                                  AS t1_row_sourced_dated_later,
       count(*) FILTER (WHERE t1 AND curated)                      AS t1_of_which_curated,
       count(*) FILTER (WHERE t1 OR (w2 AND u."claimId" IS NOT NULL)) AS t2_t1_plus_retraction_repeal,
       count(*) FILTER (WHERE curated)                             AS curated_with_history,
       count(*) FILTER (WHERE curated AND NOT t1)                  AS curated_not_in_t1
FROM per LEFT JOIN urlclaims u ON u."claimId" = per."claimId";

\echo '== 3n. T1 claims by pipeline (deleted = false)'
WITH h AS (
  SELECT h."claimId", h."toAxis", h."occurredAt", c.deleted, c."ingestedBy",
         row_number() OVER w AS rn,
         lag(h."toAxis") OVER w AS prev_to,
         lag(h."occurredAt") OVER w AS prev_at,
         (s.id IS NOT NULL AND NOT s.deleted) AS sourced,
         (h."occurredAt"::date = DATE '1970-01-01' OR h."occurredAt" >= TIMESTAMP '2100-01-01'
            OR h."occurredAt" > now()) AS sentinel
  FROM "ClaimStatusHistory" h
  JOIN "Claim" c ON c.id = h."claimId"
  LEFT JOIN "Source" s ON s.id = h."sourceId"
  WINDOW w AS (PARTITION BY h."claimId" ORDER BY h.seq ASC NULLS LAST, h."occurredAt", h."createdAt")
)
SELECT "ingestedBy", count(DISTINCT "claimId") AS t1_claims, count(*) AS t1_transitions
FROM h
WHERE NOT deleted AND rn > 1 AND "toAxis" IS DISTINCT FROM prev_to AND sourced AND NOT sentinel AND "occurredAt" > prev_at
GROUP BY 1 ORDER BY 2 DESC;
