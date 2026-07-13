"use client";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DomainStatusBadge } from "@/components/DomainStatusBadge";

import { useMemo, useState } from "react";
import Link from "next/link";
import katex from "katex";
import "katex/dist/katex.min.css";

import type { ColorKey, CSEntry, Family, Section } from "./types";
import { FAMILIES_1_8 } from "./data";
import { FAMILIES_9_15 } from "./data2";
import { FAMILIES_16_22 } from "./data3";

const ALL_FAMILIES: Family[] = [...FAMILIES_1_8, ...FAMILIES_9_15, ...FAMILIES_16_22];

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

const SVG_COLORS: Record<ColorKey, { node: string; border: string; text: string; edge: string }> = {
  violet:  { node: "#2e1065", border: "#7c3aed", text: "#c4b5fd", edge: "#a78bfa" },
  indigo:  { node: "#1e1b4b", border: "#6366f1", text: "#a5b4fc", edge: "#818cf8" },
  blue:    { node: "#1e3a5f", border: "#3b82f6", text: "#93c5fd", edge: "#60a5fa" },
  sky:     { node: "#082f49", border: "#0ea5e9", text: "#7dd3fc", edge: "#38bdf8" },
  cyan:    { node: "#083344", border: "#06b6d4", text: "#67e8f9", edge: "#22d3ee" },
  teal:    { node: "#042f2e", border: "#14b8a6", text: "#5eead4", edge: "#2dd4bf" },
  emerald: { node: "#022c22", border: "#10b981", text: "#6ee7b7", edge: "#34d399" },
  green:   { node: "#052e16", border: "#22c55e", text: "#86efac", edge: "#4ade80" },
  amber:   { node: "#451a03", border: "#f59e0b", text: "#fcd34d", edge: "#fbbf24" },
  rose:    { node: "#4c0519", border: "#f43f5e", text: "#fda4af", edge: "#fb7185" },
};

const NEUTRAL_SVG = { node: "#111827", border: "#4b5563", text: "#9ca3af", edge: "#6b7280" };

const SECTION_INFO: Record<Section, { name: string; tagline: string }> = {
  A: { name: "Section A — Theoretical CS & Foundations", tagline: "Computability, complexity, formal languages, and logic — the limits and structure of computation." },
  B: { name: "Section B — Algorithms & Data Structures", tagline: "Sorting, searching, graphs, geometry, cryptography — the engineered substrate of efficient computation." },
  C: { name: "Section C — Systems & Architecture", tagline: "Hardware, operating systems, networks, distributed systems, and databases — where programs actually run." },
  D: { name: "Section D — Programming Languages, Software & Interfaces", tagline: "Languages, compilers, software practice, graphics, and human-computer interaction — how computers are programmed and used." },
  E: { name: "Section E — AI, ML & Open Problems", tagline: "Machine learning, deep learning, NLP, robotics — and the discipline's deepest unresolved questions." },
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
// Build a global index of entries by name (for prereq resolution)
// ────────────────────────────────────────────────────────────────────────────

type EntryRef = { entry: CSEntry; family: Family };

const NAME_INDEX: Map<string, EntryRef> = new Map();
for (const fam of ALL_FAMILIES) {
  for (const entry of fam.entries) {
    NAME_INDEX.set(entry.name.toLowerCase(), { entry, family: fam });
  }
}

function lookupEntry(name: string): EntryRef | undefined {
  return NAME_INDEX.get(name.toLowerCase());
}

// ────────────────────────────────────────────────────────────────────────────
// Filter / search
// ────────────────────────────────────────────────────────────────────────────

function entryMatches(entry: CSEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.description.toLowerCase().includes(q)) return true;
  if (plainText(entry.keyInsight).toLowerCase().includes(q)) return true;
  if (entry.notation && plainText(entry.notation).toLowerCase().includes(q)) return true;
  if (entry.example && plainText(entry.example).toLowerCase().includes(q)) return true;
  if (entry.tags.some((t) => t.toLowerCase().includes(q))) return true;
  if (entry.prereqs.some((p) => p.toLowerCase().includes(q))) return true;
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Prereq DAG — per family graph layout
// ────────────────────────────────────────────────────────────────────────────

interface GraphNode {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  inFamily: boolean;
  external?: { family: Family };
}

interface GraphEdge {
  from: string;
  to: string;
}

const NODE_W = 160;
const NODE_H = 30;
const COL_GAP = 190;
const ROW_GAP = 44;

function layoutFamilyGraph(family: Family): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const inFamilyNames = new Set(family.entries.map((e) => e.name));
  const allNodeNames = new Set<string>(inFamilyNames);
  const externals = new Map<string, EntryRef | null>();
  const edges: GraphEdge[] = [];

  for (const entry of family.entries) {
    for (const prereq of entry.prereqs) {
      const ref = lookupEntry(prereq);
      if (ref) {
        if (ref.family.slug === family.slug) {
          edges.push({ from: prereq, to: entry.name });
          allNodeNames.add(prereq);
        } else {
          const key = ref.entry.name;
          edges.push({ from: key, to: entry.name });
          allNodeNames.add(key);
          externals.set(key, ref);
        }
      } else {
        edges.push({ from: prereq, to: entry.name });
        allNodeNames.add(prereq);
        externals.set(prereq, null);
      }
    }
  }

  // Topological level assignment via Kahn-like BFS, with cycle protection.
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of allNodeNames) {
    inDeg.set(n, 0);
    adj.set(n, []);
  }
  for (const e of edges) {
    if (!allNodeNames.has(e.from) || !allNodeNames.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  }
  const level = new Map<string, number>();
  const q: string[] = [];
  for (const n of allNodeNames) {
    if ((inDeg.get(n) ?? 0) === 0) {
      level.set(n, 0);
      q.push(n);
    }
  }
  while (q.length) {
    const cur = q.shift()!;
    const lv = level.get(cur) ?? 0;
    for (const next of adj.get(cur) ?? []) {
      const newLv = lv + 1;
      if (!level.has(next) || level.get(next)! < newLv) {
        level.set(next, newLv);
        q.push(next);
      }
    }
  }
  for (const n of allNodeNames) if (!level.has(n)) level.set(n, 0);

  const byLevel = new Map<number, string[]>();
  for (const [n, lv] of level) {
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(n);
  }
  const maxLv = Math.max(...level.values(), 0);

  const nodes: GraphNode[] = [];
  for (let lv = 0; lv <= maxLv; lv++) {
    const col = byLevel.get(lv) ?? [];
    col.sort((a, b) => a.localeCompare(b));
    col.forEach((name, i) => {
      const ext = externals.get(name);
      nodes.push({
        name,
        x: lv * COL_GAP + 12,
        y: i * ROW_GAP + 12,
        width: NODE_W,
        height: NODE_H,
        inFamily: inFamilyNames.has(name),
        external: ext ? { family: ext.family } : undefined,
      });
    });
  }

  return { nodes, edges };
}

function PrereqGraph({ family, onSelect }: { family: Family; onSelect: (name: string) => void }) {
  const { nodes, edges } = useMemo(() => layoutFamilyGraph(family), [family]);
  const colors = SVG_COLORS[family.color];
  const markerId = `arrow-${family.slug}`;
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.name, n])), [nodes]);

  if (nodes.length === 0) return null;
  const maxX = Math.max(...nodes.map((n) => n.x + n.width)) + 20;
  const maxY = Math.max(...nodes.map((n) => n.y + n.height)) + 20;

  return (
    <div className="overflow-x-auto mb-3">
      <svg width={maxX} height={maxY} style={{ display: "block" }} role="img" aria-label={`Prerequisite graph for ${family.name}`}>
        <defs>
          <marker
            id={markerId}
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill={colors.edge} />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const src = nodeMap.get(e.from);
          const dst = nodeMap.get(e.to);
          if (!src || !dst) return null;
          const x1 = src.x + src.width;
          const y1 = src.y + src.height / 2;
          const x2 = dst.x;
          const y2 = dst.y + dst.height / 2;
          const mx = (x1 + x2) / 2;
          const d = `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={colors.edge}
              strokeWidth={1.2}
              strokeOpacity={0.7}
              markerEnd={`url(#${markerId})`}
            />
          );
        })}
        {nodes.map((n) => {
          const nodeColor = n.inFamily ? colors : NEUTRAL_SVG;
          const label = n.name.length > 24 ? n.name.slice(0, 23) + "…" : n.name;
          const clickable = n.inFamily;
          return (
            <g
              key={n.name}
              onClick={() => { if (clickable) onSelect(n.name); }}
              style={{ cursor: clickable ? "pointer" : "default" }}
            >
              <rect
                x={n.x}
                y={n.y}
                width={n.width}
                height={n.height}
                rx={4}
                fill={nodeColor.node}
                stroke={nodeColor.border}
                strokeWidth={1}
                strokeDasharray={n.inFamily ? undefined : "3,2"}
              />
              <text
                x={n.x + n.width / 2}
                y={n.y + n.height / 2 + 4}
                textAnchor="middle"
                fill={nodeColor.text}
                fontSize={10}
                fontFamily="ui-monospace, monospace"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-[10px] text-gray-500 mt-1">
        <span className="inline-block w-3 h-3 rounded-sm align-middle mr-1" style={{ background: colors.node, border: `1px solid ${colors.border}` }} />
        in-family node (click to jump to its card)
        <span className="inline-block w-3 h-3 rounded-sm align-middle ml-3 mr-1" style={{ background: NEUTRAL_SVG.node, border: `1px dashed ${NEUTRAL_SVG.border}` }} />
        primitive / cross-family prerequisite
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Status & xref badges
// ────────────────────────────────────────────────────────────────────────────


function FamousBadge({ entry }: { entry: CSEntry }) {
  if (!entry.famous) return null;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 font-mono border border-amber-900/60">FAMOUS</span>
  );
}

function XrefBadges({ entry }: { entry: CSEntry }) {
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

function slugifyEntry(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function EntryCard({
  entry,
  family,
  expanded,
  onToggle,
  builtBy,
}: {
  entry: CSEntry;
  family: Family;
  expanded: boolean;
  onToggle: () => void;
  builtBy: string[];
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
      data-entry-name={entry.name}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-white group-hover:text-gray-100">{entry.name}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <DomainStatusBadge status={entry.status ?? ""} />
          <FamousBadge entry={entry} />
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
        <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Key insight</span>
        <MathFragment text={entry.keyInsight} />
      </div>
      {entry.notation && (
        <div className="mt-1 text-xs text-gray-300 leading-relaxed">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Notation</span>
          <MathExpr expr={entry.notation} />
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
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Prerequisites</p>
            {entry.prereqs.length === 0 ? (
              <p className="mt-1 text-xs text-gray-500 italic">Primitive entry point — no listed prerequisites.</p>
            ) : (
              <ul className="mt-1 text-xs text-gray-300 leading-relaxed list-disc list-inside">
                {entry.prereqs.map((p) => {
                  const ref = lookupEntry(p);
                  if (ref) {
                    return (
                      <li key={p}>
                        <Link
                          href={`/computer-science#entry-${slugifyEntry(ref.entry.name)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-gray-200 underline underline-offset-2 hover:text-white"
                        >
                          {ref.entry.name}
                        </Link>
                        <span className="text-gray-600"> · {ref.family.name}</span>
                      </li>
                    );
                  }
                  return (
                    <li key={p} className="text-gray-500">
                      {p} <span className="text-gray-700">(primitive)</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {builtBy.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Builds toward</p>
              <ul className="mt-1 text-xs text-gray-300 leading-relaxed list-disc list-inside">
                {builtBy.map((name) => {
                  const ref = lookupEntry(name);
                  if (!ref) return <li key={name}>{name}</li>;
                  return (
                    <li key={name}>
                      <Link
                        href={`/computer-science#entry-${slugifyEntry(ref.entry.name)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-200 underline underline-offset-2 hover:text-white"
                      >
                        {ref.entry.name}
                      </Link>
                      <span className="text-gray-600"> · {ref.family.name}</span>
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

function countEdges(family: Family): number {
  let n = 0;
  for (const entry of family.entries) n += entry.prereqs.length;
  return n;
}

function FamilySection({
  family,
  filteredEntries,
  collapsed,
  onToggleCollapse,
  expanded,
  setExpanded,
  builtByIndex,
}: {
  family: Family;
  filteredEntries: CSEntry[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  expanded: string | null;
  setExpanded: (key: string | null) => void;
  builtByIndex: Map<string, string[]>;
}) {
  const c = COLOR_STYLES[family.color];
  const [showGraph, setShowGraph] = useState(false);

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
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setShowGraph((v) => !v)}
              className={`px-2 py-1 rounded border ${c.cardBorder} ${c.accent} hover:brightness-125 transition-colors`}
            >
              {showGraph ? "Hide" : "Show"} prerequisite graph
            </button>
            <span className="text-gray-600">{family.entries.length} total entries · {countEdges(family)} prereq edges</span>
          </div>

          {showGraph && (
            <div className={`rounded border ${c.cardBorder} p-3 bg-gray-900/40`}>
              <p className={`text-[10px] uppercase tracking-widest ${c.accent} mb-2`}>Knowledge map — {family.name}</p>
              <PrereqGraph
                family={family}
                onSelect={(name) => {
                  setExpanded(`${family.slug}::${name}`);
                  const el = document.getElementById(`entry-${slugifyEntry(name)}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              />
            </div>
          )}

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
                    builtBy={builtByIndex.get(entry.name) ?? []}
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

function buildBuiltByIndex(families: Family[]): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  for (const fam of families) {
    for (const entry of fam.entries) {
      for (const prereq of entry.prereqs) {
        const ref = lookupEntry(prereq);
        const key = ref ? ref.entry.name : prereq;
        if (!idx.has(key)) idx.set(key, []);
        idx.get(key)!.push(entry.name);
      }
    }
  }
  return idx;
}

export default function ComputerSciencePage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const builtByIndex = useMemo(() => buildBuiltByIndex(ALL_FAMILIES), []);

  const filtered = useMemo(() => {
    return ALL_FAMILIES.map((f) => ({
      family: f,
      entries: f.entries.filter((e) => entryMatches(e, query)),
    })).filter((f) => f.entries.length > 0);
  }, [query]);

  const totalEntries = ALL_FAMILIES.reduce((s, f) => s + f.entries.length, 0);
  const totalEdges = ALL_FAMILIES.reduce((s, f) => s + countEdges(f), 0);
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

  const bySection: Record<Section, { family: Family; entries: CSEntry[] }[]> = { A: [], B: [], C: [], D: [], E: [] };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Computer Science — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to computer science organized into {ALL_FAMILIES.length} families across five sections —
          Theoretical CS &amp; Foundations, Algorithms &amp; Data Structures, Systems &amp; Architecture,
          Programming Languages/Software/Interfaces, and AI/ML/Open Problems. Each card carries a{" "}
          <em>key insight</em> (the algorithmic complexity, theorem, or design principle that defines the concept,
          typeset with KaTeX where useful), an optional <em>notation</em> block, an <em>example</em>, and a list
          of <em>prerequisites</em> — the directed edges of a per-family dependency DAG you can toggle on.
          Color codes the family; clicking a header collapses it; clicking a card expands it. Entries tagged{" "}
          <span className="text-red-400">OPEN</span> are genuinely unresolved as of 2026;{" "}
          <span className="text-green-400">SOLVED</span> are landmark resolved results.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Cross-references: complexity, probability, and linear algebra overlap heavily with{" "}
          <Link href="/mathematics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">mathematics</Link>;
          {" "}machine learning and inference with{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">statistics</Link>;
          {" "}graphics and control with{" "}
          <Link href="/physics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">physics</Link>.
          Entries marked <span className="font-mono">xref</span> link to the sibling page rather than duplicating.
          Whether statistics and machine learning are &ldquo;computer science,&rdquo; whether software
          development is &ldquo;engineering,&rdquo; and exactly where information theory sits are genuinely
          disputed; this page states the disputes and does not adjudicate.
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries · {totalEdges} prereq edges
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, key insight, notation, tag — e.g. 'NP', 'transformer', 'TCP', 'B-tree', 'halting'"
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
      <FieldGuideBanner domain="Computer Science" className="mb-2" />
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
                    builtByIndex={builtByIndex}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-gray-800 pt-6 mt-12 space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Note:</span> the &ldquo;search&rdquo; link on each card runs a free-text
          search over claim and source text. A term appearing in a claim does not mean the claim is{" "}
          <em>about</em> that concept — only that the term is present. A claim-powered explorer that links
          CS concepts to the specific receipts that cite them is on the roadmap.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Open questions:</span> entries marked{" "}
          <span className="text-red-300 font-mono">OPEN</span> are genuinely unresolved as of 2026 — P vs NP,
          existence of one-way functions, the true matrix-multiplication exponent $\omega$, the Collatz
          conjecture, quantum supremacy under classical hardness assumptions, the AGI scaling hypothesis,
          and the AI alignment problem all remain open. The Halting problem, Cook-Levin theorem, and
          Hilbert&rsquo;s tenth problem are landmark <span className="text-green-300 font-mono">SOLVED</span>
          {" "}results preserved for historical importance. Reports of inaccuracy welcome via the{" "}
          <Link href="/feedback" className="underline underline-offset-2">feedback</Link> page.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-04 · KaTeX typesetting · prerequisite DAG built from entry data ·
          claim cross-references pending
        </p>
      </div>
      <div className="border-t border-gray-700/40 pt-6 mt-4">
        <p className="text-[11px] font-mono uppercase tracking-widest text-gray-600 mb-2">Discover related claims in the graph</p>
        <div className="flex flex-wrap gap-4">
          <a href="/search?q=computer+science" className="text-xs text-sky-400/70 hover:text-sky-300 transition-colors font-mono">
            Search Computer Science in the claim graph →
          </a>
          <a href="/settling-curve" className="text-xs text-amber-400/50 hover:text-amber-300 transition-colors font-mono">
            Browse all trajectories →
          </a>
        </div>
      </div>
    </div>
  );
}
