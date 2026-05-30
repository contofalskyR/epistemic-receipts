-- CreateTable
CREATE TABLE "PolityVote" (
    "id" TEXT NOT NULL,
    "polityId" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "matchMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolityVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolityClaim" (
    "id" TEXT NOT NULL,
    "polityId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "matchMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolityClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PolityVote_polityId_voteId_key" ON "PolityVote"("polityId", "voteId");

-- CreateIndex
CREATE INDEX "PolityVote_polityId_idx" ON "PolityVote"("polityId");

-- CreateIndex
CREATE INDEX "PolityVote_voteId_idx" ON "PolityVote"("voteId");

-- CreateIndex
CREATE UNIQUE INDEX "PolityClaim_polityId_claimId_key" ON "PolityClaim"("polityId", "claimId");

-- CreateIndex
CREATE INDEX "PolityClaim_polityId_idx" ON "PolityClaim"("polityId");

-- CreateIndex
CREATE INDEX "PolityClaim_claimId_idx" ON "PolityClaim"("claimId");

-- AddForeignKey
ALTER TABLE "PolityVote" ADD CONSTRAINT "PolityVote_polityId_fkey" FOREIGN KEY ("polityId") REFERENCES "Polity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolityVote" ADD CONSTRAINT "PolityVote_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "LegislativeVote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolityClaim" ADD CONSTRAINT "PolityClaim_polityId_fkey" FOREIGN KEY ("polityId") REFERENCES "Polity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolityClaim" ADD CONSTRAINT "PolityClaim_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
