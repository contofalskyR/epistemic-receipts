import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadDormantContested, loadRecentlyWoken } from "@/lib/dormancy";
import { AXIS_BG_CLASS } from "@/lib/status";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Open Questions — Epistemic Receipts",
  description:
    "Claims stamped CONTESTED, ranked by how long they've been contested without new activity. Dormancy is information — these are the graph's longest open questions.",
};

function dormancyLabel(years: number): string {
  if (years === 0) return "less than a year · no new activity";
  if (years === 1) return "1 yr · no new activity";
  return `${years} yrs · no new activity`;
}

export default async function OpenQuestionsPage() {
  const [dormant, woken, totalContested] = await Promise.all([
    loadDormantContested(50),
    loadRecentlyWoken(),
    prisma.claim.count({
      where: {
        epistemicAxis: "CONTESTED",
        deleted: false,
        OR: [{ verificationStatus: null }, { verificationStatus: { not: "DEPRECATED" } }],
      },
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
      <header className="space-y-3">
        <p className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
          Open questions
        </p>
        <h1 className="text-3xl font-bold text-white leading-tight">
          Longest contested claims
        </h1>
        <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
          {totalContested.toLocaleString()} claims are currently stamped CONTESTED in this corpus —
          their status is genuinely unresolved between ratifying communities.
          Below are those with the longest gap since any new transition was recorded.
          Dormancy is information, not a defect.
        </p>
        <p className="text-xs text-gray-600">
          The <span className="text-gray-500">CONTESTED</span> stamp means the claim has active
          dispute on record — not that it is wrong. A gap means nothing new has moved the needle,
          not that the question is answered.
        </p>
      </header>

      {/* Recently woken strip — only if non-empty */}
      {woken.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Recently woken (≥5 yrs contested · new activity in last 90 days)
          </h2>
          <p className="text-xs text-gray-600">
            Long-dormant contested claims that just received a new transition.
          </p>
          <ul className="space-y-2">
            {woken.map((item) => (
              <li key={item.claimId}>
                <Link
                  href={`/claims/${item.claimId}`}
                  className="group flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 px-4 py-3 transition-colors"
                >
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
                    CONTESTED
                  </span>
                  <span className="text-sm text-gray-300 leading-snug group-hover:text-white transition-colors flex-1">
                    {item.text.length > 150 ? item.text.slice(0, 147) + "…" : item.text}
                  </span>
                  <span className="shrink-0 text-xs font-mono text-gray-600 whitespace-nowrap">
                    contested {item.dormancyYears}+ yrs
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Dormancy leaderboard */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Longest contested · no new activity
        </h2>
        {dormant.length === 0 ? (
          <p className="text-sm text-gray-600 italic">No contested claims found.</p>
        ) : (
          <ol className="space-y-2">
            {dormant.map((item, idx) => (
              <li key={item.claimId} className="flex items-start gap-3">
                <span className="shrink-0 w-7 text-right text-[11px] font-mono text-gray-500 pt-1">
                  {idx + 1}.
                </span>
                <Link
                  href={`/claims/${item.claimId}`}
                  className="group flex flex-1 items-start gap-3 rounded-lg border border-gray-800 bg-gray-900/50 hover:border-gray-700 px-4 py-3 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm text-gray-300 leading-snug group-hover:text-white transition-colors">
                      {item.text.length > 160 ? item.text.slice(0, 157) + "…" : item.text}
                    </p>
                    <p className="text-[11px] text-gray-600">
                      last transition {item.lastTransitionYear}
                      {" · "}
                      {dormancyLabel(item.dormancyYears)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap ${AXIS_BG_CLASS["CONTESTED"]}`}>
                    Contested
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="pt-4 border-t border-gray-800 flex gap-6 text-sm text-gray-500">
        <Link href="/settling-curve" className="hover:text-amber-400 transition-colors">
          Browse all trajectories →
        </Link>
        <Link href="/feed" className="hover:text-amber-400 transition-colors">
          What&apos;s new →
        </Link>
        <Link href="/start-here" className="hover:text-amber-400 transition-colors">
          Start here →
        </Link>
      </footer>
    </div>
  );
}
