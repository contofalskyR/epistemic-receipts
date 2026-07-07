/**
 * /api/v1/verify
 *
 * Given a text fragment, find semantically similar claims in the corpus.
 * Uses vector search (ClaimEmbedding) to surface related documented facts.
 *
 * IMPORTANT: This endpoint surfaces SIMILAR claims — not truth verdicts.
 * The `epistemicAxis` field describes the claim's documented status, not
 * a judgment about the submitted text.
 *
 * Security: read-only GET + rate-limited in middleware.
 */
import { NextRequest, NextResponse } from "next/server";
import { searchClaims } from "@/lib/search";

export const dynamic = "force-dynamic";

const MIN_QUERY = 10;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const text = (url.searchParams.get("text") ?? "").trim();

  if (text.length < MIN_QUERY) {
    return NextResponse.json(
      { error: `Text must be at least ${MIN_QUERY} characters.` },
      { status: 400 },
    );
  }

  const limit = Math.max(
    1,
    Math.min(
      MAX_LIMIT,
      Number.parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT,
    ),
  );

  // Use vector search for similarity-based matching; fall back to hybrid if
  // ClaimEmbedding is empty (pre-backfill). The caller gets similarity scores,
  // not truth verdicts.
  const results = await searchClaims(text, "vector", {}, limit, 0).catch(() =>
    searchClaims(text, "hybrid", {}, limit, 0)
  );

  return NextResponse.json(
    {
      text,
      disclaimer:
        "Results are semantically similar documented claims. " +
        "epistemicAxis reflects the claim's documented status — not a verdict on your text.",
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
        similarity: Number(r.rank.toFixed(4)),
      })),
    },
    {
      headers: {
        "CDN-Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
