import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { STAT_METHODS, STAT_METHOD_BY_SLUG } from "@/lib/statMethods";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata = {
  title: "Statistics Explorer — Epistemic Receipts",
  description:
    "Browse OpenAlex-sourced claims grouped by the statistical method they use. Live counts, per-method drill-down.",
};

type MethodRow = { method: string; n: bigint };

async function loadCounts(): Promise<{
  perMethod: { slug: string; count: number; label: string; description: string }[];
  scanned: number;
  tagged: number;
}> {
  // Per-method counts (claims with at least one stat method tag).
  const rows = await prisma.$queryRaw<MethodRow[]>(Prisma.sql`
    SELECT method, COUNT(*)::bigint AS n
    FROM "Claim", jsonb_array_elements_text(metadata->'statMethods') AS method
    WHERE "ingestedBy" = 'openalex_v1' AND deleted = false
    GROUP BY method
    ORDER BY n DESC
  `);
  const scannedRows = await prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS n FROM "Claim"
    WHERE "ingestedBy" = 'openalex_v1' AND deleted = false AND metadata ? 'statMethods'
  `);
  const taggedRows = await prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS n FROM "Claim"
    WHERE "ingestedBy" = 'openalex_v1' AND deleted = false
      AND jsonb_array_length(metadata->'statMethods') > 0
  `);

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.method, Number(r.n));

  // Render every method known to the catalogue (even if count=0) so users
  // can see what's tracked, and append any DB methods not in the catalogue
  // (e.g. legacy tags) at the end.
  const known = STAT_METHODS.map(m => ({
    slug: m.slug,
    count: counts.get(m.slug) ?? 0,
    label: m.label,
    description: m.description,
  }));
  const extras = [...counts.keys()]
    .filter(slug => !STAT_METHOD_BY_SLUG[slug])
    .map(slug => ({ slug, count: counts.get(slug) ?? 0, label: slug, description: "" }));

  return {
    perMethod: [...known, ...extras].sort((a, b) => b.count - a.count),
    scanned: scannedRows[0]?.n ? Number(scannedRows[0].n) : 0,
    tagged: taggedRows[0]?.n ? Number(taggedRows[0].n) : 0,
  };
}

export default async function StatisticsExplorerPage() {
  const { perMethod, scanned, tagged } = await loadCounts();
  const withClaims = perMethod.filter(m => m.count > 0);
  const emptyMethods = perMethod.filter(m => m.count === 0);

  const totalAssignments = perMethod.reduce((s, m) => s + m.count, 0);

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <p className="text-xs font-mono text-gray-500 mb-2">
          <Link href="/statistics" className="hover:text-gray-300">statistics</Link>
          <span> / </span>
          <span className="text-gray-300">explorer</span>
        </p>
        <h1 className="text-2xl font-semibold text-white">Statistics — Claim Explorer</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A claim-powered companion to the{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">
            statistics taxonomy
          </Link>
          . Each tile is a statistical method. The count is the number of OpenAlex-sourced
          claims whose title or abstract mentions that method&apos;s vocabulary. Click into a
          method to see the actual receipts.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Detection is regex over title + abstract — fast and conservative, not semantic.
          A claim is tagged with a method only if its text contains a vocabulary hit
          (e.g. <code className="font-mono text-gray-400">&quot;Cox proportional hazards&quot;</code>{" "}
          for <em>survival-analysis</em>). False negatives outnumber false positives.
          See the explorer footer for the enrichment-run command.
        </p>
        <p className="mt-3 text-xs font-mono text-gray-600">
          {scanned.toLocaleString()} OpenAlex claims scanned · {tagged.toLocaleString()} tagged
          with ≥1 method · {totalAssignments.toLocaleString()} total method assignments
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Methods with claims
        </h2>
        {withClaims.length === 0 ? (
          <p className="text-sm text-gray-500">
            No methods have tagged claims yet. Run{" "}
            <code className="font-mono text-gray-400">
              npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-stat-methods.ts --commit --limit 5000
            </code>{" "}
            to seed.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {withClaims.map(m => (
              <Link
                key={m.slug}
                href={`/statistics/explorer/${m.slug}`}
                className="block rounded border border-gray-800 hover:border-gray-600 bg-gray-900/40 px-4 py-3 transition-colors group"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white group-hover:text-gray-100">
                    {m.label}
                  </h3>
                  <span className="text-xs font-mono text-blue-300 group-hover:text-blue-200">
                    {m.count.toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 leading-snug">{m.description}</p>
                <p className="mt-1 text-[10px] font-mono text-gray-700">{m.slug}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {emptyMethods.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Methods with no claims yet
          </h2>
          <p className="text-xs text-gray-600 mb-3">
            These are tracked by the detector but the seed enrichment hasn&apos;t surfaced
            matching claims. A full enrichment run over all ~212k OpenAlex claims should
            populate most of these.
          </p>
          <div className="flex flex-wrap gap-2">
            {emptyMethods.map(m => (
              <span
                key={m.slug}
                title={m.description}
                className="text-[11px] font-mono px-2 py-1 rounded bg-gray-900/40 border border-gray-800 text-gray-500"
              >
                {m.slug}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="border-t border-gray-800 pt-6 mt-12 space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Run a full enrichment:</span>{" "}
          <code className="font-mono text-gray-400">
            npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-stat-methods.ts --commit
          </code>
        </p>
        <p className="text-xs font-mono text-gray-700">
          OpenAlex-only scope · detector source:{" "}
          <code>lib/statMethods.ts</code> · enrichment seeded 2026-06-06 (5,000 claims)
        </p>
      </div>
    </div>
  );
}
