-- 01_claims.sql — Claim totals, the deleted flag, and verificationStatus.
-- Corpus definition (STATUS.md, lib/corpus.ts corpusCount): deleted = false.
-- Default-view ("live") definition (lib/corpus.ts LIVE_CLAIM_WHERE):
--   deleted = false AND verificationStatus IS DISTINCT FROM 'DEPRECATED'.
-- The field is Claim."verificationStatus" (String?, free text; schema comment
-- lists VERIFIED | PROVISIONAL | DISPUTED | DEPRECATED).

\echo '== 1a. totals'
SELECT count(*)                                              AS claims_all_rows,
       count(*) FILTER (WHERE NOT deleted)                   AS corpus_deleted_false,
       count(*) FILTER (WHERE deleted)                       AS deleted_true,
       count(*) FILTER (WHERE NOT deleted
                          AND "verificationStatus" IS DISTINCT FROM 'DEPRECATED') AS live_default_view
FROM "Claim";

\echo '== 1b. verificationStatus × deleted'
SELECT coalesce("verificationStatus", '(null)') AS "verificationStatus",
       count(*) FILTER (WHERE NOT deleted)      AS deleted_false,
       count(*) FILTER (WHERE deleted)          AS deleted_true,
       round(100.0 * count(*) FILTER (WHERE NOT deleted)
             / sum(count(*) FILTER (WHERE NOT deleted)) OVER (), 3) AS pct_of_corpus
FROM "Claim"
GROUP BY 1
ORDER BY 2 DESC;

\echo '== 1c. deleted = true rows by pipeline'
SELECT "ingestedBy", count(*) AS deleted_true,
       count(*) FILTER (WHERE metadata ? 'duplicateOf') AS with_metadata_duplicateOf
FROM "Claim" WHERE deleted
GROUP BY 1 ORDER BY 2 DESC;

\echo '== 1d. claims created on or after 2026-09-29 (restore date in STATUS.md), by pipeline and day'
SELECT "ingestedBy", "createdAt"::date AS created_day, count(*) AS claims,
       count(*) FILTER (WHERE deleted) AS deleted_true
FROM "Claim" WHERE "createdAt" >= TIMESTAMP '2026-09-29'
GROUP BY 1, 2 ORDER BY 2, 1;
