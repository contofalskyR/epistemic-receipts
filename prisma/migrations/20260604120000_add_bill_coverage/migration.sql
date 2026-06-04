-- BillCoverage: NYT media coverage stats per Claim (congress bill).
CREATE TABLE IF NOT EXISTS "BillCoverage" (
    "id" SERIAL NOT NULL,
    "claimId" TEXT NOT NULL,
    "articleCount" INTEGER NOT NULL DEFAULT 0,
    "topHeadlines" JSONB,
    "searchQuery" TEXT NOT NULL,
    "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillCoverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillCoverage_claimId_key" ON "BillCoverage"("claimId");
CREATE INDEX IF NOT EXISTS "BillCoverage_articleCount_idx" ON "BillCoverage"("articleCount");

DO $$ BEGIN
  ALTER TABLE "BillCoverage" ADD CONSTRAINT "BillCoverage_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
