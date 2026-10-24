-- 14_relation_heuristics.sql — how each ClaimRelation was made, for the export's
-- linkKind column and the core / machine-derived-context file split.
\echo '== 14a. relationType × followUpContext.heuristic / .method / .via (both claims not deleted)'
SELECT r."relationType",
       coalesce(r."followUpContext"->>'heuristic', '(none)') AS heuristic,
       coalesce(r."followUpContext"->>'method', '') AS method,
       coalesce(r."followUpContext"->>'via', '') AS via,
       count(*) AS relations
FROM "ClaimRelation" r JOIN "Claim" a ON a.id = r."fromClaimId" JOIN "Claim" b ON b.id = r."toClaimId"
WHERE NOT a.deleted AND NOT b.deleted
GROUP BY 1, 2, 3, 4 ORDER BY 1, 5 DESC;
