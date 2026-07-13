import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrajectoryDetail, type TrajectoryDetail } from "@/lib/trajectory-detail";
import { serializeJsonLd } from "@/lib/jsonld";
import CitationButton from "@/components/CitationButton";
import { SITE_URL } from "@/lib/site";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";
import SettlingCurveMini from "@/app/components/SettlingCurveMini";

// ISR, matching the other trajectory-backed pages — this reads two already-seeded
// curated claims (scripts/seed-trajectories.ts), so a day-old cache is fine.
export const revalidate = 86400;

const HPYLORI_SLUG = "hpylori-ulcers";
const STRESS_ACID_SLUG = "stress-acid-ulcers";

export const metadata: Metadata = {
  title: "H. pylori: two arcs, one settling event — Epistemic Receipts",
  description:
    "On February 9, 1994, one NIH consensus conference ratified the H. pylori theory of ulcers and reversed the stress/acid theory it replaced — the same event settling two arcs at once.",
  alternates: { canonical: "/stories/h-pylori" },
  openGraph: {
    title: "H. pylori: two arcs, one settling event",
    description:
      "Marshall & Warren's 1984 bacterial theory of ulcers, doubted for a decade, ratified by NIH in 1994 and confirmed by the 2005 Nobel Prize — the same 1994 conference that reversed the stress/acid theory it replaced.",
    url: "/stories/h-pylori",
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

function CurvePanel({
  traj,
  slug,
  eyebrow,
  accent,
}: {
  traj: TrajectoryDetail;
  slug: string;
  eyebrow: string;
  accent: string;
}) {
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
        <span className={`text-[10px] font-mono uppercase tracking-widest ${accent}`}>
          {eyebrow}
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
                  <a
                    href={t.markerSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 hover:underline"
                  >
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

export default async function HPyloriStoryPage() {
  const [hpylori, stressAcid] = await Promise.all([
    getTrajectoryDetail(HPYLORI_SLUG),
    getTrajectoryDetail(STRESS_ACID_SLUG),
  ]);

  if (!hpylori || !stressAcid) notFound();

  // Both arcs pivot on the same NIH conference — surfaced explicitly rather
  // than left for the reader to notice by comparing two transition logs.
  const pivot = hpylori.transitions.find(
    (t) => t.community === "INSTITUTIONAL" && t.toAxis === "SETTLED",
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "H. pylori: two arcs, one settling event",
    url: `${SITE_URL}/stories/h-pylori`,
    datePublished: hpylori.transitions[0]?.occurredAt ?? undefined,
    dateModified: hpylori.transitions.at(-1)?.occurredAt ?? undefined,
    about: [
      {
        "@type": "Claim",
        "@id": `${SITE_URL}/claims/${hpylori.claimId}`,
        url: `${SITE_URL}/claims/${hpylori.claimId}`,
        text: hpylori.claimText,
      },
      {
        "@type": "Claim",
        "@id": `${SITE_URL}/claims/${stressAcid.claimId}`,
        url: `${SITE_URL}/claims/${stressAcid.claimId}`,
        text: stressAcid.claimText,
      },
    ],
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
      {/* Header */}
      <header className="space-y-3">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">
          Case study · Medicine
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
          H. pylori: one conference, two verdicts
        </h1>
        <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
          On February 9, 1994, an NIH consensus panel ratified a bacterial theory of ulcers
          that had been doubted for a decade — and reversed the stress/acid theory it
          replaced, in the same statement. One settling event, two epistemic trajectories,
          moving in opposite directions.
        </p>
      </header>

      {/* Narrative */}
      <section className="space-y-4 text-gray-300 text-[15px] leading-relaxed max-w-2xl">
        <p>
          By the mid-20th century, gastroenterology had settled on an explanation for peptic
          ulcers: psychological stress and excess stomach acid. The model dated to Wolf &amp;
          Wolff&apos;s 1947 work on human gastric function, and it shaped decades of treatment —
          antacids, bland diets, stress management — without a cure in sight.
        </p>
        <p>
          In 1984, Australian pathologists Barry Marshall and Robin Warren published a very
          different claim in <em>The Lancet</em>: curved bacilli, later named{" "}
          <em>Helicobacter pylori</em>, were present in the stomachs of ulcer patients, and the
          infection — not stress or acid — was the primary cause. The idea was widely doubted.
          Reviewers didn&apos;t believe any bacterium could survive stomach acid long enough to
          colonize it, and an infectious cause implied a cure (antibiotics) that upended an
          entire treatment industry built on the stress/acid model.
        </p>
        <p>
          Unable to secure a human trial through ordinary channels, Marshall drank a petri
          dish of cultured <em>H. pylori</em> himself in 1984. He developed gastritis within
          days, then isolated the bacteria from his own stomach biopsy — self-experimental
          evidence that the infection could establish and cause disease in a healthy host.
        </p>
        <p>
          It took another decade of accumulating trial and biopsy data before institutions
          caught up. On February 9, 1994, the NIH Consensus Development Conference issued a
          statement endorsing <em>H. pylori</em> as a cause of peptic ulcer disease and
          antibiotics as first-line treatment — explicitly superseding the stress/acid
          consensus in the same statement. In 2005, the Nobel Prize in Physiology or Medicine
          went to Marshall and Warren, closing the arc at expert-literature confirmation.
        </p>
      </section>

      {/* Shared pivot callout */}
      {pivot && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-5 py-4 max-w-2xl">
          <p className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-1.5">
            Shared pivot — {fmtDate(pivot.occurredAt, pivot.datePrecision)}
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">
            The same NIH Consensus Development Conference statement is the marker source for
            both transitions below: it settles the <em>H. pylori</em> claim and reverses the
            stress/acid claim at once. Below, trace each curve independently.
          </p>
        </div>
      )}

      {/* Two parallel curves */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Two curves, one event
        </h2>
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-2 items-start">
          <CurvePanel
            traj={hpylori}
            slug={HPYLORI_SLUG}
            eyebrow="Settled"
            accent="text-emerald-400"
          />
          <CurvePanel
            traj={stressAcid}
            slug={STRESS_ACID_SLUG}
            eyebrow="Reversed"
            accent="text-rose-400"
          />
        </div>
      </section>

      {/* Footer nav */}
      <footer className="pt-4 border-t border-gray-800 flex gap-6 items-center text-sm text-gray-500">
        <Link href="/stories" className="hover:text-amber-400 transition-colors">
          More stories →
        </Link>
        <Link href="/settling-curve" className="hover:text-amber-400 transition-colors">
          Browse all trajectories →
        </Link>
        <CitationButton type="claim" id={hpylori.claimId} />
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </div>
  );
}
