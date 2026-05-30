-- CreateTable
CREATE TABLE "HistoricalEventVote" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "matchReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalEventVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalEventPolity" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "polityId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalEventPolity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalEventVote_eventId_voteId_key" ON "HistoricalEventVote"("eventId", "voteId");

-- CreateIndex
CREATE INDEX "HistoricalEventVote_eventId_idx" ON "HistoricalEventVote"("eventId");

-- CreateIndex
CREATE INDEX "HistoricalEventVote_voteId_idx" ON "HistoricalEventVote"("voteId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalEventPolity_eventId_polityId_key" ON "HistoricalEventPolity"("eventId", "polityId");

-- CreateIndex
CREATE INDEX "HistoricalEventPolity_eventId_idx" ON "HistoricalEventPolity"("eventId");

-- CreateIndex
CREATE INDEX "HistoricalEventPolity_polityId_idx" ON "HistoricalEventPolity"("polityId");

-- AddForeignKey
ALTER TABLE "HistoricalEventVote" ADD CONSTRAINT "HistoricalEventVote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalEventVote" ADD CONSTRAINT "HistoricalEventVote_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "LegislativeVote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalEventPolity" ADD CONSTRAINT "HistoricalEventPolity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalEventPolity" ADD CONSTRAINT "HistoricalEventPolity_polityId_fkey" FOREIGN KEY ("polityId") REFERENCES "Polity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
