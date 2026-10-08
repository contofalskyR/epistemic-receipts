-- CreateEnum
CREATE TYPE "TransitionSourceStatus" AS ENUM ('candidate', 'accepted', 'rejected', 'no_source_found');

-- CreateTable
CREATE TABLE "TransitionSourceCandidate" (
    "id" TEXT NOT NULL,
    "transitionId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "publisher" TEXT,
    "publishedAt" TIMESTAMP(3),
    "excerpt" TEXT,
    "confidence" DOUBLE PRECISION,
    "rationale" TEXT,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6) NOT NULL,
    "urlInSearchResults" BOOLEAN NOT NULL DEFAULT false,
    "priorSourceId" TEXT,
    "trace" JSONB,
    "status" "TransitionSourceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),
    "promotedSourceId" TEXT,
    "promotedEdgeId" TEXT,

    CONSTRAINT "TransitionSourceCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransitionSourceCandidate_transitionId_key" ON "TransitionSourceCandidate"("transitionId");

-- CreateIndex
CREATE INDEX "TransitionSourceCandidate_claimId_idx" ON "TransitionSourceCandidate"("claimId");

-- CreateIndex
CREATE INDEX "TransitionSourceCandidate_status_idx" ON "TransitionSourceCandidate"("status");

-- AddForeignKey
ALTER TABLE "TransitionSourceCandidate" ADD CONSTRAINT "TransitionSourceCandidate_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "ClaimStatusHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

