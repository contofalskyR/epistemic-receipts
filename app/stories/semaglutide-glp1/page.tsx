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

const SLUG = "semaglutide-glp1";

export const metadata: Metadata = {
  title: "From Lab Target to Ozempic: GLP-1's 25-Year Arc — Epistemic Receipts",
  description:
    "A 1996 Nature paper identified GLP-1's appetite-suppressing role in rats. Semaglutide reached FDA approval for type 2 diabetes in 2017 and for obesity in 2021 — a 25-year arc from RECORDED to SETTLED.",
  alternates: { canonical: "/stories/semaglutide-glp1" },
  openGraph: {
    title: "From Lab Target to Ozempic: GLP-1's 25-Year Arc",
    description:
      "Six transitions from 1996 to 2021 — how a peripheral receptor discovery became one of the most widely prescribed drug classes in history.",
    url: "/stories/semaglutide-glp1",
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

export default async function SemaglutideGlp1StoryPage() {
  const traj = await getTrajectoryDetail(SLUG);
  if (!traj) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "From Lab Target to Ozempic: GLP-1's 25-Year Arc",
    url: `${SITE_URL}/stories/semaglutide-glp1`,
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
          Case study · Pharmacology
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
          From Lab Target to Ozempic: GLP-1&apos;s 25-Year Arc
        </h1>
        <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
          Six transitions across 25 years — from a 1996 paper on peripheral GLP-1
          and food intake in rats to two FDA approvals that made semaglutide one of
          the most prescribed drug classes in the world.
        </p>
      </header>

      <section className="space-y-4 text-gray-300 text-[15px] leading-relaxed max-w-2xl">
        <p>
          On January 4, 1996, Turton et al. published in <em>Nature</em> showing that
          peripheral administration of glucagon-like peptide-1 (GLP-1) reduced food intake
          in rats. The paper established GLP-1 receptor activation as a target for appetite
          suppression — the first RECORDED marker in this trajectory. At this stage, the
          finding was basic science, not yet a drug target.
        </p>
        <p>
          In November 2001, Larsen et al. published in <em>Diabetes</em> demonstrating that
          a long-acting GLP-1 analog (NN2211, a precursor compound to semaglutide) caused
          sustained weight loss in obese rats without tachyphylaxis. This was the second
          RECORDED marker — animal pharmacology supporting the translational case.
        </p>
        <p>
          In January 2010, a Phase 1 clinical trial of semaglutide (registered as
          NCT01262118) was initiated. Human trials moved the claim from animal models to
          human safety and dosing — the third RECORDED marker in the trajectory.
        </p>
        <p>
          In September 2015, Lau et al. published the discovery paper for semaglutide in
          the <em>Journal of Medicinal Chemistry</em>, describing the molecule&apos;s design
          and properties. The trajectory records this as a CONTESTED transition —
          efficacy in humans was still being established in Phase 2 and 3 trials, and the
          magnitude of weight loss effects was not yet settled.
        </p>
        <p>
          On December 5, 2017, the FDA approved Ozempic (semaglutide injection, 0.5mg and
          1mg) under NDA209637 for glycemic control in type 2 diabetes. The regulatory
          approval is the settling event for the diabetes indication. On June 4, 2021, the
          FDA approved Wegovy (semaglutide 2.4mg) under NDA215256 as a chronic weight
          management therapy, settling the obesity indication. The trajectory records both
          approvals as SETTLED transitions.
        </p>
      </section>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-5 py-4 max-w-2xl">
        <p className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-1.5">
          On the RECORDED → SETTLED pattern
        </p>
        <p className="text-sm text-gray-300 leading-relaxed">
          This trajectory illustrates a common pharmaceutical arc: basic receptor
          pharmacology is RECORDED (no controversy, just documentation), preclinical
          evidence accumulates as additional RECORDED transitions, then CONTESTED status
          marks active clinical development where the outcome is genuinely uncertain, and
          SETTLED arrives at regulatory approval. The RECORDED states are not disputed —
          they are simply not yet actionable.
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
