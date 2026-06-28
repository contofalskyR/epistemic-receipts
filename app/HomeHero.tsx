"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";
import { DISCOVERY_HOOKS } from "@/lib/discovery-rail";

// ─── Types ────────────────────────────────────────────────────────────────────

// One curated, server-rendered hero card. `mini` is a <SettlingCurveMini> element
// rendered on the server in app/page.tsx and handed down — the hero stays a thin
// client island and never re-fetches or re-computes the SVG.
export type HeroCard = {
  id: string;
  eyebrow: string;
  eyebrowColor: string;
  hook: string;
  claim: string;
  endLabel: string; // human label of the final epistemic state, e.g. "Settled"
  span: string; // "1996 → 2021"
  milestoneCount: number;
  mini: ReactNode;
};

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

// ─── Terminal Spinner ─────────────────────────────────────────────────────────

const SPINNER_FRAMES = ["|", "/", "-", "\\"];

function TerminalSpinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 120);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 font-mono text-xs text-gray-500 select-none"
      aria-hidden="true"
    >
      <span className="text-green-500/80 text-sm w-3 inline-block text-center">
        {SPINNER_FRAMES[frame]}
      </span>
      searching…
    </span>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_QUERY = 3;
const RESULT_LIMIT = 8;
const ROTATE_MS = 7000;

const PLACEHOLDER_EXAMPLES = [
  "climate policy",
  "CRISPR",
  "NATO expansion",
  "fentanyl regulations",
  "cognitive dissonance",
  "vaccine trials",
  "Cuban Missile Crisis",
];

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

// ─── Rotating featured-trajectory hero card ─────────────────────────────────────

function FeaturedHeroCard({ cards }: { cards: HeroCard[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Randomize starting card after hydration to avoid always showing index 0.
  useEffect(() => {
    if (cards.length > 1) setActive(Math.floor(Math.random() * cards.length));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused || cards.length <= 1) return;
    const id = setInterval(() => setActive(a => (a + 1) % cards.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, cards.length]);

  if (cards.length === 0) return null;
  const card = cards[Math.min(active, cards.length - 1)];

  return (
    <figure
      className="relative rounded-2xl border border-gray-800 bg-gray-900/70 backdrop-blur-md px-6 pt-5 pb-5 shadow-2xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <figcaption className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${card.eyebrowColor}`}>
          {card.eyebrow}
        </span>
        <span className="text-[10px] font-mono text-gray-600">
          {card.span} · {card.milestoneCount} milestones
        </span>
      </figcaption>

      {/* Hook — the human one-liner */}
      <p className="mb-2 text-base sm:text-lg text-gray-100 font-medium leading-snug">
        {card.hook}
      </p>

      {/* Server-rendered settling-curve sparkline */}
      <div key={card.id}>{card.mini}</div>

      <p className="mt-1 text-xs text-gray-500 leading-snug line-clamp-2">
        {truncate(card.claim, 150)}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <Link
          href={`/settling-curve?t=${card.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
        >
          See the full curve →
        </Link>

        {/* Manual rotation dots */}
        {cards.length > 1 && (
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Featured trajectories">
            {cards.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show trajectory ${i + 1}: ${c.eyebrow}`}
                aria-selected={i === active}
                role="tab"
                className={`h-1.5 rounded-full transition-all ${
                  i === active ? "w-5 bg-amber-400" : "w-1.5 bg-gray-700 hover:bg-gray-500"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

// ─── Search result sub-components ───────────────────────────────────────────────

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
      <p className="text-sm text-gray-200 group-hover:text-white leading-relaxed">
        <Highlighted text={displayText} query={query} />
      </p>

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

function MissingState({ query }: { query: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  function suggest() {
    setStatus("sending");
    fetch("/api/search/miss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
      .then(r => setStatus(r.ok ? "sent" : "error"))
      .catch(() => setStatus("error"));
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
    </div>
  );
}

function useCyclingPlaceholder(examples: string[], intervalMs = 2400) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % examples.length), intervalMs);
    return () => clearInterval(id);
  }, [examples.length, intervalMs]);
  return `Search 1.6M claims — try "${examples[idx]}"…`;
}

// ─── Hero ───────────────────────────────────────────────────────────────────────

function HomeHeroContent({
  heroCards,
  children,
}: {
  heroCards: HeroCard[];
  children?: React.ReactNode;
}) {
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

    setLoading(true);

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

  useEffect(() => {
    const q = input.trim();
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    const qs = next.toString();
    const target = qs ? `/?${qs}` : "/";
    router.replace(target, { scroll: false });
  }, [input, router]);

  const trimmed = input.trim();
  const showResults = trimmed.length >= MIN_QUERY;
  const hasHits = data && (data.claims.length > 0);

  return (
    <div className="relative">
      {/* ── Hero: settling curve IS the hero; search demoted below ── */}
      <section className="relative pt-12 pb-10 sm:pt-16 sm:pb-14 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* Left: the pitch */}
          <div className="text-center lg:text-left">
            <span className="inline-block text-[11px] font-mono uppercase tracking-[0.25em] text-amber-400/90 mb-4">
              Claim provenance database
            </span>
            <h1 className="text-3xl sm:text-5xl font-semibold text-white tracking-tight leading-[1.1]">
              Track the status of every claim — when it was established, changed, or overturned.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-400 leading-relaxed max-w-xl mx-auto lg:mx-0">
              A live record of epistemic status across science, law, and history.{" "}
              <span className="text-gray-200">1.6M</span> claims, each sourced and traceable, plus{" "}
              <span className="text-gray-200">5,000+</span> trajectories with dated transitions.
              Search any topic, follow the evidence trail, and see how confidence shifted over time.
            </p>

            <div className="mt-7 flex flex-wrap gap-3 justify-center lg:justify-start">
              <Link
                href="/settling-curve"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-gray-950 font-medium text-sm hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
              >
                Explore the Settling Curve →
              </Link>
            </div>
            <div className="mt-4 flex justify-center lg:justify-start">
              <Link
                href="/settling-curve?t=semaglutide-glp1"
                className="text-sm text-amber-400/70 hover:text-amber-300 transition-colors underline underline-offset-4"
              >
                View a sample trajectory: semaglutide (GLP-1) →
              </Link>
            </div>
          </div>

          {/* Right: the visual anchor — rotating featured trajectory */}
          <div className="relative">
            <FeaturedHeroCard cards={heroCards} />
          </div>
        </div>
      </section>

      {/* ── Discovery rail: curated narrative entry points ── */}
      <section className="relative max-w-6xl mx-auto pb-6">
        <div className="flex items-baseline justify-between px-1 mb-3">
          <h2 className="text-sm font-mono uppercase tracking-widest text-gray-500">
            Start here
          </h2>
          <span className="text-xs text-gray-600 hidden sm:block">scroll for more →</span>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 snap-x">
          {DISCOVERY_HOOKS.map((h) => (
            <Link
              key={h.title}
              href={h.href}
              className="snap-start shrink-0 w-[260px] rounded-xl border border-gray-800 bg-gray-900/70 backdrop-blur-sm px-5 py-4 hover:border-gray-600 hover:bg-gray-900 transition-colors group"
            >
              <span className={`text-[10px] font-mono uppercase tracking-[0.18em] ${h.eyebrowColor}`}>
                {h.eyebrow}
              </span>
              <h3 className="mt-2 text-base font-semibold text-white group-hover:text-amber-200 transition-colors leading-snug">
                {h.title}
              </h3>
              <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">{h.blurb}</p>
              <span className="mt-3 inline-block text-xs text-gray-600 group-hover:text-gray-400 transition-colors">
                See the receipt →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Below-fold ── */}
      <div className="relative bg-gray-950">
        {/* Demoted search band */}
        <section className="relative max-w-3xl mx-auto pt-8">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-gray-900/80 backdrop-blur-sm border border-gray-700 text-gray-100 text-base rounded-xl px-5 py-3.5 placeholder-gray-500 focus:outline-none focus:border-gray-400 focus:bg-gray-900 transition-colors shadow-xl"
              aria-label="Search Epistemic Receipts"
            />
            {loading && <TerminalSpinner />}
          </div>
          {!showResults && (
            <p className="mt-2 text-center text-xs text-gray-600">
              Every claim is sourced. Every source is traceable.
            </p>
          )}
        </section>

        {/* Inline search results — only reserve vertical space when a search is active */}
        <section className={`relative max-w-3xl mx-auto ${showResults ? "pt-5 pb-14 min-h-[36vh]" : "pb-2"}`}>
          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          {showResults && !error && data && !loading && hasHits && (
            <div className="space-y-3">
              <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                {data.counts.claims.toLocaleString()} {data.counts.claims === 1 ? "result" : "results"} for &ldquo;{trimmed}&rdquo;
              </p>
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

        {/* Server-rendered sections below the hero */}
        {children}
      </div>
    </div>
  );
}

export default function HomeHero({
  heroCards,
  children,
}: {
  heroCards: HeroCard[];
  children?: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <HomeHeroContent heroCards={heroCards}>{children}</HomeHeroContent>
    </Suspense>
  );
}
