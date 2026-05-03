-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentStatus" TEXT NOT NULL DEFAULT 'DISPUTED',
    "claimType" TEXT NOT NULL DEFAULT 'EMPIRICAL',
    "parentClaimId" TEXT,
    "claimEmergedAt" DATETIME,
    "claimEmergedPrecision" TEXT,
    "ingestedBy" TEXT NOT NULL DEFAULT 'manual',
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewConfidence" TEXT,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    CONSTRAINT "Claim_parentClaimId_fkey" FOREIGN KEY ("parentClaimId") REFERENCES "Claim" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Claim" ("claimEmergedAt", "claimEmergedPrecision", "claimType", "createdAt", "currentStatus", "id", "parentClaimId", "text") SELECT "claimEmergedAt", "claimEmergedPrecision", "claimType", "createdAt", "currentStatus", "id", "parentClaimId", "text" FROM "Claim";
DROP TABLE "Claim";
ALTER TABLE "new_Claim" RENAME TO "Claim";
CREATE TABLE "new_Edge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL DEFAULT 'EVIDENTIARY',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingestedBy" TEXT NOT NULL DEFAULT 'manual',
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewConfidence" TEXT,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    CONSTRAINT "Edge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Edge_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Edge" ("claimId", "createdAt", "deleted", "evidenceType", "id", "sourceId", "type") SELECT "claimId", "createdAt", "deleted", "evidenceType", "id", "sourceId", "type" FROM "Edge";
DROP TABLE "Edge";
ALTER TABLE "new_Edge" RENAME TO "Edge";
CREATE TABLE "new_MetaEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorSourceId" TEXT NOT NULL,
    "targetEdgeId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingestedBy" TEXT NOT NULL DEFAULT 'manual',
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewConfidence" TEXT,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    CONSTRAINT "MetaEdge_actorSourceId_fkey" FOREIGN KEY ("actorSourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MetaEdge_targetEdgeId_fkey" FOREIGN KEY ("targetEdgeId") REFERENCES "Edge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MetaEdge_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MetaEdge" ("actorSourceId", "claimId", "createdAt", "deleted", "id", "reason", "targetEdgeId", "type") SELECT "actorSourceId", "claimId", "createdAt", "deleted", "id", "reason", "targetEdgeId", "type" FROM "MetaEdge";
DROP TABLE "MetaEdge";
ALTER TABLE "new_MetaEdge" RENAME TO "MetaEdge";
CREATE TABLE "new_Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "publishedAt" DATETIME,
    "methodologyType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingestedBy" TEXT NOT NULL DEFAULT 'manual',
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewConfidence" TEXT,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT
);
INSERT INTO "new_Source" ("createdAt", "id", "methodologyType", "name", "publishedAt", "url") SELECT "createdAt", "id", "methodologyType", "name", "publishedAt", "url" FROM "Source";
DROP TABLE "Source";
ALTER TABLE "new_Source" RENAME TO "Source";
CREATE TABLE "new_ThresholdEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimId" TEXT NOT NULL,
    "suggestedEventId" TEXT,
    "confirmedBy" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "triggeredBySourceId" TEXT,
    "note" TEXT,
    "evidenceSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingestedBy" TEXT NOT NULL DEFAULT 'manual',
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewConfidence" TEXT,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    CONSTRAINT "ThresholdEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ThresholdEvent_suggestedEventId_fkey" FOREIGN KEY ("suggestedEventId") REFERENCES "SuggestedThresholdEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ThresholdEvent_triggeredBySourceId_fkey" FOREIGN KEY ("triggeredBySourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ThresholdEvent" ("claimId", "confirmedBy", "createdAt", "evidenceSnapshot", "id", "note", "suggestedEventId", "triggeredBy", "triggeredBySourceId") SELECT "claimId", "confirmedBy", "createdAt", "evidenceSnapshot", "id", "note", "suggestedEventId", "triggeredBy", "triggeredBySourceId" FROM "ThresholdEvent";
DROP TABLE "ThresholdEvent";
ALTER TABLE "new_ThresholdEvent" RENAME TO "ThresholdEvent";
CREATE UNIQUE INDEX "ThresholdEvent_suggestedEventId_key" ON "ThresholdEvent"("suggestedEventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
