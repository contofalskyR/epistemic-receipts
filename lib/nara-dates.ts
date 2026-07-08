/**
 * nara-dates.ts — shared NARA record date extraction, used by both the API
 * sweep (backfill-nara-dates-api.ts) and the bulk-dataset sweep
 * (backfill-nara-dates-bulk.ts). Extracted 2026-07-08 during the bulk pivot.
 *
 * A NARA description record carries dates in several shapes: strings
 * ("12/7/1941", "1941"), logical-date objects ({year, month?, day?} or
 * {logicalDate: "1941-12-07T00:00:00"}), and arrays of either. Priority keys
 * first (productionDates beat coverage dates beat begin/end), then a bounded
 * recursive scan for any /date/i-named field — same honest-precision parsing
 * throughout, null over guess.
 */

import { parseWestern, parseDateParts, type ParsedDate } from "./date-parsers";

export type NaraJson = Record<string, unknown>;

export const NARA_PRIORITY_KEYS = [
  "productionDates", "productionDate", "coverageStartDate", "inclusiveStartDate",
  "beginDate", "coverageEndDate", "inclusiveEndDate", "endDate",
];

export function tryNaraValue(v: unknown): ParsedDate | null {
  if (typeof v === "string") return parseWestern(v);
  if (Array.isArray(v)) {
    for (const item of v) {
      const p = tryNaraValue(item);
      if (p) return p;
    }
    return null;
  }
  if (v && typeof v === "object") {
    const o = v as NaraJson;
    const fromParts = parseDateParts(o);
    if (fromParts) return fromParts;
    if (typeof o.logicalDate === "string") return parseWestern(o.logicalDate);
    if (typeof o.dateQualifier !== "undefined" && typeof o.year !== "undefined") return parseDateParts(o);
  }
  return null;
}

/** Branches whose dates belong to OTHER entities, never to this record:
 *  ancestors = the parent series / record group (their inclusive dates span
 *  decades — dating an item by them would fabricate); creators = the agency
 *  (establishDate is the FBI's founding, not the file's date). Bulk-dataset
 *  records carry both inline (verified 2026-07-08). */
const NARA_EXCLUDE_BRANCHES = new Set(["ancestors", "creators", "donors", "contributors", "referenceUnits"]);

/** Priority keys first, then a recursive scan for any /date/i-named field —
 *  skipping branches that describe parent/creator entities. */
export function extractNaraDate(record: NaraJson): { parsed: ParsedDate; field: string } | null {
  for (const key of NARA_PRIORITY_KEYS) {
    if (key in record) {
      const p = tryNaraValue(record[key]);
      if (p) return { parsed: p, field: key };
    }
  }
  const found: { parsed: ParsedDate; field: string }[] = [];
  const walk = (obj: NaraJson, prefix: string, depth: number) => {
    if (depth > 3) return;
    for (const [k, v] of Object.entries(obj)) {
      if (NARA_EXCLUDE_BRANCHES.has(k)) continue;
      const path = prefix ? `${prefix}.${k}` : k;
      if (/date/i.test(k)) {
        const p = tryNaraValue(v);
        if (p) found.push({ parsed: p, field: path });
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        walk(v as NaraJson, path, depth + 1);
      }
    }
  };
  walk(record, "", 0);
  return found[0] ?? null;
}

/** Field-name inventory (sample/preflight modes): which date-ish fields exist.
 *  Same branch exclusions as extraction, so the report reflects usable fields. */
export function naraDateFieldInventory(record: NaraJson, into: Map<string, number>) {
  const walk = (obj: NaraJson, prefix: string, depth: number) => {
    if (depth > 3) return;
    for (const [k, v] of Object.entries(obj)) {
      if (NARA_EXCLUDE_BRANCHES.has(k)) continue;
      const path = prefix ? `${prefix}.${k}` : k;
      if (/date/i.test(k) && v != null && v !== "") into.set(path, (into.get(path) ?? 0) + 1);
      if (v && typeof v === "object" && !Array.isArray(v)) walk(v as NaraJson, path, depth + 1);
    }
  };
  walk(record, "", 0);
}
