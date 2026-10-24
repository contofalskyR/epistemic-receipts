-- 12_examples.sql — one real example row per exported table, for the "example"
-- column of docs/paper/data-dictionary.md. Long text truncated to 160 characters.
-- Example claim: the 1998 59–41 cloture vote cited on /corrections (cmq5l0zit5oyfsal83wd26glu).
\x on

\echo '== 12a. Claim'
SELECT id, left(text, 160) AS text, "createdAt", "currentStatus", "claimType", "parentClaimId", "claimEmergedAt",
       "claimEmergedPrecision", "ingestedBy", "humanReviewed", "reviewConfidence", "reviewedAt", "reviewedBy",
       "externalId", deleted, "autoApproved", "verificationStatus", "openAlexId", left(metadata::text, 160) AS metadata,
       "epistemicStatus", "epistemicAxis", "updatedAt"
FROM "Claim" WHERE id = 'cmq5l0zit5oyfsal83wd26glu';

\echo '== 12b. ClaimStatusHistory (that claim)'
SELECT id, "claimId", "fromAxis", "toAxis", community, left(reason, 160) AS reason, "occurredAt", "datePrecision",
       "sourceId", "createdAt", seq
FROM "ClaimStatusHistory" WHERE "claimId" = 'cmq5l0zit5oyfsal83wd26glu' ORDER BY seq;

\echo '== 12c. ClaimStatusHistory (a row-sourced curated transition)'
SELECT h.id, h."claimId", h."fromAxis", h."toAxis", h.community, left(h.reason, 160) AS reason, h."occurredAt",
       h."datePrecision", h."sourceId", h."createdAt", h.seq
FROM "ClaimStatusHistory" h JOIN "Claim" c ON c.id = h."claimId"
WHERE c."externalId" = 'trajectory:goeppert-mayer-jensen-nuclear-shell-model-1949' AND h.seq = 2;

\echo '== 12d. Edge + Source (that claim)'
SELECT e.id, e."sourceId", e."claimId", e.type, e."evidenceType", e.deleted, e."createdAt", e."ingestedBy",
       e."humanReviewed", e."reviewConfidence", e."reviewedAt", e."reviewedBy", e."autoApproved"
FROM "Edge" e WHERE e."claimId" = 'cmq5l0zit5oyfsal83wd26glu' ORDER BY e."createdAt" LIMIT 1;
SELECT s.id, s.name, s.url, s."publishedAt", s."methodologyType", s."createdAt", s."ingestedBy", s."humanReviewed",
       s."reviewConfidence", s."reviewedAt", s."reviewedBy", s."externalId", s.deleted, s."autoApproved"
FROM "Source" s JOIN "Edge" e ON e."sourceId" = s.id WHERE e."claimId" = 'cmq5l0zit5oyfsal83wd26glu'
ORDER BY e."createdAt" LIMIT 1;

\echo '== 12e. ClaimRelation (a REVERSED paper → retraction notice)'
SELECT id, "fromClaimId", "toClaimId", "relationType", year, left("followUpContext"::text, 160) AS "followUpContext", "createdAt"
FROM "ClaimRelation" WHERE "relationType" = 'REVERSED' ORDER BY id LIMIT 1;
