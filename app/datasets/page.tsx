import Link from "next/link";
import { PIPELINES } from "@/lib/pipelines/registry";

export const metadata = {
  title: "Datasets — Epistemic Receipts",
  description:
    "Provenance data cards for every pipeline feeding the claim graph.",
};

export default function DatasetsPage() {
  const active = PIPELINES.filter(p => !p.retired);
  const retired = PIPELINES.filter(p => p.retired);

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      <div className="space-y-3">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">
          Datasets
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-snug">
          Pipeline data cards
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
          Every active pipeline has a data card listing the upstream source, fetch
          method, live claim counts, verification mix, and known caveats.{" "}
          <Link href="/methodology" className="text-gray-300 hover:underline underline-offset-2">
            Methodology
          </Link>{" "}
          explains how pipelines are qualified, reviewed, and retired.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Active pipelines ({active.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {active.map(p => (
            <Link
              key={p.tag}
              href={`/datasets/${p.tag}`}
              className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4 space-y-1 hover:border-gray-600 transition-colors group"
            >
              <p className="text-sm font-semibold text-white group-hover:text-gray-100 leading-snug">
                {p.name}
              </p>
              <p className="text-xs font-mono text-gray-500">{p.tag}</p>
              <div className="flex gap-3 text-xs text-gray-500 pt-1">
                <span>{p.upstreamName}</span>
                <span className="text-gray-700">·</span>
                <span className="capitalize">{p.cadence}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {retired.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Retired pipelines ({retired.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {retired.map(p => (
              <Link
                key={p.tag}
                href={`/datasets/${p.tag}`}
                className="rounded-lg border border-gray-800/50 bg-gray-900/20 px-5 py-4 space-y-1 hover:border-gray-700 transition-colors group opacity-60 hover:opacity-80"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white leading-snug">
                    {p.name}
                  </p>
                  <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border border-red-900/60 bg-red-950/40 text-red-400">
                    retired
                  </span>
                </div>
                <p className="text-xs font-mono text-gray-500">{p.tag}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="text-xs text-gray-600">
        <Link href="/api/v1/manifest" className="hover:text-gray-400 transition-colors font-mono">
          GET /api/v1/manifest
        </Link>{" "}
        — machine-readable version with live counts
      </div>
    </div>
  );
}
