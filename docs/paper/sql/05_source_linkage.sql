-- 05_source_linkage.sql — claim → Source linkage via Edge (and via status-history markers).
-- "Resolvable-looking URL" = Source.url matching ^https?://<host>.<tld> (syntax only;
-- liveness is Phase 2, scripts/paper/url-liveness.ts). Edges and Sources with
-- deleted = true are ignored. Denominator: corpus (Claim.deleted = false).

\echo '== 5a. claims with ≥1 Edge to a Source / with ≥1 URL-bearing Source'
WITH e AS (
  SELECT e."claimId",
         bool_or(s.url ~* '^https?://[a-z0-9.-]+\.[a-z]{2,}') AS has_url
  FROM "Edge" e JOIN "Source" s ON s.id = e."sourceId"
  WHERE NOT e.deleted AND NOT s.deleted
  GROUP BY e."claimId"
), m AS (
  SELECT DISTINCT h."claimId"
  FROM "ClaimStatusHistory" h JOIN "Source" s ON s.id = h."sourceId"
  WHERE NOT s.deleted AND s.url ~* '^https?://[a-z0-9.-]+\.[a-z]{2,}'
)
SELECT count(*)                                                    AS corpus,
       count(e."claimId")                                          AS with_edge_to_source,
       round(100.0 * count(e."claimId") / count(*), 3)             AS pct_with_edge,
       count(*) FILTER (WHERE e.has_url)                           AS with_url_via_edge,
       round(100.0 * count(*) FILTER (WHERE e.has_url) / count(*), 3) AS pct_url_via_edge,
       count(*) FILTER (WHERE e.has_url OR m."claimId" IS NOT NULL) AS with_url_via_edge_or_marker,
       round(100.0 * count(*) FILTER (WHERE e.has_url OR m."claimId" IS NOT NULL) / count(*), 3) AS pct_url_edge_or_marker,
       count(*) FILTER (WHERE e."claimId" IS NULL AND m."claimId" IS NULL) AS with_no_source_link,
       round(100.0 * count(*) FILTER (WHERE e."claimId" IS NULL AND m."claimId" IS NULL) / count(*), 3) AS pct_no_source_link
FROM "Claim" c
LEFT JOIN e ON e."claimId" = c.id
LEFT JOIN m ON m."claimId" = c.id
WHERE NOT c.deleted;

\echo '== 5b. claims with no URL-bearing source, by pipeline (deleted = false)'
WITH u AS (
  SELECT DISTINCT e."claimId" FROM "Edge" e JOIN "Source" s ON s.id = e."sourceId"
  WHERE NOT e.deleted AND NOT s.deleted AND s.url ~* '^https?://[a-z0-9.-]+\.[a-z]{2,}'
  UNION
  SELECT h."claimId" FROM "ClaimStatusHistory" h JOIN "Source" s ON s.id = h."sourceId"
  WHERE NOT s.deleted AND s.url ~* '^https?://[a-z0-9.-]+\.[a-z]{2,}'
)
SELECT c."ingestedBy", count(*) AS claims_without_url,
       (SELECT count(*) FROM "Claim" x WHERE x."ingestedBy" = c."ingestedBy" AND NOT x.deleted) AS pipeline_claims
FROM "Claim" c LEFT JOIN u ON u."claimId" = c.id
WHERE NOT c.deleted AND u."claimId" IS NULL
GROUP BY 1 ORDER BY 2 DESC;

\echo '== 5c. Edge.type and Source.methodologyType (non-deleted)'
SELECT 'Edge.type' AS field, type AS value, count(*) FROM "Edge" WHERE NOT deleted GROUP BY 2
UNION ALL
SELECT 'Source.methodologyType', "methodologyType", count(*) FROM "Source" WHERE NOT deleted GROUP BY 2
ORDER BY 1, 3 DESC;

\echo '== 5d. table sizes'
SELECT 'Source' AS t, count(*) AS rows, count(*) FILTER (WHERE NOT deleted) AS not_deleted,
       count(*) FILTER (WHERE NOT deleted AND url ~* '^https?://[a-z0-9.-]+\.[a-z]{2,}') AS not_deleted_with_url
FROM "Source"
UNION ALL
SELECT 'Edge', count(*), count(*) FILTER (WHERE NOT deleted), NULL FROM "Edge";
