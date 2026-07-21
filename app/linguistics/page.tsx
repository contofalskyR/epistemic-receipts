"use client";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DomainStatusBadge } from "@/components/DomainStatusBadge";

import { useMemo, useState } from "react";
import Link from "next/link";
import katex from "katex";
import "katex/dist/katex.min.css";

import type { LingEntry, ColorKey, Family, Section, IpaSymbol } from "./types";
import { FAMILIES_1_8 } from "./data";
import { FAMILIES_9_16 } from "./data2";
import { FAMILIES_17_22 } from "./data3";
import {
  IPA_SYMBOLS,
  CONSONANT_PLACES,
  CONSONANT_MANNERS,
  VOWEL_HEIGHTS,
  VOWEL_BACKNESS,
  LANGUAGE_FAMILIES,
  CATEGORY_STYLES,
} from "./ipa";

const ALL_FAMILIES: Family[] = [...FAMILIES_1_8, ...FAMILIES_9_16, ...FAMILIES_17_22];

// ────────────────────────────────────────────────────────────────────────────
// Color palettes (same swatches as physics/chemistry)
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
  A: { name: "Section A — Core Levels", tagline: "Phonetics, phonology, morphology, syntax — the architecture of grammar." },
  B: { name: "Section B — Meaning", tagline: "Semantics and pragmatics — how language conveys content." },
  C: { name: "Section C — Language in Use & Mind", tagline: "Historical, sociolinguistic, psycholinguistic, neurolinguistic, computational, acquisition." },
  D: { name: "Section D — Applied, Discourse, Writing, Sign, Typology", tagline: "Language across cultures, modalities, and human applications." },
  E: { name: "Section E — Formal Foundations & Open Questions", tagline: "Mathematical models, history, and the unsolved problems of linguistics." },
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

function entryMatches(entry: LingEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.description.toLowerCase().includes(q)) return true;
  if (plainText(entry.keyFact).toLowerCase().includes(q)) return true;
  if (entry.notation && plainText(entry.notation).toLowerCase().includes(q)) return true;
  if (entry.example && plainText(entry.example).toLowerCase().includes(q)) return true;
  if (entry.tags.some((t) => t.toLowerCase().includes(q))) return true;
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Xref & status badges
// ────────────────────────────────────────────────────────────────────────────

function XrefBadges({ entry }: { entry: LingEntry }) {
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
  entry: LingEntry;
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
      {entry.notation && (
        <div className="mt-1 text-xs text-gray-300 leading-relaxed">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Notation</span>
          <MathExpr expr={entry.notation} />
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

function FamilySection({
  family,
  filteredEntries,
  collapsed,
  onToggleCollapse,
  expanded,
  setExpanded,
}: {
  family: Family;
  filteredEntries: LingEntry[];
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
// IPA chart — interactive
// ────────────────────────────────────────────────────────────────────────────

const IPA_CELL = 34;
const IPA_GAP = 2;

function IpaConsonantChart({ onSelect, selectedIpa }: { onSelect: (s: IpaSymbol) => void; selectedIpa: string | null }) {
  const cellFor = (manner: string, place: string, voicing: "voiceless" | "voiced") =>
    IPA_SYMBOLS.find(
      (s) => s.type === "consonant" && s.category === manner && s.place === place && s.voicing === voicing,
    );

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse" style={{ fontFamily: "ui-monospace, monospace" }}>
        <thead>
          <tr>
            <th className="text-[10px] text-gray-500 font-normal text-right pr-2 align-bottom">manner ↓ / place →</th>
            {CONSONANT_PLACES.map((p) => (
              <th key={p} className="text-[9px] text-gray-500 font-normal px-1 pb-1 align-bottom" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CONSONANT_MANNERS.map((manner) => {
            const s = CATEGORY_STYLES[manner];
            return (
              <tr key={manner}>
                <td className="text-[10px] text-gray-400 text-right pr-2 whitespace-nowrap">{s?.label ?? manner}</td>
                {CONSONANT_PLACES.map((place) => {
                  const vlIcon = cellFor(manner, place, "voiceless");
                  const vdIcon = cellFor(manner, place, "voiced");
                  return (
                    <td key={place} className="p-0" style={{ width: IPA_CELL * 2, minWidth: IPA_CELL * 2 }}>
                      <div className="flex gap-[1px]">
                        {[vlIcon, vdIcon].map((cell, idx) =>
                          cell ? (
                            <button
                              key={idx}
                              onClick={() => onSelect(cell)}
                              title={`${cell.ipa} — ${cell.name}`}
                              style={{
                                width: IPA_CELL,
                                height: IPA_CELL,
                                background: s?.bg ?? "#3b4252",
                                border: `1px solid ${cell.ipa === selectedIpa ? "#ffffff" : s?.border ?? "#4c566a"}`,
                                color: s?.text ?? "#eceff4",
                                boxShadow: cell.ipa === selectedIpa ? "0 0 0 2px #ffffff66" : undefined,
                                cursor: "pointer",
                              }}
                              className="flex items-center justify-center text-base"
                            >
                              {cell.ipa}
                            </button>
                          ) : (
                            <div key={idx} style={{ width: IPA_CELL, height: IPA_CELL, background: "#0b0d11", border: "1px solid #1a1d23" }} />
                          ),
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[10px] text-gray-500 mt-2">Left cell in each pair = voiceless; right = voiced. Empty cells mark articulations judged impossible.</p>
    </div>
  );
}

function IpaVowelChart({ onSelect, selectedIpa }: { onSelect: (s: IpaSymbol) => void; selectedIpa: string | null }) {
  // Render vowels as a trapezoid grid: height (rows) × backness (cols); each cell has unrounded/rounded pair.
  const cellFor = (height: string, backness: string, rounded: boolean) =>
    IPA_SYMBOLS.find((s) => s.type === "vowel" && s.height === height && s.backness === backness && s.rounded === rounded);

  const s = CATEGORY_STYLES.vowel;
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse" style={{ fontFamily: "ui-monospace, monospace" }}>
        <thead>
          <tr>
            <th className="text-[10px] text-gray-500 font-normal text-right pr-2 align-bottom">height ↓ / backness →</th>
            {VOWEL_BACKNESS.map((b) => (
              <th key={b} className="text-[10px] text-gray-500 font-normal px-2 pb-1">{b}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {VOWEL_HEIGHTS.map((h) => (
            <tr key={h}>
              <td className="text-[10px] text-gray-400 text-right pr-2 whitespace-nowrap">{h}</td>
              {VOWEL_BACKNESS.map((b) => {
                const unrounded = cellFor(h, b, false);
                const rounded = cellFor(h, b, true);
                return (
                  <td key={b} className="p-0" style={{ width: IPA_CELL * 2, minWidth: IPA_CELL * 2 }}>
                    <div className="flex gap-[1px]">
                      {[unrounded, rounded].map((cell, idx) =>
                        cell ? (
                          <button
                            key={idx}
                            onClick={() => onSelect(cell)}
                            title={`${cell.ipa} — ${cell.name}`}
                            style={{
                              width: IPA_CELL,
                              height: IPA_CELL,
                              background: s.bg,
                              border: `1px solid ${cell.ipa === selectedIpa ? "#ffffff" : s.border}`,
                              color: s.text,
                              boxShadow: cell.ipa === selectedIpa ? "0 0 0 2px #ffffff66" : undefined,
                              cursor: "pointer",
                            }}
                            className="flex items-center justify-center text-base"
                          >
                            {cell.ipa}
                          </button>
                        ) : (
                          <div key={idx} style={{ width: IPA_CELL, height: IPA_CELL, background: "#0b0d11", border: "1px solid #1a1d23" }} />
                        ),
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-gray-500 mt-2">Left cell = unrounded; right = rounded.</p>
    </div>
  );
}

function IpaSpecials({ onSelect, selectedIpa }: { onSelect: (s: IpaSymbol) => void; selectedIpa: string | null }) {
  const specials = IPA_SYMBOLS.filter((s) => s.category === "click" || s.category === "implosive");
  const s = CATEGORY_STYLES.click;
  if (specials.length === 0) return null;
  return (
    <div className="space-y-2">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Non-pulmonic (clicks · implosives)</p>
        <div className="flex flex-wrap gap-1">
          {specials.map((cell) => (
            <button
              key={cell.ipa}
              onClick={() => onSelect(cell)}
              title={`${cell.ipa} — ${cell.name}`}
              style={{
                width: IPA_CELL,
                height: IPA_CELL,
                background: s.bg,
                border: `1px solid ${cell.ipa === selectedIpa ? "#ffffff" : s.border}`,
                color: s.text,
                boxShadow: cell.ipa === selectedIpa ? "0 0 0 2px #ffffff66" : undefined,
                cursor: "pointer",
              }}
              className="flex items-center justify-center text-base"
            >
              {cell.ipa}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function IpaDetail({ symbol }: { symbol: IpaSymbol }) {
  const s = CATEGORY_STYLES[symbol.category];
  return (
    <div className="rounded border p-4 space-y-2" style={{ borderColor: s.border, background: `${s.bg}80` }}>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: s.text }}>
            {s.label} · {symbol.type}
          </p>
          <h3 className="text-2xl font-semibold text-white">
            [{symbol.ipa}]{" "}
            <span className="text-gray-400 font-mono text-base">{symbol.name}</span>
          </h3>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white font-mono">{symbol.ipa}</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">IPA symbol</div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        {symbol.type === "consonant" && (
          <>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Place</p>
              <p className="text-gray-200 font-mono">{symbol.place ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Manner</p>
              <p className="text-gray-200 font-mono">{s.label}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Voicing</p>
              <p className="text-gray-200 font-mono">{symbol.voicing ?? "—"}</p>
            </div>
          </>
        )}
        {symbol.type === "vowel" && (
          <>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Height</p>
              <p className="text-gray-200 font-mono">{symbol.height ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Backness</p>
              <p className="text-gray-200 font-mono">{symbol.backness ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Rounding</p>
              <p className="text-gray-200 font-mono">{symbol.rounded ? "rounded" : "unrounded"}</p>
            </div>
          </>
        )}
      </div>
      <p className="text-[12px] text-gray-200 leading-snug border-l-2 border-gray-700 pl-3 mt-1">{symbol.description}</p>
      <p className="text-[11px] text-gray-400 leading-snug">
        <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Example</span>
        {symbol.example}
      </p>
      <div className="flex gap-2 pt-1">
        <Link
          href={`/search?q=${encodeURIComponent(symbol.name)}`}
          className="text-[11px] font-mono text-gray-400 hover:text-white underline underline-offset-2"
        >
          search receipts →
        </Link>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Language family tree (collapsible accordion)
// ────────────────────────────────────────────────────────────────────────────

function formatSpeakers(n: number): string {
  if (n === 0) return "extinct/classical";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function LanguageFamilyTree() {
  const [openFamily, setOpenFamily] = useState<string | null>("indo-european");
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-500">
        Major language families with speaker counts. Click a family to expand its branches and member languages. Speaker
        figures are approximate (L1 + L2, Ethnologue-style; rounded).
      </p>
      <div className="space-y-1">
        {LANGUAGE_FAMILIES.map((f) => {
          const isOpen = openFamily === f.slug;
          return (
            <div key={f.slug} className="rounded border border-gray-800 overflow-hidden">
              <button
                onClick={() => setOpenFamily(isOpen ? null : f.slug)}
                className="w-full text-left px-4 py-2 bg-gray-900/50 hover:bg-gray-800/60 transition-colors flex items-baseline justify-between gap-3"
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-100">
                    <span className="text-xs font-mono text-gray-500 mr-2">{isOpen ? "▾" : "▸"}</span>
                    {f.name}
                  </h3>
                  {f.notes && <p className="mt-0.5 text-[11px] text-gray-500 leading-snug">{f.notes}</p>}
                </div>
                <span className="text-xs font-mono text-gray-400 shrink-0">~{formatSpeakers(f.approxSpeakers)} speakers</span>
              </button>
              {isOpen && (
                <div className="bg-gray-950/40 p-3 space-y-2">
                  {f.branches.map((br) => (
                    <div key={br.name}>
                      <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">{br.name}</p>
                      <div className="flex flex-wrap gap-1">
                        {br.languages.map((l) => (
                          <span
                            key={l.name}
                            title={`${l.name} (${l.iso639 ?? "—"}) — ${l.speakers ? formatSpeakers(l.speakers) + " speakers" : "n/a"}${l.notes ? " — " + l.notes : ""}`}
                            className="text-[11px] px-2 py-0.5 rounded bg-gray-900/70 border border-gray-800 text-gray-300 font-mono hover:border-gray-600"
                          >
                            {l.name}
                            {l.speakers && l.speakers > 0 && (
                              <span className="text-gray-600 ml-1">{formatSpeakers(l.speakers)}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Word-order typology explorer
// ────────────────────────────────────────────────────────────────────────────

type WordOrder = "SOV" | "SVO" | "VSO" | "VOS" | "OVS" | "OSV";

const WORD_ORDER_DATA: { order: WordOrder; pct: number; examples: string[] }[] = [
  { order: "SOV", pct: 45, examples: ["Japanese", "Korean", "Turkish", "Hindi-Urdu", "Latin"] },
  { order: "SVO", pct: 42, examples: ["English", "Mandarin", "Spanish", "French", "Russian"] },
  { order: "VSO", pct: 9, examples: ["Classical Arabic", "Welsh", "Irish", "Hawaiian"] },
  { order: "VOS", pct: 3, examples: ["Malagasy", "Tagalog (Austronesian)"] },
  { order: "OVS", pct: 1, examples: ["Hixkaryana"] },
  { order: "OSV", pct: 1, examples: ["Xavante", "constructed: Yoda"] },
];

function WordOrderExplorer() {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-500">
        Basic word order in transitive sentences. The two-way split between SOV and SVO accounts for ~87% of all languages;
        the rare V-initial and O-initial orders together total under ~13%. Greenberg-style typological cross-correlations
        (adposition, AdjN, GenN order) cluster around this axis.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {WORD_ORDER_DATA.map((w) => (
          <div key={w.order} className="rounded border border-gray-800 bg-gray-900/40 p-3">
            <div className="flex items-baseline justify-between">
              <h4 className="text-sm font-semibold text-gray-100 font-mono">{w.order}</h4>
              <span className="text-xs font-mono text-emerald-400">~{w.pct}%</span>
            </div>
            <div className="mt-2 h-1.5 bg-gray-800 rounded overflow-hidden">
              <div className="h-full bg-emerald-700/70" style={{ width: `${w.pct * 2}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-gray-400 leading-snug">{w.examples.join(", ")}</p>
          </div>
        ))}
      </div>
    </div>
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

export default function LinguisticsPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedIpa, setSelectedIpa] = useState<IpaSymbol | null>(null);
  const [showTree, setShowTree] = useState(false);
  const [showWO, setShowWO] = useState(false);

  const filtered = useMemo(() => {
    return ALL_FAMILIES.map((f) => ({
      family: f,
      entries: f.entries.filter((e) => entryMatches(e, query)),
    })).filter((f) => f.entries.length > 0);
  }, [query]);

  const totalEntries = ALL_FAMILIES.reduce((s, f) => s + f.entries.length, 0);
  const matchCount = filtered.reduce((s, f) => s + f.entries.length, 0);
  const totalLanguages = LANGUAGE_FAMILIES.reduce((sum, f) => sum + f.branches.reduce((s, br) => s + br.languages.length, 0), 0);

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

  const bySection: Record<Section, { family: Family; entries: LingEntry[] }[]> = { A: [], B: [], C: [], D: [], E: [] };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Linguistics — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to linguistics organized into {ALL_FAMILIES.length} families across five sections — the core levels
          (phonetics, phonology, morphology, syntax), meaning (semantics, pragmatics), language in use and mind (historical,
          socio, psycho, neuro, computational, acquisition), applied/discourse/writing/sign/typology, and formal foundations
          plus open questions. Each card carries a <em>key fact</em>, optional <em>notation</em> (typeset with KaTeX), and an{" "}
          <em>example</em>. Color codes the family; clicking a header collapses it; clicking a card expands it.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Three headline visualizations sit above the taxonomy: an{" "}
          <strong>interactive IPA chart</strong> (every consonant and vowel clickable to its details), a{" "}
          <strong>language family tree</strong> covering the world&apos;s major families and their speaker counts, and a{" "}
          <strong>word-order typology explorer</strong> showing the SOV/SVO/VSO/VOS/OVS/OSV distribution across the world&apos;s
          languages. Cross-references: entries marked <span className="font-mono">xref</span> link to{" "}
          <Link href="/philosophy" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">philosophy</Link>,{" "}
          <Link href="/computer-science" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">computer-science</Link>,{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">statistics</Link>, or{" "}
          <Link href="/mathematics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">mathematics</Link> instead of duplicating.
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries · {IPA_SYMBOLS.length} IPA symbols · {LANGUAGE_FAMILIES.length} language families · {totalLanguages} languages
          {query && <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>}
        </p>
      </div>

      {/* IPA chart */}
      <section className="rounded-lg border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 bg-gray-900/40 border-b border-gray-800">
          <h2 className="text-base font-semibold text-gray-200">Interactive IPA chart</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            The International Phonetic Alphabet (2020 revision). Consonants organized by manner × place × voicing; vowels by
            height × backness × rounding. Click any cell for articulatory details and a language example. {IPA_SYMBOLS.length} symbols total.
          </p>
        </div>
        <div className="p-4 bg-gray-950/40 space-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Pulmonic consonants</p>
            <IpaConsonantChart onSelect={(s) => setSelectedIpa(s)} selectedIpa={selectedIpa?.ipa ?? null} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Vowels</p>
            <IpaVowelChart onSelect={(s) => setSelectedIpa(s)} selectedIpa={selectedIpa?.ipa ?? null} />
          </div>
          <IpaSpecials onSelect={(s) => setSelectedIpa(s)} selectedIpa={selectedIpa?.ipa ?? null} />
          {selectedIpa && <IpaDetail symbol={selectedIpa} />}
        </div>
      </section>

      {/* Language family tree */}
      <section className="rounded-lg border border-emerald-900 overflow-hidden">
        <button
          onClick={() => setShowTree((v) => !v)}
          className="w-full text-left px-5 py-3 bg-emerald-950/40 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-emerald-200">Language family tree</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              World&apos;s {LANGUAGE_FAMILIES.length} largest families and isolates, with branches and {totalLanguages} member languages.
              Speaker counts are approximate.
            </p>
          </div>
          <span className="text-xs text-emerald-400">{showTree ? "▾" : "▸"}</span>
        </button>
        {showTree && (
          <div className="bg-gray-950/40 p-4">
            <LanguageFamilyTree />
          </div>
        )}
      </section>

      {/* Word order */}
      <section className="rounded-lg border border-teal-900 overflow-hidden">
        <button
          onClick={() => setShowWO((v) => !v)}
          className="w-full text-left px-5 py-3 bg-teal-950/40 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-teal-200">Word-order typology</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Cross-linguistic distribution of basic word order (Greenberg / WALS).
            </p>
          </div>
          <span className="text-xs text-teal-400">{showWO ? "▾" : "▸"}</span>
        </button>
        {showWO && (
          <div className="bg-gray-950/40 p-4">
            <WordOrderExplorer />
          </div>
        )}
      </section>

      {/* Filter / controls */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, key fact, notation, tag — e.g. 'phoneme', 'Grimm', 'transformer', 'Sapir-Whorf'"
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <div className="flex gap-2 text-xs">
          <button onClick={expandAll} className="px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors">Expand all</button>
          <button onClick={collapseAll} className="px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors">Collapse all</button>
          {query && (
            <button onClick={() => setQuery("")} className="px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors">Clear</button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">No entries match &ldquo;{query}&rdquo;. Try a broader term.</p>
      ) : (
        <div className="space-y-8">
      <FieldGuideBanner domain="Linguistics" className="mb-2" />
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
          <span className="text-gray-400">Note:</span> the &ldquo;search&rdquo; link on each card runs a free-text search over claim
          and source text. A term appearing in a claim does not mean the claim is <em>about</em> that concept — only that the term is present.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Open and contested:</span> entries marked{" "}
          <span className="text-red-300 font-mono">OPEN</span> are genuinely unresolved as of 2026 (origin of language, Pirahã recursion,
          Indo-European homeland, LLM linguistic competence). <span className="text-amber-300 font-mono">CONTESTED</span> entries reflect
          live disputes (Sapir-Whorf strong relativity, critical-period sharpness, glottochronology, macro-family hypotheses).
          Speaker counts and language inventories follow Ethnologue 27th ed.; the IPA chart follows the 2020 IPA revision.
          Reports of inaccuracy welcome via the{" "}
          <Link href="/feedback" className="underline underline-offset-2">feedback</Link> page.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-05 · KaTeX typesetting · {ALL_FAMILIES.length} families · {totalEntries} entries · {IPA_SYMBOLS.length} IPA symbols · {totalLanguages} languages across {LANGUAGE_FAMILIES.length} families
        </p>
      </div>
      <div className="border-t border-gray-700/40 pt-6 mt-4">
        <p className="text-[11px] font-mono uppercase tracking-widest text-gray-600 mb-2">Discover related claims in the graph</p>
        <div className="flex flex-wrap gap-4">
          <a href="/search?q=linguistics" className="text-xs text-sky-400/70 hover:text-sky-300 transition-colors font-mono">
            Search Linguistics in the claim graph →
          </a>
          <Link href="/settling-curve" className="text-xs text-amber-400/50 hover:text-amber-300 transition-colors font-mono">
            Browse all trajectories →
          </Link>
        </div>
      </div>
    </div>
  );
}
