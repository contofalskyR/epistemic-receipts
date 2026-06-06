import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_WINDOW_DAYS = 90;
const MIN_WINDOW_DAYS = 1;

export async function GET(req: NextRequest) {
  const sinceParam = req.nextUrl.searchParams.get("since");
  const now = Date.now();
  const floor = new Date(now - MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const ceiling = new Date(now - MIN_WINDOW_DAYS * 60 * 1000);

  let since: Date | null = null;
  if (sinceParam) {
    const parsed = new Date(sinceParam);
    if (!Number.isNaN(parsed.getTime())) {
      since = parsed < floor ? floor : parsed > ceiling ? ceiling : parsed;
    }
  }

  if (!since) {
    return NextResponse.json({ count: 0, since: null });
  }

  const count = await prisma.claim.count({
    where: {
      deleted: false,
      createdAt: { gte: since },
    },
  });

  return NextResponse.json({ count, since: since.toISOString() });
}
