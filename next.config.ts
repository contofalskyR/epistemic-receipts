import type { NextConfig } from "next";

const securityHeaders = [
  // Force HTTPS for two years, including subdomains (site is Vercel-hosted, always HTTPS)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      // 'unsafe-inline' required: Next.js App Router injects inline scripts for RSC streaming
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel-scripts.com",
      // Inline styles required by Tailwind v4
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self + data URIs (globe textures) + any https
      "img-src 'self' data: blob: https:",
      // WebGL canvas needs blob: workers; three.js needs worker-src
      "worker-src 'self' blob:",
      // connect-src: self + Vercel analytics + any HTTPS APIs the client calls
      "connect-src 'self' https:",
      // Frames WE may embed (LinkViewer's original-page fallback). Without an
      // explicit frame-src, default-src 'self' blocked every external iframe —
      // the browser's "This content is blocked" page for all source links.
      // frame-ancestors below still forbids anyone from embedding US.
      "frame-src 'self' https:",
      "frame-ancestors 'none'",
      // Objects
      "object-src 'none'",
      // Base URI
      "base-uri 'self'",
      // Default
      "default-src 'self'",
    ]
      .join("; ")
      .trim(),
  },
];

// CSP for /embed/* — identical to global but frame-ancestors is open so
// third-party sites can embed the trajectory widget.
const embedCsp = securityHeaders
  .find(h => h.key === "Content-Security-Policy")!
  .value.replace("frame-ancestors 'none'", "frame-ancestors *");

const nextConfig: NextConfig = {
  // jsdom removed 2026-07-06: even externalized it crashed the deployed
  // /api/proxy/reader function (500 before any JSON reached the client).
  // The route now uses linkedom, which bundles cleanly.
  serverExternalPackages: ["pdf-parse"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Allow embedding from any origin for embed pages only.
        // Overrides the global X-Frame-Options and frame-ancestors for /embed/* only.
        source: "/embed/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: embedCsp },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      // /sitemap.xml is claimed by the metadata convention (app/sitemap.ts with
      // generateSitemaps) yet served nothing; a route file there conflicts at
      // build time. Serve the index from /sitemap-index.xml before the
      // filesystem is consulted so the URL robots.txt advertises resolves.
      beforeFiles: [{ source: "/sitemap.xml", destination: "/sitemap-index.xml" }],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    return [
      { source: "/stock-act", destination: "/congress-trades", permanent: true },
      // B9-3: /foreign-legislation folded into /legislation (same data, US-inclusive UI).
      // Nav entry removed; permanent redirect ensures old bookmarks and links land correctly.
      { source: "/foreign-legislation", destination: "/legislation", permanent: true },
      // Former redirect-stub pages (front door phase 0). Exact sources only:
      // /reader/[bookId] is a real page and must keep rendering.
      { source: "/timeline", destination: "/settling-curve", permanent: true },
      { source: "/reader", destination: "/books", permanent: true },
    ];
  },
};

export default nextConfig;
