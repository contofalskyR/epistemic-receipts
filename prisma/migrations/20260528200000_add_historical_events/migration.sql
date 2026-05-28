-- CreateTable
CREATE TABLE "HistoricalEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimHistoricalEvent" (
    "claimId" TEXT NOT NULL,
    "historicalEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimHistoricalEvent_pkey" PRIMARY KEY ("claimId","historicalEventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalEvent_slug_key" ON "HistoricalEvent"("slug");

-- CreateIndex
CREATE INDEX "HistoricalEvent_category_idx" ON "HistoricalEvent"("category");

-- CreateIndex
CREATE INDEX "HistoricalEvent_startDate_idx" ON "HistoricalEvent"("startDate");

-- CreateIndex
CREATE INDEX "ClaimHistoricalEvent_historicalEventId_idx" ON "ClaimHistoricalEvent"("historicalEventId");

-- CreateIndex
CREATE INDEX "ClaimHistoricalEvent_claimId_idx" ON "ClaimHistoricalEvent"("claimId");

-- AddForeignKey
ALTER TABLE "ClaimHistoricalEvent" ADD CONSTRAINT "ClaimHistoricalEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimHistoricalEvent" ADD CONSTRAINT "ClaimHistoricalEvent_historicalEventId_fkey" FOREIGN KEY ("historicalEventId") REFERENCES "HistoricalEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
