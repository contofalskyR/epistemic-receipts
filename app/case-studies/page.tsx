import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FEATURED_TRAJECTORIES } from "@/lib/featured-trajectories";

export const revalidate = 3600; // ISR: rebuild at most once per hour (was 86400 — caused stale empty page after fix deploy)

export const metadata: Metadata = {
  title: "Case Studies — Epistemic Receipts",
  description:
    "Curated investigations into how specific claims were made, contested, settled, or reversed — from Korematsu to Pluto to the lab-leak debate. Each case traces the full epistemic arc.",
};

const AXIS_STYLE: Record<string, { label: string; color: string }> = {
  SETTLED:       { label: "Settled",       color: "text-emerald-400" },
  CONTESTED:     { label: "Contested",     color: "text-amber-400" },
  REVERSED:      { label: "Reversed",      color: "text-rose-400" },
  ABANDONED:     { label: "Abandoned",     color: "text-gray-500" },
  OPEN:          { label: "Open",          color: "text-sky-400" },
  UNRESOLVABLE:  { label: "Unresolvable",  color: "text-violet-400" },
  RECORDED:      { label: "Recorded",      color: "text-gray-400" },
};

function axisStyle(axis: string | undefined) {
  return AXIS_STYLE[axis ?? ""] ?? { label: axis ?? "Unknown", color: "text-gray-400" };
}

// Curated metadata keyed by trajectory id (from featured-trajectories.ts)
const FEATURED_BY_ID = Object.fromEntries(
  FEATURED_TRAJECTORIES.map((ft) => [ft.id, ft]),
);

type CaseStudy = {
  id: string;         // trajectory slug, e.g. "semaglutide-glp1"
  claimText: string;
  hook: string;       // one-liner from FEATURED_TRAJECTORIES or derived from claim text
  eyebrow: string;
  finalAxis: string | undefined;
  transitionCount: number;
  emergedYear: number | null;
};

async function getCaseStudies(): Promise<CaseStudy[]> {
  const rows = await prisma.claim.findMany({
    where: {
      deleted: false,
      // NOTE: no ingestedBy filter. Curated trajectories carry their seed
      // pipeline's tag (seed:human-history-trajectories, seed:medicine-trajectories,
      // …), not "manual" — the old ingestedBy:"manual" filter matched zero rows and
      // rendered this page empty in production (AUDIT-PRELAUNCH-2026-07-06 §1).
      // The trajectory: externalId prefix is the discriminator, same as sitemap.ts.
      externalId: { startsWith: "trajectory:" },
      OR: [
        { verificationStatus: null },
        { verificationStatus: { not: "DEPRECATED" } },
      ],
    },
    select: {
      externalId: true,
      text: true,
      claimEmergedAt: true,
      statusHistory: {
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
        select: { toAxis: true },
      },
    },
  });

  const all = rows.map((row) => {
    const trajectoryId = row.externalId!.replace(/^trajectory:/, "");
    const featured = FEATURED_BY_ID[trajectoryId];
    const axes = row.statusHistory.map((s) => s.toAxis);
    return {
      id: trajectoryId,
      claimText: row.text,
      hook: featured?.hook ?? row.text,
      eyebrow: featured?.eyebrow ?? "CASE STUDY",
      finalAxis: axes.at(-1),
      transitionCount: axes.length,
      hasReversal: axes.includes("REVERSED"),
      isFeatured: !!featured,
      emergedYear: row.claimEmergedAt
        ? new Date(row.claimEmergedAt).getUTCFullYear()
        : null,
    };
  });

  // /case-studies is a CURATED landing page, not the full trajectory list
  // (the footer links /settling-curve for all 5.5k). Showing every trajectory
  // here would duplicate that page and bury the marquee arcs. Editorial bar:
  //   1. hand-featured trajectories (real hooks) always in, in curation order;
  //   2. then the richest arcs — reversals and multi-transition (≥3) stories;
  //   3. capped, strongest first. (AUDIT-PRELAUNCH-2026-07-06 §1/§6.)
  const featuredRank = (id: string) => {
    const i = FEATURED_TRAJECTORIES.findIndex((ft) => ft.id === id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const MAX = 60;
  const studies = all
    .filter((s) => s.isFeatured || s.hasReversal || s.transitionCount >= 3)
    .sort(
      (a, b) =>
        featuredRank(a.id) - featuredRank(b.id) || // curated first
        Number(b.hasReversal) - Number(a.hasReversal) || // reversals next
        b.transitionCount - a.transitionCount || // richest arcs
        (a.emergedYear ?? 9999) - (b.emergedYear ?? 9999),
    )
    .slice(0, MAX);
  return studies;
}

export default async function CaseStudiesPage() {
  const studies = await getCaseStudies();

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
      {/* Header */}
      <header className="space-y-3">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">
          Curated investigations
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
          Case Studies
        </h1>
        <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
          Each entry traces how a specific claim moved through expert literature, institutions,
          courts, and public consensus — milestone by milestone, source by source.
        </p>
      </header>

      {/* List */}
      {studies.length === 0 ? (
        <p className="text-gray-500 text-sm">No case studies found.</p>
      ) : (
        <ul className="space-y-4">
          {studies.map((cs) => {
            const axis = axisStyle(cs.finalAxis);
            return (
              <li key={cs.id}>
                <Link
                  href={`/settling-curve/${cs.id}`}
                  className="group flex flex-col sm:flex-row sm:items-start gap-4 rounded-xl bg-gray-900/70 border border-gray-800 hover:border-gray-600 px-5 py-5 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500">
                      {cs.eyebrow}
                    </span>
                    <p className="text-white font-semibold text-base leading-snug group-hover:text-amber-300 transition-colors">
                      {cs.hook}
                    </p>
                    {cs.hook !== cs.claimText && (
                      <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">
                        {cs.claimText}
                      </p>
                    )}
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1.5 shrink-0 pt-0.5">
                    <span className={`text-xs font-semibold ${axis.color}`}>
                      {axis.label}
                    </span>
                    <span className="text-xs text-gray-600">
                      {cs.transitionCount} transition{cs.transitionCount !== 1 ? "s" : ""}
                    </span>
                    {cs.emergedYear !== null && (
                      <span className="text-xs text-gray-600">{cs.emergedYear}</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer nav */}
      <footer className="pt-4 border-t border-gray-800 flex gap-6 text-sm text-gray-500">
        <Link href="/settling-curve" className="hover:text-amber-400 transition-colors">
          Browse all trajectories →
        </Link>
        <Link href="/topics" className="hover:text-amber-400 transition-colors">
          Topic index →
        </Link>
      </footer>
    </div>
  );
}
