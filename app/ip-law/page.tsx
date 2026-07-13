"use client";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DomainStatusBadge } from "@/components/DomainStatusBadge";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { IpEntry, ColorKey, Family, Section } from "./types";
import { FAMILIES_1_7 } from "./data";
import { FAMILIES_8_14 } from "./data2";
import { FAMILIES_15_20 } from "./data3";

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
  orange:  { headerBg: "bg-orange-950/40",  headerBorder: "border-orange-900",  headerText: "text-orange-200",  chipBg: "bg-orange-950/60",  chipText: "text-orange-300",  cardBorder: "border-orange-950/70",  cardHover: "hover:border-orange-700",  accent: "text-orange-400" },
  rose:    { headerBg: "bg-rose-950/40",    headerBorder: "border-rose-900",    headerText: "text-rose-200",    chipBg: "bg-rose-950/60",    chipText: "text-rose-300",    cardBorder: "border-rose-950/70",    cardHover: "hover:border-rose-700",    accent: "text-rose-400" },
  red:     { headerBg: "bg-red-950/40",     headerBorder: "border-red-900",     headerText: "text-red-200",     chipBg: "bg-red-950/60",     chipText: "text-red-300",     cardBorder: "border-red-950/70",     cardHover: "hover:border-red-700",     accent: "text-red-400" },
  pink:    { headerBg: "bg-pink-950/40",    headerBorder: "border-pink-900",    headerText: "text-pink-200",    chipBg: "bg-pink-950/60",    chipText: "text-pink-300",    cardBorder: "border-pink-950/70",    cardHover: "hover:border-pink-700",    accent: "text-pink-400" },
  fuchsia: { headerBg: "bg-fuchsia-950/40", headerBorder: "border-fuchsia-900", headerText: "text-fuchsia-200", chipBg: "bg-fuchsia-950/60", chipText: "text-fuchsia-300", cardBorder: "border-fuchsia-950/70", cardHover: "hover:border-fuchsia-700", accent: "text-fuchsia-400" },
};

const SECTION_INFO: Record<Section, { name: string; tagline: string }> = {
  A: { name: "Section A — Foundations & IP Taxonomy", tagline: "Theoretical basis of IP rights — Lockean, utilitarian, and personality theories — plus the statutory and treaty framework and the map of IP's branches." },
  B: { name: "Section B — Patent Law", tagline: "Patent eligibility, prosecution, patentable subject matter, and infringement litigation — utility, design, and plant patents." },
  C: { name: "Section C — Copyright & Related Rights", tagline: "Copyright basics, exclusive rights, fair use, DMCA safe harbors, first sale, and neighboring rights including sound recordings and moral rights." },
  D: { name: "Section D — Trademark Law", tagline: "Distinctiveness spectrum, likelihood of confusion, dilution, cybersquatting, and trademark prosecution and maintenance." },
  E: { name: "Section E — Trade Secrets, International & Emerging IP", tagline: "Trade secrets, right of publicity, open source licensing, FRAND, international frameworks, industry-specific IP, and the open questions of the AI era." },
};

// ────────────────────────────────────────────────────────────────────────────
// Filter / search
// ────────────────────────────────────────────────────────────────────────────

function entryMatches(entry: IpEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.description.toLowerCase().includes(q)) return true;
  if (entry.keyPrinciple.toLowerCase().includes(q)) return true;
  if (entry.citation && entry.citation.toLowerCase().includes(q)) return true;
  if (entry.example && entry.example.toLowerCase().includes(q)) return true;
  if (entry.tags.some((t) => t.toLowerCase().includes(q))) return true;
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Xref & status badges
// ────────────────────────────────────────────────────────────────────────────

function XrefBadges({ entry }: { entry: IpEntry }) {
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

function EntryCard({
  entry,
  family,
  expanded,
  onToggle,
}: {
  entry: IpEntry;
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
        <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Key principle</span>
        {entry.keyPrinciple}
      </div>
      {entry.citation && (
        <div className="mt-1 text-xs text-gray-400 leading-relaxed italic">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2 not-italic">Citation</span>
          {entry.citation}
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
  filteredEntries: IpEntry[];
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

export default function IpLawPage() {
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

  const bySection: Record<Section, { family: Family; entries: IpEntry[] }[]> = { A: [], B: [], C: [], D: [], E: [] };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Intellectual Property Law — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to intellectual property law organized into {ALL_FAMILIES.length} families across five sections —
          Foundations &amp; IP Taxonomy, Patent Law, Copyright &amp; Related Rights, Trademark Law, and Trade Secrets,
          International &amp; Emerging IP. Each card carries a <em>key principle</em>, where relevant a{" "}
          <em>citation</em>, and an <em>example</em>.
          Entries marked <strong>OPEN</strong> are unresolved doctrinal questions;{" "}
          <strong>CONTESTED</strong> indicates doctrine that is disputed or politically unstable;{" "}
          <strong>LANDMARK</strong> marks decisions that define the field.
          Entries in Section E that cover AI training data, authorship, and deepfakes should be{" "}
          <em>verified at build time</em> — litigation in these areas is moving rapidly.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Cross-references: entries marked <span className="font-mono">xref</span> link to{" "}
          <Link href="/law" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">law</Link>,{" "}
          <Link href="/governance" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">governance</Link>,{" "}
          <Link href="/economics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">economics</Link>,{" "}
          <Link href="/finance" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">finance</Link>, or{" "}
          <Link href="/computer-science" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">computer science</Link>{" "}
          rather than duplicating. This page is U.S.-law-primary with substantial international coverage;
          see Section E — International for treaty frameworks.
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries
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
          placeholder="Filter — e.g. 'fair use', 'Alice', 'FRAND', 'trade secret', 'TRIPS', 'Myriad'"
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
      <FieldGuideBanner domain="Intellectual Property Law" className="mb-2" />
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
          <span className="text-gray-400">Volatile facts and verify-at-build entries:</span> entries in Section E
          marked <span className="text-red-300 font-mono">OPEN</span> — particularly AI training data fair use,
          AI authorship, right-of-publicity deepfake statutes, §101 legislative reform, and the Loper Bright
          administrative deference ruling — are actively litigated or legislated as of 2026. Verify case status
          before relying on these entries. Disputed doctrine (notably &ldquo;Blurred Lines&rdquo; and initial interest
          confusion) is marked <span className="text-amber-300 font-mono">CONTESTED</span>.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Neutrality note:</span> this taxonomy is U.S.-primary. Doctrinal debates
          (patent eligibility scope, FRAND rate-setting, right of publicity breadth, AI copyright) are presented
          neutrally — both sides of each dispute are noted without adjudicating the policy question.
          Reports of inaccuracy welcome via the{" "}
          <Link href="/feedback" className="underline underline-offset-2">feedback</Link> page.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-04 · {ALL_FAMILIES.length} families · {totalEntries} entries
        </p>
      </div>
      <div className="border-t border-gray-700/40 pt-6 mt-4">
        <p className="text-[11px] font-mono uppercase tracking-widest text-gray-600 mb-2">Discover related claims in the graph</p>
        <div className="flex flex-wrap gap-4">
          <a href="/search?q=intellectual+property" className="text-xs text-sky-400/70 hover:text-sky-300 transition-colors font-mono">
            Search Intellectual Property Law in the claim graph →
          </a>
          <a href="/settling-curve" className="text-xs text-amber-400/50 hover:text-amber-300 transition-colors font-mono">
            Browse all trajectories →
          </a>
        </div>
      </div>
    </div>
  );
}
