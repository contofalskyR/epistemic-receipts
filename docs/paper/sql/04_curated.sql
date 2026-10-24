-- 04_curated.sql — curated trajectories.
-- Definition in code: lib/trajectory-list.ts CURATED_WHERE =
--   LIVE_CLAIM_WHERE (deleted = false AND verificationStatus IS DISTINCT FROM 'DEPRECATED')
--   AND externalId LIKE 'trajectory:%'.
-- (lib/corpus-completeness.ts CURATED_EDITORIAL_PREFIXES is a different, pipeline-
-- based notion — seed:*, seed-*, law-settler, book-analysis:* — reported in 4c.)

\echo '== 4a. curated trajectories (CURATED_WHERE)'
SELECT count(*) AS curated_live,
       (SELECT count(*) FROM "Claim" WHERE "externalId" LIKE 'trajectory:%') AS trajectory_externalId_all_rows,
       (SELECT count(*) FROM "Claim" WHERE "externalId" LIKE 'trajectory:%' AND deleted) AS trajectory_externalId_deleted
FROM "Claim"
WHERE NOT deleted AND "verificationStatus" IS DISTINCT FROM 'DEPRECATED' AND "externalId" LIKE 'trajectory:%';

\echo '== 4b. curated trajectories by pipeline and number of ClaimStatusHistory rows'
WITH cur AS (
  SELECT c.id, c."ingestedBy", (SELECT count(*) FROM "ClaimStatusHistory" h WHERE h."claimId" = c.id) AS n
  FROM "Claim" c
  WHERE NOT c.deleted AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED' AND c."externalId" LIKE 'trajectory:%'
)
SELECT "ingestedBy",
       count(*) AS curated,
       count(*) FILTER (WHERE n = 0) AS rows_0,
       count(*) FILTER (WHERE n = 1) AS rows_1,
       count(*) FILTER (WHERE n = 2) AS rows_2,
       count(*) FILTER (WHERE n = 3) AS rows_3,
       count(*) FILTER (WHERE n >= 4) AS rows_ge4
FROM cur
GROUP BY 1 ORDER BY 2 DESC;

\echo '== 4c. CURATED_EDITORIAL pipelines (lib/corpus-completeness.ts), deleted = false'
SELECT "ingestedBy", count(*) AS claims,
       count(*) FILTER (WHERE "externalId" LIKE 'trajectory:%') AS with_trajectory_externalId,
       count(*) FILTER (WHERE "humanReviewed") AS humanReviewed_true
FROM "Claim"
WHERE NOT deleted AND ("ingestedBy" LIKE 'seed:%' OR "ingestedBy" LIKE 'seed-%'
      OR "ingestedBy" = 'law-settler' OR "ingestedBy" LIKE 'book-analysis:%')
GROUP BY 1 ORDER BY 2 DESC;

\echo '== 4d. curated trajectories: totals'
WITH cur AS (
  SELECT c.id, c."humanReviewed", (SELECT count(*) FROM "ClaimStatusHistory" h WHERE h."claimId" = c.id) AS n
  FROM "Claim" c
  WHERE NOT c.deleted AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED' AND c."externalId" LIKE 'trajectory:%'
)
SELECT count(*) AS curated, count(*) FILTER (WHERE n = 1) AS rows_1, count(*) FILTER (WHERE n = 2) AS rows_2,
       count(*) FILTER (WHERE n = 3) AS rows_3, count(*) FILTER (WHERE n >= 4) AS rows_ge4,
       count(*) FILTER (WHERE n >= 2) AS rows_ge2, count(*) FILTER (WHERE "humanReviewed") AS humanReviewed_true
FROM cur;
