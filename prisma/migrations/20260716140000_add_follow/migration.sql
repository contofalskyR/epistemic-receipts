-- B12-2: polymorphic Follow table (additive only — no existing tables touched).
-- Owner-gated migration window required before /api/follow writes work in prod.

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Follow_profileId_entityType_entityId_key" ON "Follow"("profileId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "Follow_profileId_idx" ON "Follow"("profileId");

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
