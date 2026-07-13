import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrajectoryDetail, type TrajectoryDetail } from "@/lib/trajectory-detail";
import { serializeJsonLd } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/site";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";
import SettlingCurveMini from "@/app/components/SettlingCurveMini";

export const revalidate = 86400;

const SLUG = "continental-drift";

export const metadata: Metadata = {
  title: "The Long Abandonment of Wegener: Continental Drift from Ridicule to Revolution — Epistemic Receipts",
  description:
    "Wegener proposed continental drift in 1915. Mainstream geology abandoned it in 1926 for lack of a mechanism. Vine and Matthews's 1963 seafloor magnetic data finally settled the theory.",
  alternates: { canonical: "/stories/continental-drift" },
  openGraph: {
    title: "The Long Abandonment of Wegener",
    description:
      "Continental drift: contested in 1915, abandoned by 1926, settled in 1963 — a three-state trajectory spanning 48 years.",
    url: "/stories/continental-drift",
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

export default async function ContinentalDriftStoryPage() {
  const traj = await getTrajectoryDetail(SLUG);
  if (!traj) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "The Long Abandonment of Wegener: Continental Drift from Ridicule to Revolution",
    url: `${SITE_URL}/stories/continental-drift`,
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
          Case study · Earth sciences
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
          The Long Abandonment of Wegener
        </h1>
        <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
          Continental drift went from CONTESTED in 1915 to ABANDONED in 1926 to SETTLED in
          1963 — one of the clearest three-state arcs in the history of science, and a study
          in why a correct theory can stall for decades without a viable mechanism.
        </p>
      </header>

      <section className="space-y-4 text-gray-300 text-[15px] leading-relaxed max-w-2xl">
        <p>
          In 1915, German meteorologist Alfred Wegener published{" "}
          <em>Die Entstehung der Kontinente und Ozeane</em> (The Origin of Continents and
          Oceans), proposing that the continents had once formed a single supercontinent —
          Pangaea — and had since drifted apart. His evidence was largely geometric: the
          interlocking coastlines of South America and Africa, and matching fossil
          distributions across what are now separated landmasses.
        </p>
        <p>
          The theory entered contested status immediately. Geologists found the jigsaw fit
          persuasive but had no credible physical mechanism by which continents could plow
          through oceanic crust. The dominant alternative — land bridges and vertical crustal
          movement — had established explanatory precedent.
        </p>
        <p>
          In November 1926, an AAPG symposium produced a broadly hostile assessment of
          continental drift. The theory was abandoned by mainstream geology and remained so
          for nearly four decades, while Wegener himself died on a Greenland expedition in
          1930.
        </p>
        <p>
          The trajectory turned on September 7, 1963, when Fred Vine and Drummond Matthews
          published a paper in <em>Nature</em> interpreting magnetic anomaly stripes on the
          ocean floor as evidence of seafloor spreading. The symmetric stripes on either
          side of mid-ocean ridges provided the mechanism Wegener lacked: the ocean floor
          was being continuously created at ridges and destroyed at subduction zones,
          carrying the continents with it. Within a few years, plate tectonics was the
          consensus framework — the settling event the trajectory records.
        </p>
      </section>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-5 py-4 max-w-2xl">
        <p className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-1.5">
          What the ABANDONED state means here
        </p>
        <p className="text-sm text-gray-300 leading-relaxed">
          ABANDONED does not mean falsified. The core empirical claim — that continents
          have moved — was never disproved. The community abandoned it for lack of a
          mechanism, not for contrary evidence. The settling event in 1963 confirmed the
          original claim via a different evidential path. This trajectory is one of the
          clearest examples in the database of an ABANDONED state that later resolves to
          SETTLED.
        </p>
      </div>

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
