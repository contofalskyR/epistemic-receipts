-- B11-2: Add MemberIdeology table for DW-NOMINATE ideology scores
-- Source: Voteview HSall_members.csv — one row per member per Congress per chamber
-- Additive only; no existing tables or columns modified.
-- Safe to apply against a live DB; corpus promoter loop does not need to be paused.
-- Applied via: prisma db execute --file prisma/migrations/20260715000000_add_member_ideology/migration.sql
-- Then:        prisma migrate resolve --applied 20260715000000_add_member_ideology

CREATE TABLE IF NOT EXISTS "MemberIdeology" (
    "id"           TEXT        NOT NULL,
    "icpsrId"      INTEGER     NOT NULL,
    "bioguideId"   TEXT,
    "congress"     INTEGER     NOT NULL,
    "chamber"      TEXT        NOT NULL,
    "memberName"   TEXT        NOT NULL,
    "party"        TEXT,
    "stateAbbrev"  TEXT,
    "nominateDim1" DOUBLE PRECISION,
    "nominateDim2" DOUBLE PRECISION,
    "geoMeanProb"  DOUBLE PRECISION,
    "metadata"     JSONB,
    "dataSource"   TEXT        NOT NULL DEFAULT 'voteview_members_v1',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberIdeology_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    CREATE UNIQUE INDEX "MemberIdeology_icpsrId_congress_chamber_key"
        ON "MemberIdeology"("icpsrId", "congress", "chamber");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    CREATE INDEX "MemberIdeology_bioguideId_idx" ON "MemberIdeology"("bioguideId");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    CREATE INDEX "MemberIdeology_congress_chamber_idx" ON "MemberIdeology"("congress", "chamber");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    CREATE INDEX "MemberIdeology_nominateDim1_idx" ON "MemberIdeology"("nominateDim1");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
