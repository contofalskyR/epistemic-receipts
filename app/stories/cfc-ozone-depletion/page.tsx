import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrajectoryDetail, type TrajectoryDetail } from "@/lib/trajectory-detail";
import { serializeJsonLd } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/site";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";
import SettlingCurveMini from "@/app/components/SettlingCurveMini";

export const revalidate = 86400;

const SLUG = "cfc-ozone-depletion";

export const metadata: Metadata = {
  title: "The Ozone Claim: From Chemistry to Treaty — Epistemic Receipts",
  description:
    "Molina and Rowland predicted in 1974 that CFCs would destroy stratospheric ozone. The claim was contested for over a decade before the Montreal Protocol ratified it in 1987 and developed-country production was phased out by 1995.",
  alternates: { canonical: "/stories/cfc-ozone-depletion" },
  openGraph: {
    title: "The Ozone Claim: From Chemistry to Treaty",
    description:
      "How Molina and Rowland's 1974 theoretical prediction became the Montreal Protocol — and what it shows about science-to-policy settling timelines.",
    url: "/stories/cfc-ozone-depletion",
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
        <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
          Settled
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

export default async function CfcOzoneDepletionStoryPage() {
  const traj = await getTrajectoryDetail(SLUG);
  if (!traj) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "The Ozone Claim: From Chemistry to Treaty",
    url: `${SITE_URL}/stories/cfc-ozone-depletion`,
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
          Case study · Atmospheric chemistry
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
          The Ozone Claim: From Chemistry to Treaty
        </h1>
        <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
          Molina and Rowland published a theoretical prediction in 1974. It was
          contested by the chemical industry for over a decade. By 1987 it had become
          the Montreal Protocol, and by 1995 the developed-country CFC industry had
          shut down. This trajectory shows what science-to-policy settling looks like
          when it works.
        </p>
      </header>

      <section className="space-y-4 text-gray-300 text-[15px] leading-relaxed max-w-2xl">
        <p>
          On June 28, 1974, Mario Molina and F. Sherwood Rowland published in{" "}
          <em>Nature</em> that chlorofluorocarbons (CFCs) — stable, non-toxic
          compounds then widely used in refrigerants and aerosol propellants — would
          eventually reach the stratosphere and catalytically destroy ozone molecules
          via a chain reaction. The mechanism was theoretically derived: at that time,
          no observed ozone hole existed to measure.
        </p>
        <p>
          The claim was contested immediately. The CFC industry funded counter-research
          and challenged the atmospheric chemistry modeling. Without empirical evidence
          of ozone depletion at the scale Molina and Rowland projected, the debate ran
          for over a decade. The 1985 British Antarctic Survey discovery of a
          significant ozone hole over Antarctica provided that empirical anchor and
          shifted the scientific consensus sharply.
        </p>
        <p>
          On September 16, 1987, the Montreal Protocol on Substances that Deplete the
          Ozone Layer was signed by 46 nations. It committed signatories to phase out
          CFC production on a binding schedule — the first international environmental
          treaty to respond to a science-based atmospheric threat. The trajectory records
          this as the SETTLED transition: multilateral policy ratification of the claim.
        </p>
        <p>
          The second SETTLED transition is recorded at the end of 1995, when developed
          countries completed the CFC phase-out under the Montreal Protocol schedule.
          Industrial production ending is a second form of ratification — commercial and
          legal, not just scientific. The trajectory has remained SETTLED since.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          The trajectory
        </h2>
        <CurvePanel traj={traj} slug={SLUG} />
      </section>

      <footer className="pt-4 border-t border-gray-800 flex gap-6 text-sm text-gray-500">
        <Link href="/stories" className="hover:text-amber-400 transition-colors">
          More stories →
        </Link>
        <Link href="/settling-curve" className="hover:text-amber-400 transition-colors">
          Browse all trajectories →
        </Link>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </div>
  );
}
