"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { AnthEntry, ColorKey, Family, Section, HomininSpecies, HomininClade } from "./types";
import { FAMILIES_1_6 } from "./data";
import { FAMILIES_7_12 } from "./data2";
import { FAMILIES_13_16 } from "./data3";
import { HOMININS, CLADE_INFO, TIMELINE_MAX_MYA } from "./hominins";
import { LiveResearchCard } from "@/components/LiveResearchCard";

const ALL_FAMILIES: Family[] = [...FAMILIES_1_6, ...FAMILIES_7_12, ...FAMILIES_13_16];

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
  A: { name: "Section A — The Four Fields", tagline: "Cultural, biological, archaeological, and linguistic anthropology — the discipline's classical scaffolding." },
  B: { name: "Section B — Society & Belief", tagline: "Kinship, religion, economy, and politics in cross-cultural perspective." },
  C: { name: "Section C — Evolution, Primates, Hominins", tagline: "Medicine, evolutionary anthropology, primatology, and the fossil record." },
  D: { name: "Section D — Material Culture & Methods", tagline: "Objects, technologies, and how anthropological knowledge is made." },
  E: { name: "Section E — Landmark Studies & Open Questions", tagline: "Famous ethnographies, contested classifications, and questions the field has not closed." },
};

// ────────────────────────────────────────────────────────────────────────────
// Filter / search
// ────────────────────────────────────────────────────────────────────────────

function entryMatches(entry: AnthEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.description.toLowerCase().includes(q)) return true;
  if (entry.keyFact.toLowerCase().includes(q)) return true;
  if (entry.region && entry.region.toLowerCase().includes(q)) return true;
  if (entry.date && entry.date.toLowerCase().includes(q)) return true;
  if (entry.ethnographer && entry.ethnographer.toLowerCase().includes(q)) return true;
  if (entry.example && entry.example.toLowerCase().includes(q)) return true;
  if (entry.tags.some((t) => t.toLowerCase().includes(q))) return true;
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Xref & status badges
// ────────────────────────────────────────────────────────────────────────────

function XrefBadges({ entry }: { entry: AnthEntry }) {
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

function StatusBadge({ entry }: { entry: AnthEntry }) {
  if (!entry.status) return null;
  if (entry.status === "open") {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-300 font-mono border border-red-900/60">OPEN</span>;
  }
  if (entry.status === "refuted") {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 font-mono border border-rose-900/60">REFUTED</span>;
  }
  if (entry.status === "contested") {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 font-mono border border-amber-900/60">CONTESTED</span>;
  }
  if (entry.status === "revised") {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950/60 text-sky-300 font-mono border border-sky-900/60">REVISED</span>;
  }
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-950/60 text-green-300 font-mono border border-green-900/60">LANDMARK</span>;
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
}: {
  entry: AnthEntry;
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
        {entry.keyFact}
      </div>
      {entry.region && (
        <div className="mt-1 text-[11px] text-gray-400 leading-relaxed">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Region</span>
          {entry.region}
        </div>
      )}
      {entry.date && (
        <div className="mt-1 text-[11px] text-gray-400 leading-relaxed italic">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2 not-italic">Date</span>
          {entry.date}
        </div>
      )}
      {entry.ethnographer && (
        <div className="mt-1 text-[11px] text-gray-400 leading-relaxed">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Ethnographer</span>
          {entry.ethnographer}
        </div>
      )}

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
  filteredEntries: AnthEntry[];
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
// Hominin timeline — interactive SVG
// ────────────────────────────────────────────────────────────────────────────

const TL_WIDTH = 760;
const TL_LEFT_PAD = 160;
const TL_RIGHT_PAD = 16;
const TL_ROW_H = 22;
const TL_BAR_H = 16;
const TL_TOP_PAD = 36;
const TL_BOTTOM_PAD = 26;

const TL_PLOT_W = TL_WIDTH - TL_LEFT_PAD - TL_RIGHT_PAD;

const TL_HEIGHT = TL_TOP_PAD + HOMININS.length * TL_ROW_H + TL_BOTTOM_PAD;

function myaToX(mya: number): number {
  // 0 Mya at right, TIMELINE_MAX_MYA at left of plot area
  const clamped = Math.max(0, Math.min(mya, TIMELINE_MAX_MYA));
  const frac = 1 - clamped / TIMELINE_MAX_MYA; // 0 at left, 1 at right
  return TL_LEFT_PAD + frac * TL_PLOT_W;
}

const TL_GRID_MYA = [7, 6, 5, 4, 3, 2, 1, 0.5, 0.1, 0];

function HomininTimeline({
  selected,
  onSelect,
  cladeFilter,
}: {
  selected: HomininSpecies | null;
  onSelect: (s: HomininSpecies | null) => void;
  cladeFilter: Set<HomininClade>;
}) {
  // sort so closely-related bars sit together: earliest start first
  const ordered = [...HOMININS].sort((a, b) => b.startMya - a.startMya);

  return (
    <div className="overflow-x-auto">
      <svg
        width={TL_WIDTH}
        height={TL_HEIGHT}
        role="img"
        aria-label="Hominin species timeline"
        style={{ background: "#0a0d12", borderRadius: 6, fontFamily: "ui-monospace, monospace" }}
      >
        {/* gridlines */}
        {TL_GRID_MYA.map((mya) => {
          const x = myaToX(mya);
          return (
            <g key={mya}>
              <line
                x1={x}
                x2={x}
                y1={TL_TOP_PAD - 8}
                y2={TL_HEIGHT - TL_BOTTOM_PAD + 4}
                stroke="#1f2937"
                strokeDasharray="2 3"
              />
              <text
                x={x}
                y={TL_HEIGHT - TL_BOTTOM_PAD + 16}
                fontSize={9}
                fill="#6b7280"
                textAnchor="middle"
              >
                {mya === 0 ? "now" : `${mya} Ma`}
              </text>
            </g>
          );
        })}

        {/* header */}
        <text x={TL_LEFT_PAD} y={20} fontSize={11} fill="#9ca3af">
          ← older
        </text>
        <text x={TL_LEFT_PAD + TL_PLOT_W} y={20} fontSize={11} fill="#9ca3af" textAnchor="end">
          present →
        </text>

        {/* bars */}
        {ordered.map((sp, i) => {
          const y = TL_TOP_PAD + i * TL_ROW_H;
          const x1 = myaToX(sp.startMya);
          const x2 = myaToX(sp.endMya);
          const w = Math.max(2, x2 - x1);
          const c = CLADE_INFO[sp.clade];
          const dimmed = cladeFilter.size > 0 && !cladeFilter.has(sp.clade);
          const isSel = selected?.name === sp.name;
          return (
            <g
              key={sp.name}
              opacity={dimmed ? 0.2 : 1}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(isSel ? null : sp)}
            >
              <text
                x={TL_LEFT_PAD - 8}
                y={y + TL_BAR_H / 2 + 3}
                fontSize={9.5}
                fill={isSel ? "#ffffff" : "#d1d5db"}
                textAnchor="end"
              >
                {sp.common ?? sp.name}
              </text>
              <rect
                x={x1}
                y={y}
                width={w}
                height={TL_BAR_H}
                fill={c.color}
                stroke={isSel ? "#ffffff" : c.border}
                strokeWidth={isSel ? 2 : 1}
                rx={3}
              />
              {sp.contested && (
                <text
                  x={x1 + w + 4}
                  y={y + TL_BAR_H / 2 + 3}
                  fontSize={8}
                  fill="#f59e0b"
                >
                  ?
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HomininDetail({ species }: { species: HomininSpecies }) {
  const c = CLADE_INFO[species.clade];
  return (
    <div
      className="mt-4 rounded border p-4 space-y-2"
      style={{ borderColor: c.border, background: `${c.color}` }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: c.text }}>
            {c.label}
          </p>
          <h3 className="text-lg font-semibold text-white">
            <em>{species.name}</em>
            {species.common && <span className="text-gray-400 font-mono text-sm"> &middot; {species.common}</span>}
          </h3>
        </div>
        <div className="text-right text-xs text-gray-300 shrink-0">
          {species.startMya === species.endMya
            ? `${species.startMya} Ma`
            : `${species.startMya} – ${species.endMya === 0 ? "present" : `${species.endMya} Ma`}`}
        </div>
      </div>
      <div className="grid gap-1 text-xs text-gray-300 sm:grid-cols-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-1">Region</span>
          {species.region}
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-1">Type site</span>
          {species.keySite ?? "—"}
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-1">Brain</span>
          {species.brainCC ? `~${species.brainCC} cc` : "—"}
        </div>
      </div>
      <p className="text-xs text-gray-300 leading-relaxed">{species.note}</p>
      {species.contested && (
        <p className="text-[10px] text-amber-400 font-mono">
          ? = taxonomic placement or dating contested
        </p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

const ALL_SLUGS = ALL_FAMILIES.map((f) => f.slug);

export default function AnthropologyPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedHominin, setSelectedHominin] = useState<HomininSpecies | null>(null);
  const [cladeFilter, setCladeFilter] = useState<Set<HomininClade>>(new Set());

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

  const toggleClade = (clade: HomininClade) => {
    setCladeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(clade)) next.delete(clade);
      else next.add(clade);
      return next;
    });
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(ALL_SLUGS));

  const bySection: Record<Section, { family: Family; entries: AnthEntry[] }[]> = { A: [], B: [], C: [], D: [], E: [] };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Anthropology — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to anthropology organized into {ALL_FAMILIES.length} families across five sections — the
          four classical subfields, then society &amp; belief, evolution and the fossil record, material culture
          &amp; methods, and a closing pass over landmark studies and open questions. Each card carries a{" "}
          <em>key fact</em>, where applicable a <em>region</em>, <em>date</em>, and the original{" "}
          <em>ethnographer</em>. Status badges mark <strong>LANDMARK</strong>, <strong>REVISED</strong>,{" "}
          <strong>CONTESTED</strong>, and <strong>OPEN</strong> entries. The interactive hominin timeline below
          places ~24 species on a single Ma-scale axis with clade coloring.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Cross-references: entries marked <span className="font-mono">xref</span> link to{" "}
          <Link href="/history" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">history</Link>,{" "}
          <Link href="/linguistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">linguistics</Link>,{" "}
          <Link href="/biology" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">biology</Link>,{" "}
          <Link href="/sociology" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">sociology</Link>,{" "}
          <Link href="/psychology" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">psychology</Link>,{" "}
          <Link href="/medicine" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">medicine</Link>,{" "}
          <Link href="/philosophy" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">philosophy</Link>,{" "}
          <Link href="/economics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">economics</Link>,{" "}
          <Link href="/governance" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">governance</Link>,{" "}
          and <Link href="/geology" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">geology</Link>{" "}
          rather than duplicating.
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries · 5 sections
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
        </p>
      </div>

      {/* ── Hominin timeline ──────────────────────────────────────────────── */}
      <section className="rounded-lg border border-indigo-900 overflow-hidden">
        <div className="px-5 py-3 bg-indigo-950/40 flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-indigo-200">Hominin timeline</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {HOMININS.length} species, 7.5 Ma to present. Click a bar for detail; toggle clade buttons to filter.
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(CLADE_INFO) as HomininClade[]).map((clade) => {
              const c = CLADE_INFO[clade];
              const active = cladeFilter.size === 0 || cladeFilter.has(clade);
              return (
                <button
                  key={clade}
                  onClick={() => toggleClade(clade)}
                  className="text-[10px] px-2 py-1 rounded font-mono"
                  style={{
                    background: active ? c.color : "transparent",
                    border: `1px solid ${c.border}`,
                    color: active ? c.text : "#6b7280",
                  }}
                  title={`Toggle ${c.label}`}
                >
                  {c.label}
                </button>
              );
            })}
            {cladeFilter.size > 0 && (
              <button
                onClick={() => setCladeFilter(new Set())}
                className="text-[10px] px-2 py-1 rounded font-mono border border-gray-700 text-gray-400 hover:text-white"
              >
                clear
              </button>
            )}
          </div>
        </div>
        <div className="bg-gray-950/40 p-4">
          <HomininTimeline selected={selectedHominin} onSelect={setSelectedHominin} cladeFilter={cladeFilter} />
          {selectedHominin ? (
            <HomininDetail species={selectedHominin} />
          ) : (
            <p className="mt-3 text-[11px] text-gray-500">
              Bars show first/last appearance dates in millions of years (Ma); brain volumes are species-typical
              endocranial means or midpoints. A trailing &ldquo;?&rdquo; flags species whose taxonomic placement
              or dating is actively contested. The chart is a reading aid, not a phylogeny — many lineages overlap
              in time, and the human family tree is more bush than ladder.
            </p>
          )}
        </div>
      </section>

      {/* Filter / controls */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, key fact, region, ethnographer, tag — e.g. 'Boas', 'Trobriand', 'WEIRD', 'Denisovan'"
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

      <LiveResearchCard slug="anthropology" />

      <div className="border-t border-gray-800 pt-6 mt-12 space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Note:</span> the &ldquo;search&rdquo; link on each card runs a free-text
          search over claim and source text. A term appearing in a claim does not mean the claim is{" "}
          <em>about</em> that concept or fieldworker — only that the term is present.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Posture on the field's frontier:</span> entries marked{" "}
          <span className="text-red-300 font-mono">OPEN</span> are unresolved as of 2026 (origin of language,
          behavioral modernity, female agency in prehistory, AI/anthropology, Indigenous data sovereignty).
          Entries marked <span className="text-amber-300 font-mono">CONTESTED</span> are live debates with
          serious objections on multiple sides (Mead-Freeman, EP modularity, Anthropocene framing, Chagnon/Yanomami,
          big-gods/Seshat). Entries marked <span className="text-sky-300 font-mono">REVISED</span> flag classic
          findings that have been substantially reframed (cargo cults, Frazerian magic/religion/science,
          Benedict's configurations, race as biological taxonomy, original-affluent-society, Kalahari Debate).
          The hominin family tree is a bush, not a ladder; taxonomic assignments evolve with each season's
          fieldwork. Reports of inaccuracy welcome via the{" "}
          <Link href="/feedback" className="underline underline-offset-2">feedback</Link> page.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-06 · {ALL_FAMILIES.length} families · {totalEntries} entries · {HOMININS.length} hominin species
        </p>
      </div>
    </div>
  );
}
