-- 15_pii_scan.sql — personal-data / secret patterns in the columns the export
-- ships (Phase 3). Counts only; matching rows are listed by id in 15b–15c for review.
--   email  = [A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}
--   ipv4   = four dot-separated 1–3 digit groups, word-bounded (many false positives: section numbers, versions)
--   secret = sk-… keys, Bearer tokens, or "api_key|token|secret|password" followed by = or :
\echo '== 15a. pattern counts per exported column'
WITH c AS (SELECT * FROM "Claim" WHERE NOT deleted)
SELECT 'Claim.text' AS col,
       count(*) FILTER (WHERE text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}') AS email,
       count(*) FILTER (WHERE text ~ '\m\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\M') AS ipv4,
       count(*) FILTER (WHERE text ~* '\msk-[a-z0-9_-]{20,}|bearer [a-z0-9._-]{20,}|(api[_-]?key|token|secret|password)\s*[:=]') AS secret
FROM c
UNION ALL
SELECT 'Claim.metadata',
       count(*) FILTER (WHERE metadata::text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
       count(*) FILTER (WHERE metadata::text ~ '\m\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\M'),
       count(*) FILTER (WHERE metadata::text ~* '\msk-[a-z0-9_-]{20,}|bearer [a-z0-9._-]{20,}|"(api[_-]?key|token|secret|password)"\s*:')
FROM c
UNION ALL
SELECT 'Claim.reviewedBy', count(*) FILTER (WHERE "reviewedBy" ~ '@'), 0, 0 FROM c
UNION ALL
SELECT 'ClaimStatusHistory.reason',
       count(*) FILTER (WHERE h.reason ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
       count(*) FILTER (WHERE h.reason ~ '\m\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\M'),
       count(*) FILTER (WHERE h.reason ~* '\msk-[a-z0-9_-]{20,}|bearer [a-z0-9._-]{20,}|(api[_-]?key|token|secret|password)\s*[:=]')
FROM "ClaimStatusHistory" h JOIN c ON c.id = h."claimId"
UNION ALL
SELECT 'Source.name',
       count(*) FILTER (WHERE name ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
       count(*) FILTER (WHERE name ~ '\m\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\M'),
       count(*) FILTER (WHERE name ~* '\msk-[a-z0-9_-]{20,}|bearer [a-z0-9._-]{20,}|(api[_-]?key|token|secret|password)\s*[:=]')
FROM "Source" WHERE NOT deleted
UNION ALL
SELECT 'Source.url',
       count(*) FILTER (WHERE url ~ '^mailto:|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
       count(*) FILTER (WHERE url ~ '^https?://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}'),
       count(*) FILTER (WHERE url ~* '[?&](api[_-]?key|key|token|access_token|apikey|secret|sig|signature)=')
FROM "Source" WHERE NOT deleted
UNION ALL
SELECT 'ClaimRelation.followUpContext',
       count(*) FILTER (WHERE r."followUpContext"::text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
       0,
       count(*) FILTER (WHERE r."followUpContext"::text ~* '\msk-[a-z0-9_-]{20,}|"(api[_-]?key|token|secret|password)"\s*:')
FROM "ClaimRelation" r;

\echo '== 15b. Claim rows with an email-like string (text or metadata), by pipeline, with one example match'
SELECT "ingestedBy", count(*) AS claims,
       min(substring(coalesce(text,'') || ' ' || coalesce(metadata::text,'') FROM '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')) AS example
FROM "Claim" WHERE NOT deleted
  AND (text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' OR metadata::text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
GROUP BY 1 ORDER BY 2 DESC;

\echo '== 15c. Source rows with an email-like string or a key-like URL parameter, by ingestedBy, with one example'
SELECT "ingestedBy", count(*) AS sources,
       min(coalesce(substring(name FROM '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
                    substring(url FROM '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
                    substring(url FROM '(?i)[?&](?:api[_-]?key|key|token|access_token|apikey|secret|sig|signature)=[^&]{0,12}'))) AS example
FROM "Source" WHERE NOT deleted
  AND (name ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' OR url ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
       OR url ~* '[?&](api[_-]?key|key|token|access_token|apikey|secret|sig|signature)=')
GROUP BY 1 ORDER BY 2 DESC;
