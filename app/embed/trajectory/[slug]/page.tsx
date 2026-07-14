import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOMAIN_TRAJECTORIES } from "@/lib/domain-trajectories";
import { getTrajectoryDetail } from "@/lib/trajectory-detail";
import SettlingCurveMini from "@/app/components/SettlingCurveMini";
import { AXIS_COLOR, AXIS_LABEL } from "@/lib/status";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

// Only slugs explicitly listed in the editorial domain-trajectories map are
// embeddable. Any other trajectory: claim gets a 404, not a data leak.
const CURATED_SLUGS = new Set(
  Object.values(DOMAIN_TRAJECTORIES).flat(),
);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ theme?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!CURATED_SLUGS.has(slug)) {
    return { robots: { index: false } };
  }
  const traj = await getTrajectoryDetail(slug);
  if (!traj) return { robots: { index: false } };

  const canonical = `${SITE_URL}/settling-curve/${slug}`;
  return {
    title: `${traj.claimText.slice(0, 80)} — Epistemic Receipts`,
    robots: { index: false, follow: false },
    alternates: { canonical },
  };
}

function fmtPrecision(iso: string, precision: string | null): string {
  const d = new Date(iso);
  if (precision === "YEAR") return String(d.getUTCFullYear());
  return String(d.getUTCFullYear());
}

export default async function EmbedTrajectoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { theme = "dark" } = await searchParams;

  if (!CURATED_SLUGS.has(slug)) notFound();

  const traj = await getTrajectoryDetail(slug);
  if (!traj) notFound();

  const isDark = theme !== "light";

  const latest = traj.transitions[traj.transitions.length - 1];
  const latestAxis = latest?.toAxis;
  const latestYear = latest?.occurredAt ? fmtPrecision(latest.occurredAt, latest.datePrecision) : null;

  const milestones = traj.transitions.map((t) => ({
    year: new Date(t.occurredAt).getUTCFullYear(),
    axis: t.toAxis,
    reason: t.reason,
  }));

  const axisHex = latestAxis ? (AXIS_COLOR[latestAxis] ?? "#94a3b8") : "#94a3b8";
  const axisLbl = latestAxis ? (AXIS_LABEL[latestAxis] ?? latestAxis) : "Unknown";
  const trajectoryUrl = `${SITE_URL}/settling-curve/${slug}`;

  const bg = isDark ? "#0a0a0a" : "#ffffff";
  const textPrimary = isDark ? "#e5e7eb" : "#111827";
  const textSub = isDark ? "#9ca3af" : "#6b7280";
  const borderCol = isDark ? "#1f2937" : "#e5e7eb";

  return (
    <div
      style={{
        background: bg,
        color: textPrimary,
        fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
        height: "200px",
        overflow: "hidden",
        padding: "10px 14px 6px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {/* Title + current axis */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <p
          style={{
            fontSize: 12,
            lineHeight: 1.4,
            flex: 1,
            color: textPrimary,
            margin: 0,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {traj.claimText}
        </p>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: axisHex,
            whiteSpace: "nowrap",
            fontFamily: "var(--font-geist-mono, ui-monospace, monospace)",
            paddingTop: 1,
          }}
        >
          {axisLbl}
          {latestYear ? ` · ${latestYear}` : ""}
        </span>
      </div>

      {/* Settling curve SVG rail */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <SettlingCurveMini milestones={milestones} animate={false} />
      </div>

      {/* Attribution footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          paddingTop: 4,
          borderTop: `1px solid ${borderCol}`,
        }}
      >
        <a
          href={trajectoryUrl}
          target="_blank"
          rel="noopener"
          style={{
            fontSize: 10,
            color: textSub,
            textDecoration: "none",
          }}
        >
          Epistemic Receipts ↗
        </a>
      </div>
    </div>
  );
}
