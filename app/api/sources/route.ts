import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const sources = await prisma.source.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
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
