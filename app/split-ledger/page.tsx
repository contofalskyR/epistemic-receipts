import type { Metadata } from "next";
import Link from "next/link";
import {
  loadTier1Claims,
  loadTier2Claims,
  loadSplitLedgerCounts,
  COMMUNITY_LABEL,
  TIER2_COMMUNITY_PAIRS,
  PAGE_SIZE,
  type SplitLedgerClaim,
  type CommunityEntry,
} from "@/lib/split-ledger";
import { AXIS_BG_CLASS, AXIS_FALLBACK_BG_CLASS, AXIS_LABEL } from "@/lib/status";
import { TrajectoryDepth } from "@/components/TrajectoryDepth";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Split Ledger — Epistemic Receipts",
  description:
    "Claims where different ratifying communities have reached incompatible conclusions. Not a verdict — a record of where the ledgers disagree.",
  openGraph: {
    title: "Split Ledger — Epistemic Receipts",
    description:
      "386 claims where the expert-literature, institutional, judicial, public, and market communities have recorded incompatible epistemic statuses.",
    url: "/split-ledger",
    siteName: "Epistemic Receipts",
  },
};

// ── Community lane — per-community axis badge row ────────────────────────────

function CommunityLanes({ entries }: { entries: CommunityEntry[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
      {entries.map((e) => {
        const label = COMMUNITY_LABEL[e.community] ?? e.community;
        const badgeClass = AXIS_BG_CLASS[e.latestAxis] ?? AXIS_FALLBACK_BG_CLASS;
        const axisLabel = AXIS_LABEL[e.latestAxis] ?? e.latestAxis;
        const year = e.latestDate.slice(0, 4);
        return (
          <div key={e.community} className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-mono text-gray-500 shrink-0">
              {label}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold shrink-0 ${badgeClass}`}
            >
              {axisLabel}
            </span>
            <span className="text-[10px] font-mono text-gray-600 shrink-0">
              {year}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Claim card ───────────────────────────────────────────────────────────────

function ClaimCard({ claim }: { claim: SplitLedgerClaim }) {
  return (
    <li className="rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/30 px-4 py-3 space-y-2 transition-colors">
      <Link
        href={`/claims/${claim.claimId}`}
        className="block text-sm text-gray-200 hover:text-white transition-colors leading-snug"
      >
        {claim.text.length > 260
          ? claim.text.slice(0, 257) + "…"
          : claim.text}
      </Link>
      <CommunityLanes entries={claim.communityEntries} />
      <TrajectoryDepth
        transitionCount={claim.transitionCount}
        firstYear={claim.firstYear}
        lastYear={claim.lastYear}
      />
    </li>
  );
}

// ── Pagination controls ──────────────────────────────────────────────────────

function Pagination({
  page,
  total,
  buildHref,
}: {
  page: number;
  total: number;
  buildHref: (p: number) => string;
}) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
      {page > 0 && (
        <Link href={buildHref(page - 1)} className="hover:text-gray-300 transition-colors">
          ← prev
        </Link>
      )}
      <span>
        {page + 1} / {totalPages}
      </span>
      {page < totalPages - 1 && (
        <Link href={buildHref(page + 1)} className="hover:text-gray-300 transition-colors">
          next →
        </Link>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function SplitLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ t1page?: string; t2page?: string; pair?: string }>;
}) {
  const { t1page: t1pageRaw, t2page: t2pageRaw, pair: pairRaw } = await searchParams;

  const t1page = Math.max(0, parseInt(t1pageRaw ?? "0", 10) || 0);
  const t2page = Math.max(0, parseInt(t2pageRaw ?? "0", 10) || 0);
  const activePair =
    pairRaw && TIER2_COMMUNITY_PAIRS.includes(decodeURIComponent(pairRaw))
      ? decodeURIComponent(pairRaw)
      : null;

  const [counts, tier1Result, tier2Result] = await Promise.all([
    loadSplitLedgerCounts(),
    loadTier1Claims(t1page),
    loadTier2Claims(activePair, t2page),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="space-y-4">
        <p className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
          The Split Ledger
        </p>
        <h1 className="text-3xl font-bold text-white leading-tight">
          Where the ledgers disagree
        </h1>
        <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
          Of {(counts.tier1 + counts.tier2).toLocaleString()} claims tracked across
          multiple ratifying communities, {counts.tier1.toLocaleString()} have reached
          incompatible conclusions — one community calls the claim{" "}
          <span className="text-emerald-400 font-mono">settled</span> or{" "}
          <span className="text-rose-400 font-mono">reversed</span> while another
          records it as{" "}
          <span className="text-amber-400 font-mono">contested</span>,{" "}
          <span className="text-rose-400 font-mono">reversed</span>, or{" "}
          <span className="text-gray-400 font-mono">abandoned</span>.
        </p>
        <div className="flex flex-wrap gap-4 text-xs font-mono text-gray-500 border-t border-gray-800 pt-4">
          <span>
            <span className="text-rose-400">{counts.tier1.toLocaleString()}</span>{" "}
            conflict claims (Tier 1)
          </span>
          <span>
            <span className="text-gray-300">{counts.tier2.toLocaleString()}</span>{" "}
            stage-lag claims (Tier 2)
          </span>
        </div>
        <div className="text-xs text-gray-600 space-y-1 border border-gray-800 rounded-lg p-3 bg-gray-900/40">
          <p>
            <span className="text-gray-400 font-medium">Absence of a community&apos;s row</span>{" "}
            means that community has no recorded transitions for this claim — not that it agrees.
          </p>
          <p>
            <span className="text-gray-400 font-medium">Conflict</span> means the ledgers
            disagree on current status, not that one is wrong.
          </p>
          <p>No truth verdicts are rendered here — only sourced transition records.</p>
        </div>
      </header>

      {/* ── Tier 1 — Conflict ───────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-900 text-rose-300">
              Tier 1
            </span>
            Conflict
          </h2>
          <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">
            {counts.tier1.toLocaleString()} claims where one community has recorded a{" "}
            <span className="text-emerald-400 font-mono">settled</span> or{" "}
            <span className="text-rose-400 font-mono">reversed</span> conclusion while
            another records a{" "}
            <span className="text-amber-400 font-mono">contested</span>,{" "}
            <span className="text-rose-400 font-mono">reversed</span>, or{" "}
            <span className="text-gray-400 font-mono">abandoned</span>{" "}
            outcome — incompatible endpoints.
          </p>
        </div>

        {tier1Result.claims.length === 0 ? (
          <p className="text-sm text-gray-600 italic">No results for this page.</p>
        ) : (
          <ul className="space-y-3">
            {tier1Result.claims.map((claim) => (
              <ClaimCard key={claim.claimId} claim={claim} />
            ))}
          </ul>
        )}

        <Pagination
          page={t1page}
          total={tier1Result.total}
          buildHref={(p) => {
            const params = new URLSearchParams();
            if (p > 0) params.set("t1page", String(p));
            if (activePair) params.set("pair", activePair);
            const qs = params.toString();
            return `/split-ledger${qs ? "?" + qs : ""}`;
          }}
        />
      </section>

      {/* ── Tier 2 — Stage-lag ──────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300">
              Tier 2
            </span>
            Stage-lag
          </h2>
          <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">
            {counts.tier2.toLocaleString()} claims where communities diverge because they are at
            different stages of the same arc — one at{" "}
            <span className="text-slate-400 font-mono">recorded</span>, another at{" "}
            <span className="text-emerald-400 font-mono">settled</span>. Same arc, different
            stages. This is expected structure, not disagreement.
          </p>
        </div>

        {/* Community pair filter */}
        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-600 uppercase tracking-widest">
            Filter by community pair
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/split-ledger#stage-lag`}
              className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${
                !activePair
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                  : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
              }`}
            >
              All
            </Link>
            {TIER2_COMMUNITY_PAIRS.map((pair) => {
              const parts = pair.split(" ↔ ");
              const shortLabel =
                parts
                  .map((p) =>
                    p
                      .split("_")
                      .map((w) => w[0])
                      .join("")
                  )
                  .join(" ↔ ");
              const isActive = activePair === pair;
              return (
                <Link
                  key={pair}
                  href={`/split-ledger?pair=${encodeURIComponent(pair)}#stage-lag`}
                  className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${
                    isActive
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                      : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
                  }`}
                  title={pair}
                >
                  {shortLabel}
                </Link>
              );
            })}
          </div>
        </div>

        {tier2Result.claims.length === 0 ? (
          <p className="text-sm text-gray-600 italic">No results for this pair.</p>
        ) : (
          <ul className="space-y-3" id="stage-lag">
            {tier2Result.claims.map((claim) => (
              <ClaimCard key={claim.claimId} claim={claim} />
            ))}
          </ul>
        )}

        <Pagination
          page={t2page}
          total={tier2Result.total}
          buildHref={(p) => {
            const params = new URLSearchParams();
            if (p > 0) params.set("t2page", String(p));
            if (activePair) params.set("pair", activePair);
            const qs = params.toString();
            return `/split-ledger${qs ? "?" + qs : ""}#stage-lag`;
          }}
        />
      </section>

      {/* ── Footer links ────────────────────────────────────────────── */}
      <footer className="pt-6 border-t border-gray-800 space-y-3">
        <p className="text-xs text-gray-600">
          Community definitions and ratification criteria:{" "}
          <Link
            href="/communities"
            className="text-amber-400/70 hover:text-amber-300 transition-colors"
          >
            /communities
          </Link>
        </p>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <Link href="/reversals" className="hover:text-gray-400 transition-colors">
            Reversal Index →
          </Link>
          <Link href="/open-questions" className="hover:text-gray-400 transition-colors">
            Open Questions →
          </Link>
          <Link href="/settling-curve" className="hover:text-gray-400 transition-colors">
            Settling Curve Explorer →
          </Link>
        </div>
      </footer>
    </div>
  );
}
