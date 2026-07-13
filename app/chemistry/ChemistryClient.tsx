"use client";
import { DomainStatusBadge } from "@/components/DomainStatusBadge";

import { useMemo, useState } from "react";
import Link from "next/link";
import katex from "katex";
import "katex/dist/katex.min.css";
// Side-effect import — mhchem registers \ce{...} on the katex global at module load.
import "katex/contrib/mhchem/mhchem.js";

import type { ChemEntry, ColorKey, Family, Section } from "./types";
import { FAMILIES_1_7 } from "./data";
import { FAMILIES_8_14 } from "./data2";
import { FAMILIES_15_21 } from "./data3";
import { ELEMENTS, CATEGORY_STYLES } from "./elements";
import type { PeriodicElement } from "./types";
import { LiveResearchCard } from "@/components/LiveResearchCard";

const ALL_FAMILIES: Family[] = [...FAMILIES_1_7, ...FAMILIES_8_14, ...FAMILIES_15_21];

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
  A: { name: "Section A — Foundations", tagline: "Atoms, the periodic table, bonds, and the forces between molecules." },
  B: { name: "Section B — Physical Chemistry", tagline: "Stoichiometry, phases, thermodynamics, kinetics, equilibrium, and electrochemistry." },
  C: { name: "Section C — Organic Chemistry", tagline: "Functional groups, named reactions, stereochemistry, and polymers." },
  D: { name: "Section D — Inorganic, Materials & Nuclear", tagline: "Coordination chemistry, solids, semiconductors, and nuclei." },
  E: { name: "Section E — Analytical, Biological & Cross-cutting", tagline: "How we measure, the chemistry of life, and the great industrial reactions and open questions." },
};

// ────────────────────────────────────────────────────────────────────────────
// KaTeX + mhchem rendering helpers
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

// Render a raw chemistry expression. Auto-wraps in \ce{...} when the expression is plain
// chemistry notation (no '=' and no LaTeX command); leaves explicit \ce{...} or math expressions intact.
function renderChemExpr(expr: string): string {
  let wrapped = expr;
  const looksLikeMath = expr.includes("=") || /\\(frac|Delta|Sigma|sum|prod|int|sin|cos|tan|ln|log|sqrt|cdot|times|circ|approx|infty|alpha|beta|gamma|lambda|mu|nu|pi|sigma|theta|varepsilon|hbar|vec|bar|tilde)/.test(expr);
  if (!expr.includes("\\ce{") && !looksLikeMath) {
    wrapped = `\\ce{${expr}}`;
  }
  try {
    return katex.renderToString(wrapped, { throwOnError: false, output: "html", strict: "ignore", displayMode: false });
  } catch {
    return escapeHTML(expr);
  }
}

function plainText(text: string): string {
  // Strip $...$ wrappers for filter / index purposes.
  let out = text.replace(/\$([^$]+)\$/g, "$1");
  // Strip a leading/trailing whole-string \ce{...} for filter purposes.
  out = out.replace(/\\ce\{([^}]*)\}/g, "$1");
  return out;
}

function MathFragment({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderInlineMath(text), [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function ChemExpr({ expr, className }: { expr: string; className?: string }) {
  const html = useMemo(() => renderChemExpr(expr), [expr]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ────────────────────────────────────────────────────────────────────────────
// Build a global index of entries by name (for transform resolution)
// ────────────────────────────────────────────────────────────────────────────

type EntryRef = { entry: ChemEntry; family: Family };

const NAME_INDEX: Map<string, EntryRef> = new Map();
for (const fam of ALL_FAMILIES) {
  for (const entry of fam.entries) {
    NAME_INDEX.set(entry.name.toLowerCase(), { entry, family: fam });
  }
}

function lookupEntry(name: string): EntryRef | undefined {
  return NAME_INDEX.get(name.toLowerCase());
}

function slugifyEntry(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ────────────────────────────────────────────────────────────────────────────
// Filter / search — every textual field flows through plainText()
// ────────────────────────────────────────────────────────────────────────────

function entryMatches(entry: ChemEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.description.toLowerCase().includes(q)) return true;
  if (plainText(entry.keyFact).toLowerCase().includes(q)) return true;
  if (entry.formula && plainText(entry.formula).toLowerCase().includes(q)) return true;
  if (entry.reaction && plainText(entry.reaction).toLowerCase().includes(q)) return true;
  if (entry.example && plainText(entry.example).toLowerCase().includes(q)) return true;
  if (entry.tags.some((t) => t.toLowerCase().includes(q))) return true;
  if (entry.transforms?.some((t) => t.from.toLowerCase().includes(q) || t.to.toLowerCase().includes(q))) return true;
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Periodic table component
// ────────────────────────────────────────────────────────────────────────────

const CELL = 38;
const GAP = 2;
const ROWS = 7;
const COLS = 18;

function PeriodicTable({ onSelect, selectedSymbol }: { onSelect: (el: PeriodicElement) => void; selectedSymbol: string | null }) {
  // Main grid: 7 rows × 18 columns. Period 6/7 group 3 is the entry point for the f-block strip below.
  // f-block strip: lanthanides (Z=57..71 minus Lu which sits in group 3 d-block) — but we render La..Lu = 15 cells.
  // Actinides: Ac..Lr — 15 cells. We render La..Lu and Ac..Lr each as a continuous strip.
  const lanthanides = ELEMENTS.filter((e) => e.atomicNumber >= 57 && e.atomicNumber <= 71);
  const actinides = ELEMENTS.filter((e) => e.atomicNumber >= 89 && e.atomicNumber <= 103);
  const mainGrid = ELEMENTS.filter((e) => !(e.atomicNumber >= 57 && e.atomicNumber <= 70) && !(e.atomicNumber >= 89 && e.atomicNumber <= 102));
  // We leave Lu (71) and Lr (103) in their group-3 main-grid positions per the placement we tagged in elements.ts.

  // Place a placeholder at period 6, group 3 / period 7, group 3 referencing the f-block strip.
  const placeholders = [
    { period: 6, group: 3, label: "57–70", target: "lanth" },
    { period: 7, group: 3, label: "89–102", target: "actin" },
  ];

  const cellFor = (period: number, group: number) => mainGrid.find((e) => e.period === period && e.group === group);

  const renderCell = (el: PeriodicElement, isSelected: boolean) => {
    const s = CATEGORY_STYLES[el.category];
    return (
      <button
        key={el.atomicNumber}
        onClick={() => onSelect(el)}
        title={`${el.name} (Z=${el.atomicNumber}) — ${s.label}`}
        className={`text-left transition-all`}
        style={{
          width: CELL,
          height: CELL,
          background: s.bg,
          border: `1px solid ${isSelected ? "#ffffff" : s.border}`,
          color: s.text,
          padding: 2,
          fontFamily: "ui-monospace, monospace",
          lineHeight: 1.0,
          cursor: "pointer",
          boxShadow: isSelected ? "0 0 0 2px #ffffff66" : undefined,
        }}
      >
        <div style={{ fontSize: 8, opacity: 0.75 }}>{el.atomicNumber}</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{el.symbol}</div>
      </button>
    );
  };

  return (
    <div className="space-y-1 overflow-x-auto">
      {/* Main 7×18 grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
          gap: GAP,
        }}
      >
        {Array.from({ length: ROWS }).flatMap((_, rowIdx) =>
          Array.from({ length: COLS }).map((_, colIdx) => {
            const period = rowIdx + 1;
            const group = colIdx + 1;
            const el = cellFor(period, group);
            const placeholder = placeholders.find((p) => p.period === period && p.group === group);
            if (el) {
              return renderCell(el, el.symbol === selectedSymbol);
            }
            if (placeholder) {
              return (
                <a
                  key={`ph-${period}-${group}`}
                  href={`#${placeholder.target}`}
                  className="flex items-center justify-center text-[9px] font-mono"
                  style={{
                    width: CELL,
                    height: CELL,
                    background: "#1f2937",
                    border: "1px dashed #4b5563",
                    color: "#9ca3af",
                  }}
                  title={`f-block strip — click to scroll`}
                >
                  {placeholder.label}
                </a>
              );
            }
            return <div key={`empty-${period}-${group}`} style={{ width: CELL, height: CELL }} />;
          }),
        )}
      </div>

      {/* f-block strips */}
      <div className="pt-2 flex items-center gap-3" id="lanth">
        <div className="text-[10px] font-mono text-gray-500 w-12 text-right">6 · f</div>
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${lanthanides.length}, ${CELL}px)`, gap: GAP }}
        >
          {lanthanides.map((el) => renderCell(el, el.symbol === selectedSymbol))}
        </div>
      </div>
      <div className="flex items-center gap-3" id="actin">
        <div className="text-[10px] font-mono text-gray-500 w-12 text-right">7 · f</div>
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${actinides.length}, ${CELL}px)`, gap: GAP }}
        >
          {actinides.map((el) => renderCell(el, el.symbol === selectedSymbol))}
        </div>
      </div>

      {/* Legend */}
      <div className="pt-3 flex flex-wrap gap-2 text-[10px]">
        {Object.entries(CATEGORY_STYLES).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}
            />
            <span style={{ color: s.text }} className="font-mono">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ElementDetail({ element }: { element: PeriodicElement }) {
  const s = CATEGORY_STYLES[element.category];
  return (
    <div
      className="rounded border p-4 space-y-2"
      style={{ borderColor: s.border, background: `${s.bg}80` }}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: s.text }}>
            {s.label}
          </p>
          <h3 className="text-2xl font-semibold text-white">
            {element.name} <span className="text-gray-400 font-mono text-base">({element.symbol})</span>
          </h3>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white font-mono">{element.atomicNumber}</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">atomic number Z</div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Group</p>
          <p className="text-gray-200 font-mono">{element.group}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Period</p>
          <p className="text-gray-200 font-mono">{element.period}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Block</p>
          <p className="text-gray-200 font-mono">{element.block}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Std. atomic weight</p>
          <p className="text-gray-200 font-mono">
            {element.standardAtomicWeight !== null ? element.standardAtomicWeight.toString() : "—"}
            {element.category === "actinide" || element.category === "unknown" || element.symbol === "Tc" || element.symbol === "Pm" ? (
              <span className="text-gray-500"> *</span>
            ) : null}
          </p>
        </div>
      </div>
      {element.disputedPlacement && (
        <p className="text-[11px] text-gray-400 leading-snug border-l-2 border-gray-700 pl-3 mt-2 italic">
          Placement note: {element.disputedPlacement}
        </p>
      )}
      <p className="text-[10px] text-gray-600">
        * Bracketed mass for elements with no stable isotope — value shown is the mass number of the most stable / cited isotope.
      </p>
      <div className="flex gap-2 pt-1">
        <Link
          href={`/search?q=${encodeURIComponent(element.name)}`}
          className="text-[11px] font-mono text-gray-400 hover:text-white underline underline-offset-2"
        >
          search receipts →
        </Link>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Reaction / transformation network — Family 12 nodes connected by Family 13 transforms
// ────────────────────────────────────────────────────────────────────────────

interface SynthNode {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isInFamily12: boolean;
}

interface SynthEdge {
  from: string;
  to: string;
  via: string;
}

function buildSynthGraph(): { nodes: SynthNode[]; edges: SynthEdge[] } {
  const family12 = ALL_FAMILIES.find((f) => f.slug === "functional-groups");
  const family13 = ALL_FAMILIES.find((f) => f.slug === "organic-reactions");
  if (!family12 || !family13) return { nodes: [], edges: [] };

  const nodeNames = new Set(family12.entries.map((e) => e.name));
  const edges: SynthEdge[] = [];
  for (const rxn of family13.entries) {
    if (!rxn.transforms) continue;
    for (const t of rxn.transforms) {
      if (nodeNames.has(t.from) && nodeNames.has(t.to)) {
        edges.push({ from: t.from, to: t.to, via: rxn.name });
      }
    }
  }

  // Lay out in a circle so the graph is readable without a force simulation.
  const names = Array.from(nodeNames);
  const W = 720;
  const H = 480;
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) / 2 - 80;
  const NW = 130;
  const NH = 28;
  const nodes: SynthNode[] = names.map((name, i) => {
    const theta = (2 * Math.PI * i) / names.length - Math.PI / 2;
    return {
      name,
      x: cx + r * Math.cos(theta) - NW / 2,
      y: cy + r * Math.sin(theta) - NH / 2,
      width: NW,
      height: NH,
      isInFamily12: true,
    };
  });
  return { nodes, edges };
}

function SynthesisMap({ onSelect }: { onSelect: (name: string) => void }) {
  const { nodes, edges } = useMemo(() => buildSynthGraph(), []);
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.name, n])), [nodes]);
  if (nodes.length === 0) return null;
  const W = 720;
  const H = 480;
  const markerId = "rxn-arrow";

  // Group parallel edges so labels don't overlap.
  const edgesByPair = new Map<string, SynthEdge[]>();
  for (const e of edges) {
    const k = `${e.from}->${e.to}`;
    if (!edgesByPair.has(k)) edgesByPair.set(k, []);
    edgesByPair.get(k)!.push(e);
  }

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} role="img" aria-label="Synthesis map: functional-group transforms">
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#60a5fa" />
          </marker>
        </defs>
        {Array.from(edgesByPair.entries()).map(([k, group]) => {
          const [from, to] = k.split("->");
          const src = nodeMap.get(from);
          const dst = nodeMap.get(to);
          if (!src || !dst) return null;
          const x1 = src.x + src.width / 2;
          const y1 = src.y + src.height / 2;
          const x2 = dst.x + dst.width / 2;
          const y2 = dst.y + dst.height / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          // Pull endpoints to node borders, not centers.
          const ax = x1 + ux * (src.width / 2 + 2);
          const ay = y1 + uy * (src.height / 2 + 2);
          const bx = x2 - ux * (dst.width / 2 + 2);
          const by = y2 - uy * (dst.height / 2 + 2);
          // Curve offset perpendicular to keep self-loops visible and parallel edges separated.
          const isSelf = from === to;
          if (isSelf) {
            const r = 28;
            const px = x1 + 12;
            const py = y1 - 24;
            const d = `M ${x1} ${y1 - src.height / 2} C ${px - r} ${py - r}, ${px + r} ${py - r}, ${x1 + src.width / 2} ${y1}`;
            return (
              <g key={k}>
                <path d={d} fill="none" stroke="#60a5fa" strokeWidth={1.2} markerEnd={`url(#${markerId})`} />
                <text x={px} y={py - 20} fontSize={9} fill="#9ca3af" textAnchor="middle" fontFamily="ui-monospace, monospace">
                  {group.map((e) => e.via).join(", ").slice(0, 28)}
                </text>
              </g>
            );
          }
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2;
          const perpx = -uy;
          const perpy = ux;
          const labelOffset = 12;
          return (
            <g key={k}>
              <path
                d={`M ${ax} ${ay} L ${bx} ${by}`}
                fill="none"
                stroke="#60a5fa"
                strokeWidth={1.2}
                strokeOpacity={0.7}
                markerEnd={`url(#${markerId})`}
              />
              <text
                x={mx + perpx * labelOffset}
                y={my + perpy * labelOffset}
                fontSize={9}
                fill="#9ca3af"
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
              >
                {group.map((e) => e.via).join(", ").slice(0, 32)}
              </text>
            </g>
          );
        })}
        {nodes.map((n) => (
          <g
            key={n.name}
            onClick={() => onSelect(n.name)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={n.x}
              y={n.y}
              width={n.width}
              height={n.height}
              rx={4}
              fill="#1e3a5f"
              stroke="#3b82f6"
              strokeWidth={1}
            />
            <text
              x={n.x + n.width / 2}
              y={n.y + n.height / 2 + 4}
              textAnchor="middle"
              fill="#93c5fd"
              fontSize={11}
              fontFamily="ui-monospace, monospace"
            >
              {n.name.length > 18 ? n.name.slice(0, 17) + "…" : n.name}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-[10px] text-gray-500 mt-2">
        Nodes are functional-group / compound classes (Family 12). Directed edges are named reactions (Family 13) labeled by reaction. Click a node to jump to its card.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Xref badges
// ────────────────────────────────────────────────────────────────────────────

function XrefBadges({ entry }: { entry: ChemEntry }) {
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
  entry: ChemEntry;
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
          <ChemExpr expr={entry.formula} />
        </div>
      )}
      {entry.reaction && (
        <div className="mt-1 text-xs text-gray-300 leading-relaxed">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Reaction</span>
          <ChemExpr expr={entry.reaction} />
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 -mx-4 -mb-3 px-4 pb-4 border-t border-gray-700/70 bg-gray-900/80 rounded-b space-y-3">
          {entry.example && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Example</p>
              <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                <MathFragment text={entry.example} />
              </p>
            </div>
          )}
          {entry.transforms && entry.transforms.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Transforms (synthesis map edges)</p>
              <ul className="mt-1 text-xs text-gray-300 leading-relaxed list-disc list-inside">
                {entry.transforms.map((t, i) => {
                  const fromRef = lookupEntry(t.from);
                  const toRef = lookupEntry(t.to);
                  return (
                    <li key={i}>
                      {fromRef ? (
                        <Link
                          href={`#entry-${slugifyEntry(fromRef.entry.name)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="underline underline-offset-2 hover:text-white"
                        >
                          {t.from}
                        </Link>
                      ) : (
                        <span>{t.from}</span>
                      )}
                      <span className="text-gray-500 mx-1">→</span>
                      {toRef ? (
                        <Link
                          href={`#entry-${slugifyEntry(toRef.entry.name)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="underline underline-offset-2 hover:text-white"
                        >
                          {t.to}
                        </Link>
                      ) : (
                        <span>{t.to}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Family section
// ────────────────────────────────────────────────────────────────────────────

function FamilySection({
  family,
  filteredEntries,
  collapsed,
  onToggleCollapse,
  expanded,
  setExpanded,
}: {
  family: Family;
  filteredEntries: ChemEntry[];
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

export default function ChemistryPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<PeriodicElement | null>(null);
  const [showSynth, setShowSynth] = useState(false);

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

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(ALL_SLUGS));

  // Group filtered families by section
  const bySection: Record<Section, { family: Family; entries: ChemEntry[] }[]> = { A: [], B: [], C: [], D: [], E: [] };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  const handleSelectFunctionalGroup = (name: string) => {
    const ref = lookupEntry(name);
    if (!ref) return;
    setExpanded(`${ref.family.slug}::${ref.entry.name}`);
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(ref.family.slug);
      return next;
    });
    const el = document.getElementById(`entry-${slugifyEntry(ref.entry.name)}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Chemistry — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to chemistry organized into 21 families across five sections — Foundations, Physical Chemistry,
          Organic, Inorganic/Materials/Nuclear, and Analytical/Biochemistry/Open Questions. Each card carries a
          <em> key fact</em>, where relevant a <em>formula</em> and a <em>balanced reaction</em> (LaTeX{" "}
          <span className="font-mono">\ce{`{...}`}</span>, typeset with KaTeX + mhchem), a list of{" "}
          <em>transforms</em> for reactions (the directed edges of the synthesis map), and an{" "}
          <em>example</em>. Color codes the family; clicking a header collapses it; clicking a card expands it.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Cross-references: entries marked <span className="font-mono">xref</span> link to{" "}
          <Link href="/mathematics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">mathematics</Link>{" "}
          or{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">statistics</Link>{" "}
          rather than duplicating. The two mandatory views are the{" "}
          <strong>interactive periodic table</strong> (every confirmed element clickable to its details) and the{" "}
          <strong>synthesis map</strong> (Family 12 functional groups as nodes, Family 13 named reactions as
          directed edges).
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries · {ELEMENTS.length} elements
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
        </p>
      </div>

      {/* Periodic table */}
      <section className="rounded-lg border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 bg-gray-900/40 border-b border-gray-800">
          <h2 className="text-base font-semibold text-gray-200">Interactive periodic table</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            All 118 confirmed elements through oganesson (Z=118) in the standard 18-column × 7-row layout, with the
            lanthanide and actinide strips beneath. Click any cell. Period 7 is complete; elements 119+ have not been
            synthesized. Colors group elements by category — see legend below the table.
          </p>
        </div>
        <div className="p-4 bg-gray-950/40 space-y-3">
          <PeriodicTable
            onSelect={(el) => setSelectedElement(el)}
            selectedSymbol={selectedElement?.symbol ?? null}
          />
          {selectedElement && <ElementDetail element={selectedElement} />}
        </div>
      </section>

      {/* Synthesis map */}
      <section className="rounded-lg border border-blue-900 overflow-hidden">
        <button
          onClick={() => setShowSynth((v) => !v)}
          className="w-full text-left px-5 py-3 bg-blue-950/40 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-blue-200">Reaction / transformation network (synthesis map)</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Compound classes as nodes (Family 12). Named reactions as directed edges (Family 13). Built from the{" "}
              <span className="font-mono">transforms</span> field on each reaction entry.
            </p>
          </div>
          <span className="text-xs text-blue-400">{showSynth ? "▾" : "▸"}</span>
        </button>
        {showSynth && (
          <div className="bg-gray-950/40 p-4">
            <SynthesisMap onSelect={handleSelectFunctionalGroup} />
          </div>
        )}
      </section>

      {/* Filter / controls */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, key fact, formula, reaction, tag — e.g. 'acid', 'aromatic', 'redox', 'enzyme'"
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

      <LiveResearchCard slug="chemistry" />

      <div className="border-t border-gray-800 pt-6 mt-12 space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Note:</span> the &ldquo;search&rdquo; link on each card runs a free-text
          search over claim and source text. A term appearing in a claim does not mean the claim is{" "}
          <em>about</em> that concept — only that the term is present. A claim-powered explorer that links chemistry
          concepts to the specific receipts that cite them is on the roadmap, alongside a site-wide knowledge map
          across all {totalEntries} entries and {ELEMENTS.length} elements.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Accuracy note:</span> all 118 elements through oganesson (Z=118, heaviest
          confirmed) are present; period 7 is complete; elements 119+ have not been synthesized. The Lu/Lr group-3
          placement and the H group-1 vs group-17 split are surfaced as disputes, not adjudicated. The 2023 LK-99
          room-temperature ambient-pressure superconductivity claim is presented as <strong>refuted</strong> by
          independent replications, not as a resolved open question — and room-temperature ambient-pressure
          superconductivity has not been achieved as of 2026. Reports of inaccuracy welcome via the{" "}
          <Link href="/feedback" className="underline underline-offset-2">feedback</Link> page.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-04 · LaTeX + mhchem typesetting via KaTeX · synthesis map from{" "}
          <span className="font-mono">transforms</span> edges · claim cross-references pending
        </p>
      </div>
    </div>
  );
}
