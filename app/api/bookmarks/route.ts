import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isValidKey(key: unknown): key is string {
  return typeof key === "string" && key.length >= 8 && key.length <= 128;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!isValidKey(key)) {
    return NextResponse.json({ claimIds: [] });
  }
  const profile = await prisma.profile.findUnique({
    where: { key: hashKey(key) },
    select: {
      bookmarks: {
        select: { claimId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!profile) {
    return NextResponse.json({ claimIds: [] });
  }
  return NextResponse.json({
    claimIds: profile.bookmarks.map(b => b.claimId),
    bookmarks: profile.bookmarks,
  });
}

export async function POST(req: NextRequest) {
  const { key, claimId } = await req.json().catch(() => ({}));
  if (!isValidKey(key) || typeof claimId !== "string" || !claimId) {
    return NextResponse.json({ error: "key and claimId required" }, { status: 400 });
  }
  const hashed = hashKey(key);
  const profile = await prisma.profile.upsert({
    where: { key: hashed },
    update: {},
    create: { key: hashed },
    select: { id: true },
  });
  const claim = await prisma.claim.findUnique({ where: { id: claimId }, select: { id: true } });
  if (!claim) {
    return NextResponse.json({ error: "claim not found" }, { status: 404 });
  }
  await prisma.bookmark.upsert({
    where: { profileId_claimId: { profileId: profile.id, claimId } },
    update: {},
    create: { profileId: profile.id, claimId },
  });
  return NextResponse.json({ success: true, bookmarked: true });
}

export async function DELETE(req: NextRequest) {
  const { key, claimId } = await req.json().catch(() => ({}));
  if (!isValidKey(key) || typeof claimId !== "string" || !claimId) {
    return NextResponse.json({ error: "key and claimId required" }, { status: 400 });
  }
  const profile = await prisma.profile.findUnique({
    where: { key: hashKey(key) },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ success: true, bookmarked: false });
  }
  await prisma.bookmark.deleteMany({
    where: { profileId: profile.id, claimId },
  });
  return NextResponse.json({ success: true, bookmarked: false });
}
