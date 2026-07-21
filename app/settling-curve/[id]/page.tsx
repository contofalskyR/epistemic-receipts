import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrajectoryDetail } from "@/lib/trajectory-detail";
import { serializeJsonLd, trajectoryJsonLd } from "@/lib/jsonld";
import CitationButton from "@/components/CitationButton";
import EmbedButton from "@/components/EmbedButton";
import FollowButton from "@/app/components/FollowButton";
import { DOMAIN_TRAJECTORIES } from "@/lib/domain-trajectories";
import { SITE_URL } from "@/lib/site";

const CURATED_SLUGS = new Set(Object.values(DOMAIN_TRAJECTORIES).flat());

// ISR: empty generateStaticParams = on-demand ISR (render on first hit, cache
// for a day). Do NOT add `export const dynamic = 'force-dynamic'` — it defeats ISR.
export const revalidate = 86400;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // React cache() dedupes this with the page render — one DB query total.
  const traj = await getTrajectoryDetail(id);
  if (!traj) {
    return { title: "Trajectory not found — Epistemic Receipts", robots: { index: false } };
  }

  const axisSequence = traj.transitions.length > 0
    ? traj.transitions.map(t => t.toAxis).filter((v, i, a) => i === 0 || v !== a[i - 1]).join(" → ")
    : null;

  const title = axisSequence
    ? `${truncate(traj.claimText, 70)} · ${axisSequence} — Epistemic Receipts`
    : `${truncate(traj.claimText, 100)} — Epistemic Receipts`;

  const firstDate = traj.transitions[0]?.occurredAt
    ? new Date(traj.transitions[0].occurredAt).getUTCFullYear()
    : null;
  const lastDate = traj.transitions[traj.transitions.length - 1]?.occurredAt
    ? new Date(traj.transitions[traj.transitions.length - 1]!.occurredAt).getUTCFullYear()
    : null;
  const dateRange = firstDate && lastDate && firstDate !== lastDate
    ? `${firstDate}–${lastDate}`
    : firstDate ? String(firstDate) : null;

  const description = truncate(
    `${traj.transitions.length} epistemic transition${traj.transitions.length !== 1 ? "s" : ""}` +
    (dateRange ? ` (${dateRange})` : "") +
    ` — ${traj.claimText}`,
    240,
  );

  const canonical = `/settling-curve/${id}`;
  const ogImage = `/api/og/trajectory?id=${encodeURIComponent(id)}`;

  const oEmbedUrl = `${SITE_URL}/api/oembed?url=${encodeURIComponent(SITE_URL + canonical)}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      types: { "application/json+oembed": oEmbedUrl },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Epistemic Receipts",
      type: "article",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

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

export default async function TrajectoryPermalinkPage({ params }: Props) {
  const { id } = await params;
  const traj = await getTrajectoryDetail(id);
  if (!traj) notFound();

  const firstYear = traj.transitions[0]?.occurredAt
    ? new Date(traj.transitions[0].occurredAt).getUTCFullYear()
    : null;
  const lastYear = traj.transitions[traj.transitions.length - 1]?.occurredAt
    ? new Date(traj.transitions[traj.transitions.length - 1]!.occurredAt).getUTCFullYear()
    : null;

  return (
    <div className="space-y-10">

      {/* Breadcrumb */}
      <Link href="/settling-curve" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
        ← settling curves
      </Link>

      {/* Header */}
      <div className="space-y-3 pb-6 border-b border-dashed border-gray-700">
        <p className="text-xs font-mono uppercase tracking-widest text-gray-500">
          Settling Curve <span className="text-gray-600">№</span>{" "}
          <span className="text-gray-400" title={id}>{id.slice(-8)}</span>
        </p>
        <h1 className="text-xl font-semibold text-white leading-snug">{traj.claimText}</h1>
        <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
          {firstYear && lastYear && (
            <span>{firstYear === lastYear ? String(firstYear) : `${firstYear} – ${lastYear}`}</span>
          )}
          <span>{traj.transitions.length} transition{traj.transitions.length !== 1 ? "s" : ""}</span>
          {traj.ingestedBy && (
            <span className="font-mono text-gray-600" title="Ingestion pipeline">via {traj.ingestedBy}</span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href={`/settling-curve?t=${encodeURIComponent(traj.claimId)}`}
            className="text-xs px-3 py-1 rounded-full font-medium bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition-colors"
          >
            Open interactive curve →
          </Link>
          <Link
            href={`/claims/${traj.claimId}`}
            className="text-xs px-3 py-1 rounded-full font-medium bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          >
            View claim page →
          </Link>
          <FollowButton entityType="trajectory" entityId={id} />
          <CitationButton type="claim" id={traj.claimId} />
          <EmbedButton
            slug={CURATED_SLUGS.has(id) ? id : undefined}
            claimId={traj.claimId}
            title={traj.claimText.slice(0, 80)}
            siteUrl={SITE_URL}
          />
        </div>
      </div>

      {/* Transition log */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Transition log
          <span className="ml-2 text-gray-700 font-normal normal-case tracking-normal">
            ({traj.transitions.length})
          </span>
        </h2>
        {traj.transitions.length === 0 ? (
          <p className="text-sm text-gray-600 italic">No transitions recorded.</p>
        ) : (
          <ol className="space-y-3">
            {traj.transitions.map((t, i) => (
              <li key={i} className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-4 space-y-2">
                {/* Arrow */}
                <div className="flex items-center gap-2 flex-wrap">
                  {t.fromAxis ? (
                    <>
                      <span className="text-xs font-mono text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                        {t.fromAxis}
                      </span>
                      <span className="text-gray-600">→</span>
                    </>
                  ) : (
                    <span className="text-xs font-mono text-gray-600 bg-gray-800/50 px-2 py-0.5 rounded">
                      (initial)
                    </span>
                  )}
                  <span className="text-xs font-mono text-white bg-gray-700 px-2 py-0.5 rounded">
                    {t.toAxis}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {fmtDate(t.occurredAt, t.datePrecision)}
                  </span>
                </div>
                {/* Community */}
                <p className="text-xs text-gray-500">
                  Community:{" "}
                  <span className="text-gray-300">
                    {t.community.replace(/_/g, " ").toLowerCase()}
                  </span>
                </p>
                {/* Reason */}
                {t.reason && (
                  <p className="text-sm text-gray-300 leading-relaxed">{t.reason}</p>
                )}
                {/* Source */}
                {t.markerSource && (
                  <p className="text-xs text-gray-500">
                    Source:{" "}
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
        )}
      </section>

      {/* Schema.org JSON-LD — Dataset of dated transitions (briefing 04 §5).
          Replaces the earlier thin Article stub; transitions are the data. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(trajectoryJsonLd(traj, id)) }}
      />
    </div>
  );
}
