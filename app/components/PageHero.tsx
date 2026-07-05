import type { ReactNode } from "react";
import Link from "next/link";

// ─── PageHero ──────────────────────────────────────────────────────────────────
// Shared hero header for analysis/statistics pages, using the homepage hero's
// visual language (amber mono eyebrow, large tracking-tight headline, gray-400
// lede with gray-200 highlights, gray-900/70 stat cards).
//
// House rules baked in:
// - Stats are EXPLAINABLE: every stat carries a visible plain-language
//   definition (`explain`) — no bare numbers.
// - Stats are CITABLE: every stat can link to where the number comes from
//   (`cite`) — a raw-data endpoint or the upstream source.
// - Presentational only (no hooks, no data fetching), so it can be rendered
//   from server pages and client components alike.

export type HeroStatTone = "default" | "red" | "green" | "amber" | "blue";

export type HeroStat = {
  label: string;
  value: string;
  /** Short visible qualifier under the value, e.g. "31.9% of recorded votes". */
  sub?: string;
  /** Plain-language definition of how the number is computed. Always visible. */
  explain: string;
  /** Where the number comes from — raw-data endpoint or upstream source. */
  cite?: { href: string; label: string; external?: boolean };
  tone?: HeroStatTone;
};

export type HeroAction = {
  href: string;
  label: string;
  external?: boolean;
  /** Primary actions render as the amber homepage CTA button. */
  primary?: boolean;
};

const TONE_CLASS: Record<HeroStatTone, string> = {
  default: "text-white",
  red: "text-red-300",
  green: "text-green-300",
  amber: "text-amber-300",
  blue: "text-blue-300",
};

function CiteLink({ cite }: { cite: NonNullable<HeroStat["cite"]> }) {
  const className =
    "mt-2 inline-flex items-center gap-1 text-[11px] text-amber-400/80 hover:text-amber-300 transition-colors";
  if (cite.external) {
    return (
      <a href={cite.href} target="_blank" rel="noreferrer" className={className}>
        {cite.label} →
      </a>
    );
  }
  return (
    <a href={cite.href} className={className}>
      {cite.label} →
    </a>
  );
}

export default function PageHero({
  eyebrow,
  title,
  lede,
  stats,
  actions,
  footnote,
}: {
  eyebrow: string;
  title: string;
  /** One-paragraph pitch. Use <span className="text-gray-200"> for highlights. */
  lede: ReactNode;
  stats?: HeroStat[];
  actions?: HeroAction[];
  /** Sources / methodology line rendered under the stat cards. */
  footnote?: ReactNode;
}) {
  return (
    <header className="relative">
      <span className="inline-block text-[11px] font-mono uppercase tracking-[0.25em] text-amber-400/90">
        {eyebrow}
      </span>

      <h1 className="mt-3 text-3xl sm:text-4xl font-semibold text-white tracking-tight leading-[1.1]">
        {title}
      </h1>

      <p className="mt-4 max-w-3xl text-base sm:text-lg text-gray-400 leading-relaxed">
        {lede}
      </p>

      {actions && actions.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          {actions.map((a) => {
            if (a.primary) {
              const cls =
                "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-gray-950 font-medium text-sm hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20";
              return a.external ? (
                <a key={a.href} href={a.href} target="_blank" rel="noreferrer" className={cls}>
                  {a.label} →
                </a>
              ) : (
                <Link key={a.href} href={a.href} className={cls}>
                  {a.label} →
                </Link>
              );
            }
            const cls =
              "text-sm text-amber-400/70 hover:text-amber-300 transition-colors underline underline-offset-4";
            return a.external ? (
              <a key={a.href} href={a.href} target="_blank" rel="noreferrer" className={cls}>
                {a.label} →
              </a>
            ) : (
              <Link key={a.href} href={a.href} className={cls}>
                {a.label} →
              </Link>
            );
          })}
        </div>
      )}

      {stats && stats.length > 0 && (
        <dl className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col rounded-2xl border border-gray-800 bg-gray-900/70 backdrop-blur-sm px-5 py-4"
            >
              <dt className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">
                {s.label}
              </dt>
              <dd className="mt-1.5">
                <span
                  className={`text-2xl font-semibold tabular-nums ${TONE_CLASS[s.tone ?? "default"]}`}
                >
                  {s.value}
                </span>
                {s.sub && <span className="ml-2 text-xs text-gray-500">{s.sub}</span>}
              </dd>
              <p className="mt-1.5 text-[11px] text-gray-500 leading-snug">{s.explain}</p>
              {s.cite && (
                <div className="mt-auto">
                  <CiteLink cite={s.cite} />
                </div>
              )}
            </div>
          ))}
        </dl>
      )}

      {footnote && (
        <p className="mt-3 max-w-3xl text-xs text-gray-600 leading-relaxed">{footnote}</p>
      )}
    </header>
  );
}
