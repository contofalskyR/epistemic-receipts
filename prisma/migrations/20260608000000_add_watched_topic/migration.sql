-- CreateTable
CREATE TABLE "WatchedTopic" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAlertAt" TIMESTAMP(3),

    CONSTRAINT "WatchedTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchedTopic_keyword_key" ON "WatchedTopic"("keyword");
