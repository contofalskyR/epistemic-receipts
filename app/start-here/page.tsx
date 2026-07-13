import type { Metadata } from "next";
import Link from "next/link";

// Static server component — no DB call, fully crawlable, no client-only gate.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Start Here — Epistemic Receipts",
  description:
    "An entry point into Epistemic Receipts: fully-built curated trajectories, editorial stories, and key discovery paths. Every link here goes to a real, sourced record.",
  alternates: { canonical: "/start-here" },
  openGraph: {
    title: "Start Here — Epistemic Receipts",
    description:
      "Curated trajectories, stories, and discovery paths — a structured entry point into the epistemic graph.",
    url: "/start-here",
    siteName: "Epistemic Receipts",
  },
};

const CURATED_TRAJECTORIES: {
  slug: string;
  title: string;
  arc: string;
  span: string;
}[] = [
  {
    slug: "hpylori-ulcers",
    title: "H. pylori causes peptic ulcer disease",
    arc: "CONTESTED → SETTLED",
    span: "1984 → 2005",
  },
  {
    slug: "stress-acid-ulcers",
    title: "Psychological stress and stomach acid cause peptic ulcers",
    arc: "SETTLED → REVERSED",
    span: "1950 → 1994",
  },
  {
    slug: "smoking-lung-cancer",
    title: "Cigarette smoking causes lung cancer",
    arc: "CONTESTED → SETTLED",
    span: "1950 → 1998",
  },
  {
    slug: "continental-drift",
    title: "Continents have drifted from a single landmass",
    arc: "CONTESTED → ABANDONED → SETTLED",
    span: "1915 → 1963",
  },
  {
    slug: "dietary-fat-heart",
    title: "Dietary saturated fat is a primary cause of heart disease",
    arc: "CONTESTED → SETTLED → CONTESTED",
    span: "1953 → present",
  },
  {
    slug: "cold-fusion",
    title: "Nuclear fusion can occur at room temperature in palladium electrodes",
    arc: "CONTESTED → ABANDONED",
    span: "1989",
  },
  {
    slug: "civil-rights-act-1964",
    title: "Civil Rights Act of 1964 (Pub.L.88-352)",
    arc: "RECORDED → SETTLED",
    span: "1964",
  },
  {
    slug: "clean-air-act-1970",
    title: "Clean Air Act of 1970 (Pub.L.91-604)",
    arc: "RECORDED → SETTLED",
    span: "1970 → 2007",
  },
  {
    slug: "voting-rights-act-1965",
    title: "Voting Rights Act of 1965 (Pub.L.89-110)",
    arc: "RECORDED → SETTLED → REVERSED",
    span: "1965 → 2013",
  },
  {
    slug: "semaglutide-glp1",
    title: "GLP-1 receptor agonists (semaglutide) reduce body weight",
    arc: "RECORDED → SETTLED",
    span: "1996 → 2021",
  },
  {
    slug: "cfc-ozone-depletion",
    title: "Chlorofluorocarbons deplete stratospheric ozone",
    arc: "CONTESTED → SETTLED",
    span: "1974 → 1995",
  },
];

const STORIES: { href: string; title: string; eyebrow: string }[] = [
  { href: "/stories/h-pylori", title: "H. pylori: one conference, two verdicts", eyebrow: "Medicine" },
  { href: "/stories/smoking-lung-cancer", title: "Smoke and Evidence", eyebrow: "Epidemiology" },
  { href: "/stories/continental-drift", title: "The Long Abandonment of Wegener", eyebrow: "Earth sciences" },
  { href: "/stories/cold-fusion", title: "Eight Months from Announcement to Abandonment", eyebrow: "Physics" },
  { href: "/stories/semaglutide-glp1", title: "From Lab Target to Ozempic: GLP-1's 25-Year Arc", eyebrow: "Pharmacology" },
  { href: "/stories/cfc-ozone-depletion", title: "The Ozone Claim: From Chemistry to Treaty", eyebrow: "Atmospheric chemistry" },
  { href: "/stories/dietary-fat-heart", title: "The Dietary Fat Hypothesis: Settled, Then Contested Again", eyebrow: "Nutrition science" },
  { href: "/stories/voting-rights-act-1965", title: "The Voting Rights Act: Settlement and Partial Reversal", eyebrow: "Constitutional law" },
];

export default function StartHerePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-16">
      <header className="space-y-4">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">
          Entry point
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
          Start Here
        </h1>
        <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
          Epistemic Receipts tracks how claims move through the epistemic graph — from first
          record to contested, settled, or reversed. This page lists the fully-built,
          hand-curated trajectories and editorial stories. Every link here goes to a real,
          sourced record. No synthetic data.
        </p>
        <div className="flex gap-4 flex-wrap text-sm">
          <Link href="/about" className="text-amber-400 hover:text-amber-300 transition-colors">
            What is this? →
          </Link>
          <Link href="/glossary" className="text-gray-500 hover:text-gray-300 transition-colors">
            Glossary →
          </Link>
          <Link href="/docs/api" className="text-gray-500 hover:text-gray-300 transition-colors">
            API docs →
          </Link>
        </div>
      </header>

      {/* Curated trajectories */}
      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white">Curated trajectories</h2>
          <p className="mt-1 text-sm text-gray-500 max-w-2xl">
            Eleven hand-seeded claims with full transition logs — each transition cites a
            dated primary source. These are the most complete records in the database.
          </p>
        </div>
        <ul className="space-y-2">
          {CURATED_TRAJECTORIES.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/settling-curve/${t.slug}`}
                className="group flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 rounded-lg border border-gray-800 hover:border-amber-500/40 bg-gray-900/60 px-4 py-3 transition-colors"
              >
                <span className="flex-1 text-sm text-gray-200 group-hover:text-amber-300 transition-colors leading-snug">
                  {t.title}
                </span>
                <span className="shrink-0 text-[11px] font-mono text-gray-500">
                  {t.arc}
                </span>
                <span className="shrink-0 text-[11px] font-mono text-gray-600">
                  {t.span}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/trajectories"
          className="inline-block text-sm text-amber-400/80 hover:text-amber-300 transition-colors"
        >
          Trajectory encyclopedia (all curated claims) →
        </Link>
      </section>

      {/* Stories */}
      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white">Editorial stories</h2>
          <p className="mt-1 text-sm text-gray-500 max-w-2xl">
            Each story synthesizes a trajectory arc into a readable narrative. Every factual
            sentence traces to a transition already in the database.
          </p>
        </div>
        <ul className="space-y-2">
          {STORIES.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="group flex items-center gap-4 rounded-lg border border-gray-800 hover:border-amber-500/40 bg-gray-900/60 px-4 py-3 transition-colors"
              >
                <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-gray-600 w-32 hidden sm:block">
                  {s.eyebrow}
                </span>
                <span className="flex-1 text-sm text-gray-200 group-hover:text-amber-300 transition-colors">
                  {s.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/stories" className="inline-block text-sm text-amber-400/80 hover:text-amber-300 transition-colors">
          All stories →
        </Link>
      </section>

      {/* Discovery paths */}
      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white">Where to go next</h2>
          <p className="mt-1 text-sm text-gray-500 max-w-2xl">
            The graph holds over 1.6 million claims. These are the most useful entry points
            beyond the curated set.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { href: "/settling-curve", label: "Settling Curve", desc: "Interactive visualization for any trajectory" },
            { href: "/search", label: "Search", desc: "Full-text across 1.6M claims" },
            { href: "/trajectories", label: "Trajectory Encyclopedia", desc: "All curated arcs by domain" },
            { href: "/reversals", label: "Court Reversals", desc: "Eight landmark overruling arcs" },
            { href: "/feed", label: "What's New", desc: "Latest trajectory activity" },
            { href: "/glossary", label: "Glossary", desc: "Axis definitions and methodology" },
          ].map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="group rounded-lg border border-gray-800 hover:border-amber-500/40 bg-gray-900/40 px-4 py-3 transition-colors space-y-0.5"
            >
              <p className="text-sm font-medium text-gray-200 group-hover:text-amber-300 transition-colors">
                {d.label}
              </p>
              <p className="text-xs text-gray-500">{d.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <footer className="pt-4 border-t border-gray-800 flex gap-6 text-sm text-gray-500">
        <Link href="/about" className="hover:text-amber-400 transition-colors">About →</Link>
        <Link href="/docs/api" className="hover:text-amber-400 transition-colors">API →</Link>
        <Link href="/sources" className="hover:text-amber-400 transition-colors">Sources →</Link>
      </footer>
    </div>
  );
}
