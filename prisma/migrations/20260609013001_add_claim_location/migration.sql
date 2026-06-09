-- CreateTable
CREATE TABLE "ClaimLocation" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "city" TEXT,
    "countryCode" TEXT,
    "source" TEXT NOT NULL,
    "precision" TEXT NOT NULL,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClaimLocation_claimId_idx" ON "ClaimLocation"("claimId");

-- CreateIndex
CREATE INDEX "ClaimLocation_lat_lon_idx" ON "ClaimLocation"("lat", "lon");

-- CreateIndex
CREATE INDEX "ClaimLocation_countryCode_idx" ON "ClaimLocation"("countryCode");

-- CreateIndex
CREATE INDEX "ClaimLocation_source_idx" ON "ClaimLocation"("source");

-- AddForeignKey
ALTER TABLE "ClaimLocation" ADD CONSTRAINT "ClaimLocation_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
