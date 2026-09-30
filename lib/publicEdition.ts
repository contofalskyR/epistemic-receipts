// ─── The public route list ───────────────────────────────────────────────────
//
// One deployment (STATUS.md, locked 2026-09-30). Page routes are deny-by-default:
// a request for anything not listed here needs the admin session — middleware.ts
// answers with the admin gate (redirect to /login?from=…) — and the ⚗ Lab nav
// group renders only for that session. There is no second Vercel project and no
// NEXT_PUBLIC_EDITION flag any more; this list IS the front door.
//
// Matching is EXACT. Listing pages are listed by path; pages with a dynamic
// segment are listed as patterns. Never prefix-match: the old prefix matcher
// meant "drop /claims" would have 404'd every /claims/<id> receipt — the
// canonical URL emitted by /api/v1/verify, /api/mcp, EmbedButton and the sitemap.
//
// Buckets come from AUDIT.md §B (FRONT DOOR vs LAB). A new page ships publicly
// only when it is added here — one reviewable diff. /api/* is not gated by this
// list (reads are public; writes are admin-gated in middleware.ts).

export const PUBLIC_ROUTES: string[] = [
  "/",
  "/about",
  "/methodology",
  "/communities",
  "/corrections",
  "/glossary",
  "/feedback",
  // Onboarding index. AUDIT.md §B buckets it LAB (duplicates home/stories), but
  // /, /patterns, /open-questions and the 404 page all point newcomers here, and
  // Phase 1 fixed its counts — kept public until Phase 3 folds it in.
  "/start-here",
  // The six top-nav destinations (AUDIT.md §D)
  "/settling-curve",
  "/search",
  "/opinions",
  "/retraction-explorer",
  "/split-ledger",
  "/reversals",
  // Receipt surfaces surfaced from the homepage and /settling-curve
  "/trajectories",
  "/case-studies",
  "/canon",
  "/patterns",
  "/law-settler",
  "/open-questions",
  "/stories",
  "/stories/cfc-ozone-depletion",
  "/stories/cold-fusion",
  "/stories/continental-drift",
  "/stories/dietary-fat-heart",
  "/stories/h-pylori",
  "/stories/semaglutide-glp1",
  "/stories/smoking-lung-cancer",
  "/stories/voting-rights-act-1965",
  // Provenance
  "/sources",
  "/datasets",
  // Legal — footer-linked from every page
  "/terms",
  "/privacy",
  "/license",
];

// Pages with a dynamic segment. One pattern per page file; `[^/]+` is one segment.
export const PUBLIC_PATTERNS: RegExp[] = [
  /^\/claims\/[^/]+$/, // app/claims/[id] — the receipt. Never move (AUDIT.md §F.2).
  /^\/settling-curve\/[^/]+$/, // app/settling-curve/[id] — trajectory permalink. Never move.
  /^\/topics\/[^/]+$/, // app/topics/[slug] — topic claims; the /topics tree itself is Lab.
  /^\/datasets\/[^/]+$/, // app/datasets/[tag] — provenance card.
  /^\/embed\/trajectory\/[^/]+$/, // third-party iframes. Never move.
];

// Lab pages that a pattern above would otherwise admit, or listing pages whose
// children are public while the listing itself is Lab (AUDIT.md §B).
export const DENY_EXACT: string[] = [
  "/claims", // 336k-row dump, superseded by /search
  "/topics", // topic tree
  "/settling-curve/coverage",
  "/settling-curve/overview",
  "/datasets/snapshots", // empty snapshot list
];
const DENY_PATTERNS: RegExp[] = [/^\/claims\/[^/]+\/edit(\/|$)/];

/** Path only: no query, no hash, no trailing slash (except "/"). */
function normalize(pathname: string): string {
  const path = pathname.split(/[?#]/)[0];
  return path.length > 1 ? path.replace(/\/+$/, "") : path || "/";
}

export function isPublicRoute(pathname: string): boolean {
  const p = normalize(pathname);
  if (DENY_EXACT.includes(p)) return false;
  if (DENY_PATTERNS.some((r) => r.test(p))) return false;
  if (PUBLIC_ROUTES.includes(p)) return true;
  return PUBLIC_PATTERNS.some((r) => r.test(p));
}
