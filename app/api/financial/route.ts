import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type Tab = "insider" | "earnings" | "congress" | "macro";

interface InsiderHit {
  id: string;
  filerName: string;
  issuerName: string;
  transactionType: "purchase" | "sale" | "grant" | "other";
  shares: number;
  pricePerShare: number | null;
  transactionDate: string;
  filedDate: string;
  sourceUrl: string;
}

interface EarningsHit {
  id: string;
  companyName: string;
  formType: string;
  filingDate: string;
  accessionNumber: string;
  sourceUrl: string;
  claimText: string;
}

interface CongressHit {
  id: string;
  memberName: string;
  party: "D" | "R" | "I";
  chamber: "House" | "Senate";
  state: string;
  ticker: string;
  companyName: string;
  transactionType: "purchase" | "sale";
  amountMin: number;
  amountMax: number;
  tradeDate: string;
  disclosureDate: string;
  sourceUrl: string;
}

interface MacroHit {
  id: string;
  seriesId: string;
  seriesName: string;
  value: number;
  date: string;
  units: string;
}

interface FinancialResponse {
  tab: Tab;
  items: InsiderHit[] | EarningsHit[] | CongressHit[] | MacroHit[];
  total: number;
  page: number;
  limit: number;
}

function readString(meta: unknown, key: string): string | null {
  if (!meta || typeof meta !== "object") return null;
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

function readNumber(meta: unknown, key: string): number | null {
  if (!meta || typeof meta !== "object") return null;
  const v = (meta as Record<string, unknown>)[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const tab = (searchParams.get("tab") ?? "insider") as Tab;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));
  const filter = searchParams.get("filter") ?? "all";
  const q = searchParams.get("q") ?? "";

  const skip = (page - 1) * limit;

  try {
    if (tab === "insider") {
      const where: Record<string, unknown> = {
        deleted: false,
        ingestedBy: "sec_form4_v1",
      };

      if (filter === "purchase" || filter === "sale") {
        where.metadata = { path: ["transaction_type"], equals: filter };
      }

      if (q) {
        where.OR = [
          { metadata: { path: ["filer_name"], string_contains: q } },
          { metadata: { path: ["issuer_name"], string_contains: q } },
        ];
      }

      const [claims, total] = await Promise.all([
        prisma.claim.findMany({
          where,
          orderBy: { claimEmergedAt: "desc" },
          skip,
          take: limit,
          include: {
            edges: {
              where: { deleted: false },
              include: { source: true },
              take: 1,
            },
          },
        }),
        prisma.claim.count({ where }),
      ]);

      const items: InsiderHit[] = claims.map((c) => ({
        id: c.id,
        filerName: readString(c.metadata, "filer_name") ?? "Unknown",
        issuerName: readString(c.metadata, "issuer_name") ?? "Unknown",
        transactionType: (readString(c.metadata, "transaction_type") ?? "other") as InsiderHit["transactionType"],
        shares: readNumber(c.metadata, "shares") ?? 0,
        pricePerShare: readNumber(c.metadata, "price_per_share"),
        transactionDate: readString(c.metadata, "transaction_date") ?? "",
        filedDate: readString(c.metadata, "filed_date") ?? "",
        sourceUrl: c.edges[0]?.source?.url ?? "",
      }));

      return NextResponse.json({ tab, items, total, page, limit } satisfies FinancialResponse);
    }

    if (tab === "earnings") {
      const where: Record<string, unknown> = {
        deleted: false,
        ingestedBy: "sec_edgar_v1",
      };

      if (q) {
        where.OR = [
          { metadata: { path: ["company_name"], string_contains: q } },
          { text: { contains: q, mode: "insensitive" } },
        ];
      }

      const [claims, total] = await Promise.all([
        prisma.claim.findMany({
          where,
          orderBy: { claimEmergedAt: "desc" },
          skip,
          take: limit,
          include: {
            edges: {
              where: { deleted: false },
              include: { source: true },
              take: 1,
            },
          },
        }),
        prisma.claim.count({ where }),
      ]);

      const items: EarningsHit[] = claims.map((c) => ({
        id: c.id,
        companyName: readString(c.metadata, "company_name") ?? "Unknown",
        formType: readString(c.metadata, "form_type") ?? "10-K",
        filingDate: readString(c.metadata, "filing_date") ?? "",
        accessionNumber: readString(c.metadata, "accession_number") ?? "",
        sourceUrl: c.edges[0]?.source?.url ?? "",
        claimText: c.text,
      }));

      return NextResponse.json({ tab, items, total, page, limit } satisfies FinancialResponse);
    }

    if (tab === "congress") {
      const where: Record<string, unknown> = {
        deleted: false,
        ingestedBy: "congress_stock_act_v1",
      };

      if (filter === "purchase" || filter === "sale") {
        where.metadata = { path: ["transaction_type"], equals: filter };
      }

      if (q) {
        where.OR = [
          { metadata: { path: ["member_name"], string_contains: q } },
          { metadata: { path: ["ticker"], string_contains: q } },
        ];
      }

      const [claims, total] = await Promise.all([
        prisma.claim.findMany({
          where,
          orderBy: { claimEmergedAt: "desc" },
          skip,
          take: limit,
          include: {
            edges: {
              where: { deleted: false },
              include: { source: true },
              take: 1,
            },
          },
        }),
        prisma.claim.count({ where }),
      ]);

      const items: CongressHit[] = claims.map((c) => {
        const ticker = readString(c.metadata, "ticker") ?? "";
        const companyName =
          readString(c.metadata, "company_name") ??
          readString(c.metadata, "asset_name") ??
          (ticker || "Unknown");
        return {
          id: c.id,
          memberName: readString(c.metadata, "member_name") ?? "Unknown",
          party: (readString(c.metadata, "party") ?? "I") as CongressHit["party"],
          chamber: (readString(c.metadata, "chamber") ?? "House") as CongressHit["chamber"],
          state: readString(c.metadata, "state") ?? "",
          ticker,
          companyName,
          transactionType: (readString(c.metadata, "transaction_type") ?? "purchase") as CongressHit["transactionType"],
          amountMin: readNumber(c.metadata, "amount_min") ?? 0,
          amountMax: readNumber(c.metadata, "amount_max") ?? 0,
          tradeDate: readString(c.metadata, "trade_date") ?? "",
          disclosureDate: readString(c.metadata, "disclosure_date") ?? "",
          sourceUrl: c.edges[0]?.source?.url ?? "",
        };
      });

      return NextResponse.json({ tab, items, total, page, limit } satisfies FinancialResponse);
    }

    if (tab === "macro") {
      const where: Record<string, unknown> = {
        deleted: false,
        ingestedBy: "fred_v1",
      };

      if (q) {
        where.OR = [
          { metadata: { path: ["seriesId"], string_contains: q.toUpperCase() } },
          { text: { contains: q, mode: "insensitive" } },
        ];
      }

      const [claims, total] = await Promise.all([
        prisma.claim.findMany({
          where,
          orderBy: { claimEmergedAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.claim.count({ where }),
      ]);

      const items: MacroHit[] = claims.map((c) => ({
        id: c.id,
        seriesId: readString(c.metadata, "seriesId") ?? readString(c.metadata, "series_id") ?? "",
        seriesName: readString(c.metadata, "seriesTitle") ?? readString(c.metadata, "series_name") ?? "",
        value: readNumber(c.metadata, "value") ?? 0,
        date:
          readString(c.metadata, "date") ??
          readString(c.metadata, "observation_date") ??
          c.claimEmergedAt?.toISOString().slice(0, 10) ??
          "",
        units: readString(c.metadata, "units") ?? "",
      }));

      return NextResponse.json({ tab, items, total, page, limit } satisfies FinancialResponse);
    }

    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  } catch (e) {
    console.error("Financial API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
