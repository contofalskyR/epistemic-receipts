-- CreateTable
CREATE TABLE "MemberVote" (
    "id" TEXT NOT NULL,
    "legislativeVoteId" TEXT NOT NULL,
    "memberName" TEXT NOT NULL,
    "memberState" TEXT,
    "memberParty" TEXT,
    "memberId" TEXT,
    "chamber" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberVote_legislativeVoteId_idx" ON "MemberVote"("legislativeVoteId");

-- CreateIndex
CREATE INDEX "MemberVote_memberId_idx" ON "MemberVote"("memberId");

-- AddForeignKey
ALTER TABLE "MemberVote" ADD CONSTRAINT "MemberVote_legislativeVoteId_fkey" FOREIGN KEY ("legislativeVoteId") REFERENCES "LegislativeVote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
