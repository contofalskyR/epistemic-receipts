/**
 * date-parsers.ts — shared honest-precision date parsing for backfill scripts.
 * Extracted from backfill-emergence-dates.ts (which executes on import, so it
 * can't be imported) for reuse by the NARA API sweep and future sweeps.
 *
 * House rule everywhere: return null rather than guess. "ca. 1920" is the
 * author saying the date is approximate — that's a skip, not a YEAR.
 */

export type BackfillPrecision = "DAY" | "MONTH" | "YEAR";
export interface ParsedDate {
  date: Date;
  precision: BackfillPrecision;
}

export const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function utcDate(y: number, m = 1, d = 1): Date | null {
  if (y < 1 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return isNaN(dt.getTime()) || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d ? null : dt;
}

/** ISO, ISO datetime, bare year, year-range start, US M/D/YYYY, "Month D, YYYY". */
export function parseWestern(raw: string): ParsedDate | null {
  const s = raw.trim();
  if (!s) return null;

  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); // also matches "1941-12-07T00:00:00"
  if (m) { const d = utcDate(+m[1], +m[2], +m[3]); return d ? { date: d, precision: "DAY" } : null; }

  m = /^(\d{4})-(\d{2})$/.exec(s);
  if (m) { const d = utcDate(+m[1], +m[2]); return d ? { date: d, precision: "MONTH" } : null; }

  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); // NARA US-style
  if (m) { const d = utcDate(+m[3], +m[1], +m[2]); return d ? { date: d, precision: "DAY" } : null; }

  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s); // "December 7, 1941"
  if (m) {
    const mo = MONTH_ABBR[m[1].slice(0, 3).toLowerCase()];
    if (mo) { const d = utcDate(+m[3], mo, +m[2]); return d ? { date: d, precision: "DAY" } : null; }
  }

  m = /^(\d{4})(?:\s*[-–—/]\s*\d{2,4})?$/.exec(s); // "1941" or "1941-1945" → start, YEAR
  if (m) { const d = utcDate(+m[1]); return d ? { date: d, precision: "YEAR" } : null; }

  return null;
}

/** Japanese era dates: 明治/大正/昭和/平成/令和 + 年/月/日, full-width digits ok. */
const ERA_BASE: Record<string, number> = { 明治: 1868, 大正: 1912, 昭和: 1926, 平成: 1989, 令和: 2019 };

export function parseJapanese(raw: string): ParsedDate | null {
  const s = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim();
  const m = /(明治|大正|昭和|平成|令和)\s*(\d{1,2}|元)\s*年(?:\s*(\d{1,2})\s*月)?(?:\s*(\d{1,2})\s*日)?/.exec(s);
  if (!m) return null;
  const year = ERA_BASE[m[1]] + (m[2] === "元" ? 1 : +m[2]) - 1;
  if (m[3] && m[4]) { const d = utcDate(year, +m[3], +m[4]); return d ? { date: d, precision: "DAY" } : null; }
  if (m[3]) { const d = utcDate(year, +m[3]); return d ? { date: d, precision: "MONTH" } : null; }
  const d = utcDate(year);
  return d ? { date: d, precision: "YEAR" } : null;
}

/** UK covering dates: "1947 Jan 3-June18" → 1947-01 (MONTH); "1949" → YEAR. */
export function parseCoveringDates(raw: string): ParsedDate | null {
  const m = /^(\d{4})(?:\s+([A-Za-z]{3,9}))?/.exec(raw.trim());
  if (!m) return null;
  const mo = m[2] ? MONTH_ABBR[m[2].slice(0, 3).toLowerCase()] : undefined;
  const d = mo ? utcDate(+m[1], mo) : utcDate(+m[1]);
  return d ? { date: d, precision: mo ? "MONTH" : "YEAR" } : null;
}

/** NARA logical-date objects: { year, month?, day? } — precision from parts. */
export function parseDateParts(v: unknown): ParsedDate | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const y = typeof o.year === "number" ? o.year : typeof o.year === "string" ? parseInt(o.year, 10) : NaN;
  if (!Number.isFinite(y)) return null;
  const mo = typeof o.month === "number" ? o.month : typeof o.month === "string" ? parseInt(o.month, 10) : undefined;
  const dy = typeof o.day === "number" ? o.day : typeof o.day === "string" ? parseInt(o.day, 10) : undefined;
  if (mo && dy) { const d = utcDate(y, mo, dy); return d ? { date: d, precision: "DAY" } : null; }
  if (mo) { const d = utcDate(y, mo); return d ? { date: d, precision: "MONTH" } : null; }
  const d = utcDate(y);
  return d ? { date: d, precision: "YEAR" } : null;
}
