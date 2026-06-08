import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_REGISTRY } from "@/lib/legislation-countries";

export const revalidate = 3600;

const PAGE_SIZE = 50;

const FOREIGN_COUNTRIES = COUNTRY_REGISTRY.filter((c) => c.code !== "us");

const INGESTED_BY_TO_COUNTRY = Object.fromEntries(
  FOREIGN_COUNTRIES.map((c) => [c.ingestedBy, c])
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region = sp.get("region") ?? "all";
  const country = sp.get("country") ?? "all";
  const q = (sp.get("q") ?? "").trim();
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let countries = FOREIGN_COUNTRIES;
  if (country !== "all") {
    countries = FOREIGN_COUNTRIES.filter((c) => c.code === country);
  } else if (region !== "all") {
    countries = FOREIGN_COUNTRIES.filter((c) => c.region === region);
  }

  if (countries.length === 0) {
    return NextResponse.json({
      total: 0,
      claims: [],
      page,
      pageSize: PAGE_SIZE,
    });
  }

  const ingestedByList = countries.map((c) => `'${c.ingestedBy}'`).join(",");

  const conditions = [
    `c."ingestedBy" IN (${ingestedByList})`,
    "c.deleted = false",
    `(c."verificationStatus" IS NULL OR c."verificationStatus" != 'DEPRECATED')`,
  ];

  if (q) {
    const safe = q.replace(/'/g, "''").replace(/%/g, "\\%");
    conditions.push(`c.text ILIKE '%${safe}%'`);
  }

  const where = conditions.join(" AND ");

  const [rows, countRows] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{
        id: string;
        text: string;
        metadata: unknown;
        epistemicAxis: string | null;
        ingestedBy: string;
        claimEmergedAt: Date | null;
      }>
    >(
      `SELECT c.id, c.text, c.metadata, c."epistemicAxis", c."ingestedBy", c."claimEmergedAt"
       FROM "Claim" c
       WHERE ${where}
       ORDER BY c."claimEmergedAt" DESC NULLS LAST, c."createdAt" DESC
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`
    ),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) AS count FROM "Claim" c WHERE ${where}`
    ),
  ]);

  const total = Number(countRows[0]?.count ?? 0);

  const claims = rows.map((r) => {
    const m = r.metadata as Record<string, unknown> | null;
    const countryEntry = INGESTED_BY_TO_COUNTRY[r.ingestedBy];
    const sourceUrl =
      typeof m?.source_url === "string"
        ? m.source_url
        : typeof m?.url === "string"
          ? m.url
          : null;
    return {
      id: r.id,
      title: r.text,
      ingestedBy: r.ingestedBy,
      epistemicAxis: r.epistemicAxis,
      date: (() => {
        if (!r.claimEmergedAt) return null;
        const year = r.claimEmergedAt.toISOString().slice(0, 4);
        return year === "2999" ? null : year;
      })(),
      country: countryEntry?.label ?? "Unknown",
      countryCode: countryEntry?.code ?? "",
      flag: countryEntry?.flag ?? "",
      region: countryEntry?.region ?? "",
      sourceLabel: countryEntry?.sourceLabel ?? "",
      sourceUrl,
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
