import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_TO_PIPELINES, PIPELINE_COUNTRY_NAME } from "@/lib/globe-pipeline-country";

const MIN_QUERY = 3;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type ClaimHit = {
  id: string;
  text: string;
  currentStatus: string;
  epistemicAxis: string | null;
  claimType: string;
  ingestedBy: string;
  verificationStatus: string | null;
  epistemicStatus: string | null;
  createdAt: string;
  claimEmergedAt: string | null;
  sourceName: string | null;
  topicLabel: string | null;
  rank: number | null;
};

type SourceHit = {
  id: string;
  name: string;
  url: string | null;
  methodologyType: string;
  ingestedBy: string;
  firstClaimId: string | null;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const qRaw = (url.searchParams.get("q") ?? "").trim();
  const typeRaw = (url.searchParams.get("type") ?? "all").toLowerCase();
  const type: "claims" | "sources" | "all" =
    typeRaw === "claims" || typeRaw === "sources" ? typeRaw : "all";

  const countryRaw = (url.searchParams.get("country") ?? "").trim().toUpperCase();
  const countryPipelines = countryRaw ? COUNTRY_TO_PIPELINES[countryRaw] ?? [] : [];
  const countryActive = countryRaw.length > 0 && countryPipelines.length > 0;
  const countryName = countryActive ? PIPELINE_COUNTRY_NAME[countryRaw] ?? null : null;

  const VALID_AXES = ["SETTLED", "CONTESTED", "RECORDED", "OPEN", "UNRESOLVABLE"] as const;
  const axisRaw = (url.searchParams.get("axis") ?? "").trim().toUpperCase();
  const axisFilter = (VALID_AXES as readonly string[]).includes(axisRaw) ? axisRaw : null;

  const limit = Math.max(
    1,
    Math.min(
      MAX_LIMIT,
      Number.parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT,
    ),
  );
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  // Allow empty q when a country filter is active.
  if (!countryActive && qRaw.length < MIN_QUERY) {
    return NextResponse.json({
      query: qRaw,
      type,
      limit,
      offset,
      country: countryRaw || null,
      countryName: null,
      counts: { claims: 0, sources: 0 },
      claims: [] as ClaimHit[],
      sources: [] as SourceHit[],
      message: `Query must be at least ${MIN_QUERY} characters.`,
    });
  }

  const wantClaims = type === "all" || type === "claims";
  const wantSources = type === "all" || type === "sources";

  // ── Claims: use tsvector ranking with trgm fallback ──

  let claims: ClaimHit[] = [];
  let claimsCount = 0;

  if (wantClaims) {
    if (qRaw.length >= MIN_QUERY) {
      // Build WHERE fragments
      const conditions: string[] = [`c."deleted" = false`];
      const params: unknown[] = [];
      let paramIdx = 1;

      // Full-text tsquery condition (primary ranking), OR trgm ILIKE fallback
      params.push(qRaw);
      const qParamNum = paramIdx++;
      conditions.push(
        `(c."searchVector" @@ websearch_to_tsquery('english', $${qParamNum}) OR c."text" ILIKE '%' || $${qParamNum} || '%')`
      );

      if (countryActive) {
        // Build IN list for country pipelines
        const placeholders = countryPipelines.map(() => `$${paramIdx++}`);
        params.push(...countryPipelines);
        conditions.push(`c."ingestedBy" IN (${placeholders.join(", ")})`);
      }

      if (axisFilter) {
        params.push(axisFilter);
        conditions.push(`c."epistemicAxis" = $${paramIdx++}`);
      }

      const whereClause = conditions.join(" AND ");

      // Count
      const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT count(*)::bigint AS count FROM "Claim" c WHERE ${whereClause}`,
        ...params,
      );
      claimsCount = Number(countResult[0].count);

      // Ranked results: ts_rank for FTS matches, 0 for trgm-only matches
      params.push(limit, offset);
      const limitParam = paramIdx++;
      const offsetParam = paramIdx++;

      const claimRows = await prisma.$queryRawUnsafe<Array<{
        id: string;
        text: string;
        currentStatus: string;
        epistemicAxis: string | null;
        claimType: string;
        ingestedBy: string;
        verificationStatus: string | null;
        epistemicStatus: string | null;
        createdAt: Date;
        claimEmergedAt: Date | null;
        sourceName: string | null;
        topicLabel: string | null;
        rank: number;
      }>>(
        `SELECT
           c."id",
           c."text",
           c."currentStatus",
           c."epistemicAxis",
           c."claimType",
           c."ingestedBy",
           c."verificationStatus",
           c."epistemicStatus",
           c."createdAt",
           c."claimEmergedAt",
           s."name" AS "sourceName",
           t."name" AS "topicLabel",
           ts_rank(c."searchVector", websearch_to_tsquery('english', $1)) AS rank
         FROM "Claim" c
         LEFT JOIN LATERAL (
           SELECT s2."name"
           FROM "Edge" e
           JOIN "Source" s2 ON s2."id" = e."sourceId"
           WHERE e."claimId" = c."id" AND e."deleted" = false
           ORDER BY e."createdAt" ASC
           LIMIT 1
         ) s ON true
         LEFT JOIN LATERAL (
           SELECT t2."name"
           FROM "ClaimTopic" ct
           JOIN "Topic" t2 ON t2."id" = ct."topicId"
           WHERE ct."claimId" = c."id"
           LIMIT 1
         ) t ON true
         WHERE ${whereClause}
         ORDER BY rank DESC, c."createdAt" DESC
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
        ...params,
      );

      claims = claimRows.map(c => ({
        id: c.id,
        text: c.text,
        currentStatus: c.currentStatus,
        epistemicAxis: c.epistemicAxis ?? null,
        claimType: c.claimType,
        ingestedBy: c.ingestedBy,
        verificationStatus: c.verificationStatus,
        epistemicStatus: c.epistemicStatus ?? null,
        createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
        claimEmergedAt: c.claimEmergedAt instanceof Date ? c.claimEmergedAt.toISOString() : (c.claimEmergedAt ?? null),
        sourceName: c.sourceName ?? null,
        topicLabel: c.topicLabel ?? null,
        rank: c.rank,
      }));
    } else {
      // Country-only filter (no text query) — use Prisma ORM path
      const claimCountryWhere = countryActive
        ? { ingestedBy: { in: countryPipelines } }
        : {};
      const claimWhere = {
        deleted: false,
        ...claimCountryWhere,
        ...(axisFilter ? { epistemicAxis: axisFilter } : {}),
      };

      const [count, rows] = await Promise.all([
        prisma.claim.count({ where: claimWhere }),
        prisma.claim.findMany({
          where: claimWhere,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            text: true,
            currentStatus: true,
            epistemicAxis: true,
            claimType: true,
            ingestedBy: true,
            verificationStatus: true,
            epistemicStatus: true,
            createdAt: true,
            claimEmergedAt: true,
            edges: {
              where: { deleted: false },
              orderBy: { createdAt: "asc" as const },
              take: 1,
              select: { source: { select: { name: true } } },
            },
            topics: {
              take: 1,
              select: { topic: { select: { name: true } } },
            },
          },
        }),
      ]);
      claimsCount = count;
      claims = rows.map(c => ({
        id: c.id,
        text: c.text,
        currentStatus: c.currentStatus,
        epistemicAxis: c.epistemicAxis ?? null,
        claimType: c.claimType,
        ingestedBy: c.ingestedBy,
        verificationStatus: c.verificationStatus,
        epistemicStatus: c.epistemicStatus ?? null,
        createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
        claimEmergedAt: c.claimEmergedAt instanceof Date ? c.claimEmergedAt.toISOString() : (c.claimEmergedAt ?? null),
        sourceName: c.edges[0]?.source?.name ?? null,
        topicLabel: c.topics[0]?.topic?.name ?? null,
        rank: null,
      }));
    }
  }

  // ── Sources: keep Prisma ORM (small table, ILIKE is fine) ──

  const sourceTextWhere = qRaw.length >= MIN_QUERY
    ? {
        OR: [
          { name: { contains: qRaw, mode: "insensitive" as const } },
          { url: { contains: qRaw, mode: "insensitive" as const } },
        ],
      }
    : {};
  const sourceWhere = qRaw.length >= MIN_QUERY
    ? { deleted: false, ...sourceTextWhere }
    : null;

  const [sourcesCount, sourceRows] = await Promise.all([
    wantSources && sourceWhere
      ? prisma.source.count({ where: sourceWhere })
      : Promise.resolve(0),
    wantSources && sourceWhere
      ? prisma.source.findMany({
          where: sourceWhere,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            name: true,
            url: true,
            methodologyType: true,
            ingestedBy: true,
            edges: {
              where: { deleted: false },
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { claimId: true },
            },
          },
        })
      : Promise.resolve([] as Array<{
          id: string;
          name: string;
          url: string | null;
          methodologyType: string;
          ingestedBy: string;
          edges: { claimId: string }[];
        }>),
  ]);

  const sources: SourceHit[] = sourceRows.map(s => ({
    id: s.id,
    name: s.name,
    url: s.url,
    methodologyType: s.methodologyType,
    ingestedBy: s.ingestedBy,
    firstClaimId: s.edges[0]?.claimId ?? null,
  }));

  return NextResponse.json({
    query: qRaw,
    type,
    limit,
    offset,
    country: countryActive ? countryRaw : null,
    countryName,
    axis: axisFilter,
    counts: { claims: claimsCount, sources: sourcesCount },
    claims,
    sources,
  });
}
