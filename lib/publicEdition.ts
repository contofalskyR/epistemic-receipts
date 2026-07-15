// ─── Public-edition switch ────────────────────────────────────────────────────
// One repo, one branch, two Vercel projects, one env var. (PUBLISH-CHECKLIST.md)
//
//   NEXT_PUBLIC_EDITION=public → the publishable site: page routes are
//     deny-by-default against PUBLIC_ROUTES below, the ⚗ Lab nav group is
//     hidden, robots.txt allows crawling.
//   NEXT_PUBLIC_EDITION=lab    → robots.txt disallows everything (the lab
//     stays out of search indexes); no page gating beyond ADMIN_PATHS.
//   unset                      → today's behavior, completely unchanged.
//
// Setting up the public project:
//   1. Vercel → New Project → same repo, production branch `main`.
//   2. Env on the public project: NEXT_PUBLIC_EDITION=public, a READ-ONLY
//      Postgres role's connection string as DATABASE_URL, no ALLOW_EDITS,
//      no ADMIN_TOKEN (the public edition has no auth surface at all).
//   3. Attach the custom domain to the public project.
//   4. On this (lab) project: NEXT_PUBLIC_EDITION=lab, and once the public
//      domain is live, set SITE_PASSWORD to take the lab private again.
//
// NEXT_PUBLIC_* is inlined at build time, so each Vercel project bakes its
// own edition into both server (middleware) and client (Nav) bundles.

export const EDITION = process.env.NEXT_PUBLIC_EDITION ?? "";
export const IS_PUBLIC_EDITION = EDITION === "public";
export const IS_LAB_EDITION = EDITION === "lab";

// Page prefixes reachable on the public edition. DENY-BY-DEFAULT: a new route
// does not ship publicly until it is added here — the publish decision is one
// reviewable diff. /api/* is not gated here (reads are public; writes are
// already admin-gated in middleware).
export const PUBLIC_ROUTES: string[] = [
  "/",
  "/about",
  "/corrections",
  "/case-studies",
  // Explore
  "/settling-curve",
  "/search",
  "/trajectories",
  "/fields",
  "/prereq-graph",
  // Analyze
  "/analysis",
  "/congress-trades",
  "/stock-act",
  "/votes",
  "/members",
  "/financial",
  // Discover
  "/retraction-explorer",
  "/retraction-wall",
  "/retractions",
  "/meta-edges",
  "/opinions",
  "/law-settler",
  "/open-questions",
  "/split-ledger",
  "/start-here",
  "/stories",
  "/reversals",
  // Research
  "/feed",
  "/sources",
  "/datasets",
  "/pipelines",
  "/glossary",
  // Graph browsing
  "/claims",
  "/topics",
  "/domains",
  "/historical-events",
  "/timeline",
  "/globe",
  "/books",
  "/reader",
  "/legislation",
  "/foreign-legislation",
  "/drug-arc",
  "/stats",
  "/statistics",
  "/feedback",
  // Legal — footer-linked from every page; must resolve on the public edition
  "/terms",
  "/privacy",
  "/license",
  // Embeds — publicly accessible iframes (no auth cookie required)
  "/embed",
  // Domain taxonomies (curated navigation aids — see /about)
  "/anthropology", "/astronomy", "/biology", "/chemistry", "/communication",
  "/computer-science", "/earth-sciences", "/economics", "/education",
  "/engineering", "/environmental-science", "/finance", "/geology",
  "/governance", "/history", "/ideologies", "/ip-law", "/law", "/linguistics",
  "/logic", "/mathematics", "/medicine", "/neuroscience", "/pharmacology",
  "/philosophy", "/physics", "/physiology", "/psychology", "/public-health",
  "/security-studies", "/sociology", "/sports", "/tax-law",
];

// Denials that would otherwise pass a prefix match above.
const DENY_EXACT: string[] = ["/globe/lab"];
const DENY_PATTERNS: RegExp[] = [/^\/claims\/[^/]+\/edit(\/|$)/];

export function isPublicRoute(pathname: string): boolean {
  if (DENY_EXACT.some((d) => pathname === d || pathname.startsWith(d + "/"))) return false;
  if (DENY_PATTERNS.some((p) => p.test(pathname))) return false;
  if (pathname === "/") return true;
  return PUBLIC_ROUTES.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/"))
  );
}
