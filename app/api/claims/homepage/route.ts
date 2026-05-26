import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 10;
const SEARCH_LIMIT = 50;

const VALID_TYPES    = ["EMPIRICAL", "INSTITUTIONAL", "INTERPRETIVE", "HYBRID"] as const;
const VALID_STATUSES = ["DISPUTED", "HARD_FACT", "NEVER_RESOLVES"] as const;
const VALID_SORTS    = ["recent", "oldest_emerged", "newest_emerged", "most_sources", "most_edges"] as const;

type ClaimType   = typeof VALID_TYPES[number];
type SortOption  = typeof VALID_SORTS[number];

function parseList<T extends string>(raw: string | null, valid: readonly T[]): T[] {
  if (!raw) return [...valid];
  const parts = raw.split(",").filter(Boolean) as T[];
  const filtered = parts.filter(p => (valid as readonly string[]).includes(p));
  return filtered.length ? filtered : [...valid];
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const q              = (sp.get("q") ?? "").trim().toLowerCase();
  const types          = parseList(sp.get("types"), VALID_TYPES);
  const statuses       = parseList(sp.get("statuses"), VALID_STATUSES);
  const verification   = sp.get("verification") ?? "all";
  const showDeprecated = sp.get("deprecated") === "1";
  const source         = sp.get("source") ?? "all";
  const sort           = (VALID_SORTS as readonly string[]).includes(sp.get("sort") ?? "")
    ? sp.get("sort") as SortOption
    : "recent";
  const topics = (sp.get("topics") ?? "").split(",").filter(Boolean);

  const typePages: Partial<Record<ClaimType, number>> = {};
  for (const t of VALID_TYPES) {
    const raw = sp.get(`${t.toLowerCase()}_page`);
    typePages[t] = raw ? Math.max(1, parseInt(raw, 10)) : 1;
  }

  // ── Base where clause ──────────────────────────────────────────────────────

  const andClauses: object[] = [];

  if (!showDeprecated && verification !== "deprecated") {
    andClauses.push({ NOT: { verificationStatus: "DEPRECATED" } });
  }
  if (verification === "verified")    andClauses.push({ verificationStatus: "VERIFIED" });
  if (verification === "provisional") andClauses.push({ verificationStatus: "PROVISIONAL" });
  if (verification === "deprecated")  andClauses.push({ verificationStatus: "DEPRECATED" });

  if (q) {
    andClauses.push({
      OR: [
        { text:            { contains: q, mode: "insensitive" } },
        { children:        { some: { text: { contains: q, mode: "insensitive" } } } },
        { edges:           { some: { source: { OR: [
          { name: { contains: q, mode: "insensitive" } },
          { url:  { contains: q, mode: "insensitive" } },
        ] } } } },
        { thresholdEvents: { some: { note: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  const baseWhere = {
    deleted: false,
    parentClaimId: null as null,
    ...(statuses.length < VALID_STATUSES.length ? { currentStatus: { in: statuses } } : {}),
    ...(source !== "all" ? { ingestedBy: source } : {}),
    ...(topics.length > 0 ? { topics: { some: { topic: { slug: { in: topics } } } } } : {}),
    AND: andClauses,
  };

  // ── Order by ───────────────────────────────────────────────────────────────

  type OB = NonNullable<Parameters<typeof prisma.claim.findMany>[0]>["orderBy"];
  const orderBy: OB = (() => {
    switch (sort) {
      case "oldest_emerged": return [{ claimEmergedAt: "asc"  as const }, { createdAt: "desc" as const }];
      case "newest_emerged": return [{ claimEmergedAt: "desc" as const }, { createdAt: "desc" as const }];
      case "most_sources":
      case "most_edges":     return [{ edges: { _count: "desc" as const } }, { createdAt: "desc" as const }];
      default:               return { createdAt: "desc" as const };
    }
  })();

  // ── Per-type sections ──────────────────────────────────────────────────────

  const isSearchActive = q.length > 0;
  const limit = isSearchActive ? SEARCH_LIMIT : PAGE_SIZE;

  const include = {
    _count: { select: { edges: { where: { deleted: false } } } },
    children: {
      where: { deleted: false },
      orderBy: { createdAt: "asc" as const },
      take: 10,
      include: { _count: { select: { edges: { where: { deleted: false } } } } },
    },
    edges: {
      where: { deleted: false },
      take: 8,
      select: { source: { select: { name: true, url: true } } },
    },
    thresholdEvents: {
      where: { deleted: false },
      take: 5,
      select: { note: true },
    },
    topics: {
      select: { topic: { select: { id: true, name: true, slug: true, domain: true } } },
    },
  } as const;

  // Skip count queries on page 1 (expensive full-table scans on 800K+ rows).
  // Return total: -1 as sentinel; client shows "Load more" instead of page numbers.
  const sections = await Promise.all(
    types.map(async (type) => {
      const where = { ...baseWhere, claimType: type };
      const page  = isSearchActive ? 1 : (typePages[type] ?? 1);
      const needsCount = isSearchActive || page > 1;
      const [total, claims] = await Promise.all([
        needsCount ? prisma.claim.count({ where }) : Promise.resolve(-1),
        prisma.claim.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, include }),
      ]);
      const pages = needsCount ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : -1;
      return { type, total, claims, page, pages };
    })
  );

  // ── Filter option metadata ─────────────────────────────────────────────────

  const [sourceRows, topicRows] = await Promise.all([
    prisma.claim.groupBy({
      by: ["ingestedBy"],
      where: { deleted: false },
      orderBy: { ingestedBy: "asc" },
    }),
    prisma.topic.findMany({
      select: { slug: true, name: true, domain: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const result: Record<string, object> = {};
  for (const s of sections) result[s.type] = { total: s.total, claims: s.claims, page: s.page, pages: s.pages };

  const response = NextResponse.json({
    sections: result,
    meta: {
      ingestedBySources: sourceRows.map(r => r.ingestedBy),
      topics: topicRows,
    },
  });

  // Cache unfiltered homepage for 5min at CDN edge; serve stale up to 1hr while revalidating
  const isFiltered = q || sp.get("types") || sp.get("statuses") || sp.get("verification") ||
    sp.get("source") || sp.get("topics") || sp.get("deprecated");
  if (!isFiltered) {
    response.headers.set("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  }

  return response;
}
