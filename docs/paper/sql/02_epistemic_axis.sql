-- 02_epistemic_axis.sql — Claim."epistemicAxis" (String?, no DB enum).
-- Vocabulary documented in prisma/schema.prisma enum FactStatus:
--   RECORDED SETTLED CONTESTED OPEN UNRESOLVABLE REVERSED ABANDONED.
-- Every distinct value present is listed, including any outside FactStatus.

\echo '== 2a. epistemicAxis, corpus (deleted = false)'
SELECT coalesce("epistemicAxis", '(null)') AS "epistemicAxis",
       count(*) AS claims,
       round(100.0 * count(*) / sum(count(*)) OVER (), 4) AS pct,
       ("epistemicAxis" IN ('RECORDED','SETTLED','CONTESTED','OPEN','UNRESOLVABLE','REVERSED','ABANDONED')) AS in_factstatus_enum
FROM "Claim" WHERE NOT deleted
GROUP BY "epistemicAxis" ORDER BY 2 DESC;

\echo '== 2b. epistemicAxis, live default view (deleted = false, not DEPRECATED)'
SELECT coalesce("epistemicAxis", '(null)') AS "epistemicAxis",
       count(*) AS claims,
       round(100.0 * count(*) / sum(count(*)) OVER (), 4) AS pct
FROM "Claim" WHERE NOT deleted AND "verificationStatus" IS DISTINCT FROM 'DEPRECATED'
GROUP BY "epistemicAxis" ORDER BY 2 DESC;

\echo '== 2c. every distinct epistemicAxis value in the table, deleted rows included'
SELECT coalesce("epistemicAxis", '(null)') AS "epistemicAxis", count(*) AS all_rows
FROM "Claim" GROUP BY "epistemicAxis" ORDER BY 2 DESC;

\echo '== 2d. null epistemicAxis (deleted = false) by pipeline'
SELECT "ingestedBy", count(*) AS null_axis
FROM "Claim" WHERE NOT deleted AND "epistemicAxis" IS NULL
GROUP BY 1 ORDER BY 2 DESC;

\echo '== 2e. ABANDONED / UNRESOLVABLE / OPEN / CONTESTED claims (deleted = false) by pipeline'
SELECT "epistemicAxis", "ingestedBy", count(*) AS claims
FROM "Claim"
WHERE NOT deleted AND "epistemicAxis" IN ('ABANDONED','UNRESOLVABLE','OPEN','CONTESTED')
GROUP BY 1, 2 ORDER BY 1, 3 DESC;

\echo '== 2f. epistemicAxis vs the toAxis of the claim''s last ClaimStatusHistory row (deleted = false)'
WITH last AS (
  SELECT DISTINCT ON ("claimId") "claimId", "toAxis"
  FROM "ClaimStatusHistory"
  ORDER BY "claimId", seq DESC NULLS FIRST, "occurredAt" DESC, "createdAt" DESC
)
SELECT count(*) FILTER (WHERE l."claimId" IS NULL)                                  AS no_history,
       count(*) FILTER (WHERE l."toAxis" = c."epistemicAxis")                        AS axis_equals_last_toAxis,
       count(*) FILTER (WHERE l."claimId" IS NOT NULL AND l."toAxis" IS DISTINCT FROM c."epistemicAxis") AS axis_differs_from_last_toAxis
FROM "Claim" c LEFT JOIN last l ON l."claimId" = c.id
WHERE NOT c.deleted;

\echo '== 2g. summary (deleted = false)'
SELECT count(*) AS corpus,
       count("epistemicAxis") AS non_null_axis,
       round(100.0 * count("epistemicAxis") / count(*), 3) AS pct_non_null,
       count(*) FILTER (WHERE "epistemicAxis" IN ('SETTLED','RECORDED')) AS settled_or_recorded,
       round(100.0 * count(*) FILTER (WHERE "epistemicAxis" IN ('SETTLED','RECORDED')) / count(*), 3) AS pct_settled_or_recorded
FROM "Claim" WHERE NOT deleted;
