-- CreateEnum
CREATE TYPE "ReviewConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentStatus" TEXT NOT NULL DEFAULT 'DISPUTED',
    "claimType" TEXT NOT NULL DEFAULT 'EMPIRICAL',
    "parentClaimId" TEXT,
    "claimEmergedAt" TIMESTAMP(3),
    "claimEmergedPrecision" TEXT,
    "ingestedBy" TEXT NOT NULL DEFAULT 'manual',
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewConfidence" "ReviewConfidence",
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "externalId" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "publishedAt" TIMESTAMP(3),
    "methodologyType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingestedBy" TEXT NOT NULL DEFAULT 'manual',
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewConfidence" "ReviewConfidence",
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "externalId" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRelationship" (
    "id" TEXT NOT NULL,
    "sourceAId" TEXT NOT NULL,
    "sourceBId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceCredibilityEvent" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceCredibilityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edge" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL DEFAULT 'EVIDENTIARY',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingestedBy" TEXT NOT NULL DEFAULT 'manual',
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewConfidence" "ReviewConfidence",
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Edge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdgeRevision" (
    "id" TEXT NOT NULL,
    "edgeId" TEXT NOT NULL,
    "priorScore" INTEGER,
    "newScore" INTEGER NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EdgeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaEdge" (
    "id" TEXT NOT NULL,
    "actorSourceId" TEXT NOT NULL,
    "targetEdgeId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingestedBy" TEXT NOT NULL DEFAULT 'manual',
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewConfidence" "ReviewConfidence",
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "MetaEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestedThresholdEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "aiReasoning" TEXT NOT NULL,
    "evidenceSnapshot" TEXT NOT NULL,
    "triggeredBySourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestedThresholdEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThresholdEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "suggestedEventId" TEXT,
    "confirmedBy" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "triggeredBySourceId" TEXT,
    "note" TEXT,
    "evidenceSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingestedBy" TEXT NOT NULL DEFAULT 'manual',
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewConfidence" "ReviewConfidence",
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ThresholdEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT NOT NULL,
    "parentTopicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimTopic" (
    "claimId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimTopic_pkey" PRIMARY KEY ("claimId","topicId")
);

-- CreateTable
CREATE TABLE "AiJob" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "inputPayload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Claim_externalId_key" ON "Claim"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_externalId_key" ON "Source"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ThresholdEvent_suggestedEventId_key" ON "ThresholdEvent"("suggestedEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Topic_domain_idx" ON "Topic"("domain");

-- CreateIndex
CREATE INDEX "Topic_parentTopicId_idx" ON "Topic"("parentTopicId");

-- CreateIndex
CREATE INDEX "ClaimTopic_topicId_idx" ON "ClaimTopic"("topicId");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_parentClaimId_fkey" FOREIGN KEY ("parentClaimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRelationship" ADD CONSTRAINT "SourceRelationship_sourceAId_fkey" FOREIGN KEY ("sourceAId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRelationship" ADD CONSTRAINT "SourceRelationship_sourceBId_fkey" FOREIGN KEY ("sourceBId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceCredibilityEvent" ADD CONSTRAINT "SourceCredibilityEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdgeRevision" ADD CONSTRAINT "EdgeRevision_edgeId_fkey" FOREIGN KEY ("edgeId") REFERENCES "Edge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaEdge" ADD CONSTRAINT "MetaEdge_actorSourceId_fkey" FOREIGN KEY ("actorSourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaEdge" ADD CONSTRAINT "MetaEdge_targetEdgeId_fkey" FOREIGN KEY ("targetEdgeId") REFERENCES "Edge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaEdge" ADD CONSTRAINT "MetaEdge_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedThresholdEvent" ADD CONSTRAINT "SuggestedThresholdEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedThresholdEvent" ADD CONSTRAINT "SuggestedThresholdEvent_triggeredBySourceId_fkey" FOREIGN KEY ("triggeredBySourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThresholdEvent" ADD CONSTRAINT "ThresholdEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThresholdEvent" ADD CONSTRAINT "ThresholdEvent_suggestedEventId_fkey" FOREIGN KEY ("suggestedEventId") REFERENCES "SuggestedThresholdEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThresholdEvent" ADD CONSTRAINT "ThresholdEvent_triggeredBySourceId_fkey" FOREIGN KEY ("triggeredBySourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_parentTopicId_fkey" FOREIGN KEY ("parentTopicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimTopic" ADD CONSTRAINT "ClaimTopic_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimTopic" ADD CONSTRAINT "ClaimTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
