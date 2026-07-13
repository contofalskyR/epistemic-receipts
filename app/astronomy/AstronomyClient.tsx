"use client";
import { DomainStatusBadge } from "@/components/DomainStatusBadge";

import { useMemo, useState } from "react";
import Link from "next/link";
import katex from "katex";
import "katex/dist/katex.min.css";

import type { AstroEntry, ColorKey, Family, Section, HRStar, DistanceRung, EMBand } from "./types";
import { FAMILIES_1_7 } from "./data";
import { FAMILIES_8_14 } from "./data2";
import { FAMILIES_15_21 } from "./data3";

const ALL_FAMILIES: Family[] = [...FAMILIES_1_7, ...FAMILIES_8_14, ...FAMILIES_15_21];

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
  A: { name: "Section A — Observational & Instrumental Astronomy", tagline: "Coordinates, telescopes, photometry, spectroscopy, and the celestial mechanics that anchor it all." },
  B: { name: "Section B — Solar System & Planetary Science", tagline: "The Sun and its retinue: planets, moons, small bodies, and heliophysics." },
  C: { name: "Section C — Stellar & Galactic Astronomy", tagline: "Stars from formation through remnants, exoplanets, the interstellar medium, and the Milky Way." },
  D: { name: "Section D — Extragalactic Astronomy & Cosmology", tagline: "Galaxies, AGN, large-scale structure, cosmology, and the multi-messenger era." },
  E: { name: "Section E — Astrobiology, Radiative Transfer & Open Questions", tagline: "Life beyond Earth, the physics of starlight, and the questions that remain." },
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
// HR diagram data
// ────────────────────────────────────────────────────────────────────────────

const HR_STARS: HRStar[] = [
  // Main sequence
  { name: "Sun", spectralClass: "G", tempK: 5778, absMag: 4.83, luminositySolar: 1.0, group: "main-sequence", note: "G2V — our reference." },
  { name: "Sirius A", spectralClass: "A", tempK: 9940, absMag: 1.43, luminositySolar: 25.4, group: "main-sequence", note: "Brightest night-time star." },
  { name: "Alpha Centauri A", spectralClass: "G", tempK: 5790, absMag: 4.38, luminositySolar: 1.52, group: "main-sequence", note: "Sun-like, nearest." },
  { name: "Alpha Centauri B", spectralClass: "K", tempK: 5260, absMag: 5.71, luminositySolar: 0.50, group: "main-sequence" },
  { name: "Proxima Centauri", spectralClass: "M", tempK: 3042, absMag: 15.6, luminositySolar: 0.0017, group: "main-sequence", note: "Closest star (4.24 ly)." },
  { name: "Vega", spectralClass: "A", tempK: 9602, absMag: 0.58, luminositySolar: 40.1, group: "main-sequence" },
  { name: "Altair", spectralClass: "A", tempK: 7550, absMag: 2.21, luminositySolar: 10.6, group: "main-sequence" },
  { name: "Procyon A", spectralClass: "F", tempK: 6530, absMag: 2.66, luminositySolar: 6.93, group: "main-sequence" },
  { name: "Tau Ceti", spectralClass: "G", tempK: 5344, absMag: 5.69, luminositySolar: 0.52, group: "main-sequence" },
  { name: "61 Cygni A", spectralClass: "K", tempK: 4525, absMag: 7.49, luminositySolar: 0.15, group: "main-sequence", note: "First stellar parallax (Bessel 1838)." },
  { name: "Barnard's Star", spectralClass: "M", tempK: 3134, absMag: 13.2, luminositySolar: 0.0035, group: "main-sequence", note: "Largest known proper motion." },
  { name: "Spica", spectralClass: "B", tempK: 22400, absMag: -3.55, luminositySolar: 20500, group: "main-sequence" },
  { name: "Regulus", spectralClass: "B", tempK: 12460, absMag: -0.57, luminositySolar: 316, group: "main-sequence" },
  { name: "Alnitak (O-star)", spectralClass: "O", tempK: 29500, absMag: -5.25, luminositySolar: 250000, group: "main-sequence", note: "O9.7 Iab — Orion's belt." },
  // Giants
  { name: "Arcturus", spectralClass: "K", tempK: 4286, absMag: -0.30, luminositySolar: 170, group: "giant" },
  { name: "Aldebaran", spectralClass: "K", tempK: 3910, absMag: -0.63, luminositySolar: 439, group: "giant" },
  { name: "Pollux", spectralClass: "K", tempK: 4666, absMag: 1.09, luminositySolar: 43, group: "giant" },
  { name: "Mira (max)", spectralClass: "M", tempK: 2918, absMag: 0.85, luminositySolar: 9000, group: "giant", note: "Variable AGB star." },
  // Supergiants
  { name: "Betelgeuse", spectralClass: "M", tempK: 3500, absMag: -5.85, luminositySolar: 126000, group: "supergiant", note: "Will supernova within ~100,000 yr." },
  { name: "Antares", spectralClass: "M", tempK: 3660, absMag: -5.28, luminositySolar: 75900, group: "supergiant" },
  { name: "Rigel", spectralClass: "B", tempK: 12100, absMag: -7.84, luminositySolar: 120000, group: "supergiant" },
  { name: "Deneb", spectralClass: "A", tempK: 8525, absMag: -8.38, luminositySolar: 196000, group: "supergiant" },
  { name: "VY Canis Majoris", spectralClass: "M", tempK: 3490, absMag: -9.4, luminositySolar: 270000, group: "supergiant", note: "One of the largest known stars." },
  // White dwarfs
  { name: "Sirius B", spectralClass: "A", tempK: 25200, absMag: 11.18, luminositySolar: 0.056, group: "white-dwarf", note: "First WD identified (1862)." },
  { name: "Procyon B", spectralClass: "A", tempK: 7740, absMag: 13.04, luminositySolar: 0.00049, group: "white-dwarf" },
  { name: "40 Eridani B", spectralClass: "A", tempK: 16500, absMag: 11.27, luminositySolar: 0.013, group: "white-dwarf" },
  { name: "Van Maanen's Star", spectralClass: "A", tempK: 6220, absMag: 14.21, luminositySolar: 0.00017, group: "white-dwarf" },
  // Subgiant / subdwarf
  { name: "Beta Hydri", spectralClass: "G", tempK: 5872, absMag: 3.45, luminositySolar: 3.49, group: "subgiant" },
  { name: "Kapteyn's Star", spectralClass: "M", tempK: 3550, absMag: 10.89, luminositySolar: 0.012, group: "subdwarf", note: "Halo population, [Fe/H]≈−0.86." },
];

const HR_GROUP_STYLE: Record<HRStar["group"], { fill: string; stroke: string; label: string }> = {
  "main-sequence": { fill: "#fde68a", stroke: "#fbbf24", label: "Main sequence" },
  "giant":         { fill: "#fb923c", stroke: "#f97316", label: "Giant" },
  "supergiant":    { fill: "#f87171", stroke: "#ef4444", label: "Supergiant" },
  "white-dwarf":   { fill: "#93c5fd", stroke: "#3b82f6", label: "White dwarf" },
  "subgiant":      { fill: "#fcd34d", stroke: "#f59e0b", label: "Subgiant" },
  "subdwarf":      { fill: "#a78bfa", stroke: "#8b5cf6", label: "Subdwarf" },
};

const SPECTRAL_COLOR: Record<HRStar["spectralClass"], string> = {
  O: "#9bb0ff",
  B: "#aabfff",
  A: "#cad7ff",
  F: "#f8f7ff",
  G: "#fff4ea",
  K: "#ffd2a1",
  M: "#ffcc6f",
};

function HRDiagram({ onSelect, selectedName }: { onSelect: (s: HRStar) => void; selectedName: string | null }) {
  // Plot in (log T, M_V) space. Temperature axis INVERTED (hot on left) per convention.
  const W = 620;
  const H = 420;
  const padL = 60;
  const padR = 20;
  const padT = 30;
  const padB = 50;

  // log10(T) range: 3.3 (~2000K) to 4.7 (~50000K).
  const logTmin = 3.3;
  const logTmax = 4.7;
  // Absolute magnitude range: -10 (top, bright) to +16 (bottom, faint).
  const Mmin = -10;
  const Mmax = 16;

  const xOf = (logT: number) => {
    // Invert: hot (high logT) on the LEFT.
    const f = (logT - logTmin) / (logTmax - logTmin);
    return padL + (1 - f) * (W - padL - padR);
  };
  const yOf = (M: number) => padT + ((M - Mmin) / (Mmax - Mmin)) * (H - padT - padB);

  // Background bands: spectral class color bars along the top.
  const classBands: { cls: HRStar["spectralClass"]; lowT: number; highT: number }[] = [
    { cls: "O", lowT: 30000, highT: 50000 },
    { cls: "B", lowT: 10000, highT: 30000 },
    { cls: "A", lowT: 7500,  highT: 10000 },
    { cls: "F", lowT: 6000,  highT: 7500 },
    { cls: "G", lowT: 5000,  highT: 6000 },
    { cls: "K", lowT: 3500,  highT: 5000 },
    { cls: "M", lowT: 2400,  highT: 3500 },
  ];

  // Gridlines and labels.
  const tempTicks = [2500, 3500, 5000, 7500, 10000, 20000, 30000, 50000];
  const magTicks = [-10, -5, 0, 5, 10, 15];

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} role="img" aria-label="Hertzsprung-Russell diagram" style={{ background: "#0a0a14" }}>
        {/* Spectral-class color bands across the top */}
        {classBands.map((b) => {
          const x1 = xOf(Math.log10(b.highT));
          const x2 = xOf(Math.log10(b.lowT));
          const w = x2 - x1;
          if (w <= 0) return null;
          return (
            <g key={b.cls}>
              <rect x={x1} y={padT - 14} width={w} height={10} fill={SPECTRAL_COLOR[b.cls]} opacity={0.55} />
              <text x={x1 + w / 2} y={padT - 18} fontSize={9} fill="#cbd5e1" textAnchor="middle" fontFamily="ui-monospace, monospace">{b.cls}</text>
            </g>
          );
        })}

        {/* Gridlines */}
        {tempTicks.map((T) => {
          const x = xOf(Math.log10(T));
          return (
            <g key={`gt-${T}`}>
              <line x1={x} y1={padT} x2={x} y2={H - padB} stroke="#1e293b" strokeWidth={0.5} />
              <text x={x} y={H - padB + 14} fontSize={9} fill="#94a3b8" textAnchor="middle" fontFamily="ui-monospace, monospace">{T >= 1000 ? `${T / 1000}k` : T}</text>
            </g>
          );
        })}
        {magTicks.map((M) => {
          const y = yOf(M);
          return (
            <g key={`gm-${M}`}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#1e293b" strokeWidth={0.5} />
              <text x={padL - 6} y={y + 3} fontSize={9} fill="#94a3b8" textAnchor="end" fontFamily="ui-monospace, monospace">{M > 0 ? `+${M}` : M}</text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={(padL + W - padR) / 2} y={H - 10} fontSize={11} fill="#cbd5e1" textAnchor="middle" fontFamily="ui-monospace, monospace">
          Surface temperature (K) — hot left, cool right
        </text>
        <text x={14} y={(padT + H - padB) / 2} fontSize={11} fill="#cbd5e1" textAnchor="middle" fontFamily="ui-monospace, monospace" transform={`rotate(-90 14 ${(padT + H - padB) / 2})`}>
          Absolute magnitude M (brighter ↑)
        </text>

        {/* Plot area border */}
        <rect x={padL} y={padT} width={W - padR - padL} height={H - padB - padT} fill="none" stroke="#334155" strokeWidth={0.8} />

        {/* Stars */}
        {HR_STARS.map((s) => {
          const x = xOf(Math.log10(s.tempK));
          const y = yOf(s.absMag);
          const isSel = s.name === selectedName;
          const style = HR_GROUP_STYLE[s.group];
          return (
            <g key={s.name} onClick={() => onSelect(s)} style={{ cursor: "pointer" }}>
              <circle cx={x} cy={y} r={isSel ? 7 : 4.5} fill={style.fill} stroke={isSel ? "#ffffff" : style.stroke} strokeWidth={isSel ? 2 : 1} opacity={0.92}>
                <title>{`${s.name} — ${s.spectralClass} ${style.label} · T=${s.tempK} K · M=${s.absMag.toFixed(2)}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px]">
        {Object.entries(HR_GROUP_STYLE).map(([k, s]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: s.fill, border: `1px solid ${s.stroke}` }} />
            <span className="text-gray-300 font-mono">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HRStarDetail({ star }: { star: HRStar }) {
  const style = HR_GROUP_STYLE[star.group];
  return (
    <div
      className="rounded border p-4 space-y-2 mt-3"
      style={{ borderColor: style.stroke, background: `${style.fill}10` }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: style.fill }}>
            {style.label} · {star.spectralClass}-class
          </p>
          <h3 className="text-xl font-semibold text-white">{star.name}</h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white font-mono">{star.tempK.toLocaleString()} K</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">surface temperature</div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Absolute magnitude</p>
          <p className="text-gray-200 font-mono">{star.absMag > 0 ? `+${star.absMag.toFixed(2)}` : star.absMag.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Luminosity (L/L☉)</p>
          <p className="text-gray-200 font-mono">{star.luminositySolar < 0.01 ? star.luminositySolar.toExponential(2) : star.luminositySolar.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">log T</p>
          <p className="text-gray-200 font-mono">{Math.log10(star.tempK).toFixed(3)}</p>
        </div>
      </div>
      {star.note && (
        <p className="text-[11px] text-gray-400 leading-snug border-l-2 border-gray-700 pl-3 mt-2 italic">
          {star.note}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <Link
          href={`/search?q=${encodeURIComponent(star.name)}`}
          className="text-[11px] font-mono text-gray-400 hover:text-white underline underline-offset-2"
        >
          search receipts →
        </Link>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Cosmic distance ladder
// ────────────────────────────────────────────────────────────────────────────

const DISTANCE_LADDER: DistanceRung[] = [
  {
    name: "Radar / direct ranging",
    minParsec: 1e-10,
    reachParsec: 1e-4,
    description: "Time-of-flight radar to solar-system bodies; lunar laser ranging.",
    example: "Earth-Moon distance to mm via Apollo-era retroreflectors.",
  },
  {
    name: "Trigonometric parallax",
    minParsec: 1e-3,
    reachParsec: 2e4,
    description: "Apparent shift of nearby stars as Earth orbits the Sun.",
    example: "Gaia (2013+) measures parallaxes to ~1.5 μas across ~10⁹ stars, reaching ~10 kpc.",
  },
  {
    name: "Moving cluster / spectroscopic parallax",
    minParsec: 10,
    reachParsec: 1e5,
    description: "Spectral classification gives absolute magnitude; combined with apparent magnitude → distance.",
    example: "Hyades open cluster moving-cluster distance: ~47 pc.",
  },
  {
    name: "Main-sequence fitting",
    minParsec: 100,
    reachParsec: 1e5,
    description: "Shift a cluster CMD vertically until it matches a calibrated nearby cluster.",
    example: "Globular clusters and open clusters out to ~100 kpc.",
  },
  {
    name: "RR Lyrae stars",
    minParsec: 1e3,
    reachParsec: 3e6,
    description: "Period-luminosity relation calibrated for horizontal-branch pulsators.",
    example: "Trace Galactic halo and Local Group dwarf-galaxy distances.",
  },
  {
    name: "Cepheid variables (Leavitt)",
    minParsec: 1e3,
    reachParsec: 4e7,
    description: "Henrietta Leavitt (1908) — period-luminosity relation in pulsating supergiants.",
    example: "Hubble's 1924 Andromeda distance — proved galaxies are extragalactic. Now anchored by JWST + HST + Gaia.",
  },
  {
    name: "Tip of the red giant branch (TRGB)",
    minParsec: 1e5,
    reachParsec: 5e7,
    description: "Sharp luminosity cutoff at the TRGB serves as a standard candle.",
    example: "Used as an independent rung in the H₀ tension debate (CCHP team gets H₀ ≈ 69).",
  },
  {
    name: "Tully-Fisher / Faber-Jackson",
    minParsec: 1e5,
    reachParsec: 5e8,
    description: "Galaxy-scale scaling relations: L ∝ v⁴ (spirals), L ∝ σ⁴ (ellipticals).",
    example: "Calibrated locally; extends distance reach to several hundred Mpc.",
  },
  {
    name: "Type Ia supernovae",
    minParsec: 1e6,
    reachParsec: 5e9,
    description: "Standardizable candles — light-curve shape correlates with peak brightness.",
    example: "1998 dark-energy discovery and current SH0ES Hubble-tension measurement.",
  },
  {
    name: "Baryon acoustic oscillations",
    minParsec: 1e8,
    reachParsec: 1e10,
    description: "$\\sim 150$ Mpc sound horizon at recombination is a standard ruler.",
    example: "SDSS, BOSS, eBOSS, DESI map H(z) and D_A(z) across z = 0–4.",
  },
  {
    name: "CMB acoustic peaks",
    minParsec: 4e9,
    reachParsec: 1.4e10,
    description: "Last-scattering surface at z ≈ 1090, ~46 Gly comoving.",
    example: "Planck mission anchors the early-universe distance scale.",
  },
];

function DistanceLadder() {
  // Log scale from 1e-4 pc to 1e10 pc.
  const W = 720;
  const ROW_H = 30;
  const TOP_H = 40;
  const H = TOP_H + DISTANCE_LADDER.length * ROW_H + 30;
  const padL = 230;
  const padR = 20;
  const minLog = -4;
  const maxLog = 10.5;

  const xOf = (logPc: number) => {
    const f = (logPc - minLog) / (maxLog - minLog);
    return padL + f * (W - padL - padR);
  };

  const grid = [-4, -2, 0, 2, 4, 6, 8, 10];
  const gridLabel = (logPc: number): string => {
    const pc = Math.pow(10, logPc);
    if (pc < 1) return `${pc.toExponential(0)} pc`;
    if (pc < 1e3) return `${pc} pc`;
    if (pc < 1e6) return `${(pc / 1e3).toFixed(0)} kpc`;
    if (pc < 1e9) return `${(pc / 1e6).toFixed(0)} Mpc`;
    return `${(pc / 1e9).toFixed(0)} Gpc`;
  };

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} role="img" aria-label="Cosmic distance ladder" style={{ background: "#0a0a14" }}>
        {/* Gridlines */}
        {grid.map((g) => {
          const x = xOf(g);
          return (
            <g key={`g-${g}`}>
              <line x1={x} y1={TOP_H} x2={x} y2={H - 20} stroke="#1e293b" strokeWidth={0.5} />
              <text x={x} y={TOP_H - 8} fontSize={9} fill="#94a3b8" textAnchor="middle" fontFamily="ui-monospace, monospace">{gridLabel(g)}</text>
            </g>
          );
        })}
        {/* Rows */}
        {DISTANCE_LADDER.map((r, i) => {
          const y = TOP_H + i * ROW_H + 5;
          const x1 = xOf(Math.log10(r.minParsec));
          const x2 = xOf(Math.log10(r.reachParsec));
          const w = Math.max(2, x2 - x1);
          return (
            <g key={r.name}>
              <text x={padL - 10} y={y + 15} fontSize={11} fill="#e5e7eb" textAnchor="end" fontFamily="ui-monospace, monospace">{r.name}</text>
              <rect x={x1} y={y + 4} width={w} height={ROW_H - 12} fill="#60a5fa" opacity={0.55} stroke="#3b82f6" strokeWidth={0.6} rx={2}>
                <title>{`${r.name}: ${gridLabel(Math.log10(r.minParsec))} → ${gridLabel(Math.log10(r.reachParsec))}`}</title>
              </rect>
            </g>
          );
        })}
        {/* Axis label */}
        <text x={(padL + W - padR) / 2} y={H - 6} fontSize={11} fill="#cbd5e1" textAnchor="middle" fontFamily="ui-monospace, monospace">
          Distance (parsecs, log scale)
        </text>
      </svg>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Electromagnetic spectrum
// ────────────────────────────────────────────────────────────────────────────

const EM_BANDS: EMBand[] = [
  { name: "Radio",          lambdaLow: 1e-1,  lambdaHigh: 1e6,   windowFromGround: "transparent", signatureSources: "Pulsars, HI 21 cm, AGN jets, FRBs, CMB.",          primaryInstrument: "VLA, ALMA (mm), MeerKAT, SKA, FAST, Arecibo (decommissioned)." },
  { name: "Microwave",      lambdaLow: 1e-3,  lambdaHigh: 1e-1,  windowFromGround: "partial",     signatureSources: "CMB blackbody peak, molecular rotations.",         primaryInstrument: "Planck, ACT, SPT, BICEP/Keck, COBE." },
  { name: "Far infrared",   lambdaLow: 25e-6, lambdaHigh: 1e-3,  windowFromGround: "opaque",      signatureSources: "Cold dust, star-forming galaxies, protoplanetary disks.", primaryInstrument: "Herschel, SOFIA, Planck HFI, JWST MIRI." },
  { name: "Mid/near IR",    lambdaLow: 7e-7,  lambdaHigh: 25e-6, windowFromGround: "partial",     signatureSources: "Cool stars, PAHs, dust-obscured AGN, high-z galaxies.", primaryInstrument: "JWST, Spitzer, WISE, Subaru, VLT." },
  { name: "Optical",        lambdaLow: 4e-7,  lambdaHigh: 7e-7,  windowFromGround: "transparent", signatureSources: "Most stars, galaxies, planets, biology.",        primaryInstrument: "Keck, VLT, Gemini, HST, Subaru, Rubin/LSST." },
  { name: "Ultraviolet",    lambdaLow: 1e-8,  lambdaHigh: 4e-7,  windowFromGround: "opaque",      signatureSources: "Hot OB stars, accretion disks, IGM ionization.",  primaryInstrument: "HST STIS, GALEX, FUSE." },
  { name: "X-ray",          lambdaLow: 1e-11, lambdaHigh: 1e-8,  windowFromGround: "opaque",      signatureSources: "Black-hole accretion, neutron stars, hot ICM.",   primaryInstrument: "Chandra, XMM-Newton, NICER, NuSTAR, IXPE, eROSITA." },
  { name: "Gamma ray",      lambdaLow: 1e-20, lambdaHigh: 1e-11, windowFromGround: "partial",     signatureSources: "GRBs, AGN jets, pulsar wind nebulae, dark-matter (potential).", primaryInstrument: "Fermi LAT, Swift, INTEGRAL, HESS, MAGIC, CTA." },
];

function EMSpectrum({ onSelect, selectedName }: { onSelect: (b: EMBand) => void; selectedName: string | null }) {
  const W = 720;
  const H = 130;
  const padL = 30;
  const padR = 20;
  const padT = 30;
  const padB = 40;

  // log10(λ in meters) range: -20 to 6.
  const minLog = -20;
  const maxLog = 6;

  const xOf = (logL: number) => padL + ((logL - minLog) / (maxLog - minLog)) * (W - padL - padR);

  const gridDecades = [-20, -16, -12, -8, -4, 0, 4];
  const gridLabel = (logL: number) => {
    const m = Math.pow(10, logL);
    if (m < 1e-9) return `${(m * 1e12).toExponential(0)} pm`;
    if (m < 1e-6) return `${(m * 1e9).toFixed(0)} nm`;
    if (m < 1e-3) return `${(m * 1e6).toFixed(0)} µm`;
    if (m < 1)    return `${(m * 1e3).toFixed(0)} mm`;
    if (m < 1e3)  return `${m.toFixed(0)} m`;
    return `${(m / 1e3).toFixed(0)} km`;
  };

  const bandColor = (b: EMBand): string => {
    switch (b.name) {
      case "Radio": return "#7c3aed";
      case "Microwave": return "#8b5cf6";
      case "Far infrared": return "#ef4444";
      case "Mid/near IR": return "#f97316";
      case "Optical": return "#eab308";
      case "Ultraviolet": return "#a855f7";
      case "X-ray": return "#3b82f6";
      case "Gamma ray": return "#ec4899";
      default: return "#94a3b8";
    }
  };

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} role="img" aria-label="Electromagnetic spectrum" style={{ background: "#0a0a14" }}>
        {/* Wavelength gridlines */}
        {gridDecades.map((g) => {
          const x = xOf(g);
          return (
            <g key={`g-${g}`}>
              <line x1={x} y1={padT} x2={x} y2={H - padB} stroke="#1e293b" strokeWidth={0.5} />
              <text x={x} y={H - padB + 12} fontSize={9} fill="#94a3b8" textAnchor="middle" fontFamily="ui-monospace, monospace">{gridLabel(g)}</text>
            </g>
          );
        })}
        <text x={(padL + W - padR) / 2} y={H - 6} fontSize={10} fill="#cbd5e1" textAnchor="middle" fontFamily="ui-monospace, monospace">
          Wavelength λ (m, log scale) — long ←  → short
        </text>

        {EM_BANDS.map((b) => {
          const x1 = xOf(Math.log10(b.lambdaLow));
          const x2 = xOf(Math.log10(b.lambdaHigh));
          const w = Math.max(3, x2 - x1);
          const isSel = b.name === selectedName;
          const colr = bandColor(b);
          return (
            <g key={b.name} onClick={() => onSelect(b)} style={{ cursor: "pointer" }}>
              <rect x={Math.min(x1, x2)} y={padT} width={w} height={H - padT - padB} fill={colr} opacity={isSel ? 0.95 : 0.7} stroke={isSel ? "#ffffff" : colr} strokeWidth={isSel ? 2 : 0.8} rx={2}>
                <title>{`${b.name} — ${gridLabel(Math.log10(b.lambdaLow))} to ${gridLabel(Math.log10(b.lambdaHigh))} · ${b.windowFromGround}`}</title>
              </rect>
              <text x={(Math.min(x1, x2) + w / 2)} y={padT + (H - padT - padB) / 2 + 4} fontSize={10} fill="#ffffff" textAnchor="middle" fontFamily="ui-monospace, monospace" style={{ pointerEvents: "none" }}>
                {b.name}
              </text>
            </g>
          );
        })}

        {/* Ground-window key (above bands) */}
        <text x={padL} y={padT - 12} fontSize={9} fill="#94a3b8" fontFamily="ui-monospace, monospace">Click a band ↓</text>
      </svg>
    </div>
  );
}

function EMBandDetail({ band }: { band: EMBand }) {
  const winColor = band.windowFromGround === "transparent" ? "#10b981" : band.windowFromGround === "partial" ? "#f59e0b" : "#ef4444";
  return (
    <div className="rounded border border-gray-800 bg-gray-900/50 p-4 space-y-2 mt-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xl font-semibold text-white">{band.name}</h3>
        <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: `${winColor}22`, color: winColor, border: `1px solid ${winColor}55` }}>
          {band.windowFromGround} from ground
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Wavelength range</p>
          <p className="text-gray-200 font-mono">
            {band.lambdaLow.toExponential(1)} m → {band.lambdaHigh.toExponential(1)} m
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Primary instruments</p>
          <p className="text-gray-200">{band.primaryInstrument}</p>
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500">Signature sources</p>
        <p className="mt-1 text-xs text-gray-300 leading-relaxed">{band.signatureSources}</p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Filter / search
// ────────────────────────────────────────────────────────────────────────────

function entryMatches(entry: AstroEntry, query: string): boolean {
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

function XrefBadges({ entry }: { entry: AstroEntry }) {
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
  entry: AstroEntry;
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
  filteredEntries: AstroEntry[];
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

export default function AstronomyPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedStar, setSelectedStar] = useState<HRStar | null>(null);
  const [selectedBand, setSelectedBand] = useState<EMBand | null>(null);
  const [showLadder, setShowLadder] = useState(false);
  const [showSpectrum, setShowSpectrum] = useState(false);

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

  const bySection: Record<Section, { family: Family; entries: AstroEntry[] }[]> = { A: [], B: [], C: [], D: [], E: [] };
  for (const f of filtered) bySection[f.family.section].push(f);

  const sectionCounts: Record<Section, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fam of ALL_FAMILIES) sectionCounts[fam.section] += fam.entries.length;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-semibold text-white">Astronomy — A Working Taxonomy</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          A field guide to astronomy organized into {ALL_FAMILIES.length} families across five sections — Observational
          &amp; Instrumental, Solar System &amp; Planetary, Stellar &amp; Galactic, Extragalactic &amp; Cosmology, and
          Astrobiology / Radiative Transfer / Open Questions. Each card carries a <em>key fact</em>, where relevant a{" "}
          <em>formula</em> (typeset with KaTeX), and an <em>example</em>. Entries in Section E (and selected entries
          elsewhere) marked <strong>OPEN</strong> are genuinely unresolved problems.
        </p>
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          Cross-references: entries marked <span className="font-mono">xref</span> link to{" "}
          <Link href="/physics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">physics</Link>,{" "}
          <Link href="/chemistry" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">chemistry</Link>,{" "}
          <Link href="/mathematics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">mathematics</Link>{" "}
          or{" "}
          <Link href="/statistics" className="text-blue-300 underline underline-offset-2 hover:text-blue-200">statistics</Link>{" "}
          rather than duplicating. Three headline visualizations sit at the top of the page: an{" "}
          <strong>interactive Hertzsprung-Russell diagram</strong> ({HR_STARS.length} named stars,
          color-coded by population — click any star), the <strong>cosmic distance ladder</strong> (
          {DISTANCE_LADDER.length} rungs from radar ranging to the CMB, plotted on a log-parsec axis), and the{" "}
          <strong>electromagnetic-spectrum explorer</strong> ({EM_BANDS.length} bands from gamma rays to radio
          with ground-window status and primary instruments).
        </p>
        <p className="mt-2 text-xs font-mono text-gray-600">
          {ALL_FAMILIES.length} families · {totalEntries} entries · {HR_STARS.length} HR stars · {DISTANCE_LADDER.length} distance rungs · {EM_BANDS.length} EM bands
          {query && (
            <span className="text-gray-500"> · {matchCount} matching &ldquo;{query}&rdquo;</span>
          )}
        </p>
      </div>

      {/* HR Diagram */}
      <section className="rounded-lg border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 bg-gray-900/40 border-b border-gray-800">
          <h2 className="text-base font-semibold text-gray-200">Hertzsprung-Russell diagram</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Surface temperature (hot left → cool right) vs. absolute magnitude (brighter up → fainter down). Spectral
            classes O B A F G K M color the top axis. Main sequence runs diagonally; giants and supergiants live above;
            white dwarfs cluster below. Click any star for details. Built from a curated catalog of nearby and famous
            named stars; positions reflect published <em>T<sub>eff</sub></em> and absolute magnitudes.
          </p>
        </div>
        <div className="p-4 bg-gray-950/40 space-y-3">
          <HRDiagram
            onSelect={(s) => setSelectedStar(s)}
            selectedName={selectedStar?.name ?? null}
          />
          {selectedStar && <HRStarDetail star={selectedStar} />}
        </div>
      </section>

      {/* Cosmic distance ladder */}
      <section className="rounded-lg border border-blue-900 overflow-hidden">
        <button
          onClick={() => setShowLadder((v) => !v)}
          className="w-full text-left px-5 py-3 bg-blue-950/40 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-blue-200">Cosmic distance ladder</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              How astronomers measure distance, rung by rung. Each technique is calibrated against the one below it.
              The Hubble tension is a disagreement between rungs that overlap in their accessible distance ranges.
            </p>
          </div>
          <span className="text-xs text-blue-400">{showLadder ? "▾" : "▸"}</span>
        </button>
        {showLadder && (
          <div className="bg-gray-950/40 p-4 space-y-3">
            <DistanceLadder />
            <div className="grid gap-2 sm:grid-cols-2 mt-3">
              {DISTANCE_LADDER.map((r) => (
                <div key={r.name} className="rounded border border-gray-800 bg-gray-900/40 p-3">
                  <p className="text-xs font-semibold text-gray-200">{r.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{r.description}</p>
                  <p className="text-[11px] text-gray-500 mt-1 italic leading-snug">{r.example}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* EM Spectrum explorer */}
      <section className="rounded-lg border border-violet-900 overflow-hidden">
        <button
          onClick={() => setShowSpectrum((v) => !v)}
          className="w-full text-left px-5 py-3 bg-violet-950/40 hover:brightness-125 transition-all flex items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-violet-200">Electromagnetic-spectrum explorer</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Each EM band has a characteristic source population and a characteristic atmospheric window. Click a
              band to see the principal instruments observing it.
            </p>
          </div>
          <span className="text-xs text-violet-400">{showSpectrum ? "▾" : "▸"}</span>
        </button>
        {showSpectrum && (
          <div className="bg-gray-950/40 p-4 space-y-3">
            <EMSpectrum
              onSelect={(b) => setSelectedBand(b)}
              selectedName={selectedBand?.name ?? null}
            />
            {selectedBand && <EMBandDetail band={selectedBand} />}
          </div>
        )}
      </section>

      {/* Filter / controls */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, key fact, formula, tag — e.g. 'Hubble', 'pulsar', 'exoplanet', 'dark matter'"
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
          <span className="text-red-300 font-mono">OPEN</span> are genuinely unresolved as of 2026. Dark matter and
          dark energy are supported by overwhelming observational evidence; their <em>nature</em> is unknown, not their
          existence. The Hubble tension is presented as an active, unresolved discrepancy between early- and
          late-universe $H_0$ measurements at $\sim 5\sigma$. JWST high-redshift galaxy results have introduced new
          tensions with $\Lambda$CDM galaxy-formation models that are still being interpreted.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400">Accuracy note:</span> all 21 families and {totalEntries} entries reflect
          curated published values; the HR diagram positions, distance-ladder reaches, and EM-band ranges are
          drawn from standard references. Pluto is presented as a dwarf planet per the 2006 IAU decision. The 2019
          M87* and 2022 Sgr A* EHT images are treated as confirmed direct images of supermassive black holes.
          Reports of inaccuracy welcome via the{" "}
          <Link href="/feedback" className="underline underline-offset-2">feedback</Link> page.
        </p>
        <p className="text-xs font-mono text-gray-700">
          taxonomy curated 2026-06-05 · LaTeX typesetting via KaTeX · interactive HR diagram, cosmic distance
          ladder, EM-spectrum explorer · {ALL_FAMILIES.length} families · {totalEntries} entries
        </p>
      </div>
    </div>
  );
}
