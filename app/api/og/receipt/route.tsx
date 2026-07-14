import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  OG_WIDTH as W,
  OG_HEIGHT as H,
  OG_CACHE_CONTROL,
  AXIS_COLOR,
  FallbackCard,
} from "@/lib/og-shared";

export const runtime = "nodejs";

const HEADERS = { "Cache-Control": OG_CACHE_CONTROL };

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function axisLabel(axis: string): string {
  const MAP: Record<string, string> = {
    RECORDED: "Recorded",
    SETTLED: "Settled",
    CONTESTED: "Contested",
    REVERSED: "Reversed",
    OPEN: "Open",
    UNRESOLVABLE: "Unresolvable",
    ABANDONED: "Abandoned",
  };
  return MAP[axis] ?? axis;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ImageResponse(<FallbackCard />, { width: W, height: H, headers: HEADERS });
  }

  let csh: {
    fromAxis: string | null;
    toAxis: string;
    community: string;
    occurredAt: Date;
    datePrecision: string | null;
    claim: { text: string };
  } | null = null;

  try {
    csh = await prisma.claimStatusHistory.findUnique({
      where: { id },
      select: {
        fromAxis: true,
        toAxis: true,
        community: true,
        occurredAt: true,
        datePrecision: true,
        claim: { select: { text: true } },
      },
    });
  } catch {
    // DB unavailable
  }

  if (!csh) {
    return new ImageResponse(<FallbackCard />, { width: W, height: H, headers: HEADERS });
  }

  const fromColor = csh.fromAxis ? (AXIS_COLOR[csh.fromAxis] ?? "#94a3b8") : null;
  const toColor = AXIS_COLOR[csh.toAxis] ?? "#94a3b8";
  const year = String(csh.occurredAt.getUTCFullYear());
  const community = csh.community.replace(/_/g, " ").toLowerCase();

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: W,
        height: H,
        background: "#08080f",
        padding: "60px 72px",
        fontFamily: "monospace",
      }}
    >
      {/* Top label */}
      <span style={{ fontSize: 12, color: "#d4a853", letterSpacing: "0.18em", textTransform: "uppercase" }}>
        EPISTEMIC RECEIPT
      </span>

      {/* Transition arrow */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 28 }}>
        {csh.fromAxis ? (
          <>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: fromColor ?? "#94a3b8",
                background: `${fromColor ?? "#94a3b8"}22`,
                padding: "6px 16px",
                borderRadius: 6,
              }}
            >
              {axisLabel(csh.fromAxis)}
            </span>
            <span style={{ fontSize: 28, color: "#4b5563" }}>→</span>
          </>
        ) : (
          <span style={{ fontSize: 16, color: "#6b7280", background: "#1f2937", padding: "6px 12px", borderRadius: 6 }}>
            initial
          </span>
        )}
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: toColor,
            background: `${toColor}22`,
            padding: "6px 16px",
            borderRadius: 6,
          }}
        >
          {axisLabel(csh.toAxis)}
        </span>
        <span style={{ fontSize: 16, color: "#6b7280", marginLeft: 12 }}>{year}</span>
      </div>

      {/* Claim text */}
      <p
        style={{
          fontSize: 20,
          color: "#e9e9f2",
          lineHeight: 1.45,
          marginTop: 28,
          flex: 1,
          overflow: "hidden",
        }}
      >
        {truncate(csh.claim.text, 200)}
      </p>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 36 }}>
        <span style={{ fontSize: 13, color: "#55556e", letterSpacing: "0.08em" }}>
          {community} community
        </span>
        <span style={{ fontSize: 13, color: "#55556e", letterSpacing: "0.08em" }}>
          epistemic-receipts.vercel.app
        </span>
      </div>
    </div>,
    { width: W, height: H, headers: HEADERS }
  );
}
