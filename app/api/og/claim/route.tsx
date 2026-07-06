import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AXIS_CONFIG } from "@/components/EpistemicAxisBadge";
import {
  OG_WIDTH as W,
  OG_HEIGHT as H,
  OG_CACHE_CONTROL,
  axisColor,
  FallbackCard,
} from "@/lib/og-shared";

export const runtime = "nodejs";

const OG_HEADERS = { "Cache-Control": OG_CACHE_CONTROL };

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ImageResponse(<FallbackCard />, { width: W, height: H, headers: OG_HEADERS });
  }

  // COLD-CRAWL HOT PATH: scrapers can request this for any of ~1.76M claims.
  // One lean query; CDN caching via OG_CACHE_CONTROL absorbs repeats.
  type ClaimCard = {
    text: string;
    epistemicAxis: string | null;
    claimEmergedAt: Date | null;
    _count: { edges: number; statusHistory: number };
  };
  let claim: ClaimCard | null = null;
  try {
    claim = await prisma.claim.findUnique({
      where: { id },
      select: {
        text: true,
        epistemicAxis: true,
        claimEmergedAt: true,
        _count: {
          select: {
            edges: { where: { deleted: false } },
            statusHistory: true,
          },
        },
      },
    });
  } catch {
    // DB unavailable — fall through to the generic card
  }

  if (!claim) {
    return new ImageResponse(<FallbackCard />, { width: W, height: H, headers: OG_HEADERS });
  }

  const axis = claim.epistemicAxis;
  const axisLabel = (axis ? AXIS_CONFIG[axis]?.label : null) ?? "Unclassified";
  const color = axis ? axisColor(axis) : "#94a3b8";
  const emergedYear = claim.claimEmergedAt ? new Date(claim.claimEmergedAt).getUTCFullYear() : null;
  const sources = claim._count.edges;
  const transitions = claim._count.statusHistory;

  const metaBits = [
    emergedYear ? `emerged ${emergedYear}` : null,
    `${sources} evidence link${sources === 1 ? "" : "s"}`,
    transitions > 0 ? `${transitions} transition${transitions === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: W,
          height: H,
          background: "#0a0a12",
          position: "relative",
          padding: "60px 80px",
          fontFamily: "monospace",
        }}
      >
        {/* Left accent bar in the axis color — the claim card's signature */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 10,
            height: H,
            background: color,
          }}
        />

        {/* Eyebrow */}
        <span
          style={{
            fontSize: 12,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#d4a853",
            marginBottom: 24,
          }}
        >
          EPISTEMIC RECEIPT 🧾
        </span>

        {/* Claim text */}
        <p
          style={{
            fontSize: 40,
            color: "#ffffff",
            fontWeight: 600,
            lineHeight: 1.2,
            margin: 0,
            marginBottom: 32,
            maxWidth: 1000,
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {truncate(claim.text, 260)}
        </p>

        {/* Axis pill + meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 20,
              color,
              border: `2px solid ${color}`,
              borderRadius: 999,
              padding: "6px 20px",
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: color,
              }}
            />
            {axisLabel}
          </span>
          <span style={{ fontSize: 17, color: "#55556e", letterSpacing: "0.06em" }}>
            {metaBits.join(" · ")}
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
          epistemic-receipts.vercel.app
        </span>
      </div>
    ),
    { width: W, height: H, headers: OG_HEADERS }
  );
}
