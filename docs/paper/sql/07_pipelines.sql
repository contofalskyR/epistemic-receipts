-- 07_pipelines.sql — ingest pipelines (ingestedBy) and source institutions.
-- "Source institution" proxy = the host of Source.url (lower-cased, leading
-- "www." stripped) for Sources linked by a non-deleted Edge to a corpus claim.
-- A host is not an institution (e.g. one agency may serve several hosts);
-- docs/paper/sources.md reports the top hosts per pipeline so the mapping to
-- named institutions can be done by hand.

\echo '== 7a. distinct ingestedBy values per table'
SELECT 'Claim (deleted = false)' AS t, count(DISTINCT "ingestedBy") AS distinct_ingestedBy FROM "Claim" WHERE NOT deleted
UNION ALL SELECT 'Claim (all rows)', count(DISTINCT "ingestedBy") FROM "Claim"
UNION ALL SELECT 'Source (deleted = false)', count(DISTINCT "ingestedBy") FROM "Source" WHERE NOT deleted
UNION ALL SELECT 'Edge (deleted = false)', count(DISTINCT "ingestedBy") FROM "Edge" WHERE NOT deleted;

\echo '== 7b. per pipeline: claims, edges, linked sources, distinct hosts, top hosts'
WITH ce AS (
  SELECT c."ingestedBy" AS pipeline, s.id AS source_id,
         lower(regexp_replace(substring(s.url FROM '^https?://([^/?#:]+)'), '^www\.', '')) AS host
  FROM "Claim" c
  JOIN "Edge" e ON e."claimId" = c.id AND NOT e.deleted
  JOIN "Source" s ON s.id = e."sourceId" AND NOT s.deleted
  WHERE NOT c.deleted
), agg AS (
  SELECT pipeline, count(*) AS edges, count(DISTINCT source_id) AS sources, count(DISTINCT host) AS distinct_hosts
  FROM ce GROUP BY 1
), hosts AS (
  SELECT pipeline, host, count(*) AS n,
         row_number() OVER (PARTITION BY pipeline ORDER BY count(*) DESC, host) AS r
  FROM ce WHERE host IS NOT NULL GROUP BY 1, 2
), top AS (
  SELECT pipeline, string_agg(host || ' ' || n, '; ' ORDER BY r) AS top_hosts FROM hosts WHERE r <= 3 GROUP BY 1
), claims AS (
  SELECT "ingestedBy" AS pipeline, count(*) AS claims FROM "Claim" WHERE NOT deleted GROUP BY 1
)
SELECT cl.pipeline, cl.claims, coalesce(a.edges, 0) AS edges, coalesce(a.sources, 0) AS sources,
       coalesce(a.distinct_hosts, 0) AS distinct_hosts, t.top_hosts
FROM claims cl LEFT JOIN agg a USING (pipeline) LEFT JOIN top t USING (pipeline)
ORDER BY cl.claims DESC;

\echo '== 7c. distinct source hosts across the corpus (Edge-linked, non-deleted)'
SELECT count(DISTINCT lower(regexp_replace(substring(s.url FROM '^https?://([^/?#:]+)'), '^www\.', ''))) AS distinct_hosts_all,
       count(DISTINCT lower(regexp_replace(substring(s.url FROM '^https?://([^/?#:]+)'), '^www\.', '')))
         FILTER (WHERE c."ingestedBy" NOT LIKE 'seed%' AND c."ingestedBy" NOT IN ('law-settler','manual')
                   AND c."ingestedBy" NOT LIKE 'book-analysis:%') AS distinct_hosts_bulk_pipelines
FROM "Claim" c
JOIN "Edge" e ON e."claimId" = c.id AND NOT e.deleted
JOIN "Source" s ON s.id = e."sourceId" AND NOT s.deleted
WHERE NOT c.deleted;

\echo '== 7d. Source / Edge ingestedBy values that are not Claim pipelines (non-deleted)'
SELECT 'Source' AS t, "ingestedBy", count(*) FROM "Source"
WHERE NOT deleted AND "ingestedBy" NOT IN (SELECT DISTINCT "ingestedBy" FROM "Claim") GROUP BY 2
UNION ALL
SELECT 'Edge', "ingestedBy", count(*) FROM "Edge"
WHERE NOT deleted AND "ingestedBy" NOT IN (SELECT DISTINCT "ingestedBy" FROM "Claim") GROUP BY 2
ORDER BY 1, 3 DESC;

\echo '== 7e. non-claim Source / Edge tags by class (non-deleted)'
SELECT t, CASE WHEN "ingestedBy" ~* '^enrich|enrichment' THEN 'enrich*'
               WHEN "ingestedBy" LIKE 'event:%' THEN 'event:*' ELSE "ingestedBy" END AS tag_class,
       count(DISTINCT "ingestedBy") AS tags, sum(n) AS rows
FROM (
  SELECT 'Source' AS t, "ingestedBy", count(*) AS n FROM "Source"
  WHERE NOT deleted AND "ingestedBy" NOT IN (SELECT DISTINCT "ingestedBy" FROM "Claim") GROUP BY 2
  UNION ALL
  SELECT 'Edge', "ingestedBy", count(*) FROM "Edge"
  WHERE NOT deleted AND "ingestedBy" NOT IN (SELECT DISTINCT "ingestedBy" FROM "Claim") GROUP BY 2
) x GROUP BY 1, 2 ORDER BY 1, 4 DESC;
