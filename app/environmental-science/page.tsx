"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import katex from "katex";
import "katex/dist/katex.min.css";

import type { ColorKey, EnvEntry, Family, Section } from "./types";
import { FAMILIES_1_6 } from "./data";
import { FAMILIES_7_12 } from "./data2";
import { FAMILIES_13_18 } from "./data3";
import { LiveResearchCard } from "@/components/LiveResearchCard";

const ALL_FAMILIES: Family[] = [...FAMILIES_1_6, ...FAMILIES_7_12, ...FAMILIES_13_18];

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
  A: { name: "Section A — Ecology: Populations, Communities & Ecosystems", tagline: "The core science of how organisms interact with each other and their environment, at three scales." },
  B: { name: "Section B — Biodiversity, Biogeography & Conservation", tagline: "Measuring life's variety, explaining its geographic pattern, and preventing its loss." },
  C: { name: "Section C — Biogeochemical Cycles", tagline: "How the elements essential to life move between air, water, rock, and organisms — and how humans have perturbed each cycle." },
  D: { name: "Section D — Climate Science & the Atmosphere", tagline: "The physical science of Earth's climate system and human-caused change, presented as the mainstream scientific consensus." },
  E: { name: "Section E — Environmental Chemistry, Pollution & Toxicology", tagline: "The chemistry of contaminants in air, water, and soil, and the science of how they harm living systems." },
  F: { name: "Section F — Earth Systems & the Physical Environment", tagline: "Soil, water, land, and Earth's history as a planetary system — heavy cross-linking to earth sciences." },
  G: { name: "Section G — Sustainability, Environmental Economics & Policy", tagline: "Managing the human–environment relationship — economics of resources and externalities, law and governance." },
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

// Render a raw KaTeX expression (Definition/formula field is a bare LaTeX expression).
function renderFormula(expr: string): string {
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

function FormulaExpr({ expr, className }: { expr: string; className?: string }) {
  const html = useMemo(() => renderFormula(expr), [expr]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ────────────────────────────────────────────────────────────────────────────
// Filter / search
// ────────────────────────────────────────────────────────────────────────────

function entryMatches(entry: EnvEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.description.toLowerCase().includes(q)) return true;
  if (entry.principle && plainText(entry.principle).toLowerCase().includes(q)) return true;
  if (entry.formula && plainText(entry.formula).toLowerCase().includes(q)) return true;
  if (entry.interpretation && plainText(entry.interpretation).toLowerCase().includes(q)) return true;
  if (entry.example && plainText(entry.example).toLowerCase().includes(q)) return true;
  if (entry.critiques && plainText(entry.critiques).toLowerCase().includes(q)) return true;
  if (entry.tags.some((t) => t.toLowerCase().includes(q))) return true;
  if (entry.xref?.some((x) => x.toLowerCase().includes(q))) return true;
  return false;
}

function slugifyEntry(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ────────────────────────────────────────────────────────────────────────────
// Badges
// ────────────────────────────────────────────────────────────────────────────

function XrefBadges({ entry }: { entry: EnvEntry }) {
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

function StatusBadge({ entry }: { entry: EnvEntry }) {
  if (!entry.status) return null;
  if (entry.status === "open") {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-300 font-mono border border-red-900/60">OPEN</span>
    );
  }
  if (entry.status === "contested") {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 font-mono border border-amber-900/60">CONTESTED</span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-950/60 text-green-300 font-mono border border-green-900/60">RESOLVED</span>
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
  entry: EnvEntry;
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
      {entry.principle && (
        <div className="mt-2 text-xs text-gray-300 leading-relaxed">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Principle</span>
          <MathFragment text={entry.principle} />
        </div>
      )}
      {entry.formula && (
        <div className="mt-2 text-xs text-gray-300 leading-relaxed">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Definition / formula</span>
          <FormulaExpr expr={entry.formula} />
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 -mx-4 -mb-3 px-4 pb-4 border-t border-gray-700/70 bg-gray-900/80 rounded-b space-y-3">
          {entry.interpretation && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Interpretation</p>
              <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                <MathFragment text={entry.interpretation} />
              </p>
            </div>
          )}
          {entry.example && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Example</p>
              <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                <MathFragment text={entry.example} />
              </p>
            </div>
          )}
          {entry.critiques && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-400/80">Principal critiques</p>
              <p className="mt-1 text-xs text-gray-300 leading-relaxed border-l-2 border-amber-900/60 pl-3">
                <MathFragment text={entry.critiques} />
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
  filteredEntries: EnvEntry[];
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
const SECTIONS: Section[] = ["A", "B", "C", "D", "E", "F", "G"];

export default function EnvironmentalSciencePage() {
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

  const bySection: Record<Section, { family: Family; entries: EnvEntry[] }[]> = {
    A: [], B: [], C: [], D: [], E: [], F: [], G: [],
  };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Environmental Science &amp; Ecology — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to environmental science and ecology organized into {ALL_FAMILIES.length} families
          across seven sections — from population, community, and ecosystem ecology, through the biogeochemical
          cycles, climate science, environmental chemistry, pollution and toxicology, and the earth systems,
          to sustainability, environmental economics, and policy. Each card carries either a{" "}
          <em>Principle</em> (for concepts and systems) or a <em>Definition/formula</em> (for the quantitative
          laws — logistic growth, Lotka–Volterra, Shannon diversity, species–area, residence time, GWP, LD50),
          typeset with KaTeX; contested policy and method entries carry a labeled{" "}
          <em>principal critiques</em> field that lives only in the expansion and holds all evaluation.
          Color codes the section; clicking a header collapses it; clicking a card expands it.
        </p>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          Environmental science is an <strong>interdisciplinary systems science</strong> — it borrows the
          organism-level mechanisms from{" "}
          <Link href="/biology" className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200">biology</Link>{" "}
          and{" "}
          <Link href="/physiology" className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200">physiology</Link>,
          the atmospheric and reactive chemistry from{" "}
          <Link href="/chemistry" className="text-violet-300 underline underline-offset-2 hover:text-violet-200">chemistry</Link>,
          the deep-time and tectonic framing from{" "}
          <Link href="/geology" className="text-amber-300 underline underline-offset-2 hover:text-amber-200">geology</Link>{" "}
          and{" "}
          <Link href="/earth-sciences" className="text-amber-300 underline underline-offset-2 hover:text-amber-200">earth sciences</Link>,
          the estimators from{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">statistics</Link>,
          and the discounting, externality, and policy machinery from{" "}
          <Link href="/economics" className="text-rose-300 underline underline-offset-2 hover:text-rose-200">economics</Link>{" "}
          and{" "}
          <Link href="/finance" className="text-rose-300 underline underline-offset-2 hover:text-rose-200">finance</Link>.
          Entries marked <span className="font-mono">xref</span> link to the sibling page rather than duplicating.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          <strong>Climate science reflects the mainstream scientific consensus.</strong> The greenhouse mechanism,
          human attribution of recent warming, and the IPCC's assessment conclusions are stated in the card voice
          as the settled position — not hedged as one side of a debate. What is presented evenhandedly are the
          genuine within-field disputes — equilibrium climate sensitivity, aerosol/cloud feedbacks, the social
          cost of carbon and the discount rate, carbon tax vs cap-and-trade, nuclear's role, degrowth vs green
          growth, and solar-radiation-management geoengineering. Where a boundary or classification is genuinely
          contested (the community/ecosystem line, the Clementsian climax, monetizing ecosystem services, the
          formal <em>Anthropocene</em>), the dispute is stated, not adjudicated.
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries · 7 sections
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
          placeholder="Filter by name, principle, formula, tag — e.g. 'logistic growth', 'Shannon', 'residence time', 'GWP', 'LD50'"
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
          {SECTIONS.map((sec) => {
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

      <LiveResearchCard slug="environmental-science" />

      <div className="border-t border-gray-800 pt-6 mt-12 space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Note:</span> the &ldquo;search&rdquo; link on each card runs a free-text
          search over claim and source text. A term appearing in a claim does not mean the claim is{" "}
          <em>about</em> that concept — only that the term is present. A claim-powered explorer that links
          environmental-science concepts to the specific receipts that cite them is on the roadmap, alongside
          a site-wide knowledge map across all {totalEntries} entries.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Accuracy note:</span> volatile facts as of build time —
          atmospheric CO2 is ~430 ppm (2026 annual-mean forecast ≈ 429.4 ppm at Mauna Loa); the{" "}
          <strong>IPCC AR6 (2021–2023) is the most recent completed assessment</strong>, and the{" "}
          <strong>AR7 cycle</strong> began January 2024 and is drafting through the late 2020s; the{" "}
          <strong>IUCN Red List</strong> has assessed &gt;172,600 species, of which &gt;47,000 are
          threatened (~28%); the most recent UN climate conference was <strong>COP30 in Belém, Brazil
          (November 2025)</strong>, which delivered a climate-finance push and a Just Transition mechanism
          but no formal fossil-fuel phase-out roadmap. All four figures move — re-verify against primary
          sources for citation-quality use. Reports of inaccuracy welcome via the{" "}
          <Link href="/feedback" className="underline underline-offset-2">feedback</Link> page.
        </p>
        <p className="text-xs font-mono text-gray-700">
          last updated: 2026-07-03 · LaTeX typesetting via KaTeX · claim cross-references pending
        </p>
      </div>
    </div>
  );
}
