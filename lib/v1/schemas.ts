/**
 * Spec 20: v1 API — Zod schemas (single source of truth for validation + OpenAPI spec).
 */
import { z } from "zod";

// ── Shared primitives ────────────────────────────────────────────────────────

export const CursorSchema = z.string().min(1).max(500).optional();

export const LimitSchema = z
  .string()
  .optional()
  .transform(v => Math.min(200, Math.max(1, Number.parseInt(v ?? "20", 10) || 20)));

// REVERSED/ABANDONED are terminal transition outcomes, not stored-column values,
// but they ARE valid filter values: the /v1/claims filter resolves them against
// each claim's terminal transition (see lib/effective-axis.ts).
export const EpistemicAxisSchema = z
  .enum(["RECORDED", "SETTLED", "CONTESTED", "OPEN", "UNRESOLVABLE", "REVERSED", "ABANDONED"])
  .optional();

export const VerificationStatusSchema = z
  .enum(["VERIFIED", "PROVISIONAL", "DISPUTED", "DEPRECATED"])
  .optional();

// ── Claim shapes ─────────────────────────────────────────────────────────────

export const ClaimSummarySchema = z.object({
  id: z.string(),
  text: z.string(),
  claimType: z.string(),
  epistemicAxis: z.string().nullable(),
  verificationStatus: z.string().nullable(),
  ingestedBy: z.string(),
  humanReviewed: z.boolean(),
  createdAt: z.string(), // ISO
  updatedAt: z.string(),
  provenanceGrade: z.enum(["A", "B", "C", "D", "X"]),
});

export const EdgeSummarySchema = z.object({
  id: z.string(),
  type: z.string(),
  evidenceType: z.string(),
  source: z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().nullable(),
    methodologyType: z.string(),
    publishedAt: z.string().nullable(),
  }),
});

export const StatusHistoryItemSchema = z.object({
  id: z.string(),
  fromAxis: z.string().nullable(),
  toAxis: z.string(),
  community: z.string(),
  reason: z.string().nullable(),
  occurredAt: z.string(),
  datePrecision: z.string().nullable(),
  markerSourceId: z.string().nullable(),
});

export const ClaimRelationItemSchema = z.object({
  id: z.string(),
  relationType: z.string(),
  relatedClaimId: z.string(),
  year: z.number().nullable(),
});

export const TopicItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  domain: z.string(),
});

export const ClaimDetailSchema = ClaimSummarySchema.extend({
  claimEmergedAt: z.string().nullable(),
  claimEmergedPrecision: z.string().nullable(),
  autoApproved: z.boolean(),
  openAlexId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  provenanceDetail: z.object({
    grade: z.enum(["A", "B", "C", "D", "X"]),
    description: z.string(),
    primarySourceEdgeCount: z.number(),
  }),
  edges: z.array(EdgeSummarySchema),
  statusHistory: z.array(StatusHistoryItemSchema),
  relations: z.array(ClaimRelationItemSchema),
  topics: z.array(TopicItemSchema),
});

// ── Source shapes ────────────────────────────────────────────────────────────

export const SourceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().nullable(),
  methodologyType: z.string(),
  publishedAt: z.string().nullable(),
  humanReviewed: z.boolean(),
  ingestedBy: z.string(),
  createdAt: z.string(),
});

export const CredibilityEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  reason: z.string(),
  createdAt: z.string(),
});

export const SourceDetailSchema = SourceSummarySchema.extend({
  credibilityEvents: z.array(CredibilityEventSchema),
  relationships: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      otherSourceId: z.string(),
      otherSourceName: z.string(),
    }),
  ),
});

// ── Trajectory ───────────────────────────────────────────────────────────────

export const TrajectorySchema = z.object({
  claimId: z.string(),
  claimText: z.string(),
  statusHistory: z.array(StatusHistoryItemSchema),
});

// ── Search / verify ──────────────────────────────────────────────────────────

export const SearchResultSchema = z.object({
  claim: ClaimSummarySchema,
  rank: z.number(),
});

export const VerifyResultSchema = z.object({
  claim: ClaimSummarySchema,
  rank: z.number(),
  receipts: z.object({
    for: z.number(),
    against: z.number(),
    contradicts: z.number(),
  }),
});

// ── Retractions ──────────────────────────────────────────────────────────────

export const RetractionSchema = ClaimSummarySchema.extend({
  doi: z.string().nullable(),
  retractionDate: z.string().nullable(),
  originalPaperMetadata: z.record(z.string(), z.unknown()).nullable(),
  contradictsEdges: z.array(
    z.object({ targetClaimId: z.string() }),
  ),
});

// ── Pagination ───────────────────────────────────────────────────────────────

export function paginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    total: z.number().optional(),
  });
}

// ── Query param schemas ───────────────────────────────────────────────────────

export const ClaimsQuerySchema = z.object({
  pipeline: z.string().max(100).optional(),
  epistemicAxis: EpistemicAxisSchema,
  claimType: z.enum(["EMPIRICAL", "INSTITUTIONAL", "INTERPRETIVE", "HYBRID"]).optional(),
  verificationStatus: VerificationStatusSchema,
  emergedAfter: z.string().datetime().optional(),
  emergedBefore: z.string().datetime().optional(),
  topic: z.string().max(100).optional(),
  cursor: CursorSchema,
  limit: LimitSchema,
});

export const SourcesQuerySchema = z.object({
  cursor: CursorSchema,
  limit: LimitSchema,
});

export const SearchQuerySchema = z.object({
  q: z.string().min(3).max(500),
  limit: LimitSchema,
  cursor: CursorSchema,
});

export const VerifyQuerySchema = z.object({
  statement: z.string().min(10).max(500),
  limit: LimitSchema,
});

// ── Changelog ────────────────────────────────────────────────────────────────

export const ChangelogEntrySchema = z.object({
  version: z.string(),
  date: z.string(),
  changes: z.array(z.string()),
});
