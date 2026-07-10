import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatAge, formatEmerged, type EmergedPrecision } from "@/lib/claimAge";
import { getClaimDetail } from "@/lib/claim-detail";
import { SITE_URL } from "@/lib/site";
import { claimJsonLd, serializeJsonLd } from "@/lib/jsonld";
import { resolveDisplayAxis } from "@/lib/transition-contract";
import { EpistemicAxisBadge, AXIS_CONFIG } from "@/components/EpistemicAxisBadge";
import { ShareButtons } from "@/components/ShareButtons";
import ClaimInteractive from "./ClaimInteractive";
import AdaptiveClaimTimeline from "./AdaptiveClaimTimeline";
import BookmarkToggle from "./BookmarkToggle";
import FollowClaim from "./FollowClaim";
import AddToCollection from "@/components/AddToCollection";
import CitationButton from "@/components/CitationButton";
import { CLAIM_TYPE_LABEL, CLAIM_TYPE_TOOLTIP, EPISTEMIC_BADGE, formatDate } from "./claim-ui";

// ── ISR ───────────────────────────────────────────────────────────────────────
// ~1.76M claim URLs exist and a crawler can hit any of them cold; every ISR
// miss is a live Neon query (see lib/claim-detail.ts — the query is kept lean
// for exactly this reason). Empty generateStaticParams + revalidate is the
// Next 16 opt-in for on-demand ISR: nothing prerendered at build, each claim
// rendered on first hit, then served from cache for a day.
// NOTE: if `cacheComponents` is ever enabled in next.config.ts, this segment
// config is removed in that model and this page needs migrating.
export const revalidate = 86400;

// Pipelines with ongoing transition-event feeds (SCOTUS overrulings table,
// retraction joins, the OFAC delistings weekly cron, FDA withdrawals) — the
// follow-claim copy promises checked-on-an-ongoing-basis only for these;
// everything else gets expectation-setting copy (handoff §2).
const LIVE_FED_PIPELINES = new Set([
  "courtlistener_scotus_v1",
  "openalex_v1",
  "openalex_journals_v1",
  "crossref_retractions_v1",
  "nasa_exoplanet_v1",
  "ofac_sdn_v1",
  "drugsatfda_v1",
]);

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // React cache() dedupes this with the page render below — one DB query total.
  const claim = await getClaimDetail(id);
  if (!claim) {
    return { title: "Claim not found — Epistemic Receipts", robots: { index: false } };
  }

  const title = `${truncate(claim.text, 90)} — Epistemic Receipts`;
  // Display axis, not the stored column — a reversed claim must not label
  // itself with its stale pre-reversal axis (leak site #5, briefing 17 §4).
  const displayAxis = resolveDisplayAxis(claim);
  const axisLabel = (displayAxis ? AXIS_CONFIG[displayAxis]?.label : null) ?? "Unclassified";
  const uniqueSources = new Set(claim.edges.map(e => e.source.id)).size;
  const latest = claim.statusHistory[0];
  const latestBit = latest
    ? ` · latest transition ${latest.fromAxis ? `${latest.fromAxis} → ` : ""}${latest.toAxis} (${new Date(latest.occurredAt).getUTCFullYear()})`
    : "";
  const description = truncate(
    `${axisLabel}${latestBit} · ${uniqueSources} ${uniqueSources === 1 ? "source" : "sources"} · ` +
    `${claim.edges.length} evidence ${claim.edges.length === 1 ? "link" : "links"} — ${claim.text}`,
    240,
  );

  const canonical = `/claims/${claim.id}`;
  const ogImage = `/api/og/claim?id=${encodeURIComponent(claim.id)}`; // resolved via metadataBase

  return {
    title,
    description,
    alternates: { canonical },
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
    // Retired records stay reachable for the audit trail but out of the index.
    ...(claim.verificationStatus === "DEPRECATED" ? { robots: { index: false } } : {}),
  };
}

// ── Main page (server component) ─────────────────────────────────────────────
// First response carries the receipt itself — claim text, badges, timeline,
// threshold events, sub-claims — as real HTML. Interactivity (evidence table
// expand, lazy member votes, follow-up panels) hydrates via ClaimInteractive.

export default async function ClaimDetailPage({ params }: Props) {
  const { id } = await params;
  const claim = await getClaimDetail(id);
  if (!claim) notFound();

  // Display axis, not the stored column (leak site #5 — briefing 17 §4:
  // every epistemicAxis read goes through resolveDisplayAxis).
  const displayAxis = resolveDisplayAxis(claim);
  const uniqueSources = new Set(claim.edges.map(e => e.source.id)).size;

  return (
    <div className="space-y-10">

      {/* Schema.org JSON-LD — a `Claim` with dated status assertions (briefing 04 §5).
          Deliberately not ClaimReview: we track settling, we don't issue ratings. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(claimJsonLd(claim)) }}
      />

      {/* Breadcrumb */}
      {claim.parent ? (
        <Link href={`/claims/${claim.parent.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
          <span>←</span>
          <span className="line-clamp-1">{claim.parent.text}</span>
        </Link>
      ) : (
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">← all claims</Link>
      )}

      {/* Claim header — the receipt itself */}
      <div className="space-y-3 pb-6 border-b border-dashed border-gray-700">
        <p className="text-xs font-mono uppercase tracking-widest text-gray-500">
          Receipt <span className="text-gray-600">№</span>{" "}
          <span className="text-gray-400" title={claim.id}>{claim.id.slice(-8)}</span>
        </p>
        {claim.verificationStatus === "DEPRECATED" && (
          <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
            This record was retired after a pipeline audit. It is excluded from default views
            and preserved here for the audit trail only.
          </div>
        )}
        <h1 className="text-xl font-semibold text-white leading-snug">{claim.text}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <EpistemicAxisBadge axis={displayAxis} />
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400"
            title={CLAIM_TYPE_TOOLTIP[claim.claimType] ?? ""}
          >
            {CLAIM_TYPE_LABEL[claim.claimType] ?? claim.claimType}
          </span>
          {claim.epistemicStatus && EPISTEMIC_BADGE[claim.epistemicStatus] && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EPISTEMIC_BADGE[claim.epistemicStatus]!.style}`}>
              {EPISTEMIC_BADGE[claim.epistemicStatus]!.label}
            </span>
          )}
          {!claim.humanReviewed && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800/60 text-gray-600 border border-gray-700">
              UNREVIEWED
            </span>
          )}
          {(claim._count?.statusHistory ?? 0) >= 2 && (
            <Link
              href={`/settling-curve?t=${encodeURIComponent(claim.id)}`}
              className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition-colors"
            >
              View settling curve →
            </Link>
          )}
          <BookmarkToggle claimId={claim.id} />
          <AddToCollection claimId={claim.id} />
          <CitationButton type="claim" id={claim.id} />
        </div>
        <FollowClaim claimId={claim.id} liveFed={LIVE_FED_PIPELINES.has(claim.ingestedBy)} />
        <ShareButtons
          url={`${SITE_URL}/claims/${claim.id}`}
          text={`"${claim.text.slice(0, 220)}"${displayAxis ? ` — ${displayAxis}` : ""} 🧾`}
        />
        {claim.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {claim.topics.map(ct => (
              <Link
                key={ct.topic.id}
                href={`/topics/${ct.topic.slug}`}
                className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300 transition-colors"
              >
                {ct.topic.name}
              </Link>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
          {claim.claimEmergedAt && claim.claimEmergedPrecision ? (
            <span>{formatAge(claim.claimEmergedAt, claim.claimEmergedPrecision as EmergedPrecision)} · emerged {formatEmerged(claim.claimEmergedAt, claim.claimEmergedPrecision as EmergedPrecision)}</span>
          ) : (
            <span>added {new Date(claim.createdAt).toLocaleDateString("en-US")}</span>
          )}
          <span>{uniqueSources} {uniqueSources === 1 ? "source" : "sources"}</span>
          <span>{claim.edges.length} evidence {claim.edges.length === 1 ? "link" : "links"}</span>
          {claim.ingestedBy && (
            <span className="font-mono text-gray-600" title="Ingestion pipeline that produced this record">
              via {claim.ingestedBy}
            </span>
          )}
          {claim.thresholdEvents.length > 0 && (
            <span className="text-green-500">{claim.thresholdEvents.length} threshold {claim.thresholdEvents.length === 1 ? "event" : "events"}</span>
          )}
          {claim.edges.length > 0 && (
            <span className="flex items-center gap-2 ml-auto">
              <span className="text-gray-600 font-mono tracking-widest" style={{ fontSize: 10 }}>CITE</span>
              {(["bibtex", "ris"] as const).map((fmt) => (
                <a
                  key={fmt}
                  href={`/api/claims/${claim.id}/cite?format=${fmt}`}
                  className="font-mono hover:text-gray-300 transition-colors"
                  style={{ fontSize: 10, letterSpacing: "0.04em", border: "1px solid #2a2a3a", borderRadius: 3, padding: "1px 6px" }}
                >
                  {fmt === "bibtex" ? "BibTeX" : "RIS"}↓
                </a>
              ))}
            </span>
          )}
        </div>
      </div>

      {/* Threshold events */}
      {claim.thresholdEvents.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Threshold events</h2>
          {claim.thresholdEvents.map(te => {
            let snapshot: { edges?: { id: string; score: number }[] } = {};
            try { snapshot = JSON.parse(te.evidenceSnapshot); } catch { /* raw */ }
            return (
              <div key={te.id} className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-4 space-y-2">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <p className="text-sm font-medium text-white">{te.triggeredBy}</p>
                  <span className="text-xs text-gray-500 shrink-0">{formatDate(te.createdAt)}</span>
                </div>
                {te.triggeredBySource && (
                  <p className="text-xs text-gray-400">
                    Source:{" "}
                    {te.triggeredBySource.url ? (
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        <a href={te.triggeredBySource.url} target="_blank" rel="noopener noreferrer"
                          className="text-gray-200 hover:underline">
                          {te.triggeredBySource.name}
                        </a>
                        {te.triggeredBySource.url.startsWith('https://doi.org/') ? (
                          <>
                            <a href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(te.triggeredBySource.url.replace('https://doi.org/', ''))}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-xs px-1 py-0.5 rounded bg-blue-900/50 text-blue-400 hover:text-blue-300">PubMed ↗</a>
                            <a href={`https://www.semanticscholar.org/search?q=${encodeURIComponent(te.triggeredBySource.url.replace('https://doi.org/', ''))}&sort=Relevance`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-xs px-1 py-0.5 rounded bg-purple-900/50 text-purple-400 hover:text-purple-300">S2 ↗</a>
                          </>
                        ) : (
                          <a href={`https://scholar.google.com/scholar?q=${encodeURIComponent(te.triggeredBySource.name)}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs px-1 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-gray-300">Scholar ↗</a>
                        )}
                      </span>
                    ) : (
                      <span>{te.triggeredBySource.name}</span>
                    )}
                  </p>
                )}
                <p className="text-xs text-gray-500">Confirmed by: {te.confirmedBy}</p>
                {te.note && <p className="text-sm text-gray-300 leading-relaxed">{te.note}</p>}
                {snapshot.edges && snapshot.edges.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide">Evidence snapshot</p>
                    <div className="flex flex-wrap gap-2">
                      {snapshot.edges.map(e => (
                        <span key={e.id} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                          {e.id.slice(-6)} · {e.score}/100
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Embedded timeline */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Timeline</h2>
        <AdaptiveClaimTimeline claim={claim} displayAxis={displayAxis} todayIso={new Date().toISOString()} />
      </section>

      {/* Evidence table + follow-up/relations panels (client island) */}
      <ClaimInteractive claim={claim} />

      {/* Child claims */}
      {claim.children.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Frames &amp; sub-claims
            <span className="ml-2 text-gray-700 font-normal normal-case tracking-normal">({claim.children.length})</span>
          </h2>
          <div className="space-y-2">
            {claim.children.map(child => (
              <Link key={child.id} href={`/claims/${child.id}`}
                className="block rounded-md border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600 hover:bg-gray-800 transition-colors group">
                <p className="text-sm text-gray-300 group-hover:text-white transition-colors leading-snug line-clamp-2">
                  {child.text}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <EpistemicAxisBadge axis={resolveDisplayAxis(child)} />
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400">
                    {CLAIM_TYPE_LABEL[child.claimType] ?? child.claimType}
                  </span>
                  <span className="text-xs text-gray-600">
                    {child._count.edges} {child._count.edges === 1 ? "source" : "sources"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
