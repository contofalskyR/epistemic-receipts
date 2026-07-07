/**
 * /api/cron/embed-incremental
 *
 * Nightly incremental embedding job: find claims updated or created in the
 * last 25 hours without a fresh embedding (by contentHash diff), generate
 * embeddings, and upsert into ClaimEmbedding.
 *
 * Security: CRON_SECRET bearer check + isReadOnly() fail-closed.
 * Scheduled nightly at 02:00 UTC in vercel.json.
 *
 * Spend guard: EMBEDDING_MAX_TOKENS_PER_RUN env var.
 * Kill-restart safe: contentHash dedup — re-running won't double-spend.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";
import { makeLogger } from "@/lib/log";
import {
  embedMany3Small,
  buildEmbedText,
  hashContent,
  MODEL_ID,
  getTokensSpent,
  resetTokensSpent,
} from "@/lib/embeddings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const log = makeLogger("embed-incremental");

const BATCH_SIZE = 256;  // smaller than backfill — Vercel function memory budget
const LOOK_BACK_HOURS = 25;  // overlap window to catch stragglers

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    log.warn("CRON_SECRET not set — rejecting request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isReadOnly()) {
    return NextResponse.json({ error: "Read-only mode" }, { status: 503 });
  }

  resetTokensSpent();
  const since = new Date(Date.now() - LOOK_BACK_HOURS * 60 * 60 * 1000);

  log.info(`Incremental embed run — looking back ${LOOK_BACK_HOURS}h from ${since.toISOString()}`);

  // Find recently updated/created non-deleted claims
  type ClaimRow = {
    id: string;
    text: string;
    ingestedBy: string;
    topics: { topic: { name: string } }[];
  };

  const recentClaims = await prisma.claim.findMany({
    where: {
      deleted: false,
      updatedAt: { gte: since },
    },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      text: true,
      ingestedBy: true,
      topics: {
        take: 3,
        select: { topic: { select: { name: true } } },
      },
    },
  }) as ClaimRow[];

  log.info(`Found ${recentClaims.length} recently updated claims`);

  if (recentClaims.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No recent claims to embed",
      embedded: 0,
      skipped: 0,
      tokensSpent: 0,
    });
  }

  // Compute content hashes and filter to changed/new claims
  const candidates = recentClaims.map(c => {
    const topicNames = c.topics.map(t => t.topic.name);
    const text = buildEmbedText(c.text, topicNames, c.ingestedBy);
    return { claim: c, text, hash: hashContent(text) };
  });

  const claimIds = candidates.map(c => c.claim.id);
  const existing = await prisma.$queryRawUnsafe<Array<{ claimId: string; contentHash: string }>>(
    `SELECT "claimId", "contentHash" FROM "ClaimEmbedding" WHERE "claimId" = ANY($1::text[])`,
    claimIds,
  );
  const existingMap = new Map(existing.map(e => [e.claimId, e.contentHash]));

  const toEmbed = candidates.filter(c => existingMap.get(c.claim.id) !== c.hash);
  const skipped = candidates.length - toEmbed.length;

  log.info(`${toEmbed.length} to embed, ${skipped} skipped (contentHash unchanged)`);

  let embeddedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    try {
      const vectors = await embedMany3Small(batch.map(c => c.text));
      await Promise.all(batch.map((c, k) => {
        const vecStr = `[${vectors[k].join(",")}]`;
        return prisma.$executeRawUnsafe(
          `INSERT INTO "ClaimEmbedding" ("id", "claimId", "embedding", "model", "contentHash", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2::vector, $3, $4, NOW())
           ON CONFLICT ("claimId") DO UPDATE SET
             "embedding" = EXCLUDED."embedding",
             "model" = EXCLUDED."model",
             "contentHash" = EXCLUDED."contentHash",
             "updatedAt" = NOW()`,
          c.claim.id,
          vecStr,
          MODEL_ID,
          c.hash,
        );
      }));
      embeddedCount += batch.length;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("spend guard")) {
        log.error(`Spend guard triggered after ${embeddedCount} embeddings: ${msg}`);
        return NextResponse.json({
          ok: false,
          message: "Spend guard triggered",
          embedded: embeddedCount,
          skipped,
          tokensSpent: getTokensSpent(),
          error: msg,
        }, { status: 200 }); // 200 so Vercel doesn't alert-spam; check .ok
      }
      log.error(`Batch error at offset ${i}: ${msg}`);
      errorCount += batch.length;
    }
  }

  const result = {
    ok: errorCount === 0,
    embedded: embeddedCount,
    skipped,
    errors: errorCount,
    tokensSpent: getTokensSpent(),
    estimatedCostUsd: parseFloat((getTokensSpent() / 1_000_000 * 0.02).toFixed(6)),
    model: MODEL_ID,
    since: since.toISOString(),
  };

  log.info(`Done: ${JSON.stringify(result)}`);
  return NextResponse.json(result);
}
