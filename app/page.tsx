"use client";
import { useEffect, useState, useRef, useCallback, Suspense, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BlackHoleCanvas from "@/app/components/BlackHoleCanvas";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClaimHit = {
  id: string;
  text: string;
  currentStatus: string;
  epistemicAxis: string | null;
  claimType: string;
  ingestedBy: string;
  verificationStatus: string | null;
  epistemicStatus: string | null;
  createdAt: string;
  claimEmergedAt: string | null;
  sourceName: string | null;
  topicLabel: string | null;
};

type SourceHit = {
  id: string;
  name: string;
  url: string | null;
  methodologyType: string;
  ingestedBy: string;
  firstClaimId: string | null;
};

type SearchResponse = {
  query: string;
  counts: { claims: number; sources: number };
  claims: ClaimHit[];
  sources: SourceHit[];
  message?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_QUERY = 3;
const RESULT_LIMIT = 8;

const PLACEHOLDER_EXAMPLES = [
  "climate policy",
  "CRISPR",
  "NATO expansion",
  "fentanyl regulations",
  "cognitive dissonance",
  "vaccine trials",
  "Cuban Missile Crisis",
];

// Hand-picked topic chips. Labels are the search term; href points to a topic page
// when one exists, otherwise the chip just runs the inline search.
type TopicChip = { label: string; query: string; href?: string };

const TOPIC_CHIPS: TopicChip[] = [
  { label: "Climate",       query: "climate",      href: "/topics/environment" },
  { label: "Neuroscience",  query: "neuroscience", href: "/neuroscience" },
  { label: "US Congress",   query: "Congress",     href: "/legislation" },
  { label: "Cold War",      query: "Cold War" },
  { label: "Vaccines",      query: "vaccine" },
  { label: "Supreme Court", query: "Supreme Court" },
  { label: "Chemistry",     query: "chemistry",    href: "/chemistry" },
  { label: "Nobel Prize",   query: "Nobel",        href: "/topics/nobel-prizes" },
  { label: "Earthquakes",   query: "earthquake" },
  { label: "Retractions",   query: "retracted" },
];

const STATUS_STYLE: Record<string, string> = {
  HARD_FACT:      "bg-green-900 text-green-300",
  NEVER_RESOLVES: "bg-gray-700 text-gray-400",
  DISPUTED:       "bg-yellow-900 text-yellow-300",
};

const STATUS_LABEL: Record<string, string> = {
  HARD_FACT:      "Hard Fact",
  NEVER_RESOLVES: "Never Resolves",
  DISPUTED:       "Disputed",
};

const STATUS_TOOLTIP: Record<string, string> = {
  HARD_FACT:      "Independently verified across multiple primary sources",
  NEVER_RESOLVES: "Definitionally true — not subject to empirical falsification",
  DISPUTED:       "Conflicting evidence or contested by authoritative sources",
};

const TYPE_LABEL: Record<string, string> = {
  EMPIRICAL:      "Empirical",
  INSTITUTIONAL:  "Institutional",
  INTERPRETIVE:   "Interpretive",
  HYBRID:         "Hybrid",
};

const TYPE_TOOLTIP: Record<string, string> = {
  EMPIRICAL:     "A factual claim grounded in observable, measurable evidence",
  INSTITUTIONAL: "A claim about laws, rules, or official decisions by institutions",
  INTERPRETIVE:  "A claim that involves inference or expert judgment",
  HYBRID:        "Combines empirical data with institutional or interpretive framing",
};

const EPISTEMIC_BADGE: Record<string, { label: string; style: string }> = {
  confirmed:         { label: "Confirmed ✓",      style: "bg-green-900/70 text-green-300 border border-green-700/50" },
  retracted:         { label: "Retracted ✗",      style: "bg-red-900/70 text-red-300 border border-red-700/50" },
  candidate:         { label: "Candidate",         style: "bg-yellow-900/70 text-yellow-300 border border-yellow-700/50" },
  false_positive:    { label: "False Positive",    style: "bg-gray-700/70 text-gray-400 border border-gray-600/50" },
  contested_dissent: { label: "Split Decision",    style: "bg-orange-900/70 text-orange-300 border border-orange-700/50" },
  registered_trial:  { label: "Registered Trial",  style: "bg-blue-900/70 text-blue-300 border border-blue-700/50" },
  active_trial:      { label: "Active Trial",      style: "bg-blue-900/70 text-blue-300 border border-blue-700/50" },
  completed_trial:   { label: "Completed Trial",   style: "bg-cyan-900/70 text-cyan-300 border border-cyan-700/50" },
  approved:          { label: "FDA Approved",      style: "bg-emerald-900/70 text-emerald-300 border border-emerald-700/50" },
  established:       { label: "Established",       style: "bg-teal-900/70 text-teal-300 border border-teal-700/50" },
  settled_judgment:  { label: "Settled Judgment",  style: "bg-indigo-900/70 text-indigo-300 border border-indigo-700/50" },
  contested:         { label: "Contested",         style: "bg-orange-900/70 text-orange-300 border border-orange-700/50" },
};

function truncate(text: string, n = 200): string {
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + "…";
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-400/20 text-yellow-200 rounded-sm px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

// ─── Inline result card ───────────────────────────────────────────────────────

function ClaimResult({ claim, query, index }: { claim: ClaimHit; query: string; index: number }) {
  const displayText = truncate(claim.text);
  const year = claim.claimEmergedAt
    ? new Date(claim.claimEmergedAt).getFullYear()
    : claim.createdAt
    ? new Date(claim.createdAt).getFullYear()
    : null;

  return (
    <Link
      href={`/claims/${claim.id}`}
      className="block rounded-lg border border-gray-800 bg-gray-900/80 backdrop-blur-sm px-4 py-3 hover:border-gray-600 transition-colors group opacity-0"
      style={{
        animation: "result-in 0.35s ease forwards",
        animationDelay: `${index * 70}ms`,
      }}
    >
      {/* Claim text */}
      <p className="text-sm text-gray-200 group-hover:text-white leading-relaxed">
        <Highlighted text={displayText} query={query} />
      </p>

      {/* Source + year line */}
      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
        {claim.sourceName && (
          <span className="truncate flex-1">
            <span className="text-gray-600">From:</span> {claim.sourceName}
          </span>
        )}
        {year && (
          <span className="shrink-0 font-mono text-gray-600">{year}</span>
        )}
      </div>

      {/* Metadata badges + timeline hint */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <EpistemicAxisBadge axis={claim.epistemicAxis} />
          {claim.topicLabel && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-950 text-indigo-300">
              {claim.topicLabel}
            </span>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400"
            title={TYPE_TOOLTIP[claim.claimType] ?? ""}
          >
            {TYPE_LABEL[claim.claimType] ?? claim.claimType}
          </span>
          {claim.epistemicStatus && EPISTEMIC_BADGE[claim.epistemicStatus] && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EPISTEMIC_BADGE[claim.epistemicStatus]!.style}`}>
              {EPISTEMIC_BADGE[claim.epistemicStatus]!.label}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-700 group-hover:text-gray-500 transition-colors shrink-0 ml-2">
          Evidence trail →
        </span>
      </div>
    </Link>
  );
}

// ─── Missing state ────────────────────────────────────────────────────────────

function MissingState({ query }: { query: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [, startTransition] = useTransition();

  function suggest() {
    setStatus("sending");
    startTransition(() => {
      fetch("/api/search/miss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
        .then(r => setStatus(r.ok ? "sent" : "error"))
        .catch(() => setStatus("error"));
    });
  }

  return (
    <div
      className="rounded-xl border border-gray-800 bg-gray-900/60 backdrop-blur-sm px-6 py-8 text-center space-y-4"
      style={{ animation: "result-in 0.35s ease forwards" }}
    >
      <div className="text-3xl">🔭</div>
      <div className="space-y-1">
        <p className="text-gray-200 font-medium">
          Nothing found for &ldquo;{query}&rdquo;
        </p>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          This topic isn&apos;t in our database yet. Try a broader term, or let us know — we track what&apos;s missing and prioritize additions based on demand.
        </p>
      </div>

      {status === "idle" && (
        <button
          onClick={suggest}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
        >
          Suggest this topic
        </button>
      )}
      {status === "sending" && (
        <p className="text-xs text-gray-500 font-mono">Sending…</p>
      )}
      {status === "sent" && (
        <p className="text-sm text-green-400">
          Got it — we&apos;ll look into adding &ldquo;{query}&rdquo;.
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-400">Couldn&apos;t send. Try again later.</p>
      )}

      <p className="text-xs text-gray-600 pt-1">
        Or try one of the topic chips above to explore what we do have.
      </p>
    </div>
  );
}

// ─── Results legend ───────────────────────────────────────────────────────────

function ResultsLegend() {
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-900/40 backdrop-blur-sm px-4 py-3 text-xs text-gray-500 space-y-1.5"
      style={{ animation: "result-in 0.3s ease forwards" }}>
      <p className="text-gray-400 font-medium">What you&apos;re looking at</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        <span><span className="text-green-400">Hard Fact</span> — verified across independent sources</span>
        <span><span className="text-yellow-400">Disputed</span> — contested or conflicting evidence</span>
        <span><span className="text-indigo-400">Topic badge</span> — the field this claim belongs to</span>
        <span><span className="text-gray-300">Evidence trail →</span> — click to see timeline &amp; sources</span>
      </div>
    </div>
  );
}

// ─── Cycling placeholder hook ─────────────────────────────────────────────────

function useCyclingPlaceholder(examples: string[], intervalMs = 2400) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % examples.length), intervalMs);
    return () => clearInterval(id);
  }, [examples.length, intervalMs]);
  return `Try "${examples[idx]}"…`;
}

// ─── Hero / search UI ─────────────────────────────────────────────────────────

function HomeContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const urlQ         = searchParams.get("q") ?? "";

  const [input, setInput] = useState(urlQ);
  const [data, setData]   = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef    = useRef<AbortController | null>(null);

  const placeholder = useCyclingPlaceholder(PLACEHOLDER_EXAMPLES);

  // Run search when input is long enough; debounce 300ms
  useEffect(() => {
    const q = input.trim();
    clearTimeout(debounceRef.current);

    if (q.length < MIN_QUERY) {
      setData(null);
      setLoading(false);
      setError(null);
      abortRef.current?.abort();
      return;
    }

    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${RESULT_LIMIT}&type=claims`, {
        signal: controller.signal,
      })
        .then(async r => {
          if (!r.ok) throw new Error(`Search failed (${r.status})`);
          return (await r.json()) as SearchResponse;
        })
        .then(d => { setData(d); setLoading(false); })
        .catch(err => {
          if (err.name === "AbortError") return;
          setError(err.message || "Search failed");
          setLoading(false);
        });
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [input]);

  // Keep URL in sync (shallow) so /?q=X is a shareable link
  useEffect(() => {
    const q = input.trim();
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    const qs = next.toString();
    const target = qs ? `/?${qs}` : "/";
    router.replace(target, { scroll: false });
  }, [input, router]);

  const handleChipClick = useCallback((chip: TopicChip) => {
    setInput(chip.query);
  }, []);

  const trimmed = input.trim();
  const showResults = trimmed.length >= MIN_QUERY;
  const hasHits = data && (data.claims.length > 0);

  return (
    <div className="relative">
      <BlackHoleCanvas />

      {/* Hero */}
      <section className="relative pt-12 pb-8 sm:pt-20 sm:pb-12 max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-5xl font-semibold text-white text-center tracking-tight leading-tight">
          What would you like to learn about?
        </h1>

        <div className="mt-8 sm:mt-10">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={placeholder}
              autoFocus
              className="w-full bg-gray-900/80 backdrop-blur-sm border border-gray-700 text-gray-100 text-base sm:text-lg rounded-xl px-5 py-4 placeholder-gray-500 focus:outline-none focus:border-gray-400 focus:bg-gray-900 transition-colors shadow-2xl"
              aria-label="Search Epistemic Receipts"
            />
            {loading && (
              <span
                className="absolute right-5 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-mono"
                aria-hidden="true"
              >
                searching…
              </span>
            )}
          </div>

          {/* Topic chips */}
          <div className="mt-5 flex flex-wrap gap-2 justify-center">
            {TOPIC_CHIPS.map(chip => (
              <button
                key={chip.label}
                onClick={() => handleChipClick(chip)}
                className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-gray-700 bg-gray-900/60 backdrop-blur-sm text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Onboarding copy — implicit philosophy */}
          <div className="mt-6 text-center text-sm text-gray-500 space-y-1">
            <p>Every claim is sourced. Every source is traceable.</p>
            <p>Start with a question.</p>
          </div>
        </div>
      </section>

      {/* Below-fold: solid background covers the fixed canvas */}
      <div className="relative bg-gray-950">

      {/* Inline search results — only reserve vertical space when a search is active */}
      <section className={`relative max-w-3xl mx-auto ${showResults ? "pb-16 min-h-[40vh]" : ""}`}>
        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}

        {showResults && !error && data && !loading && hasHits && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                {data.counts.claims.toLocaleString()} {data.counts.claims === 1 ? "result" : "results"} for &ldquo;{trimmed}&rdquo;
              </p>
            </div>
            <ResultsLegend />
            {data.claims.map((c, i) => <ClaimResult key={c.id} claim={c} query={trimmed} index={i} />)}
            {data.counts.claims > data.claims.length && (
              <Link
                href={`/search?q=${encodeURIComponent(trimmed)}`}
                className="block text-center text-sm text-blue-400 hover:text-blue-300 transition-colors pt-2"
              >
                See all {data.counts.claims.toLocaleString()} results →
              </Link>
            )}
          </div>
        )}

        {showResults && !error && data && !loading && !hasHits && (
          <MissingState query={trimmed} />
        )}

        {!showResults && trimmed.length > 0 && (
          <p className="text-xs text-gray-600 text-center italic">
            Keep typing — at least {MIN_QUERY} characters.
          </p>
        )}
      </section>

      {/* Recent additions (formerly "What's New") */}
      <section className="relative max-w-3xl mx-auto pt-8 pb-16 border-t border-gray-800/60">
        <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-5">
          Recent additions
        </h2>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 8, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Filter chip cleanup on the destination pages.{" "}
              <Link href="/congress-trades" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">Congress Trades</Link>{" "}
              replaces the inert high/medium/low &ldquo;Correlation&rdquo; chip with a binary{" "}
              <span className="font-mono">Voting record</span> filter (All / Has voting history) wired to the 140k <span className="font-mono">LegislativeVote</span> + 1.45M <span className="font-mono">MemberVote</span> tables &mdash; ~73% of disclosed traders have a recorded roll-call match by bioguide ID or exact name.{" "}
              <Link href="/retraction-explorer" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">Retraction Explorer</Link>{" "}
              hides its &ldquo;Field&rdquo; chip until <span className="font-mono">ClaimTopic</span> enrichment lands across the 26k retracted papers.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 8, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Epistemic axis badges are now live across the site. Every claim card on{" "}
              <Link href="/search" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/search</Link>,{" "}
              the homepage, claim detail pages, bookmarks, topics, and field pages now shows whether a claim is{" "}
              <span className="text-emerald-300">Settled</span>,{" "}
              <span className="text-amber-300">Contested</span>,{" "}
              <span className="text-slate-300">Recorded</span>,{" "}
              <span className="text-blue-300">Open</span>, or{" "}
              <span className="text-violet-300">Unresolvable</span>{" "}
              &mdash; the five values of the <span className="font-mono">epistemicAxis</span> field backfilled across 1.47M of 1.50M active claims (98%). Search now supports an{" "}
              <span className="font-mono">?axis=</span> filter chip (All / Settled / Contested / Recorded / Open).
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 8, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Bug fixes: House member full names (Nancy Pelosi, not just &ldquo;Pelosi&rdquo;) backfilled across 728 House members via Voteview&apos;s <span className="font-mono">HSall_members.csv</span> &mdash; the House Clerk XML only exposes last names. Homepage no longer reserves a blank{" "}
              <span className="font-mono">min-h-[40vh]</span>{" "}
              zone when no search is active. Retraction Wall&apos;s &ldquo;Papers whose retraction ripples furthest&rdquo; rows now deep-link to <Link href="/retraction-explorer" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/retraction-explorer</Link> filtered by DOI. Vote detail pages now explain why member-level votes are missing for Voteview rollcalls.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 8, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Destination pages Phase 1 shipped:{" "}
              <Link href="/congress-trades" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">Congress Trades</Link>{" "}
              and{" "}
              <Link href="/retraction-explorer" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">Retraction Explorer</Link>.
              {" "}Congress Trades replaces /stock-act (permanent redirect in place) with a redesigned card view and shared DestinationNav.
              Retraction Explorer surfaces all 26,600+ CrossRef retracted papers with search, type filters, and expandable DOI details.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 8, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              V-Dem + WHO GHO pipelines expanded and active. V-Dem democracy indicators: 19,777 country-year claims across 183 countries (1900–2026) covering electoral, liberal, participatory, egalitarian, and deliberative democracy indices.
              WHO Global Health Observatory expanded to 8 indicators (life expectancy, healthy life expectancy, infant and under-5 mortality, obesity, PM2.5, alcohol consumption, safe sanitation) across all countries for 2000–2023 — ~46,000 new health-metric claims.
              Both pipelines visible on <Link href="/datasets" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/datasets</Link>.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 8, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              <Link href="/opinions" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">Court Opinions browser</Link>{" "}
              — 2,000+ U.S. court opinions from CourtListener (SCOTUS, federal circuits, state supreme courts, BIA, Tax Court) are now browseable at{" "}
              <Link href="/opinions" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/opinions</Link>.
              Filter by court type and date range. Each row links to the full claim detail page. Bill↔court opinion links will populate as the opinion-body enrichment pipeline completes.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 8, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              <Link href="/retractions" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">Retraction Feed API</Link>{" "}
              — public JSON and RSS endpoints for the 26,600+ retracted papers in our index. Filter by field, journal, or date. Subscribe in any feed reader at{" "}
              <code className="font-mono text-gray-500">/api/retractions/rss</code>. Full API docs and example response at{" "}
              <Link href="/retractions" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/retractions</Link>.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 8, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              <Link href="/stock-act" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">Congressional Stock Trades</Link>{" "}
              — 921 STOCK Act Periodic Transaction Reports from House and Senate members, sourced from Quiver Quantitative. Filter by chamber, party, or ticker. Includes excess return vs. S&amp;P 500 for each disclosed trade. Most Active Traders leaderboard shows top filers by volume. Member names link to their full vote history on{" "}
              <Link href="/members" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/members</Link>.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 8, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Voteview surface: the full 113,000+ congressional roll-call corpus is now browsable at{" "}
              <Link href="/votes" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/votes</Link>{" "}
              with chamber / result / presidency / era filters. Each roll call links to a detail page (<span className="font-mono">/votes/[id]</span>) showing the full description, yea/nay/abstain breakdown, per-party unity scores, and member-level votes sorted by party. New{" "}
              <Link href="/members" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/members</Link>{" "}
              search indexes House and Senate members by bioguide ID; each profile shows the member&apos;s vote history, party-unity %, chamber breakdown, and party history.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 8, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              <Link href="/retraction-wall" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">Retraction Wall</Link>{" "}
              is live: 26,624 retracted papers tracked, 11,319 automatic dispute propagations from CrossRef retractions to their OpenAlex originals. New{" "}
              <Link href="/corrections" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">Corrections</Link>{" "}
              page (linked in the footer) is our public audit log &mdash; pipelines retired, records flagged DEPRECATED, schema diagnostics that changed how we read existing data. No hard deletes; every deprecation carries a written reason.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 7, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Contested Receipts: epistemic status badges now appear on claim cards (approved, retracted, registered_trial, confirmed, settled_judgment, and more) — backfilled across 191,971 claims from pipeline-native data. 11,319 CONTRADICTS relations created linking CrossRef retractions to their OpenAlex originals. New <Link href="/settling-curve" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">Settling Curve</Link> demo traces semaglutide&apos;s epistemic arc from Phase 3 trials through FDA approval to ongoing safety surveillance.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 7, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              ICC Cases pipeline (<span className="font-mono">icc_cases_v1</span>): 35 claims covering indictments, trials, and judgments across 27 ICC cases — DRC, Uganda, Darfur, Kenya, Libya, Central African Republic, Mali, and the Philippines. Fetches from the official ICC case pages via Wayback Machine fallback. Topics: <span className="font-mono">icc-cases</span> under <span className="font-mono">international-law</span>.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 7, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Bug fixes: claim detail pages were returning 500 (stale Prisma client referencing the dropped <span className="font-mono">Claim.academicFieldId</span> column) — regenerated. Nav dropdowns were being obscured by page content because the <span className="font-mono">backdrop-blur</span> stacking context had no <span className="font-mono">z-index</span>; the nav now sits at <span className="font-mono">z-50</span>.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 7, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Homepage redesigned as a search-first discovery experience. Three new Wikidata SPARQL ingesters: <span className="font-mono">wikidata_nobel_v1</span> (1,023 laureates), <span className="font-mono">wikidata_elements_v1</span> (118 elements), <span className="font-mono">wikidata_space_missions_v1</span> (500 missions). Physiology taxonomy: 18 biological families across cardiovascular, renal, neurological, immune, endocrine, and reproductive systems. New <span className="font-mono">FUNDED_BY</span> ClaimRelations link OpenAlex publications to the NIH Reporter grants that funded them (via <span className="font-mono">awards.funder_award_id</span>). Bills-to-court linker (<span className="font-mono">link-bills-to-court.ts</span>) added — first run produced 0 links because CourtListener claim text is currently a templated case-name summary; the script will activate once opinion bodies or statutes-cited lists land on those claims.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 6, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              What&apos;s New feed at <Link href="/feed" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/feed</Link> shows recent additions and activity on your bookmarks. Globe heatmap now supports category filters. 26 taxonomy pages consolidated at <Link href="/fields" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/fields</Link>.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 5, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              History taxonomy: 24 families, 288 entries from prehistory to 2026. Sociology taxonomy: 22 families, 265 entries with foundational theorists and open questions.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 2, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Statistics methods reference at <Link href="/statistics/methods" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/statistics/methods</Link> — interactive deep-dives on the 10 most-cited methods. Retracted papers now marked DISPUTED across the app (11,319 claims updated).
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/feed"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            See the full feed →
          </Link>
        </div>
      </section>

      </div>{/* end below-fold cover */}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <HomeContent />
    </Suspense>
  );
}
