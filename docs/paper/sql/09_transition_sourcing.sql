-- 09_transition_sourcing.sql — claude_sourcing_v1 (TransitionSourceCandidate → Source + Edge).
-- Pipeline: scripts/source-transitions.ts (model + web search proposes a URL per
-- transition) → scripts/verify-transition-sources(.ts|-api.ts) (fetch the page,
-- excerpt match) → scripts/review-transition-sources.ts (status; trace.review.by)
-- → scripts/promote-transition-sources.ts --confirm (Source + Edge, ingestedBy
-- 'claude_sourcing_v1'; ClaimStatusHistory untouched).
-- Machine "accept" rule: scripts/lib/transition-sourcing.ts autoReviewDecision().

\echo '== 9a. candidates by status and reviewer'
SELECT status::text, coalesce(trace->'review'->>'by', '(none)') AS reviewed_by,
       count(*) AS rows, count("promotedAt") AS promoted,
       count(*) FILTER (WHERE "urlInSearchResults") AS url_in_search_results,
       count(*) FILTER (WHERE confidence >= 0.5) AS confidence_ge_0_5
FROM "TransitionSourceCandidate"
GROUP BY 1, 2 ORDER BY 1, 3 DESC;

\echo '== 9b. totals'
SELECT count(*) AS candidates_all,
       count(*) FILTER (WHERE status = 'candidate') AS pending_candidate,
       count(*) FILTER (WHERE status = 'accepted')  AS accepted,
       count(*) FILTER (WHERE "promotedAt" IS NOT NULL) AS promoted,
       count(DISTINCT "promotedSourceId") AS promoted_distinct_sources,
       count(DISTINCT "promotedEdgeId")   AS promoted_distinct_edges,
       count(DISTINCT "claimId") FILTER (WHERE "promotedAt" IS NOT NULL) AS claims_with_promoted_source,
       round(sum("costUsd")::numeric, 2) AS cost_usd_total,
       string_agg(DISTINCT model, ', ') AS models
FROM "TransitionSourceCandidate";

\echo '== 9c. Source / Edge rows written by claude_sourcing_v1'
SELECT 'Source' AS t, count(*) AS rows, count(*) FILTER (WHERE "humanReviewed") AS human_reviewed,
       count(*) FILTER (WHERE "autoApproved") AS auto_approved, count(*) FILTER (WHERE deleted) AS deleted
FROM "Source" WHERE "ingestedBy" = 'claude_sourcing_v1'
UNION ALL
SELECT 'Edge', count(*), count(*) FILTER (WHERE "humanReviewed"), count(*) FILTER (WHERE "autoApproved"),
       count(*) FILTER (WHERE deleted)
FROM "Edge" WHERE "ingestedBy" = 'claude_sourcing_v1';

\echo '== 9d. pending candidates by confidence band and verify outcome'
SELECT CASE WHEN confidence IS NULL THEN '(null)' WHEN confidence >= 0.7 THEN '>=0.7'
            WHEN confidence >= 0.5 THEN '0.5-0.7' ELSE '<0.5' END AS confidence_band,
       count(*) AS pending,
       count(*) FILTER (WHERE trace ? 'verify') AS with_verify_record
FROM "TransitionSourceCandidate" WHERE status = 'candidate'
GROUP BY ROLLUP (1) ORDER BY 1 NULLS LAST;
