import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.savedQuery.findUnique({ where: { id } });
  if (!existing || existing.profileId !== profile.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.savedQuery.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
