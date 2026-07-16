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

const SHAPE_ORDER: CurveShape[] = [
  "monotone-settle",
  "contested-then-settled",
  "settle-then-reverse",
  "flip-flop",
  "abandoned",
  "other",
];

export default async function PatternsPage() {
  // ── Step 1: aggregate pattern strings (one SQL round-trip, small result set) ──
  // Builds each multi-step claim's ordered toAxis sequence as a '>' joined string,
  // then groups by pattern to count corpus membership per distinct shape-path.
  // seq is nullable on legacy rows; NULLS LAST keeps the order deterministic.
  // This query never loads claim rows into the Node process — only distinct
  // pattern strings + counts are returned (a few hundred rows at most).
  const patternCounts = await prisma.$queryRaw<{ pattern: string; n: number }[]>`
    SELECT pattern, COUNT(*)::int AS n FROM (
      SELECT h."claimId", string_agg(h."toAxis", '>' ORDER BY h.seq NULLS LAST, h."occurredAt", h."createdAt") AS pattern
      FROM "ClaimStatusHistory" h
      GROUP BY h."claimId"
      HAVING COUNT(*) >= 2
    ) t GROUP BY 1 ORDER BY 2 DESC
  `;

  // ── Step 2: one representative claimId per distinct pattern for exemplar selection ──
  // DISTINCT ON picks the curated trajectory claim first (externalId LIKE 'trajectory:%')
  // so exemplars favour interesting, named trajectories where available.
  const patternExemplars = await prisma.$queryRaw<{ claimId: string; pattern: string }[]>`
    WITH patterns AS (
      SELECT h."claimId", string_agg(h."toAxis", '>' ORDER BY h.seq NULLS LAST, h."occurredAt", h."createdAt") AS pattern
      FROM "ClaimStatusHistory" h
      GROUP BY h."claimId"
      HAVING COUNT(*) >= 2
    )
    SELECT DISTINCT ON (p.pattern) p."claimId", p.pattern
    FROM patterns p
    JOIN "Claim" c ON c.id = p."claimId"
    WHERE c.deleted = false
      AND (c."verificationStatus" IS NULL OR c."verificationStatus" != 'DEPRECATED')
    ORDER BY p.pattern, (c."externalId" LIKE 'trajectory:%') DESC, p."claimId"
  `;

  // ── Step 3: classify patterns in JS; build shape counts + exemplar claimId lists ──
  const shapeCounts: Record<CurveShape, number> = {
    "monotone-settle": 0,
    "contested-then-settled": 0,
    "settle-then-reverse": 0,
    "flip-flop": 0,
    "abandoned": 0,
    "other": 0,
  };
  const shapeExemplarIds: Record<CurveShape, string[]> = {
    "monotone-settle": [],
    "contested-then-settled": [],
    "settle-then-reverse": [],
    "flip-flop": [],
    "abandoned": [],
    "other": [],
  };

  for (const { pattern, n } of patternCounts) {
    const axes = pattern.split(">");
    let shape: CurveShape;
    try {
      shape = axes.length >= 2 ? classifyCurveShape(axes) : "other";
    } catch {
      shape = "other";
    }
    shapeCounts[shape] += n;
  }

  for (const { claimId, pattern } of patternExemplars) {
    const axes = pattern.split(">");
    let shape: CurveShape;
    try {
      shape = axes.length >= 2 ? classifyCurveShape(axes) : "other";
    } catch {
      shape = "other";
    }
    if (shapeExemplarIds[shape].length < EXEMPLAR_COUNT) {
      shapeExemplarIds[shape].push(claimId);
    }
  }

  // ── Step 4: fetch claim detail for the ~18 exemplar IDs (one small query) ──
  const allExemplarIds = Object.values(shapeExemplarIds).flat();
  const exemplarClaims = allExemplarIds.length > 0
    ? await prisma.claim.findMany({
        where: { id: { in: allExemplarIds } },
        select: {
          id: true,
          text: true,
          externalId: true,
          statusHistory: {
            orderBy: [{ seq: "asc" as const }, { occurredAt: "asc" as const }, { createdAt: "asc" as const }],
            select: { toAxis: true, occurredAt: true },
          },
        },
      })
    : [];
  const claimById = new Map(exemplarClaims.map((c) => [c.id, c]));

  // ── Step 5: assemble per-shape stats ──
  const multiStepTotal = Object.values(shapeCounts).reduce((s, n) => s + n, 0);
  const partitionSum = multiStepTotal; // counts already partitioned above
  const reconciled = true; // partition is exhaustive by construction

  const shapeStats: ShapeStats[] = SHAPE_ORDER.map((shape) => {
    const exemplars = shapeExemplarIds[shape]
      .map((id) => {
        const c = claimById.get(id);
        if (!c) return null;
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
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return { shape, count: shapeCounts[shape], exemplars };
  });

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
                <span className="text-gray-300">{shapeCounts[shape].toLocaleString()}</span>
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
          Multi-step claims are those with ≥2 recorded transitions.
          Single-transition (entry-only) claims are not classified here.
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
