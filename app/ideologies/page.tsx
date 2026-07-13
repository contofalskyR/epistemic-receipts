"use client";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";

import { useState, useMemo } from "react";
import { FAMILIES, type Ism, type Family } from "./data";
import { FAMILIES_S3_S4 } from "./data2";
import { FAMILIES_S5_S6 } from "./data3";
import { FAMILIES_S7_S8 } from "./data4";

const ALL_FAMILIES: Family[] = [
  ...FAMILIES,
  ...FAMILIES_S3_S4,
  ...FAMILIES_S5_S6,
  ...FAMILIES_S7_S8,
];

const COLOR_STYLES: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  blue:   { border: "border-blue-700",   bg: "bg-blue-950/40",   text: "text-blue-300",   badge: "bg-blue-900/60 text-blue-200" },
  indigo: { border: "border-indigo-700", bg: "bg-indigo-950/40", text: "text-indigo-300", badge: "bg-indigo-900/60 text-indigo-200" },
  violet: { border: "border-violet-700", bg: "bg-violet-950/40", text: "text-violet-300", badge: "bg-violet-900/60 text-violet-200" },
  purple: { border: "border-purple-700", bg: "bg-purple-950/40", text: "text-purple-300", badge: "bg-purple-900/60 text-purple-200" },
  pink:   { border: "border-pink-700",   bg: "bg-pink-950/40",   text: "text-pink-300",   badge: "bg-pink-900/60 text-pink-200" },
  rose:   { border: "border-rose-700",   bg: "bg-rose-950/40",   text: "text-rose-300",   badge: "bg-rose-900/60 text-rose-200" },
  red:    { border: "border-red-700",    bg: "bg-red-950/40",    text: "text-red-300",    badge: "bg-red-900/60 text-red-200" },
  orange: { border: "border-orange-700", bg: "bg-orange-950/40", text: "text-orange-300", badge: "bg-orange-900/60 text-orange-200" },
  amber:  { border: "border-amber-700",  bg: "bg-amber-950/40",  text: "text-amber-300",  badge: "bg-amber-900/60 text-amber-200" },
  yellow: { border: "border-yellow-700", bg: "bg-yellow-950/40", text: "text-yellow-300", badge: "bg-yellow-900/60 text-yellow-200" },
  lime:   { border: "border-lime-700",   bg: "bg-lime-950/40",   text: "text-lime-300",   badge: "bg-lime-900/60 text-lime-200" },
  green:  { border: "border-green-700",  bg: "bg-green-950/40",  text: "text-green-300",  badge: "bg-green-900/60 text-green-200" },
  teal:   { border: "border-teal-700",   bg: "bg-teal-950/40",   text: "text-teal-300",   badge: "bg-teal-900/60 text-teal-200" },
  cyan:   { border: "border-cyan-700",   bg: "bg-cyan-950/40",   text: "text-cyan-300",   badge: "bg-cyan-900/60 text-cyan-200" },
  sky:    { border: "border-sky-700",    bg: "bg-sky-950/40",    text: "text-sky-300",    badge: "bg-sky-900/60 text-sky-200" },
  slate:  { border: "border-slate-700",  bg: "bg-slate-950/40",  text: "text-slate-300",  badge: "bg-slate-900/60 text-slate-200" },
  gray:   { border: "border-gray-700",   bg: "bg-gray-900/40",   text: "text-gray-300",   badge: "bg-gray-800/60 text-gray-200" },
  zinc:   { border: "border-zinc-700",   bg: "bg-zinc-900/40",   text: "text-zinc-300",   badge: "bg-zinc-800/60 text-zinc-200" },
  stone:  { border: "border-stone-700",  bg: "bg-stone-900/40",  text: "text-stone-300",  badge: "bg-stone-800/60 text-stone-200" },
  neutral:{ border: "border-neutral-700",bg: "bg-neutral-900/40",text: "text-neutral-300",badge: "bg-neutral-800/60 text-neutral-200" },
  fuchsia:{ border: "border-fuchsia-700",bg: "bg-fuchsia-950/40",text: "text-fuchsia-300",badge: "bg-fuchsia-900/60 text-fuchsia-200" },
  emerald:{ border: "border-emerald-700",bg: "bg-emerald-950/40",text: "text-emerald-300",badge: "bg-emerald-900/60 text-emerald-200" },
};

// SVG hex colors per family color key (Tailwind not usable in SVG fill/stroke)
const SVG_COLORS: Record<string, { node: string; border: string; text: string; edge: string }> = {
  blue:   { node: "#1e3a5f", border: "#3b82f6", text: "#93c5fd", edge: "#60a5fa" },
  indigo: { node: "#1e1b4b", border: "#6366f1", text: "#a5b4fc", edge: "#818cf8" },
  violet: { node: "#2e1065", border: "#7c3aed", text: "#c4b5fd", edge: "#a78bfa" },
  purple: { node: "#3b0764", border: "#9333ea", text: "#d8b4fe", edge: "#c084fc" },
  pink:   { node: "#500724", border: "#ec4899", text: "#f9a8d4", edge: "#f472b6" },
  rose:   { node: "#4c0519", border: "#f43f5e", text: "#fda4af", edge: "#fb7185" },
  red:    { node: "#450a0a", border: "#ef4444", text: "#fca5a5", edge: "#f87171" },
  orange: { node: "#431407", border: "#f97316", text: "#fdba74", edge: "#fb923c" },
  amber:  { node: "#451a03", border: "#f59e0b", text: "#fcd34d", edge: "#fbbf24" },
  yellow: { node: "#422006", border: "#eab308", text: "#fde047", edge: "#facc15" },
  lime:   { node: "#1a2e05", border: "#84cc16", text: "#bef264", edge: "#a3e635" },
  green:  { node: "#052e16", border: "#22c55e", text: "#86efac", edge: "#4ade80" },
  teal:   { node: "#042f2e", border: "#14b8a6", text: "#5eead4", edge: "#2dd4bf" },
  cyan:   { node: "#083344", border: "#06b6d4", text: "#67e8f9", edge: "#22d3ee" },
  sky:    { node: "#082f49", border: "#0ea5e9", text: "#7dd3fc", edge: "#38bdf8" },
  slate:  { node: "#0f172a", border: "#64748b", text: "#cbd5e1", edge: "#94a3b8" },
  gray:   { node: "#111827", border: "#6b7280", text: "#d1d5db", edge: "#9ca3af" },
  zinc:   { node: "#18181b", border: "#71717a", text: "#d4d4d8", edge: "#a1a1aa" },
  stone:  { node: "#1c1917", border: "#78716c", text: "#d6d3d1", edge: "#a8a29e" },
  neutral:{ node: "#171717", border: "#737373", text: "#d4d4d4", edge: "#a3a3a3" },
  fuchsia:{ node: "#2d0036", border: "#d946ef", text: "#f0abfc", edge: "#e879f9" },
  emerald:{ node: "#022c22", border: "#10b981", text: "#6ee7b7", edge: "#34d399" },
};

// Build a lookup of name → ism for lineage graph
function buildNameIndex(families: Family[]): Map<string, { ism: Ism; family: Family }> {
  const idx = new Map<string, { ism: Ism; family: Family }>();
  for (const fam of families) {
    for (const ism of fam.isms) {
      idx.set(ism.name, { ism, family: fam });
    }
  }
  return idx;
}

// Topological layout for lineage SVG
interface GraphNode {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_W = 120;
const NODE_H = 32;
const COL_GAP = 160;
const ROW_GAP = 50;

function layoutGraph(isms: Ism[]): { nodes: GraphNode[]; edges: { from: string; to: string; label: string; contested?: boolean }[] } {
  const names = new Set(isms.map((i) => i.name));

  // Collect edges (only within this family)
  const edges: { from: string; to: string; label: string; contested?: boolean }[] = [];
  for (const ism of isms) {
    for (const parent of ism.lineage.parents) {
      if (names.has(parent)) {
        edges.push({ from: parent, to: ism.name, label: ism.lineage.divergence.slice(0, 40) + (ism.lineage.divergence.length > 40 ? "…" : ""), contested: ism.lineage.contested });
      }
    }
  }

  // Assign levels via BFS from roots
  const childOf = new Map<string, string[]>();
  const parentOf = new Map<string, string[]>();
  for (const name of names) { childOf.set(name, []); parentOf.set(name, []); }
  for (const e of edges) {
    childOf.get(e.from)!.push(e.to);
    parentOf.get(e.to)!.push(e.from);
  }

  const level = new Map<string, number>();
  const queue: string[] = [];
  for (const name of names) {
    if ((parentOf.get(name)?.length ?? 0) === 0) {
      level.set(name, 0);
      queue.push(name);
    }
  }
  while (queue.length) {
    const cur = queue.shift()!;
    for (const child of childOf.get(cur) ?? []) {
      const newLevel = (level.get(cur) ?? 0) + 1;
      if (!level.has(child) || level.get(child)! < newLevel) {
        level.set(child, newLevel);
        queue.push(child);
      }
    }
  }

  // Group by level
  const byLevel = new Map<number, string[]>();
  for (const [name, lv] of level) {
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(name);
  }
  // Sort levels
  const maxLevel = Math.max(...level.values(), 0);

  // Assign positions
  const nodeMap = new Map<string, GraphNode>();
  for (let lv = 0; lv <= maxLevel; lv++) {
    const col = byLevel.get(lv) ?? [];
    col.forEach((name, i) => {
      nodeMap.set(name, {
        name,
        x: lv * COL_GAP + 10,
        y: i * ROW_GAP + 10,
        width: NODE_W,
        height: NODE_H,
      });
    });
  }

  const nodes = Array.from(nodeMap.values());
  return { nodes, edges };
}

function LineageGraph({ family, onSelect }: { family: Family; onSelect: (name: string) => void }) {
  const { nodes, edges } = useMemo(() => layoutGraph(family.isms), [family]);
  const colors = SVG_COLORS[family.color] ?? SVG_COLORS.gray;
  const markerId = `arrow-${family.slug}`;

  if (nodes.length === 0) return null;

  const maxX = Math.max(...nodes.map((n) => n.x + n.width)) + 20;
  const maxY = Math.max(...nodes.map((n) => n.y + n.height)) + 20;

  const nodeMap = new Map(nodes.map((n) => [n.name, n]));

  return (
    <div className="overflow-x-auto mb-4">
      <svg width={maxX} height={maxY} style={{ display: "block" }}>
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
        {/* Edges */}
        {edges.map((e) => {
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
            <g key={`${e.from}-${e.to}`}>
              <path
                d={d}
                fill="none"
                stroke={e.contested ? "#f97316" : colors.edge}
                strokeWidth={1.5}
                strokeDasharray={e.contested ? "4 2" : undefined}
                markerEnd={`url(#${markerId})`}
              />
            </g>
          );
        })}
        {/* Nodes */}
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
              fill={colors.node}
              stroke={colors.border}
              strokeWidth={1}
            />
            <text
              x={n.x + n.width / 2}
              y={n.y + n.height / 2 + 4}
              textAnchor="middle"
              fill={colors.text}
              fontSize={10}
              fontFamily="monospace"
            >
              {n.name.length > 18 ? n.name.slice(0, 17) + "…" : n.name}
            </text>
          </g>
        ))}
      </svg>
      {edges.some((e) => e.contested) && (
        <p className="text-xs text-orange-400 mt-1">
          <span className="inline-block w-6 border-t border-dashed border-orange-400 align-middle mr-1" />
          dashed = contested lineage
        </p>
      )}
    </div>
  );
}

function ismMatches(ism: Ism, q: string): boolean {
  const lq = q.toLowerCase();
  return (
    ism.name.toLowerCase().includes(lq) ||
    ism.description.toLowerCase().includes(lq) ||
    ism.tenet.toLowerCase().includes(lq) ||
    ism.lineage.divergence.toLowerCase().includes(lq) ||
    ism.figures.some((f) => f.toLowerCase().includes(lq)) ||
    ism.tags.some((t) => t.toLowerCase().includes(lq)) ||
    ism.era.some((e) => e.toLowerCase().includes(lq))
  );
}

function IsmCard({ ism, familyColor, defaultExpanded }: { ism: Ism; familyColor: string; defaultExpanded: boolean }) {
  const [open, setOpen] = useState(defaultExpanded);
  const colors = COLOR_STYLES[familyColor] ?? COLOR_STYLES.gray;

  return (
    <div className={`border ${colors.border} rounded-lg overflow-hidden mb-3`}>
      <button
        className={`w-full text-left px-4 py-3 ${colors.bg} hover:brightness-110 transition-all`}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold ${colors.text}`}>{ism.name}</span>
              {ism.broadFamily && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/60 text-yellow-300 font-mono">broad family</span>
              )}
              {ism.flagged && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 font-mono">verify</span>
              )}
              <span className="text-xs text-gray-500">{ism.era.join(", ")}</span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">{ism.description}</p>
          </div>
          <span className="text-gray-500 text-sm mt-0.5 flex-shrink-0">{open ? "▲" : "▼"}</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {ism.tags.map((t) => (
            <span key={t} className={`text-xs px-1.5 py-0.5 rounded ${colors.badge}`}>{t}</span>
          ))}
        </div>
      </button>

      {open && (
        <div className="px-4 py-4 bg-gray-900/60 space-y-4 text-sm text-gray-300">
          {/* Core tenet */}
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wide ${colors.text} mb-1`}>Core Tenet</h4>
            <blockquote className="border-l-2 border-gray-700 pl-3 italic text-gray-300">{ism.tenet}</blockquote>
          </div>

          {/* Core tenets */}
          {ism.coreTenets.length > 0 && (
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wide ${colors.text} mb-1`}>Core Tenets</h4>
              <ul className="space-y-1 list-disc list-inside text-gray-400">
                {ism.coreTenets.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}

          {/* Lineage */}
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wide ${colors.text} mb-1`}>Lineage</h4>
            <div className="text-gray-400 space-y-1">
              {ism.lineage.parents.length > 0 ? (
                <p>
                  <span className="text-gray-500">Parents: </span>
                  {ism.lineage.parents.join(", ")}
                  {ism.lineage.contested && (
                    <span className="ml-2 text-xs text-orange-400 italic">(contested)</span>
                  )}
                </p>
              ) : (
                <p className="text-gray-500 italic">Root ideology — no parent lineage</p>
              )}
              <p className="italic text-gray-500">{ism.lineage.divergence}</p>
            </div>
          </div>

          {/* Key thinkers */}
          {ism.keyThinkers.length > 0 && (
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wide ${colors.text} mb-1`}>Key Thinkers & Texts</h4>
              <ul className="space-y-0.5 list-disc list-inside text-gray-400">
                {ism.keyThinkers.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}

          {/* Historical instances */}
          {ism.historicalInstances && ism.historicalInstances.length > 0 && (
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wide ${colors.text} mb-1`}>Historical Instances</h4>
              <ul className="space-y-0.5 list-disc list-inside text-gray-400">
                {ism.historicalInstances.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}

          {/* Principal critiques */}
          {ism.principalCritiques.length > 0 && (
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wide ${colors.text} mb-1`}>Principal Critiques</h4>
              <ul className="space-y-0.5 list-disc list-inside text-gray-400">
                {ism.principalCritiques.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {/* Figures */}
          {ism.figures.length > 0 && (
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wide ${colors.text} mb-1`}>Associated Figures</h4>
              <p className="text-gray-400">{ism.figures.join(", ")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FamilySection({ family, query, allCollapsed, allExpanded }: {
  family: Family;
  query: string;
  allCollapsed: boolean;
  allExpanded: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [selectedIsmName, setSelectedIsmName] = useState<string | null>(null);
  const colors = COLOR_STYLES[family.color] ?? COLOR_STYLES.gray;

  const filtered = useMemo(() =>
    query ? family.isms.filter((i) => ismMatches(i, query)) : family.isms,
    [family.isms, query]
  );

  if (query && filtered.length === 0) return null;

  const isCollapsed = allCollapsed ? true : (allExpanded ? false : collapsed);

  return (
    <div className={`border ${colors.border} rounded-xl mb-6 overflow-hidden`}>
      <button
        className={`w-full text-left px-5 py-4 ${colors.bg} flex items-center justify-between`}
        onClick={() => setCollapsed((v) => !v)}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-bold text-base ${colors.text}`}>{family.name}</span>
            {family.broadFamily && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/60 text-yellow-300 font-mono">broad family</span>
            )}
            <span className="text-xs text-gray-500">{filtered.length} isms</span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">{family.blurb}</p>
        </div>
        <span className={`text-xl ${colors.text}`}>{isCollapsed ? "+" : "−"}</span>
      </button>

      {!isCollapsed && (
        <div className="px-5 py-4 bg-gray-950/60">
          <div className="flex gap-2 mb-4">
            <button
              className={`text-xs px-2 py-1 rounded border ${colors.border} ${colors.text} hover:brightness-125 transition-all`}
              onClick={() => { setShowGraph((v) => !v); setSelectedIsmName(null); }}
            >
              {showGraph ? "Hide" : "Show"} lineage graph
            </button>
          </div>

          {showGraph && (
            <div className={`rounded-lg border ${colors.border} p-3 mb-4 bg-gray-900/40`}>
              <h4 className={`text-xs font-semibold uppercase tracking-wide ${colors.text} mb-2`}>
                Lineage Graph — {family.name}
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Only intra-family parent edges shown. Click a node to jump to its card.
              </p>
              <LineageGraph family={family} onSelect={setSelectedIsmName} />
            </div>
          )}

          {filtered.map((ism) => (
            <IsmCard
              key={ism.name}
              ism={ism}
              familyColor={family.color}
              defaultExpanded={selectedIsmName === ism.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function IdeologiesPage() {
  const [query, setQuery] = useState("");
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);

  const totalIsms = ALL_FAMILIES.reduce((acc, f) => acc + f.isms.length, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <FieldGuideBanner domain="Ideologies & Political Thought" className="mb-6" />
      <h1 className="text-2xl font-bold text-white mb-1">Ideologies</h1>
      <p className="text-gray-400 text-sm mb-1">
        {totalIsms} isms · {ALL_FAMILIES.length} families — political philosophies described from the standpoint of their adherents.
      </p>
      <p className="text-xs text-gray-600 mb-6">
        Each entry states what adherents believe. Evaluation appears only in the &ldquo;Principal Critiques&rdquo; section, attributed.
        Entries tagged <span className="text-yellow-400">broad family</span> encompass heterogeneous sub-traditions.
        Entries tagged <span className="text-red-400">verify</span> are fringe, contested, or require independent source verification.
      </p>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input
          type="text"
          placeholder="Filter by name, tag, thinker, era…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-48 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
        <button
          onClick={() => { setAllCollapsed(true); setAllExpanded(false); }}
          className="text-xs px-3 py-2 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
        >
          Collapse all
        </button>
        <button
          onClick={() => { setAllExpanded(true); setAllCollapsed(false); }}
          className="text-xs px-3 py-2 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
        >
          Expand all
        </button>
        {(allCollapsed || allExpanded) && (
          <button
            onClick={() => { setAllCollapsed(false); setAllExpanded(false); }}
            className="text-xs px-3 py-2 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {ALL_FAMILIES.map((family) => (
        <FamilySection
          key={family.slug}
          family={family}
          query={query}
          allCollapsed={allCollapsed}
          allExpanded={allExpanded}
        />
      ))}
      <div className="border-t border-gray-700/40 pt-6 mt-4">
        <p className="text-[11px] font-mono uppercase tracking-widest text-gray-600 mb-2">Discover related claims in the graph</p>
        <div className="flex flex-wrap gap-4">
          <a href="/search?q=ideology+political" className="text-xs text-sky-400/70 hover:text-sky-300 transition-colors font-mono">
            Search Ideologies & Political Thought in the claim graph →
          </a>
          <a href="/settling-curve" className="text-xs text-amber-400/50 hover:text-amber-300 transition-colors font-mono">
            Browse all trajectories →
          </a>
        </div>
      </div>
    </div>
  );
}
