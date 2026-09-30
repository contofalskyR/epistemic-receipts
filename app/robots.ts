import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// One deployment: crawlable, with internal surfaces disallowed, pointing
// crawlers at the sitemap index (app/sitemap.ts). Lab pages need no rule here —
// middleware.ts answers anonymous requests for them with a redirect to /login,
// which is disallowed, so nothing behind the gate can be indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/login", "/review", "/admin", "/labs/", "/claims/*/edit"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
