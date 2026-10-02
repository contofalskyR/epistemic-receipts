import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { FEATURED_TRAJECTORIES } from "@/lib/featured-trajectories";
import {
  OG_WIDTH as W,
  OG_HEIGHT as H,
  OG_CACHE_CONTROL,
  CurveCard,
  FallbackCard,
  truncate,
} from "@/lib/og-shared";

// Link-preview card for /settling-curve/[id], /settling-curve?t= and the
// stories: the claim's settling curve, drawn with the same geometry as the
// page (STATUS.md Phase 5). `id` is a trajectory slug or a raw claim CUID.
export const runtime = "nodejs";

const OG_HEADERS = { "Cache-Control": OG_CACHE_CONTROL };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ImageResponse(<FallbackCard />, { width: W, height: H, headers: OG_HEADERS });
  }

  // Featured trajectories carry an owner-written hook and fallback milestones.
  const featured = FEATURED_TRAJECTORIES.find((t) => t.id === id) ?? null;

  type StatusHistoryEntry = { toAxis: string; occurredAt: Date; community: string };
  let claimText: string | null = null;
  let statusHistory: StatusHistoryEntry[] = [];

  try {
    const select = {
      text: true,
      statusHistory: {
        // Chain order (seq), date fallback for legacy rows — same as the page.
        orderBy: [{ seq: "asc" as const }, { occurredAt: "asc" as const }, { createdAt: "asc" as const }],
        select: { toAxis: true, occurredAt: true, community: true },
        take: 60,
      },
    };
    let row = await prisma.claim.findFirst({
      where: { externalId: `trajectory:${id}`, deleted: false },
      select,
    });
    // Fallback: raw CUID (corpus search results link directly by claim id)
    if (!row) {
      row = await prisma.claim.findFirst({ where: { id, deleted: false }, select });
    }
    if (row) {
      claimText = row.text;
      statusHistory = row.statusHistory;
    }
  } catch {
    // DB unavailable — use featured fallback milestones
  }

  if (statusHistory.length === 0 && featured) {
    statusHistory = featured.milestones.map((m) => ({
      toAxis: m.axis,
      occurredAt: new Date(`${m.year}-01-01`),
      community: m.community ?? "",
    }));
  }

  if (statusHistory.length === 0 && !claimText && !featured) {
    return new ImageResponse(<FallbackCard />, { width: W, height: H, headers: OG_HEADERS });
  }

  const title = truncate(featured?.hook ?? claimText ?? "", 220); // as the claim card
  const communities = new Set(statusHistory.map((s) => s.community).filter(Boolean)).size;
  const caption =
    `${statusHistory.length} transition${statusHistory.length !== 1 ? "s" : ""}` +
    (communities > 1 ? ` · ${communities} communities` : "");

  return new ImageResponse(
    (
      <CurveCard
        eyebrow="SETTLING CURVE"
        title={title}
        milestones={statusHistory.map((s) => ({ year: s.occurredAt.getUTCFullYear(), axis: s.toAxis }))}
        caption={caption}
      />
    ),
    { width: W, height: H, headers: OG_HEADERS },
  );
}
