-- Task 10: expression indexes for hot Claim.metadata JSON keys used in WHERE clauses.
--
-- The /api/stock-act and /api/congress-trades endpoints both filter the same slice of
-- claims (ingestedBy = 'congress_stock_act_v1', deleted = false) by equality on JSON
-- metadata keys. Without an index every filter is a sequential scan + per-row JSON
-- extraction. These partial btree expression indexes cover the equality predicates and
-- stay small by only indexing the STOCK Act slice.
--
-- ILIKE '%q%' filters (asset_name, retraction title/journal/firstAuthor, updateType)
-- use leading wildcards and cannot use a btree index, so they are intentionally omitted
-- (a trigram index would be the tool there, out of scope for this task).
--
-- Plain CREATE INDEX (not CONCURRENTLY): Prisma runs each migration inside a
-- transaction, and CREATE INDEX CONCURRENTLY cannot run in a transaction block.

-- chamber = $n   (stock-act, congress-trades)
CREATE INDEX IF NOT EXISTS "claim_meta_chamber_idx"
  ON "Claim" ((metadata->>'chamber'))
  WHERE "ingestedBy" = 'congress_stock_act_v1' AND "deleted" = false;

-- party = $n   (stock-act, congress-trades)
CREATE INDEX IF NOT EXISTS "claim_meta_party_idx"
  ON "Claim" ((metadata->>'party'))
  WHERE "ingestedBy" = 'congress_stock_act_v1' AND "deleted" = false;

-- ticker = $n   (stock-act equality filter)
CREATE INDEX IF NOT EXISTS "claim_meta_ticker_idx"
  ON "Claim" ((metadata->>'ticker'))
  WHERE "ingestedBy" = 'congress_stock_act_v1' AND "deleted" = false;

-- transaction_type = $n   (stock-act)
CREATE INDEX IF NOT EXISTS "claim_meta_transaction_type_idx"
  ON "Claim" ((metadata->>'transaction_type'))
  WHERE "ingestedBy" = 'congress_stock_act_v1' AND "deleted" = false;

-- bioguide_id IN (...)   (congress-trades with-votes correlation)
CREATE INDEX IF NOT EXISTS "claim_meta_bioguide_id_idx"
  ON "Claim" ((metadata->>'bioguide_id'))
  WHERE "ingestedBy" = 'congress_stock_act_v1' AND "deleted" = false;

-- LOWER(member_name) IN (...)   (congress-trades with-votes correlation)
CREATE INDEX IF NOT EXISTS "claim_meta_member_name_lower_idx"
  ON "Claim" ((LOWER(metadata->>'member_name')))
  WHERE "ingestedBy" = 'congress_stock_act_v1' AND "deleted" = false;
