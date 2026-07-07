-- Spec 20: Public API — ApiKey and ApiUsage tables

CREATE TABLE "ApiKey" (
    "id"           TEXT NOT NULL,
    "orgName"      TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "keyHash"      TEXT NOT NULL,
    "tier"         TEXT NOT NULL DEFAULT 'free',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt"    TIMESTAMP(3),
    "lastUsedAt"   TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiUsage" (
    "id"       TEXT NOT NULL,
    "keyId"    TEXT NOT NULL,
    "date"     TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "count"    INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_keyHash_idx"        ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_tier_idx"           ON "ApiKey"("tier");

CREATE UNIQUE INDEX "ApiUsage_keyId_date_endpoint_key" ON "ApiUsage"("keyId", "date", "endpoint");
CREATE INDEX "ApiUsage_keyId_idx"  ON "ApiUsage"("keyId");
CREATE INDEX "ApiUsage_date_idx"   ON "ApiUsage"("date");

ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_keyId_fkey"
    FOREIGN KEY ("keyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
