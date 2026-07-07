/**
 * GET /v1/search?q=
 *
 * Hybrid tsvector (+ vector if ClaimEmbedding exists) search over claims.
 * Auth required. No truth verdicts — ranking signal only.
 */
import { NextRequest } from "next/server";
import { searchClaims, countClaimsTs, type SearchMode } from "@/lib/search";
import { verifyApiKey, isAuthError } from "@/lib/v1/auth";
import { computeProvenanceGrade } from "@/lib/v1/provenance";
import { v1Json, v1Error, methodNotAllowed, badRequest } from "@/lib/v1/respond";
import { readPrisma } from "@/lib/v1/readClient";

export const dynamic = "force-dynamic";

const VALID_SEARCH_MODES = ["tsvector", "vector", "hybrid"] as const;
const VALID_AXES = ["SETTLED", "CONTESTED", "RECORDED", "OPEN", "UNRESOLVABLE"] as const;

export async function GET(req: NextRequest) {
  const auth = await verifyApiKey(req, "search");
  if (isAuthError(auth)) return v1Error(auth.body, auth.headers);

  const url = req.nextUrl;
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 3) return badRequest("Query must be at least 3 characters.");
  if (q.length > 500) return badRequest("Query must be at most 500 characters.");

  const searchModeRaw = (url.searchParams.get("mode") ?? "").toLowerCase();
  const searchMode: SearchMode = (VALID_SEARCH_MODES as readonly string[]).includes(searchModeRaw)
    ? (searchModeRaw as SearchMode)
    : "hybrid";

  const axisRaw = (url.searchParams.get("axis") ?? "").trim().toUpperCase();
  const axisFilter = (VALID_AXES as readonly string[]).includes(axisRaw) ? axisRaw : null;

  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20),
  );
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  const filters = { axis: axisFilter };

  const [total, results] = await Promise.all([
    countClaimsTs(q, filters),
    searchClaims(q, searchMode, filters, limit, offset),
  ]);

  // Enrich with primary edge counts for provenance grades
  const ids = results.map(r => r.id);
  const edgeCounts =
    ids.length > 0
      ? await readPrisma.edge.groupBy({
          by: ["claimId"],
          where: { claimId: { in: ids }, deleted: false, source: { methodologyType: "primary" } },
          _count: { _all: true },
        })
      : [];
  const edgeMap = new Map(edgeCounts.map(e => [e.claimId, e._count._all]));

  return v1Json(
    {
      query: q,
      mode: searchMode,
      total,
      limit,
      offset,
      data: results.map(r => ({
        id: r.id,
        text: r.text,
        epistemicAxis: r.epistemicAxis,
        claimType: r.claimType,
        ingestedBy: r.ingestedBy,
        verificationStatus: r.verificationStatus,
        humanReviewed: false,
        createdAt: r.createdAt,
        updatedAt: null,
        rank: Number(r.rank.toFixed(6)),
        provenanceGrade: computeProvenanceGrade({
          humanReviewed: false, // not available in search result; enriched via edgeMap
          autoApproved: false,
          verificationStatus: r.verificationStatus ?? null,
          epistemicAxis: r.epistemicAxis ?? null,
          primarySourceEdgeCount: edgeMap.get(r.id) ?? 0,
        }),
      })),
    },
    { cache: "list" },
  );
}

export function POST() { return methodNotAllowed(); }
export function PUT() { return methodNotAllowed(); }
export function PATCH() { return methodNotAllowed(); }
export function DELETE() { return methodNotAllowed(); }
