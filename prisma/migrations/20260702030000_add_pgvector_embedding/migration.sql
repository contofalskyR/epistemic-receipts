-- Enable pgvector extension (Neon supports this natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to TrajectorySearchDoc (1536 dimensions for text-embedding-3-small)
ALTER TABLE "TrajectorySearchDoc" ADD COLUMN "embedding" vector(1536);

-- Create HNSW index for fast cosine similarity search
CREATE INDEX "TrajectorySearchDoc_embedding_hnsw_idx"
  ON "TrajectorySearchDoc"
  USING hnsw ("embedding" vector_cosine_ops);
