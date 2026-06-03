import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const CONGRESS_TAG = "congress-119";

const VALID_STATUS_SLUGS = new Set([
  "status-introduced",
  "status-in-progress",
  "status-passed-house",
  "status-passed-senate",
  "status-enacted",
  "status-vetoed",
]);

const VALID_TYPE_SLUGS = new Set(["hr", "s", "hjres", "sjres", "hres", "sres", "hconres", "sconres"]);

type BillHit = {
  id: string;
  title: string;
  body: string | null;
  status: string | null;
  billType: string | null;
  billNumber: string | null;
  congress: number | null;
  sourceUrl: string | null;
  introducedDate: string | null;
  updatedAt: string;
};

function pickStatusSlug(slugs: string[]): string | null {
  for (const s of slugs) {
    if (VALID_STATUS_SLUGS.has(s)) return s;
  }
  return null;
}

function pickTypeSlug(slugs: string[]): string | null {
  for (const s of slugs) {
    if (VALID_TYPE_SLUGS.has(s)) return s;
  }
  return null;
}

function readString(meta: unknown, key: string): string | null {
  if (!meta || typeof meta !== "object") return null;
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

function readNumber(meta: unknown, key: string): number | null {
  if (!meta || typeof meta !== "object") return null;
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === "number" ? v : null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const statusRaw = (url.searchParams.get("status") ?? "").trim();
  const typeRaw = (url.searchParams.get("type") ?? "").trim().toLowerCase();
  const q = (url.searchParams.get("q") ?? "").trim();

  const limit = Math.max(
    1,
    Math.min(
      MAX_LIMIT,
      Number.parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT,
    ),
  );
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * limit;

  const status = statusRaw && VALID_STATUS_SLUGS.has(statusRaw) ? statusRaw : null;
  const type = typeRaw && VALID_TYPE_SLUGS.has(typeRaw) ? typeRaw : null;

  const slugClauses: Prisma.ClaimWhereInput[] = [
    { topics: { some: { topic: { slug: CONGRESS_TAG } } } },
  ];
  if (status) slugClauses.push({ topics: { some: { topic: { slug: status } } } });
  if (type) slugClauses.push({ topics: { some: { topic: { slug: type } } } });

  const where: Prisma.ClaimWhereInput = {
    deleted: false,
    AND: slugClauses,
    ...(q ? { text: { contains: q, mode: "insensitive" } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.claim.count({ where }),
    prisma.claim.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
      select: {
        id: true,
        text: true,
        claimEmergedAt: true,
        createdAt: true,
        metadata: true,
        topics: { select: { topic: { select: { slug: true } } } },
        edges: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { source: { select: { url: true } } },
        },
      },
    }),
  ]);

  const bills: BillHit[] = rows.map(r => {
    const slugs = r.topics.map(t => t.topic.slug);
    const statusSlug = pickStatusSlug(slugs);
    const typeSlug = pickTypeSlug(slugs);
    const sourceUrl =
      readString(r.metadata, "sourceUrl") ?? r.edges[0]?.source.url ?? null;
    const introducedIso =
      readString(r.metadata, "introducedDate") ??
      (r.claimEmergedAt ? r.claimEmergedAt.toISOString() : null);
    return {
      id: r.id,
      title: readString(r.metadata, "title") ?? r.text,
      body: readString(r.metadata, "latestAction") ?? readString(r.metadata, "body"),
      status: statusSlug,
      billType: typeSlug ?? readString(r.metadata, "billType"),
      billNumber: readString(r.metadata, "billNumber"),
      congress: readNumber(r.metadata, "congress"),
      sourceUrl,
      introducedDate: introducedIso,
      updatedAt: r.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ bills, total, page, limit });
}
