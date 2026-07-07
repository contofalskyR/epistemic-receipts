-- Enable pgvector extension (idempotent — already present from TrajectorySearchDoc migration)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable: ClaimEmbedding
-- Separate from TrajectorySearchDoc (which covers only trajectory-annotated claims at 384 dims).
-- This table covers ALL non-deleted claims at 1536 dims (text-embedding-3-small).
-- Raw SQL migration — pgvector column types are not Prisma-native.
CREATE TABLE "ClaimEmbedding" (
    "id"          TEXT        NOT NULL,
    "claimId"     TEXT        NOT NULL,
    "embedding"   vector(1536),
    "model"       TEXT        NOT NULL,
    "contentHash" TEXT        NOT NULL,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique claimId (one embedding row per claim)
CREATE UNIQUE INDEX "ClaimEmbedding_claimId_key" ON "ClaimEmbedding"("claimId");

-- CreateIndex: lookup by claimId
CREATE INDEX "ClaimEmbedding_claimId_idx" ON "ClaimEmbedding"("claimId");

-- CreateIndex: lookup by contentHash for backfill diff (avoid re-embedding unchanged content)
CREATE INDEX "ClaimEmbedding_contentHash_idx" ON "ClaimEmbedding"("contentHash");

-- AddForeignKey
ALTER TABLE "ClaimEmbedding"
    ADD CONSTRAINT "ClaimEmbedding_claimId_fkey"
    FOREIGN KEY ("claimId") REFERENCES "Claim"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- NOTE: HNSW index is NOT created here — it must be built AFTER the backfill is complete.
-- A 1M-row HNSW build on an empty table would need to be rebuilt after data loads anyway.
-- See migration 20260707010000_add_embedding_hnsw_index for the HNSW / IVFFlat index.
