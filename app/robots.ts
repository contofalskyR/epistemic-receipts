import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// One deployment: crawlable, with internal surfaces disallowed, pointing
// crawlers at the sitemap index (app/sitemap.ts). Lab pages need no rule here —
// middleware.ts answers anonymous requests for them with a redirect to /login,
// which is disallowed, so nothing behind the gate can be indexed.
//
// /api/og/ is allowed because link-preview bots honour robots.txt for og:image
// URLs; under RFC 9309 the longest match wins, so the rest of /api/ stays
// disallowed. This route is the only robots.txt: public/ is served before app
// routes, and a stale public/robots.txt shadowed it from 2026-07-13 until front
// door phase 6 (tests/unit/robots.test.ts fails if one reappears).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/og/"],
      disallow: ["/api/", "/login", "/review", "/admin", "/labs/", "/claims/*/edit"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
