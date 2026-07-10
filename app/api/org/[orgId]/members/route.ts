import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgRole, isOrgContext } from "@/lib/orgAuth";
import { Resend } from "resend";

// Lazy init: a module-top-level `new Resend(...)` throws "Missing API key" during
// `next build` when RESEND_API_KEY is unset (fails the whole build). Defer to
// first use, which is always inside a request handler.
let _resend: Resend | null = null;
const getResend = () => (_resend ??= new Resend(process.env.RESEND_API_KEY));

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const ctx = await requireOrgRole(orgId, "member");
  if (!isOrgContext(ctx)) return ctx;

  const members = await prisma.membership.findMany({
    where: { orgId },
    include: { user: { select: { id: true, email: true, name: true, createdAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(members);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (!isOrgContext(ctx)) return ctx;

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { email, role = "member" } = body as { email?: unknown; role?: unknown };
  if (typeof email !== "string" || email.length > 254) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!["member", "admin"].includes(role as string)) {
    return NextResponse.json({ error: "role must be member or admin" }, { status: 400 });
  }

  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const memberCount = await prisma.membership.count({ where: { orgId } });
  if (memberCount >= org.seats) {
    return NextResponse.json({ error: "Org has reached its seat limit" }, { status: 409 });
  }

  const user = await prisma.user.upsert({
    where: { email: email as string },
    create: { email: email as string },
    update: {},
  });

  const membership = await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId } },
    create: { userId: user.id, orgId, role: role as string },
    update: { role: role as string },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://epistemic-receipts.com";
  await getResend().emails.send({
    from: process.env.RESEND_FROM ?? "noreply@epistemic-receipts.com",
    to: email as string,
    subject: `You've been added to ${org.name} on Epistemic Receipts`,
    text: `You've been added to the ${org.name} organization.\n\nSign in at ${appUrl}/auth/signin\n`,
  });

  return NextResponse.json(membership, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (!isOrgContext(ctx)) return ctx;

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { userId } = body as { userId?: unknown };
  if (typeof userId !== "string") return NextResponse.json({ error: "userId required" }, { status: 400 });

  const targetMembership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (targetMembership?.role === "owner") {
    const ownerCount = await prisma.membership.count({ where: { orgId, role: "owner" } });
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "Cannot remove the last owner" }, { status: 409 });
    }
  }

  await prisma.membership.deleteMany({ where: { userId, orgId } });
  return NextResponse.json({ ok: true });
}
