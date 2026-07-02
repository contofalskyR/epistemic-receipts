import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

const MIN_QUERY = 3;
const DEFAULT_LIMIT = 10;

export type SemanticHit = {
  id: string;
  externalId: string | null;
  text: string;
  epistemicAxis: string | null;
  claimEmergedAt: string | null;
  claimEmergedPrecision: string | null;
  epistemicStatus: string | null;
  rank: number;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.max(
    1,
    Math.min(50, Number.parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT),
  );

  if (q.length < MIN_QUERY) {
    return NextResponse.json({
      query: q,
      terms: null,
      results: [] as SemanticHit[],
      message: `Query must be at least ${MIN_QUERY} characters.`,
    });
  }

  // Embed the query using OpenAI text-embedding-3-small
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: q,
  });

  const vec = `[${embedding.join(",")}]`;

  // Cosine similarity search via pgvector (<=> is cosine distance)
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      externalId: string | null;
      text: string;
      epistemicAxis: string | null;
      claimEmergedAt: Date | null;
      claimEmergedPrecision: string | null;
      epistemicStatus: string | null;
      rank: number;
    }>
  >(
    `SELECT
       c."id",
       c."externalId",
       c."text",
       c."epistemicAxis",
       c."claimEmergedAt",
       c."claimEmergedPrecision",
       c."epistemicStatus",
       1 - (d."embedding" <=> $1::vector) AS rank
     FROM "TrajectorySearchDoc" d
     JOIN "Claim" c ON c."id" = d."claimId"
     WHERE c."deleted" = false
       AND d."embedding" IS NOT NULL
     ORDER BY d."embedding" <=> $1::vector
     LIMIT $2`,
    vec,
    limit,
  );

  const results: SemanticHit[] = rows.map((r) => ({
    id: r.id,
    externalId: r.externalId ?? null,
    text: r.text,
    epistemicAxis: r.epistemicAxis ?? null,
    claimEmergedAt:
      r.claimEmergedAt instanceof Date
        ? r.claimEmergedAt.toISOString()
        : (r.claimEmergedAt ?? null),
    claimEmergedPrecision: r.claimEmergedPrecision ?? null,
    epistemicStatus: r.epistemicStatus ?? null,
    rank: r.rank,
  }));

  return NextResponse.json(
    {
      query: q,
      terms: null,
      results,
    },
    {
      headers: {
        "CDN-Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
