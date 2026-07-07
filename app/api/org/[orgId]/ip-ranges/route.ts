import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgRole, isOrgContext } from "@/lib/orgAuth";
import { validateCidr } from "@/lib/cidr";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (!isOrgContext(ctx)) return ctx;

  const ranges = await prisma.orgIpRange.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(ranges);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (!isOrgContext(ctx)) return ctx;

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { cidr, label = "", confirmFlag = false } = body as { cidr?: unknown; label?: unknown; confirmFlag?: unknown };
  if (typeof cidr !== "string" || cidr.length > 50) {
    return NextResponse.json({ error: "cidr required (max 50 chars)" }, { status: 400 });
  }
  if (typeof label !== "string" || label.length > 100) {
    return NextResponse.json({ error: "label max 100 chars" }, { status: 400 });
  }

  const cidrError = validateCidr(cidr, confirmFlag === true);
  if (cidrError) return NextResponse.json({ error: cidrError }, { status: 400 });

  const range = await prisma.orgIpRange.create({
    data: { orgId, cidr, label, confirmFlag: confirmFlag === true },
  });
  return NextResponse.json(range, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (!isOrgContext(ctx)) return ctx;

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { id } = body as { id?: unknown };
  if (typeof id !== "string") return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.orgIpRange.deleteMany({ where: { id, orgId } });
  return NextResponse.json({ ok: true });
}
