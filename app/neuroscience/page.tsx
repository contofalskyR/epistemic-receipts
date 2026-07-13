"use client";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DomainStatusBadge } from "@/components/DomainStatusBadge";

import { useMemo, useState } from "react";
import Link from "next/link";
import katex from "katex";
import "katex/dist/katex.min.css";

import type { NeuroEntry, ColorKey, Family, Section, CircuitNode, NodeKind } from "./types";
import { LiveResearchCard } from "@/components/LiveResearchCard";
import { FAMILIES_1_7 } from "./data";
import { FAMILIES_8_13 } from "./data2";
import { FAMILIES_14_19 } from "./data3";
import {
  CIRCUIT_NODES,
  CIRCUIT_EDGES,
  NAMED_CIRCUITS,
  NODE_KIND_STYLES,
} from "./circuits";

const ALL_FAMILIES: Family[] = [...FAMILIES_1_7, ...FAMILIES_8_13, ...FAMILIES_14_19];

// ────────────────────────────────────────────────────────────────────────────
// Color palettes
// ────────────────────────────────────────────────────────────────────────────

const COLOR_STYLES: Record<
  ColorKey,
  {
    headerBg: string;
    headerBorder: string;
    headerText: string;
    chipBg: string;
    chipText: string;
    cardBorder: string;
    cardHover: string;
    accent: string;
  }
> = {
  violet:  { headerBg: "bg-violet-950/40",  headerBorder: "border-violet-900",  headerText: "text-violet-200",  chipBg: "bg-violet-950/60",  chipText: "text-violet-300",  cardBorder: "border-violet-950/70",  cardHover: "hover:border-violet-700",  accent: "text-violet-400" },
  indigo:  { headerBg: "bg-indigo-950/40",  headerBorder: "border-indigo-900",  headerText: "text-indigo-200",  chipBg: "bg-indigo-950/60",  chipText: "text-indigo-300",  cardBorder: "border-indigo-950/70",  cardHover: "hover:border-indigo-700",  accent: "text-indigo-400" },
  blue:    { headerBg: "bg-blue-950/40",    headerBorder: "border-blue-900",    headerText: "text-blue-200",    chipBg: "bg-blue-950/60",    chipText: "text-blue-300",    cardBorder: "border-blue-950/70",    cardHover: "hover:border-blue-700",    accent: "text-blue-400" },
  sky:     { headerBg: "bg-sky-950/40",     headerBorder: "border-sky-900",     headerText: "text-sky-200",     chipBg: "bg-sky-950/60",     chipText: "text-sky-300",     cardBorder: "border-sky-950/70",     cardHover: "hover:border-sky-700",     accent: "text-sky-400" },
  cyan:    { headerBg: "bg-cyan-950/40",    headerBorder: "border-cyan-900",    headerText: "text-cyan-200",    chipBg: "bg-cyan-950/60",    chipText: "text-cyan-300",    cardBorder: "border-cyan-950/70",    cardHover: "hover:border-cyan-700",    accent: "text-cyan-400" },
  teal:    { headerBg: "bg-teal-950/40",    headerBorder: "border-teal-900",    headerText: "text-teal-200",    chipBg: "bg-teal-950/60",    chipText: "text-teal-300",    cardBorder: "border-teal-950/70",    cardHover: "hover:border-teal-700",    accent: "text-teal-400" },
  emerald: { headerBg: "bg-emerald-950/40", headerBorder: "border-emerald-900", headerText: "text-emerald-200", chipBg: "bg-emerald-950/60", chipText: "text-emerald-300", cardBorder: "border-emerald-950/70", cardHover: "hover:border-emerald-700", accent: "text-emerald-400" },
  green:   { headerBg: "bg-green-950/40",   headerBorder: "border-green-900",   headerText: "text-green-200",   chipBg: "bg-green-950/60",   chipText: "text-green-300",   cardBorder: "border-green-950/70",   cardHover: "hover:border-green-700",   accent: "text-green-400" },
  amber:   { headerBg: "bg-amber-950/40",   headerBorder: "border-amber-900",   headerText: "text-amber-200",   chipBg: "bg-amber-950/60",   chipText: "text-amber-300",   cardBorder: "border-amber-950/70",   cardHover: "hover:border-amber-700",   accent: "text-amber-400" },
  rose:    { headerBg: "bg-rose-950/40",    headerBorder: "border-rose-900",    headerText: "text-rose-200",    chipBg: "bg-rose-950/60",    chipText: "text-rose-300",    cardBorder: "border-rose-950/70",    cardHover: "hover:border-rose-700",    accent: "text-rose-400" },
};

const SECTION_INFO: Record<Section, { name: string; tagline: string }> = {
  A: { name: "Section A — Cellular & Molecular Neuroscience", tagline: "Neurons, glia, membranes, synapses, neurotransmitters." },
  B: { name: "Section B — Brain Architecture", tagline: "Cortex, subcortical structures, circuits, and networks." },
  C: { name: "Section C — Sensory & Motor Systems", tagline: "Vision, audition, somatosensation, pain, and motor control." },
  D: { name: "Section D — Development, Plasticity & Cognition", tagline: "Neural development, plasticity, memory, attention, consciousness." },
  E: { name: "Section E — Disorders, Methods & Frontiers", tagline: "Neurological and psychiatric disease, imaging, computation, open problems." },
};

// ────────────────────────────────────────────────────────────────────────────
// KaTeX rendering helpers
// ────────────────────────────────────────────────────────────────────────────

function escapeHTML(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInlineMath(text: string): string {
  if (!text) return "";
  const re = /\$([^$]+)\$/g;
  let last = 0;
  let out = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out += escapeHTML(text.slice(last, m.index));
    try {
      out += katex.renderToString(m[1], { throwOnError: false, output: "html", strict: "ignore" });
    } catch {
      out += escapeHTML(m[0]);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out += escapeHTML(text.slice(last));
  return out;
}

function renderMathExpr(expr: string): string {
  try {
    return katex.renderToString(expr, { throwOnError: false, output: "html", strict: "ignore", displayMode: false });
  } catch {
    return escapeHTML(expr);
  }
}

function plainText(text: string): string {
  return text.replace(/\$([^$]+)\$/g, "$1");
}

function MathFragment({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderInlineMath(text), [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function MathExpr({ expr, className }: { expr: string; className?: string }) {
  const html = useMemo(() => renderMathExpr(expr), [expr]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ────────────────────────────────────────────────────────────────────────────
// Filter / search
// ────────────────────────────────────────────────────────────────────────────

function entryMatches(entry: NeuroEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.description.toLowerCase().includes(q)) return true;
  if (plainText(entry.keyFact).toLowerCase().includes(q)) return true;
  if (entry.formula && plainText(entry.formula).toLowerCase().includes(q)) return true;
  if (entry.example && plainText(entry.example).toLowerCase().includes(q)) return true;
  if (entry.researcher && entry.researcher.toLowerCase().includes(q)) return true;
  if (entry.tags.some((t) => t.toLowerCase().includes(q))) return true;
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Neural circuit explorer
// ────────────────────────────────────────────────────────────────────────────

const NODE_INDEX: Record<string, CircuitNode> = Object.fromEntries(
  CIRCUIT_NODES.map((n) => [n.id, n]),
);

function CircuitExplorer({
  activeCircuits,
  onToggleCircuit,
  selectedNode,
  onSelectNode,
}: {
  activeCircuits: Set<string>;
  onToggleCircuit: (id: string) => void;
  selectedNode: CircuitNode | null;
  onSelectNode: (n: CircuitNode | null) => void;
}) {
  const W = 720;
  const H = 460;
  const noCircuitSelected = activeCircuits.size === 0;

  // Edges to render: if any circuits are active, only those edges; otherwise all dim
  const visibleEdges = useMemo(() => {
    if (noCircuitSelected) return CIRCUIT_EDGES;
    return CIRCUIT_EDGES.filter((e) =>
      e.circuits.some((c) => activeCircuits.has(c)),
    );
  }, [activeCircuits, noCircuitSelected]);

  // Which nodes are participating in an active circuit
  const activeNodes = useMemo(() => {
    if (noCircuitSelected) return new Set<string>();
    const s = new Set<string>();
    for (const e of visibleEdges) {
      s.add(e.from);
      s.add(e.to);
    }
    return s;
  }, [visibleEdges, noCircuitSelected]);

  return (
    <div className="space-y-3">
      {/* Circuit toggles */}
      <div className="flex flex-wrap gap-1.5">
        {NAMED_CIRCUITS.map((c) => {
          const active = activeCircuits.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onToggleCircuit(c.id)}
              title={`${c.description} — ${c.function}`}
              className={`text-[10px] px-2 py-1 rounded font-mono border transition-colors ${
                active ? "text-white" : "text-gray-400 hover:text-white"
              }`}
              style={{
                background: active ? `${c.color}33` : "transparent",
                borderColor: active ? c.color : "#374151",
              }}
            >
              <span
                className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle"
                style={{ background: c.color }}
              />
              {c.name}
            </button>
          );
        })}
      </div>

      {/* SVG canvas */}
      <div className="overflow-x-auto">
        <svg
          width={W}
          height={H}
          role="img"
          aria-label="Interactive neural circuit explorer"
          className="block rounded border border-gray-800 bg-gray-950"
        >
          <defs>
            {NAMED_CIRCUITS.map((c) => (
              <marker
                key={`arr-${c.id}`}
                id={`arr-${c.id}`}
                viewBox="0 0 10 10"
                refX={9}
                refY={5}
                markerWidth={6}
                markerHeight={6}
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={c.color} />
              </marker>
            ))}
            <marker
              id="arr-dim"
              viewBox="0 0 10 10"
              refX={9}
              refY={5}
              markerWidth={5}
              markerHeight={5}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
            </marker>
          </defs>

          {/* Skull silhouette for context */}
          <path
            d="M 50 235 C 50 90, 220 50, 400 50 C 580 50, 670 120, 685 235 C 690 340, 560 390, 470 390 L 320 400 C 200 410, 50 380, 50 235 Z"
            fill="#0a0a0a"
            stroke="#1f2937"
            strokeWidth={1}
          />

          {/* Edges */}
          {visibleEdges.map((e, i) => {
            const a = NODE_INDEX[e.from];
            const b = NODE_INDEX[e.to];
            if (!a || !b) return null;
            // Pick the most relevant active circuit for color
            const activeCircuit = noCircuitSelected
              ? null
              : e.circuits.find((c) => activeCircuits.has(c));
            const colorObj = activeCircuit
              ? NAMED_CIRCUITS.find((c) => c.id === activeCircuit)
              : null;
            const color = colorObj?.color ?? "#374151";
            const markerId = activeCircuit ? `arr-${activeCircuit}` : "arr-dim";
            const opacity = noCircuitSelected ? 0.18 : 1;

            // Curve edges slightly so opposite-direction pairs are visible
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const norm = Math.sqrt(dx * dx + dy * dy) || 1;
            const offset = 6;
            const nx = -dy / norm;
            const ny = dx / norm;
            const cx = (a.x + b.x) / 2 + nx * offset;
            const cy = (a.y + b.y) / 2 + ny * offset;

            // Trim endpoints away from circles
            const r = 10;
            const ax = a.x + (cx - a.x) * (r / Math.hypot(cx - a.x, cy - a.y));
            const ay = a.y + (cy - a.y) * (r / Math.hypot(cx - a.x, cy - a.y));
            const bxp = b.x + (cx - b.x) * (r / Math.hypot(cx - b.x, cy - b.y));
            const byp = b.y + (cy - b.y) * (r / Math.hypot(cx - b.x, cy - b.y));

            return (
              <path
                key={`e-${i}`}
                d={`M ${ax} ${ay} Q ${cx} ${cy} ${bxp} ${byp}`}
                fill="none"
                stroke={color}
                strokeWidth={activeCircuit ? 1.6 : 0.8}
                opacity={opacity}
                markerEnd={`url(#${markerId})`}
              />
            );
          })}

          {/* Nodes */}
          {CIRCUIT_NODES.map((n) => {
            const s = NODE_KIND_STYLES[n.kind];
            const isSelected = selectedNode?.id === n.id;
            const isActive = noCircuitSelected || activeNodes.has(n.id);
            return (
              <g
                key={n.id}
                onClick={() => onSelectNode(n)}
                style={{ cursor: "pointer" }}
                opacity={isActive ? 1 : 0.25}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={isSelected ? 12 : 10}
                  fill={s.bg}
                  stroke={isSelected ? "#ffffff" : s.border}
                  strokeWidth={isSelected ? 2 : 1.2}
                />
                <text
                  x={n.x}
                  y={n.y + 3}
                  textAnchor="middle"
                  fontSize={8}
                  fill={s.text}
                  fontFamily="ui-monospace, monospace"
                  pointerEvents="none"
                >
                  {n.label.length > 5 ? n.label.slice(0, 5) : n.label}
                </text>
                <title>{`${n.label} — ${s.label}`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px]">
        {Object.entries(NODE_KIND_STYLES).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}
            />
            <span style={{ color: s.text }} className="font-mono">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CircuitNodeDetail({ node }: { node: CircuitNode }) {
  const s = NODE_KIND_STYLES[node.kind];
  // Find which circuits this node participates in
  const memberships = useMemo(() => {
    const ids = new Set<string>();
    for (const e of CIRCUIT_EDGES) {
      if (e.from === node.id || e.to === node.id) {
        for (const c of e.circuits) ids.add(c);
      }
    }
    return NAMED_CIRCUITS.filter((c) => ids.has(c.id));
  }, [node]);

  return (
    <div
      className="rounded border p-4 space-y-3"
      style={{ borderColor: s.border, background: `${s.bg}66` }}
    >
      <div>
        <p className="text-[10px] uppercase tracking-widest" style={{ color: s.text }}>{s.label}</p>
        <h3 className="text-lg font-semibold text-white">{node.label}</h3>
      </div>
      <p className="text-xs text-gray-200 leading-relaxed">{node.note}</p>
      {memberships.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Participates in</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {memberships.map((c) => (
              <span
                key={c.id}
                className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: `${c.color}33`, color: c.color, border: `1px solid ${c.color}55` }}
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Xref & status badges
// ────────────────────────────────────────────────────────────────────────────

function XrefBadges({ entry }: { entry: NeuroEntry }) {
  if (!entry.xref || entry.xref.length === 0) return null;
  return (
    <>
      {entry.xref.map((x) => (
        <Link
          key={x}
          href={`/${x}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-300 font-mono hover:bg-gray-700 hover:text-white transition-colors"
          title={`Cross-reference: see /${x}`}
        >
          xref: {x}
        </Link>
      ))}
    </>
  );
}


// ────────────────────────────────────────────────────────────────────────────
// Entry card
// ────────────────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  family,
  expanded,
  onToggle,
}: {
  entry: NeuroEntry;
  family: Family;
  expanded: boolean;
  onToggle: () => void;
}) {
  const c = COLOR_STYLES[family.color];
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`block rounded border ${c.cardBorder} ${expanded ? "border-gray-600" : c.cardHover} bg-gray-900/40 px-4 py-3 transition-colors group cursor-pointer focus:outline-none focus:border-gray-500 sm:col-span-1 ${expanded ? "sm:col-span-2" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-white group-hover:text-gray-100">{entry.name}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <DomainStatusBadge status={entry.status ?? ""} />
          <Link
            href={`/search?q=${encodeURIComponent(entry.name)}`}
            onClick={(e) => e.stopPropagation()}
            className={`text-[10px] font-mono ${c.accent} opacity-60 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:underline`}
          >
            search →
          </Link>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400 leading-snug">{entry.description}</p>
      {(entry.tags.length > 0 || (entry.xref && entry.xref.length > 0)) && (
        <div className="mt-2 flex flex-wrap gap-1 items-center">
          {entry.tags.map((tag) => (
            <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded ${c.chipBg} ${c.chipText} font-mono`}>
              {tag}
            </span>
          ))}
          <XrefBadges entry={entry} />
        </div>
      )}
      <div className="mt-2 text-xs text-gray-300 leading-relaxed">
        <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Key fact</span>
        <MathFragment text={entry.keyFact} />
      </div>
      {entry.formula && (
        <div className="mt-1 text-xs text-gray-300 leading-relaxed">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Formula</span>
          <MathExpr expr={entry.formula} />
        </div>
      )}
      {entry.researcher && (
        <div className="mt-1 text-[11px] text-gray-400 leading-relaxed">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Researcher</span>
          {entry.researcher}
        </div>
      )}

      {expanded && entry.example && (
        <div className="mt-3 pt-3 -mx-4 -mb-3 px-4 pb-4 border-t border-gray-700/70 bg-gray-900/80 rounded-b space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Example</p>
            <p className="mt-1 text-xs text-gray-300 leading-relaxed">
              <MathFragment text={entry.example} />
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Family section
// ────────────────────────────────────────────────────────────────────────────

function slugifyEntry(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function FamilySection({
  family,
  filteredEntries,
  collapsed,
  onToggleCollapse,
  expanded,
  setExpanded,
}: {
  family: Family;
  filteredEntries: NeuroEntry[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  expanded: string | null;
  setExpanded: (key: string | null) => void;
}) {
  const c = COLOR_STYLES[family.color];

  return (
    <section className={`rounded-lg border ${c.headerBorder} overflow-hidden`} id={`family-${family.slug}`}>
      <button
        onClick={onToggleCollapse}
        className={`w-full text-left px-5 py-3 ${c.headerBg} hover:brightness-125 transition-all flex items-baseline justify-between gap-4`}
      >
        <div className="min-w-0">
          <h2 className={`text-base font-semibold ${c.headerText}`}>
            <span className="text-xs font-mono mr-2 opacity-70">Fam {family.number}</span>
            {family.name}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">{family.blurb}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-mono ${c.accent}`}>
            {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}
          </span>
          <span className={`text-xs ${c.accent}`}>{collapsed ? "▸" : "▾"}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="bg-gray-950/40 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredEntries.map((entry) => {
              const key = `${family.slug}::${entry.name}`;
              return (
                <div key={entry.name} id={`entry-${slugifyEntry(entry.name)}`}>
                  <EntryCard
                    entry={entry}
                    family={family}
                    expanded={expanded === key}
                    onToggle={() => setExpanded(expanded === key ? null : key)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Section header
// ────────────────────────────────────────────────────────────────────────────

function SectionHeader({ section, count }: { section: Section; count: number }) {
  const info = SECTION_INFO[section];
  return (
    <div className="border-b border-gray-800/60 pb-2 pt-4 first:pt-0">
      <h2 className="text-sm font-semibold text-gray-300 tracking-wide">{info.name}</h2>
      <p className="text-xs text-gray-500 mt-0.5">{info.tagline} · {count} entries</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

const ALL_SLUGS = ALL_FAMILIES.map((f) => f.slug);
const KIND_COUNTS: Record<NodeKind, number> = CIRCUIT_NODES.reduce(
  (acc, n) => {
    acc[n.kind] = (acc[n.kind] ?? 0) + 1;
    return acc;
  },
  { cortex: 0, subcortical: 0, brainstem: 0, cerebellum: 0, sensory: 0, motor: 0 } as Record<NodeKind, number>,
);

export default function NeurosciencePage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeCircuits, setActiveCircuits] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<CircuitNode | null>(null);
  const [showCircuits, setShowCircuits] = useState(true);

  const filtered = useMemo(() => {
    return ALL_FAMILIES.map((f) => ({
      family: f,
      entries: f.entries.filter((e) => entryMatches(e, query)),
    })).filter((f) => f.entries.length > 0);
  }, [query]);

  const totalEntries = ALL_FAMILIES.reduce((s, f) => s + f.entries.length, 0);
  const matchCount = filtered.reduce((s, f) => s + f.entries.length, 0);

  const toggleFamily = (slug: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleCircuit = (id: string) => {
    setActiveCircuits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(ALL_SLUGS));

  const bySection: Record<Section, { family: Family; entries: NeuroEntry[] }[]> = { A: [], B: [], C: [], D: [], E: [] };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Neuroscience — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to neuroscience across {ALL_FAMILIES.length} families and five sections — Cellular &amp;
          Molecular, Brain Architecture, Sensory &amp; Motor Systems, Development/Plasticity/Cognition, and
          Disorders/Methods/Frontiers. Each card carries a <em>key fact</em>, where relevant a <em>formula</em>{" "}
          (typeset with KaTeX), the original <em>researcher</em>, and an <em>example</em>. Status badges
          mark <strong>LANDMARK</strong>, <strong>CONTESTED</strong>, <strong>REFUTED</strong>, and{" "}
          <strong>OPEN</strong> entries — the last covers genuine frontier questions like the hard problem of
          consciousness and adult human hippocampal neurogenesis.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Cross-references: entries marked <span className="font-mono">xref</span> link to{" "}
          <Link href="/biology" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">biology</Link>,{" "}
          <Link href="/psychology" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">psychology</Link>,{" "}
          <Link href="/medicine" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">medicine</Link>,{" "}
          <Link href="/chemistry" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">chemistry</Link>,{" "}
          <Link href="/philosophy" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">philosophy</Link>,
          and other siblings rather than duplicating.
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries · {CIRCUIT_NODES.length} brain nodes · {NAMED_CIRCUITS.length} named circuits
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
        </p>
      </div>

      {/* Circuit explorer */}
      <section className="rounded-lg border border-gray-800 overflow-hidden">
        <button
          onClick={() => setShowCircuits((v) => !v)}
          className="w-full text-left px-5 py-3 bg-gray-900/60 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-100">Neural circuit explorer</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {CIRCUIT_NODES.length} brain regions and {NAMED_CIRCUITS.length} named circuits — click circuit buttons to highlight a pathway; click any node to see what it does.
            </p>
          </div>
          <span className="text-xs text-gray-400">{showCircuits ? "▾" : "▸"}</span>
        </button>
        {showCircuits && (
          <div className="bg-gray-950/40 p-4 grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <CircuitExplorer
                activeCircuits={activeCircuits}
                onToggleCircuit={toggleCircuit}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
              />
              <p className="text-[10px] text-gray-600 mt-2 leading-snug">
                Schematic left-sagittal layout. Coordinates are illustrative, not anatomically precise.
                Nodes: cortex {KIND_COUNTS.cortex} · subcortical {KIND_COUNTS.subcortical} · brainstem {KIND_COUNTS.brainstem} ·
                cerebellum {KIND_COUNTS.cerebellum} · sensory {KIND_COUNTS.sensory} · motor {KIND_COUNTS.motor}.
              </p>
            </div>
            <div className="space-y-3">
              {selectedNode ? (
                <CircuitNodeDetail node={selectedNode} />
              ) : (
                <div className="rounded border border-gray-800 p-4 text-xs text-gray-400">
                  Click any node in the diagram to see its function and circuit memberships, or click a circuit
                  pill (Visual ventral, Default Mode, Mesolimbic reward, …) to highlight a pathway.
                </div>
              )}
              {activeCircuits.size > 0 && (
                <div className="space-y-2">
                  {NAMED_CIRCUITS.filter((c) => activeCircuits.has(c.id)).map((c) => (
                    <div
                      key={c.id}
                      className="rounded border p-3"
                      style={{ borderColor: `${c.color}66`, background: `${c.color}11` }}
                    >
                      <p
                        className="text-xs font-semibold"
                        style={{ color: c.color }}
                      >
                        {c.name}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-300 leading-snug">{c.description}</p>
                      <p className="mt-1 text-[11px] text-gray-400 leading-snug italic">{c.function}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Filter / controls */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, key fact, formula, tag, researcher — e.g. 'Hodgkin', 'LTP', 'optogenetics', 'amygdala'"
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <div className="flex gap-2 text-xs">
          <button
            onClick={expandAll}
            className="px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            Collapse all
          </button>
          {query && (
            <button
              onClick={() => setQuery("")}
              className="px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">
          No entries match &ldquo;{query}&rdquo;. Try a broader term.
        </p>
      ) : (
        <div className="space-y-8">
      <FieldGuideBanner domain="Neuroscience" className="mb-2" />
          {(["A", "B", "C", "D", "E"] as Section[]).map((sec) => {
            const items = bySection[sec];
            if (items.length === 0) return null;
            return (
              <div key={sec} className="space-y-4">
                <SectionHeader section={sec} count={sectionCounts[sec]} />
                {items.map(({ family, entries }) => (
                  <FamilySection
                    key={family.slug}
                    family={family}
                    filteredEntries={entries}
                    collapsed={collapsed.has(family.slug)}
                    onToggleCollapse={() => toggleFamily(family.slug)}
                    expanded={expanded}
                    setExpanded={setExpanded}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      <LiveResearchCard slug="neuroscience" />

      <div className="border-t border-gray-800 pt-6 mt-12 space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Note:</span> the &ldquo;search&rdquo; link on each card runs a free-text
          search over claim and source text. A term appearing in a claim does not mean the claim is{" "}
          <em>about</em> that concept — only that the term is present.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Open and contested:</span> entries marked{" "}
          <span className="text-red-300 font-mono">OPEN</span> are genuine frontier questions as of 2026 —
          the hard problem of consciousness, free will, adult human neurogenesis, animal sentience, the
          neural code, whole-brain emulation. Entries marked{" "}
          <span className="text-amber-300 font-mono">CONTESTED</span> involve unresolved theoretical
          frameworks (IIT, GWT, predictive coding, free energy), pathway debates (psychedelics, microbiome–gut–brain),
          or replication-stressed psychiatric models (monoamine hypothesis, mirror-neuron generalizations).
          Cross-references to <Link href="/philosophy" className="underline underline-offset-2">philosophy</Link> and{" "}
          <Link href="/medicine" className="underline underline-offset-2">medicine</Link> carry the surrounding
          debate where it lives.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-06 · LaTeX typesetting via KaTeX · {ALL_FAMILIES.length} families · {totalEntries} entries · {CIRCUIT_NODES.length} circuit nodes · {NAMED_CIRCUITS.length} named pathways
        </p>
      </div>
      <div className="border-t border-gray-700/40 pt-6 mt-4">
        <p className="text-[11px] font-mono uppercase tracking-widest text-gray-600 mb-2">Discover related claims in the graph</p>
        <div className="flex flex-wrap gap-4">
          <a href="/search?q=neuroscience" className="text-xs text-sky-400/70 hover:text-sky-300 transition-colors font-mono">
            Search Neuroscience in the claim graph →
          </a>
          <a href="/settling-curve" className="text-xs text-amber-400/50 hover:text-amber-300 transition-colors font-mono">
            Browse all trajectories →
          </a>
        </div>
      </div>
    </div>
  );
}
