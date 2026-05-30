-- CreateTable
CREATE TABLE "ConstituentOpinion" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT,
    "year" INTEGER NOT NULL,
    "topicSlug" TEXT NOT NULL,
    "supportPct" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "questionCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConstituentOpinion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConstituentOpinion_state_district_year_topicSlug_questionCo_key" ON "ConstituentOpinion"("state", "district", "year", "topicSlug", "questionCode");

-- CreateIndex
CREATE INDEX "ConstituentOpinion_year_idx" ON "ConstituentOpinion"("year");

-- CreateIndex
CREATE INDEX "ConstituentOpinion_state_idx" ON "ConstituentOpinion"("state");

-- CreateIndex
CREATE INDEX "ConstituentOpinion_topicSlug_idx" ON "ConstituentOpinion"("topicSlug");

-- CreateIndex
CREATE INDEX "ConstituentOpinion_state_year_topicSlug_idx" ON "ConstituentOpinion"("state", "year", "topicSlug");
