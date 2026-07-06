import type { MetadataRoute } from "next";
import { IS_LAB_EDITION } from "@/lib/publicEdition";

// Edition-aware robots (replaces the old static public/robots.txt):
//   lab edition    → Disallow everything; the lab must never be indexed once
//                    the public domain exists.
//   public / unset → crawlable, with internal surfaces disallowed. A Sitemap:
//                    directive should be added here when briefing 04 ships
//                    sitemap.ts.
export default function robots(): MetadataRoute.Robots {
  if (IS_LAB_EDITION) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/login", "/review", "/admin", "/edges", "/labs/", "/globe/lab", "/claims/*/edit"],
    },
  };
}
