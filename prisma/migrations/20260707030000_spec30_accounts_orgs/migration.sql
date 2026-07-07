-- Spec 30: Accounts, Orgs, Entitlements
-- Auth.js v5 adapter tables + Org/Membership/OrgIpRange/OrgUsageDaily

-- User
CREATE TABLE "User" (
    "id"            TEXT        NOT NULL,
    "email"         TEXT        NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name"          TEXT,
    "image"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");

-- Account (OAuth provider links — used by Auth.js adapter)
CREATE TABLE "Account" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "type"              TEXT NOT NULL,
    "provider"          TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token"     TEXT,
    "access_token"      TEXT,
    "expires_at"        INTEGER,
    "token_type"        TEXT,
    "scope"             TEXT,
    "id_token"          TEXT,
    "session_state"     TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Session (database sessions strategy)
CREATE TABLE "Session" (
    "id"           TEXT        NOT NULL,
    "sessionToken" TEXT        NOT NULL,
    "userId"       TEXT        NOT NULL,
    "expires"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VerificationToken (magic-link tokens — single-use, 15-min TTL enforced in Auth.js)
CREATE TABLE "VerificationToken" (
    "identifier" TEXT        NOT NULL,
    "token"      TEXT        NOT NULL,
    "expires"    TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- Org
CREATE TABLE "Org" (
    "id"                   TEXT        NOT NULL,
    "name"                 TEXT        NOT NULL,
    "slug"                 TEXT        NOT NULL,
    "tier"                 TEXT        NOT NULL DEFAULT 'free',
    "seats"                INTEGER     NOT NULL DEFAULT 5,
    "ssoConnectionId"      TEXT,
    "stripeCustomerId"     TEXT,
    "stripeSubscriptionId" TEXT,
    "pastDueSince"         TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Org_slug_key" ON "Org"("slug");

-- Membership (composite PK)
CREATE TABLE "Membership" (
    "userId"    TEXT        NOT NULL,
    "orgId"     TEXT        NOT NULL,
    "role"      TEXT        NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId", "orgId")
);

CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrgIpRange
CREATE TABLE "OrgIpRange" (
    "id"          TEXT        NOT NULL,
    "orgId"       TEXT        NOT NULL,
    "cidr"        TEXT        NOT NULL,
    "label"       TEXT        NOT NULL DEFAULT '',
    "confirmFlag" BOOLEAN     NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgIpRange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrgIpRange_orgId_idx" ON "OrgIpRange"("orgId");

ALTER TABLE "OrgIpRange" ADD CONSTRAINT "OrgIpRange_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrgUsageDaily
CREATE TABLE "OrgUsageDaily" (
    "id"     TEXT    NOT NULL,
    "orgId"  TEXT    NOT NULL,
    "date"   TEXT    NOT NULL,
    "metric" TEXT    NOT NULL,
    "count"  INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OrgUsageDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgUsageDaily_orgId_date_metric_key" ON "OrgUsageDaily"("orgId", "date", "metric");
CREATE INDEX "OrgUsageDaily_orgId_idx" ON "OrgUsageDaily"("orgId");

ALTER TABLE "OrgUsageDaily" ADD CONSTRAINT "OrgUsageDaily_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Extend Profile: nullable userId FK → User
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "Profile_userId_idx" ON "Profile"("userId");

ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend ApiKey: nullable orgId FK → Org
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "orgId" TEXT;

CREATE INDEX IF NOT EXISTS "ApiKey_orgId_idx" ON "ApiKey"("orgId");

ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;
