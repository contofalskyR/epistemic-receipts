"use client";
import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const C = {
  bg: "#0a0a0a",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#d4a853",
};

const CAT_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  MILITARY:     { label: "Military",     color: "#f87171", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)"   },
  DIPLOMATIC:   { label: "Diplomatic",   color: "#60a5fa", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)"  },
  INTELLIGENCE: { label: "Intelligence", color: "#c084fc", bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.3)"  },
  LEGISLATIVE:  { label: "Legislative",  color: "#4ade80", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)"   },
  ECONOMIC:     { label: "Economic",     color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)"  },
  SOCIAL:       { label: "Social",       color: "#f472b6", bg: "rgba(244,114,182,0.12)", border: "rgba(244,114,182,0.3)" },
};

const ALL_CATS = ["All", ...Object.keys(CAT_META)];

interface EventItem {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  voteCount: number;
  claimCount: number;
  polityCount: number;
}

function startYear(d: string | null) {
  if (!d) return null;
  return new Date(d).getUTCFullYear();
}

function dateRange(item: EventItem) {
  const s = startYear(item.startDate);
  const e = item.endDate ? new Date(item.endDate).getUTCFullYear() : null;
  if (!s) return null;
  if (!e || e === s) return String(s);
  return `${s}–${e}`;
}

function CategoryBadge({ cat }: { cat: string }) {
  const m = CAT_META[cat];
  if (!m) return null;
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: "monospace",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 4,
        color: m.color,
        background: m.bg,
        border: `1px solid ${m.border}`,
        flexShrink: 0,
      }}
    >
      {m.label}
    </span>
  );
}

export default function HistoricalEventsClient({ events }: { events: EventItem[] }) {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState("All");

  const visible = useMemo(
    () => (activeCat === "All" ? events : events.filter((e) => e.category === activeCat)),
    [events, activeCat]
  );

  const totalVotes  = events.reduce((s, e) => s + e.voteCount, 0);
  const totalClaims = events.reduce((s, e) => s + e.claimCount, 0);

  const categories = useMemo(() => {
    const seen = new Set(events.map((e) => e.category).filter(Boolean) as string[]);
    return ALL_CATS.filter((c) => c === "All" || seen.has(c));
  }, [events]);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", marginTop: "-2rem", marginLeft: "-1.5rem", marginRight: "-1.5rem", padding: "0 0 4rem" }}>
      {/* Sub-nav */}
      <nav style={{
        background: C.panel,
        borderBottom: `1px solid ${C.panelEdge}`,
        padding: "0 2rem",
        display: "flex",
        alignItems: "center",
        gap: "2rem",
        height: 56,
        position: "sticky",
        top: 48,
        zIndex: 40,
      }}>
        <Link href="/" style={{ color: C.brand, fontWeight: 700, fontSize: "1rem", textDecoration: "none", whiteSpace: "nowrap" }}>
          ⬡ Epistemic Receipts
        </Link>
        <span style={{ color: C.mut, fontSize: "0.85rem" }}>Historical Events</span>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2.5rem 2rem 0" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: C.ink, margin: 0, letterSpacing: "-0.02em" }}>
            Historical Events
          </h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: C.mut, lineHeight: 1.55, maxWidth: 640 }}>
            Linking the claim graph to legislative votes and historical polities. Each event
            aggregates contemporaneous Congressional roll calls, state actors, and curated claims.
          </p>
          <div style={{ display: "flex", gap: "2rem", marginTop: "1.25rem" }}>
            {[
              { n: events.length, label: "Events" },
              { n: totalVotes.toLocaleString(), label: "Congressional votes" },
              { n: totalClaims.toLocaleString(), label: "Claims" },
            ].map(({ n, label }) => (
              <div key={label}>
                <div style={{ fontFamily: "monospace", fontSize: "1.125rem", fontWeight: 700, color: C.ink }}>{n}</div>
                <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.07em", color: C.faint, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Category filter chips */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {categories.map((cat) => {
            const active = cat === activeCat;
            const m = cat === "All" ? null : CAT_META[cat];
            return (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                style={{
                  padding: "4px 14px",
                  borderRadius: 20,
                  border: `1px solid ${active ? (m?.border ?? C.brand) : C.panelEdge}`,
                  background: active ? (m?.bg ?? "rgba(212,168,83,0.15)") : "transparent",
                  color: active ? (m?.color ?? C.brand) : C.mut,
                  fontSize: "0.8rem",
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  letterSpacing: "0.02em",
                }}
              >
                {cat === "All" ? "All" : (CAT_META[cat]?.label ?? cat)}
                {cat !== "All" && (
                  <span style={{ marginLeft: 5, opacity: 0.65, fontSize: "0.7rem" }}>
                    {events.filter((e) => e.category === cat).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Event list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {visible.map((ev) => {
            const range = dateRange(ev);
            return (
              <div
                key={ev.id}
                onClick={() => router.push(`/historical-events/${ev.slug}`)}
                style={{
                  background: C.panel,
                  border: `1px solid ${C.panelEdge}`,
                  borderRadius: 10,
                  padding: "1.1rem 1.4rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "1.5rem",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#3a3a5a";
                  (e.currentTarget as HTMLDivElement).style.background = "#12121e";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = C.panelEdge;
                  (e.currentTarget as HTMLDivElement).style.background = C.panel;
                }}
              >
                {/* Left: name + meta + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "1rem", fontWeight: 600, color: C.ink }}>{ev.name}</span>
                    {ev.category && <CategoryBadge cat={ev.category} />}
                    {range && (
                      <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: C.faint }}>
                        {range}
                      </span>
                    )}
                  </div>
                  {ev.description && (
                    <p style={{
                      marginTop: "0.4rem",
                      fontSize: "0.82rem",
                      color: C.mut,
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      {ev.description}
                    </p>
                  )}
                </div>

                {/* Right: stats */}
                <div style={{ display: "flex", gap: "1.5rem", flexShrink: 0, textAlign: "center" }}>
                  {[
                    { n: ev.voteCount.toLocaleString(), label: "Votes" },
                    { n: ev.claimCount.toLocaleString(), label: "Claims" },
                    { n: ev.polityCount, label: "Polities" },
                  ].map(({ n, label }) => (
                    <div key={label}>
                      <div style={{ fontFamily: "monospace", fontSize: "0.95rem", fontWeight: 700, color: C.ink }}>{n}</div>
                      <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.07em", color: C.faint, marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {visible.length === 0 && (
            <div style={{ textAlign: "center", color: C.faint, padding: "3rem 0", fontSize: "0.9rem" }}>
              No events in this category.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
