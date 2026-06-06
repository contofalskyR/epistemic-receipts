-- AlterTable: add alert-related fields to Profile
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "magicTokenHash" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "magicTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free';

-- CreateIndex: unique email on Profile (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Profile_email_key'
  ) THEN
    ALTER TABLE "Profile" ADD CONSTRAINT "Profile_email_key" UNIQUE ("email");
  END IF;
END
$$;

-- CreateTable: SavedQuery
CREATE TABLE IF NOT EXISTS "SavedQuery" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AlertSent
CREATE TABLE IF NOT EXISTS "AlertSent" (
    "id" TEXT NOT NULL,
    "savedQueryId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertSent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SavedQuery_profileId_idx" ON "SavedQuery"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AlertSent_savedQueryId_claimId_key" ON "AlertSent"("savedQueryId", "claimId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AlertSent_savedQueryId_idx" ON "AlertSent"("savedQueryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AlertSent_claimId_idx" ON "AlertSent"("claimId");

-- AddForeignKey
ALTER TABLE "SavedQuery" DROP CONSTRAINT IF EXISTS "SavedQuery_profileId_fkey";
ALTER TABLE "SavedQuery" ADD CONSTRAINT "SavedQuery_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertSent" DROP CONSTRAINT IF EXISTS "AlertSent_savedQueryId_fkey";
ALTER TABLE "AlertSent" ADD CONSTRAINT "AlertSent_savedQueryId_fkey" FOREIGN KEY ("savedQueryId") REFERENCES "SavedQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertSent" DROP CONSTRAINT IF EXISTS "AlertSent_claimId_fkey";
ALTER TABLE "AlertSent" ADD CONSTRAINT "AlertSent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
