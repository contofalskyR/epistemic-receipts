-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SuggestedThresholdEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimId" TEXT NOT NULL,
    "aiReasoning" TEXT NOT NULL,
    "evidenceSnapshot" TEXT NOT NULL,
    "triggeredBySourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuggestedThresholdEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SuggestedThresholdEvent_triggeredBySourceId_fkey" FOREIGN KEY ("triggeredBySourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SuggestedThresholdEvent" ("aiReasoning", "claimId", "createdAt", "evidenceSnapshot", "id") SELECT "aiReasoning", "claimId", "createdAt", "evidenceSnapshot", "id" FROM "SuggestedThresholdEvent";
DROP TABLE "SuggestedThresholdEvent";
ALTER TABLE "new_SuggestedThresholdEvent" RENAME TO "SuggestedThresholdEvent";
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
    CONSTRAINT "ThresholdEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ThresholdEvent_suggestedEventId_fkey" FOREIGN KEY ("suggestedEventId") REFERENCES "SuggestedThresholdEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ThresholdEvent_triggeredBySourceId_fkey" FOREIGN KEY ("triggeredBySourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ThresholdEvent" ("claimId", "confirmedBy", "createdAt", "evidenceSnapshot", "id", "note", "suggestedEventId", "triggeredBy") SELECT "claimId", "confirmedBy", "createdAt", "evidenceSnapshot", "id", "note", "suggestedEventId", "triggeredBy" FROM "ThresholdEvent";
DROP TABLE "ThresholdEvent";
ALTER TABLE "new_ThresholdEvent" RENAME TO "ThresholdEvent";
CREATE UNIQUE INDEX "ThresholdEvent_suggestedEventId_key" ON "ThresholdEvent"("suggestedEventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
