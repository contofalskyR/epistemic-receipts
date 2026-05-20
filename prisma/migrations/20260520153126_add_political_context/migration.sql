-- CreateTable
CREATE TABLE "PoliticalContext" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "enactmentDate" TIMESTAMP(3),
    "headOfGovernment" TEXT,
    "hogParty" TEXT,
    "hogWikidataId" TEXT,
    "governingParty" TEXT,
    "majorityType" TEXT,
    "majoritySeats" INTEGER,
    "totalSeats" INTEGER,
    "coalitionPartners" TEXT,
    "wikidataItemId" TEXT,
    "enrichedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoliticalContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegislativeVote" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chamber" TEXT NOT NULL,
    "yesCount" INTEGER,
    "noCount" INTEGER,
    "abstainCount" INTEGER,
    "totalSeats" INTEGER,
    "passageThreshold" TEXT,
    "voteDate" TIMESTAMP(3),
    "passageType" TEXT,
    "dataSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegislativeVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PoliticalContext_sourceId_key" ON "PoliticalContext"("sourceId");

-- AddForeignKey
ALTER TABLE "PoliticalContext" ADD CONSTRAINT "PoliticalContext_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegislativeVote" ADD CONSTRAINT "LegislativeVote_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
