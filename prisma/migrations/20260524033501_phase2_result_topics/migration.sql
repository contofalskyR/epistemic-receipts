-- AlterTable
ALTER TABLE "LegislativeVote" ADD COLUMN     "result" TEXT,
ADD COLUMN     "topics" TEXT;

-- CreateTable
CREATE TABLE "Polity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT,
    "governmentType" TEXT NOT NULL,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "wikidataId" TEXT,
    "successorOf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Polity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Polity_wikidataId_key" ON "Polity"("wikidataId");
