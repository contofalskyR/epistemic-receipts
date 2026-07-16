import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getProfileIdByKey,
  hashProfileKey,
  isFollowEntityType,
  isValidProfileKey,
  resolveFollows,
} from "@/lib/following";

export const dynamic = "force-dynamic";

// In-memory rate limiter (feedback-route pattern): max 30 follow writes per
// IP per 10 minutes — generous for humans, hostile to scripts.
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const hits = (rateLimitMap.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= 30) return true;
  rateLimitMap.set(ip, [...hits, now]);
  return false;
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

type ParsedBody = { key: string; entityType: string; entityId: string };

async function parseBody(req: NextRequest): Promise<ParsedBody | NextResponse> {
  const body: unknown = await req.json().catch(() => null);
  const { key, entityType, entityId } = (body ?? {}) as Record<string, unknown>;
  if (!isValidProfileKey(key)) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }
  if (!isFollowEntityType(entityType)) {
    return NextResponse.json(
      { error: "entityType must be one of claim, trajectory, topic, domain, story" },
      { status: 400 },
    );
  }
  if (typeof entityId !== "string" || !entityId || entityId.length > 256) {
    return NextResponse.json({ error: "entityId required" }, { status: 400 });
  }
  return { key, entityType, entityId };
}

/** Write failed at the DB layer — on the public edition this means the scoped
 *  writes role / Follow table isn't provisioned yet. Clear error, no stack. */
function writeUnavailable(): NextResponse {
  return NextResponse.json(
    { error: "Follows are not enabled on this edition yet." },
    { status: 503 },
  );
}

// GET /api/follow?key=… — the reader's resolved follow list (/following page).
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!isValidProfileKey(key)) {
    return NextResponse.json({ follows: [] });
  }
  try {
    const profileId = await getProfileIdByKey(key);
    if (!profileId) return NextResponse.json({ follows: [] });
    const follows = await resolveFollows(profileId);
    return NextResponse.json({ follows });
  } catch {
    // Follow table may not exist yet (pre-migration-window edition).
    return NextResponse.json({ follows: [] });
  }
}

// POST /api/follow — body {key, entityType, entityId} → {followed: true, followId}
export async function POST(req: NextRequest) {
  if (isRateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }
  const parsed = await parseBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const { key, entityType, entityId } = parsed;

  try {
    const profile = await prisma.profile.upsert({
      where: { key: hashProfileKey(key) },
      update: {},
      create: { key: hashProfileKey(key) },
      select: { id: true },
    });
    const follow = await prisma.follow.upsert({
      where: {
        profileId_entityType_entityId: {
          profileId: profile.id,
          entityType,
          entityId,
        },
      },
      update: {},
      create: { profileId: profile.id, entityType, entityId },
      select: { id: true },
    });
    return NextResponse.json({ followed: true, followId: follow.id });
  } catch {
    return writeUnavailable();
  }
}

// DELETE /api/follow — body {key, entityType, entityId} → {followed: false}
export async function DELETE(req: NextRequest) {
  if (isRateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }
  const parsed = await parseBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const { key, entityType, entityId } = parsed;

  try {
    const profileId = await getProfileIdByKey(key);
    if (profileId) {
      await prisma.follow.deleteMany({
        where: { profileId, entityType, entityId },
      });
    }
    return NextResponse.json({ followed: false });
  } catch {
    return writeUnavailable();
  }
}
