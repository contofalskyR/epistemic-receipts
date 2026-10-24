-- 11_schema_values.sql — the values actually present in the categorical columns of
-- the five exported tables (Claim, ClaimStatusHistory, Source, Edge, ClaimRelation),
-- for docs/paper/data-records.md. Not limited to deleted = false unless stated.

\echo '== 11a. ClaimRelation.relationType (all rows) and how many touch deleted claims'
SELECT r."relationType", count(*) AS relations,
       count(*) FILTER (WHERE fc.deleted OR tc.deleted) AS touching_deleted_claim,
       count(*) FILTER (WHERE r."followUpContext" IS NOT NULL) AS with_followUpContext,
       count(*) FILTER (WHERE r.year IS NOT NULL) AS with_year
FROM "ClaimRelation" r JOIN "Claim" fc ON fc.id = r."fromClaimId" JOIN "Claim" tc ON tc.id = r."toClaimId"
GROUP BY 1 ORDER BY 2 DESC;

\echo '== 11b. Claim categorical columns (deleted = false)'
SELECT 'claimType' AS col, "claimType" AS value, count(*) FROM "Claim" WHERE NOT deleted GROUP BY 2
UNION ALL SELECT 'currentStatus (legacy)', "currentStatus", count(*) FROM "Claim" WHERE NOT deleted GROUP BY 2
UNION ALL SELECT 'epistemicStatus (legacy)', coalesce("epistemicStatus", '(null)'), count(*) FROM "Claim" WHERE NOT deleted GROUP BY 2
UNION ALL SELECT 'reviewConfidence', coalesce("reviewConfidence"::text, '(null)'), count(*) FROM "Claim" WHERE NOT deleted GROUP BY 2
UNION ALL SELECT 'claimEmergedPrecision', coalesce("claimEmergedPrecision", '(null)'), count(*) FROM "Claim" WHERE NOT deleted GROUP BY 2
ORDER BY 1, 3 DESC;

\echo '== 11c. Claim null counts and other field coverage (deleted = false)'
SELECT count(*) AS corpus,
       count("parentClaimId") AS parentClaimId, count("claimEmergedAt") AS claimEmergedAt,
       count("externalId") AS externalId, count("openAlexId") AS openAlexId, count(metadata) AS metadata,
       count("epistemicStatus") AS epistemicStatus, count("reviewedAt") AS reviewedAt, count("reviewedBy") AS reviewedBy,
       count("reviewConfidence") AS reviewConfidence
FROM "Claim" WHERE NOT deleted;

\echo '== 11d. top-level Claim.metadata keys (deleted = false), top 40'
SELECT k AS key, count(*) AS claims, count(DISTINCT c."ingestedBy") AS pipelines
FROM "Claim" c, jsonb_object_keys(CASE WHEN jsonb_typeof(c.metadata) = 'object' THEN c.metadata ELSE '{}'::jsonb END) k
WHERE NOT c.deleted GROUP BY 1 ORDER BY 2 DESC LIMIT 40;

\echo '== 11e. Source null counts'
SELECT count(*) AS sources, count(url) AS url, count("publishedAt") AS publishedAt, count("externalId") AS externalId,
       count(*) FILTER (WHERE "humanReviewed") AS humanReviewed_true, count(*) FILTER (WHERE "autoApproved") AS autoApproved_true,
       count("reviewedBy") AS reviewedBy
FROM "Source";

\echo '== 11f. Edge.evidenceType, review flags'
SELECT "evidenceType", count(*) AS edges, count(*) FILTER (WHERE "humanReviewed") AS humanReviewed_true,
       count(*) FILTER (WHERE "autoApproved") AS autoApproved_true, count(*) FILTER (WHERE deleted) AS deleted
FROM "Edge" GROUP BY 1 ORDER BY 2 DESC;

\echo '== 11g. ClaimStatusHistory null counts'
SELECT count(*) AS rows, count("fromAxis") AS fromAxis, count(reason) AS reason, count("datePrecision") AS datePrecision,
       count("sourceId") AS sourceId, count(seq) AS seq
FROM "ClaimStatusHistory";

\echo '== 11h. row counts of other tables a paper might cite'
SELECT 'EdgeRevision' AS t, count(*) FROM "EdgeRevision"
UNION ALL SELECT 'MetaEdge', count(*) FROM "MetaEdge"
UNION ALL SELECT 'TransitionSourceCandidate', count(*) FROM "TransitionSourceCandidate"
UNION ALL SELECT 'LegislativeVote', count(*) FROM "LegislativeVote"
UNION ALL SELECT 'MemberVote', count(*) FROM "MemberVote"
UNION ALL SELECT 'ClaimTopic', count(*) FROM "ClaimTopic"
UNION ALL SELECT 'Topic', count(*) FROM "Topic"
UNION ALL SELECT 'ClaimEmbedding', count(*) FROM "ClaimEmbedding"
UNION ALL SELECT 'ClaimLocation', count(*) FROM "ClaimLocation"
UNION ALL SELECT 'ThresholdEvent', count(*) FROM "ThresholdEvent"
UNION ALL SELECT 'Polity', count(*) FROM "Polity"
UNION ALL SELECT 'HistoricalEvent', count(*) FROM "HistoricalEvent"
ORDER BY 2 DESC;

\echo '== 11i. ClaimRelation: top from-pipeline → to-pipeline pairs per relationType, and followUpContext keys'
WITH p AS (
  SELECT r."relationType", fc."ingestedBy" AS from_p, tc."ingestedBy" AS to_p, count(*) AS n,
         row_number() OVER (PARTITION BY r."relationType" ORDER BY count(*) DESC) AS rk
  FROM "ClaimRelation" r JOIN "Claim" fc ON fc.id = r."fromClaimId" JOIN "Claim" tc ON tc.id = r."toClaimId"
  GROUP BY 1, 2, 3
), k AS (
  SELECT "relationType", string_agg(DISTINCT key, ',') AS context_keys
  FROM (SELECT DISTINCT ON ("relationType", key) "relationType", key
        FROM "ClaimRelation", jsonb_object_keys(CASE WHEN jsonb_typeof("followUpContext") = 'object' THEN "followUpContext" ELSE '{}'::jsonb END) key) x
  GROUP BY 1
)
SELECT p."relationType", string_agg(from_p || ' → ' || to_p || ' ' || n, '; ' ORDER BY rk) AS top_pairs, k.context_keys
FROM p LEFT JOIN k USING ("relationType") WHERE rk <= 2
GROUP BY p."relationType", k.context_keys ORDER BY 1;
