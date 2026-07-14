import type { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyShape, SHAPE_DESCRIPTIONS, SHAPE_LABELS, type CurveShape } from "@/lib/curve-shapes";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Patterns of Settling — Epistemic Receipts",
  description:
    "The six shapes that multi-step epistemic curves take: monotone settle, contested then settled, settle then reverse, flip-flop, abandoned, and other. Live counts from the corpus.",
  openGraph: {
    title: "Patterns of Settling — Epistemic Receipts",
    description:
      "How claims move through their epistemic arcs: six curve shapes, their counts, and exemplars from the corpus.",
    url: "/patterns",
    siteName: "Epistemic Receipts",
  },
};

// A curated set of exemplar slugs per shape, verified to exist in DOMAIN_TRAJECTORIES.
// Only slugs in DOMAIN_TRAJECTORIES resolve via the trajectory UI.
// If shape-specific curation is sparse, the page falls back to pipeline claims.
const CURATED_EXEMPLARS: Partial<Record<CurveShape, string[]>> = {
  "contested-then-settled": [
    "smoking-lung-cancer",       // CONTESTED for decades → SETTLED 1998
    "continental-drift",         // CONTESTED → SETTLED (Wegener vindicated)
    "hpylori-ulcers",            // CONTESTED → SETTLED (Marshall/Warren)
  ],
  "settle-then-reverse": [
    "oxycontin-reduced-abuse-liability-1995", // SETTLED → REVERSED (FDA relabel)
  ],
  "monotone-settle": [
    "civil-rights-act-1964",     // RECORDED → SETTLED without documented dispute
    "pluto-discovery-1930",      // RECORDED → SETTLED (Pluto classified, though later reclassified)
  ],
};

// ─── Shapes census ────────────────────────────────────────────────────────────

type ShapeRow = {
  claimId: string;
  axes: string; // comma-joined toAxis values in seq/date order
};

type ExemplarRow = {
  claimId: string;
  text: string;
  externalId: string | null;
};

async function getShapesCensus(): Promise<{
  counts: Record<CurveShape, number>;
  total: number;
  exemplars: Record<CurveShape, ExemplarRow[]>;
}> {
  // Load all multi-step claims' toAxis sequences in one query.
  // Multi-step = ≥2 ClaimStatusHistory rows.
  const rows = await prisma.$queryRaw<ShapeRow[]>(
    Prisma.sql`
      SELECT
        csh."claimId",
        string_agg(csh."toAxis", ',' ORDER BY csh.seq ASC NULLS LAST, csh."occurredAt" ASC, csh."createdAt" ASC) AS axes
      FROM "ClaimStatusHistory" csh
      JOIN "Claim" c ON c.id = csh."claimId"
      WHERE c.deleted = false
        AND (c."verificationStatus" IS NULL OR c."verificationStatus" != 'DEPRECATED')
      GROUP BY csh."claimId"
      HAVING COUNT(*) >= 2
    `
  );

  const counts: Record<CurveShape, number> = {
    "monotone-settle": 0,
    "contested-then-settled": 0,
    "settle-then-reverse": 0,
    "flip-flop": 0,
    "abandoned": 0,
    "other": 0,
  };

  // Map claimId → shape for exemplar lookup
  const shapeMap = new Map<string, CurveShape>();

  for (const row of rows) {
    const axes = row.axes ? row.axes.split(",") : [];
    const shape = classifyShape(axes);
    counts[shape]++;
    shapeMap.set(row.claimId, shape);
  }

  const total = rows.length;

  // Load exemplars: prefer curated trajectories, fill with pipeline claims
  const exemplars: Record<CurveShape, ExemplarRow[]> = {
    "monotone-settle": [],
    "contested-then-settled": [],
    "settle-then-reverse": [],
    "flip-flop": [],
    "abandoned": [],
    "other": [],
  };

  // Build reverse map: shape → claimIds (first 10 pipeline claims)
  const pipelineByShape = new Map<CurveShape, string[]>();
  for (const [claimId, shape] of shapeMap.entries()) {
    const list = pipelineByShape.get(shape) ?? [];
    if (list.length < 10) list.push(claimId);
    pipelineByShape.set(shape, list);
  }

  // For each shape, resolve curated first, then pipeline fallback
  const allShapes: CurveShape[] = [
    "monotone-settle",
    "contested-then-settled",
    "settle-then-reverse",
    "flip-flop",
    "abandoned",
    "other",
  ];

  for (const shape of allShapes) {
    const curatedSlugs = CURATED_EXEMPLARS[shape] ?? [];
    const curatedRows: ExemplarRow[] = [];

    if (curatedSlugs.length > 0) {
      const externalIds = curatedSlugs.map((s) => `trajectory:${s}`);
      const dbRows = await prisma.claim.findMany({
        where: {
          externalId: { in: externalIds },
          deleted: false,
        },
        select: { id: true, text: true, externalId: true },
        take: 3,
      });
      // Preserve curated order
      for (const slug of curatedSlugs) {
        const r = dbRows.find((d) => d.externalId === `trajectory:${slug}`);
        if (r) curatedRows.push({ claimId: r.id, text: r.text, externalId: r.externalId });
        if (curatedRows.length >= 3) break;
      }
    }

    if (curatedRows.length >= 3) {
      exemplars[shape] = curatedRows;
      continue;
    }

    // Fall back to pipeline claims for this shape
    const fallbackIds = pipelineByShape.get(shape) ?? [];
    if (fallbackIds.length === 0) {
      exemplars[shape] = curatedRows;
      continue;
    }

    const need = 3 - curatedRows.length;
    const pipelineRows = await prisma.claim.findMany({
      where: {
        id: { in: fallbackIds },
        deleted: false,
      },
      select: { id: true, text: true, externalId: true },
      take: need,
    });

    exemplars[shape] = [
      ...curatedRows,
      ...pipelineRows.map((r) => ({ claimId: r.id, text: r.text, externalId: r.externalId })),
    ];
  }

  return { counts, total, exemplars };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ExemplarRail({ claimId, text, externalId }: ExemplarRow) {
  const slug = externalId?.startsWith("trajectory:")
    ? externalId.replace(/^trajectory:/, "")
    : null;
  const href = slug ? `/settling-curve/${slug}` : `/claims/${claimId}`;
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded bg-gray-900/60 hover:bg-gray-800 transition-colors text-xs text-gray-400 hover:text-gray-200 leading-snug"
    >
      {text.length > 140 ? text.slice(0, 137) + "…" : text}
    </Link>
  );
}

const SHAPE_ORDER: CurveShape[] = [
  "monotone-settle",
  "contested-then-settled",
  "settle-then-reverse",
  "flip-flop",
  "abandoned",
  "other",
];

const SHAPE_FILTER_HINT: Record<CurveShape, string> = {
  "monotone-settle": "settled",
  "contested-then-settled": "contested",
  "settle-then-reverse": "reversed",
  "flip-flop": "",
  "abandoned": "abandoned",
  "other": "",
};

export default async function PatternsPage() {
  const { counts, total, exemplars } = await getShapesCensus();

  const reconciliationSum = SHAPE_ORDER.reduce((acc, s) => acc + counts[s], 0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-14">
      <header className="space-y-3">
        <p className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
          Patterns
        </p>
        <h1 className="text-3xl font-bold text-white leading-tight">
          The shapes of settling
        </h1>
        <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
          Every multi-step claim in this corpus follows one of six patterns.
          The classification is mechanical — it reads the ordered axis sequence
          of each claim&apos;s transitions and assigns exactly one shape.
          No editorial judgment, no sampling.
        </p>
        <p className="text-xs font-mono text-gray-600 border border-gray-800 rounded px-3 py-2 mt-2 inline-block">
          {SHAPE_ORDER.map((s) => counts[s].toLocaleString()).join(" + ")}{" = "}
          <span className="text-gray-400">{reconciliationSum.toLocaleString()}</span>
          {" multi-step claims"}
          {reconciliationSum !== total && (
            <span className="text-red-400 ml-2">
              ⚠ partition error: expected {total.toLocaleString()}, got {reconciliationSum.toLocaleString()}
            </span>
          )}
        </p>
        <p className="text-xs text-gray-600">
          Multi-step = ≥2 recorded axis transitions. Single-transition claims are excluded
          (they have no directional arc to classify).{" "}
          <Link href="/settling-curve" className="text-gray-500 hover:text-gray-300 underline underline-offset-2">
            Explore all trajectories →
          </Link>
        </p>
      </header>

      <div className="space-y-10">
        {SHAPE_ORDER.map((shape) => {
          const filterHint = SHAPE_FILTER_HINT[shape];
          const exploreHref = filterHint
            ? `/settling-curve?axis=${filterHint}`
            : `/settling-curve`;
          return (
            <section key={shape} className="space-y-4">
              <div className="flex items-baseline gap-4">
                <h2 className="text-lg font-semibold text-white capitalize">
                  {SHAPE_LABELS[shape]}
                </h2>
                <span className="font-mono text-sm text-amber-400">
                  {counts[shape].toLocaleString()}
                </span>
                <span className="text-xs text-gray-600">
                  {total > 0
                    ? `(${((counts[shape] / total) * 100).toFixed(1)}%)`
                    : ""}
                </span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
                {SHAPE_DESCRIPTIONS[shape]}
              </p>
              {exemplars[shape].length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-gray-600 font-mono mb-2">
                    Exemplars
                  </p>
                  {exemplars[shape].map((ex) => (
                    <ExemplarRail key={ex.claimId} {...ex} />
                  ))}
                </div>
              )}
              {counts[shape] > 0 && (
                <Link
                  href={exploreHref}
                  className="inline-block text-xs text-gray-600 hover:text-gray-400 underline underline-offset-2 transition-colors"
                >
                  Explore in trajectory browser →
                </Link>
              )}
            </section>
          );
        })}
      </div>

      <footer className="border-t border-gray-800 pt-6 space-y-1 text-xs text-gray-600">
        <p>
          Shape classification is computed from ordered{" "}
          <code className="text-gray-500">toAxis</code> sequences in{" "}
          <code className="text-gray-500">ClaimStatusHistory</code>. Direction semantics follow
          the axis ordinal: RECORDED(1) → OPEN(2) → CONTESTED(3) → SETTLED(4); REVERSED,
          ABANDONED, and UNRESOLVABLE are terminal exits.
        </p>
        <p>
          Source:{" "}
          <Link href="/methodology" className="hover:text-gray-400 underline underline-offset-2">
            Methodology
          </Link>{" "}
          ·{" "}
          <Link href="/communities" className="hover:text-gray-400 underline underline-offset-2">
            Ratifying communities
          </Link>{" "}
          ·{" "}
          <Link href="/split-ledger" className="hover:text-gray-400 underline underline-offset-2">
            Split ledger
          </Link>
        </p>
      </footer>
    </div>
  );
}
