import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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

const nextConfig: NextConfig = {
  // jsdom removed 2026-07-06: even externalized it crashed the deployed
  // /api/proxy/reader function (500 before any JSON reached the client).
  // The route now uses linkedom, which bundles cleanly.
  serverExternalPackages: ["ws", "@neondatabase/serverless", "@prisma/adapter-neon", "pdf-parse", "@xenova/transformers"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      { source: "/stock-act", destination: "/congress-trades", permanent: true },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Suppress Sentry CLI output during builds
  silent: !process.env.CI,

  // Upload sourcemaps only when SENTRY_AUTH_TOKEN is set (CI + production builds)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  // Tunnel path — keep in sync with sentry.client.config.ts tunnelRoute
  tunnelRoute: "/api/sentry-tunnel",

  // Tree-shake Sentry SDK server-side modules we don't use
  disableLogger: true,
  automaticVercelMonitors: false,
});
