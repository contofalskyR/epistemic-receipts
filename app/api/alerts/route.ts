import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

// GET /api/alerts — list the authenticated user's topic subscriptions
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const alerts = await prisma.topicSubscription.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      topicKeyword: true,
      topicLabel: true,
      frequency: true,
      lastAlertAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ alerts });
}

// POST /api/alerts — subscribe to a topic (gated by alerts.max)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true },
  });
  if (!user?.email) {
    return NextResponse.json({ error: "User has no email" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const topicKeyword =
    typeof body.topicKeyword === "string" ? body.topicKeyword.trim().toLowerCase() : "";
  const topicLabel =
    typeof body.topicLabel === "string" ? body.topicLabel.trim() : topicKeyword;
  const frequency =
    body.frequency === "daily" || body.frequency === "weekly" ? body.frequency : "weekly";

  if (!topicKeyword) {
    return NextResponse.json({ error: "topicKeyword is required" }, { status: 400 });
  }

  // Entitlement check
  const existing = await prisma.topicSubscription.count({
    where: { userId: session.user.id },
  });

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { org: { select: { id: true, tier: true } } },
  });
  const ctx = membership
    ? {
        user: { id: session.user.id },
        org: { id: membership.org.id, tier: membership.org.tier as "free" | "pro" | "team" | "enterprise" },
      }
    : { user: { id: session.user.id } };

  const maxAlerts = can(ctx, "alerts.max") as number;

  if (existing >= maxAlerts) {
    return NextResponse.json(
      {
        error: "Alert limit reached",
        code: "alerts_limit",
        limit: maxAlerts,
        upgrade: true,
      },
      { status: 402 },
    );
  }

  // Upsert: link email sub to userId if it exists, else create new
  const alert = await prisma.topicSubscription.upsert({
    where: { email_topicKeyword: { email: user.email, topicKeyword } },
    create: {
      email: user.email,
      topicKeyword,
      topicLabel,
      frequency,
      confirmed: true,
      userId: session.user.id,
    },
    update: {
      userId: session.user.id,
      frequency,
      topicLabel: topicLabel || undefined,
    },
    select: {
      id: true,
      topicKeyword: true,
      topicLabel: true,
      frequency: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ alert }, { status: 201 });
}
