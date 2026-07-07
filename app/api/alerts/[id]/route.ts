import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/alerts/[id] — update frequency
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;

  const alert = await prisma.topicSubscription.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!alert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (body.frequency !== "daily" && body.frequency !== "weekly") {
    return NextResponse.json({ error: "frequency must be daily or weekly" }, { status: 400 });
  }

  const updated = await prisma.topicSubscription.update({
    where: { id },
    data: { frequency: body.frequency },
    select: { id: true, topicKeyword: true, topicLabel: true, frequency: true },
  });

  return NextResponse.json({ alert: updated });
}

// DELETE /api/alerts/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;

  const alert = await prisma.topicSubscription.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!alert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.topicSubscription.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
