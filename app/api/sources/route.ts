import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(sp.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);
  const ingestedBy = sp.get("ingestedBy");

  const sources = await prisma.source.findMany({
    where: {
      deleted: false,
      ...(ingestedBy ? { ingestedBy } : {}),
    },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
    select: {
      id: true,
      name: true,
      url: true,
      publishedAt: true,
      methodologyType: true,
      ingestedBy: true,
      createdAt: true,
    },
  });
  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
  if (isReadOnly()) return NextResponse.json({ error: "Editing disabled in production" }, { status: 403 });
  const {
    name, url, publishedAt, methodologyType,
    ingestedBy, humanReviewed, reviewConfidence, reviewedAt, reviewedBy,
  } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!["primary", "derivative", "opinion"].includes(methodologyType)) {
    return NextResponse.json({ error: "invalid methodologyType" }, { status: 400 });
  }
  const isManual = !ingestedBy || ingestedBy === "manual";
  const source = await prisma.source.create({
    data: {
      name: name.trim(),
      url: url?.trim() || null,
      publishedAt: publishedAt ? new Date(publishedAt) : null,
      methodologyType,
      ingestedBy: isManual ? "manual" : ingestedBy,
      humanReviewed: humanReviewed !== undefined ? humanReviewed : isManual,
      reviewConfidence: reviewConfidence ?? null,
      reviewedAt: reviewedAt ? new Date(reviewedAt) : null,
      reviewedBy: reviewedBy ?? null,
    },
  });
  return NextResponse.json(source, { status: 201 });
}
