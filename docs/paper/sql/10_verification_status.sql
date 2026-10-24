-- 10_verification_status.sql — what carries each Claim.verificationStatus value.
-- Code side (which script writes which literal): scripts/paper/verification-status.ts.

\echo '== 10a. verificationStatus × humanReviewed × autoApproved (deleted = false)'
SELECT coalesce("verificationStatus", '(null)') AS "verificationStatus",
       count(*) AS claims,
       count(*) FILTER (WHERE "humanReviewed") AS human_reviewed,
       count(*) FILTER (WHERE "autoApproved")  AS auto_approved,
       count(*) FILTER (WHERE NOT "humanReviewed" AND NOT "autoApproved") AS neither,
       count(DISTINCT "ingestedBy") AS pipelines
FROM "Claim" WHERE NOT deleted
GROUP BY 1 ORDER BY 2 DESC;

\echo '== 10b. pipelines per verificationStatus value (deleted = false)'
SELECT coalesce("verificationStatus", '(null)') AS "verificationStatus", "ingestedBy", count(*) AS claims,
       count(*) FILTER (WHERE "humanReviewed") AS human_reviewed,
       count(*) FILTER (WHERE "autoApproved")  AS auto_approved
FROM "Claim" WHERE NOT deleted
GROUP BY 1, 2 ORDER BY 1, 3 DESC;

\echo '== 10c. pipelines with more than one verificationStatus value (deleted = false)'
SELECT "ingestedBy", string_agg(coalesce("verificationStatus", '(null)') || ' ' || n, ', ' ORDER BY n DESC) AS mix
FROM (SELECT "ingestedBy", "verificationStatus", count(*) AS n FROM "Claim" WHERE NOT deleted GROUP BY 1, 2) x
GROUP BY 1 HAVING count(*) > 1 ORDER BY 1;

\echo '== 10d. openalex_v1: verificationStatus by createdAt range (deleted = false)'
SELECT coalesce("verificationStatus", '(null)') AS "verificationStatus", count(*) AS claims,
       min("createdAt")::date AS first_created, max("createdAt")::date AS last_created
FROM "Claim" WHERE NOT deleted AND "ingestedBy" = 'openalex_v1'
GROUP BY 1 ORDER BY 2 DESC;

\echo '== 10e. VERIFIED claims with humanReviewed = true, by pipeline and reviewedBy (deleted = false)'
SELECT "ingestedBy", coalesce("reviewedBy", '(null)') AS "reviewedBy", count(*) AS claims
FROM "Claim" WHERE NOT deleted AND "verificationStatus" = 'VERIFIED' AND "humanReviewed"
GROUP BY 1, 2 ORDER BY 3 DESC;

\echo '== 10f. humanReviewed = true, all corpus claims, by reviewedBy'
SELECT coalesce("reviewedBy", '(null)') AS "reviewedBy", count(*) AS claims, count(DISTINCT "ingestedBy") AS pipelines
FROM "Claim" WHERE NOT deleted AND "humanReviewed"
GROUP BY 1 ORDER BY 2 DESC;
