-- AlterTable
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "openAlexId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Claim_openAlexId_idx" ON "Claim"("openAlexId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "ClaimRelation" (
    "id" TEXT NOT NULL,
    "fromClaimId" TEXT NOT NULL,
    "toClaimId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClaimRelation_fromClaimId_idx" ON "ClaimRelation"("fromClaimId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClaimRelation_toClaimId_idx" ON "ClaimRelation"("toClaimId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClaimRelation_fromClaimId_relationType_idx" ON "ClaimRelation"("fromClaimId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ClaimRelation_fromClaimId_toClaimId_relationType_key" ON "ClaimRelation"("fromClaimId", "toClaimId", "relationType");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ClaimRelation" ADD CONSTRAINT "ClaimRelation_fromClaimId_fkey" FOREIGN KEY ("fromClaimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ClaimRelation" ADD CONSTRAINT "ClaimRelation_toClaimId_fkey" FOREIGN KEY ("toClaimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
