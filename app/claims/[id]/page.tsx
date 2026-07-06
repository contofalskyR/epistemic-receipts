import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatAge, formatEmerged, type EmergedPrecision } from "@/lib/claimAge";
import { getClaimDetail, type ClaimDetail, type EdgeDetail } from "@/lib/claim-detail";
import { SITE_URL } from "@/lib/site";
import { EpistemicAxisBadge, AXIS_CONFIG } from "@/components/EpistemicAxisBadge";
import { ShareButtons } from "@/components/ShareButtons";
import ClaimInteractive from "./ClaimInteractive";
import BookmarkToggle from "./BookmarkToggle";
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
  const axisLabel = (claim.epistemicAxis ? AXIS_CONFIG[claim.epistemicAxis]?.label : null) ?? "Unclassified";
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

// ── Inline timeline for a single claim — lifeline redesign ───────────────────
// Pure server-rendered markup (no hooks). "Today" is the ISR render time —
// at most 24h stale, same freshness as the rest of the page.

function fmtTlDate(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function TlLegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: "#888898" }}>{label}</span>
    </div>
  );
}

function ClaimTimeline({ claim }: { claim: ClaimDetail }) {
  const datedEdges = claim.edges.filter(e => e.source.publishedAt);

  if (datedEdges.length === 0) {
    return (
      <p className="text-xs text-gray-600 italic">
        No dated sources — dots will appear here once sources have publication dates.
      </p>
    );
  }

  const today = new Date();
  const todayTime = today.getTime();
  const PAD_L = 3, PAD_R = 3, RANGE = 94;
  const startTime = Math.min(...datedEdges.map(e => new Date(e.source.publishedAt!).getTime()));
  const totalSpan = Math.max(todayTime - startTime, 1);

  function at(d: Date) {
    return PAD_L + ((d.getTime() - startTime) / totalSpan) * RANGE;
  }

  const todayPct = at(today);

  const nodes = datedEdges
    .map(e => ({ edge: e, date: new Date(e.source.publishedAt!), pct: at(new Date(e.source.publishedAt!)) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const yOff = nodes.map((n, i) => {
    for (let j = 0; j < i; j++) {
      if (Math.abs(nodes[j].pct - n.pct) < 6) return i % 2 === 0 ? 15 : -15;
    }
    return 0;
  });

  const firstPct = nodes[0].pct;
  const lastNode = nodes[nodes.length - 1];
  const dormantYrs = (todayTime - lastNode.date.getTime()) / (365.25 * 86400000);

  const yearTicks: number[] = [];
  let lastYearPct = -Infinity;
  for (let y = new Date(startTime).getFullYear(); y <= today.getFullYear(); y++) {
    const pct = at(new Date(y, 0, 1));
    if (pct >= PAD_L && pct <= 100 - PAD_R && pct - lastYearPct >= 5) {
      yearTicks.push(new Date(y, 0, 1).getTime());
      lastYearPct = pct;
    }
  }

  function voteTag(edge: EdgeDetail) {
    const v = edge.source.legislativeVotes?.[0];
    if (!v) return null;
    const passed = v.passageType === "PASSED";
    return { text: `${v.yesCount ?? 0}–${v.noCount ?? 0} · ${passed ? "PASSED" : "FAILED"}`, color: passed ? "#22c55e" : "#ef4444" };
  }

  const BLUE = "#60a5fa", AMB = "#f0a000", MUT = "#888898";
  const TRACK_H = 170, AY = 106;

  const dormantChipLeft = lastNode.pct + (todayPct - lastNode.pct) / 2;
  const dormantLabel = dormantYrs >= 1
    ? `${(Math.round(dormantYrs * 10) / 10).toFixed(1)} yrs · unreviewed since emergence`
    : `${Math.round(dormantYrs * 12)} mo · unreviewed since emergence`;
  const showDormant = dormantYrs > 0.3 && (todayPct - lastNode.pct) > 4;

  return (
    <div style={{ background: "#0e0e1c", border: "1px solid #1e1e38", borderRadius: 12, position: "relative", padding: "1.4rem 1.75rem 3.25rem", overflow: "hidden" }}>
      {/* gradient tint top-left */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 12,
        background: "radial-gradient(circle at 0% 0%, rgba(96,165,250,0.07) 0%, transparent 55%)" }} />

      {/* legend — top-right */}
      <div style={{ display: "flex", alignItems: "center", gap: 16,
        position: "absolute", top: "1.25rem", right: "1.5rem", zIndex: 2, flexWrap: "wrap" }}>
        <TlLegendDot color={BLUE} label="Emerged" />
        <TlLegendDot color={AMB} label="Today" />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 24, height: 0, borderTop: `2px dashed ${MUT}`, opacity: 0.5 }} />
          <span style={{ fontSize: 11, color: MUT }}>Dormant · no revisions</span>
        </div>
      </div>

      {/* track */}
      <div style={{ position: "relative", height: TRACK_H, marginTop: "1.1rem" }}>

        {/* active axis: left edge → first emerged node */}
        <div style={{ position: "absolute", top: AY, height: 2, left: `${PAD_L}%`,
          width: `${Math.max(0, firstPct - PAD_L)}%`, transform: "translateY(-50%)",
          background: `linear-gradient(to right, rgba(96,165,250,0.25), ${BLUE})`,
          pointerEvents: "none" }} />

        {/* dormant axis: last emerged → today */}
        <div style={{ position: "absolute", top: AY - 1, left: `${lastNode.pct}%`,
          width: `${Math.max(0, todayPct - lastNode.pct)}%`,
          borderTop: "2px dashed rgba(136,136,152,0.35)", pointerEvents: "none" }} />

        {/* year ticks */}
        {yearTicks.map(ts => {
          const pct = at(new Date(ts));
          return (
            <div key={ts}>
              <div style={{ position: "absolute", left: `${pct}%`, top: AY - 4,
                width: 1, height: 8, background: "#1e1e38",
                transform: "translateX(-50%)", pointerEvents: "none" }} />
              <span style={{ position: "absolute", left: `${pct}%`, top: AY + 8,
                transform: "translateX(-50%)", fontSize: 10, color: "#3a3a55",
                whiteSpace: "nowrap", pointerEvents: "none" }}>
                {new Date(ts).getFullYear()}
              </span>
            </div>
          );
        })}

        {/* dormant bracket + chip */}
        {showDormant && (
          <>
            <div style={{ position: "absolute", left: `${lastNode.pct + 0.5}%`,
              width: `${Math.max(0, todayPct - lastNode.pct - 1)}%`,
              top: AY - 20, height: 10, pointerEvents: "none",
              borderTop: "1px solid rgba(240,160,0,0.3)",
              borderLeft: "1px solid rgba(240,160,0,0.3)",
              borderRight: "1px solid rgba(240,160,0,0.3)",
              borderRadius: "3px 3px 0 0" }} />
            <div style={{ position: "absolute", left: `${dormantChipLeft}%`, top: AY - 38,
              transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: 10,
              color: AMB, background: "rgba(240,160,0,0.1)",
              border: "1px solid rgba(240,160,0,0.28)", borderRadius: 20,
              padding: "2px 9px", zIndex: 5, pointerEvents: "none" }}>
              {dormantLabel}
            </div>
          </>
        )}

        {/* today: full-height vertical line */}
        <div style={{ position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0, width: 1,
          background: "rgba(240,160,0,0.18)", transform: "translateX(-50%)",
          pointerEvents: "none" }} />

        {/* today: halo */}
        <div style={{ position: "absolute", left: `${todayPct}%`, top: AY, width: 40, height: 40,
          transform: "translate(-50%, -50%)", borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(240,160,0,0.22) 0%, transparent 68%)" }} />

        {/* today: core */}
        <div style={{ position: "absolute", left: `${todayPct}%`, top: AY, width: 9, height: 9,
          transform: "translate(-50%, -50%)", borderRadius: "50%", background: AMB,
          zIndex: 10 }} />

        {/* today: caption right-below */}
        <div style={{ position: "absolute", left: `${todayPct}%`, top: AY + 8,
          paddingLeft: 10, pointerEvents: "none", zIndex: 5 }}>
          <div style={{ fontSize: 11, color: AMB, fontWeight: 600,
            whiteSpace: "nowrap", lineHeight: 1.3 }}>today</div>
          <div style={{ fontSize: 10, color: MUT,
            whiteSpace: "nowrap", lineHeight: 1.3 }}>{fmtTlDate(today)}</div>
        </div>

        {/* emerged nodes */}
        {nodes.map(({ edge, date, pct }, idx) => {
          const nodeAY = AY + yOff[idx];
          const tag = voteTag(edge);
          return (
            <div key={edge.id} style={{ position: "absolute", left: `${pct}%`, top: nodeAY,
              width: 0, height: 0, zIndex: 3 }}>
              {/* halo */}
              <div style={{ position: "absolute", transform: "translate(-50%,-50%)",
                width: 54, height: 54, borderRadius: "50%", pointerEvents: "none",
                background: "radial-gradient(circle, rgba(96,165,250,0.2) 0%, transparent 68%)" }} />
              {/* ring */}
              <div style={{ position: "absolute", transform: "translate(-50%,-50%)",
                width: 22, height: 22, borderRadius: "50%",
                border: `1.5px solid ${BLUE}`, background: "rgba(96,165,250,0.05)" }} />
              {/* core */}
              <div style={{ position: "absolute", transform: "translate(-50%,-50%)",
                width: 10, height: 10, borderRadius: "50%", background: BLUE, zIndex: 1 }} />
              {/* caption above */}
              <div style={{ position: "absolute", bottom: "calc(50% + 15px)",
                transform: "translateX(-50%)", display: "flex", flexDirection: "column",
                alignItems: "center", paddingBottom: 4, pointerEvents: "none", zIndex: 2 }}>
                <span style={{ fontSize: 10, color: MUT,
                  whiteSpace: "nowrap", lineHeight: 1.4 }}>Claim emerged</span>
                <span style={{ fontSize: 10, color: "#b0b0c8", fontWeight: 500,
                  whiteSpace: "nowrap", lineHeight: 1.4 }}>{fmtTlDate(date)}</span>
                {tag && (
                  <span style={{ fontSize: 9, color: tag.color, whiteSpace: "nowrap",
                    lineHeight: 1.4, marginTop: 1, background: `${tag.color}1a`,
                    border: `1px solid ${tag.color}44`, borderRadius: 4,
                    padding: "1px 4px" }}>{tag.text}</span>
                )}
              </div>
            </div>
          );
        })}

      </div>

    </div>
  );
}

// ── Main page (server component) ─────────────────────────────────────────────
// First response carries the receipt itself — claim text, badges, timeline,
// threshold events, sub-claims — as real HTML. Interactivity (evidence table
// expand, lazy member votes, follow-up panels) hydrates via ClaimInteractive.

export default async function ClaimDetailPage({ params }: Props) {
  const { id } = await params;
  const claim = await getClaimDetail(id);
  if (!claim) notFound();

  const uniqueSources = new Set(claim.edges.map(e => e.source.id)).size;

  return (
    <div className="space-y-10">

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
          <EpistemicAxisBadge axis={claim.epistemicAxis} />
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
        </div>
        <ShareButtons
          url={`${SITE_URL}/claims/${claim.id}`}
          text={`"${claim.text.slice(0, 220)}"${claim.epistemicAxis ? ` — ${claim.epistemicAxis}` : ""} 🧾`}
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
        <ClaimTimeline claim={claim} />
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
                  <EpistemicAxisBadge axis={child.epistemicAxis} />
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
