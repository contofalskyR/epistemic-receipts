import { classifyCurveShape, CURVE_SHAPE_LABELS, type CurveShape } from "@/lib/curve-shapes";

// URL-synced filters for the /settling-curve explorer (phase 6b). Pure and
// client-safe: SettlingCurve.tsx derives its filters from useSearchParams()
// through parseExplorerFilters and writes them back with
// window.history.replaceState, so a filter change never refetches the list.
// Invalid values are ignored, so a stale or hand-edited link still loads.

export type StatusFilter = "ALL" | "SETTLED" | "REVERSED" | "CONTESTED";
export type SortKey = "default" | "transitions" | "span" | "recent";

export type ExplorerFilters = {
  q: string;
  status: StatusFilter;
  /** Full era label as stored on list items ("Cold War & Postwar"), or "ALL". */
  era: string;
  domain: string;
  shape: CurveShape | null;
  /** Inclusive range on the claim's emergence year (UTC). */
  from: number | null;
  to: number | null;
  curated: boolean;
  sort: SortKey;
};

export const DEFAULT_FILTERS: ExplorerFilters = {
  q: "",
  status: "ALL",
  era: "ALL",
  domain: "ALL",
  shape: null,
  from: null,
  to: null,
  curated: false,
  sort: "default",
};

/** URL slug → era label (lib/trajectory-list.ts classifyEra). */
export const ERA_SLUGS: Record<string, string> = {
  ancient: "Ancient & Classical",
  medieval: "Medieval & Islamic Golden Age",
  "early-modern": "Early Modern",
  industrial: "Industrial & Colonial",
  "wwi-wwii": "WWI / WWII & Interwar",
  "cold-war": "Cold War & Postwar",
  modern: "Modern",
};
const ERA_TO_SLUG = Object.fromEntries(Object.entries(ERA_SLUGS).map(([slug, label]) => [label, slug]));

/** lib/trajectory-list.ts classifyDomain values. */
export const DOMAINS = ["medicine", "astronomy", "climate", "nutrition", "law", "politics", "science", "history", "global"] as const;

const STATUSES: StatusFilter[] = ["SETTLED", "REVERSED", "CONTESTED"];
const SORTS: SortKey[] = ["transitions", "span", "recent"];
const SHAPES = Object.keys(CURVE_SHAPE_LABELS) as CurveShape[];
const FILTER_KEYS = ["q", "status", "era", "domain", "shape", "from", "to", "curated", "sort"] as const;
const MAX_Q = 200;

type ParamSource = { get(name: string): string | null };

function year(v: string | null): number | null {
  if (v === null || !/^-?\d{1,4}$/.test(v.trim())) return null;
  return Number(v.trim());
}

export function parseExplorerFilters(sp: ParamSource): ExplorerFilters {
  const status = (sp.get("status") ?? "").toUpperCase() as StatusFilter;
  const era = ERA_SLUGS[sp.get("era") ?? ""];
  const domain = (sp.get("domain") ?? "").toLowerCase();
  const shape = sp.get("shape") as CurveShape | null;
  const sort = sp.get("sort") as SortKey | null;
  return {
    q: (sp.get("q") ?? "").slice(0, MAX_Q),
    status: STATUSES.includes(status) ? status : "ALL",
    era: era ?? "ALL",
    domain: (DOMAINS as readonly string[]).includes(domain) ? domain : "ALL",
    shape: shape && SHAPES.includes(shape) ? shape : null,
    from: year(sp.get("from")),
    to: year(sp.get("to")),
    curated: sp.get("curated") === "1",
    sort: sort && SORTS.includes(sort) ? sort : "default",
  };
}

/** The query string for `f`, keeping every non-filter param of `base` (e.g. t). */
export function serializeExplorerFilters(f: ExplorerFilters, base: URLSearchParams = new URLSearchParams()): string {
  const sp = new URLSearchParams(base);
  for (const k of FILTER_KEYS) sp.delete(k);
  const q = f.q.trim().slice(0, MAX_Q);
  if (q) sp.set("q", q);
  if (f.status !== "ALL") sp.set("status", f.status);
  if (f.era !== "ALL" && ERA_TO_SLUG[f.era]) sp.set("era", ERA_TO_SLUG[f.era]);
  if (f.domain !== "ALL") sp.set("domain", f.domain);
  if (f.shape) sp.set("shape", f.shape);
  if (f.from !== null) sp.set("from", String(f.from));
  if (f.to !== null) sp.set("to", String(f.to));
  if (f.curated) sp.set("curated", "1");
  if (f.sort !== "default") sp.set("sort", f.sort);
  return sp.toString();
}

export function hasActiveFilters(f: ExplorerFilters): boolean {
  return serializeExplorerFilters(f) !== "";
}

export type FilterableItem = {
  claim: string;
  hasReversal: boolean;
  currentAxis?: string | null;
  era?: string;
  domain?: string;
  isCurated?: boolean;
  emergedYear?: number | null;
  transitionCount?: number;
  firstYear?: number | null;
  lastYear?: number | null;
  milestones?: { axis: string }[];
};

export function matchesStatus(item: FilterableItem, f: StatusFilter): boolean {
  if (f === "ALL") return true;
  if (f === "REVERSED") return item.hasReversal;
  return !item.hasReversal && item.currentAxis === f;
}

/** The /patterns shape of an item's curve, or null below two milestones. */
export function itemShape(item: FilterableItem): CurveShape | null {
  const axes = (item.milestones ?? []).map((m) => m.axis);
  return axes.length >= 2 ? classifyCurveShape(axes) : null;
}

export function applyExplorerFilters<T extends FilterableItem>(list: T[], f: ExplorerFilters): T[] {
  const q = f.q.trim().toLowerCase();
  const ranged = f.from !== null || f.to !== null;
  return list.filter((item) => {
    if (q && !item.claim.toLowerCase().includes(q)) return false;
    if (!matchesStatus(item, f.status)) return false;
    if (f.era !== "ALL" && (item.era ?? "Unknown") !== f.era) return false;
    if (f.domain !== "ALL" && (item.domain ?? "history") !== f.domain) return false;
    if (f.curated && item.isCurated === false) return false;
    if (f.shape && itemShape(item) !== f.shape) return false;
    if (ranged) {
      const y = item.emergedYear;
      if (y === null || y === undefined) return false;
      if (f.from !== null && y < f.from) return false;
      if (f.to !== null && y > f.to) return false;
    }
    return true;
  });
}

/** Stable sort; "default" keeps the API order (curated, then newest auto). */
export function sortExplorerList<T extends FilterableItem>(list: T[], sort: SortKey): T[] {
  if (sort === "default") return list;
  const key = (i: T): number =>
    sort === "transitions"
      ? (i.transitionCount ?? 0)
      : sort === "span"
        ? (i.lastYear ?? 0) - (i.firstYear ?? i.lastYear ?? 0)
        : (i.lastYear ?? Number.NEGATIVE_INFINITY);
  return [...list].sort((a, b) => key(b) - key(a));
}
