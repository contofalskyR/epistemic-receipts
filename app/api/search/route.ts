import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
  createdAt: string;
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

  const limit = Math.max(
    1,
    Math.min(
      MAX_LIMIT,
      Number.parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT,
    ),
  );
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  if (qRaw.length < MIN_QUERY) {
    return NextResponse.json({
      query: qRaw,
      type,
      limit,
      offset,
      counts: { claims: 0, sources: 0 },
      claims: [] as ClaimHit[],
      sources: [] as SourceHit[],
      message: `Query must be at least ${MIN_QUERY} characters.`,
    });
  }

  const wantClaims = type === "all" || type === "claims";
  const wantSources = type === "all" || type === "sources";

  const [claimsCount, sourcesCount, claimRows, sourceRows] = await Promise.all([
    wantClaims
      ? prisma.claim.count({
          where: {
            deleted: false,
            text: { contains: qRaw, mode: "insensitive" },
          },
        })
      : Promise.resolve(0),
    wantSources
      ? prisma.source.count({
          where: {
            deleted: false,
            OR: [
              { name: { contains: qRaw, mode: "insensitive" } },
              { url: { contains: qRaw, mode: "insensitive" } },
            ],
          },
        })
      : Promise.resolve(0),
    wantClaims
      ? prisma.claim.findMany({
          where: {
            deleted: false,
            text: { contains: qRaw, mode: "insensitive" },
          },
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
            createdAt: true,
          },
        })
      : Promise.resolve([] as Array<{
          id: string;
          text: string;
          currentStatus: string;
          claimType: string;
          ingestedBy: string;
          verificationStatus: string | null;
          createdAt: Date;
        }>),
    wantSources
      ? prisma.source.findMany({
          where: {
            deleted: false,
            OR: [
              { name: { contains: qRaw, mode: "insensitive" } },
              { url: { contains: qRaw, mode: "insensitive" } },
            ],
          },
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
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
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
    counts: { claims: claimsCount, sources: sourcesCount },
    claims,
    sources,
  });
}
