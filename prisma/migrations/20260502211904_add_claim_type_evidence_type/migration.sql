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
    CONSTRAINT "Claim_parentClaimId_fkey" FOREIGN KEY ("parentClaimId") REFERENCES "Claim" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Claim" ("claimEmergedAt", "claimEmergedPrecision", "createdAt", "currentStatus", "id", "parentClaimId", "text") SELECT "claimEmergedAt", "claimEmergedPrecision", "createdAt", "currentStatus", "id", "parentClaimId", "text" FROM "Claim";
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
    CONSTRAINT "Edge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Edge_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Edge" ("claimId", "createdAt", "deleted", "id", "sourceId", "type") SELECT "claimId", "createdAt", "deleted", "id", "sourceId", "type" FROM "Edge";
DROP TABLE "Edge";
ALTER TABLE "new_Edge" RENAME TO "Edge";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
