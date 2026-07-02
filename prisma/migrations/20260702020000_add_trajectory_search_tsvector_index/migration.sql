-- Add GIN tsvector index on TrajectorySearchDoc.fullText for fast FTS
CREATE INDEX CONCURRENTLY IF NOT EXISTS "TrajectorySearchDoc_fulltext_gin_idx"
  ON "TrajectorySearchDoc" USING gin(to_tsvector('english', "fullText"));
