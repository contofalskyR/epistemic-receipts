-- 13_export_counts.sql — row counts under the proposed export rule (Phase 3):
-- deleted rows excluded, and rows that hang off a deleted claim excluded.
--   Claim               deleted = false
--   ClaimStatusHistory  claim not deleted
--   Edge                deleted = false, claim not deleted, source not deleted
--   Source              deleted = false (all Sources, linked or not; linked count shown)
--   ClaimRelation       both claims not deleted

\echo '== 13a. export row counts'
SELECT 'Claim' AS t, count(*) AS export_rows, (SELECT count(*) FROM "Claim") AS table_rows FROM "Claim" WHERE NOT deleted
UNION ALL
SELECT 'ClaimStatusHistory', count(*), (SELECT count(*) FROM "ClaimStatusHistory")
FROM "ClaimStatusHistory" h JOIN "Claim" c ON c.id = h."claimId" WHERE NOT c.deleted
UNION ALL
SELECT 'Edge', count(*), (SELECT count(*) FROM "Edge")
FROM "Edge" e JOIN "Claim" c ON c.id = e."claimId" JOIN "Source" s ON s.id = e."sourceId"
WHERE NOT e.deleted AND NOT c.deleted AND NOT s.deleted
UNION ALL
SELECT 'Source', count(*), (SELECT count(*) FROM "Source") FROM "Source" WHERE NOT deleted
UNION ALL
SELECT 'ClaimRelation', count(*), (SELECT count(*) FROM "ClaimRelation")
FROM "ClaimRelation" r JOIN "Claim" a ON a.id = r."fromClaimId" JOIN "Claim" b ON b.id = r."toClaimId"
WHERE NOT a.deleted AND NOT b.deleted;

\echo '== 13b. Sources referenced by an exported Edge or history row, and unreferenced'
WITH used AS (
  SELECT e."sourceId" AS id FROM "Edge" e JOIN "Claim" c ON c.id = e."claimId" WHERE NOT e.deleted AND NOT c.deleted
  UNION
  SELECT h."sourceId" FROM "ClaimStatusHistory" h JOIN "Claim" c ON c.id = h."claimId" WHERE NOT c.deleted AND h."sourceId" IS NOT NULL
)
SELECT count(*) FILTER (WHERE u.id IS NOT NULL) AS referenced, count(*) FILTER (WHERE u.id IS NULL) AS unreferenced
FROM "Source" s LEFT JOIN used u ON u.id = s.id WHERE NOT s.deleted;

\echo '== 13c. ClaimRelation export rows by heuristic presence'
SELECT CASE WHEN r."followUpContext" ? 'heuristic' THEN 'heuristic link (followUpContext.heuristic)'
            WHEN r."followUpContext" ? 'method' THEN 'method-recorded link (followUpContext.method)'
            WHEN r."followUpContext" IS NULL THEN 'no context recorded'
            ELSE 'context without heuristic/method' END AS kind,
       count(*) AS relations
FROM "ClaimRelation" r JOIN "Claim" a ON a.id = r."fromClaimId" JOIN "Claim" b ON b.id = r."toClaimId"
WHERE NOT a.deleted AND NOT b.deleted GROUP BY 1 ORDER BY 2 DESC;
