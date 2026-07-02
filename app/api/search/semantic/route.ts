import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { prisma } from "@/lib/prisma";

const execFileAsync = promisify(execFile);

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

async function extractSearchTerms(query: string): Promise<string> {
  const prompt = `Extract 3-5 key search terms from this query for searching an epistemic knowledge base about scientific facts, laws, and historical events. Query: "${query}". Return only the terms, space-separated, no explanation, no punctuation.`;

  try {
    const { stdout } = await execFileAsync("claude", ["--print", prompt], {
      timeout: 15000,
    });
    const terms = stdout.trim().replace(/[^\w\s-]/g, " ").trim();
    return terms.length > 0 ? terms : query;
  } catch {
    // Fallback to raw query if claude CLI fails
    return query;
  }
}

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

  // Expand query to semantic terms via Claude
  const terms = await extractSearchTerms(q);

  // Build websearch_to_tsquery expression from extracted terms
  // Use OR logic: any term can match
  const tsQuery = terms
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .join(" | ");

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
       ts_rank(to_tsvector('english', d."fullText"), to_tsquery('english', $1)) AS rank
     FROM "TrajectorySearchDoc" d
     JOIN "Claim" c ON c."id" = d."claimId"
     WHERE c."deleted" = false
       AND to_tsvector('english', d."fullText") @@ to_tsquery('english', $1)
     ORDER BY rank DESC
     LIMIT $2`,
    tsQuery,
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

  return NextResponse.json({
    query: q,
    terms,
    results,
  });
}
