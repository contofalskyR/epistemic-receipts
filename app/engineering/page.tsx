"use client";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DomainStatusBadge } from "@/components/DomainStatusBadge";

import { useMemo, useState } from "react";
import Link from "next/link";
import katex from "katex";
import "katex/dist/katex.min.css";

import type { EngEntry, ColorKey, Family, Section, Material, MaterialCategory } from "./types";
import { FAMILIES_1_8 } from "./data";
import { FAMILIES_9_16 } from "./data2";
import { FAMILIES_17_24 } from "./data3";
import { MATERIALS, CATEGORY_STYLES } from "./materials";

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
  A: { name: "Section A — Civil & Mechanical Foundations", tagline: "Statics, dynamics, fluids, thermo, structural design, geotech — the load-bearing core of mechanical/civil engineering." },
  B: { name: "Section B — Electrical, Electronic & Software", tagline: "Circuits, EM/RF, signals & control, power systems, computer hardware, and software/systems engineering." },
  C: { name: "Section C — Chemical, Materials & Industrial", tagline: "Chemical process design, materials science, manufacturing, and industrial/operations engineering." },
  D: { name: "Section D — Aerospace, Biomedical, Environmental, Nuclear, Transport", tagline: "Domain branches where engineering meets atmosphere, biology, the environment, the atom, and mobility." },
  E: { name: "Section E — Systems, Ethics & Frontier Problems", tagline: "Systems engineering, reliability, ethics & failure case studies, and the open engineering grand challenges." },
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

function entryMatches(entry: EngEntry, query: string): boolean {
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
// Materials comparison table — interactive feature #1
// ────────────────────────────────────────────────────────────────────────────

type SortKey =
  | "name"
  | "category"
  | "density"
  | "youngsModulus"
  | "tensileStrength"
  | "thermalConductivity"
  | "meltingPoint"
  | "electricalResistivity"
  | "costRank";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Material",
  category: "Class",
  density: "ρ (g/cm³)",
  youngsModulus: "E (GPa)",
  tensileStrength: "σ_t (MPa)",
  thermalConductivity: "k (W/m·K)",
  meltingPoint: "T_m (°C)",
  electricalResistivity: "ρ_e (Ω·m)",
  costRank: "Cost",
};

const ALL_CATEGORIES: MaterialCategory[] = [
  "metal",
  "ceramic",
  "polymer",
  "composite",
  "biological",
  "semiconductor",
];

function formatMaterialValue(m: Material, key: SortKey): string {
  switch (key) {
    case "name":
      return m.name;
    case "category":
      return CATEGORY_STYLES[m.category].label;
    case "density":
      return m.density.toFixed(2);
    case "youngsModulus":
      return m.youngsModulus < 1 ? m.youngsModulus.toFixed(2) : m.youngsModulus.toFixed(0);
    case "tensileStrength":
      return m.tensileStrength.toFixed(0);
    case "thermalConductivity":
      return m.thermalConductivity < 1 ? m.thermalConductivity.toFixed(2) : m.thermalConductivity.toFixed(1);
    case "meltingPoint":
      return m.meltingPoint === null ? "—" : m.meltingPoint.toFixed(0);
    case "electricalResistivity": {
      const r = m.electricalResistivity;
      if (r === 0) return "0";
      const exp = Math.floor(Math.log10(Math.abs(r)));
      const mant = r / Math.pow(10, exp);
      return `${mant.toFixed(1)}×10^${exp}`;
    }
    case "costRank":
      return "$".repeat(m.costRank);
  }
}

function MaterialsTable() {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [activeCats, setActiveCats] = useState<Set<MaterialCategory>>(new Set(ALL_CATEGORIES));
  const [highlight, setHighlight] = useState<Material | null>(null);

  const sorted = useMemo(() => {
    const filtered = MATERIALS.filter((m) => activeCats.has(m.category));
    const cmp = (a: Material, b: Material) => {
      const va = a[sortKey] as number | string | null;
      const vb = b[sortKey] as number | string | null;
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb));
    };
    return [...filtered].sort((a, b) => (sortAsc ? cmp(a, b) : -cmp(a, b)));
  }, [sortKey, sortAsc, activeCats]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(k);
      setSortAsc(true);
    }
  };

  const toggleCat = (c: MaterialCategory) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const headerKeys: SortKey[] = [
    "name",
    "category",
    "density",
    "youngsModulus",
    "tensileStrength",
    "thermalConductivity",
    "meltingPoint",
    "electricalResistivity",
    "costRank",
  ];

  return (
    <div className="space-y-3">
      {/* Category toggles */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        {ALL_CATEGORIES.map((c) => {
          const s = CATEGORY_STYLES[c];
          const active = activeCats.has(c);
          return (
            <button
              key={c}
              onClick={() => toggleCat(c)}
              className="px-2 py-1 rounded font-mono transition-opacity"
              style={{
                background: s.bg,
                border: `1px solid ${active ? s.border : "#374151"}`,
                color: active ? s.text : "#6b7280",
                opacity: active ? 1 : 0.5,
              }}
            >
              {s.label}
            </button>
          );
        })}
        <span className="text-[10px] text-gray-500 ml-auto self-center">
          {sorted.length} of {MATERIALS.length} materials
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-[11px] font-mono">
          <thead>
            <tr className="text-left">
              {headerKeys.map((k) => (
                <th
                  key={k}
                  onClick={() => toggleSort(k)}
                  className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-gray-400 border-b border-gray-700 cursor-pointer hover:text-white select-none whitespace-nowrap"
                  title="Click to sort"
                >
                  {SORT_LABELS[k]}
                  {sortKey === k && <span className="ml-1 text-gray-500">{sortAsc ? "▲" : "▼"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const s = CATEGORY_STYLES[m.category];
              const isHi = highlight?.name === m.name;
              return (
                <tr
                  key={m.name}
                  onMouseEnter={() => setHighlight(m)}
                  onClick={() => setHighlight(isHi ? null : m)}
                  className="border-b border-gray-800/70 hover:bg-gray-900/60 cursor-pointer"
                  style={isHi ? { background: `${s.bg}` } : undefined}
                >
                  {headerKeys.map((k) => (
                    <td
                      key={k}
                      className="px-2 py-1 whitespace-nowrap"
                      style={
                        k === "category"
                          ? { color: s.text }
                          : k === "name"
                          ? { color: "#e5e7eb" }
                          : { color: "#9ca3af" }
                      }
                    >
                      {formatMaterialValue(m, k)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {highlight && (
        <div
          className="rounded border p-3 space-y-1 text-xs"
          style={{ borderColor: CATEGORY_STYLES[highlight.category].border, background: `${CATEGORY_STYLES[highlight.category].bg}80` }}
        >
          <p className="text-[10px] uppercase tracking-widest text-gray-500">
            {CATEGORY_STYLES[highlight.category].label}
          </p>
          <p className="text-white font-semibold">{highlight.name}</p>
          {highlight.notes && <p className="text-gray-300 leading-snug">{highlight.notes}</p>}
          <p className="text-gray-500 text-[10px] mt-1">
            ρ {highlight.density} g/cm³ · E {highlight.youngsModulus} GPa · σ_t {highlight.tensileStrength} MPa · k{" "}
            {highlight.thermalConductivity} W/m·K
          </p>
        </div>
      )}
      <p className="text-[10px] text-gray-500 leading-snug">
        Values are typical room-temperature properties drawn from CES Granta / ASM Handbook / MatWeb ranges; ranges
        within each class are wide, especially for concrete, polymers, and composites. Cost ranks are coarse ($ cheap
        — $$$$$ very expensive on a $/kg basis). Sort by any column; click a row to pin the detail panel.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Engineering design process flowchart — interactive feature #2
// ────────────────────────────────────────────────────────────────────────────

type StageKey =
  | "needs"
  | "requirements"
  | "concept"
  | "preliminary"
  | "detail"
  | "verify"
  | "validate"
  | "deploy"
  | "operate"
  | "retire";

interface Stage {
  key: StageKey;
  label: string;
  blurb: string;
  detail: string;
  family?: string;
}

const STAGES: Stage[] = [
  {
    key: "needs",
    label: "1. Needs / problem definition",
    blurb: "Identify stakeholder needs and constrain the problem.",
    detail:
      "Stakeholder interviews, market analysis, regulatory scan. Output: needs statement and Concept of Operations (ConOps). Cross-references: Systems engineering (Family 22).",
    family: "systems-reliability",
  },
  {
    key: "requirements",
    label: "2. Requirements engineering",
    blurb: "Convert needs into testable functional and non-functional requirements.",
    detail:
      "Functional, performance, interface, environmental, regulatory. Each requirement must be unambiguous, verifiable, traceable. Defects caught here are ~100× cheaper than at code/build.",
    family: "software-systems",
  },
  {
    key: "concept",
    label: "3. Conceptual design",
    blurb: "Generate and trade candidate architectures.",
    detail:
      "Brainstorm, morphological analysis, Pugh matrices, trade studies. Output: preferred concept + rationale. Risks identified here.",
  },
  {
    key: "preliminary",
    label: "4. Preliminary design",
    blurb: "Size the system; lock the architecture.",
    detail:
      "Sizing calculations (heat balance, stress, link budget, mass budget). System-level analyses. Preliminary Design Review (PDR) — the architecture freezes here.",
  },
  {
    key: "detail",
    label: "5. Detailed design",
    blurb: "Drawings, CAD, code, BOM, manufacturing instructions.",
    detail:
      "Final tolerances, GD&T, schematics, mechanical/electrical CAD, P&IDs, software design specs. Critical Design Review (CDR) — design freezes for build.",
  },
  {
    key: "verify",
    label: "6. Verification",
    blurb: "Did we build it right?",
    detail:
      "Unit / integration / system test against the requirements baseline. Inspection, analysis, demonstration, test (IADT). Bottom-up V-model right side.",
    family: "software-systems",
  },
  {
    key: "validate",
    label: "7. Validation",
    blurb: "Did we build the right thing?",
    detail:
      "End-user / customer demonstration that the system meets the original need in its operating environment. Acceptance test, operational evaluation.",
  },
  {
    key: "deploy",
    label: "8. Deployment",
    blurb: "Manufacture, install, commission.",
    detail:
      "Quality control, supply-chain coordination, site preparation, factory/site acceptance tests. First Article Inspection (FAI).",
  },
  {
    key: "operate",
    label: "9. Operations & maintenance",
    blurb: "Run the system; preserve reliability.",
    detail:
      "Condition monitoring, predictive maintenance, configuration management, ECOs. Most of system cost lives here.",
    family: "systems-reliability",
  },
  {
    key: "retire",
    label: "10. Retirement",
    blurb: "Decommission, recycle, replace.",
    detail:
      "Safe disposal, recycling, succession planning. Required for nuclear, biomedical, regulated industrial — increasingly mainstream via sustainability mandates.",
    family: "environmental",
  },
];

const STAGE_X = 100;
const STAGE_Y0 = 40;
const STAGE_H = 60;
const STAGE_GAP = 12;
const STAGE_W = 280;
const FB_W = 90;
const SVG_W = STAGE_X + STAGE_W + FB_W + 80;
const SVG_H = STAGE_Y0 + STAGES.length * (STAGE_H + STAGE_GAP) + 40;

function DesignProcessFlow({ onJumpFamily }: { onJumpFamily: (slug: string) => void }) {
  const [selected, setSelected] = useState<StageKey>("requirements");
  const sel = STAGES.find((s) => s.key === selected)!;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg
          width={SVG_W}
          height={SVG_H}
          role="img"
          aria-label="Engineering design process flow"
          className="block"
        >
          <defs>
            <marker id="eng-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#60a5fa" />
            </marker>
            <marker id="eng-arrow-fb" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
            </marker>
          </defs>
          {/* feedback rail */}
          <line
            x1={STAGE_X + STAGE_W + 30}
            y1={STAGE_Y0 + STAGE_H / 2}
            x2={STAGE_X + STAGE_W + 30}
            y2={STAGE_Y0 + (STAGES.length - 1) * (STAGE_H + STAGE_GAP) + STAGE_H / 2}
            stroke="#f59e0b"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.6}
          />
          <text
            x={STAGE_X + STAGE_W + 36}
            y={STAGE_Y0 + 8}
            fontSize={9}
            fill="#f59e0b"
            fontFamily="ui-monospace, monospace"
          >
            iteration
          </text>
          <text
            x={STAGE_X + STAGE_W + 36}
            y={STAGE_Y0 + 18}
            fontSize={9}
            fill="#f59e0b"
            fontFamily="ui-monospace, monospace"
          >
            feedback
          </text>

          {STAGES.map((stage, i) => {
            const y = STAGE_Y0 + i * (STAGE_H + STAGE_GAP);
            const isSel = stage.key === selected;
            return (
              <g key={stage.key} onClick={() => setSelected(stage.key)} style={{ cursor: "pointer" }}>
                <rect
                  x={STAGE_X}
                  y={y}
                  width={STAGE_W}
                  height={STAGE_H}
                  rx={6}
                  fill={isSel ? "#1e3a8a" : "#111827"}
                  stroke={isSel ? "#60a5fa" : "#374151"}
                  strokeWidth={isSel ? 2 : 1}
                />
                <text
                  x={STAGE_X + 12}
                  y={y + 22}
                  fontSize={12}
                  fontWeight={600}
                  fill={isSel ? "#ffffff" : "#d1d5db"}
                  fontFamily="ui-monospace, monospace"
                >
                  {stage.label}
                </text>
                <text
                  x={STAGE_X + 12}
                  y={y + 42}
                  fontSize={10}
                  fill={isSel ? "#bfdbfe" : "#9ca3af"}
                  fontFamily="ui-monospace, monospace"
                >
                  {stage.blurb}
                </text>
                {/* downward arrow to next stage */}
                {i < STAGES.length - 1 && (
                  <line
                    x1={STAGE_X + STAGE_W / 2}
                    y1={y + STAGE_H}
                    x2={STAGE_X + STAGE_W / 2}
                    y2={y + STAGE_H + STAGE_GAP}
                    stroke="#60a5fa"
                    strokeWidth={1.5}
                    markerEnd="url(#eng-arrow)"
                  />
                )}
                {/* feedback tick into rail */}
                <line
                  x1={STAGE_X + STAGE_W}
                  y1={y + STAGE_H / 2}
                  x2={STAGE_X + STAGE_W + 30}
                  y2={y + STAGE_H / 2}
                  stroke="#f59e0b"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.6}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="rounded border border-blue-900 bg-blue-950/30 p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-blue-300">{sel.label}</p>
        <p className="text-xs text-gray-200 leading-relaxed">{sel.detail}</p>
        {sel.family && (
          <button
            onClick={() => onJumpFamily(sel.family!)}
            className="text-[11px] font-mono text-blue-300 hover:text-blue-200 underline underline-offset-2"
          >
            jump to related family →
          </button>
        )}
      </div>
      <p className="text-[10px] text-gray-500 leading-snug">
        The waterfall stages above are an idealization — in practice every loop iterates (orange dashed feedback
        rail). Agile collapses 1–7 into short sprints; safety-critical (DO-178C, ISO 26262) keeps the formal
        gates with documented rationale at each transition. The V-model pairs left-side construction phases
        (requirements, design) with right-side verification phases (integration, system test).
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Xref & status badges
// ────────────────────────────────────────────────────────────────────────────

function XrefBadges({ entry }: { entry: EngEntry }) {
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
  entry: EngEntry;
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
  filteredEntries: EngEntry[];
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

export default function EngineeringPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showMaterials, setShowMaterials] = useState(true);
  const [showDesign, setShowDesign] = useState(false);

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

  const bySection: Record<Section, { family: Family; entries: EngEntry[] }[]> = { A: [], B: [], C: [], D: [], E: [] };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  const jumpToFamily = (slug: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });
    const el = document.getElementById(`family-${slug}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Engineering — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to engineering organized into 24 families across five sections — Civil &amp; Mechanical
          Foundations, Electrical/Electronic/Software, Chemical/Materials/Industrial,
          Aerospace/Biomedical/Environmental/Nuclear/Transport, and Systems/Ethics/Frontier Problems. Each card
          carries a <em>key fact</em>, where relevant a <em>formula</em> (typeset with KaTeX), and an{" "}
          <em>example</em>. Status badges color-code epistemic posture: <strong>LANDMARK</strong> (green —
          foundational results like the rocket equation, Hodgkin–Huxley, MRI, lean manufacturing),{" "}
          <strong>CONTESTED</strong> (amber — open trade-offs like CCS economics, SMR cost, reusable launch),{" "}
          <strong>REFUTED</strong> (rose — LK-99, Theranos), and <strong>OPEN</strong> (red — commercial fusion,
          grid-scale storage, room-temperature superconductivity, embodied AI, fault-tolerant quantum computing).
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Cross-references: entries marked <span className="font-mono">xref</span> link to{" "}
          <Link href="/mathematics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">mathematics</Link>,{" "}
          <Link href="/physics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">physics</Link>,{" "}
          <Link href="/chemistry" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">chemistry</Link>,{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">statistics</Link>{" "}
          or{" "}
          <Link href="/computer-science" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">computer-science</Link>{" "}
          rather than duplicating. Two headline interactive views: a{" "}
          <strong>materials property comparison table</strong> (sortable, filterable across metals, ceramics,
          polymers, composites, biological, semiconductors) and an{" "}
          <strong>engineering design-process flowchart</strong> (clickable 10-stage waterfall + iteration feedback
          rail).
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries · {MATERIALS.length} materials
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
        </p>
      </div>

      {/* Materials comparison table */}
      <section className="rounded-lg border border-sky-900 overflow-hidden">
        <button
          onClick={() => setShowMaterials((v) => !v)}
          className="w-full text-left px-5 py-3 bg-sky-950/40 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-sky-200">Materials property comparison</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Sort engineering materials across six classes by density, Young&apos;s modulus, tensile strength,
              thermal conductivity, melting point, electrical resistivity, and relative cost.
            </p>
          </div>
          <span className="text-xs text-sky-400">{showMaterials ? "▾" : "▸"}</span>
        </button>
        {showMaterials && (
          <div className="bg-gray-950/40 p-4">
            <MaterialsTable />
          </div>
        )}
      </section>

      {/* Design process flow */}
      <section className="rounded-lg border border-blue-900 overflow-hidden">
        <button
          onClick={() => setShowDesign((v) => !v)}
          className="w-full text-left px-5 py-3 bg-blue-950/40 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-blue-200">Engineering design process</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Clickable 10-stage flow (needs → requirements → concept → preliminary → detail → verify → validate
              → deploy → operate → retire) with iteration feedback rail.
            </p>
          </div>
          <span className="text-xs text-blue-400">{showDesign ? "▾" : "▸"}</span>
        </button>
        {showDesign && (
          <div className="bg-gray-950/40 p-4">
            <DesignProcessFlow onJumpFamily={jumpToFamily} />
          </div>
        )}
      </section>

      {/* Filter / controls */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, key fact, formula, tag — e.g. 'Bernoulli', 'PID', 'fatigue', 'fission', 'liquefaction'"
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
      <FieldGuideBanner domain="Engineering" className="mb-2" />
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
          <span className="text-gray-400">Accuracy note:</span> material properties in the comparison table are
          typical room-temperature values from CES/ASM/MatWeb ranges; within-class spread is wide for concrete,
          polymers, and composites. Entries marked{" "}
          <span className="text-red-300 font-mono">OPEN</span> are genuinely unresolved engineering challenges as
          of 2026 (commercial fusion, room-temperature ambient-pressure superconductivity, fault-tolerant quantum
          computing, embodied-AI reliability, long-duration grid storage). LK-99 (Korea 2023) is presented as{" "}
          <span className="text-rose-300 font-mono">REFUTED</span> per independent replications, not as an open
          question. Reports of inaccuracy welcome via the{" "}
          <Link href="/feedback" className="underline underline-offset-2">feedback</Link> page.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-05 · LaTeX typesetting via KaTeX · 24 families · {totalEntries} entries ·{" "}
          {MATERIALS.length} materials
        </p>
      </div>
      <div className="border-t border-gray-700/40 pt-6 mt-4">
        <p className="text-[11px] font-mono uppercase tracking-widest text-gray-600 mb-2">Discover related claims in the graph</p>
        <div className="flex flex-wrap gap-4">
          <a href="/search?q=engineering" className="text-xs text-sky-400/70 hover:text-sky-300 transition-colors font-mono">
            Search Engineering in the claim graph →
          </a>
          <a href="/settling-curve" className="text-xs text-amber-400/50 hover:text-amber-300 transition-colors font-mono">
            Browse all trajectories →
          </a>
        </div>
      </div>
    </div>
  );
}
