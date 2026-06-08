"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  US_PRESIDENTS,
  ERAS,
  partyAbbrev,
  presidentKey,
  presidentLabel,
} from "@/lib/us-presidents";

type VoteHit = {
  id: string;
  chamber: string;
  yesCount: number | null;
  noCount: number | null;
  abstainCount: number | null;
  voteDate: string | null;
  result: string | null;
  topics: string[];
  sourceName: string;
  sourceUrl: string | null;
};

type VotesResponse = {
  total: number;
  votes: VoteHit[];
};

const PAGE_SIZE = 50;

const CHAMBERS = [
  { value: "all", label: "All" },
  { value: "house", label: "House" },
  { value: "senate", label: "Senate" },
] as const;

const RESULTS = [
  { value: "all", label: "All" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "tied", label: "Tied" },
] as const;

const RESULT_STYLE: Record<string, string> = {
  passed: "bg-green-950 text-green-400 border border-green-900/50",
  failed: "bg-red-950 text-red-400 border border-red-900/50",
  tied: "bg-yellow-950 text-yellow-400 border border-yellow-900/50",
  unknown: "bg-gray-800 text-gray-500 border border-gray-700/50",
};

const CHAMBER_STYLE: Record<string, string> = {
  House: "bg-blue-950 text-blue-300 border border-blue-900/50",
  Senate: "bg-purple-950 text-purple-300 border border-purple-900/50",
};

function truncate(text: string, n = 200): string {
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + "…";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function VotesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlQ = searchParams.get("q") ?? "";
  const urlChamberRaw = (searchParams.get("chamber") ?? "all").toLowerCase();
  const urlChamber: "all" | "house" | "senate" =
    urlChamberRaw === "house" || urlChamberRaw === "senate" ? urlChamberRaw : "all";
  const urlResultRaw = (searchParams.get("result") ?? "all").toLowerCase();
  const urlResult: "all" | "passed" | "failed" | "tied" =
    urlResultRaw === "passed" || urlResultRaw === "failed" || urlResultRaw === "tied"
      ? urlResultRaw
      : "all";
  const urlDateFrom = (searchParams.get("dateFrom") ?? "").trim();
  const urlDateTo = (searchParams.get("dateTo") ?? "").trim();
  const urlOffset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  const matchedPresident =
    ISO_DATE.test(urlDateFrom) && ISO_DATE.test(urlDateTo)
      ? US_PRESIDENTS.find(p => p.start === urlDateFrom && p.end === urlDateTo)
      : undefined;
  const selectedPresidentKey = matchedPresident ? presidentKey(matchedPresident) : "";

  const selectedEraLabel =
    ISO_DATE.test(urlDateFrom) && ISO_DATE.test(urlDateTo)
      ? ERAS.find(e => e.start === urlDateFrom && e.end === urlDateTo)?.label ?? ""
      : "";

  const [input, setInput] = useState(urlQ);
  const [data, setData] = useState<VotesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setInput(urlQ);
  }, [urlQ]);

  const pushUrl = useCallback(
    (
      overrides: Partial<{
        q: string;
        chamber: string;
        result: string;
        dateFrom: string;
        dateTo: string;
        offset: number;
      }>,
    ) => {
      const next = new URLSearchParams(searchParams.toString());
      if (overrides.q !== undefined) {
        if (overrides.q) next.set("q", overrides.q);
        else next.delete("q");
      }
      if (overrides.chamber !== undefined) {
        if (overrides.chamber === "all") next.delete("chamber");
        else next.set("chamber", overrides.chamber);
      }
      if (overrides.result !== undefined) {
        if (overrides.result === "all") next.delete("result");
        else next.set("result", overrides.result);
      }
      if (overrides.dateFrom !== undefined) {
        if (overrides.dateFrom) next.set("dateFrom", overrides.dateFrom);
        else next.delete("dateFrom");
      }
      if (overrides.dateTo !== undefined) {
        if (overrides.dateTo) next.set("dateTo", overrides.dateTo);
        else next.delete("dateTo");
      }
      // Legacy: clear year whenever date range changes
      if (overrides.dateFrom !== undefined || overrides.dateTo !== undefined) {
        next.delete("year");
      }
      if (overrides.offset !== undefined) {
        if (overrides.offset > 0) next.set("offset", String(overrides.offset));
        else next.delete("offset");
      }
      const qs = next.toString();
      router.replace(qs ? `/votes?${qs}` : "/votes");
    },
    [router, searchParams],
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const p = new URLSearchParams();
    if (urlQ) p.set("q", urlQ);
    if (urlChamber !== "all") p.set("chamber", urlChamber);
    if (urlResult !== "all") p.set("result", urlResult);
    if (ISO_DATE.test(urlDateFrom)) p.set("dateFrom", urlDateFrom);
    if (ISO_DATE.test(urlDateTo)) p.set("dateTo", urlDateTo);
    p.set("limit", String(PAGE_SIZE));
    p.set("offset", String(urlOffset));
    fetch(`/api/votes?${p.toString()}`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return (await r.json()) as VotesResponse;
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load votes");
        setLoading(false);
      });
    return () => controller.abort();
  }, [urlQ, urlChamber, urlResult, urlDateFrom, urlDateTo, urlOffset]);

  function onInputChange(v: string) {
    setInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushUrl({ q: v.trim(), offset: 0 });
    }, 300);
  }

  function onPresidentChange(value: string) {
    if (!value) {
      pushUrl({ dateFrom: "", dateTo: "", offset: 0 });
      return;
    }
    const p = US_PRESIDENTS.find(pr => presidentKey(pr) === value);
    if (!p) return;
    pushUrl({ dateFrom: p.start, dateTo: p.end, offset: 0 });
  }

  function onEraChange(label: string) {
    if (!label) {
      pushUrl({ dateFrom: "", dateTo: "", offset: 0 });
      return;
    }
    const e = ERAS.find(x => x.label === label);
    if (!e) return;
    pushUrl({ dateFrom: e.start, dateTo: e.end, offset: 0 });
  }

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(urlOffset / PAGE_SIZE) + 1;
  const showingFrom = total === 0 ? 0 : urlOffset + 1;
  const showingTo = Math.min(total, urlOffset + (data?.votes.length ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Votes</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Congressional Roll Calls</h1>
        <p className="mt-2 text-gray-400 max-w-2xl text-sm leading-relaxed">
          113,000+ House and Senate roll call votes, 1789–present, sourced from Voteview. Search by description, filter by chamber, result, presidency, or era.
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={input}
          onChange={e => onInputChange(e.target.value)}
          placeholder="Search vote description…"
          className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
        />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 uppercase tracking-widest mr-1">Chamber</span>
          {CHAMBERS.map(c => {
            const active = urlChamber === c.value;
            return (
              <button
                key={c.value}
                onClick={() => pushUrl({ chamber: c.value, offset: 0 })}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-white text-gray-950 border-white font-medium"
                    : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 uppercase tracking-widest mr-1">Result</span>
          {RESULTS.map(r => {
            const active = urlResult === r.value;
            return (
              <button
                key={r.value}
                onClick={() => pushUrl({ result: r.value, offset: 0 })}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-white text-gray-950 border-white font-medium"
                    : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 uppercase tracking-widest mr-1">Presidency</span>
          <select
            value={selectedPresidentKey || ""}
            onChange={e => onPresidentChange(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500 transition-colors"
          >
            <option value="">All Presidencies</option>
            {US_PRESIDENTS.map(p => (
              <option key={presidentKey(p)} value={presidentKey(p)}>
                {presidentLabel(p)}
              </option>
            ))}
          </select>
          {matchedPresident && (
            <span className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">
              ({partyAbbrev(matchedPresident.party)})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 uppercase tracking-widest mr-1">Era</span>
          <button
            onClick={() => onEraChange("")}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              !selectedEraLabel && !selectedPresidentKey
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            All
          </button>
          {ERAS.map(e => {
            const active = selectedEraLabel === e.label;
            return (
              <button
                key={e.label}
                onClick={() => onEraChange(e.label)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  active
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {e.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {data && !error && (
        <>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {total === 0
                ? "No matching votes"
                : `Showing ${showingFrom.toLocaleString()}–${showingTo.toLocaleString()} of ${total.toLocaleString()}`}
            </span>
          </div>

          <div className="space-y-2">
            {data.votes.map(v => (
              <VoteRow key={v.id} vote={v} />
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center gap-3 text-xs text-gray-500 pt-2">
              <button
                onClick={() => pushUrl({ offset: Math.max(0, urlOffset - PAGE_SIZE) })}
                disabled={urlOffset === 0}
                className="hover:text-gray-300 disabled:opacity-30 transition-colors"
              >
                ← Previous
              </button>
              <span className="text-gray-700">·</span>
              <span>
                Page {currentPage.toLocaleString()} of {pageCount.toLocaleString()}
              </span>
              <span className="text-gray-700">·</span>
              <button
                onClick={() => pushUrl({ offset: urlOffset + PAGE_SIZE })}
                disabled={currentPage >= pageCount}
                className="hover:text-gray-300 disabled:opacity-30 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VoteRow({ vote }: { vote: VoteHit }) {
  const yes = vote.yesCount ?? 0;
  const no = vote.noCount ?? 0;
  const abs = vote.abstainCount ?? 0;
  const totalVoters = yes + no + abs;
  const yesPct = totalVoters > 0 ? (yes / totalVoters) * 100 : 0;
  const noPct = totalVoters > 0 ? (no / totalVoters) * 100 : 0;
  const result = vote.result ?? "unknown";
  const resultStyle = RESULT_STYLE[result] ?? RESULT_STYLE.unknown;
  const chamberStyle = CHAMBER_STYLE[vote.chamber] ?? "bg-gray-800 text-gray-400 border border-gray-700/50";

  return (
    <Link
      href={`/votes/${vote.id}`}
      className="block rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600 transition-colors group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-200 group-hover:text-white leading-relaxed">{truncate(vote.sourceName)}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-gray-500 font-mono">{formatDate(vote.voteDate)}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${chamberStyle}`}>
              {vote.chamber}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${resultStyle}`}>
              {result}
            </span>
            {vote.topics.slice(0, 3).map(t => (
              <span
                key={t}
                className="text-xs px-1.5 py-0.5 rounded font-mono bg-gray-800/60 text-gray-500"
              >
                {t}
              </span>
            ))}
            {vote.sourceUrl && (
              <a
                href={vote.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[10px] uppercase tracking-widest text-gray-600 hover:text-blue-300 transition-colors"
              >
                Voteview ↗
              </a>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs text-gray-400 font-mono whitespace-nowrap">
            <span className="text-green-400">{yes.toLocaleString()}</span>
            <span className="text-gray-600 mx-1">·</span>
            <span className="text-red-400">{no.toLocaleString()}</span>
            {abs > 0 && (
              <>
                <span className="text-gray-600 mx-1">·</span>
                <span className="text-gray-500">{abs.toLocaleString()}</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-widest">yea · nay{abs > 0 ? " · abs" : ""}</div>
        </div>
      </div>
      {totalVoters > 0 && (
        <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-gray-800">
          <div className="bg-green-500/70" style={{ width: `${yesPct}%` }} />
          <div className="bg-red-500/70" style={{ width: `${noPct}%` }} />
        </div>
      )}
    </Link>
  );
}
