-- Spec 31: Researcher Features — Collections, Citation export, Alert tiers

-- TopicSubscription: add userId (nullable) and frequency for logged-in alert management
ALTER TABLE "TopicSubscription"
  ADD COLUMN IF NOT EXISTS "userId"    TEXT,
  ADD COLUMN IF NOT EXISTS "frequency" TEXT NOT NULL DEFAULT 'weekly';

CREATE INDEX IF NOT EXISTS "TopicSubscription_userId_idx" ON "TopicSubscription"("userId");

ALTER TABLE "TopicSubscription"
  ADD CONSTRAINT "TopicSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Collection: user-owned named groups of claims
CREATE TABLE "Collection" (
  "id"          TEXT        NOT NULL,
  "ownerId"     TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Collection_ownerId_idx" ON "Collection"("ownerId");

ALTER TABLE "Collection"
  ADD CONSTRAINT "Collection_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CollectionItem: claims within a collection, with optional notes and ordering
CREATE TABLE "CollectionItem" (
  "id"           TEXT        NOT NULL,
  "collectionId" TEXT        NOT NULL,
  "claimId"      TEXT        NOT NULL,
  "note"         TEXT,
  "position"     INTEGER     NOT NULL DEFAULT 0,
  "addedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CollectionItem_collectionId_claimId_key" ON "CollectionItem"("collectionId", "claimId");
CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");
CREATE INDEX "CollectionItem_claimId_idx" ON "CollectionItem"("claimId");

ALTER TABLE "CollectionItem"
  ADD CONSTRAINT "CollectionItem_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollectionItem"
  ADD CONSTRAINT "CollectionItem_claimId_fkey"
  FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
