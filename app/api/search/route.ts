import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_TO_PIPELINES, PIPELINE_COUNTRY_NAME } from "@/lib/globe-pipeline-country";
import { terminalAxisLateralJoin, effectiveAxisCondition, REVERSAL_AXES } from "@/lib/effective-axis";

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
  /** ClaimStatusHistory rows — ≥2 means a drawable settling curve exists. */
  transitionCount: number;
};

/** A search hit that IS a settling curve — multi-step history, mini-chart data. */
type CurveHit = {
  id: string;
  /** Value for /settling-curve?t= — curated slug when available, else claim id. */
  curveId: string;
  text: string;
  transitionCount: number;
  firstYear: number | null;
  lastYear: number | null;
  hasReversal: boolean;
  milestones: { year: number; axis: string }[];
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

  // REVERSED/ABANDONED are terminal transition outcomes, not stored-column
  // values, but are valid filters: resolved against each claim's terminal
  // transition via effectiveAxisCondition (see lib/effective-axis.ts).
  const VALID_AXES = ["SETTLED", "CONTESTED", "RECORDED", "OPEN", "UNRESOLVABLE", ...REVERSAL_AXES] as const;
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

  // ── Claims: tsvector ranking with trgm fallback ───────────────────────────

  let claims: ClaimHit[] = [];
  let claimsCount = 0;
  let curves: CurveHit[] = [];

  if (wantClaims) {
    if (qRaw.length >= MIN_QUERY) {
      const conditions: string[] = [`c."deleted" = false`];
      const params: unknown[] = [];
      let paramIdx = 1;

      params.push(qRaw);
      const qParamNum = paramIdx++;
      conditions.push(
        `(c."searchVector" @@ websearch_to_tsquery('english', $${qParamNum}) OR c."text" ILIKE '%' || $${qParamNum} || '%')`
      );

      if (countryActive) {
        const placeholders = countryPipelines.map(() => `$${paramIdx++}`);
        params.push(...countryPipelines);
        conditions.push(`c."ingestedBy" IN (${placeholders.join(", ")})`);
      }

      if (axisFilter) {
        params.push(axisFilter);
        conditions.push(effectiveAxisCondition(`$${paramIdx++}`));
      }

      const whereClause = conditions.join(" AND ");
      // effectiveAxisCondition references `term.term`; every FROM using
      // whereClause must expose it via the terminal LATERAL join.
      const axisJoin = axisFilter ? terminalAxisLateralJoin() : "";

      // ── Settling curves matching the query (first page only) ──────────────
      // Multi-step claims (a chained transition exists) ranked by relevance
      // then curve richness. Curated trajectories included — link by slug.
      if (offset === 0) {
        try {
          const curveRows = await prisma.$queryRawUnsafe<Array<{
            id: string;
            text: string;
            externalId: string | null;
            transitionCount: bigint;
          }>>(
            `SELECT c."id", c."text", c."externalId",
                    (SELECT COUNT(*) FROM "ClaimStatusHistory" h2 WHERE h2."claimId" = c."id") AS "transitionCount"
               FROM "Claim" c
               ${axisJoin}
              WHERE ${whereClause}
                AND (c."verificationStatus" IS NULL OR c."verificationStatus" <> 'DEPRECATED')
                AND EXISTS (
                  SELECT 1 FROM "ClaimStatusHistory" h
                   WHERE h."claimId" = c."id" AND h."fromAxis" IS NOT NULL
                )
              ORDER BY ts_rank(c."searchVector", websearch_to_tsquery('english', $${qParamNum})) DESC,
                       "transitionCount" DESC
              LIMIT 3`,
            ...params,
          );

          if (curveRows.length > 0) {
            const detail = await prisma.claim.findMany({
              where: { id: { in: curveRows.map((r) => r.id) } },
              select: {
                id: true,
                statusHistory: {
                  orderBy: [{ seq: "asc" }, { occurredAt: "asc" }, { createdAt: "asc" }],
                  select: { seq: true, toAxis: true, occurredAt: true },
                },
              },
            });
            const historyById = new Map(detail.map((d) => [d.id, d.statusHistory]));
            curves = curveRows.map((r) => {
              const history = historyById.get(r.id) ?? [];
              const years = history.map((h) => h.occurredAt.getUTCFullYear());
              return {
                id: r.id,
                curveId: r.externalId?.startsWith("trajectory:")
                  ? r.externalId.replace(/^trajectory:/, "")
                  : r.id,
                text: r.text,
                transitionCount: Number(r.transitionCount),
                firstYear: years.length ? Math.min(...years) : null,
                lastYear: years.length ? Math.max(...years) : null,
                hasReversal: history.some((h) => h.toAxis === "REVERSED"),
                milestones: history.map((h) => ({
                  year: h.occurredAt.getUTCFullYear(),
                  axis: h.toAxis,
                })),
              };
            });
          }
        } catch {
          // The curve rail is decoration on search — never break results.
          curves = [];
        }
      }

      const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT count(*)::bigint AS count FROM "Claim" c ${axisJoin} WHERE ${whereClause}`,
        ...params,
      );
      claimsCount = Number(countResult[0].count);

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
         ${axisJoin}
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
        transitionCount: 0,
      }));
    } else {
      // Country-only filter (no text query) — Prisma ORM path
      const claimCountryWhere = countryActive
        ? { ingestedBy: { in: countryPipelines } }
        : {};
      const claimSelect = {
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
      } as const;

      type CountryRow = Awaited<ReturnType<typeof prisma.claim.findMany<{ select: typeof claimSelect }>>>[number];
      let rows: CountryRow[];

      if (axisFilter) {
        // Terminal-aware axis filter: the stored epistemicAxis can't hold
        // REVERSED/ABANDONED and is stale on reversed claims, so resolve the
        // matching set (and page order) in SQL, then hydrate through the ORM.
        const p: unknown[] = [];
        const cc: string[] = [`c."deleted" = false`];
        p.push(axisFilter); cc.push(effectiveAxisCondition(`$${p.length}`));
        if (countryActive) { p.push(countryPipelines); cc.push(`c."ingestedBy" = ANY($${p.length}::text[])`); }
        const whereSql = cc.join(" AND ");

        const countRows = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
          `SELECT count(*)::bigint AS count FROM "Claim" c ${terminalAxisLateralJoin()} WHERE ${whereSql}`,
          ...p,
        );
        claimsCount = Number(countRows[0].count);

        p.push(limit); const limIdx = p.length;
        p.push(offset); const offIdx = p.length;
        const idRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT c."id" FROM "Claim" c ${terminalAxisLateralJoin()} WHERE ${whereSql}
            ORDER BY c."createdAt" DESC LIMIT $${limIdx} OFFSET $${offIdx}`,
          ...p,
        );
        const ids = idRows.map(r => r.id);
        const hydrated = ids.length
          ? await prisma.claim.findMany({ where: { id: { in: ids } }, select: claimSelect })
          : [];
        const byId = new Map(hydrated.map(r => [r.id, r]));
        rows = ids.map(id => byId.get(id)).filter((r): r is CountryRow => Boolean(r));
      } else {
        const [count, ormRows] = await Promise.all([
          prisma.claim.count({ where: { deleted: false, ...claimCountryWhere } }),
          prisma.claim.findMany({
            where: { deleted: false, ...claimCountryWhere },
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
            select: claimSelect,
          }),
        ]);
        claimsCount = count;
        rows = ormRows;
      }

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
        transitionCount: 0,
      }));
    }
  }

  // Curve affordance per claim hit — one grouped count over the page of ids.
  if (claims.length > 0) {
    const counts = await prisma.claimStatusHistory.groupBy({
      by: ["claimId"],
      where: { claimId: { in: claims.map((c) => c.id) } },
      _count: { _all: true },
    });
    const countById = new Map(counts.map((r) => [r.claimId, r._count._all]));
    claims = claims.map((c) => ({ ...c, transitionCount: countById.get(c.id) ?? 0 }));
  }

  // ── Sources ───────────────────────────────────────────────────────────────

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
    curves,
    claims,
    sources,
  });
}
