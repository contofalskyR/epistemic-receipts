/**
 * Distributed sliding-window rate limiting via Upstash Redis REST API.
 * Falls back to allowing the request (fail-open) if Redis is unavailable.
 *
 * Per-tier limits (requests per minute):
 *   free: 60   pro: 600   team: 3000   enterprise: custom (10000)
 */

export type ApiTier = "free" | "pro" | "team" | "enterprise";

const TIER_LIMITS: Record<ApiTier, number> = {
  free: 60,
  pro: 600,
  team: 3000,
  enterprise: 10000,
};

const DAILY_LIMITS: Record<ApiTier, number> = {
  free: 10000,
  pro: 100000,
  team: 1000000,
  enterprise: Infinity,
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter?: number;
}

async function upstashCommand(commands: unknown[][]): Promise<unknown[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Upstash not configured");

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error(`Upstash error: ${res.status}`);
  const data = (await res.json()) as { result: unknown }[];
  return data.map(d => d.result);
}

export async function checkRateLimit(keyId: string, tier: ApiTier): Promise<RateLimitResult> {
  const limit = TIER_LIMITS[tier];
  const windowSec = 60;
  const now = Date.now();
  const windowStart = now - windowSec * 1000;
  const redisKey = `rl:${keyId}`;

  try {
    const [, , count] = await upstashCommand([
      ["ZREMRANGEBYSCORE", redisKey, "-inf", windowStart],
      ["ZADD", redisKey, now, `${now}-${Math.random()}`],
      ["ZCARD", redisKey],
      ["EXPIRE", redisKey, windowSec * 2],
    ]);

    const current = typeof count === "number" ? count : 0;
    if (current > limit) {
      return { allowed: false, remaining: 0, limit, retryAfter: windowSec };
    }
    return { allowed: true, remaining: Math.max(0, limit - current), limit };
  } catch {
    // Fail-open: Redis outage → allow request
    console.error("[rateLimit] Redis unavailable, failing open");
    return { allowed: true, remaining: -1, limit };
  }
}

export async function incrementUsage(keyId: string, endpoint: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const hashKey = `usage:${keyId}:${date}`;
  try {
    await upstashCommand([["HINCRBY", hashKey, endpoint, 1]]);
  } catch {
    // Best-effort — don't fail the request over usage tracking
  }
}

export async function getUsageTotals(
  keyId: string,
  date: string,
): Promise<Record<string, number>> {
  const hashKey = `usage:${keyId}:${date}`;
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return {};
    const res = await fetch(`${url}/hgetall/${hashKey}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { result: string[] | null };
    if (!data.result) return {};
    const totals: Record<string, number> = {};
    for (let i = 0; i < data.result.length; i += 2) {
      totals[data.result[i]] = Number(data.result[i + 1]) || 0;
    }
    return totals;
  } catch {
    return {};
  }
}

export { TIER_LIMITS, DAILY_LIMITS };
