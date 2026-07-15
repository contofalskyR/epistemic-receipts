// V1 landing hero — server component, per docs/design v1-landing-mockup.html
// ("How long does 'settled' stay settled?"). The mockup has zero interactivity,
// so the old client search island is gone from the homepage entirely: /search
// remains in the Nav and is the canonical search surface. Every number here is
// derived from the database in app/page.tsx (marketing house rule — no
// hand-written stats).

import Link from "next/link";
import { Newsreader } from "next/font/google";
import HomeSurvivalFig from "./HomeSurvivalFig";
import type { SettlingRateData } from "@/lib/settlingRate";

// The mockup's headline face. Variable font — no weight list needed.
const newsreader = Newsreader({ subsets: ["latin"], display: "swap" });

export default function HomeHero({
  claimCount,
  claimsCompact,
  settlingRate,
  datedTrajectoryCount,
}: {
  claimCount: number;
  /** compactCount(claimCount), formatted server-side ("1.76M"). */
  claimsCompact: string;
  settlingRate: SettlingRateData;
  datedTrajectoryCount: number;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      {/* ── Hero ── */}
      {/*
        Padding note: layout.tsx <main> carries py-8 (needed for ~80 non-homepage
        routes). The hero's own pt-8 sm:pt-14 previously stacked on top of that.
        Resolved: hero top padding reduced to pt-2 sm:pt-6 so total above-headline
        space is py-8 + pt-2 = ~40px mobile / py-8 + pt-6 = ~56px desktop.
      */}
      <section className="max-w-2xl pt-2 sm:pt-6">
        <p className="text-xs font-mono uppercase tracking-[0.14em] text-amber-400/90">
          A research observatory · {claimCount.toLocaleString("en-US")} claims
        </p>
        {/* HOOK: owner picks from briefs/b9-hook-candidates.md */}
        <h1
          className={`${newsreader.className} mt-4 text-[clamp(34px,4.6vw,46px)] font-medium leading-[1.14] text-gray-100`}
        >
          How long does &ldquo;settled&rdquo; stay settled?
        </h1>
        <p className="mt-3.5 max-w-[56ch] text-base leading-relaxed text-gray-400">
          Every claim here carries a dated, sourced trajectory — recorded, settled, contested, and
          sometimes reversed. This is what {claimsCompact} of them look like, aging.
        </p>
      </section>

      {/* ── Fig. 1 — live macro settling curve ── */}
      <section className="pt-7" aria-label="Survival curve of tracked claims">
        <HomeSurvivalFig data={settlingRate} datedTrajectoryCount={datedTrajectoryCount} />
      </section>

      {/* ── CTAs ── */}
      <div className="flex flex-wrap gap-3 pb-9 pt-6">
        <Link
          href="/settling-curve"
          className="inline-block rounded-lg bg-gray-100 px-5 py-3 text-sm font-medium text-gray-950 transition-colors hover:bg-white"
        >
          Explore the curves
        </Link>
        {/* The mockup's ghost CTA is "Download the dataset · DOI 10.5281/…" — no
            Zenodo deposit exists yet, so no DOI may be claimed. Until one is
            minted, the secondary path is the methods/provenance page. */}
        <Link
          href="/methodology"
          className="inline-block rounded-lg border border-gray-700 px-5 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
        >
          Data &amp; methods
        </Link>
      </div>
    </div>
  );
}
