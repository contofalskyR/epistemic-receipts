/**
 * Sentry tunnel: proxies browser error reports through our domain to avoid
 * ad-blockers that block *.ingest.sentry.io. Configured in sentry.client.config.ts
 * (tunnelRoute: "/api/sentry-tunnel") and next.config.ts (tunnelRoute same).
 *
 * Security notes:
 * - Validates the Sentry DSN host before forwarding (only our project's ingest host)
 * - Rate-limited in middleware.ts (PUBLIC_WRITE_PATHS + RATE_LIMIT_RULES)
 * - No auth required — browser sessions can't carry admin credentials
 * - Body is forwarded as-is (binary envelope format), no JSON parsing
 */
import { NextRequest, NextResponse } from "next/server";

const MAX_BODY_BYTES = 1_000_000; // 1 MB per Sentry envelope

// Only forward to Sentry's ingest domain — reject anything else
const ALLOWED_SENTRY_HOST = "sentry.io";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return NextResponse.json({ error: "Sentry not configured" }, { status: 503 });
  }

  // Parse the DSN to extract the ingest URL
  let ingestHost: string;
  let projectId: string;
  try {
    const url = new URL(dsn);
    // DSN format: https://<key>@<host>/<project-id>
    ingestHost = url.hostname;
    projectId = url.pathname.replace(/^\//, "");
    if (!ingestHost.endsWith(ALLOWED_SENTRY_HOST)) {
      return NextResponse.json({ error: "Invalid DSN host" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid DSN" }, { status: 500 });
  }

  // Read body with a size cap
  const body = await req.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // Forward to Sentry's envelope endpoint
  const sentryUrl = `https://${ingestHost}/api/${projectId}/envelope/`;
  const upstream = await fetch(sentryUrl, {
    method: "POST",
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/x-sentry-envelope",
    },
    body,
  });

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
