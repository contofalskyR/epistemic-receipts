-- CreateTable
CREATE TABLE "WikidataLink" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "wikidataQid" TEXT NOT NULL,
    "wikidataLabel" TEXT,
    "matchMethod" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "enrichedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikidataLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WikidataLink_sourceId_key" ON "WikidataLink"("sourceId");

-- CreateIndex
CREATE INDEX "WikidataLink_wikidataQid_idx" ON "WikidataLink"("wikidataQid");

-- CreateIndex
CREATE INDEX "WikidataLink_matchMethod_idx" ON "WikidataLink"("matchMethod");

-- AddForeignKey
ALTER TABLE "WikidataLink" ADD CONSTRAINT "WikidataLink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
