import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  JOURNAL_KEYWORDS,
  isRetractionField,
  isRetractionReason,
  type RetractionField,
  type RetractionReason,
} from "@/lib/retraction-filters";

// Reading searchParams makes this handler dynamic, so a route-level
// `revalidate` never applied. Instead (STATUS.md Phase 5) the payload is
// cached for an hour, and every key part is bounded first (phase 6): field and
// reason are whitelisted (lib/retraction-filters.ts, shared with the
// explorer), sortBy is "impact" or "date", and page is clamped to the real page
// count from a cached count. Free-text queries (`q`, capped at 200 chars)
// bypass the data cache and get a short CDN TTL. Bump the keyParts when a
// cached return shape changes.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const Q_MAX = 200;

type Sort = "impact" | "date";
type Field = "all" | RetractionField;

/** WHERE clause and its bind parameters, built per call. User input is passed
 *  as bind parameters ($1, ...), never interpolated into the SQL string, and
 *  LIKE wildcards are escaped so they match literally. The count and the rows
 *  query each build their own pair, so the $n numbering always lines up. */
function retractionWhere(field: Field, reason: RetractionReason, q: string): { where: string; params: unknown[] } {
  const conditions: string[] = [
    `c."ingestedBy" = 'crossref_retractions_v1'`,
    `c.deleted = false`,
  ];

  const params: unknown[] = [];
  const likeParam = (value: string): string => {
    const escaped = value.replace(/[\\%_]/g, (m) => `\\${m}`);
    params.push(`%${escaped}%`);
    return `$${params.length}`;
  };

  if (reason !== "all") {
    conditions.push(`c.metadata->>'updateType' ILIKE ${likeParam(reason)}`);
  }

  if (q) {
    const p = likeParam(q);
    // DOI queries arrive from the retraction wall (bare "10.1016/..." or a
    // doi.org URL). Stored DOIs are lowercase; normalize before matching —
    // without this, DOI handoffs returned "0 papers" (fixed 2026-07-05).
    const doiNorm = q.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
    const pd = likeParam(doiNorm);
    conditions.push(
      `(c.metadata->>'title' ILIKE ${p} OR c.metadata->>'journal' ILIKE ${p} OR c.metadata->>'firstAuthor' ILIKE ${p} OR c.metadata->>'doi' ILIKE ${pd} OR c.text ILIKE ${p})`
    );
  }

  if (field !== "all") {
    // The field is a journal-name keyword match (lib/retraction-filters.ts).
    const ors = JOURNAL_KEYWORDS[field]
      .map((kw) => `c.metadata->>'journal' ILIKE ${likeParam(kw)}`)
      .join(" OR ");
    conditions.push(`(${ors})`);
  }

  return { where: conditions.join(" AND "), params };
}

// Impact sort: tiered journal prestige. All strings are hardcoded — no user input.
const IMPACT_ORDER = `
    CASE
      WHEN c.metadata->>'journal' ILIKE '%nature%'              THEN 1
      WHEN c.metadata->>'journal' ILIKE '%science%'             THEN 1
      WHEN c.metadata->>'journal' ILIKE '%new england journal%' THEN 1
      WHEN c.metadata->>'journal' ILIKE '%nejm%'                THEN 1
      WHEN c.metadata->>'journal' ILIKE '%lancet%'              THEN 1
      WHEN c.metadata->>'journal' ILIKE '%jama%'                THEN 1
      WHEN c.metadata->>'journal' ILIKE '%cell%'                THEN 1
      WHEN c.metadata->>'journal' ILIKE '%pnas%'                THEN 1
      WHEN c.metadata->>'journal' ILIKE '%proceedings of the national%' THEN 1
      WHEN c.metadata->>'journal' ILIKE '%bmj%'                 THEN 2
      WHEN c.metadata->>'journal' ILIKE '%british medical%'     THEN 2
      WHEN c.metadata->>'journal' ILIKE '%annals of internal%'  THEN 2
      WHEN c.metadata->>'journal' ILIKE '%journal of the american%'     THEN 2
      WHEN c.metadata->>'journal' ILIKE '%circulation%'         THEN 2
      WHEN c.metadata->>'journal' ILIKE '%gastroenterology%'    THEN 2
      WHEN c.metadata->>'journal' ILIKE '%gut%'                 THEN 2
      WHEN c.metadata->>'journal' ILIKE '%diabetes%'            THEN 2
      WHEN c.metadata->>'journal' ILIKE '%psychological science%'       THEN 2
      WHEN c.metadata->>'journal' ILIKE '%plos one%'            THEN 3
      WHEN c.metadata->>'journal' ILIKE '%plos%'                THEN 3
      ELSE 4
    END ASC,
    c."claimEmergedAt" DESC NULLS LAST
  `;

async function countRetractions(field: Field, reason: RetractionReason, q: string): Promise<number> {
  const { where, params } = retractionWhere(field, reason, q);
  const r = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "Claim" c WHERE ${where}`,
    ...params
  );
  // A number, not the BigInt: unstable_cache stores JSON.stringify(result).
  return Number(r[0]?.count ?? 0);
}

async function loadRetractionsPage(field: Field, reason: RetractionReason, q: string, sortBy: Sort, page: number) {
  const { where, params } = retractionWhere(field, reason, q);
  const orderBy = sortBy === "date"
    ? `c."claimEmergedAt" DESC NULLS LAST, c."createdAt" DESC`
    : IMPACT_ORDER;
  // LIMIT/OFFSET are server-computed integers: page is clamped before this call.
  const offset = (page - 1) * PAGE_SIZE;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      text: string;
      metadata: unknown;
      claimEmergedAt: Date | null;
    }>
  >(
    `SELECT c.id, c.text, c.metadata, c."claimEmergedAt"
     FROM "Claim" c
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    ...params
  );

  // Plain JSON (ISO strings, no Dates): a cache hit returns JSON.parse(body).
  return rows.map((r) => {
    const m = r.metadata as Record<string, unknown>;
    const retractionDate = r.claimEmergedAt;
    const year = retractionDate
      ? new Date(retractionDate).getFullYear()
      : null;
    return {
      id: r.id,
      title: (m?.title as string) ?? r.text.slice(0, 120),
      firstAuthor: (m?.firstAuthor as string) ?? null,
      journal: (m?.journal as string) ?? null,
      publisher: (m?.publisher as string) ?? null,
      doi: (m?.doi as string) ?? null,
      updateType: (m?.updateType as string) ?? "Retraction",
      retractionDate: retractionDate ? retractionDate.toISOString().slice(0, 10) : null,
      year,
      summary: (m?.summary as string) ?? null,
    };
  });
}

// The named functions themselves, so a change to their body changes the cache
// key (unstable_cache keys on the callback's source). Called with q = "".
const countRetractionsCached = unstable_cache(countRetractions, ["api-retractions-count"], { revalidate: 3600 });
const loadRetractionsPageCached = unstable_cache(loadRetractionsPage, ["api-retractions-page"], { revalidate: 3600 });

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const field = sp.get("field") || "all";
    const reason = sp.get("reason") || "all";
    const q = (sp.get("q") ?? "").trim().slice(0, Q_MAX);
    const sortBy: Sort = sp.get("sortBy") === "date" ? "date" : "impact";
    const rawPage = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const headers = {
      "Cache-Control": q
        ? "public, s-maxage=300, stale-while-revalidate=3600"
        : "public, s-maxage=3600, stale-while-revalidate=86400",
    };

    // An unknown field or reason matches nothing — answered without touching
    // the database or the cache.
    if (!isRetractionField(field) || !isRetractionReason(reason)) {
      return NextResponse.json({ total: 0, papers: [], page: 1, pageSize: PAGE_SIZE }, { headers });
    }

    const total = q ? await countRetractions(field, reason, q) : await countRetractionsCached(field, reason, "");
    const page = Math.min(Math.max(1, Math.ceil(total / PAGE_SIZE)), rawPage);
    const papers = q
      ? await loadRetractionsPage(field, reason, q, sortBy, page)
      : await loadRetractionsPageCached(field, reason, "", sortBy, page);

    return NextResponse.json({ total, papers, page, pageSize: PAGE_SIZE }, { headers });
  } catch (err) {
    console.error("[/api/retractions] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
