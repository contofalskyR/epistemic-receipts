"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DomainStatusBadge } from "@/components/DomainStatusBadge";
import katex from "katex";
import "katex/dist/katex.min.css";

import type {
  EarthEntry,
  ColorKey,
  Family,
  Section,
  Reservoir,
  ReservoirKey,
  Flow,
} from "./types";
import { FAMILIES_1_6 } from "./data";
import { FAMILIES_7_12 } from "./data2";
import { FAMILIES_13_18 } from "./data3";
import { RESERVOIRS, FLOWS } from "./earthSystem";

const ALL_FAMILIES: Family[] = [
  ...FAMILIES_1_6,
  ...FAMILIES_7_12,
  ...FAMILIES_13_18,
];

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
  sky:     { headerBg: "bg-sky-950/40",     headerBorder: "border-sky-900",     headerText: "text-sky-200",     chipBg: "bg-sky-950/60",     chipText: "text-sky-300",     cardBorder: "border-sky-950/70",     cardHover: "hover:border-sky-700",     accent: "text-sky-400" },
  cyan:    { headerBg: "bg-cyan-950/40",    headerBorder: "border-cyan-900",    headerText: "text-cyan-200",    chipBg: "bg-cyan-950/60",    chipText: "text-cyan-300",    cardBorder: "border-cyan-950/70",    cardHover: "hover:border-cyan-700",    accent: "text-cyan-400" },
  teal:    { headerBg: "bg-teal-950/40",    headerBorder: "border-teal-900",    headerText: "text-teal-200",    chipBg: "bg-teal-950/60",    chipText: "text-teal-300",    cardBorder: "border-teal-950/70",    cardHover: "hover:border-teal-700",    accent: "text-teal-400" },
  emerald: { headerBg: "bg-emerald-950/40", headerBorder: "border-emerald-900", headerText: "text-emerald-200", chipBg: "bg-emerald-950/60", chipText: "text-emerald-300", cardBorder: "border-emerald-950/70", cardHover: "hover:border-emerald-700", accent: "text-emerald-400" },
  green:   { headerBg: "bg-green-950/40",   headerBorder: "border-green-900",   headerText: "text-green-200",   chipBg: "bg-green-950/60",   chipText: "text-green-300",   cardBorder: "border-green-950/70",   cardHover: "hover:border-green-700",   accent: "text-green-400" },
  lime:    { headerBg: "bg-lime-950/40",    headerBorder: "border-lime-900",    headerText: "text-lime-200",    chipBg: "bg-lime-950/60",    chipText: "text-lime-300",    cardBorder: "border-lime-950/70",    cardHover: "hover:border-lime-700",    accent: "text-lime-400" },
  amber:   { headerBg: "bg-amber-950/40",   headerBorder: "border-amber-900",   headerText: "text-amber-200",   chipBg: "bg-amber-950/60",   chipText: "text-amber-300",   cardBorder: "border-amber-950/70",   cardHover: "hover:border-amber-700",   accent: "text-amber-400" },
  orange:  { headerBg: "bg-orange-950/40",  headerBorder: "border-orange-900",  headerText: "text-orange-200",  chipBg: "bg-orange-950/60",  chipText: "text-orange-300",  cardBorder: "border-orange-950/70",  cardHover: "hover:border-orange-700",  accent: "text-orange-400" },
  rose:    { headerBg: "bg-rose-950/40",    headerBorder: "border-rose-900",    headerText: "text-rose-200",    chipBg: "bg-rose-950/60",    chipText: "text-rose-300",    cardBorder: "border-rose-950/70",    cardHover: "hover:border-rose-700",    accent: "text-rose-400" },
  violet:  { headerBg: "bg-violet-950/40",  headerBorder: "border-violet-900",  headerText: "text-violet-200",  chipBg: "bg-violet-950/60",  chipText: "text-violet-300",  cardBorder: "border-violet-950/70",  cardHover: "hover:border-violet-700",  accent: "text-violet-400" },
  indigo:  { headerBg: "bg-indigo-950/40",  headerBorder: "border-indigo-900",  headerText: "text-indigo-200",  chipBg: "bg-indigo-950/60",  chipText: "text-indigo-300",  cardBorder: "border-indigo-950/70",  cardHover: "hover:border-indigo-700",  accent: "text-indigo-400" },
  blue:    { headerBg: "bg-blue-950/40",    headerBorder: "border-blue-900",    headerText: "text-blue-200",    chipBg: "bg-blue-950/60",    chipText: "text-blue-300",    cardBorder: "border-blue-950/70",    cardHover: "hover:border-blue-700",    accent: "text-blue-400" },
};

const SECTION_INFO: Record<Section, { name: string; tagline: string }> = {
  A: { name: "Section A — Hydrosphere & Cryosphere", tagline: "Oceans, freshwater, sea ice, and the role of water in shaping Earth's climate." },
  B: { name: "Section B — Atmosphere, Weather & Climate", tagline: "Atmospheric composition and dynamics, meteorology, climatology, paleoclimate, and glaciology." },
  C: { name: "Section C — Solid Earth & Surface", tagline: "Geophysics, geochemistry, and soils — the rocky base and the thin layer that supports life." },
  D: { name: "Section D — Earth System Science", tagline: "Biogeochemical cycles, coupled-system thinking, planetary boundaries, and Earth observation." },
  E: { name: "Section E — Hazards, Change & Frontier", tagline: "Natural hazards, anthropogenic climate change, and frontier open questions." },
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

function entryMatches(entry: EarthEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.description.toLowerCase().includes(q)) return true;
  if (plainText(entry.keyFact).toLowerCase().includes(q)) return true;
  if (entry.formula && plainText(entry.formula).toLowerCase().includes(q)) return true;
  if (entry.example && plainText(entry.example).toLowerCase().includes(q)) return true;
  if (entry.tags.some((t) => t.toLowerCase().includes(q))) return true;
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Xref & status badges
// ────────────────────────────────────────────────────────────────────────────

function XrefBadges({ entry }: { entry: EarthEntry }) {
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
}: {
  entry: EarthEntry;
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
// Earth System Flows interactive diagram
// ────────────────────────────────────────────────────────────────────────────

const CYCLE_COLOR: Record<Flow["cycle"], string> = {
  water: "#22d3ee",
  carbon: "#a3e635",
  energy: "#fbbf24",
  nutrient: "#f472b6",
};

const RESERVOIR_RADIUS = 64;
const SVG_W = 900;
const SVG_H = 560;

function findReservoir(key: ReservoirKey): Reservoir {
  const r = RESERVOIRS.find((x) => x.key === key);
  if (!r) throw new Error(`Unknown reservoir ${key}`);
  return r;
}

function flowKey(f: Flow): string {
  return `${f.from}->${f.to}::${f.name}`;
}

function flowPath(f: Flow, parallelOffset: number): string {
  const a = findReservoir(f.from);
  const b = findReservoir(f.to);
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular vector for offset.
  const px = -uy;
  const py = ux;
  // Start/end points on the boundary of the circles, offset by parallelOffset.
  const startX = a.cx + ux * RESERVOIR_RADIUS + px * parallelOffset;
  const startY = a.cy + uy * RESERVOIR_RADIUS + py * parallelOffset;
  const endX = b.cx - ux * (RESERVOIR_RADIUS + 6) + px * parallelOffset;
  const endY = b.cy - uy * (RESERVOIR_RADIUS + 6) + py * parallelOffset;
  // Curve outward a bit.
  const midX = (startX + endX) / 2 + px * 14;
  const midY = (startY + endY) / 2 + py * 14;
  return `M${startX},${startY} Q${midX},${midY} ${endX},${endY}`;
}

function EarthSystemDiagram({
  selectedReservoir,
  setSelectedReservoir,
  selectedFlow,
  setSelectedFlow,
  activeCycles,
  setActiveCycles,
}: {
  selectedReservoir: ReservoirKey | null;
  setSelectedReservoir: (k: ReservoirKey | null) => void;
  selectedFlow: string | null;
  setSelectedFlow: (k: string | null) => void;
  activeCycles: Set<Flow["cycle"]>;
  setActiveCycles: (s: Set<Flow["cycle"]>) => void;
}) {
  const cycleList: Flow["cycle"][] = ["water", "carbon", "energy", "nutrient"];

  // Group flows by (from,to) so we can offset parallel arrows.
  const groupedFlows: Record<string, Flow[]> = {};
  for (const f of FLOWS) {
    if (!activeCycles.has(f.cycle)) continue;
    const k = `${f.from}|${f.to}`;
    if (!groupedFlows[k]) groupedFlows[k] = [];
    groupedFlows[k].push(f);
  }

  const flowsRendered: { f: Flow; d: string; offset: number }[] = [];
  for (const k of Object.keys(groupedFlows)) {
    const group = groupedFlows[k];
    group.forEach((f, i) => {
      const offset = (i - (group.length - 1) / 2) * 12;
      flowsRendered.push({ f, d: flowPath(f, offset), offset });
    });
  }

  const selectedReservoirObj = selectedReservoir ? findReservoir(selectedReservoir) : null;
  const selectedFlowObj = selectedFlow
    ? FLOWS.find((f) => flowKey(f) === selectedFlow) ?? null
    : null;

  const toggleCycle = (c: Flow["cycle"]) => {
    const next = new Set(activeCycles);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setActiveCycles(next);
  };

  return (
    <div className="space-y-4">
      {/* Cycle toggles */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[11px] uppercase tracking-widest text-gray-500 mr-1">Show flows</span>
        {cycleList.map((c) => {
          const active = activeCycles.has(c);
          return (
            <button
              key={c}
              onClick={() => toggleCycle(c)}
              className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${
                active
                  ? "border-gray-500 text-white bg-gray-800"
                  : "border-gray-800 text-gray-500 bg-gray-900/40"
              }`}
              style={active ? { borderColor: CYCLE_COLOR[c], color: CYCLE_COLOR[c] } : undefined}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                style={{ background: CYCLE_COLOR[c], opacity: active ? 1 : 0.4 }}
              />
              {c}
            </button>
          );
        })}
        {(selectedReservoir || selectedFlow) && (
          <button
            onClick={() => {
              setSelectedReservoir(null);
              setSelectedFlow(null);
            }}
            className="ml-auto text-[11px] text-gray-400 hover:text-white border border-gray-700 px-2 py-1 rounded"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          role="img"
          aria-label="Earth system reservoirs and flows"
          className="bg-gray-950/60 rounded border border-gray-800"
        >
          <defs>
            {cycleList.map((c) => (
              <marker
                key={c}
                id={`arrow-${c}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill={CYCLE_COLOR[c]} />
              </marker>
            ))}
          </defs>

          {/* Flow paths first so reservoirs render on top */}
          {flowsRendered.map(({ f, d }) => {
            const isSelected = selectedFlow === flowKey(f);
            const opacity = selectedFlow == null || isSelected ? 1 : 0.18;
            return (
              <g key={flowKey(f)} opacity={opacity} style={{ cursor: "pointer" }}>
                <path
                  d={d}
                  fill="none"
                  stroke={CYCLE_COLOR[f.cycle]}
                  strokeWidth={isSelected ? 3.5 : 2}
                  strokeOpacity={isSelected ? 1 : 0.8}
                  markerEnd={`url(#arrow-${f.cycle})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFlow(isSelected ? null : flowKey(f));
                    setSelectedReservoir(null);
                  }}
                />
              </g>
            );
          })}

          {/* Reservoirs */}
          {RESERVOIRS.map((r) => {
            const isSelected = selectedReservoir === r.key;
            const isDimmed =
              (selectedReservoir != null && !isSelected) ||
              (selectedFlowObj != null && selectedFlowObj.from !== r.key && selectedFlowObj.to !== r.key);
            return (
              <g
                key={r.key}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedReservoir(isSelected ? null : r.key);
                  setSelectedFlow(null);
                }}
                style={{ cursor: "pointer" }}
                opacity={isDimmed ? 0.45 : 1}
              >
                <circle
                  cx={r.cx}
                  cy={r.cy}
                  r={RESERVOIR_RADIUS}
                  fill={r.color}
                  fillOpacity={0.18}
                  stroke={isSelected ? "#ffffff" : r.color}
                  strokeWidth={isSelected ? 3 : 2}
                />
                <text
                  x={r.cx}
                  y={r.cy - 4}
                  textAnchor="middle"
                  fontSize={13}
                  fill="#f9fafb"
                  fontFamily="ui-monospace, monospace"
                  fontWeight={600}
                >
                  {r.shortName}
                </text>
                <text
                  x={r.cx}
                  y={r.cy + 14}
                  textAnchor="middle"
                  fontSize={10}
                  fill={r.color}
                  fontFamily="ui-monospace, monospace"
                  opacity={0.85}
                >
                  click for detail
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-[10px] text-gray-500 leading-relaxed">
        Six reservoirs of the Earth system and the major flows between them. Toggle a cycle to focus on its fluxes;
        click a reservoir or arrow for stocks, residence times, and key facts. Anthropogenic perturbations are largest
        for the carbon cycle — the labelled net air-sea CO₂ and biospheric uptake are emergent imbalances of much
        larger ~80–120 Gt C/yr gross gross fluxes.
      </p>

      {selectedReservoirObj && (
        <div
          className="rounded border p-4 space-y-2"
          style={{ borderColor: selectedReservoirObj.color, background: `${selectedReservoirObj.color}22` }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Reservoir</p>
              <h3 className="text-lg font-semibold text-white">{selectedReservoirObj.name}</h3>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-white">{selectedReservoirObj.mass}</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500">mass / size</div>
              <div className="text-xs font-mono text-white mt-1">{selectedReservoirObj.residenceTime}</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500">residence time</div>
            </div>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">{selectedReservoirObj.description}</p>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Key facts</p>
            <ul className="mt-1 text-xs text-gray-300 leading-relaxed list-disc list-inside space-y-0.5">
              {selectedReservoirObj.facts.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {selectedFlowObj && (
        <div
          className="rounded border p-4 space-y-2"
          style={{
            borderColor: CYCLE_COLOR[selectedFlowObj.cycle],
            background: `${CYCLE_COLOR[selectedFlowObj.cycle]}22`,
          }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">
                {selectedFlowObj.cycle} flow · {findReservoir(selectedFlowObj.from).shortName} →{" "}
                {findReservoir(selectedFlowObj.to).shortName}
              </p>
              <h3 className="text-lg font-semibold text-white">{selectedFlowObj.name}</h3>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-white">{selectedFlowObj.magnitude}</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500">magnitude</div>
            </div>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">{selectedFlowObj.description}</p>
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
  filteredEntries: EarthEntry[];
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

export default function EarthSciencesPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedReservoir, setSelectedReservoir] = useState<ReservoirKey | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [activeCycles, setActiveCycles] = useState<Set<Flow["cycle"]>>(
    new Set(["water", "carbon", "energy", "nutrient"])
  );
  const [showDiagram, setShowDiagram] = useState(true);

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

  const bySection: Record<Section, { family: Family; entries: EarthEntry[] }[]> = {
    A: [], B: [], C: [], D: [], E: [],
  };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Earth Sciences — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to the Earth as a coupled system — atmosphere, ocean, cryosphere, biosphere, and solid Earth —
          organized into {ALL_FAMILIES.length} families across five sections. Each card carries a <em>key fact</em>,
          where useful a <em>formula</em> (typeset with KaTeX — Darcy, Manning, Sverdrup, Stefan-Boltzmann,
          radiometric decay), and an optional <em>example</em>. Entries marked <strong>OPEN</strong> are genuinely
          unresolved as of 2026 (AMOC tipping, WAIS stability, climate sensitivity narrowing, Snowball Earth
          dynamics, mass-extinction trajectory, slow earthquakes).
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Cross-references: this page is the <em>broader</em> sibling of{" "}
          <Link href="/geology" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">/geology</Link>
          {" "}— solid-Earth structure, mineralogy, plate tectonics, and the geologic time scale live there. Entries
          here additionally cite{" "}
          <Link href="/chemistry" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">chemistry</Link>,{" "}
          <Link href="/physics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">physics</Link>,{" "}
          <Link href="/biology" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">biology</Link>,{" "}
          <Link href="/astronomy" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">astronomy</Link>, and{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">statistics</Link>{" "}
          rather than duplicating. The headline visualization is the <strong>Earth System Flows diagram</strong> below
          — six reservoirs (Sun, atmosphere, hydrosphere, cryosphere, biosphere, lithosphere) connected by the major
          water, carbon, energy, and nutrient fluxes. Toggle a cycle to focus on its arrows; click any reservoir or
          flow for stocks, residence times, and magnitudes.
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries · 6 reservoirs · {FLOWS.length} flows
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
        </p>
      </div>

      {/* Earth System Flows diagram */}
      <section className="rounded-lg border border-emerald-900 overflow-hidden">
        <button
          onClick={() => setShowDiagram((v) => !v)}
          className="w-full text-left px-5 py-3 bg-emerald-950/40 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-emerald-200">Earth System Flows</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Six reservoirs, four cycles (water · carbon · energy · nutrient). Toggle cycles, click reservoirs or
              arrows for detail.
            </p>
          </div>
          <span className="text-xs text-emerald-400">{showDiagram ? "▾" : "▸"}</span>
        </button>
        {showDiagram && (
          <div className="bg-gray-950/40 p-4">
            <EarthSystemDiagram
              selectedReservoir={selectedReservoir}
              setSelectedReservoir={setSelectedReservoir}
              selectedFlow={selectedFlow}
              setSelectedFlow={setSelectedFlow}
              activeCycles={activeCycles}
              setActiveCycles={setActiveCycles}
            />
          </div>
        )}
      </section>

      {/* Filter / controls */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, key fact, formula, tag — e.g. 'ENSO', 'AMOC', 'Darcy', 'ice core'"
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
          <em>about</em> that concept — only that the term is present.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Open questions:</span> entries marked{" "}
          <span className="text-red-300 font-mono">OPEN</span> are genuinely unresolved as of 2026. AMOC tipping
          probability, WAIS / Thwaites stability, cloud feedback magnitude, permafrost carbon release, Amazon
          savannization, Mars + ocean-world habitability, and the trajectory of the current biodiversity loss all
          remain actively debated. Reports of inaccuracy welcome via the{" "}
          <Link href="/feedback" className="underline underline-offset-2">feedback</Link> page.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-06 · LaTeX typesetting via KaTeX · IPCC AR6 + Global Carbon Budget 2024 ·{" "}
          {ALL_FAMILIES.length} families · {totalEntries} entries · {RESERVOIRS.length} reservoirs · {FLOWS.length} flows
        </p>
      </div>
    </div>
  );
}
