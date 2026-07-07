import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of traces in production; 100% locally for debugging
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Only capture replays on errors to keep storage costs low
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,
});

// Note: tunnelRoute ("/api/sentry-tunnel") is configured in next.config.ts
// via withSentryConfig({ tunnelRoute: "/api/sentry-tunnel" })

