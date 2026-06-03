import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 1000;
const CONGRESS_TAG = "congress-119";
const TRACKER_INGESTER = "congress_bills_tracker_v1";

const TERMINAL_STATUS_SLUGS = ["status-enacted", "status-vetoed", "status-failed"] as const;

const VALID_STATUS_SLUGS = new Set([
  "status-introduced",
  "status-in-progress",
  "status-passed-house",
  "status-passed-senate",
  "status-enacted",
  "status-vetoed",
  "status-failed",
]);

const VALID_TYPE_SLUGS = new Set(["hr", "s", "hjres", "sjres", "hres", "sres", "hconres", "sconres"]);

type Country = "us" | "ca" | "nz";
type Outcome = "enacted" | "passed" | "vetoed" | "failed" | "active";

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
  latestActionDate: string | null;
  latestActionText: string | null;
  outcome: Outcome;
};

const COUNTRIES: Record<Country, { label: string }> = {
  us: { label: "US Congress" },
  ca: { label: "Canada" },
  nz: { label: "New Zealand" },
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

function outcomeFromStatus(slug: string | null): Outcome {
  if (slug === "status-enacted") return "enacted";
  if (slug === "status-passed-house" || slug === "status-passed-senate") return "passed";
  if (slug === "status-vetoed") return "vetoed";
  if (slug === "status-failed") return "failed";
  return "active";
}

const OUTCOME_RANK: Record<Outcome, number> = {
  enacted: 1,
  passed: 2,
  vetoed: 3,
  failed: 4,
  active: 5,
};

type ClaimRow = {
  id: string;
  text: string;
  claimEmergedAt: Date | null;
  createdAt: Date;
  metadata: Prisma.JsonValue;
  topics: { topic: { slug: string } }[];
  edges: { source: { url: string | null } }[];
};

function rowToBill(r: ClaimRow): BillHit {
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
    body: readString(r.metadata, "latestActionText") ?? readString(r.metadata, "latestAction") ?? readString(r.metadata, "body"),
    status: statusSlug,
    billType: typeSlug ?? readString(r.metadata, "billType"),
    billNumber: readString(r.metadata, "billNumber"),
    congress: readNumber(r.metadata, "congress"),
    sourceUrl,
    introducedDate: introducedIso,
    updatedAt: r.createdAt.toISOString(),
    latestActionDate: readString(r.metadata, "latestActionDate"),
    latestActionText: readString(r.metadata, "latestActionText"),
    outcome: outcomeFromStatus(statusSlug),
  } as unknown as BillHit;
}

function canadaOutcomeFromMetadata(meta: unknown): Outcome {
  const cat = readString(meta, "outcomeCategory");
  if (cat === "active") return "active";
  if (cat === "failed") return "failed";
  if (cat === "enacted") return "enacted";
  // Legacy records (no outcomeCategory) are all Royal Assent.
  return "enacted";
}

function canadaStatusLabel(meta: unknown, outcome: Outcome): string {
  const raw = readString(meta, "parliamentaryStatus");
  if (raw) return raw;
  return outcome === "enacted" ? "Royal Assent" : "In Parliament";
}

function rowToForeignBill(r: ClaimRow, country: "ca" | "nz"): BillHit {
  const sourceUrl = r.edges[0]?.source.url ?? null;

  if (country === "ca") {
    const outcome = canadaOutcomeFromMetadata(r.metadata);
    const status = canadaStatusLabel(r.metadata, outcome);
    const introducedRaw = readString(r.metadata, "introducedDate");
    const latestActivityRaw = readString(r.metadata, "latestActivityDate");
    const royalAssentRaw = readString(r.metadata, "royalAssentDate");
    const introducedIso = introducedRaw
      ? new Date(`${introducedRaw}T00:00:00Z`).toISOString()
      : r.claimEmergedAt
        ? r.claimEmergedAt.toISOString()
        : null;
    const latestActionIso =
      (royalAssentRaw && new Date(`${royalAssentRaw}T00:00:00Z`).toISOString()) ||
      (latestActivityRaw && new Date(`${latestActivityRaw}T00:00:00Z`).toISOString()) ||
      (r.claimEmergedAt ? r.claimEmergedAt.toISOString() : null);
    return {
      id: r.id,
      title: r.text,
      body: null,
      status,
      billType: readString(r.metadata, "billType"),
      billNumber: readString(r.metadata, "billNumber"),
      congress: readNumber(r.metadata, "parliament"),
      sourceUrl,
      introducedDate: introducedIso,
      updatedAt: r.createdAt.toISOString(),
      latestActionDate: latestActionIso,
      latestActionText: null,
      outcome,
    };
  }

  // NZ — prefer claimEmergedAt as the primary date; fall back to year-01-01.
  const dataset = readString(r.metadata, "dataset") ?? "";
  const isBill = dataset === "nz_bills_v1";
  const year = readString(r.metadata, "year");
  const yearFallback = year ? `${year}-01-01T00:00:00.000Z` : null;
  const primaryIso = r.claimEmergedAt ? r.claimEmergedAt.toISOString() : yearFallback;

  return {
    id: r.id,
    title: r.text,
    body: null,
    status: isBill ? "Bill" : "Act In Force",
    billType: readString(r.metadata, "actType"),
    billNumber: readString(r.metadata, "actNumber"),
    congress: year ? parseInt(year, 10) : null,
    sourceUrl,
    introducedDate: primaryIso,
    updatedAt: r.createdAt.toISOString(),
    latestActionDate: primaryIso,
    latestActionText: null,
    outcome: isBill ? "active" : "enacted",
  };
}

const ROW_SELECT = {
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
} satisfies Prisma.ClaimSelect;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Country routing
  const countryRaw = (url.searchParams.get("country") ?? "us").toLowerCase();
  const country: Country = (["us", "ca", "nz"] as Country[]).includes(countryRaw as Country)
    ? (countryRaw as Country)
    : "us";

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

  const searchClause: Prisma.ClaimWhereInput | null = q
    ? { text: { contains: q, mode: "insensitive" } }
    : null;

  // Foreign-country fast path
  if (country !== "us") {
    const statusParam = (url.searchParams.get("status") ?? "").trim().toLowerCase();
    return foreignCountryView({ country, searchClause, page, limit, offset, statusParam });
  }

  // US path — existing logic
  const view = (url.searchParams.get("view") ?? "status").trim();
  const statusRaw = (url.searchParams.get("status") ?? "").trim();
  const typeRaw = (url.searchParams.get("type") ?? "").trim().toLowerCase();

  const type = typeRaw && VALID_TYPE_SLUGS.has(typeRaw) ? typeRaw : null;

  const congressClause: Prisma.ClaimWhereInput = {
    topics: { some: { topic: { slug: CONGRESS_TAG } } },
  };
  const typeClause: Prisma.ClaimWhereInput | null = type
    ? { topics: { some: { topic: { slug: type } } } }
    : null;

  const lastRefresh = await getLastRefresh();

  if (view === "full") {
    return fullView({ typeClause, searchClause, page, limit, lastRefresh });
  }

  const status = statusRaw && VALID_STATUS_SLUGS.has(statusRaw) ? statusRaw : null;
  const isTerminal = statusRaw === "terminal";

  let statusClause: Prisma.ClaimWhereInput | null = null;
  if (status) {
    statusClause = { topics: { some: { topic: { slug: status } } } };
  } else if (isTerminal) {
    statusClause = {
      OR: TERMINAL_STATUS_SLUGS.map(slug => ({
        topics: { some: { topic: { slug } } },
      })),
    };
  }

  const where: Prisma.ClaimWhereInput = {
    deleted: false,
    AND: [
      congressClause,
      ...(statusClause ? [statusClause] : []),
      ...(typeClause ? [typeClause] : []),
      ...(searchClause ? [searchClause] : []),
    ],
  };

  const [total, rows] = await Promise.all([
    prisma.claim.count({ where }),
    prisma.claim.findMany({
      where,
      orderBy: isTerminal
        ? [{ claimEmergedAt: "desc" }, { id: "desc" }]
        : [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
      select: ROW_SELECT,
    }),
  ]);

  const bills: BillHit[] = rows.map(rowToBill);
  return NextResponse.json({ bills, total, page, limit, lastRefresh, countries: COUNTRIES });
}

async function foreignCountryView({
  country,
  searchClause,
  page,
  limit,
  offset,
  statusParam,
}: {
  country: "ca" | "nz";
  searchClause: Prisma.ClaimWhereInput | null;
  page: number;
  limit: number;
  offset: number;
  statusParam: string;
}) {
  const baseClauses: Prisma.ClaimWhereInput[] = [];

  if (country === "ca") {
    baseClauses.push({ ingestedBy: "canada_bills_v1" });
    // Canada: status filter on metadata.outcomeCategory.
    // "in-parliament" = active; "royal-assent" = enacted (treat legacy null as enacted).
    if (statusParam === "in-parliament") {
      baseClauses.push({ metadata: { path: ["outcomeCategory"], equals: "active" } });
    } else if (statusParam === "royal-assent") {
      baseClauses.push({
        NOT: { metadata: { path: ["outcomeCategory"], equals: "active" } },
      });
    }
  } else {
    // NZ: status filter switches the ingestedBy tag.
    if (statusParam === "bills") {
      baseClauses.push({ ingestedBy: "nz_bills_v1" });
    } else if (statusParam === "acts") {
      baseClauses.push({ ingestedBy: "nz_legislation_v1" });
    } else {
      baseClauses.push({ ingestedBy: { in: ["nz_legislation_v1", "nz_bills_v1"] } });
    }
  }

  if (searchClause) baseClauses.push(searchClause);

  const where: Prisma.ClaimWhereInput = {
    deleted: false,
    AND: baseClauses,
  };

  const [total, rows, lastRefresh, outcomeCounts] = await Promise.all([
    prisma.claim.count({ where }),
    prisma.claim.findMany({
      where,
      orderBy: [{ claimEmergedAt: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
      select: ROW_SELECT,
    }),
    country === "ca" ? getCanadaLastRefresh() : Promise.resolve<string | null>(null),
    country === "ca" ? getCanadaOutcomeCounts() : Promise.resolve<Record<Outcome, number> | null>(null),
  ]);

  const bills = rows.map(r => rowToForeignBill(r, country));
  return NextResponse.json({
    bills,
    total,
    page,
    limit,
    lastRefresh,
    ...(outcomeCounts ? { outcomeCounts } : {}),
    countries: COUNTRIES,
  });
}

async function getCanadaLastRefresh(): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ last_tracked: string | null }[]>`
    SELECT MAX(metadata->>'lastTrackedAt') AS last_tracked
    FROM "Claim"
    WHERE "ingestedBy" = 'canada_bills_v1'
      AND deleted = false
  `;
  return rows[0]?.last_tracked ?? null;
}

async function getCanadaOutcomeCounts(): Promise<Record<Outcome, number>> {
  const rows = await prisma.$queryRaw<{ category: string | null; n: bigint }[]>`
    SELECT metadata->>'outcomeCategory' AS category, COUNT(*)::bigint AS n
    FROM "Claim"
    WHERE "ingestedBy" = 'canada_bills_v1'
      AND deleted = false
    GROUP BY metadata->>'outcomeCategory'
  `;
  const counts: Record<Outcome, number> = { enacted: 0, passed: 0, vetoed: 0, failed: 0, active: 0 };
  for (const r of rows) {
    const n = Number(r.n);
    if (r.category === "active") counts.active += n;
    else if (r.category === "failed") counts.failed += n;
    else counts.enacted += n; // 'enacted' OR legacy null = enacted
  }
  return counts;
}

async function fullView({
  typeClause,
  searchClause,
  page,
  limit,
  lastRefresh,
}: {
  typeClause: Prisma.ClaimWhereInput | null;
  searchClause: Prisma.ClaimWhereInput | null;
  page: number;
  limit: number;
  lastRefresh: string | null;
}) {
  const where: Prisma.ClaimWhereInput = {
    deleted: false,
    AND: [
      { topics: { some: { topic: { slug: CONGRESS_TAG } } } },
      ...(typeClause ? [typeClause] : []),
      ...(searchClause ? [searchClause] : []),
    ],
  };

  const rows = await prisma.claim.findMany({
    where,
    select: ROW_SELECT,
  });

  const all: BillHit[] = rows.map(rowToBill);
  all.sort((a, b) => {
    const rA = OUTCOME_RANK[a.outcome];
    const rB = OUTCOME_RANK[b.outcome];
    if (rA !== rB) return rA - rB;
    const dA = a.latestActionDate ?? "";
    const dB = b.latestActionDate ?? "";
    return dB.localeCompare(dA);
  });

  const total = all.length;
  const start = (page - 1) * limit;
  const bills = all.slice(start, start + limit);

  const outcomeCounts: Record<Outcome, number> = {
    enacted: 0,
    passed: 0,
    vetoed: 0,
    failed: 0,
    active: 0,
  };
  for (const b of all) outcomeCounts[b.outcome]++;

  return NextResponse.json({ bills, total, page, limit, lastRefresh, outcomeCounts, countries: COUNTRIES });
}

async function getLastRefresh(): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ last_tracked: string | null }[]>`
    SELECT MAX(metadata->>'lastTrackedAt') AS last_tracked
    FROM "Claim"
    WHERE "ingestedBy" = ${TRACKER_INGESTER}
      AND deleted = false
  `;
  return rows[0]?.last_tracked ?? null;
}
