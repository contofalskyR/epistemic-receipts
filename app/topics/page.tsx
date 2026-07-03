"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

const C = {
  bg: "#0a0a0a",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#d4a853",
} as const;

type TopicNode = {
  id: string;
  name: string;
  slug: string;
  domain: string;
  description: string | null;
  claimCount: number;
  children: TopicNode[];
};

const DOMAIN_LABELS: Record<string, string> = {
  "academic-literature":  "Academic Literature",
  archives:               "Archives & Declassified Documents",
  astronomy:              "Astronomy",
  chemistry:              "Chemistry",
  "clinical-trials":      "Clinical Trials",
  culture:                "Culture",
  defense:                "Defense",
  diplomacy:              "Diplomacy",
  economics:              "Economics",
  environment:            "Environment",
  genetics:               "Genetics",
  geology:                "Geology",
  government:             "Government & Legislation",
  history:                "History",
  institutional:          "Institutional",
  intelligence:           "Intelligence",
  international:          "International",
  labor:                  "Labor",
  law:                    "Law",
  legislation:            "Legislation",
  medicine:               "Medicine",
  physics:                "Physics",
  politics:               "Politics",
  psychology:             "Psychology",
  "public-health":        "Public Health",
  public_health:          "Public Health",
  "research-funding":     "Research Funding",
  science:                "Science",
  "scientific-integrity": "Scientific Integrity",
  technology:             "Technology",
};

type Discipline = "social" | "natural" | "humanities" | "applied" | "formal";

const DOMAIN_TO_DISCIPLINE: Record<string, Discipline> = {
  "academic-literature":  "social",
  archives:               "humanities",
  astronomy:              "natural",
  chemistry:              "natural",
  "clinical-trials":      "applied",
  culture:                "humanities",
  defense:                "applied",
  diplomacy:              "social",
  economics:              "social",
  environment:            "applied",
  genetics:               "natural",
  geology:                "natural",
  government:             "social",
  history:                "humanities",
  institutional:          "social",
  intelligence:           "applied",
  international:          "social",
  labor:                  "social",
  law:                    "humanities",
  legislation:            "social",
  medicine:               "applied",
  physics:                "natural",
  politics:               "social",
  psychology:             "social",
  "public-health":        "applied",
  public_health:          "applied",
  "research-funding":     "social",
  science:                "natural",
  "scientific-integrity": "social",
  technology:             "applied",
};

const DISCIPLINE_META: Record<Discipline, { label: string; bg: string; border: string; text: string }> = {
  social:     { label: "SOCIAL SCI",  bg: "rgba(59,130,246,0.2)",  border: "rgba(59,130,246,0.5)",  text: "#93c5fd" },
  natural:    { label: "NATURAL SCI", bg: "rgba(16,185,129,0.2)",  border: "rgba(16,185,129,0.5)",  text: "#6ee7b7" },
  humanities: { label: "HUMANITIES",  bg: "rgba(139,92,246,0.2)",  border: "rgba(139,92,246,0.5)",  text: "#c4b5fd" },
  applied:    { label: "APPLIED SCI", bg: "rgba(245,158,11,0.2)",  border: "rgba(245,158,11,0.5)",  text: "#fde68a" },
  formal:     { label: "FORMAL SCI",  bg: "rgba(6,182,212,0.2)",   border: "rgba(6,182,212,0.5)",   text: "#a5f3fc" },
};

function DisciplineBadge({ domain }: { domain: string }) {
  const discipline = DOMAIN_TO_DISCIPLINE[domain];
  if (!discipline) return null;
  const { label, bg, border, text } = DISCIPLINE_META[discipline];
  return (
    <Link
      href="/fields"
      title={`${label} — browse academic fields`}
      style={{
        fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.05em",
        padding: "0.1rem 0.4rem", borderRadius: 4,
        background: bg, border: `1px solid ${border}`, color: text,
        textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap",
      }}
    >
      {label}
    </Link>
  );
}

function flattenTopics(nodes: TopicNode[]): TopicNode[] {
  return nodes.flatMap(n => [n, ...flattenTopics(n.children)]);
}

function subtreeClaimCount(n: TopicNode): number {
  return n.claimCount + n.children.reduce((s, c) => s + subtreeClaimCount(c), 0);
}

// Drop topics with no claims anywhere in their subtree — dozens of "(0)"
// rows (Biology, Law, Economics, …) otherwise clutter the tree. A parent
// with zero direct tags survives as long as any descendant has claims.
function pruneEmpty(nodes: TopicNode[]): TopicNode[] {
  return nodes
    .filter(n => subtreeClaimCount(n) > 0)
    .map(n => ({ ...n, children: pruneEmpty(n.children) }));
}

function TopicTreeItem({ topic, depth }: { topic: TopicNode; depth: number }) {
  const [hov, setHov] = useState(false);
  return (
    <div>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "flex", alignItems: "baseline", gap: "0.5rem",
          padding: `0.3rem 0.5rem 0.3rem ${depth * 16 + 8}px`,
          background: hov ? "rgba(255,255,255,0.03)" : "transparent",
          borderRadius: 6, transition: "background 0.1s",
        }}
      >
        {depth > 0 && <span style={{ color: C.faint, fontSize: "0.72rem", flexShrink: 0 }}>└</span>}
        <Link
          href={`/topics/${topic.slug}`}
          style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flex: 1, minWidth: 0, textDecoration: "none" }}
        >
          <span style={{ color: hov ? C.ink : C.mut, fontSize: "0.83rem", transition: "color 0.1s", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {topic.name}
          </span>
          <span style={{ color: C.faint, fontSize: "0.7rem", flexShrink: 0 }}>({topic.claimCount.toLocaleString()})</span>
        </Link>
        <DisciplineBadge domain={topic.domain} />
      </div>
      {topic.children.map(child => (
        <TopicTreeItem key={child.id} topic={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function SearchResult({ topic }: { topic: TopicNode }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "baseline", gap: "0.5rem",
        padding: "0.4rem 0.75rem",
        background: hov ? "rgba(255,255,255,0.03)" : "transparent",
        borderRadius: 6, transition: "background 0.1s",
      }}
    >
      <Link
        href={`/topics/${topic.slug}`}
        style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flex: 1, minWidth: 0, textDecoration: "none" }}
      >
        <span style={{ color: hov ? C.ink : C.mut, fontSize: "0.83rem", transition: "color 0.1s", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {topic.name}
        </span>
        <span style={{ color: C.faint, fontSize: "0.7rem", flexShrink: 0 }}>({topic.claimCount.toLocaleString()})</span>
        <span style={{ color: C.faint, fontSize: "0.7rem", marginLeft: "auto", flexShrink: 0 }}>
          {DOMAIN_LABELS[topic.domain] ?? topic.domain}
        </span>
      </Link>
      <DisciplineBadge domain={topic.domain} />
    </div>
  );
}

function DomainSection({ domain, roots }: { domain: string; roots: TopicNode[] }) {
  const [open, setOpen] = useState(true);
  const [hov, setHov] = useState(false);
  const label = DOMAIN_LABELS[domain] ?? domain;

  function countAll(nodes: TopicNode[]): number {
    return nodes.reduce((s, n) => s + 1 + countAll(n.children), 0);
  }
  const totalTopics = countAll(roots);

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "flex", alignItems: "baseline", gap: "0.5rem",
          width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer",
          marginBottom: "0.75rem", padding: "0.2rem 0",
        }}
      >
        <span style={{
          fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.08em", color: hov ? C.ink : C.mut,
          transition: "color 0.1s",
        }}>
          {label}
        </span>
        <span style={{ color: C.faint, fontSize: "0.7rem" }}>({totalTopics} topics)</span>
        <span style={{ color: C.faint, fontSize: "0.72rem", marginLeft: "0.2rem" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 10, padding: "0.35rem 0" }}>
          {roots.map(topic => (
            <TopicTreeItem key={topic.id} topic={topic} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopicsPage() {
  const [data, setData] = useState<Record<string, TopicNode[]> | null>(null);
  const [query, setQuery] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);

  useEffect(() => {
    fetch("/api/topics").then(r => r.json()).then(d => setData(d.domains));
  }, []);

  const allTopics = useMemo(() => {
    if (!data) return [];
    return Object.values(data).flatMap(flattenTopics);
  }, [data]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return allTopics.filter(t => t.name.toLowerCase().includes(q));
  }, [query, allTopics]);

  // Tree view hides claim-less subtrees unless toggled; search always sees everything.
  const viewData = useMemo(() => {
    if (!data || showEmpty) return data;
    const out: Record<string, TopicNode[]> = {};
    for (const [domain, roots] of Object.entries(data)) {
      const pruned = pruneEmpty(roots);
      if (pruned.length > 0) out[domain] = pruned;
    }
    return out;
  }, [data, showEmpty]);

  const domainKeys = viewData
    ? Object.keys(viewData).sort((a, b) => (DOMAIN_LABELS[a] ?? a).localeCompare(DOMAIN_LABELS[b] ?? b))
    : [];

  const totalTopics = allTopics.length;
  const totalDomains = data ? Object.keys(data).length : 0;
  const visibleTopics = useMemo(
    () => (viewData ? Object.values(viewData).flatMap(flattenTopics).length : 0),
    [viewData],
  );
  const hiddenTopics = totalTopics - visibleTopics;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", marginTop: "-2rem", marginLeft: "-1.5rem", marginRight: "-1.5rem" }}>
      {/* Sub-nav */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(10,10,10,0.85)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.panelEdge}`,
        padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "0.5rem", height: "2.75rem",
      }}>
        <Link href="/" style={{ color: C.faint, fontSize: "0.78rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ fontSize: "1rem" }}>⬡</span> Epistemic Receipts
        </Link>
        <span style={{ color: C.panelEdge }}>/</span>
        <span style={{ color: C.mut, fontSize: "0.78rem" }}>Topics</span>
      </div>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(160deg, #0f0f1e 0%, #0a0a0a 60%)",
        borderBottom: `1px solid ${C.panelEdge}`,
        padding: "3.5rem 1.5rem 3rem",
      }}>
        <div style={{ maxWidth: "64rem", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(212,168,83,0.12)", border: "1px solid rgba(212,168,83,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0,
            }}>
              🏷️
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: C.brand, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                Taxonomy
              </div>
              <h1 style={{ color: C.ink, fontSize: "1.75rem", fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
                Topics
              </h1>
            </div>
          </div>
          <p style={{ color: C.mut, fontSize: "0.95rem", lineHeight: 1.6, maxWidth: "50rem", margin: "0 0 1.75rem" }}>
            Browse claims by domain and topic. Discipline badges link to the{" "}
            <Link href="/fields" style={{ color: C.brand, textDecoration: "none" }}>academic fields</Link>{" "}
            index. Click any topic to explore its claims.
          </p>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {[
              { label: "Topics", value: data ? totalTopics.toLocaleString() : "…", color: C.brand },
              { label: "Domains", value: data ? totalDomains.toLocaleString() : "…", color: "#93c5fd" },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: s.color, lineHeight: 1, fontFamily: "monospace" }}>{s.value}</div>
                <div style={{ fontSize: "0.72rem", color: C.faint, marginTop: "0.2rem" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "1.25rem 1.5rem 0" }}>
        <div style={{ position: "relative", marginBottom: "1.5rem" }}>
          <input
            type="text"
            placeholder="Search topics…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              background: C.panel, border: `1px solid ${C.panelEdge}`,
              color: C.ink, borderRadius: 10, padding: "0.55rem 1rem 0.55rem 2.25rem",
              width: "100%", fontSize: "0.88rem", outline: "none", boxSizing: "border-box",
            }}
          />
          <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: C.faint }}>⌕</span>
          {query && (
            <button onClick={() => setQuery("")} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.faint, cursor: "pointer" }}>✕</button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "0 1.5rem 4rem" }}>
        {!data && (
          <p style={{ color: C.faint, fontSize: "0.83rem", fontStyle: "italic" }}>Loading…</p>
        )}

        {data && results && (
          <div style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 10, padding: "0.35rem 0" }}>
            {results.length === 0 ? (
              <p style={{ color: C.faint, fontSize: "0.83rem", padding: "0.75rem 1rem" }}>No topics match &ldquo;{query}&rdquo;</p>
            ) : (
              results.map(t => <SearchResult key={t.id} topic={t} />)
            )}
          </div>
        )}

        {data && !results && (hiddenTopics > 0 || showEmpty) && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
            <button
              onClick={() => setShowEmpty(s => !s)}
              style={{
                background: "none", border: `1px solid ${C.panelEdge}`, borderRadius: 6,
                color: C.faint, fontSize: "0.72rem", padding: "0.25rem 0.6rem", cursor: "pointer",
              }}
            >
              {showEmpty ? "Hide empty topics" : `Show ${hiddenTopics.toLocaleString()} empty topics`}
            </button>
          </div>
        )}

        {viewData && !results && domainKeys.map(domain => (
          <DomainSection key={domain} domain={domain} roots={viewData[domain]} />
        ))}
      </div>
    </div>
  );
}
