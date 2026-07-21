import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrajectoryDetail, type TrajectoryDetail } from "@/lib/trajectory-detail";
import { serializeJsonLd } from "@/lib/jsonld";
import CitationButton from "@/components/CitationButton";
import EmbedButton from "@/components/EmbedButton";
import { SITE_URL } from "@/lib/site";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";
import SettlingCurveMini from "@/app/components/SettlingCurveMini";

export const revalidate = 86400;

const SLUG = "dietary-fat-heart";

export const metadata: Metadata = {
  title: "The Dietary Fat Hypothesis: Settled, Then Contested Again — Epistemic Receipts",
  description:
    "Ancel Keys linked saturated fat to heart disease in 1953. The USDA Dietary Guidelines institutionalized the claim in 1980. A 2010 meta-analysis returned it to CONTESTED — where it remains.",
  alternates: { canonical: "/stories/dietary-fat-heart", types: { "application/json+oembed": `${SITE_URL}/api/oembed?url=${encodeURIComponent(SITE_URL + "/stories/dietary-fat-heart")}` } },
  openGraph: {
    title: "The Dietary Fat Hypothesis: Settled, Then Contested Again",
    description:
      "Three transitions, one still-live dispute. The dietary fat–heart disease claim shows what CONTESTED → SETTLED → CONTESTED looks like in the database.",
    url: "/stories/dietary-fat-heart",
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
        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
          Currently contested
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

export default async function DietaryFatHeartStoryPage() {
  const traj = await getTrajectoryDetail(SLUG);
  if (!traj) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "The Dietary Fat Hypothesis: Settled, Then Contested Again",
    url: `${SITE_URL}/stories/dietary-fat-heart`,
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
          Case study · Nutrition science
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
          The Dietary Fat Hypothesis: Settled, Then Contested Again
        </h1>
        <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
          Few trajectories in the database show a CONTESTED → SETTLED → CONTESTED arc.
          The dietary fat–heart disease hypothesis is one of them. Its most recent
          recorded status is CONTESTED.
        </p>
      </header>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-5 py-4 max-w-2xl">
        <p className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-1.5">
          Live dispute
        </p>
        <p className="text-sm text-gray-300 leading-relaxed">
          This trajectory is currently CONTESTED. The claim is not settled in either
          direction — both sides of the debate have published peer-reviewed evidence.
          This story describes the arc as recorded; it does not take a position on the
          current scientific dispute.
        </p>
      </div>

      <section className="space-y-4 text-gray-300 text-[15px] leading-relaxed max-w-2xl">
        <p>
          In July 1953, Ancel Keys published an analysis in the{" "}
          <em>Journal of Mount Sinai Hospital</em> linking dietary saturated fat to
          coronary heart disease mortality across six countries. The paper entered the
          claim into CONTESTED status — Keys&apos;s country selection and methodology were
          disputed by contemporaries, most prominently John Yudkin, who argued sugar
          was the primary driver.
        </p>
        <p>
          Over the following decades, the Keys hypothesis accumulated institutional
          support. In February 1980, the U.S. Department of Agriculture issued the first{" "}
          <em>Dietary Guidelines for Americans</em>, recommending reduced saturated fat
          and dietary cholesterol consumption. The trajectory records this as the
          SETTLED transition — the claim had been ratified by a major regulatory body
          and embedded in public health policy.
        </p>
        <p>
          In March 2010, Siri-Tarino et al. published a meta-analysis in the{" "}
          <em>American Journal of Clinical Nutrition</em> examining prospective cohort
          studies and finding no significant association between saturated fat intake
          and cardiovascular disease when substituted for refined carbohydrates. The
          meta-analysis returned the claim to CONTESTED status — the trajectory&apos;s
          current recorded state.
        </p>
        <p>
          Subsequent research has produced conflicting results, and the scientific
          debate continues to evolve. The trajectory reflects that state: CONTESTED,
          with the last marker being the 2010 meta-analysis. No subsequent settling
          event has been recorded.
        </p>
      </section>

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
