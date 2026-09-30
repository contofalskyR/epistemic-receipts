import manifest from "./route-manifest.json";

// The page routes that exist, generated at build time from app/**/page.tsx by
// scripts/gen-route-manifest.mjs (front door phase 3). middleware.ts uses it
// to tell "Lab page" (admin gate) from "no such page" (real 404) — the public
// list in lib/publicEdition.ts alone cannot make that distinction.

const ROUTES = new Set<string>(manifest.routes);
const PATTERNS: RegExp[] = manifest.patterns.map((p) => new RegExp(p));

/** Path only: no query, no hash, no trailing slash (except "/"). */
function normalize(pathname: string): string {
  const path = pathname.split(/[?#]/)[0];
  return path.length > 1 ? path.replace(/\/+$/, "") : path || "/";
}

/** Does a page file exist for this path? */
export function isKnownRoute(pathname: string): boolean {
  const p = normalize(pathname);
  if (ROUTES.has(p)) return true;
  return PATTERNS.some((r) => r.test(p));
}

export const ROUTE_MANIFEST = manifest;
