/**
 * /api/v1/search
 *
 * Public read-only search endpoint for the v1 API.
 * Uses hybrid RRF search (tsvector + vector) by default.
 *
 * Security: read-only GET + rate-limited in middleware.
 * No truth verdicts, no scores beyond ranking signal.
 */
import { NextRequest, NextResponse } from "next/server";
import { searchClaims, countClaimsTs, type SearchMode } from "@/lib/search";

export const dynamic = "force-dynamic";

const MIN_QUERY = 3;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const VALID_SEARCH_MODES = ["tsvector", "vector", "hybrid"] as const;
const VALID_AXES = ["SETTLED", "CONTESTED", "RECORDED", "OPEN", "UNRESOLVABLE"] as const;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < MIN_QUERY) {
    return NextResponse.json(
      { error: `Query must be at least ${MIN_QUERY} characters.` },
      { status: 400 },
    );
  }

  const searchModeRaw = (url.searchParams.get("mode") ?? "").toLowerCase();
  const searchMode: SearchMode = (VALID_SEARCH_MODES as readonly string[]).includes(searchModeRaw)
    ? (searchModeRaw as SearchMode)
    : "hybrid";

  const axisRaw = (url.searchParams.get("axis") ?? "").trim().toUpperCase();
  const axisFilter = (VALID_AXES as readonly string[]).includes(axisRaw) ? axisRaw : null;

  const limit = Math.max(
    1,
    Math.min(
      MAX_LIMIT,
      Number.parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT,
    ),
  );
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  const filters = { axis: axisFilter };

  const [total, results] = await Promise.all([
    countClaimsTs(q, filters),
    searchClaims(q, searchMode, filters, limit, offset),
  ]);

  return NextResponse.json(
    {
      query: q,
      mode: searchMode,
      total,
      limit,
      offset,
      results: results.map(r => ({
        id: r.id,
        externalId: r.externalId,
        text: r.text,
        epistemicAxis: r.epistemicAxis,
        claimType: r.claimType,
        ingestedBy: r.ingestedBy,
        verificationStatus: r.verificationStatus,
        epistemicStatus: r.epistemicStatus,
        createdAt: r.createdAt,
        claimEmergedAt: r.claimEmergedAt,
        claimEmergedPrecision: r.claimEmergedPrecision,
        rank: r.rank,
      })),
    },
    {
      headers: {
        "CDN-Cache-Control": "s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
