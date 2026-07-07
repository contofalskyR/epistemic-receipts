import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Tunnel through our own domain to dodge ad-blockers
  tunnelRoute: "/api/sentry-tunnel",

  // Capture 10% of traces in production; 100% locally for debugging
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Only capture replays on errors to keep storage costs low
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,

  // Disable source maps in the browser (server-side only via SENTRY_AUTH_TOKEN)
  _experiments: {},
});
