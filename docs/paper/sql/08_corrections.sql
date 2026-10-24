-- 08_corrections.sql — the database side of the corrections record.
-- Static side (the /corrections page entries and data/vote-results-under-review.json)
-- is counted by scripts/paper/corrections-counts.ts.
-- Correction batches live in Claim.metadata.corrections (array of objects with
-- a "batch" key; STATUS.md Phase 7 "Option A": metadata + /corrections entry,
-- never new ClaimStatusHistory rows). Retirements: deleted = true with
-- metadata.duplicateOf. Deprecations: verificationStatus = 'DEPRECATED'.

\echo '== 8a. DEPRECATED, deleted, duplicateOf, deprecation_reason'
SELECT count(*) FILTER (WHERE "verificationStatus" = 'DEPRECATED')                    AS deprecated,
       count(*) FILTER (WHERE "verificationStatus" = 'DEPRECATED' AND NOT deleted)    AS deprecated_deleted_false,
       count(*) FILTER (WHERE metadata ? 'deprecation_reason')                        AS with_deprecation_reason,
       count(*) FILTER (WHERE deleted)                                                AS deleted_true,
       count(*) FILTER (WHERE deleted AND metadata ? 'duplicateOf')                   AS deleted_with_duplicateOf,
       count(*) FILTER (WHERE metadata ? 'corrections')                               AS claims_with_metadata_corrections
FROM "Claim";

\echo '== 8b. Claim.metadata.corrections entries by batch'
SELECT coalesce(x->>'batch', '(no batch key)') AS batch,
       count(*) AS entries, count(DISTINCT c.id) AS claims,
       count(DISTINCT c.id) FILTER (WHERE c.deleted) AS of_which_deleted
FROM "Claim" c, jsonb_array_elements(
       CASE WHEN jsonb_typeof(c.metadata->'corrections') = 'array' THEN c.metadata->'corrections' ELSE '[]'::jsonb END) x
WHERE c.metadata ? 'corrections'
GROUP BY 1 ORDER BY 3 DESC;

\echo '== 8c. claims touched by any recorded correction or retirement (union, all rows)'
SELECT count(*) AS claims_touched,
       count(*) FILTER (WHERE NOT deleted) AS of_which_deleted_false,
       round(100.0 * count(*) FILTER (WHERE NOT deleted) / (SELECT count(*) FROM "Claim" WHERE NOT deleted), 3) AS pct_of_corpus
FROM "Claim"
WHERE "verificationStatus" = 'DEPRECATED' OR deleted OR metadata ? 'corrections' OR metadata ? 'duplicateOf';

\echo '== 8d. ClaimStatusHistory rows (check: corrections never add history rows)'
SELECT count(*) AS claimstatushistory_rows FROM "ClaimStatusHistory";

\echo '== 8e. epistemicStatus / currentStatus legacy values named by the 2026-06-08 /corrections entry'
SELECT count(*) FILTER (WHERE "currentStatus" = 'VERIFIED')     AS currentStatus_VERIFIED,
       count(*) FILTER (WHERE "epistemicStatus" = 'established') AS epistemicStatus_established
FROM "Claim";

\echo '== 8f. claims carrying metadata.deprecation_reason, by pipeline and verificationStatus'
SELECT "ingestedBy", coalesce("verificationStatus", '(null)') AS "verificationStatus", deleted, count(*) AS claims
FROM "Claim" WHERE metadata ? 'deprecation_reason'
GROUP BY 1, 2, 3 ORDER BY 4 DESC;

\echo '== 8g. corpus claims touched, excluding claims whose only record is the restored-text batch'
WITH b AS (
  SELECT c.id, c.deleted, c."verificationStatus", c.metadata,
         coalesce((SELECT array_agg(DISTINCT x->>'batch') FROM jsonb_array_elements(
           CASE WHEN jsonb_typeof(c.metadata->'corrections') = 'array' THEN c.metadata->'corrections' ELSE '[]'::jsonb END) x), '{}') AS batches
  FROM "Claim" c
  WHERE c."verificationStatus" = 'DEPRECATED' OR c.deleted OR c.metadata ? 'corrections' OR c.metadata ? 'duplicateOf'
)
SELECT count(*) FILTER (WHERE NOT deleted) AS corpus_touched,
       count(*) FILTER (WHERE NOT deleted AND batches = ARRAY['voteview-full-text-2026-10']
                          AND "verificationStatus" IS DISTINCT FROM 'DEPRECATED' AND NOT metadata ? 'duplicateOf') AS only_restored_text,
       count(*) FILTER (WHERE NOT deleted AND NOT (batches = ARRAY['voteview-full-text-2026-10']
                          AND "verificationStatus" IS DISTINCT FROM 'DEPRECATED' AND NOT metadata ? 'duplicateOf')) AS corpus_touched_excl_restored_text,
       round(100.0 * count(*) FILTER (WHERE NOT deleted AND NOT (batches = ARRAY['voteview-full-text-2026-10']
                          AND "verificationStatus" IS DISTINCT FROM 'DEPRECATED' AND NOT metadata ? 'duplicateOf'))
             / (SELECT count(*) FROM "Claim" WHERE NOT deleted), 3) AS pct_excl_restored_text
FROM b;
