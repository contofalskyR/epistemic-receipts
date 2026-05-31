import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key || key.length < 8) {
    return NextResponse.json({ claims: [] });
  }
  const profile = await prisma.profile.findUnique({
    where: { key },
    select: {
      bookmarks: {
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          claim: {
            select: {
              id: true,
              text: true,
              currentStatus: true,
              claimType: true,
              verificationStatus: true,
              ingestedBy: true,
              createdAt: true,
              deleted: true,
            },
          },
        },
      },
    },
  });
  if (!profile) {
    return NextResponse.json({ claims: [] });
  }
  const claims = profile.bookmarks
    .filter(b => b.claim && !b.claim.deleted)
    .map(b => ({
      ...b.claim,
      bookmarkedAt: b.createdAt,
    }));
  return NextResponse.json({ claims });
}
