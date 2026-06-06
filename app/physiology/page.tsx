"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import katex from "katex";
import "katex/dist/katex.min.css";

import type { ColorKey, Family, PhysEntry, Section, OrgSystem } from "./types";
import { LiveResearchCard } from "@/components/LiveResearchCard";
import { FAMILIES_1_6 } from "./data";
import { FAMILIES_7_11 } from "./data2";
import { FAMILIES_12_18 } from "./data3";

const ALL_FAMILIES: Family[] = [...FAMILIES_1_6, ...FAMILIES_7_11, ...FAMILIES_12_18];

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
  A: { name: "Section A — Cellular & Molecular Foundations", tagline: "Membrane biophysics, ion channels, signal transduction, energetics, neurophysiology, and synaptic mechanisms." },
  B: { name: "Section B — Cardiovascular & Respiratory Systems", tagline: "Cardiac mechanics and electrophysiology, vascular hemodynamics, and pulmonary gas exchange." },
  C: { name: "Section C — Renal, Gastrointestinal, Endocrine & Reproductive", tagline: "Fluid balance, digestion and absorption, hormonal axes, and the physiology of reproduction." },
  D: { name: "Section D — Musculoskeletal, Immune & Hematology", tagline: "Skeletal, cardiac, and smooth muscle; innate and adaptive immunity; blood and hemostasis." },
  E: { name: "Section E — Integration, Aging & Frontiers", tagline: "Homeostasis, exercise, circadian control, and the open questions of human physiology." },
};

const SYSTEM_LABELS: Record<OrgSystem, string> = {
  cardiovascular: "Cardiovascular",
  respiratory: "Respiratory",
  nervous: "Nervous",
  endocrine: "Endocrine",
  digestive: "Digestive",
  renal: "Renal",
  musculoskeletal: "Musculoskeletal",
  immune: "Immune",
  reproductive: "Reproductive",
  cellular: "Cellular / Molecular",
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

function entryMatches(entry: PhysEntry, query: string, systemFilter: OrgSystem | null, family: Family): boolean {
  if (systemFilter && !family.systems.includes(systemFilter)) return false;
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
// Xref & status badges
// ────────────────────────────────────────────────────────────────────────────

function XrefBadges({ entry }: { entry: PhysEntry }) {
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

function StatusBadge({ entry }: { entry: PhysEntry }) {
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
  entry: PhysEntry;
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
  filteredEntries: PhysEntry[];
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
          <div className="mt-1 flex flex-wrap gap-1">
            {family.systems.map((s) => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/60 text-gray-400 font-mono">
                {SYSTEM_LABELS[s]}
              </span>
            ))}
          </div>
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
const SYSTEM_ORDER: OrgSystem[] = [
  "cellular",
  "cardiovascular",
  "respiratory",
  "renal",
  "digestive",
  "endocrine",
  "nervous",
  "musculoskeletal",
  "immune",
  "reproductive",
];

export default function PhysiologyPage() {
  const [query, setQuery] = useState("");
  const [systemFilter, setSystemFilter] = useState<OrgSystem | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return ALL_FAMILIES.map((f) => ({
      family: f,
      entries: f.entries.filter((e) => entryMatches(e, query, systemFilter, f)),
    })).filter((f) => f.entries.length > 0);
  }, [query, systemFilter]);

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

  const bySection: Record<Section, { family: Family; entries: PhysEntry[] }[]> = { A: [], B: [], C: [], D: [], E: [] };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Physiology — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          Physiology is the mechanistic substrate of clinical medicine — the explanation behind every symptom, every drug
          target, and every diagnostic test. Before a clinician interprets an ECG, an arterial blood gas, or a creatinine
          trend, an integrated story of pumps, gradients, and feedback loops has to be running in the background. This page
          is a field guide to that story across {ALL_FAMILIES.length} families and five sections — from the membrane
          biophysics that gives rise to a single action potential, up through the cardiovascular, respiratory, renal,
          gastrointestinal, endocrine, reproductive, musculoskeletal and immune systems, and out to the integrative
          regulation of body temperature, fluid balance, exercise, and the open questions of aging and regeneration.
        </p>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          Each card carries a <em>key fact</em>, where relevant a <em>formula</em>{" "}
          (typeset with KaTeX — Nernst, GHK, Starling, Henderson-Hasselbalch, Poiseuille, Hill, Fick),
          the original <em>researcher</em>, and an organ-system tag. Status badges mark{" "}
          <strong>LANDMARK</strong>, <strong>CONTESTED</strong>, <strong>REFUTED</strong>, and{" "}
          <strong>OPEN</strong> entries — the last covers genuine frontier questions like body-weight set-point
          regulation, adult human cardiac regeneration, and the molecular basis of general anesthesia.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Cross-references: entries marked <span className="font-mono">xref</span> link to{" "}
          <Link href="/neuroscience" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">neuroscience</Link>,{" "}
          <Link href="/biology" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">biology</Link>,{" "}
          <Link href="/medicine" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">medicine</Link>,{" "}
          <Link href="/chemistry" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">chemistry</Link>,{" "}
          and <Link href="/physics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">physics</Link>{" "}
          rather than duplicating their content here.
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries · 5 sections · {SYSTEM_ORDER.length} organ systems
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
          {systemFilter && (
            <span className="text-gray-500"> · filtered to {SYSTEM_LABELS[systemFilter]}</span>
          )}
        </p>
      </div>

      {/* Organ-system filter strip */}
      <section className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">Filter by organ system</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSystemFilter(null)}
            className={`text-[11px] px-2 py-1 rounded font-mono border transition-colors ${
              systemFilter === null
                ? "bg-gray-200 text-gray-900 border-gray-200"
                : "bg-gray-900 text-gray-400 border-gray-800 hover:text-white hover:border-gray-600"
            }`}
          >
            All
          </button>
          {SYSTEM_ORDER.map((s) => {
            const active = systemFilter === s;
            return (
              <button
                key={s}
                onClick={() => setSystemFilter(active ? null : s)}
                className={`text-[11px] px-2 py-1 rounded font-mono border transition-colors ${
                  active
                    ? "bg-gray-200 text-gray-900 border-gray-200"
                    : "bg-gray-900 text-gray-400 border-gray-800 hover:text-white hover:border-gray-600"
                }`}
              >
                {SYSTEM_LABELS[s]}
              </button>
            );
          })}
        </div>
      </section>

      {/* Filter / controls */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, key fact, formula, tag, researcher — e.g. 'Nernst', 'aldosterone', 'sarcomere', 'V/Q'"
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
          {(query || systemFilter) && (
            <button
              onClick={() => { setQuery(""); setSystemFilter(null); }}
              className="px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">
          No entries match the current filters. Try a broader term or clear the organ-system filter.
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

      <LiveResearchCard slug="physiology" />

      <div className="border-t border-gray-800 pt-6 mt-12 space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Note:</span> the &ldquo;search&rdquo; link on each card runs a free-text
          search over claim and source text. A term appearing in a claim does not mean the claim is{" "}
          <em>about</em> that concept — only that the term is present.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Open and contested:</span> entries marked{" "}
          <span className="text-red-300 font-mono">OPEN</span> are genuine frontier questions —
          body-weight set-point regulation, the molecular target of general anesthetics, why adult human cardiac and
          CNS regeneration fail, the limits of personalized -omics medicine. Entries marked{" "}
          <span className="text-amber-300 font-mono">CONTESTED</span> include the revised Starling/glycocalyx model
          of capillary exchange, adult human hippocampal neurogenesis, the gut-brain-microbiome axis, the timing of
          labor onset, early goal-directed therapy in sepsis, and the clinical utility of senolytic therapy.
          Cross-references to <Link href="/neuroscience" className="underline underline-offset-2">neuroscience</Link> and{" "}
          <Link href="/medicine" className="underline underline-offset-2">medicine</Link> carry the surrounding
          debate where it lives.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Claim cross-references pending:</span> live links from each card to specific
          claims in the database will be wired up as the topic taxonomy is populated. The &quot;Live Research&quot; card above
          (if present) reflects current OpenAlex-indexed publication counts for the <span className="font-mono">physiology</span> topic.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-06 · LaTeX typesetting via KaTeX · {ALL_FAMILIES.length} families · {totalEntries} entries · {SYSTEM_ORDER.length} organ systems
        </p>
      </div>
    </div>
  );
}
