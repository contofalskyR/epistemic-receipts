import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const queries = await prisma.savedQuery.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ queries });
}

export async function POST(req: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, filters, frequency } = body;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!filters || typeof filters !== "object") {
    return NextResponse.json({ error: "filters required" }, { status: 400 });
  }
  const freq = typeof frequency === "string" ? frequency : "daily";
  if (!["instant", "daily", "weekly"].includes(freq)) {
    return NextResponse.json({ error: "invalid frequency" }, { status: 400 });
  }

  const query = await prisma.savedQuery.create({
    data: { profileId: profile.id, name: name.trim(), filters, frequency: freq },
  });
  return NextResponse.json({ query }, { status: 201 });
}
