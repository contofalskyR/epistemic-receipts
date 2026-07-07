import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof (body as { profileKey?: unknown }).profileKey !== "string") {
    return NextResponse.json({ error: "profileKey required" }, { status: 400 });
  }
  const profileKey = (body as { profileKey: string }).profileKey.slice(0, 200);

  const profile = await prisma.profile.findUnique({ where: { key: profileKey } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = profile as any;
  if (p.userId && p.userId !== session.user.id) {
    return NextResponse.json({ error: "Profile not available" }, { status: 409 });
  }
  if (p.userId === session.user.id) {
    return NextResponse.json({ ok: true, claimed: false });
  }

  await prisma.profile.update({
    where: { key: profileKey },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { userId: session.user.id } as any,
  });

  return NextResponse.json({ ok: true, claimed: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof (body as { profileKey?: unknown }).profileKey !== "string") {
    return NextResponse.json({ error: "profileKey required" }, { status: 400 });
  }
  const profileKey = (body as { profileKey: string }).profileKey.slice(0, 200);

  // Ownership enforced in WHERE
  await prisma.profile.updateMany({
    where: { key: profileKey, userId: session.user.id } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    data: { userId: null } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  return NextResponse.json({ ok: true });
}
