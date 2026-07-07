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

const C = {
  bg: "#0a0a0a",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#d4a853",
} as const;

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

function resultStyle(r: string): { color: string; bg: string; border: string } {
  if (r === "passed") return { color: "#4ade80", bg: "rgba(22,163,74,0.15)", border: "rgba(22,163,74,0.3)" };
  if (r === "failed") return { color: "#f87171", bg: "rgba(220,38,38,0.15)", border: "rgba(220,38,38,0.3)" };
  if (r === "tied") return { color: "#fbbf24", bg: "rgba(217,119,6,0.15)", border: "rgba(217,119,6,0.3)" };
  return { color: C.mut, bg: "rgba(100,100,120,0.15)", border: C.faint };
}

function chamberStyle(ch: string): { color: string; bg: string; border: string } {
  const c = ch?.toLowerCase();
  if (c === "house" || c === "house of representatives") return { color: "#93c5fd", bg: "rgba(37,99,235,0.15)", border: "rgba(59,130,246,0.3)" };
  if (c === "senate") return { color: "#c4b5fd", bg: "rgba(109,40,217,0.15)", border: "rgba(139,92,246,0.3)" };
  return { color: C.mut, bg: "rgba(100,100,120,0.15)", border: C.faint };
}

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

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? C.brand : C.panel,
        border: `1px solid ${active ? C.brand : C.panelEdge}`,
        borderRadius: "20px",
        padding: "0.28rem 0.7rem",
        fontSize: "0.76rem",
        cursor: "pointer",
        color: active ? "#000" : C.mut,
        fontWeight: active ? 600 : 400,
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function VoteRow({ vote }: { vote: VoteHit }) {
  const [hovered, setHovered] = useState(false);
  const yes = vote.yesCount ?? 0;
  const no = vote.noCount ?? 0;
  const abs = vote.abstainCount ?? 0;
  const totalVoters = yes + no + abs;
  const yesPct = totalVoters > 0 ? (yes / totalVoters) * 100 : 0;
  const noPct = totalVoters > 0 ? (no / totalVoters) * 100 : 0;
  const result = vote.result ?? "unknown";
  const rs = resultStyle(result);
  const cs = chamberStyle(vote.chamber);

  return (
    <Link
      href={`/votes/${vote.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        background: C.panel,
        border: `1px solid ${hovered ? C.brand + "44" : C.panelEdge}`,
        borderRadius: "10px",
        padding: "0.9rem 1.1rem",
        textDecoration: "none",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: "0.9rem",
            color: hovered ? C.ink : "#d0d0e0",
            lineHeight: 1.45,
            margin: 0,
            marginBottom: "0.45rem",
            transition: "color 0.1s",
          }}>
            {truncate(vote.sourceName)}
          </p>
          <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", color: C.mut, fontFamily: "monospace" }}>
              {formatDate(vote.voteDate)}
            </span>
            <span style={{
              fontSize: "0.68rem",
              padding: "0.15rem 0.5rem",
              borderRadius: "10px",
              color: cs.color,
              background: cs.bg,
              border: `1px solid ${cs.border}`,
              fontWeight: 500,
            }}>
              {vote.chamber}
            </span>
            <span style={{
              fontSize: "0.68rem",
              padding: "0.15rem 0.5rem",
              borderRadius: "10px",
              color: rs.color,
              background: rs.bg,
              border: `1px solid ${rs.border}`,
              fontWeight: 600,
              textTransform: "uppercase" as const,
            }}>
              {result}
            </span>
            {vote.topics.slice(0, 3).map(t => (
              <span key={t} style={{
                fontSize: "0.65rem",
                padding: "0.12rem 0.4rem",
                borderRadius: "5px",
                color: C.faint,
                background: "rgba(80,80,120,0.2)",
                fontFamily: "monospace",
              }}>
                {t}
              </span>
            ))}
            {vote.sourceUrl && (
              <a
                href={vote.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: "0.65rem",
                  color: C.brand,
                  textDecoration: "none",
                  fontWeight: 500,
                  opacity: 0.8,
                }}
              >
                Voteview ↗
              </a>
            )}
          </div>
        </div>

        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontFamily: "monospace", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
            <span style={{ color: "#4ade80" }}>{yes.toLocaleString()}</span>
            <span style={{ color: C.faint, margin: "0 0.25rem" }}>·</span>
            <span style={{ color: "#f87171" }}>{no.toLocaleString()}</span>
            {abs > 0 && (
              <>
                <span style={{ color: C.faint, margin: "0 0.25rem" }}>·</span>
                <span style={{ color: C.mut }}>{abs.toLocaleString()}</span>
              </>
            )}
          </div>
          <div style={{ fontSize: "0.6rem", color: C.faint, marginTop: "0.2rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            yea · nay{abs > 0 ? " · abs" : ""}
          </div>
        </div>
      </div>

      {totalVoters > 0 && (
        <div style={{
          marginTop: "0.65rem",
          height: "4px",
          borderRadius: "4px",
          overflow: "hidden",
          background: C.panelEdge,
          display: "flex",
        }}>
          <div style={{ width: `${yesPct}%`, background: "rgba(74,222,128,0.6)" }} />
          <div style={{ width: `${noPct}%`, background: "rgba(248,113,113,0.6)" }} />
        </div>
      )}
    </Link>
  );
}

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
    (overrides: Partial<{
      q: string;
      chamber: string;
      result: string;
      dateFrom: string;
      dateTo: string;
      offset: number;
    }>) => {
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

  const noDateFilter = !urlDateFrom && !urlDateTo;
  const eraAllActive = noDateFilter && !selectedPresidentKey;

  return (
    <div style={{
      background: C.bg,
      minHeight: "100vh",
      marginTop: "-2rem",
      marginLeft: "-1.5rem",
      marginRight: "-1.5rem",
    }}>
      {/* Sub-nav */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: C.bg,
        borderBottom: `1px solid ${C.panelEdge}`,
        padding: "0 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        height: "48px",
        fontSize: "0.82rem",
      }}>
        <Link href="/" style={{ color: C.brand, textDecoration: "none", fontWeight: 500 }}>
          ⬡ Epistemic Receipts
        </Link>
        <span style={{ color: C.faint }}>/</span>
        <span style={{ color: C.ink, fontWeight: 600 }}>Congressional Roll Calls</span>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 2rem 3rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <p style={{ fontSize: "0.7rem", color: C.mut, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: "0.35rem" }}>
            Votes
          </p>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, marginBottom: "0.4rem", color: C.ink }}>
            Congressional <span style={{ color: C.brand }}>Roll Calls</span>
          </h1>
          <p style={{ color: C.mut, fontSize: "0.88rem", maxWidth: "580px", lineHeight: 1.55, margin: 0 }}>
            113,000+ House and Senate roll call votes, 1789–present, sourced from Voteview.
            Search by description, filter by chamber, result, presidency, or era.
          </p>
        </div>

        {/* Filters */}
        <div style={{
          background: C.panel,
          border: `1px solid ${C.panelEdge}`,
          borderRadius: "12px",
          padding: "1.1rem 1.25rem",
          marginBottom: "1.25rem",
          display: "flex",
          flexDirection: "column" as const,
          gap: "0.85rem",
        }}>
          {/* Search */}
          <input
            type="text"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            placeholder="Search vote description…"
            style={{
              width: "100%",
              background: C.bg,
              border: `1px solid ${C.panelEdge}`,
              borderRadius: "8px",
              padding: "0.5rem 0.9rem",
              color: C.ink,
              fontSize: "0.88rem",
              outline: "none",
              boxSizing: "border-box" as const,
            }}
          />

          {/* Chamber */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" as const }}>
            <span style={{ fontSize: "0.7rem", color: C.mut, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: "0.2rem" }}>Chamber</span>
            {CHAMBERS.map(c => (
              <Chip key={c.value} label={c.label} active={urlChamber === c.value}
                onClick={() => pushUrl({ chamber: c.value, offset: 0 })} />
            ))}
          </div>

          {/* Result */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" as const }}>
            <span style={{ fontSize: "0.7rem", color: C.mut, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: "0.2rem" }}>Result</span>
            {RESULTS.map(r => (
              <Chip key={r.value} label={r.label} active={urlResult === r.value}
                onClick={() => pushUrl({ result: r.value, offset: 0 })} />
            ))}
          </div>

          {/* Presidency */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" as const }}>
            <span style={{ fontSize: "0.7rem", color: C.mut, textTransform: "uppercase", letterSpacing: "0.08em" }}>Presidency</span>
            <select
              value={selectedPresidentKey || ""}
              onChange={e => onPresidentChange(e.target.value)}
              style={{
                background: C.bg,
                border: `1px solid ${C.panelEdge}`,
                color: C.ink,
                fontSize: "0.8rem",
                borderRadius: "6px",
                padding: "0.28rem 0.6rem",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="">All Presidencies</option>
              {US_PRESIDENTS.map(p => (
                <option key={presidentKey(p)} value={presidentKey(p)}>
                  {presidentLabel(p)}
                </option>
              ))}
            </select>
            {matchedPresident && (
              <span style={{ fontSize: "0.68rem", color: C.faint, fontFamily: "monospace", textTransform: "uppercase" }}>
                ({partyAbbrev(matchedPresident.party)})
              </span>
            )}
          </div>

          {/* Era */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" as const }}>
            <span style={{ fontSize: "0.7rem", color: C.mut, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: "0.2rem" }}>Era</span>
            <Chip label="All" active={eraAllActive} onClick={() => onEraChange("")} />
            {ERAS.map(e => (
              <Chip key={e.label} label={e.label} active={selectedEraLabel === e.label}
                onClick={() => onEraChange(e.label)} />
            ))}
          </div>
        </div>

        {/* Results meta */}
        <div style={{ marginBottom: "0.75rem", fontSize: "0.78rem", color: C.mut }}>
          {loading
            ? "Loading…"
            : error
            ? <span style={{ color: "#f87171" }}>{error}</span>
            : total === 0
            ? "No matching votes"
            : `Showing ${showingFrom.toLocaleString()}–${showingTo.toLocaleString()} of ${total.toLocaleString()}`}
        </div>

        {/* Vote list */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.55rem" }}>
          {data?.votes.map(v => <VoteRow key={v.id} vote={v} />)}
        </div>

        {/* Pagination */}
        {data && total > PAGE_SIZE && (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1.5rem", fontSize: "0.82rem", color: C.mut }}>
            <button
              onClick={() => pushUrl({ offset: Math.max(0, urlOffset - PAGE_SIZE) })}
              disabled={urlOffset === 0}
              style={{ background: "none", border: "none", cursor: urlOffset === 0 ? "not-allowed" : "pointer", color: urlOffset === 0 ? C.faint : C.mut }}
            >
              ← Previous
            </button>
            <span style={{ color: C.faint }}>·</span>
            <span>Page {currentPage.toLocaleString()} of {pageCount.toLocaleString()}</span>
            <span style={{ color: C.faint }}>·</span>
            <button
              onClick={() => pushUrl({ offset: urlOffset + PAGE_SIZE })}
              disabled={currentPage >= pageCount}
              style={{ background: "none", border: "none", cursor: currentPage >= pageCount ? "not-allowed" : "pointer", color: currentPage >= pageCount ? C.faint : C.mut }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
