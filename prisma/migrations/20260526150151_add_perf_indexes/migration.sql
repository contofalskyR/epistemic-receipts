-- Indexes created via scripts/apply-perf-indexes.ts using CONCURRENTLY
-- to avoid deadlocks with concurrent ingester writes. This file documents
-- the resulting schema; the actual CREATE INDEX statements ran outside
-- this migration's transaction.

CREATE INDEX IF NOT EXISTS "Claim_ingestedBy_idx" ON "Claim"("ingestedBy");
CREATE INDEX IF NOT EXISTS "Claim_claimType_idx" ON "Claim"("claimType");
CREATE INDEX IF NOT EXISTS "Claim_currentStatus_idx" ON "Claim"("currentStatus");
CREATE INDEX IF NOT EXISTS "Claim_verificationStatus_idx" ON "Claim"("verificationStatus");
CREATE INDEX IF NOT EXISTS "Claim_createdAt_idx" ON "Claim"("createdAt");
CREATE INDEX IF NOT EXISTS "Claim_claimEmergedAt_idx" ON "Claim"("claimEmergedAt");
CREATE INDEX IF NOT EXISTS "Claim_parentClaimId_idx" ON "Claim"("parentClaimId");
CREATE INDEX IF NOT EXISTS "Claim_deleted_parentClaimId_claimType_idx" ON "Claim"("deleted", "parentClaimId", "claimType");
CREATE INDEX IF NOT EXISTS "Claim_deleted_ingestedBy_idx" ON "Claim"("deleted", "ingestedBy");
CREATE INDEX IF NOT EXISTS "ClaimTopic_claimId_idx" ON "ClaimTopic"("claimId");
CREATE INDEX IF NOT EXISTS "Edge_sourceId_idx" ON "Edge"("sourceId");
CREATE INDEX IF NOT EXISTS "Edge_claimId_idx" ON "Edge"("claimId");
CREATE INDEX IF NOT EXISTS "Edge_createdAt_idx" ON "Edge"("createdAt");
CREATE INDEX IF NOT EXISTS "Edge_deleted_claimId_idx" ON "Edge"("deleted", "claimId");
CREATE INDEX IF NOT EXISTS "Edge_deleted_sourceId_idx" ON "Edge"("deleted", "sourceId");
CREATE INDEX IF NOT EXISTS "EdgeRevision_edgeId_idx" ON "EdgeRevision"("edgeId");
CREATE INDEX IF NOT EXISTS "LegislativeVote_sourceId_idx" ON "LegislativeVote"("sourceId");
CREATE INDEX IF NOT EXISTS "LegislativeVote_result_idx" ON "LegislativeVote"("result");
CREATE INDEX IF NOT EXISTS "MetaEdge_claimId_idx" ON "MetaEdge"("claimId");
CREATE INDEX IF NOT EXISTS "MetaEdge_targetEdgeId_idx" ON "MetaEdge"("targetEdgeId");
CREATE INDEX IF NOT EXISTS "MetaEdge_actorSourceId_idx" ON "MetaEdge"("actorSourceId");
CREATE INDEX IF NOT EXISTS "PoliticalContext_country_idx" ON "PoliticalContext"("country");
CREATE INDEX IF NOT EXISTS "PoliticalContext_hogParty_idx" ON "PoliticalContext"("hogParty");
CREATE INDEX IF NOT EXISTS "PoliticalContext_headOfGovernment_idx" ON "PoliticalContext"("headOfGovernment");
CREATE INDEX IF NOT EXISTS "Source_ingestedBy_idx" ON "Source"("ingestedBy");
CREATE INDEX IF NOT EXISTS "Source_createdAt_idx" ON "Source"("createdAt");
CREATE INDEX IF NOT EXISTS "Source_deleted_ingestedBy_idx" ON "Source"("deleted", "ingestedBy");
CREATE INDEX IF NOT EXISTS "SourceCredibilityEvent_sourceId_idx" ON "SourceCredibilityEvent"("sourceId");
CREATE INDEX IF NOT EXISTS "SourceRelationship_sourceAId_idx" ON "SourceRelationship"("sourceAId");
CREATE INDEX IF NOT EXISTS "SourceRelationship_sourceBId_idx" ON "SourceRelationship"("sourceBId");
CREATE INDEX IF NOT EXISTS "SuggestedThresholdEvent_claimId_idx" ON "SuggestedThresholdEvent"("claimId");
CREATE INDEX IF NOT EXISTS "SuggestedThresholdEvent_triggeredBySourceId_idx" ON "SuggestedThresholdEvent"("triggeredBySourceId");
CREATE INDEX IF NOT EXISTS "ThresholdEvent_claimId_idx" ON "ThresholdEvent"("claimId");
CREATE INDEX IF NOT EXISTS "ThresholdEvent_triggeredBySourceId_idx" ON "ThresholdEvent"("triggeredBySourceId");
CREATE INDEX IF NOT EXISTS "ThresholdEvent_createdAt_idx" ON "ThresholdEvent"("createdAt");
