import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { countLinkedClaims, linkedClaimsWhere } from "@/lib/prereq-graph";

export const revalidate = 3600;

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const domain = sp.get("domain") ?? "all";
  const q = (sp.get("q") ?? "").trim();
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Population definition shared with the page header (lib/prereq-graph.ts):
  // domain chip from an allowlist, search term as a bind param.
  const { clause, params } = linkedClaimsWhere({ domain, q });

  const [rows, total] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{
        id: string;
        text: string;
        metadata: unknown;
        epistemicAxis: string | null;
        ingestedBy: string;
        claimEmergedAt: Date | null;
        links: bigint;
      }>
    >(
      `SELECT c.id, c.text, c.metadata, c."epistemicAxis", c."ingestedBy", c."claimEmergedAt",
              COUNT(cr.id) AS links
       ${clause}
       GROUP BY c.id
       ORDER BY links DESC, c."claimEmergedAt" DESC NULLS LAST
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      ...params
    ),
    countLinkedClaims({ domain, q }),
  ]);

  const claims = rows.map((r) => {
    const m = r.metadata as Record<string, unknown> | null;
    const title =
      (typeof m?.title === "string" && m.title.trim()) || r.text.slice(0, 140);
    return {
      id: r.id,
      title,
      ingestedBy: r.ingestedBy,
      epistemicAxis: r.epistemicAxis,
      date: r.claimEmergedAt
        ? r.claimEmergedAt.toISOString().slice(0, 10)
        : null,
      links: Number(r.links),
    };
  });

  return NextResponse.json(
    { total, claims, page, pageSize: PAGE_SIZE },
    {
      headers: {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200",
      },
    }
  );
}
