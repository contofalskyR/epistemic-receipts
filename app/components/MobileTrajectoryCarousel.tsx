// §3.4 mobile-first settling curve carousel — visible only below sm (< 640px).
// On phones the hero is a horizontal snap carousel of curated featured
// trajectories; the desktop hero (HomeSurvivalFig) renders alongside it with
// `hidden sm:block`.
//
// Each card shows:
//   - eyebrow tag + claim label
//   - HOOK placeholder (owner picks from briefs/b9-hook-candidates.md)
//   - SettlingCurveMini sparkline from embedded fallback milestones
//   - "See the full curve →" link to /settling-curve?t=<id>
//
// Server component — no client JS. Milestones come from the curated fallbacks
// in lib/featured-trajectories.ts (no additional DB fetch).

import Link from "next/link";
import { FEATURED_TRAJECTORIES } from "@/lib/featured-trajectories";
import SettlingCurveMini from "./SettlingCurveMini";

export default function MobileTrajectoryCarousel() {
  return (
    <div
      className="block sm:hidden"
      aria-label="Featured epistemic trajectories"
    >
      <p className="mb-3 text-[10.5px] font-mono uppercase tracking-[0.14em] text-amber-400/90">
        Featured trajectories — swipe to browse
      </p>
      <div
        className="flex gap-4 overflow-x-auto pb-3"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {FEATURED_TRAJECTORIES.map((traj) => (
          <Link
            key={traj.id}
            href={`/settling-curve?t=${traj.id}`}
            className="group flex shrink-0 flex-col rounded-xl border border-gray-800 bg-gray-900/60 p-4 no-underline transition-colors hover:border-gray-600"
            style={{ scrollSnapAlign: "start", width: "min(calc(100vw - 3rem), 320px)" }}
          >
            <span className={`text-[10px] font-mono uppercase tracking-[0.12em] ${traj.eyebrowColor}`}>
              {traj.eyebrow}
            </span>
            {/* HOOK: owner picks from briefs/b9-hook-candidates.md — this
                line will be replaced with the selected hook once approved. */}
            <p className="mt-2 text-[14px] font-medium leading-snug text-gray-100 line-clamp-3">
              {traj.claim}
            </p>
            <div className="mt-3 w-full" aria-hidden="true">
              <SettlingCurveMini
                milestones={traj.milestones}
                className="w-full"
                animate={false}
                ariaLabel={`Epistemic trajectory for ${traj.eyebrow.toLowerCase()}`}
              />
            </div>
            <span className="mt-2 text-[12px] text-amber-400/70 transition-colors group-hover:text-amber-300">
              See the full curve →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
