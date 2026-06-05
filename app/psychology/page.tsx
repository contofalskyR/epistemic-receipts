"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import katex from "katex";
import "katex/dist/katex.min.css";

import type { PsychEntry, ColorKey, Family, Section, BrainRegion, BrainLobe } from "./types";
import { FAMILIES_1_7 } from "./data";
import { FAMILIES_8_14 } from "./data2";
import { FAMILIES_15_22 } from "./data3";
import { BRAIN_REGIONS, LOBE_STYLES, BIG_FIVE_TRAITS } from "./brain";

const ALL_FAMILIES: Family[] = [...FAMILIES_1_7, ...FAMILIES_8_14, ...FAMILIES_15_22];

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
  A: { name: "Section A — Foundations & Methods", tagline: "Schools, history, research design, and psychometrics." },
  B: { name: "Section B — Biological & Cognitive Sciences", tagline: "Neurons, perception, cognitive neuroscience, and the puzzle of consciousness." },
  C: { name: "Section C — Cognition & Learning", tagline: "How experience changes behavior — learning, memory, attention, thought, decision-making." },
  D: { name: "Section D — Development, Personality & Social", tagline: "Lifespan, individual differences, motivation, evolutionary mind, social behavior." },
  E: { name: "Section E — Clinical, Applied & Frontiers", tagline: "Mental disorder, therapy, work, education, culture, well-being, replication crisis." },
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

function entryMatches(entry: PsychEntry, query: string): boolean {
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
// Brain regions explorer
// ────────────────────────────────────────────────────────────────────────────

function BrainSchematic({ onSelect, selected }: { onSelect: (r: BrainRegion) => void; selected: string | null }) {
  const W = 720;
  const H = 420;

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} role="img" aria-label="Schematic brain with clickable regions" className="block">
        <defs>
          <radialGradient id="brain-glow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#1f2937" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0.95" />
          </radialGradient>
        </defs>
        {/* Cortical silhouette (very schematic) */}
        <path
          d="M 80 220 C 80 100, 200 50, 380 50 C 540 50, 640 110, 660 220 C 670 320, 580 360, 480 360 L 280 360 C 180 360, 80 320, 80 220 Z"
          fill="url(#brain-glow)"
          stroke="#4b5563"
          strokeWidth={1.5}
        />
        {/* Brainstem stub */}
        <path
          d="M 380 360 L 380 405 L 470 405 L 470 360 Z"
          fill="#1f2937"
          stroke="#4b5563"
          strokeWidth={1.5}
        />
        {/* Cerebellum lobule */}
        <path
          d="M 510 320 C 510 280, 570 290, 600 320 C 620 350, 600 390, 550 395 C 510 395, 490 360, 510 320 Z"
          fill="#1f2937"
          stroke="#4b5563"
          strokeWidth={1.5}
        />

        {/* Region nodes */}
        {BRAIN_REGIONS.map((r) => {
          const s = LOBE_STYLES[r.lobe];
          const isSelected = r.abbreviation === selected;
          return (
            <g
              key={r.abbreviation}
              onClick={() => onSelect(r)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={r.x}
                cy={r.y}
                r={isSelected ? 11 : 8}
                fill={s.bg}
                stroke={isSelected ? "#ffffff" : s.border}
                strokeWidth={isSelected ? 2 : 1.2}
                opacity={isSelected ? 1 : 0.92}
              />
              <text
                x={r.x}
                y={r.y + 3}
                textAnchor="middle"
                fontSize={8}
                fill={s.text}
                fontFamily="ui-monospace, monospace"
                pointerEvents="none"
              >
                {r.abbreviation.length > 4 ? r.abbreviation.slice(0, 4) : r.abbreviation}
              </text>
              <title>{`${r.name} (${r.abbreviation}) — ${s.label}`}</title>
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="pt-3 flex flex-wrap gap-2 text-[10px]">
        {Object.entries(LOBE_STYLES).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}
            />
            <span style={{ color: s.text }} className="font-mono">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrainRegionDetail({ region }: { region: BrainRegion }) {
  const s = LOBE_STYLES[region.lobe];
  return (
    <div className="rounded border p-4 space-y-2" style={{ borderColor: s.border, background: `${s.bg}66` }}>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: s.text }}>{s.label}</p>
          <h3 className="text-xl font-semibold text-white">
            {region.name} <span className="text-gray-400 font-mono text-sm">({region.abbreviation})</span>
          </h3>
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500">Functions</p>
        <ul className="mt-1 text-xs text-gray-200 list-disc list-inside leading-relaxed">
          {region.functions.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500">Lesion effects</p>
        <p className="mt-1 text-xs text-gray-200 leading-relaxed">{region.lesionEffects}</p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Big Five interactive slider profile
// ────────────────────────────────────────────────────────────────────────────

type BigFiveScores = Record<"O" | "C" | "E" | "A" | "N", number>;

function describeScore(score: number, traitName: string, high: string, low: string): string {
  if (score >= 80) return `Very high ${traitName.toLowerCase()} — ${high}`;
  if (score >= 60) return `High ${traitName.toLowerCase()} — ${high.split(",")[0]}.`;
  if (score >= 40) return `Average ${traitName.toLowerCase()} — balanced between poles.`;
  if (score >= 20) return `Low ${traitName.toLowerCase()} — ${low.split(",")[0]}.`;
  return `Very low ${traitName.toLowerCase()} — ${low}`;
}

const TRAIT_COLORS: Record<"O" | "C" | "E" | "A" | "N", string> = {
  O: "#a78bfa",
  C: "#60a5fa",
  E: "#fbbf24",
  A: "#34d399",
  N: "#fb7185",
};

function BigFiveProfile() {
  const [scores, setScores] = useState<BigFiveScores>({ O: 50, C: 50, E: 50, A: 50, N: 50 });

  // Radar chart geometry (pentagonal).
  const W = 360;
  const H = 320;
  const cx = W / 2;
  const cy = H / 2 + 8;
  const R = 110;
  const keys: ("O" | "C" | "E" | "A" | "N")[] = ["O", "C", "E", "A", "N"];
  const angle = (i: number) => (-Math.PI / 2) + (2 * Math.PI * i) / keys.length;
  const point = (i: number, r: number) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) });

  const polyPoints = keys
    .map((k, i) => {
      const r = (scores[k] / 100) * R;
      const p = point(i, r);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="grid sm:grid-cols-5 gap-4 items-start">
      {/* Sliders */}
      <div className="sm:col-span-3 space-y-3">
        {BIG_FIVE_TRAITS.map((t) => {
          const v = scores[t.key];
          const color = TRAIT_COLORS[t.key];
          return (
            <div key={t.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-mono mr-2" style={{ color }}>{t.key}</span>
                  <span className="text-sm font-semibold text-white">{t.shortName}</span>
                </div>
                <span className="text-xs font-mono text-gray-400 shrink-0">{v}</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-snug">{t.description}</p>
              <input
                type="range"
                min={0}
                max={100}
                value={v}
                onChange={(e) => setScores({ ...scores, [t.key]: Number(e.target.value) })}
                className="w-full"
                style={{ accentColor: color }}
              />
              <p className="text-[11px] text-gray-300 leading-snug">
                {describeScore(v, t.shortName, t.highPole, t.lowPole)}
              </p>
              <p className="text-[10px] text-gray-600 font-mono">
                facets: {t.facets.join(" · ")}
              </p>
            </div>
          );
        })}
      </div>
      {/* Radar */}
      <div className="sm:col-span-2">
        <svg width={W} height={H} role="img" aria-label="Big Five radar chart" className="mx-auto block">
          {/* Concentric grid */}
          {[0.25, 0.5, 0.75, 1.0].map((frac, gi) => (
            <polygon
              key={gi}
              fill="none"
              stroke="#374151"
              strokeWidth={0.7}
              points={keys.map((_, i) => {
                const p = point(i, R * frac);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              }).join(" ")}
            />
          ))}
          {/* Axes */}
          {keys.map((_, i) => {
            const p = point(i, R);
            return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#374151" strokeWidth={0.7} />;
          })}
          {/* Filled polygon */}
          <polygon points={polyPoints} fill="#a78bfa55" stroke="#a78bfa" strokeWidth={1.4} />
          {/* Axis labels */}
          {keys.map((k, i) => {
            const p = point(i, R + 16);
            return (
              <text
                key={k}
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize={11}
                fill={TRAIT_COLORS[k]}
                fontFamily="ui-monospace, monospace"
                fontWeight={600}
              >
                {k}
              </text>
            );
          })}
        </svg>
        <p className="text-[10px] text-gray-500 mt-2 text-center leading-snug">
          Move the sliders to see a Big-Five profile. The radar shows the five trait scores together.
          Self-report scores are not destiny — they are an unstable, situational snapshot of a continuous trait.
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Xref & status badges
// ────────────────────────────────────────────────────────────────────────────

function XrefBadges({ entry }: { entry: PsychEntry }) {
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

function StatusBadge({ entry }: { entry: PsychEntry }) {
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
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-950/60 text-green-300 font-mono border border-green-900/60">LANDMARK</span>;
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
  entry: PsychEntry;
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
  filteredEntries: PsychEntry[];
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
const LOBE_COUNTS: Record<BrainLobe, number> = BRAIN_REGIONS.reduce(
  (acc, r) => {
    acc[r.lobe] = (acc[r.lobe] ?? 0) + 1;
    return acc;
  },
  { frontal: 0, parietal: 0, temporal: 0, occipital: 0, limbic: 0, subcortical: 0, cerebellum: 0, brainstem: 0 } as Record<BrainLobe, number>,
);

export default function PsychologyPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<BrainRegion | null>(null);
  const [showBrain, setShowBrain] = useState(true);
  const [showBigFive, setShowBigFive] = useState(true);

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

  const bySection: Record<Section, { family: Family; entries: PsychEntry[] }[]> = { A: [], B: [], C: [], D: [], E: [] };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Psychology — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to psychology organized into 22 families across five sections — Foundations &amp; Methods,
          Biological &amp; Cognitive Sciences, Cognition &amp; Learning, Development/Personality/Social, and
          Clinical/Applied/Frontiers. Each card carries a <em>key fact</em>, where relevant a <em>formula</em>{" "}
          (typeset with KaTeX), the original <em>researcher</em>, and an <em>example</em>. Status badges
          mark <strong>LANDMARK</strong>, <strong>CONTESTED</strong>, <strong>REFUTED</strong>, and{" "}
          <strong>OPEN</strong> entries. The 2010s replication crisis has reshaped what counts as well-established;
          we mark the casualties accordingly.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Cross-references: entries marked <span className="font-mono">xref</span> link to{" "}
          <Link href="/biology" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">biology</Link>,{" "}
          <Link href="/medicine" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">medicine</Link>,{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">statistics</Link>,{" "}
          <Link href="/philosophy" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">philosophy</Link>,
          and other siblings rather than duplicating.
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries · {BRAIN_REGIONS.length} brain regions · 5 Big-Five traits
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
        </p>
      </div>

      {/* Brain regions explorer */}
      <section className="rounded-lg border border-gray-800 overflow-hidden">
        <button
          onClick={() => setShowBrain((v) => !v)}
          className="w-full text-left px-5 py-3 bg-gray-900/60 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-100">Brain regions explorer</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {BRAIN_REGIONS.length} regions across 8 lobes — click a node to see functions and the classic lesion syndromes.
            </p>
          </div>
          <span className="text-xs text-gray-400">{showBrain ? "▾" : "▸"}</span>
        </button>
        {showBrain && (
          <div className="bg-gray-950/40 p-4 grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <BrainSchematic onSelect={setSelectedRegion} selected={selectedRegion?.abbreviation ?? null} />
              <p className="text-[10px] text-gray-600 mt-2 leading-snug">
                Schematic left-sagittal view. Coordinates are illustrative, not anatomically precise.
                Lobes: frontal {LOBE_COUNTS.frontal} · parietal {LOBE_COUNTS.parietal} · temporal {LOBE_COUNTS.temporal} ·
                occipital {LOBE_COUNTS.occipital} · limbic {LOBE_COUNTS.limbic} · subcortical {LOBE_COUNTS.subcortical} ·
                cerebellum {LOBE_COUNTS.cerebellum} · brainstem {LOBE_COUNTS.brainstem}.
              </p>
            </div>
            <div>
              {selectedRegion ? (
                <BrainRegionDetail region={selectedRegion} />
              ) : (
                <div className="rounded border border-gray-800 p-4 text-xs text-gray-400">
                  Click any region in the schematic to view its functions and the cognitive deficits produced by lesions.
                  Examples: <span className="font-mono">PFC</span> (Phineas Gage), <span className="font-mono">HC</span>{" "}
                  (patient HM), <span className="font-mono">FFA</span> (prosopagnosia), <span className="font-mono">AMY</span>{" "}
                  (Klüver-Bucy).
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Big Five profile */}
      <section className="rounded-lg border border-gray-800 overflow-hidden">
        <button
          onClick={() => setShowBigFive((v) => !v)}
          className="w-full text-left px-5 py-3 bg-gray-900/60 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-100">Big Five personality profile</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Move the sliders to construct an OCEAN profile. Radar updates live. The five traits are the dominant trait taxonomy in personality psychology.
            </p>
          </div>
          <span className="text-xs text-gray-400">{showBigFive ? "▾" : "▸"}</span>
        </button>
        {showBigFive && (
          <div className="bg-gray-950/40 p-4">
            <BigFiveProfile />
          </div>
        )}
      </section>

      {/* Filter / controls */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, key fact, formula, tag, researcher — e.g. 'Kahneman', 'attachment', 'replication'"
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
          <span className="text-gray-400">Replication crisis posture:</span> entries marked{" "}
          <span className="text-rose-300 font-mono">REFUTED</span> are findings that have not survived registered
          replication (power posing, ego depletion, facial-feedback hypothesis, MBTI). Entries marked{" "}
          <span className="text-amber-300 font-mono">CONTESTED</span> have effect sizes that have shrunk substantially
          on replication (stereotype threat, IAT predictive validity, growth mindset, marshmallow test, Stanford Prison Experiment,
          Hofstede). Entries marked <span className="text-red-300 font-mono">OPEN</span> are genuine frontier
          questions as of 2026 (hard problem of consciousness, free will, animal consciousness, theory of mind in LLMs,
          post-2010 adolescent mental health). Reports of inaccuracy welcome via the{" "}
          <Link href="/feedback" className="underline underline-offset-2">feedback</Link> page.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-05 · LaTeX typesetting via KaTeX · {ALL_FAMILIES.length} families · {totalEntries} entries · {BRAIN_REGIONS.length} brain regions
        </p>
      </div>
    </div>
  );
}
