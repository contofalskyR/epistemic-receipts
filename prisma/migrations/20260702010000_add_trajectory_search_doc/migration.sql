-- CreateTable
CREATE TABLE "TrajectorySearchDoc" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrajectorySearchDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrajectorySearchDoc_claimId_key" ON "TrajectorySearchDoc"("claimId");

-- CreateIndex
CREATE INDEX "TrajectorySearchDoc_claimId_idx" ON "TrajectorySearchDoc"("claimId");

-- AddForeignKey
ALTER TABLE "TrajectorySearchDoc" ADD CONSTRAINT "TrajectorySearchDoc_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
