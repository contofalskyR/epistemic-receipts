-- Spec 40: Litigation Workbench
-- LitigationMatter, MatterClaim, MatterExport

CREATE TYPE "MatterStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');
CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'JSONL', 'CSV');

CREATE TABLE "LitigationMatter" (
    "id"           TEXT         NOT NULL,
    "orgId"        TEXT         NOT NULL,
    "name"         TEXT         NOT NULL,
    "description"  TEXT,
    "status"       "MatterStatus" NOT NULL DEFAULT 'ACTIVE',
    "jurisdiction" TEXT,
    "caseNumber"   TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LitigationMatter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatterClaim" (
    "id"           TEXT         NOT NULL,
    "matterId"     TEXT         NOT NULL,
    "claimId"      TEXT         NOT NULL,
    "addedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById"    TEXT         NOT NULL,
    "notes"        TEXT,
    "relevanceTag" TEXT,
    CONSTRAINT "MatterClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatterExport" (
    "id"           TEXT           NOT NULL,
    "matterId"     TEXT           NOT NULL,
    "format"       "ExportFormat" NOT NULL,
    "r2Key"        TEXT           NOT NULL,
    "sha256"       TEXT           NOT NULL,
    "exportedAt"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exportedById" TEXT           NOT NULL,
    CONSTRAINT "MatterExport_pkey" PRIMARY KEY ("id")
);

-- Unique + indexes
CREATE UNIQUE INDEX "MatterClaim_matterId_claimId_key" ON "MatterClaim"("matterId", "claimId");
CREATE INDEX "LitigationMatter_orgId_idx" ON "LitigationMatter"("orgId");
CREATE INDEX "LitigationMatter_orgId_status_idx" ON "LitigationMatter"("orgId", "status");
CREATE INDEX "MatterClaim_matterId_idx" ON "MatterClaim"("matterId");
CREATE INDEX "MatterClaim_claimId_idx" ON "MatterClaim"("claimId");
CREATE INDEX "MatterExport_matterId_idx" ON "MatterExport"("matterId");

-- Foreign keys
ALTER TABLE "LitigationMatter"
    ADD CONSTRAINT "LitigationMatter_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatterClaim"
    ADD CONSTRAINT "MatterClaim_matterId_fkey"
    FOREIGN KEY ("matterId") REFERENCES "LitigationMatter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatterClaim"
    ADD CONSTRAINT "MatterClaim_claimId_fkey"
    FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatterClaim"
    ADD CONSTRAINT "MatterClaim_addedById_fkey"
    FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MatterExport"
    ADD CONSTRAINT "MatterExport_matterId_fkey"
    FOREIGN KEY ("matterId") REFERENCES "LitigationMatter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatterExport"
    ADD CONSTRAINT "MatterExport_exportedById_fkey"
    FOREIGN KEY ("exportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
