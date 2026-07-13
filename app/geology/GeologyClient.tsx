"use client";
import { DomainStatusBadge } from "@/components/DomainStatusBadge";

import { useMemo, useState } from "react";
import Link from "next/link";
import katex from "katex";
import "katex/dist/katex.min.css";

import type { GeoEntry, ColorKey, Family, Section, TimeUnit, MohsMineral } from "./types";
import { FAMILIES_1_8 } from "./data";
import { FAMILIES_9_16 } from "./data2";
import { FAMILIES_17_24 } from "./data3";
import { TIME_UNITS, MOHS_SCALE, HARDNESS_REFERENCES } from "./timescale";

const ALL_FAMILIES: Family[] = [...FAMILIES_1_8, ...FAMILIES_9_16, ...FAMILIES_17_24];

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
  A: { name: "Section A — Earth Materials", tagline: "Minerals, crystals, and the three rock families plus the geochemistry that ties them together." },
  B: { name: "Section B — Earth Dynamics & Structure", tagline: "Plate tectonics, deformation, volcanoes, earthquakes, and the geophysics of Earth's interior." },
  C: { name: "Section C — Surface Systems", tagline: "Geomorphology, sedimentary environments, groundwater, ice, ocean, and atmospheric Earth." },
  D: { name: "Section D — Earth History", tagline: "Stratigraphy, geologic time, and the four-billion-year fossil record." },
  E: { name: "Section E — Applied, Planetary & Frontier", tagline: "Ore deposits, hydrocarbons, planetary geology, and the questions that remain open." },
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

function entryMatches(entry: GeoEntry, query: string): boolean {
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

function XrefBadges({ entry }: { entry: GeoEntry }) {
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
  entry: GeoEntry;
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
// Geologic time scale explorer
// ────────────────────────────────────────────────────────────────────────────

// Use a log-like compression on time so the Precambrian (~88% of Earth history)
// doesn't visually dwarf the Phanerozoic. We piecewise-stretch the Phanerozoic
// to ~50% of the bar width.
const TIMELINE_WIDTH = 900;
const PHANEROZOIC_START = 538.8;
const EARTH_AGE = 4567;
const PHAN_FRACTION = 0.55;

function timeToX(ma: number): number {
  if (ma <= PHANEROZOIC_START) {
    // Phanerozoic — linear from PHANEROZOIC_START at left edge of Phanerozoic block to 0 at right edge.
    const frac = (PHANEROZOIC_START - ma) / PHANEROZOIC_START;
    return TIMELINE_WIDTH * (1 - PHAN_FRACTION) + TIMELINE_WIDTH * PHAN_FRACTION * frac;
  }
  // Precambrian — linear from EARTH_AGE at left edge to PHANEROZOIC_START at start of Phanerozoic block.
  const frac = (EARTH_AGE - ma) / (EARTH_AGE - PHANEROZOIC_START);
  return TIMELINE_WIDTH * (1 - PHAN_FRACTION) * frac;
}

function TimeScaleExplorer({
  selected,
  setSelected,
}: {
  selected: TimeUnit | null;
  setSelected: (u: TimeUnit | null) => void;
}) {
  const eons = TIME_UNITS.filter((u) => u.level === "eon");
  const eras = TIME_UNITS.filter((u) => u.level === "era");
  const periods = TIME_UNITS.filter((u) => u.level === "period");

  const rowHeight = 36;
  const gap = 4;
  const rows = [eons, eras, periods];
  const totalHeight = rows.length * (rowHeight + gap) + 30;

  const renderUnit = (u: TimeUnit, rowIdx: number) => {
    const x1 = timeToX(u.startMa);
    const x2 = timeToX(u.endMa);
    const width = Math.max(2, x1 - x2);
    const left = TIMELINE_WIDTH - x1;
    const y = rowIdx * (rowHeight + gap);
    const isSelected = selected?.name === u.name;
    return (
      <g
        key={u.name}
        transform={`translate(${left}, ${y})`}
        onClick={() => setSelected(isSelected ? null : u)}
        style={{ cursor: "pointer" }}
      >
        <rect
          width={width}
          height={rowHeight}
          fill={u.color}
          stroke={isSelected ? "#ffffff" : "#1f2937"}
          strokeWidth={isSelected ? 2 : 1}
          rx={2}
        />
        {width > 60 && (
          <text
            x={width / 2}
            y={rowHeight / 2 + 4}
            fill="#f3f4f6"
            textAnchor="middle"
            fontSize={11}
            fontFamily="ui-monospace, monospace"
          >
            {u.name}
          </text>
        )}
        {width <= 60 && width > 12 && (
          <text
            x={width / 2}
            y={rowHeight / 2 + 4}
            fill="#f3f4f6"
            textAnchor="middle"
            fontSize={9}
            fontFamily="ui-monospace, monospace"
          >
            {u.name.slice(0, 3)}
          </text>
        )}
      </g>
    );
  };

  // Tick marks at meaningful ages.
  const tickAges = [0, 66, 252, 539, 1000, 2000, 3000, 4000, 4567];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg width={TIMELINE_WIDTH} height={totalHeight} role="img" aria-label="Geologic time scale">
          {rows.map((row, i) => (
            <g key={i}>
              {row.map((u) => renderUnit(u, i))}
            </g>
          ))}
          {/* Tick axis */}
          <g transform={`translate(0, ${rows.length * (rowHeight + gap)})`}>
            <line x1={0} y1={0} x2={TIMELINE_WIDTH} y2={0} stroke="#4b5563" strokeWidth={1} />
            {tickAges.map((age) => {
              const x = TIMELINE_WIDTH - timeToX(age);
              return (
                <g key={age} transform={`translate(${x}, 0)`}>
                  <line y1={0} y2={5} stroke="#9ca3af" strokeWidth={1} />
                  <text y={18} fontSize={10} fill="#9ca3af" textAnchor="middle" fontFamily="ui-monospace, monospace">
                    {age === 0 ? "now" : `${age} Ma`}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <p className="text-[10px] text-gray-500">
        Boundary ages from the International Chronostratigraphic Chart (ICS 2023). The Phanerozoic (last 538.8 Myr) is
        stretched to ~55% of the bar; Precambrian time is compressed. Click any block for details.
      </p>
      {selected && (
        <div
          className="rounded border p-4 space-y-2"
          style={{ borderColor: selected.color, background: `${selected.color}22` }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">{selected.level}</p>
              <h3 className="text-lg font-semibold text-white">{selected.name}</h3>
              {selected.parent && <p className="text-xs text-gray-400">part of {selected.parent}</p>}
            </div>
            <div className="text-right">
              <div className="text-lg font-mono text-white">
                {selected.startMa.toLocaleString()} – {selected.endMa.toLocaleString()} Ma
              </div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500">
                duration {(selected.startMa - selected.endMa).toLocaleString()} Myr
              </div>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Key events</p>
            <ul className="mt-1 text-xs text-gray-300 leading-relaxed list-disc list-inside space-y-0.5">
              {selected.events.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Mohs hardness visualization
// ────────────────────────────────────────────────────────────────────────────

const MOHS_COLOR = "#a78bfa";
const ABSOLUTE_COLOR = "#fbbf24";

function MohsScale({
  selected,
  setSelected,
}: {
  selected: MohsMineral | null;
  setSelected: (m: MohsMineral | null) => void;
}) {
  const width = 880;
  const height = 280;
  const padL = 60;
  const padR = 20;
  const padT = 20;
  const padB = 90;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  // Use log scale for absolute hardness so the diamond outlier doesn't flatten everything.
  const maxAbs = MOHS_SCALE[MOHS_SCALE.length - 1].absoluteHardness;
  const logMin = 0;
  const logMax = Math.log10(maxAbs);
  const xFor = (mohs: number) => padL + ((mohs - 1) / 9) * innerW;
  const yForAbs = (abs: number) => padT + innerH * (1 - (Math.log10(abs) - logMin) / (logMax - logMin));
  const yForMohs = (mohs: number) => padT + innerH * (1 - (mohs - 1) / 9);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label="Mohs hardness scale">
          {/* Grid */}
          <g>
            {MOHS_SCALE.map((m) => (
              <line
                key={`grid-${m.hardness}`}
                x1={xFor(m.hardness)}
                y1={padT}
                x2={xFor(m.hardness)}
                y2={padT + innerH}
                stroke="#1f2937"
                strokeDasharray="2 2"
              />
            ))}
          </g>
          {/* Axes */}
          <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#4b5563" />
          <text x={padL + innerW / 2} y={height - 12} fontSize={11} fill="#9ca3af" textAnchor="middle" fontFamily="ui-monospace, monospace">
            Mohs hardness (ordinal 1–10)
          </text>
          <text
            x={15}
            y={padT + innerH / 2}
            fontSize={11}
            fill="#9ca3af"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            transform={`rotate(-90, 15, ${padT + innerH / 2})`}
          >
            scaled value (log)
          </text>
          {/* Mohs ordinal line */}
          <polyline
            points={MOHS_SCALE.map((m) => `${xFor(m.hardness)},${yForMohs(m.hardness)}`).join(" ")}
            fill="none"
            stroke={MOHS_COLOR}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          {/* Absolute hardness curve */}
          <polyline
            points={MOHS_SCALE.map((m) => `${xFor(m.hardness)},${yForAbs(m.absoluteHardness)}`).join(" ")}
            fill="none"
            stroke={ABSOLUTE_COLOR}
            strokeWidth={2}
          />
          {/* Mineral dots + labels */}
          {MOHS_SCALE.map((m) => {
            const isSelected = selected?.hardness === m.hardness;
            return (
              <g key={m.hardness}>
                <circle
                  cx={xFor(m.hardness)}
                  cy={yForAbs(m.absoluteHardness)}
                  r={isSelected ? 7 : 4.5}
                  fill={ABSOLUTE_COLOR}
                  stroke={isSelected ? "#ffffff" : "#0a0a0a"}
                  strokeWidth={1.5}
                  onClick={() => setSelected(isSelected ? null : m)}
                  style={{ cursor: "pointer" }}
                />
                <text
                  x={xFor(m.hardness)}
                  y={padT + innerH + 16}
                  fontSize={10}
                  fill="#d1d5db"
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                >
                  {m.hardness}
                </text>
                <text
                  x={xFor(m.hardness)}
                  y={padT + innerH + 30}
                  fontSize={10}
                  fill="#9ca3af"
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                >
                  {m.name}
                </text>
                <text
                  x={xFor(m.hardness)}
                  y={padT + innerH + 44}
                  fontSize={9}
                  fill="#6b7280"
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                >
                  {m.absoluteHardness}
                </text>
              </g>
            );
          })}
          {/* Reference-object markers on horizontal axis */}
          {HARDNESS_REFERENCES.map((r) => (
            <g key={r.name}>
              <line
                x1={xFor(r.hardness)}
                y1={padT}
                x2={xFor(r.hardness)}
                y2={padT + innerH}
                stroke="#9ca3af"
                strokeOpacity={0.3}
                strokeDasharray="1 4"
              />
              <text
                x={xFor(r.hardness) + 3}
                y={padT + 12}
                fontSize={9}
                fill="#9ca3af"
                fontFamily="ui-monospace, monospace"
              >
                {r.name}
              </text>
            </g>
          ))}
          {/* Legend */}
          <g transform={`translate(${padL}, ${padT - 2})`}>
            <line x1={0} y1={0} x2={20} y2={0} stroke={ABSOLUTE_COLOR} strokeWidth={2} />
            <text x={26} y={4} fontSize={10} fill={ABSOLUTE_COLOR} fontFamily="ui-monospace, monospace">absolute (Vickers, log)</text>
            <line x1={170} y1={0} x2={190} y2={0} stroke={MOHS_COLOR} strokeWidth={1.5} strokeDasharray="4 3" />
            <text x={196} y={4} fontSize={10} fill={MOHS_COLOR} fontFamily="ui-monospace, monospace">Mohs ordinal step</text>
          </g>
        </svg>
      </div>
      {selected && (
        <div
          className="rounded border border-amber-900 p-4 space-y-2 bg-amber-950/30"
        >
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-400">Mineral</p>
              <h3 className="text-lg font-semibold text-white">{selected.name}</h3>
              <p className="text-xs text-gray-400 mt-1">
                <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Formula</span>
                <MathExpr expr={selected.formula} />
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono text-white">{selected.hardness}</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500">Mohs (ordinal)</div>
              <div className="text-xs text-amber-300 font-mono mt-1">~{selected.absoluteHardness}× talc (absolute)</div>
            </div>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">{selected.example}</p>
        </div>
      )}
      <p className="text-[10px] text-gray-500 leading-relaxed">
        The Mohs scale (Friedrich Mohs, 1812) is ordinal — &ldquo;harder than&rdquo; via scratch test. Absolute hardness
        from Vickers indentation (Tabor 1954, plotted log scale) shows the scale is highly non-linear at the top:
        diamond is ~4× harder than corundum despite being one step up. Fingernail ≈ 2.5; copper penny ≈ 3.5; iron nail ≈
        4.5; glass plate ≈ 5.5; steel file ≈ 6.5.
      </p>
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
  filteredEntries: GeoEntry[];
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

export default function GeologyPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<TimeUnit | null>(null);
  const [selectedMineral, setSelectedMineral] = useState<MohsMineral | null>(null);
  const [showTime, setShowTime] = useState(true);
  const [showMohs, setShowMohs] = useState(false);

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

  const bySection: Record<Section, { family: Family; entries: GeoEntry[] }[]> = { A: [], B: [], C: [], D: [], E: [] };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Geology — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to geology organized into {ALL_FAMILIES.length} families across five sections — Earth Materials,
          Earth Dynamics &amp; Structure, Surface Systems, Earth History, and Applied/Planetary/Frontier. Each card
          carries a <em>key fact</em>, where relevant a <em>formula</em> (typeset with KaTeX — radiometric decay, Darcy,
          Bragg, stream power), and an <em>example</em>. Entries marked <strong>OPEN</strong> are genuinely unresolved
          as of 2026 (Snowball Earth details, Mars life, AMOC tipping, slow earthquakes, Anthropocene formalization).
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Cross-references: entries marked <span className="font-mono">xref</span> link to{" "}
          <Link href="/physics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">physics</Link>,{" "}
          <Link href="/chemistry" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">chemistry</Link>, or{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">statistics</Link>{" "}
          rather than duplicating. The two headline visualizations are the <strong>geologic time scale explorer</strong>{" "}
          (click any eon, era, or period for boundary ages and key events) and the <strong>Mohs hardness scale</strong>{" "}
          (the 10 reference minerals with their absolute Vickers values plotted log-scale to show that diamond is ~4×
          harder than corundum despite being one ordinal step up).
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries · {TIME_UNITS.length} time units · 10 Mohs minerals
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
        </p>
      </div>

      {/* Geologic time scale */}
      <section className="rounded-lg border border-violet-900 overflow-hidden">
        <button
          onClick={() => setShowTime((v) => !v)}
          className="w-full text-left px-5 py-3 bg-violet-950/40 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-violet-200">Geologic time scale explorer</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              ICS 2023 chronostratigraphic chart. Eons, eras, and periods shown to scale (Phanerozoic stretched). Click
              any unit for boundary ages and key events.
            </p>
          </div>
          <span className="text-xs text-violet-400">{showTime ? "▾" : "▸"}</span>
        </button>
        {showTime && (
          <div className="bg-gray-950/40 p-4">
            <TimeScaleExplorer selected={selectedTime} setSelected={setSelectedTime} />
          </div>
        )}
      </section>

      {/* Mohs hardness */}
      <section className="rounded-lg border border-amber-900 overflow-hidden">
        <button
          onClick={() => setShowMohs((v) => !v)}
          className="w-full text-left px-5 py-3 bg-amber-950/40 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-amber-200">Mohs hardness scale</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Mohs&apos;s 1812 ordinal 1–10 scratch scale plotted against the Vickers-derived absolute hardness (log axis).
              Click a mineral to see its chemistry and reference use.
            </p>
          </div>
          <span className="text-xs text-amber-400">{showMohs ? "▾" : "▸"}</span>
        </button>
        {showMohs && (
          <div className="bg-gray-950/40 p-4">
            <MohsScale selected={selectedMineral} setSelected={setSelectedMineral} />
          </div>
        )}
      </section>

      {/* Filter / controls */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, key fact, formula, tag — e.g. 'basalt', 'zircon', 'Darcy', 'Cambrian'"
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
          <span className="text-red-300 font-mono">OPEN</span> are genuinely unresolved as of 2026. Snowball Earth onset
          and termination details, life on early Mars, slow-earthquake mechanism, AMOC tipping risk, Anthropocene
          formalization, and the sixth-extinction trajectory all remain actively debated. Reports of inaccuracy welcome
          via the <Link href="/feedback" className="underline underline-offset-2">feedback</Link> page.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-05 · LaTeX typesetting via KaTeX · ICS 2023 time scale · {ALL_FAMILIES.length} families · {totalEntries} entries
        </p>
      </div>
    </div>
  );
}
