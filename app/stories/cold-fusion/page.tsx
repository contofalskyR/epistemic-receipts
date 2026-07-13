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

const SLUG = "cold-fusion";

export const metadata: Metadata = {
  title: "Eight Months from Announcement to Abandonment: Cold Fusion — Epistemic Receipts",
  description:
    "Fleischmann and Pons announced cold fusion in April 1989. By November, the DOE Energy Research Advisory Board found no convincing evidence. The arc closed in under a year.",
  alternates: { canonical: "/stories/cold-fusion" },
  openGraph: {
    title: "Eight Months from Announcement to Abandonment: Cold Fusion",
    description:
      "One of the fastest CONTESTED → ABANDONED arcs in the database — a high-profile scientific claim that failed replication and was abandoned within months.",
    url: "/stories/cold-fusion",
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
        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
          Abandoned
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

export default async function ColdFusionStoryPage() {
  const traj = await getTrajectoryDetail(SLUG);
  if (!traj) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Eight Months from Announcement to Abandonment: Cold Fusion",
    url: `${SITE_URL}/stories/cold-fusion`,
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
          Case study · Physics
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
          Eight Months from Announcement to Abandonment
        </h1>
        <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
          Cold fusion is one of the fastest CONTESTED → ABANDONED arcs in the database.
          A high-profile claim published in April 1989 failed widespread replication and
          was abandoned by the mainstream scientific community before the year ended.
        </p>
      </header>

      <section className="space-y-4 text-gray-300 text-[15px] leading-relaxed max-w-2xl">
        <p>
          On April 10, 1989, Martin Fleischmann and Stanley Pons published a paper in the{" "}
          <em>Journal of Electroanalytical Chemistry</em> claiming to have achieved nuclear
          fusion at room temperature in a palladium electrode immersed in heavy water. The
          claim, if reproducible, would have overturned established nuclear physics and
          offered a new energy source without the extreme temperatures and containment
          requirements of hot fusion.
        </p>
        <p>
          The announcement — preceded by a widely-covered press conference at the University
          of Utah — generated an immediate global replication effort. Labs on multiple
          continents attempted to reproduce the excess heat and nuclear byproducts the paper
          reported. Most found neither. A handful of reports of partial replication added to
          the confusion, but no independent group reproduced the full claimed effect under
          controlled conditions.
        </p>
        <p>
          In November 1989, the U.S. Department of Energy&apos;s Energy Research Advisory
          Board issued its assessment: the experimental evidence for cold fusion was not
          persuasive and did not justify a dedicated research program. The ERAB report is
          the marker source for the ABANDONED transition in this trajectory — the point at
          which the scientific community formally withdrew support for the claim.
        </p>
        <p>
          The full arc — from the paper&apos;s publication to institutional abandonment —
          ran less than eight months. The claim has continued to attract fringe research
          since, but the trajectory has not recorded a subsequent CONTESTED or SETTLED
          transition; the mainstream scientific consensus has remained that cold fusion is
          not a reproducible phenomenon.
        </p>
      </section>

      <div className="rounded-xl border border-gray-700/50 bg-gray-900/40 px-5 py-4 max-w-2xl">
        <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-1.5">
          What ABANDONED means here
        </p>
        <p className="text-sm text-gray-400 leading-relaxed">
          ABANDONED means the scientific community withdrew active investigation and
          mainstream support — not that the claim was formally falsified. The failure
          mode here was non-replication, not a refutation experiment. Cold fusion remains
          ABANDONED rather than REVERSED because no single definitive experiment closed
          it; replication simply never materialized.
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
