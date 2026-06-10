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

  // Bound parameters for all user-derived values
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
  if (q) {
    condParams.push(`%${q}%`);
    const idx = condParams.length;
    conditions.push(
      `(c.metadata->>'member_name' ILIKE $${idx} OR c.metadata->>'ticker' ILIKE $${idx} OR c.metadata->>'asset_name' ILIKE $${idx})`
    );
  }
  if (correlation === "with-votes") {
    // Subquery uses no user input — static SQL is safe here.
    conditions.push(
      `(
        c.metadata->>'bioguide_id' IN (SELECT DISTINCT "memberId" FROM "MemberVote" WHERE "memberId" IS NOT NULL)
        OR LOWER(c.metadata->>'member_name') IN (SELECT DISTINCT LOWER("memberName") FROM "MemberVote")
      )`
    );
  }

  const where = conditions.join(" AND ");
  const dataParams = [...condParams, offset];
  const offsetIdx = dataParams.length;

  const [rows, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{ id: string; text: string; metadata: unknown; claimEmergedAt: Date | null }>
    >(
      `SELECT c.id, c.text, c.metadata, c."claimEmergedAt"
       FROM "Claim" c
       WHERE ${where}
       ORDER BY c."claimEmergedAt" DESC NULLS LAST, c."createdAt" DESC
       LIMIT ${PAGE_SIZE} OFFSET $${offsetIdx}`,
      ...dataParams
    ),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "Claim" c WHERE ${where}`,
      ...condParams
    ),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  const fmtMoney = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  };

  const trades = rows.map((r) => {
    const m = r.metadata as Record<string, unknown>;
    const ticker = (m?.ticker as string) ?? "";
    const assetName =
      (m?.asset_name as string) ??
      (m?.company_name as string) ??
      ticker ??
      "";

    const rawRange = (m?.amount_range as string) ?? "";
    const amtMin = typeof m?.amount_min === "number" ? m.amount_min : null;
    const amtMax = typeof m?.amount_max === "number" ? m.amount_max : null;
    let amountRange = rawRange;
    if (!amountRange) {
      if (amtMin && amtMax) amountRange = `${fmtMoney(amtMin)}–${fmtMoney(amtMax)}`;
      else if (amtMin) amountRange = `> ${fmtMoney(amtMin)}`;
      else if (amtMax) amountRange = `< ${fmtMoney(amtMax)}`;
    }

    return {
      id: r.id,
      memberName: (m?.member_name as string) ?? "",
      bioguideId: (m?.bioguide_id as string) ?? null,
      party: (m?.party as string) ?? "",
      chamber: (m?.chamber as string) ?? "",
      ticker,
      assetName,
      transactionType: (m?.transaction_type as string) ?? "",
      amountRange,
      tradeDate: (m?.trade_date as string) ?? "",
      disclosureDate: (m?.disclosure_date as string) ?? "",
      tickerType: (m?.ticker_type as string) ?? null,
      excessReturn: typeof m?.excess_return === "number" ? m.excess_return : null,
    };
  });

  return NextResponse.json({ total, trades, page, pageSize: PAGE_SIZE });
}
