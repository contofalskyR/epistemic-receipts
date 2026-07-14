import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AXIS_COLOR, AXIS_LABEL } from "@/lib/status";

// cuid v1: 'c' + 24 lowercase alphanumeric chars
const CUID_RE = /^c[a-z0-9]{24}$/;

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Approximate text width for shields geometry (11px DejaVu Sans metrics)
function textWidth(s: string): number {
  // Average char width ~6.7px at 11px; uppercase slightly wider
  const widths: Record<string, number> = { W: 9, M: 9, m: 8, w: 8, I: 4, i: 4, l: 4, f: 5, r: 5, t: 5 };
  let w = 0;
  for (const c of s) w += widths[c] ?? 7;
  return Math.round(w);
}

function cellWidth(text: string): number {
  return textWidth(text) + 18; // 9px padding each side
}

function makeBadge(label: string, value: string, fillColor: string): string {
  const lw = cellWidth(label);
  const rw = cellWidth(value);
  const totalW = lw + rw;
  const h = 20;
  const lx = Math.round(lw / 2);
  const rx = lw + Math.round(rw / 2);
  const ty = 14; // text baseline

  const labelSafe = escXml(label);
  const valueSafe = escXml(value);
  const fillSafe = escXml(fillColor);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalW}" height="${h}" role="img" aria-label="${labelSafe}: ${valueSafe}">
<title>${labelSafe}: ${valueSafe}</title>
<linearGradient id="s" x2="0" y2="100%">
  <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
  <stop offset="1" stop-opacity=".1"/>
</linearGradient>
<clipPath id="r"><rect width="${totalW}" height="${h}" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)">
  <rect width="${lw}" height="${h}" fill="#555"/>
  <rect x="${lw}" width="${rw}" height="${h}" fill="${fillSafe}"/>
  <rect width="${totalW}" height="${h}" fill="url(#s)"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
  <text x="${lx}" y="${ty}" fill="#010101" fill-opacity=".3">${labelSafe}</text>
  <text x="${lx}" y="${ty - 1}">${labelSafe}</text>
  <text x="${rx}" y="${ty}" fill="#010101" fill-opacity=".3">${valueSafe}</text>
  <text x="${rx}" y="${ty - 1}">${valueSafe}</text>
</g>
</svg>`;
}

function unknownBadge(): string {
  return makeBadge("epistemic status", "unknown", "#9ca3af");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!CUID_RE.test(id)) {
    return new NextResponse(unknownBadge(), {
      status: 404,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      },
    });
  }

  let claim: {
    epistemicAxis: string | null;
    deleted: boolean;
    verificationStatus: string | null;
    statusHistory: { occurredAt: Date }[];
  } | null = null;

  try {
    claim = await prisma.claim.findUnique({
      where: { id },
      select: {
        epistemicAxis: true,
        deleted: true,
        verificationStatus: true,
        statusHistory: {
          orderBy: [{ seq: "asc" }, { occurredAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { occurredAt: true },
        },
      },
    });
  } catch {
    return new NextResponse(unknownBadge(), {
      status: 500,
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
    });
  }

  if (
    !claim ||
    claim.deleted ||
    claim.verificationStatus === "DEPRECATED"
  ) {
    return new NextResponse(unknownBadge(), {
      status: 404,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      },
    });
  }

  const axis = claim.epistemicAxis ?? "RECORDED";
  const latestAt = claim.statusHistory[0]?.occurredAt;
  const year = latestAt ? String(latestAt.getUTCFullYear()) : null;

  const label = AXIS_LABEL[axis] ?? axis;
  const value = year ? `${label} · ${year}` : label;
  const fill = AXIS_COLOR[axis] ?? "#94a3b8";

  const svg = makeBadge("epistemic status", value, fill);

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
