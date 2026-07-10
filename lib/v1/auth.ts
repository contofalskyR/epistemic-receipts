import "server-only";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, incrementUsage, type ApiTier } from "./rateLimit";

export interface AuthResult {
  keyId: string;
  tier: ApiTier;
}

export interface AuthError {
  status: number;
  body: Rfc7807Error;
  headers?: Record<string, string>;
}

export interface Rfc7807Error {
  type: string;
  title: string;
  status: number;
  detail: string;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyApiKey(
  req: NextRequest,
  endpoint: string,
): Promise<AuthResult | AuthError> {
  const authHeader = req.headers.get("authorization") ?? "";
  const raw = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!raw || !raw.startsWith("er_live_")) {
    return {
      status: 401,
      body: {
        type: "https://epistemic-receipts.app/errors/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail:
          "A valid API key is required. Obtain one at https://epistemic-receipts.app/docs/api#signup",
      },
    };
  }

  const hash = await sha256Hex(raw);
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash: hash } });

  if (!apiKey || apiKey.revokedAt) {
    return {
      status: 401,
      body: {
        type: "https://epistemic-receipts.app/errors/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: apiKey?.revokedAt ? "API key has been revoked." : "Invalid API key.",
      },
    };
  }

  // Fail closed on expiry (SECURITY-ASSESSMENT-2026-07-09 finding #8): a key
  // past its expiresAt is rejected like a revoked key. Keys with no expiresAt
  // never expire. Checked before rate limiting so expired keys consume no
  // quota and record no usage.
  if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
    return {
      status: 401,
      body: {
        type: "https://epistemic-receipts.app/errors/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: `API key expired on ${apiKey.expiresAt.toISOString()}.`,
      },
    };
  }

  const tier = apiKey.tier as ApiTier;
  const { allowed, remaining, limit, retryAfter } = await checkRateLimit(apiKey.id, tier);

  if (!allowed) {
    return {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter ?? 60),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
      },
      body: {
        type: "https://epistemic-receipts.app/errors/rate-limited",
        title: "Too Many Requests",
        status: 429,
        detail: `Rate limit exceeded. Tier: ${tier}, limit: ${limit} req/min. Retry after ${retryAfter ?? 60}s.`,
      },
    };
  }

  // Fire-and-forget: update lastUsedAt and increment usage counter
  void Promise.all([
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }),
    incrementUsage(apiKey.id, endpoint),
  ]).catch(() => {});

  return {
    keyId: apiKey.id,
    tier,
    // Add rate limit headers as extra info the route can attach
    ...({ _rateHeaders: { "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": String(remaining) } } as object),
  };
}

export function isAuthError(r: AuthResult | AuthError): r is AuthError {
  return "status" in r && "body" in r;
}

export function rfc7807(status: number, title: string, detail: string): Rfc7807Error {
  return {
    type: `https://epistemic-receipts.app/errors/${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    status,
    detail,
  };
}
