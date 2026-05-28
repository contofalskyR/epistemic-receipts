-- Book Analysis Pipeline: tables + pgvector support
-- Adds Book/BookChunk/BookClaim/BookClaimMatch and enables pgvector for
-- embedding-based matching against existing Claim records.

-- Enable pgvector (Neon supports this natively).
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "sourceUrl" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookChunk" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterNum" INTEGER,
    "pageNum" INTEGER,
    "paragraphIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "BookChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookClaim" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "positionIndex" INTEGER NOT NULL,

    CONSTRAINT "BookClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookClaimMatch" (
    "id" TEXT NOT NULL,
    "bookClaimId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "matchType" TEXT NOT NULL,

    CONSTRAINT "BookClaimMatch_pkey" PRIMARY KEY ("id")
);

-- Vector column for embeddings (text-embedding-3-small = 1536 dim).
-- Not declared in Prisma schema (unsupported type) — accessed via raw SQL.
ALTER TABLE "BookClaim" ADD COLUMN "embedding" vector(1536);

-- Cache embeddings on canonical Claims so we don't re-embed candidates each ingest.
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Indexes
CREATE INDEX "Book_ingestedAt_idx" ON "Book"("ingestedAt");
CREATE INDEX "BookChunk_bookId_idx" ON "BookChunk"("bookId");
CREATE INDEX "BookChunk_bookId_paragraphIndex_idx" ON "BookChunk"("bookId", "paragraphIndex");
CREATE INDEX "BookClaim_chunkId_idx" ON "BookClaim"("chunkId");
CREATE INDEX "BookClaim_positionIndex_idx" ON "BookClaim"("positionIndex");
CREATE INDEX "BookClaimMatch_bookClaimId_idx" ON "BookClaimMatch"("bookClaimId");
CREATE INDEX "BookClaimMatch_claimId_idx" ON "BookClaimMatch"("claimId");

-- ivfflat index on Claim.embedding for fast cosine-similarity lookup.
-- Lists=100 is a reasonable starting point; tune as the embedded subset grows.
-- (Index can only be used after at least some rows have embeddings populated.)
CREATE INDEX IF NOT EXISTS "Claim_embedding_ivfflat_idx"
    ON "Claim" USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);

-- Foreign keys
ALTER TABLE "BookChunk" ADD CONSTRAINT "BookChunk_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookClaim" ADD CONSTRAINT "BookClaim_chunkId_fkey"
    FOREIGN KEY ("chunkId") REFERENCES "BookChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookClaimMatch" ADD CONSTRAINT "BookClaimMatch_bookClaimId_fkey"
    FOREIGN KEY ("bookClaimId") REFERENCES "BookClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookClaimMatch" ADD CONSTRAINT "BookClaimMatch_claimId_fkey"
    FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
