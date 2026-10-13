/**
 * correct-senate-cloture.ts — Phase 7 batch 1 (owner decision 2026-10-12).
 *
 * voteview_v1 claims for Senate cloture votes since 1989 say "passed"/"tied"
 * because scripts/ingest-voteview.ts inferred results as yea > nay. Voteview's
 * own vote_result says the cloture motion was rejected. Per vote this fixes:
 *   Claim.text            trailing " — passed." / " — tied." → " — failed."
 *   Claim.metadata        result → "failed"; corrections[] += {batch, date,
 *                         before, after, Voteview evidence, by}
 *   LegislativeVote       result → "failed"; passageThreshold from Voteview's
 *                         majority_requirement (3/5 → three_fifths, …)
 * No ClaimStatusHistory rows and no schema change: the vote's status never
 * changed, only our label was wrong. Every guard is in
 * scripts/lib/cloture-correction.ts; a row that fails one is skipped, never forced.
 *
 *   # Voteview's file first (gitignored):
 *   curl -sSfL -o logs/HSall_rollcalls.csv https://voteview.com/static/data/out/rollcalls/HSall_rollcalls.csv
 *   npx tsx scripts/correct-senate-cloture.ts                   # plan only → logs/p7-cloture-plan.jsonl
 *   npx tsx scripts/correct-senate-cloture.ts --sample 25       # plan, print 25 rows spread across the batch
 *   npx tsx scripts/correct-senate-cloture.ts --execute --sample 25   # pilot (needs the owner's yes)
 *   npx tsx scripts/correct-senate-cloture.ts --execute --all         # full run (needs the owner's yes)
 *
 * Reads use DATABASE_URL_RO (the SELECT-only app_ro role) when set, else
 * DATABASE_URL in a read-only session. Only --execute opens a write
 * connection (DATABASE_URL). Writes commit in chunks of 25, each chunk one
 * transaction; every UPDATE is conditional on the row still holding the old
 * value, so a killed run resumes by simply rerunning (corrected rows are
 * skipped as "already corrected"). Applied rows → logs/p7-cloture-applied.jsonl.
 */
import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import { parse as csvParse } from "csv-parse/sync";
import { Pool } from "pg";
import {
  BATCH_ID,
  isRejectedCloture,
  planCorrection,
  sourceExternalId,
  type Plan,
  type StoredVote,
  type VoteviewRow,
} from "./lib/cloture-correction";

loadEnv({ path: ".env.local", quiet: true });

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const opt = (f: string) => {
  const i = args.indexOf(f);
  return i === -1 ? null : args[i + 1] ?? null;
};
const EXECUTE = flag("--execute");
const ALL = flag("--all");
const SAMPLE = opt("--sample") ? parseInt(opt("--sample")!, 10) : null;
const CSV_PATH = opt("--csv") ?? "logs/HSall_rollcalls.csv";
const PLAN_OUT = "logs/p7-cloture-plan.jsonl";
const APPLIED_OUT = "logs/p7-cloture-applied.jsonl";
const CHUNK = 25;

function pool(url: string, readOnly: boolean): Pool {
  return new Pool({
    connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""),
    ssl: { rejectUnauthorized: false },
    max: 1,
    ...(readOnly ? { options: "-c default_transaction_read_only=on" } : {}),
  });
}

/** n rows evenly spread over the ordered list (deterministic). */
function spread<T>(xs: T[], n: number): T[] {
  if (n >= xs.length) return xs;
  return Array.from({ length: n }, (_, i) => xs[Math.floor((i * xs.length) / n)]);
}

async function main() {
  if (EXECUTE && !ALL && !SAMPLE) throw new Error("--execute needs --all or --sample N");
  if (!fs.existsSync(CSV_PATH)) throw new Error(`${CSV_PATH} missing — see the header for the curl line`);
  const retrieved = fs.statSync(CSV_PATH).mtime.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const rows: VoteviewRow[] = csvParse(fs.readFileSync(CSV_PATH), { columns: true, skip_empty_lines: true });
  const rejected = new Map<string, VoteviewRow>();
  for (const r of rows) if (isRejectedCloture(r)) rejected.set(sourceExternalId(r), r);
  console.log(`Voteview (${CSV_PATH}, retrieved ${retrieved}): ${rows.length} roll calls, ${rejected.size} rejected Senate cloture votes`);

  const roUrl = process.env.DATABASE_URL_RO;
  const rwUrl = process.env.DATABASE_URL;
  if (!rwUrl) throw new Error("DATABASE_URL is not set (expected in .env.local)");
  const ro = pool(roUrl ?? rwUrl, true);
  console.log(`reads: ${roUrl ? "app_ro (DATABASE_URL_RO)" : "DATABASE_URL, read-only session (app_ro not configured)"}`);

  try {
    const stored = (
      await ro.query<StoredVote & { ext: string; done: boolean }>(
        `SELECT c.id AS "claimId", c.text AS "claimText", c.deleted AS "claimDeleted",
                c.metadata->>'result' AS "metaResult", c.metadata->>'legislativeVoteId' AS "metaVoteId",
                lv.id AS "voteId", lv.result AS "voteResult", lv."yesCount", lv."noCount", s."externalId" AS ext,
                coalesce(c.metadata->'corrections', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('batch', $2::text)) AS done
         FROM "Source" s
         JOIN "LegislativeVote" lv ON lv."sourceId" = s.id AND lv."dataSource" = 'voteview_v1'
         JOIN "Claim" c ON c."externalId" = 'voteview_claim_' || lv.id
         WHERE s."externalId" = ANY($1)`,
        [[...rejected.keys()], BATCH_ID],
      )
    ).rows;

    const plans: (Plan & { ext: string })[] = [];
    const skips = new Map<string, number>();
    let done = 0;
    for (const s of stored) {
      if (s.done) { done++; continue; }
      const p = planCorrection(rejected.get(s.ext)!, s, today, retrieved);
      if (p.ok) plans.push({ ...p, ext: s.ext });
      else skips.set(p.skip, (skips.get(p.skip) ?? 0) + 1);
    }
    const order = (e: string) => e.split("_").slice(2).map((x) => x.padStart(5, "0")).join("_");
    plans.sort((a, b) => order(a.ext).localeCompare(order(b.ext)));
    const ok = plans.filter((p): p is Extract<Plan, { ok: true }> & { ext: string } => p.ok);

    console.log(`matched claims: ${stored.length} · to correct: ${ok.length} · already corrected (${BATCH_ID}): ${done}`);
    for (const [why, n] of [...skips].sort((a, b) => b[1] - a[1])) console.log(`  skipped ${n}: ${why}`);
    const by = (k: (p: (typeof ok)[number]) => string) =>
      Object.entries(ok.reduce<Record<string, number>>((m, p) => ((m[k(p)] = (m[k(p)] ?? 0) + 1), m), {}))
        .map(([k2, n]) => `${k2} ${n}`).join(", ");
    if (ok.length) {
      console.log(`  by stored result: ${by((p) => p.correction.before.result)}`);
      console.log(`  by threshold: ${by((p) => p.threshold)}`);
    }
    fs.writeFileSync(PLAN_OUT, ok.map((p) => JSON.stringify(p)).join("\n") + (ok.length ? "\n" : ""));
    console.log(`plan → ${PLAN_OUT}`);

    const chosen = SAMPLE ? spread(ok, SAMPLE) : ok;
    if (SAMPLE) {
      console.log(`\n${chosen.length} rows spread across the batch:`);
      for (const p of chosen) {
        const e = p.correction.evidence;
        console.log(
          `- ${p.claimId}  ${e.url}\n    Voteview: ${e.yea}-${e.nay}, ${e.vote_result} (needs ${e.majority_requirement})\n` +
            `    before: …${p.correction.before.text.slice(-70)}\n    after:  …${p.text.slice(-70)}   threshold ${p.threshold}`,
        );
      }
    }

    if (!EXECUTE) {
      console.log("\nNo writes. --execute (--sample N | --all) applies the plan, after the owner's yes.");
      return;
    }

    const rw = pool(rwUrl, false);
    let applied = 0;
    try {
      for (let i = 0; i < chosen.length; i += CHUNK) {
        const chunk = chosen.slice(i, i + CHUNK);
        const db = await rw.connect();
        try {
          await db.query("BEGIN");
          for (const p of chunk) {
            const c = await db.query(
              `UPDATE "Claim"
               SET text = $2,
                   metadata = jsonb_set(metadata, '{result}', '"failed"')
                              || jsonb_build_object('corrections', coalesce(metadata->'corrections', '[]'::jsonb) || jsonb_build_array($4::jsonb)),
                   "updatedAt" = now()
               WHERE id = $1 AND deleted = false AND text = $3 AND metadata->>'result' = $5
                 AND NOT coalesce(metadata->'corrections', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('batch', $6::text))`,
              [p.claimId, p.text, p.correction.before.text, JSON.stringify(p.correction), p.correction.before.result, BATCH_ID],
            );
            const v = await db.query(
              `UPDATE "LegislativeVote" SET result = 'failed', "passageThreshold" = $3, "updatedAt" = now()
               WHERE id = $1 AND result = $2`,
              [p.voteId, p.correction.before.result, p.threshold],
            );
            if (c.rowCount !== 1 || v.rowCount !== 1)
              throw new Error(`${p.claimId}: expected 1+1 rows, got claim ${c.rowCount}, vote ${v.rowCount} — chunk rolled back`);
          }
          await db.query("COMMIT");
        } catch (e) {
          await db.query("ROLLBACK").catch(() => {});
          throw e;
        } finally {
          db.release();
        }
        fs.appendFileSync(APPLIED_OUT, chunk.map((p) => JSON.stringify({ claimId: p.claimId, voteId: p.voteId, batch: BATCH_ID, at: new Date().toISOString() })).join("\n") + "\n");
        applied += chunk.length;
        console.log(`committed ${applied}/${chosen.length}`);
      }
    } finally {
      await rw.end();
    }

    // Counts from the database, not the loop (AGENTS.md "Verify ingester counters").
    const n = (
      await ro.query<{ claims: number; failed: number }>(
        `SELECT count(*)::int AS claims, count(*) FILTER (WHERE lv.result = 'failed' AND c.text LIKE '% — failed.')::int AS failed
         FROM "Claim" c JOIN "LegislativeVote" lv ON lv.id = c.metadata->>'legislativeVoteId'
         WHERE c."externalId" LIKE 'voteview_claim_%'
           AND coalesce(c.metadata->'corrections', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('batch', $1::text))`,
        [BATCH_ID],
      )
    ).rows[0];
    console.log(`database: ${n.claims} claims carry ${BATCH_ID}; ${n.failed} of them read "failed" in both claim text and vote`);
  } finally {
    await ro.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
