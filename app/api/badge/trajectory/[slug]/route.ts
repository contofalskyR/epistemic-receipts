import { NextRequest, NextResponse } from "next/server";
import { DOMAIN_TRAJECTORIES } from "@/lib/domain-trajectories";
import { getTrajectoryDetail } from "@/lib/trajectory-detail";
import { AXIS_COLOR, AXIS_LABEL } from "@/lib/status";

// Curated slugs only — same gate as /embed/trajectory/[slug]
const CURATED_SLUGS = new Set(Object.values(DOMAIN_TRAJECTORIES).flat());

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textWidth(s: string): number {
  const widths: Record<string, number> = { W: 9, M: 9, m: 8, w: 8, I: 4, i: 4, l: 4, f: 5, r: 5, t: 5 };
  let w = 0;
  for (const c of s) w += widths[c] ?? 7;
  return Math.round(w);
}

function cellWidth(text: string): number {
  return textWidth(text) + 18;
}

function makeBadge(label: string, value: string, fillColor: string): string {
  const lw = cellWidth(label);
  const rw = cellWidth(value);
  const totalW = lw + rw;
  const h = 20;
  const lx = Math.round(lw / 2);
  const rx = lw + Math.round(rw / 2);
  const ty = 14;

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
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;

  if (!CURATED_SLUGS.has(slug)) {
    return new NextResponse(unknownBadge(), {
      status: 404,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      },
    });
  }

  let traj: Awaited<ReturnType<typeof getTrajectoryDetail>> = null;
  try {
    traj = await getTrajectoryDetail(slug);
  } catch {
    return new NextResponse(unknownBadge(), {
      status: 500,
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
    });
  }

  if (!traj || traj.transitions.length === 0) {
    return new NextResponse(unknownBadge(), {
      status: 404,
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
    });
  }

  const latest = traj.transitions[traj.transitions.length - 1];
  const axis = latest.toAxis;
  const year = latest.occurredAt
    ? String(new Date(latest.occurredAt).getUTCFullYear())
    : null;

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
