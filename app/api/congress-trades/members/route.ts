import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chamber = sp.get("chamber") ?? "all";
  const party = sp.get("party") ?? "all";

  const condParams: unknown[] = [];
  const conditions: string[] = [
    `c."ingestedBy" = 'congress_stock_act_v1'`,
    `c.deleted = false`,
  ];

  if (chamber !== "all") {
    condParams.push(chamber.charAt(0).toUpperCase() + chamber.slice(1).toLowerCase());
    conditions.push(`c.metadata->>'chamber' = $${condParams.length}`);
  }
  if (party !== "all") {
    condParams.push(party.toUpperCase());
    conditions.push(`c.metadata->>'party' = $${condParams.length}`);
  }

  const where = conditions.join(" AND ");

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      member_name: string;
      party: string;
      chamber: string;
      bioguide_id: string | null;
      trade_count: number;
      tickers: string[];
      total_amount_min: string | null;
    }>
  >(
    `SELECT
       c.metadata->>'member_name' as member_name,
       c.metadata->>'party' as party,
       c.metadata->>'chamber' as chamber,
       c.metadata->>'bioguide_id' as bioguide_id,
       COUNT(*)::int as trade_count,
       array_agg(DISTINCT c.metadata->>'ticker' ORDER BY c.metadata->>'ticker') as tickers,
       SUM((c.metadata->>'amount_min')::numeric) as total_amount_min
     FROM "Claim" c
     WHERE ${where}
     GROUP BY
       c.metadata->>'member_name',
       c.metadata->>'party',
       c.metadata->>'chamber',
       c.metadata->>'bioguide_id'
     ORDER BY COUNT(*) DESC`,
    ...condParams
  );

  const members = rows.map((r) => ({
    memberName: r.member_name ?? "",
    party: r.party ?? "",
    chamber: r.chamber ?? "",
    bioguideId: r.bioguide_id ?? null,
    tradeCount: Number(r.trade_count ?? 0),
    tickers: (r.tickers ?? []).filter(Boolean).slice(0, 5),
    totalAmountMin: r.total_amount_min ? Number(r.total_amount_min) : null,
  }));

  return NextResponse.json({ members });
}
