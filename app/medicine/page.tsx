"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { MedEntry, ColorKey, Family, Section, OrganSystem, OrganSystemKey } from "./types";
import { FAMILIES_1_7 } from "./data";
import { FAMILIES_8_14 } from "./data2";
import { FAMILIES_15_20 } from "./data3";
import { ORGAN_SYSTEMS } from "./systems";

const ALL_FAMILIES: Family[] = [...FAMILIES_1_7, ...FAMILIES_8_14, ...FAMILIES_15_20];

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
  A: { name: "Section A — Basic Sciences & Anatomy", tagline: "Anatomy, physiology, pathology, and infectious agents — the foundation of clinical medicine." },
  B: { name: "Section B — Medical Specialties", tagline: "Twelve specialties from cardiology to pediatrics — diseases organized by organ system." },
  C: { name: "Section C — Diagnostics & Treatment", tagline: "Imaging and the diagnostic technologies that drive modern care." },
  D: { name: "Section D — Pharmacology", tagline: "How drugs work and the major therapeutic classes." },
  E: { name: "Section E — Public Health & Open Questions", tagline: "Population health, global medicine, and the landmark discoveries and controversies that shape the field." },
};

const ORGAN_SYSTEM_COLOR: Record<OrganSystemKey, { bg: string; border: string; text: string; label: string }> = {
  cardiovascular:   { bg: "#3f1d1d", border: "#9f1239", text: "#fecdd3", label: "Cardiovascular" },
  respiratory:      { bg: "#1e3a5f", border: "#3b82f6", text: "#bfdbfe", label: "Respiratory" },
  gastrointestinal: { bg: "#3d2914", border: "#d97706", text: "#fde68a", label: "Gastrointestinal" },
  neurological:     { bg: "#2e1065", border: "#8b5cf6", text: "#ddd6fe", label: "Neurological" },
  musculoskeletal:  { bg: "#3d2914", border: "#b45309", text: "#fed7aa", label: "Musculoskeletal" },
  endocrine:        { bg: "#064e3b", border: "#10b981", text: "#a7f3d0", label: "Endocrine" },
  immune:           { bg: "#4c1d95", border: "#a855f7", text: "#e9d5ff", label: "Immune" },
  reproductive:     { bg: "#831843", border: "#ec4899", text: "#fbcfe8", label: "Reproductive" },
  renal:            { bg: "#164e63", border: "#06b6d4", text: "#a5f3fc", label: "Renal / Urinary" },
  dermatological:   { bg: "#422006", border: "#a16207", text: "#fde68a", label: "Dermatological" },
  psychiatric:      { bg: "#3f1d52", border: "#a855f7", text: "#e9d5ff", label: "Psychiatric" },
  hematological:    { bg: "#450a0a", border: "#dc2626", text: "#fecaca", label: "Hematological" },
};

// ────────────────────────────────────────────────────────────────────────────
// Filter / search
// ────────────────────────────────────────────────────────────────────────────

function entryMatches(entry: MedEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.description.toLowerCase().includes(q)) return true;
  if (entry.keyFact.toLowerCase().includes(q)) return true;
  if (entry.example && entry.example.toLowerCase().includes(q)) return true;
  if (entry.organSystem && entry.organSystem.toLowerCase().includes(q)) return true;
  if (entry.tags.some((t) => t.toLowerCase().includes(q))) return true;
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function slugifyEntry(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

type EntryRef = { entry: MedEntry; family: Family };

const NAME_INDEX: Map<string, EntryRef> = new Map();
for (const fam of ALL_FAMILIES) {
  for (const entry of fam.entries) {
    NAME_INDEX.set(entry.name.toLowerCase(), { entry, family: fam });
  }
}

// Build organ system → entries index
const ENTRIES_BY_SYSTEM: Map<OrganSystemKey, EntryRef[]> = new Map();
for (const fam of ALL_FAMILIES) {
  for (const entry of fam.entries) {
    if (!entry.organSystem) continue;
    if (!ENTRIES_BY_SYSTEM.has(entry.organSystem)) ENTRIES_BY_SYSTEM.set(entry.organSystem, []);
    ENTRIES_BY_SYSTEM.get(entry.organSystem)!.push({ entry, family: fam });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Body Systems Map (second signature view)
// ────────────────────────────────────────────────────────────────────────────

function BodySystemsMap({
  selectedSystem,
  onSelect,
}: {
  selectedSystem: OrganSystemKey | null;
  onSelect: (key: OrganSystemKey) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {ORGAN_SYSTEMS.map((sys) => {
          const c = ORGAN_SYSTEM_COLOR[sys.key];
          const isSelected = selectedSystem === sys.key;
          const count = ENTRIES_BY_SYSTEM.get(sys.key)?.length ?? 0;
          return (
            <button
              key={sys.key}
              onClick={() => onSelect(sys.key)}
              className="text-left transition-all rounded p-3 hover:brightness-125"
              style={{
                background: c.bg,
                border: `1px solid ${isSelected ? "#ffffff" : c.border}`,
                boxShadow: isSelected ? "0 0 0 2px #ffffff66" : undefined,
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold" style={{ color: c.text }}>
                  {sys.name}
                </h3>
                <span className="text-[10px] font-mono opacity-75" style={{ color: c.text }}>
                  {count}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-gray-300 leading-snug line-clamp-2">{sys.blurb}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OrganSystemDetail({ system, onJump }: { system: OrganSystem; onJump: (name: string) => void }) {
  const c = ORGAN_SYSTEM_COLOR[system.key];
  const entries = ENTRIES_BY_SYSTEM.get(system.key) ?? [];
  return (
    <div
      className="rounded border p-4 space-y-3"
      style={{ borderColor: c.border, background: `${c.bg}80` }}
    >
      <div>
        <p className="text-[10px] uppercase tracking-widest" style={{ color: c.text }}>
          Organ system
        </p>
        <h3 className="text-xl font-semibold text-white">{system.name}</h3>
        <p className="mt-1 text-xs text-gray-300 leading-relaxed">{system.blurb}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Key organs</p>
          <ul className="mt-1 text-xs text-gray-300 leading-relaxed list-disc list-inside">
            {system.organs.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Common diseases</p>
          <ul className="mt-1 text-xs text-gray-300 leading-relaxed list-disc list-inside">
            {system.diseases.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      </div>
      {entries.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">
            Taxonomy entries tagged to this system ({entries.length})
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {entries.map(({ entry }) => (
              <button
                key={entry.name}
                onClick={() => onJump(entry.name)}
                className="text-[11px] px-2 py-0.5 rounded bg-gray-900/70 text-gray-200 border border-gray-700 hover:border-gray-500 hover:text-white transition-colors"
              >
                {entry.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Disease/Treatment lineage graph (headline graph)
// ────────────────────────────────────────────────────────────────────────────

interface LineageNode {
  key: OrganSystemKey;
  label: string;
  x: number;
  y: number;
}

interface LineageEdge {
  from: OrganSystemKey;
  to: OrganSystemKey;
  via: string;
}

function buildLineageGraph(): { nodes: LineageNode[]; edges: LineageEdge[] } {
  // Curated cross-system disease/treatment lineages — the way diseases and
  // therapies connect across organ systems. Each edge labels what links them.
  const edges: LineageEdge[] = [
    { from: "endocrine", to: "renal", via: "diabetic kidney disease" },
    { from: "endocrine", to: "cardiovascular", via: "diabetic / metabolic CV" },
    { from: "endocrine", to: "neurological", via: "diabetic neuropathy" },
    { from: "cardiovascular", to: "renal", via: "cardiorenal syndrome" },
    { from: "cardiovascular", to: "neurological", via: "ischemic stroke" },
    { from: "respiratory", to: "cardiovascular", via: "cor pulmonale / PH" },
    { from: "gastrointestinal", to: "hematological", via: "GI bleeding / anemia" },
    { from: "gastrointestinal", to: "endocrine", via: "MASH / metabolic liver" },
    { from: "immune", to: "musculoskeletal", via: "autoimmune arthritis" },
    { from: "immune", to: "renal", via: "lupus / vasculitic nephritis" },
    { from: "immune", to: "dermatological", via: "psoriasis / SLE rash" },
    { from: "psychiatric", to: "neurological", via: "depression / dementia overlap" },
    { from: "psychiatric", to: "endocrine", via: "thyroid / cortisol psychiatric" },
    { from: "reproductive", to: "endocrine", via: "HPG axis" },
    { from: "reproductive", to: "cardiovascular", via: "preeclampsia → lifelong CV" },
    { from: "hematological", to: "immune", via: "leukemia / lymphoma" },
    { from: "renal", to: "hematological", via: "EPO / anemia of CKD" },
    { from: "renal", to: "musculoskeletal", via: "CKD-MBD / osteodystrophy" },
    { from: "respiratory", to: "immune", via: "asthma / allergic disease" },
    { from: "musculoskeletal", to: "endocrine", via: "osteoporosis / parathyroid" },
    { from: "dermatological", to: "immune", via: "atopic / autoimmune skin" },
  ];

  // Lay out nodes in a circle so the lineage network is readable without a force simulation.
  const W = 720;
  const H = 480;
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) / 2 - 60;
  const nodes: LineageNode[] = ORGAN_SYSTEMS.map((sys, i) => {
    const theta = (2 * Math.PI * i) / ORGAN_SYSTEMS.length - Math.PI / 2;
    return {
      key: sys.key,
      label: sys.name,
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta),
    };
  });

  return { nodes, edges };
}

function LineageGraph({ onSelect }: { onSelect: (key: OrganSystemKey) => void }) {
  const { nodes, edges } = useMemo(() => buildLineageGraph(), []);
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);
  const W = 720;
  const H = 480;
  const markerId = "lineage-arrow";
  const NW = 110;
  const NH = 28;

  // Group parallel edges by pair so labels don't overlap.
  const edgesByPair = new Map<string, LineageEdge[]>();
  for (const e of edges) {
    const k = `${e.from}->${e.to}`;
    if (!edgesByPair.has(k)) edgesByPair.set(k, []);
    edgesByPair.get(k)!.push(e);
  }

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} role="img" aria-label="Disease / treatment lineage graph">
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#a78bfa" />
          </marker>
        </defs>
        {Array.from(edgesByPair.entries()).map(([k, group]) => {
          const [from, to] = k.split("->") as [OrganSystemKey, OrganSystemKey];
          const src = nodeMap.get(from);
          const dst = nodeMap.get(to);
          if (!src || !dst) return null;
          const x1 = src.x;
          const y1 = src.y;
          const x2 = dst.x;
          const y2 = dst.y;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const ax = x1 + ux * (NW / 2 + 2);
          const ay = y1 + uy * (NH / 2 + 2);
          const bx = x2 - ux * (NW / 2 + 2);
          const by = y2 - uy * (NH / 2 + 2);
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2;
          const perpx = -uy;
          const perpy = ux;
          const labelOffset = 10;
          return (
            <g key={k}>
              <path
                d={`M ${ax} ${ay} L ${bx} ${by}`}
                fill="none"
                stroke="#a78bfa"
                strokeWidth={1.2}
                strokeOpacity={0.6}
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
                {group.map((e) => e.via).join(", ").slice(0, 28)}
              </text>
            </g>
          );
        })}
        {nodes.map((n) => {
          const c = ORGAN_SYSTEM_COLOR[n.key];
          return (
            <g key={n.key} onClick={() => onSelect(n.key)} style={{ cursor: "pointer" }}>
              <rect
                x={n.x - NW / 2}
                y={n.y - NH / 2}
                width={NW}
                height={NH}
                rx={4}
                fill={c.bg}
                stroke={c.border}
                strokeWidth={1.2}
              />
              <text
                x={n.x}
                y={n.y + 4}
                textAnchor="middle"
                fill={c.text}
                fontSize={11}
                fontFamily="ui-monospace, monospace"
              >
                {n.label.length > 16 ? n.label.slice(0, 15) + "…" : n.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-[10px] text-gray-500 mt-2">
        Nodes are organ systems. Directed edges are clinically-meaningful disease or treatment lineages
        that link them (e.g. diabetes → diabetic kidney disease). Click a node to jump to the body-systems
        map detail.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Xref & status badges
// ────────────────────────────────────────────────────────────────────────────

function XrefBadges({ entry }: { entry: MedEntry }) {
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

function StatusBadge({ entry }: { entry: MedEntry }) {
  if (!entry.status) return null;
  if (entry.status === "open") {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-300 font-mono border border-red-900/60">OPEN</span>
    );
  }
  if (entry.status === "refuted") {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 font-mono border border-rose-900/60">REFUTED</span>
    );
  }
  if (entry.status === "contested") {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 font-mono border border-amber-900/60">CONTESTED</span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-950/60 text-green-300 font-mono border border-green-900/60">LANDMARK</span>
  );
}

function OrganSystemChip({ entry }: { entry: MedEntry }) {
  if (!entry.organSystem) return null;
  const c = ORGAN_SYSTEM_COLOR[entry.organSystem];
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
      title={`Organ system: ${c.label}`}
    >
      {c.label}
    </span>
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
  entry: MedEntry;
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
          <StatusBadge entry={entry} />
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
      {(entry.tags.length > 0 || (entry.xref && entry.xref.length > 0) || entry.organSystem) && (
        <div className="mt-2 flex flex-wrap gap-1 items-center">
          <OrganSystemChip entry={entry} />
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
        {entry.keyFact}
      </div>

      {expanded && entry.example && (
        <div className="mt-3 pt-3 -mx-4 -mb-3 px-4 pb-4 border-t border-gray-700/70 bg-gray-900/80 rounded-b space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Example</p>
            <p className="mt-1 text-xs text-gray-300 leading-relaxed">{entry.example}</p>
          </div>
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
  filteredEntries: MedEntry[];
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

export default function MedicinePage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<OrganSystemKey | null>(null);
  const [showLineage, setShowLineage] = useState(false);

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

  const bySection: Record<Section, { family: Family; entries: MedEntry[] }[]> = { A: [], B: [], C: [], D: [], E: [] };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  const handleJumpToEntry = (name: string) => {
    const ref = NAME_INDEX.get(name.toLowerCase());
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

  const selectedSystemObj = selectedSystem ? ORGAN_SYSTEMS.find((s) => s.key === selectedSystem) ?? null : null;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Medicine — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to clinical medicine organized into 20 families across five sections —
          Basic Sciences &amp; Anatomy, Medical Specialties, Diagnostics &amp; Treatment, Pharmacology,
          and Public Health &amp; Open Questions. Each card carries a <em>key fact</em> (the clinical
          principle, mechanism, or diagnostic criterion that defines the topic), an optional{" "}
          <em>example</em>, and an <em>organ system</em> chip when the topic has a clear system home.
          Color codes the family; clicking a header collapses it; clicking a card expands it.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Cross-references: entries marked <span className="font-mono">xref</span> link to{" "}
          <Link href="/chemistry" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">chemistry</Link>{" "}
          or{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">statistics</Link>{" "}
          rather than duplicating. Two mandatory views: a clickable{" "}
          <strong>body-systems map</strong> grid (twelve organ systems with their hallmark organs and
          diseases) and a <strong>disease/treatment lineage graph</strong> (organ systems as nodes,
          directed edges labeled by the disease or therapy that links them).
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries · {ORGAN_SYSTEMS.length} organ systems
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
        </p>
      </div>

      {/* Body Systems Map */}
      <section className="rounded-lg border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 bg-gray-900/40 border-b border-gray-800">
          <h2 className="text-base font-semibold text-gray-200">Body systems map</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Twelve organ systems — cardiovascular, respiratory, gastrointestinal, neurological,
            musculoskeletal, endocrine, immune, reproductive, renal, dermatological, psychiatric,
            hematological. Click a system to see its hallmark organs and diseases, plus every taxonomy
            entry tagged to it.
          </p>
        </div>
        <div className="p-4 bg-gray-950/40 space-y-3">
          <BodySystemsMap
            selectedSystem={selectedSystem}
            onSelect={(k) => setSelectedSystem(k)}
          />
          {selectedSystemObj && <OrganSystemDetail system={selectedSystemObj} onJump={handleJumpToEntry} />}
        </div>
      </section>

      {/* Lineage graph */}
      <section className="rounded-lg border border-violet-900 overflow-hidden">
        <button
          onClick={() => setShowLineage((v) => !v)}
          className="w-full text-left px-5 py-3 bg-violet-950/40 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-violet-200">Disease / treatment lineage network</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Organ systems as nodes. Directed edges are clinically-meaningful disease or treatment
              lineages that connect them — diabetes → diabetic kidney disease, cardiorenal syndrome,
              ischemic stroke, lupus nephritis, MASH, and so on.
            </p>
          </div>
          <span className="text-xs text-violet-400">{showLineage ? "▾" : "▸"}</span>
        </button>
        {showLineage && (
          <div className="bg-gray-950/40 p-4">
            <LineageGraph onSelect={(k) => setSelectedSystem(k)} />
          </div>
        )}
      </section>

      {/* Filter / controls */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, key fact, organ system, tag — e.g. 'stroke', 'diabetes', 'cardiology', 'GLP-1'"
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

      <div className="border-t border-gray-800 pt-6 mt-12 space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Note:</span> the &ldquo;search&rdquo; link on each card runs a free-text
          search over claim and source text. A term appearing in a claim does not mean the claim is{" "}
          <em>about</em> that concept — only that the term is present. A claim-powered explorer that links
          medical concepts to the specific receipts that cite them is on the roadmap, alongside a planned
          deep-dive at <span className="font-mono">/medicine/methods</span> for the ten or so foundational
          diagnostic and therapeutic methods.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Accuracy &amp; neutrality:</span> status badges signal posture, not
          verdict. <strong>LANDMARK</strong> (green) marks discoveries that reshaped the field
          (germ theory, penicillin, smallpox eradication, mRNA vaccines, CRISPR therapeutics, GLP-1 RAs).
          <strong> REFUTED</strong> (rose) marks claims independently disproved — the 1998 Wakefield
          MMR-autism paper (retracted by <em>The Lancet</em>) and Theranos. <strong>CONTESTED</strong>{" "}
          (amber) marks live disputes: HRT timing hypothesis, aducanumab/lecanemab benefit-vs-harm,
          PTSD-MDMA program, AI-radiology generalizability, US health-system performance, the &ldquo;no
          safe level&rdquo; alcohol position. <strong>OPEN</strong> (red) marks problems we have not solved:
          antimicrobial resistance, pancreatic cancer survival, glioblastoma, US maternal mortality,
          climate-and-health, the biomedical replication crisis. Reports of inaccuracy welcome via the{" "}
          <Link href="/feedback" className="underline underline-offset-2">feedback</Link> page.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-04 · plain-text rendering · body-systems map &amp; lineage graph
          from organ-system tags · claim cross-references pending
        </p>
      </div>
    </div>
  );
}
