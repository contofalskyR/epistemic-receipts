"use client";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DomainStatusBadge } from "@/components/DomainStatusBadge";

import { useMemo, useState } from "react";
import Link from "next/link";
import katex from "katex";
import "katex/dist/katex.min.css";

import type { CommEntry, ColorKey, Family, Section } from "./types";
import { FAMILIES_1_4 } from "./data";
import { FAMILIES_5_11 } from "./data2";
import { FAMILIES_12_18 } from "./data3";
import { LiveResearchCard } from "@/components/LiveResearchCard";

const ALL_FAMILIES: Family[] = [...FAMILIES_1_4, ...FAMILIES_5_11, ...FAMILIES_12_18];

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
  orange:  { headerBg: "bg-orange-950/40",  headerBorder: "border-orange-900",  headerText: "text-orange-200",  chipBg: "bg-orange-950/60",  chipText: "text-orange-300",  cardBorder: "border-orange-950/70",  cardHover: "hover:border-orange-700",  accent: "text-orange-400" },
  rose:    { headerBg: "bg-rose-950/40",    headerBorder: "border-rose-900",    headerText: "text-rose-200",    chipBg: "bg-rose-950/60",    chipText: "text-rose-300",    cardBorder: "border-rose-950/70",    cardHover: "hover:border-rose-700",    accent: "text-rose-400" },
  fuchsia: { headerBg: "bg-fuchsia-950/40", headerBorder: "border-fuchsia-900", headerText: "text-fuchsia-200", chipBg: "bg-fuchsia-950/60", chipText: "text-fuchsia-300", cardBorder: "border-fuchsia-950/70", cardHover: "hover:border-fuchsia-700", accent: "text-fuchsia-400" },
  purple:  { headerBg: "bg-purple-950/40",  headerBorder: "border-purple-900",  headerText: "text-purple-200",  chipBg: "bg-purple-950/60",  chipText: "text-purple-300",  cardBorder: "border-purple-950/70",  cardHover: "hover:border-purple-700",  accent: "text-purple-400" },
  pink:    { headerBg: "bg-pink-950/40",    headerBorder: "border-pink-900",    headerText: "text-pink-200",    chipBg: "bg-pink-950/60",    chipText: "text-pink-300",    cardBorder: "border-pink-950/70",    cardHover: "hover:border-pink-700",    accent: "text-pink-400" },
};

const SECTION_INFO: Record<Section, { name: string; tagline: string; dataSource: string }> = {
  A: {
    name: "Section A — Foundational Models & Theory",
    tagline: "Process/transmission models and the meta-theoretical traditions that frame the whole field.",
    dataSource: "Data source: none of its own; the meta-theoretical scaffold the later data-bearing families hang on. Effects-measurement links thread to [xref: statistics].",
  },
  B: {
    name: "Section B — Interpersonal, Group & Organizational",
    tagline: "Meaning-making among individuals, in dyads, small groups, and organizations.",
    dataSource: "Data source: social-graph and interaction data; survey instruments; organizational-communication and network datasets link to [xref: statistics] (network analysis) and [xref: sociology].",
  },
  C: {
    name: "Section C — Mass Communication & Media-Effects",
    tagline: "How mass media affect audiences and society — organized as strong-effects → limited-effects → moderate/cumulative → active-audience/reception.",
    dataSource: "Data source: content-analysis coding of news/media pipelines; survey and experimental effects data; election and opinion data via [xref: political-science]; all effect-size and reliability estimation via [xref: statistics].",
  },
  D: {
    name: "Section D — Semiotics, Rhetoric & Persuasion",
    tagline: "How signs carry meaning and how symbols move audiences.",
    dataSource: "Data source: text and content-analysis pipelines; the linguistics taxonomy for sign systems and pragmatics; the philosophy taxonomy for classical rhetorical theory.",
  },
  E: {
    name: "Section E — Journalism, News & Digital / Networked Media",
    tagline: "How news is produced and how the digital/social/network turn is reshaping mediated communication.",
    dataSource: "Data source: news/media content pipelines; social-graph and platform-behavior data; content-analysis and network-analysis estimation via [xref: statistics]; platform-regulation seams to [xref: political-science] and [xref: law].",
  },
  F: {
    name: "Section F — Media Economics, Political & Intercultural",
    tagline: "Where media meet markets, states, campaigns, and cultures.",
    dataSource: "Data source: media-industry and ownership data; election, campaign, and legislative/regulatory data via [xref: political-science]; cross-national and cultural datasets via [xref: anthropology] and [xref: sociology].",
  },
};

// ────────────────────────────────────────────────────────────────────────────
// KaTeX rendering helpers (text-only; math is rare here but supported)
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

function plainText(text: string): string {
  return text.replace(/\$([^$]+)\$/g, "$1");
}

function MathFragment({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderInlineMath(text), [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ────────────────────────────────────────────────────────────────────────────
// Filter / search — every textual field flows through plainText()
// ────────────────────────────────────────────────────────────────────────────

function entryMatches(entry: CommEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.description.toLowerCase().includes(q)) return true;
  if (plainText(entry.principle).toLowerCase().includes(q)) return true;
  if (entry.lineage && entry.lineage.toLowerCase().includes(q)) return true;
  if (entry.figures && entry.figures.toLowerCase().includes(q)) return true;
  if (entry.era && entry.era.toLowerCase().includes(q)) return true;
  if (entry.example && plainText(entry.example).toLowerCase().includes(q)) return true;
  if (entry.critiques && entry.critiques.toLowerCase().includes(q)) return true;
  if (entry.tags.some((t) => t.toLowerCase().includes(q))) return true;
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Xref badges
// ────────────────────────────────────────────────────────────────────────────

function XrefBadges({ entry }: { entry: CommEntry }) {
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
// Utilities
// ────────────────────────────────────────────────────────────────────────────

function slugifyEntry(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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
  entry: CommEntry;
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
        <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Principle</span>
        <MathFragment text={entry.principle} />
      </div>
      {(entry.figures || entry.era) && (
        <div className="mt-1 text-xs text-gray-400 leading-relaxed flex flex-wrap gap-x-4">
          {entry.figures && (
            <span>
              <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-1">Figures</span>
              {entry.figures}
            </span>
          )}
          {entry.era && (
            <span>
              <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-1">Era</span>
              {entry.era}
            </span>
          )}
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 -mx-4 -mb-3 px-4 pb-4 border-t border-gray-700/70 bg-gray-900/80 rounded-b space-y-3">
          {entry.lineage && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Lineage</p>
              <p className="mt-1 text-xs text-gray-300 leading-relaxed">{entry.lineage}</p>
            </div>
          )}
          {entry.example && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Example / note</p>
              <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                <MathFragment text={entry.example} />
              </p>
            </div>
          )}
          {entry.critiques && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-500">Principal critiques</p>
              <p className="mt-1 text-xs text-gray-300 leading-relaxed border-l-2 border-amber-900/60 pl-3 italic">
                {entry.critiques}
              </p>
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
  filteredEntries: CommEntry[];
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

function SectionHeader({ section, count, familyCount }: { section: Section; count: number; familyCount: number }) {
  const info = SECTION_INFO[section];
  return (
    <div className="border-b border-gray-800/60 pb-2 pt-4 first:pt-0">
      <h2 className="text-sm font-semibold text-gray-300 tracking-wide">{info.name}</h2>
      <p className="text-xs text-gray-500 mt-0.5">
        {info.tagline} · {familyCount} families · {count} entries
      </p>
      <p className="text-[11px] text-gray-600 mt-1 italic">{info.dataSource}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

const ALL_SLUGS = ALL_FAMILIES.map((f) => f.slug);
const ALL_SECTIONS: Section[] = ["A", "B", "C", "D", "E", "F"];

export default function CommunicationPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

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
  const bySection: Record<Section, { family: Family; entries: CommEntry[] }[]> = {
    A: [], B: [], C: [], D: [], E: [], F: [],
  };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionEntryCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  const sectionFamilyCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  for (const fam of ALL_FAMILIES) {
    sectionEntryCounts[fam.section] += fam.entries.length;
    sectionFamilyCounts[fam.section] += 1;
  }

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Communication &amp; Media Studies — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to communication and media studies organized into {ALL_FAMILIES.length} families across
          six sections — Foundational Models &amp; Theory; Interpersonal, Group &amp; Organizational; Mass
          Communication &amp; Media-Effects; Semiotics, Rhetoric &amp; Persuasion; Journalism, News &amp; Digital /
          Networked Media; and Media Economics, Political &amp; Intercultural. Every card carries a{" "}
          <em>principle</em> — the central claim of the theory or concept in a neutral voice — and theory entries
          additionally carry <em>lineage</em>, <em>figures</em>, and <em>era</em>. Color codes the section; clicking
          a header collapses it; clicking a card expands it.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Cross-references: entries marked <span className="font-mono">xref</span> link to sibling taxonomies —{" "}
          {/* /political-science has no page yet — plain text until the taxonomy is built */}
          <span className="text-blue-300">political-science</span>,{" "}
          <Link href="/sociology" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">sociology</Link>,{" "}
          <Link href="/psychology" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">psychology</Link>,{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">statistics</Link>,{" "}
          <Link href="/linguistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">linguistics</Link>,{" "}
          <Link href="/philosophy" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">philosophy</Link>,{" "}
          <Link href="/law" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">law</Link>, and others —
          rather than duplicating.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Neutrality mandate:</span> every theory and practice is described as its
          proponents would, without editorializing adjectives. All evaluation is confined to a labeled{" "}
          <em>principal critiques</em> field inside each expansion. Genuine disputes (the magnitude of media effects,
          whether filter bubbles/echo chambers are empirically real, whether journalistic objectivity is achievable,
          what counts as &ldquo;misinformation,&rdquo; whether media/communication is its own discipline) are stated
          evenhandedly, not adjudicated. Propaganda techniques, computational propaganda, dark patterns, deepfakes,
          and micro-targeting are described at the level of concept, detection, and countermeasure — not as an
          operational how-to.
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_SECTIONS.length} sections · {ALL_FAMILIES.length} families · {totalEntries} entries
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
        </p>
      </div>

      {/* Filter / controls */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, principle, lineage, figures, tag — e.g. 'agenda-setting', 'cultivation', 'two-step flow', 'spiral of silence'"
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
      <FieldGuideBanner domain="Communication & Media Studies" className="mb-2" />
          {ALL_SECTIONS.map((sec) => {
            const items = bySection[sec];
            if (items.length === 0) return null;
            return (
              <div key={sec} className="space-y-4">
                <SectionHeader
                  section={sec}
                  count={sectionEntryCounts[sec]}
                  familyCount={sectionFamilyCounts[sec]}
                />
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

      <LiveResearchCard slug="communication" />

      <div className="border-t border-gray-800 pt-6 mt-12 space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Note:</span> the &ldquo;search&rdquo; link on each card runs a free-text
          search over claim and source text. A term appearing in a claim does not mean the claim is <em>about</em>{" "}
          that concept — only that the term is present. A claim-powered explorer that links communication theories
          and concepts to the specific receipts that cite them is on the roadmap.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Volatile-facts note:</span> platform-regulation and platform-market
          entries touch material that moves quickly. As of mid-2026, the US TikTok divestiture required by the 2024
          law resolved into a US joint venture (&ldquo;TikTok USDS&rdquo;) that went live in January 2026, with
          ByteDance retaining a ~19.9% minority stake and Oracle/Silver Lake/MGX as lead investors; compliance with
          the divestiture law is itself disputed. The EU Digital Services Act (DSA) is in force; in 2026 the
          Commission refined its &ldquo;active-recipient&rdquo; counting methodology, sweeping several previously-exempt
          mid-tier platforms into Very-Large-Online-Platform (VLOP) obligations. Both are presented as moving; re-verify
          counts, stakes, and designations before citing. Reports of inaccuracy welcome via the{" "}
          <Link href="/feedback" className="underline underline-offset-2">feedback</Link> page.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Roadmap:</span> claim cross-references pending. A media-effects theory
          lineage / influence DAG — nodes marked <span className="font-mono">node</span> in the tags, edges taken
          from the <em>lineage</em> fields, organized along the strong-effects → limited-effects →
          moderate/cumulative → active-audience/networked spine — is a documented follow-up, to reuse the existing
          Edges model already backing the ideologies and political-science DAGs.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-07-03 · last updated: 2026-07-03 · KaTeX typesetting available · claim cross-references pending
        </p>
      </div>
      <div className="border-t border-gray-700/40 pt-6 mt-4">
        <p className="text-[11px] font-mono uppercase tracking-widest text-gray-600 mb-2">Discover related claims in the graph</p>
        <div className="flex flex-wrap gap-4">
          <a href="/search?q=communication+media" className="text-xs text-sky-400/70 hover:text-sky-300 transition-colors font-mono">
            Search Communication & Media Studies in the claim graph →
          </a>
          <a href="/settling-curve" className="text-xs text-amber-400/50 hover:text-amber-300 transition-colors font-mono">
            Browse all trajectories →
          </a>
        </div>
      </div>
    </div>
  );
}
