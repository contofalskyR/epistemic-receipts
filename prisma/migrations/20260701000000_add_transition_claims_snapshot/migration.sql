-- CreateTable
CREATE TABLE "TransitionClaimsSnapshot" (
    "id" TEXT NOT NULL,
    "claimStatusHistoryId" TEXT NOT NULL,
    "extractedClaims" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransitionClaimsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransitionClaimsSnapshot_claimStatusHistoryId_key" ON "TransitionClaimsSnapshot"("claimStatusHistoryId");

-- AddForeignKey
ALTER TABLE "TransitionClaimsSnapshot" ADD CONSTRAINT "TransitionClaimsSnapshot_claimStatusHistoryId_fkey" FOREIGN KEY ("claimStatusHistoryId") REFERENCES "ClaimStatusHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
