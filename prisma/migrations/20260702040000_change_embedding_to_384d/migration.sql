-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop the existing HNSW index (it references the old 1536-dim column)
DROP INDEX IF EXISTS "TrajectorySearchDoc_embedding_hnsw_idx";

-- Clear existing 1536-dim embeddings (incompatible with new dimension)
UPDATE "TrajectorySearchDoc" SET "embedding" = NULL;

-- Change column from vector(1536) to vector(384) for all-MiniLM-L6-v2
ALTER TABLE "TrajectorySearchDoc" ALTER COLUMN "embedding" TYPE vector(384);

-- Recreate HNSW index for fast cosine similarity search
CREATE INDEX "TrajectorySearchDoc_embedding_hnsw_idx"
  ON "TrajectorySearchDoc"
  USING hnsw ("embedding" vector_cosine_ops);
