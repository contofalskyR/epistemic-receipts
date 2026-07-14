import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrajectoryDetail, type TrajectoryDetail } from "@/lib/trajectory-detail";
import { serializeJsonLd } from "@/lib/jsonld";
import CitationButton from "@/components/CitationButton";
import { SITE_URL } from "@/lib/site";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";
import SettlingCurveMini from "@/app/components/SettlingCurveMini";

export const revalidate = 86400;

const SLUG = "voting-rights-act-1965";

export const metadata: Metadata = {
  title: "The Voting Rights Act: Settlement and Partial Reversal — Epistemic Receipts",
  description:
    "Enacted in 1965, upheld unanimously by the Supreme Court in 1966, and then partially reversed in Shelby County v. Holder in 2013 — the VRA's preclearance mechanism traces a 48-year arc from RECORDED to SETTLED to REVERSED.",
  alternates: { canonical: "/stories/voting-rights-act-1965" },
  openGraph: {
    title: "The Voting Rights Act: Settlement and Partial Reversal",
    description:
      "One of two legislative trajectories in the database with a REVERSED transition — enacted, settled by unanimous SCOTUS review, then partially reversed 48 years later.",
    url: "/stories/voting-rights-act-1965",
    siteName: "Epistemic Receipts",
    type: "article",
  },
};

function fmtDate(iso: string, precision: string | null): string {
  const d = new Date(iso);
  if (precision === "YEAR") return String(d.getUTCFullYear());
  if (precision === "QUARTER") {
    const q = Math.floor(d.getUTCMonth() / 3) + 1;
    return `Q${q} ${d.getUTCFullYear()}`;
  }
  if (precision === "MONTH") {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function CurvePanel({ traj, slug }: { traj: TrajectoryDetail; slug: string }) {
  const milestones = traj.transitions.map((t) => ({
    year: new Date(t.occurredAt).getUTCFullYear(),
    axis: t.toAxis,
    reason: t.reason,
    community: t.community,
  }));
  const finalAxis = traj.transitions.at(-1)?.toAxis ?? null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-mono uppercase tracking-widest text-rose-400">
          Reversed
        </span>
        <EpistemicAxisBadge axis={finalAxis} />
      </div>
      <p className="text-white font-semibold text-base leading-snug">{traj.claimText}</p>
      <SettlingCurveMini
        milestones={milestones}
        ariaLabel={`Settling curve: ${traj.claimText}`}
      />
      <ol className="space-y-3 pt-1">
        {traj.transitions.map((t, i) => (
          <li key={i} className="rounded-lg border border-gray-800 bg-gray-950/60 px-3.5 py-3 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {t.fromAxis ? (
                <>
                  <span className="text-[11px] font-mono text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
                    {t.fromAxis}
                  </span>
                  <span className="text-gray-600">→</span>
                </>
              ) : (
                <span className="text-[11px] font-mono text-gray-600 bg-gray-800/50 px-1.5 py-0.5 rounded">
                  (initial)
                </span>
              )}
              <span className="text-[11px] font-mono text-white bg-gray-700 px-1.5 py-0.5 rounded">
                {t.toAxis}
              </span>
              <span className="text-xs text-gray-500 ml-auto">
                {fmtDate(t.occurredAt, t.datePrecision)}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {t.community.replace(/_/g, " ").toLowerCase()}
            </p>
            {t.reason && <p className="text-[13px] text-gray-300 leading-relaxed">{t.reason}</p>}
            {t.markerSource && (
              <p className="text-xs text-gray-500">
                {t.markerSource.url ? (
                  <a href={t.markerSource.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:underline">
                    {t.markerSource.name}
                  </a>
                ) : (
                  <span className="text-gray-400">{t.markerSource.name}</span>
                )}
              </p>
            )}
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3 flex-wrap pt-1">
        <Link
          href={`/claims/${traj.claimId}`}
          className="text-xs px-3 py-1 rounded-full font-medium bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-200 transition-colors"
        >
          View claim page →
        </Link>
        <Link
          href={`/settling-curve/${slug}`}
          className="text-xs px-3 py-1 rounded-full font-medium bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition-colors"
        >
          Open interactive curve →
        </Link>
      </div>
    </div>
  );
}

export default async function VotingRightsAct1965StoryPage() {
  const traj = await getTrajectoryDetail(SLUG);
  if (!traj) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "The Voting Rights Act: Settlement and Partial Reversal",
    url: `${SITE_URL}/stories/voting-rights-act-1965`,
    datePublished: traj.transitions[0]?.occurredAt ?? undefined,
    dateModified: traj.transitions.at(-1)?.occurredAt ?? undefined,
    about: {
      "@type": "Claim",
      "@id": `${SITE_URL}/claims/${traj.claimId}`,
      url: `${SITE_URL}/claims/${traj.claimId}`,
      text: traj.claimText,
    },
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
      <header className="space-y-3">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">
          Case study · Constitutional law
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
          The Voting Rights Act: Settlement and Partial Reversal
        </h1>
        <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
          The Voting Rights Act is one of two legislative trajectories in the database
          with a REVERSED transition. Its preclearance mechanism was enacted in 1965,
          unanimously upheld in 1966, and partially reversed 48 years later. The arc
          is the clearest example in the database of a legal RECORDED → SETTLED →
          REVERSED pattern.
        </p>
      </header>

      <section className="space-y-4 text-gray-300 text-[15px] leading-relaxed max-w-2xl">
        <p>
          On August 6, 1965, President Johnson signed the Voting Rights Act into law
          as Pub.L.89-110. Its central mechanism was Section 5 preclearance: covered
          jurisdictions — states and counties with documented histories of
          discriminatory voting practices — were required to obtain federal approval
          before changing any voting procedure. Section 4(b) defined which
          jurisdictions were covered, using a formula based on voter registration and
          turnout data from the 1964 election. The trajectory records the enactment
          as a RECORDED transition — a new legal claim entered the record.
        </p>
        <p>
          Seven months later, on March 7, 1966, the Supreme Court upheld the Act
          unanimously in <em>South Carolina v. Katzenbach</em>. Chief Justice Warren&apos;s
          opinion held that Congress had broad remedial power under Section 2 of the
          Fifteenth Amendment and that the preclearance mechanism was a constitutional
          exercise of that power. The trajectory records this as the SETTLED transition
          — a unanimous SCOTUS ruling is the most definitive form of constitutional
          settlement in the database.
        </p>
        <p>
          On June 25, 2013, the Supreme Court decided{" "}
          <em>Shelby County v. Holder</em> 5-4. The majority held that Section 4(b)&apos;s
          coverage formula — still based on 1965-era data — was no longer responsive
          to current conditions and violated the constitutional requirement that
          federal legislation treat states equally. Without an updated coverage
          formula, Section 5 preclearance became unenforceable. The trajectory records
          this as a REVERSED transition: the settled legal claim was definitively
          overturned by a Supreme Court majority.
        </p>
      </section>

      <div className="rounded-xl border border-gray-700/50 bg-gray-900/40 px-5 py-4 max-w-2xl">
        <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-1.5">
          On RECORDED vs SETTLED for legislation
        </p>
        <p className="text-sm text-gray-400 leading-relaxed">
          In the database, RECORDED is the initial state for enacted legislation — the
          claim is on the record but not yet constitutionally adjudicated. SETTLED
          arrives when a Supreme Court ruling (or equivalent appellate finality)
          ratifies the legal claim. Most legislation in the database stays RECORDED
          because it is never challenged at the constitutional level. This trajectory
          is notable for moving through all three states: RECORDED at enactment,
          SETTLED at unanimous SCOTUS review, REVERSED 48 years later.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          The trajectory
        </h2>
        <CurvePanel traj={traj} slug={SLUG} />
      </section>

      <footer className="pt-4 border-t border-gray-800 flex gap-6 items-center text-sm text-gray-500">
        <Link href="/stories" className="hover:text-amber-400 transition-colors">
          More stories →
        </Link>
        <Link href="/reversals" className="hover:text-amber-400 transition-colors">
          Court reversals →
        </Link>
        <Link href="/settling-curve" className="hover:text-amber-400 transition-colors">
          Browse all trajectories →
        </Link>
        <CitationButton type="claim" id={traj.claimId} />
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </div>
  );
}
