-- 06_coverage.sql — coverage by domain and by decade of Claim."claimEmergedAt".
-- Domain = docs/paper/domain-map.csv (pipeline → domain, one row per ingestedBy
-- value), passed in by scripts/paper/run-sql.sh as :domain_map. Pipelines missing
-- from the CSV show as UNMAPPED. Denominator: corpus (deleted = false).
-- Decades for years ≥ 1800; earlier years bucketed by century; null kept apart.

\echo '== 6a. claims by domain'
WITH map(pipeline, domain) AS :domain_map
SELECT coalesce(m.domain, 'UNMAPPED') AS domain,
       count(DISTINCT c."ingestedBy") AS pipelines,
       count(*) AS claims,
       round(100.0 * count(*) / sum(count(*)) OVER (), 3) AS pct
FROM "Claim" c LEFT JOIN map m ON m.pipeline = c."ingestedBy"
WHERE NOT c.deleted
GROUP BY 1 ORDER BY 3 DESC;

\echo '== 6b. epistemicAxis by domain'
WITH map(pipeline, domain) AS :domain_map
SELECT coalesce(m.domain, 'UNMAPPED') AS domain,
       count(*) FILTER (WHERE c."epistemicAxis" = 'RECORDED')     AS recorded,
       count(*) FILTER (WHERE c."epistemicAxis" = 'SETTLED')      AS settled,
       count(*) FILTER (WHERE c."epistemicAxis" = 'REVERSED')     AS reversed,
       count(*) FILTER (WHERE c."epistemicAxis" = 'CONTESTED')    AS contested,
       count(*) FILTER (WHERE c."epistemicAxis" = 'OPEN')         AS open,
       count(*) FILTER (WHERE c."epistemicAxis" = 'ABANDONED')    AS abandoned,
       count(*) FILTER (WHERE c."epistemicAxis" = 'UNRESOLVABLE') AS unresolvable,
       count(*) FILTER (WHERE c."epistemicAxis" IS NULL)          AS null_axis,
       count(*) AS total
FROM "Claim" c LEFT JOIN map m ON m.pipeline = c."ingestedBy"
WHERE NOT c.deleted
GROUP BY 1 ORDER BY total DESC;

\echo '== 6c. claimEmergedAt: null, precision, sentinels'
SELECT count(*) AS corpus,
       count(*) FILTER (WHERE "claimEmergedAt" IS NULL) AS emerged_null,
       count(*) FILTER (WHERE "claimEmergedAt"::date = DATE '1970-01-01') AS emerged_1970_01_01,
       count(*) FILTER (WHERE "claimEmergedAt" > now()) AS emerged_in_future,
       count(*) FILTER (WHERE extract(year FROM "claimEmergedAt") < 1800) AS emerged_before_1800,
       min("claimEmergedAt") AS min_emerged, max("claimEmergedAt") AS max_emerged
FROM "Claim" WHERE NOT deleted;

SELECT coalesce("claimEmergedPrecision", '(null)') AS "claimEmergedPrecision", count(*) AS claims
FROM "Claim" WHERE NOT deleted GROUP BY 1 ORDER BY 2 DESC;

\echo '== 6d. claims by decade (century before 1800)'
WITH b AS (
  SELECT CASE
           WHEN "claimEmergedAt" IS NULL THEN NULL
           WHEN extract(year FROM "claimEmergedAt") >= 1800 THEN (floor(extract(year FROM "claimEmergedAt") / 10) * 10)::int
           ELSE (floor(extract(year FROM "claimEmergedAt") / 100) * 100)::int
         END AS bucket_start,
         (extract(year FROM "claimEmergedAt") < 1800) AS is_century
  FROM "Claim" WHERE NOT deleted
)
SELECT coalesce(bucket_start::text || CASE WHEN is_century THEN 's (century)' ELSE 's' END, '(null)') AS bucket,
       count(*) AS claims
FROM b GROUP BY bucket_start, is_century ORDER BY bucket_start NULLS LAST;

\echo '== 6e. claims by domain × bucket (decade ≥ 1800, century before; CSV-friendly long form)'
WITH map(pipeline, domain) AS :domain_map, b AS (
  SELECT coalesce(m.domain, 'UNMAPPED') AS domain,
         CASE
           WHEN c."claimEmergedAt" IS NULL THEN NULL
           WHEN extract(year FROM c."claimEmergedAt") >= 1800 THEN (floor(extract(year FROM c."claimEmergedAt") / 10) * 10)::int
           ELSE (floor(extract(year FROM c."claimEmergedAt") / 100) * 100)::int
         END AS bucket_start
  FROM "Claim" c LEFT JOIN map m ON m.pipeline = c."ingestedBy"
  WHERE NOT c.deleted
)
SELECT domain, bucket_start, count(*) AS claims
FROM b GROUP BY 1, 2 ORDER BY 1, 2 NULLS LAST;

\echo '== 6f. claims by domain × era (claimEmergedAt; null and sentinel kept apart)'
WITH map(pipeline, domain) AS :domain_map, b AS (
  SELECT coalesce(m.domain, 'UNMAPPED') AS domain,
         CASE
           WHEN c."claimEmergedAt" IS NULL THEN '9 null'
           WHEN c."claimEmergedAt"::date = DATE '1970-01-01' THEN '8 1970-01-01 (suspect sentinel)'
           WHEN c."claimEmergedAt" > now() THEN '7 after run date'
           WHEN extract(year FROM c."claimEmergedAt") < 1800 THEN '0 before 1800'
           WHEN extract(year FROM c."claimEmergedAt") < 1900 THEN '1 1800-1899'
           WHEN extract(year FROM c."claimEmergedAt") < 1950 THEN '2 1900-1949'
           WHEN extract(year FROM c."claimEmergedAt") < 1990 THEN '3 1950-1989'
           WHEN extract(year FROM c."claimEmergedAt") < 2010 THEN '4 1990-2009'
           ELSE '5 2010-present' END AS era
  FROM "Claim" c LEFT JOIN map m ON m.pipeline = c."ingestedBy"
  WHERE NOT c.deleted
)
SELECT domain,
       count(*) FILTER (WHERE era LIKE '0%') AS before_1800,
       count(*) FILTER (WHERE era LIKE '1%') AS "1800_1899",
       count(*) FILTER (WHERE era LIKE '2%') AS "1900_1949",
       count(*) FILTER (WHERE era LIKE '3%') AS "1950_1989",
       count(*) FILTER (WHERE era LIKE '4%') AS "1990_2009",
       count(*) FILTER (WHERE era LIKE '5%') AS "2010_present",
       count(*) FILTER (WHERE era LIKE '7%') AS after_run_date,
       count(*) FILTER (WHERE era LIKE '8%') AS on_1970_01_01,
       count(*) FILTER (WHERE era LIKE '9%') AS null_date,
       count(*) AS total
FROM b GROUP BY 1 ORDER BY total DESC;
