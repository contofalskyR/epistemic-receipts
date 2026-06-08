import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_TO_PIPELINES, PIPELINE_COUNTRY_NAME } from "@/lib/globe-pipeline-country";

export const revalidate = 60;

const MIN_QUERY = 3;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type ClaimHit = {
  id: string;
  text: string;
  currentStatus: string;
  claimType: string;
  ingestedBy: string;
  verificationStatus: string | null;
  epistemicStatus: string | null;
  createdAt: string;
  claimEmergedAt: string | null;
  sourceName: string | null;
  topicLabel: string | null;
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

  const claimTextWhere = qRaw.length >= MIN_QUERY
    ? { text: { contains: qRaw, mode: "insensitive" as const } }
    : {};
  const claimCountryWhere = countryActive
    ? { ingestedBy: { in: countryPipelines } }
    : {};
  const claimWhere = {
    deleted: false,
    ...claimTextWhere,
    ...claimCountryWhere,
  };

  const sourceTextWhere = qRaw.length >= MIN_QUERY
    ? {
        OR: [
          { name: { contains: qRaw, mode: "insensitive" as const } },
          { url: { contains: qRaw, mode: "insensitive" as const } },
        ],
      }
    : {};
  // Sources don't get country filtering — only claims do.
  const sourceWhere = qRaw.length >= MIN_QUERY
    ? { deleted: false, ...sourceTextWhere }
    : null;

  const [claimsCount, sourcesCount, claimRows, sourceRows] = await Promise.all([
    wantClaims
      ? prisma.claim.count({ where: claimWhere })
      : Promise.resolve(0),
    wantSources && sourceWhere
      ? prisma.source.count({ where: sourceWhere })
      : Promise.resolve(0),
    wantClaims
      ? prisma.claim.findMany({
          where: claimWhere,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            text: true,
            currentStatus: true,
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
        })
      : Promise.resolve([] as Array<{
          id: string;
          text: string;
          currentStatus: string;
          claimType: string;
          ingestedBy: string;
          verificationStatus: string | null;
          epistemicStatus: string | null;
          createdAt: Date;
          claimEmergedAt: Date | null;
          edges: { source: { name: string } }[];
          topics: { topic: { name: string } }[];
        }>),
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

  const claims: ClaimHit[] = claimRows.map(c => ({
    id: c.id,
    text: c.text,
    currentStatus: c.currentStatus,
    claimType: c.claimType,
    ingestedBy: c.ingestedBy,
    verificationStatus: c.verificationStatus,
    epistemicStatus: (c as { epistemicStatus?: string | null }).epistemicStatus ?? null,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    claimEmergedAt: c.claimEmergedAt instanceof Date ? c.claimEmergedAt.toISOString() : (c.claimEmergedAt ?? null),
    sourceName: c.edges[0]?.source?.name ?? null,
    topicLabel: c.topics[0]?.topic?.name ?? null,
  }));

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
    counts: { claims: claimsCount, sources: sourcesCount },
    claims,
    sources,
  });
}
