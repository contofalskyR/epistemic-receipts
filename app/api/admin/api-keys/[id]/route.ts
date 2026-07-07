import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return false;
  const expected = await sha256Hex(adminToken);
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return (await sha256Hex(auth.slice(7))) === expected;
  }
  const cookie = req.cookies.get("admin_auth")?.value;
  return cookie === expected;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.apiKey.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (existing.revokedAt) {
    return NextResponse.json({ error: "Already revoked." }, { status: 409 });
  }

  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ id, revokedAt: new Date().toISOString() });
}
