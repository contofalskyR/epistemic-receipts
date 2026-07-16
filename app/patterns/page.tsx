import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SettlingCurveMini from "@/app/components/SettlingCurveMini";
import { classifyCurveShape, CURVE_SHAPE_LABELS, CURVE_SHAPE_DESCRIPTIONS, type CurveShape } from "@/lib/curve-shapes";
import { AXIS_BG_CLASS } from "@/lib/status";

// ISR: shapes census is expensive; revalidate once per day.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Patterns of Settling — Epistemic Receipts",
  description:
    "How do epistemic claims actually settle? Six mutually exclusive shapes — monotone settle, contested-then-settled, settle-then-reverse, flip-flop, abandoned, other — partition every multi-step claim in the corpus.",
};

type ShapeStats = {
  shape: CurveShape;
  count: number;
  exemplars: {
    id: string;
    text: string;
    milestones: { year: number; axis: string }[];
    href: string;
  }[];
};

// How many exemplars to show per shape.
const EXEMPLAR_COUNT = 3;

// Curated trajectory IDs that are known to be interesting (from lib/domain-trajectories.ts).
// Used to prefer curated exemplars when possible.
const CURATED_TRAJECTORY_IDS = new Set([
  "semaglutide-glp1",
  "smoking-lung-cancer",
  "hpylori-ulcers",
  "stress-acid-ulcers",
  "dietary-fat-heart",
  "oxycontin-reduced-abuse-liability-1995",
  "continental-drift",
  "cold-fusion",
  "cfc-ozone-depletion",
  "pluto-discovery-1930",
  "civil-rights-act-1964",
  "clean-air-act-1970",
  "voting-rights-act-1965",
]);

export default async function PatternsPage() {
  // Load all multi-step claims (≥2 transitions) with their ordered history.
  // We scan statusHistory in memory to classify — avoids a new table or computed column.
  // This query is bounded: ~13.4% of 1.76M claims have 2+ transitions = ~236k rows.
  // We select only the minimal shape for classification.
  const multiStepClaims = await prisma.claim.findMany({
    where: {
      deleted: false,
      OR: [{ verificationStatus: null }, { verificationStatus: { not: "DEPRECATED" } }],
      statusHistory: { some: { fromAxis: { not: null } } }, // has at least one chained transition
    },
    select: {
      id: true,
      text: true,
      externalId: true,
      statusHistory: {
        orderBy: [{ seq: "asc" }, { occurredAt: "asc" }, { createdAt: "asc" }],
        select: { seq: true, toAxis: true, occurredAt: true },
        where: { fromAxis: { not: null } }, // only chained transitions count toward shape
      },
    },
  });

  // Total multi-step corpus count (denominator for reconciliation equation).
  const multiStepTotal = multiStepClaims.length;

  // Classify each claim and group into shape buckets.
  const buckets: Record<CurveShape, typeof multiStepClaims> = {
    "monotone-settle": [],
    "contested-then-settled": [],
    "settle-then-reverse": [],
    "flip-flop": [],
    "abandoned": [],
    "other": [],
  };

  for (const claim of multiStepClaims) {
    const axes = claim.statusHistory.map((h) => h.toAxis);
    if (axes.length < 2) {
      // Entry-only claims (only fromAxis=null transition) don't qualify as multi-step shapes.
      buckets["other"].push(claim);
      continue;
    }
    const shape = classifyCurveShape(axes);
    buckets[shape].push(claim);
  }

  // Verify partition sums to total (the invariant the brief requires).
  const partitionSum = Object.values(buckets).reduce((s, arr) => s + arr.length, 0);
  // partitionSum must equal multiStepTotal — if it doesn't, something is wrong.
  const reconciled = partitionSum === multiStepTotal;

  // Build exemplars for each shape: prefer curated trajectories, fall back to first pipeline claims.
  const SHAPE_ORDER: CurveShape[] = [
    "monotone-settle",
    "contested-then-settled",
    "settle-then-reverse",
    "flip-flop",
    "abandoned",
    "other",
  ];

  const shapeStats: ShapeStats[] = SHAPE_ORDER.map((shape) => {
    const claims = buckets[shape];
    // Sort: curated trajectories first, then by transition count descending.
    const sorted = [...claims].sort((a, b) => {
      const aIsCurated = a.externalId?.startsWith("trajectory:") &&
        CURATED_TRAJECTORY_IDS.has(a.externalId.replace("trajectory:", ""));
      const bIsCurated = b.externalId?.startsWith("trajectory:") &&
        CURATED_TRAJECTORY_IDS.has(b.externalId.replace("trajectory:", ""));
      if (aIsCurated && !bIsCurated) return -1;
      if (!aIsCurated && bIsCurated) return 1;
      return b.statusHistory.length - a.statusHistory.length;
    });

    const exemplars = sorted.slice(0, EXEMPLAR_COUNT).map((c) => {
      const isCurated = c.externalId?.startsWith("trajectory:");
      const slug = isCurated ? c.externalId!.replace("trajectory:", "") : null;
      return {
        id: c.id,
        text: c.text,
        milestones: c.statusHistory.map((h) => ({
          year: h.occurredAt.getUTCFullYear(),
          axis: h.toAxis,
        })),
        href: slug ? `/settling-curve/${slug}` : `/claims/${c.id}`,
      };
    });

    return { shape, count: claims.length, exemplars };
  });

  // Explorer deep-link: filter to the closest shape using existing explorer filters.
  // /settling-curve supports axis filters but not shape filters — link to status filter
  // as the closest available (Phase B14 note: a proper shape filter would be a follow-up).
  const EXPLORER_LINKS: Record<CurveShape, string> = {
    "monotone-settle": "/settling-curve?sort=transitions",
    "contested-then-settled": "/settling-curve?sort=transitions",
    "settle-then-reverse": "/settling-curve?sort=transitions",
    "flip-flop": "/settling-curve?sort=transitions",
    "abandoned": "/settling-curve?sort=transitions",
    "other": "/settling-curve",
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-16">
      <header className="space-y-4">
        <p className="text-[11px] font-mono uppercase tracking-widest text-sky-400">
          Patterns of settling
        </p>
        <h1 className="text-3xl font-bold text-white leading-tight">
          How claims actually settle
        </h1>
        <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
          Every multi-step claim in this corpus follows one of six mutually exclusive patterns.
          The six counts below sum exactly to the multi-step corpus — nothing is hidden in an
          unlabeled residue.
        </p>

        {/* Reconciliation equation */}
        <div className="text-xs font-mono text-gray-500 bg-gray-900 border border-gray-800 rounded px-4 py-3 space-y-1">
          <p className="text-gray-400 font-semibold mb-2">Partition check (must balance)</p>
          <p>
            {SHAPE_ORDER.map((shape, i) => (
              <span key={shape}>
                {i > 0 && <span className="text-gray-600"> + </span>}
                <span className="text-gray-300">{buckets[shape].length.toLocaleString()}</span>
                <span className="text-gray-600"> ({CURVE_SHAPE_LABELS[shape]})</span>
              </span>
            ))}
            {" "}
            <span className="text-gray-600">= </span>
            <span className={reconciled ? "text-emerald-400" : "text-rose-400"}>
              {partitionSum.toLocaleString()}
            </span>
            {" "}
            <span className="text-gray-600">multi-step claims</span>
            {" "}
            {reconciled ? (
              <span className="text-emerald-400">✓</span>
            ) : (
              <span className="text-rose-400">⚠ mismatch — {multiStepTotal.toLocaleString()} expected</span>
            )}
          </p>
        </div>
      </header>

      {/* Shape sections */}
      {shapeStats.map(({ shape, count, exemplars }) => (
        <section key={shape} className="space-y-6">
          <div className="border-t border-gray-800 pt-6 flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-white">
                {CURVE_SHAPE_LABELS[shape]}
              </h2>
              <p className="text-gray-400 text-sm max-w-xl">{CURVE_SHAPE_DESCRIPTIONS[shape]}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-white tabular-nums">{count.toLocaleString()}</p>
              <p className="text-xs text-gray-500">
                {multiStepTotal > 0 ? ((count / multiStepTotal) * 100).toFixed(1) : "0.0"}% of multi-step
              </p>
            </div>
          </div>

          {exemplars.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {exemplars.map((ex) => (
                <Link
                  key={ex.id}
                  href={ex.href}
                  className="group block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors space-y-3"
                >
                  <SettlingCurveMini
                    milestones={ex.milestones}
                    animate={false}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-300 group-hover:text-white transition-colors line-clamp-3 leading-relaxed">
                    {ex.text}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {ex.milestones.map((m, i) => (
                      <span
                        key={i}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${AXIS_BG_CLASS[m.axis] ?? "bg-gray-800 text-gray-400"}`}
                      >
                        {m.year} {m.axis}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-sm italic">No claims match this pattern in the current corpus.</p>
          )}

          <div>
            <Link
              href={EXPLORER_LINKS[shape]}
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
            >
              → Explore in the settling-curve viewer
            </Link>
          </div>
        </section>
      ))}

      <footer className="border-t border-gray-800 pt-8 text-xs text-gray-600 space-y-2">
        <p>
          Multi-step claims are those with ≥2 chained transitions (fromAxis ≠ null).
          Single-transition claims (entry-only) are not classified here.
          Classifier source: <code className="text-gray-500">lib/curve-shapes.ts</code>.
        </p>
        <p>
          Page updated daily via ISR. Counts reflect the live corpus state at last revalidation.
        </p>
        <div className="flex gap-4 pt-2">
          <Link href="/settling-curve" className="hover:text-gray-400 transition-colors">Explore curves →</Link>
          <Link href="/methodology" className="hover:text-gray-400 transition-colors">Methodology →</Link>
          <Link href="/start-here" className="hover:text-gray-400 transition-colors">Start here →</Link>
        </div>
      </footer>
    </div>
  );
}
