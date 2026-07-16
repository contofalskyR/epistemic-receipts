import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getProfileIdByKey,
  isFollowEntityType,
  isValidProfileKey,
} from "@/lib/following";

export const dynamic = "force-dynamic";

// GET /api/follow/check?key=…&entityType=…&entityId=… → {followed: bool}
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const entityType = req.nextUrl.searchParams.get("entityType");
  const entityId = req.nextUrl.searchParams.get("entityId");

  if (!isValidProfileKey(key) || !isFollowEntityType(entityType) || !entityId) {
    return NextResponse.json({ followed: false });
  }

  try {
    const profileId = await getProfileIdByKey(key);
    if (!profileId) return NextResponse.json({ followed: false });
    const follow = await prisma.follow.findUnique({
      where: {
        profileId_entityType_entityId: { profileId, entityType, entityId },
      },
      select: { id: true },
    });
    return NextResponse.json({ followed: Boolean(follow) });
  } catch {
    // Pre-migration edition: Follow table absent → nothing is followed.
    return NextResponse.json({ followed: false });
  }
}
