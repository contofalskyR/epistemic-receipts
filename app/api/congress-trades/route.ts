import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chamber = sp.get("chamber") ?? "all";
  const party = sp.get("party") ?? "all";
  const correlation = sp.get("correlation") ?? "all";
  const q = (sp.get("q") ?? "").trim();
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const conditions: string[] = [
    `c."ingestedBy" = 'congress_stock_act_v1'`,
    `c.deleted = false`,
  ];

  if (chamber !== "all") {
    const ch = chamber.charAt(0).toUpperCase() + chamber.slice(1).toLowerCase();
    conditions.push(`c.metadata->>'chamber' = '${ch}'`);
  }
  if (party !== "all") {
    conditions.push(`c.metadata->>'party' = '${party.toUpperCase().replace(/'/g, "''")}'`);
  }
  if (q) {
    const safe = q.replace(/'/g, "''").replace(/%/g, "\\%");
    conditions.push(
      `(c.metadata->>'member_name' ILIKE '%${safe}%' OR c.metadata->>'ticker' ILIKE '%${safe}%' OR c.metadata->>'asset_name' ILIKE '%${safe}%')`
    );
  }
  if (correlation === "with-votes") {
    // Restrict to trades whose member has any recorded roll-call vote (bioguide ID or
    // exact name match against MemberVote). MemberVote.memberId carries mixed bioguide
    // and numeric (Voteview) IDs; the bioguide IDs are the relevant overlap with STOCK
    // Act disclosures.
    conditions.push(
      `(
        c.metadata->>'bioguide_id' IN (SELECT DISTINCT "memberId" FROM "MemberVote" WHERE "memberId" IS NOT NULL)
        OR LOWER(c.metadata->>'member_name') IN (SELECT DISTINCT LOWER("memberName") FROM "MemberVote")
      )`
    );
  }

  const where = conditions.join(" AND ");

  const [rows, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{ id: string; text: string; metadata: unknown; claimEmergedAt: Date | null }>
    >(
      `SELECT c.id, c.text, c.metadata, c."claimEmergedAt"
       FROM "Claim" c
       WHERE ${where}
       ORDER BY c."claimEmergedAt" DESC NULLS LAST, c."createdAt" DESC
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`
    ),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "Claim" c WHERE ${where}`
    ),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  const trades = rows.map((r) => {
    const m = r.metadata as Record<string, unknown>;
    return {
      id: r.id,
      memberName: (m?.member_name as string) ?? "",
      bioguideId: (m?.bioguide_id as string) ?? null,
      party: (m?.party as string) ?? "",
      chamber: (m?.chamber as string) ?? "",
      ticker: (m?.ticker as string) ?? "",
      assetName: (m?.asset_name as string) ?? "",
      transactionType: (m?.transaction_type as string) ?? "",
      amountRange: (m?.amount_range as string) ?? "",
      tradeDate: (m?.trade_date as string) ?? "",
      disclosureDate: (m?.disclosure_date as string) ?? "",
      tickerType: (m?.ticker_type as string) ?? null,
      excessReturn: typeof m?.excess_return === "number" ? m.excess_return : null,
    };
  });

  return NextResponse.json({ total, trades, page, pageSize: PAGE_SIZE });
}
