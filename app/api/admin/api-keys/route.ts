import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

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

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    orgName?: string;
    contactEmail?: string;
    tier?: string;
  };

  if (!body.orgName || !body.contactEmail) {
    return NextResponse.json({ error: "orgName and contactEmail are required." }, { status: 400 });
  }

  const tier = ["free", "pro", "team", "enterprise"].includes(body.tier ?? "")
    ? body.tier!
    : "free";

  // Generate raw key: er_live_ + hex(32 random bytes) = 64 hex chars
  const rawBytes = crypto.getRandomValues(new Uint8Array(32));
  const rawKey = "er_live_" + toHex(rawBytes);
  const keyHash = await sha256Hex(rawKey);

  const apiKey = await prisma.apiKey.create({
    data: { orgName: body.orgName, contactEmail: body.contactEmail, keyHash, tier },
    select: { id: true, orgName: true, contactEmail: true, tier: true, createdAt: true },
  });

  return NextResponse.json(
    {
      ...apiKey,
      createdAt: apiKey.createdAt.toISOString(),
      rawKey,
      warning: "Store this key securely. It will not be shown again.",
    },
    { status: 201 },
  );
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orgName: true,
      contactEmail: true,
      tier: true,
      createdAt: true,
      revokedAt: true,
      lastUsedAt: true,
    },
  });

  return NextResponse.json({
    data: keys.map(k => ({
      ...k,
      createdAt: k.createdAt.toISOString(),
      revokedAt: k.revokedAt?.toISOString() ?? null,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    })),
  });
}
