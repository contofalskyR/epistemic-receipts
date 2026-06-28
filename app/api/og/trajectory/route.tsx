import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { FEATURED_TRAJECTORIES } from "@/lib/featured-trajectories";

export const runtime = "nodejs";

const W = 1200;
const H = 630;

const AXIS_COLOR: Record<string, string> = {
  SETTLED: "#22c55e",
  CONTESTED: "#f59e0b",
  REVERSED: "#ef4444",
  RECORDED: "#94a3b8",
  OPEN: "#38bdf8",
  ABANDONED: "#6b7280",
  UNRESOLVABLE: "#a78bfa",
};

function axisColor(axis: string): string {
  return AXIS_COLOR[axis] ?? "#94a3b8";
}

// Generic fallback card
function FallbackCard() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        width: W,
        height: H,
        background: "#0a0a12",
        padding: "60px 80px",
        fontFamily: "monospace",
      }}
    >
      <span
        style={{
          fontSize: 13,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#d4a853",
          marginBottom: 24,
        }}
      >
        EPISTEMIC RECEIPT 🧾
      </span>
      <p
        style={{
          fontSize: 48,
          color: "#ffffff",
          fontWeight: 600,
          lineHeight: 1.2,
          margin: 0,
          maxWidth: 700,
        }}
      >
        Track how knowledge changes over time.
      </p>
      <p
        style={{
          position: "absolute",
          bottom: 48,
          right: 80,
          fontSize: 13,
          color: "#55556e",
          letterSpacing: "0.08em",
          margin: 0,
        }}
      >
        epistemic-receipts.com
      </p>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ImageResponse(<FallbackCard />, { width: W, height: H });
  }

  // Look up featured trajectory for hook + eyebrow
  const featured = FEATURED_TRAJECTORIES.find((t) => t.id === id) ?? null;

  // Fetch from DB
  type StatusHistoryEntry = { toAxis: string; occurredAt: Date };
  let claimText: string | null = null;
  let statusHistory: StatusHistoryEntry[] = [];

  try {
    const row = await prisma.claim.findFirst({
      where: { externalId: `trajectory:${id}`, deleted: false },
      select: {
        text: true,
        statusHistory: {
          orderBy: { occurredAt: "asc" },
          select: { toAxis: true, occurredAt: true },
        },
      },
    });
    if (row) {
      claimText = row.text;
      statusHistory = row.statusHistory as StatusHistoryEntry[];
    }
  } catch {
    // DB unavailable — use featured fallback milestones
  }

  // Fall back to featured milestones if DB returned nothing
  if (statusHistory.length === 0 && featured) {
    statusHistory = featured.milestones.map((m) => ({
      toAxis: m.axis,
      occurredAt: new Date(`${m.year}-01-01`),
    }));
  }

  if (statusHistory.length === 0 && !claimText && !featured) {
    return new ImageResponse(<FallbackCard />, { width: W, height: H });
  }

  // Derive display data
  const hook =
    featured?.hook ??
    (claimText ? claimText.slice(0, 120) + (claimText.length > 120 ? "…" : "") : "");

  const years = statusHistory.map((s) => new Date(s.occurredAt).getFullYear());
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);
  const yearSpan = firstYear === lastYear ? String(firstYear) : `${firstYear} → ${lastYear}`;
  const transitionCount = statusHistory.length;

  // Timeline dots — cap at 10 for visual cleanliness
  const dots = statusHistory.slice(0, 10);
  const dotSize = 14;
  const lineX = W - 160;
  const dotX = lineX;
  const timelineTop = 80;
  const timelineBottom = H - 80;
  const timelineHeight = timelineBottom - timelineTop;
  const dotSpacing = dots.length > 1 ? timelineHeight / (dots.length - 1) : 0;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          height: H,
          background: "#0a0a12",
          position: "relative",
          fontFamily: "monospace",
        }}
      >
        {/* Main content area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "60px 220px 60px 80px",
            flex: 1,
          }}
        >
          {/* Eyebrow */}
          <span
            style={{
              fontSize: 12,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#d4a853",
              marginBottom: 20,
            }}
          >
            EPISTEMIC RECEIPT 🧾
          </span>

          {/* Hook */}
          <p
            style={{
              fontSize: 44,
              color: "#ffffff",
              fontWeight: 600,
              lineHeight: 1.15,
              margin: 0,
              marginBottom: 28,
              maxWidth: 700,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {hook}
          </p>

          {/* Year span */}
          <span
            style={{
              fontSize: 22,
              color: "#d4a853",
              letterSpacing: "0.1em",
              marginBottom: 10,
            }}
          >
            {yearSpan}
          </span>

          {/* Transition count */}
          <span
            style={{
              fontSize: 14,
              color: "#55556e",
              letterSpacing: "0.08em",
            }}
          >
            {transitionCount} transition{transitionCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Bottom-right watermark */}
        <span
          style={{
            position: "absolute",
            bottom: 48,
            right: 48,
            fontSize: 12,
            color: "#3a3a55",
            letterSpacing: "0.1em",
          }}
        >
          epistemic-receipts.com
        </span>

        {/* Timeline visualization (right side) */}
        <div
          style={{
            position: "absolute",
            right: 80,
            top: 0,
            width: 80,
            height: H,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Vertical connecting line */}
          <div
            style={{
              position: "absolute",
              left: dotX - 80 + 40 - 1,
              top: timelineTop + dotSize / 2,
              width: 2,
              height: timelineHeight - dotSize,
              background: "#1e1e2e",
            }}
          />

          {/* Dots */}
          {dots.map((dot, i) => {
            const topOffset = timelineTop + (dots.length > 1 ? i * dotSpacing : timelineHeight / 2);
            const dotYear = new Date(dot.occurredAt).getFullYear();
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 40 - dotSize / 2,
                  top: topOffset,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: dotSize,
                    height: dotSize,
                    borderRadius: "50%",
                    background: axisColor(dot.toAxis),
                    boxShadow: `0 0 6px ${axisColor(dot.toAxis)}88`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: "#3a3a55",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {dotYear}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
