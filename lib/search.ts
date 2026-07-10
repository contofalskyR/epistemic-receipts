/**
 * Unified search library for Epistemic Receipts.
 *
 * Modes:
 *   tsvector — PostgreSQL full-text search (websearch_to_tsquery + trgm fallback)
 *   vector   — cosine ANN via ClaimEmbedding (text-embedding-3-small, 1536 dim)
 *   hybrid   — RRF(tsvector top-100 + vector top-100, k=60) — DEFAULT
 *
 * The search_mode query param selects the mode; omit for hybrid.
 * Wired into /api/search, /api/v1/search, /api/v1/verify.
 */

import { prisma } from "@/lib/prisma";
import { embedText3Small } from "@/lib/embeddings";
import {
  terminalAxisLateralJoin,
  effectiveAxisCondition,
  REVERSAL_AXES,
} from "@/lib/effective-axis";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchMode = "tsvector" | "vector" | "hybrid";

export type ClaimSearchResult = {
  id: string;
  text: string;
  currentStatus: string;
  epistemicAxis: string | null;
  claimType: string;
  ingestedBy: string;
  verificationStatus: string | null;
  epistemicStatus: string | null;
  createdAt: string;
  claimEmergedAt: string | null;
  claimEmergedPrecision: string | null;
  externalId: string | null;
  sourceName: string | null;
  topicLabel: string | null;
  rank: number;
  searchMode: SearchMode;
};

export type SearchFilters = {
  axis?: string | null;
  pipelines?: string[];
};

// ── RRF ───────────────────────────────────────────────────────────────────────
// Reciprocal Rank Fusion: score(d) = sum over lists of 1/(k + rank(d))
// k=60 is the standard default (Cormack et al. 2009).

const RRF_K = 60;

function rrfFuse(
  listA: Array<{ id: string; rank: number }>,
  listB: Array<{ id: string; rank: number }>,
): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();

  const addList = (list: Array<{ id: string }>) => {
    list.forEach((item, i) => {
      const rrf = 1 / (RRF_K + i + 1);
      scores.set(item.id, (scores.get(item.id) ?? 0) + rrf);
    });
  };

  addList(listA);
  addList(listB);

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

// ── Row type helpers ──────────────────────────────────────────────────────────

export type ClaimRow = {
  id: string;
  text: string;
  currentStatus: string;
  epistemicAxis: string | null;
  claimType: string;
  ingestedBy: string;
  verificationStatus: string | null;
  epistemicStatus: string | null;
  createdAt: Date;
  claimEmergedAt: Date | null;
  claimEmergedPrecision: string | null;
  externalId: string | null;
  sourceName: string | null;
  topicLabel: string | null;
  // Terminal transition axis (lib/effective-axis.terminalAxisLateralJoin), NULL
  // when the claim has no transitions. Used only to resolve the display axis
  // below; not surfaced in ClaimSearchResult.
  terminalAxis: string | null;
  rank: number;
};

export function formatRow(row: ClaimRow, mode: SearchMode): ClaimSearchResult {
  // Effective (display) axis: a terminal REVERSED/ABANDONED transition overrides
  // the stale stored column, mirroring resolveDisplayAxis (transition-contract).
  const effectiveAxis =
    row.terminalAxis && (REVERSAL_AXES as readonly string[]).includes(row.terminalAxis)
      ? row.terminalAxis
      : (row.epistemicAxis ?? null);
  return {
    id: row.id,
    text: row.text,
    currentStatus: row.currentStatus,
    epistemicAxis: effectiveAxis,
    claimType: row.claimType,
    ingestedBy: row.ingestedBy,
    verificationStatus: row.verificationStatus ?? null,
    epistemicStatus: row.epistemicStatus ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    claimEmergedAt: row.claimEmergedAt instanceof Date ? row.claimEmergedAt.toISOString() : (row.claimEmergedAt ?? null),
    claimEmergedPrecision: row.claimEmergedPrecision ?? null,
    externalId: row.externalId ?? null,
    sourceName: row.sourceName ?? null,
    topicLabel: row.topicLabel ?? null,
    rank: row.rank,
    searchMode: mode,
  };
}

// ── Shared lateral joins (source name + topic label) ─────────────────────────

const LATERAL_JOINS = `
  LEFT JOIN LATERAL (
    SELECT s2."name"
    FROM "Edge" e
    JOIN "Source" s2 ON s2."id" = e."sourceId"
    WHERE e."claimId" = c."id" AND e."deleted" = false
    ORDER BY e."createdAt" ASC
    LIMIT 1
  ) s ON true
  LEFT JOIN LATERAL (
    SELECT t2."name"
    FROM "ClaimTopic" ct
    JOIN "Topic" t2 ON t2."id" = ct."topicId"
    WHERE ct."claimId" = c."id"
    LIMIT 1
  ) t ON true`;

// ── SQL builders (exported for unit testing) ─────────────────────────────────

export function buildTsvectorSql(
  query: string,
  filters: SearchFilters,
  limit: number,
  offset: number,
): { sql: string; params: unknown[] } {
  const conditions: string[] = [`c."deleted" = false`];
  const params: unknown[] = [query];
  let paramIdx = 2;

  conditions.push(
    `(c."searchVector" @@ websearch_to_tsquery('english', $1) OR c."text" ILIKE '%' || $1 || '%')`
  );

  if (filters.axis) {
    params.push(filters.axis);
    conditions.push(effectiveAxisCondition(`$${paramIdx++}`));
  }

  if (filters.pipelines && filters.pipelines.length > 0) {
    const placeholders = filters.pipelines.map(() => `$${paramIdx++}`);
    params.push(...filters.pipelines);
    conditions.push(`c."ingestedBy" IN (${placeholders.join(", ")})`);
  }

  params.push(limit, offset);
  const limitParam = paramIdx++;
  const offsetParam = paramIdx++;

  const where = conditions.join(" AND ");

  const sql = `SELECT
       c."id", c."text", c."currentStatus", c."epistemicAxis",
       c."claimType", c."ingestedBy", c."verificationStatus", c."epistemicStatus",
       c."createdAt", c."claimEmergedAt", c."claimEmergedPrecision", c."externalId",
       s."name" AS "sourceName", t."name" AS "topicLabel",
       term."term" AS "terminalAxis",
       ts_rank(c."searchVector", websearch_to_tsquery('english', $1)) AS rank
     FROM "Claim" c
     ${terminalAxisLateralJoin()}
     ${LATERAL_JOINS}
     WHERE ${where}
     ORDER BY rank DESC, c."createdAt" DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`;

  return { sql, params };
}

export function buildVectorSql(
  vecStr: string,
  filters: SearchFilters,
  limit: number,
  offset: number,
): { sql: string; params: unknown[] } {
  const conditions: string[] = [
    `c."deleted" = false`,
    `ce."embedding" IS NOT NULL`,
  ];
  const params: unknown[] = [vecStr];
  let paramIdx = 2;

  if (filters.axis) {
    params.push(filters.axis);
    conditions.push(effectiveAxisCondition(`$${paramIdx++}`));
  }

  if (filters.pipelines && filters.pipelines.length > 0) {
    const placeholders = filters.pipelines.map(() => `$${paramIdx++}`);
    params.push(...filters.pipelines);
    conditions.push(`c."ingestedBy" IN (${placeholders.join(", ")})`);
  }

  params.push(limit, offset);
  const limitParam = paramIdx++;
  const offsetParam = paramIdx++;

  const where = conditions.join(" AND ");

  const sql = `SELECT
       c."id", c."text", c."currentStatus", c."epistemicAxis",
       c."claimType", c."ingestedBy", c."verificationStatus", c."epistemicStatus",
       c."createdAt", c."claimEmergedAt", c."claimEmergedPrecision", c."externalId",
       s."name" AS "sourceName", t."name" AS "topicLabel",
       term."term" AS "terminalAxis",
       1 - (ce."embedding" <=> $1::vector) AS rank
     FROM "ClaimEmbedding" ce
     JOIN "Claim" c ON c."id" = ce."claimId"
     ${terminalAxisLateralJoin()}
     ${LATERAL_JOINS}
     WHERE ${where}
     ORDER BY ce."embedding" <=> $1::vector
     LIMIT $${limitParam} OFFSET $${offsetParam}`;

  return { sql, params };
}

// ── tsvector search (top-100 candidates) ─────────────────────────────────────

async function tsvectorSearch(
  query: string,
  filters: SearchFilters,
  limit: number,
  offset: number,
): Promise<ClaimRow[]> {
  const { sql, params } = buildTsvectorSql(query, filters, limit, offset);
  return prisma.$queryRawUnsafe<ClaimRow[]>(sql, ...params);
}

// ── vector search (top-100 candidates via ClaimEmbedding) ────────────────────

async function vectorSearch(
  query: string,
  filters: SearchFilters,
  limit: number,
  offset: number,
): Promise<ClaimRow[]> {
  const vec = await embedText3Small(query);
  const vecStr = `[${vec.join(",")}]`;

  const { sql, params } = buildVectorSql(vecStr, filters, limit, offset);
  return prisma.$queryRawUnsafe<ClaimRow[]>(sql, ...params);
}

// ── Hybrid search ─────────────────────────────────────────────────────────────

async function hybridSearch(
  query: string,
  filters: SearchFilters,
  limit: number,
  offset: number,
): Promise<ClaimRow[]> {
  // Fetch top-100 candidates from each method in parallel.
  // Both legs are caught independently — vector fails gracefully when OPENAI_API_KEY
  // is absent or ClaimEmbedding table is empty; tsvector falls back to [] if the
  // search index is unavailable (e.g. fresh DB without generated columns).
  const [tsRows, vecRows] = await Promise.all([
    tsvectorSearch(query, filters, 100, 0).catch(() => [] as ClaimRow[]),
    vectorSearch(query, filters, 100, 0).catch(() => [] as ClaimRow[]),
  ]);

  // RRF fusion
  const fused = rrfFuse(
    tsRows.map((r, i) => ({ id: r.id, rank: i })),
    vecRows.map((r, i) => ({ id: r.id, rank: i })),
  );

  // Build an id → row map from both result sets
  const rowMap = new Map<string, ClaimRow>();
  for (const r of [...tsRows, ...vecRows]) {
    if (!rowMap.has(r.id)) rowMap.set(r.id, r);
  }

  // Apply pagination and hydrate
  return fused
    .slice(offset, offset + limit)
    .map((f, i) => {
      const row = rowMap.get(f.id)!;
      return { ...row, rank: f.score };
    })
    .filter(Boolean);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Unified claim search. Dispatches to tsvector / vector / hybrid based on mode.
 *
 * @param query       — search string (3+ chars)
 * @param mode        — "tsvector" | "vector" | "hybrid" (default: "hybrid")
 * @param filters     — optional axis / pipeline filters
 * @param limit       — max results (1–100)
 * @param offset      — pagination offset
 */
export async function searchClaims(
  query: string,
  mode: SearchMode = "hybrid",
  filters: SearchFilters = {},
  limit = 25,
  offset = 0,
): Promise<ClaimSearchResult[]> {
  let rows: ClaimRow[];

  switch (mode) {
    case "tsvector":
      rows = await tsvectorSearch(query, filters, limit, offset);
      break;
    case "vector":
      rows = await vectorSearch(query, filters, limit, offset);
      break;
    case "hybrid":
    default:
      rows = await hybridSearch(query, filters, limit, offset);
      break;
  }

  return rows.map(r => formatRow(r, mode));
}

/**
 * Count of claims matching the tsvector query (used for pagination).
 * Vector/hybrid counts are approximate (top-200 candidate pool).
 */
export async function countClaimsTs(
  query: string,
  filters: SearchFilters = {},
): Promise<number> {
  const conditions: string[] = [`c."deleted" = false`];
  const params: unknown[] = [query];
  let paramIdx = 2;

  conditions.push(
    `(c."searchVector" @@ websearch_to_tsquery('english', $1) OR c."text" ILIKE '%' || $1 || '%')`
  );

  if (filters.axis) {
    params.push(filters.axis);
    conditions.push(effectiveAxisCondition(`$${paramIdx++}`));
  }

  if (filters.pipelines && filters.pipelines.length > 0) {
    const placeholders = filters.pipelines.map(() => `$${paramIdx++}`);
    params.push(...filters.pipelines);
    conditions.push(`c."ingestedBy" IN (${placeholders.join(", ")})`);
  }

  const where = conditions.join(" AND ");
  // The lateral join is only needed to satisfy effectiveAxisCondition's
  // reference to term.term; skip it entirely when no axis filter is applied.
  const axisJoin = filters.axis ? terminalAxisLateralJoin() : "";
  const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT count(*)::bigint AS count FROM "Claim" c ${axisJoin} WHERE ${where}`,
    ...params,
  );
  return Number(result[0].count);
}
