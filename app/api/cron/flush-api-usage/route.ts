/**
 * Nightly cron: flush Redis usage hashes → ApiUsage Postgres rows.
 *
 * Redis key pattern: usage:{keyId}:{YYYY-MM-DD}
 * Each hash field = endpoint name, value = request count.
 * After flushing, delete the processed Redis keys.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function upstashPipeline(commands: unknown[][]): Promise<unknown[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return [];
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { result: unknown }[];
  return data.map(d => d.result);
}

async function upstashScan(pattern: string): Promise<string[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return [];

  const keys: string[] = [];
  let cursor = "0";
  do {
    const res = await fetch(`${url}/scan/${cursor}?match=${encodeURIComponent(pattern)}&count=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) break;
    const data = (await res.json()) as { result: [string, string[]] };
    cursor = data.result[0];
    keys.push(...data.result[1]);
  } while (cursor !== "0");

  return keys;
}

export async function GET(req: NextRequest) {
  // Fail closed: an unset CRON_SECRET must reject, not skip the check.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return NextResponse.json({ skipped: true, reason: "Upstash not configured" });
  }

  // Find all usage hash keys from yesterday and earlier (never flush today's partial data)
  const today = new Date().toISOString().slice(0, 10);
  const keys = await upstashScan("usage:*");
  const eligibleKeys = keys.filter(k => {
    const parts = k.split(":");
    return parts.length === 3 && parts[2] < today;
  });

  if (eligibleKeys.length === 0) {
    return NextResponse.json({ flushed: 0 });
  }

  let flushed = 0;
  const errors: string[] = [];

  for (const key of eligibleKeys) {
    const parts = key.split(":");
    const keyId = parts[1];
    const date = parts[2];

    try {
      // HGETALL then DELETE atomically
      const [rawHash] = await upstashPipeline([["HGETALL", key]]);
      const flatArr = rawHash as string[] | null;
      if (!flatArr || flatArr.length === 0) {
        await upstashPipeline([["DEL", key]]);
        continue;
      }

      // Parse flat array into endpoint → count pairs
      const entries: { endpoint: string; count: number }[] = [];
      for (let i = 0; i < flatArr.length; i += 2) {
        entries.push({ endpoint: flatArr[i], count: Number(flatArr[i + 1]) || 0 });
      }

      // Upsert ApiUsage rows
      await prisma.$transaction(
        entries.map(e =>
          prisma.apiUsage.upsert({
            where: { keyId_date_endpoint: { keyId, date, endpoint: e.endpoint } },
            create: { keyId, date, endpoint: e.endpoint, count: e.count },
            update: { count: { increment: e.count } },
          }),
        ),
      );

      // Delete from Redis only after successful DB write
      await upstashPipeline([["DEL", key]]);
      flushed += entries.length;
    } catch (err) {
      errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ flushed, errors: errors.length > 0 ? errors : undefined });
}
