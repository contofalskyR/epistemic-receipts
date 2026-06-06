import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_CLAIMS = 20;
const WINDOW_DAYS = 30;

function isValidKey(key: unknown): key is string {
  return typeof key === "string" && key.length >= 8 && key.length <= 128;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

type EventPreview = { eventType: string; createdAt: string };
type ClaimWithActivity = {
  claimId: string;
  claimText: string;
  currentStatus: string;
  events: EventPreview[];
};

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!isValidKey(key)) {
    return NextResponse.json({ claims: [] satisfies ClaimWithActivity[] });
  }

  const profile = await prisma.profile.findUnique({
    where: { key: hashKey(key) },
    select: {
      bookmarks: {
        select: { claimId: true },
      },
    },
  });
  if (!profile || profile.bookmarks.length === 0) {
    return NextResponse.json({ claims: [] satisfies ClaimWithActivity[] });
  }

  const claimIds = profile.bookmarks.map(b => b.claimId);
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const events = await prisma.thresholdEvent.findMany({
    where: {
      deleted: false,
      claimId: { in: claimIds },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    select: {
      claimId: true,
      triggeredBy: true,
      createdAt: true,
      claim: {
        select: { id: true, text: true, currentStatus: true, deleted: true },
      },
    },
  });

  const byClaim = new Map<string, ClaimWithActivity>();
  for (const e of events) {
    if (!e.claim || e.claim.deleted) continue;
    let entry = byClaim.get(e.claimId);
    if (!entry) {
      entry = {
        claimId: e.claim.id,
        claimText: e.claim.text,
        currentStatus: e.claim.currentStatus,
        events: [],
      };
      byClaim.set(e.claimId, entry);
    }
    entry.events.push({
      eventType: e.triggeredBy,
      createdAt: e.createdAt.toISOString(),
    });
  }

  const claims = Array.from(byClaim.values()).slice(0, MAX_CLAIMS);
  return NextResponse.json({ claims });
}
