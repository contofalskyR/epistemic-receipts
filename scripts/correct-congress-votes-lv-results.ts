/**
 * correct-congress-votes-lv-results.ts — Phase 7 Q13 step 1 (owner decision 2026-10-13).
 *
 * The 505 congress_votes_v1 LegislativeVotes hold 104,550 member votes and are
 * what /votes/[id] and member vote histories show. Some still carry the cloture
 * error batch 1 fixed on the voteview_v1 side. For each congress_votes_v1 vote,
 * find its congress_votes_v1 claim(s) (bill Source + chamber + date + tally)
 * and their voteview_v1 twins (metadata.duplicateOf). When every candidate has
 * a twin, all twins agree on result and threshold, and the vote's result
 * differs, set LegislativeVote.result and passageThreshold from the twin.
 * Votes that match two same-day claims are fixed only when both twins agree.
 * Each correction is also recorded in metadata.corrections of the retired
 * claim(s) the vote belongs to.
 *
 *   npx tsx scripts/correct-congress-votes-lv-results.ts             # plan only
 *   npx tsx scripts/correct-congress-votes-lv-results.ts --execute   # write (needs the owner's yes)
 *
 * Reads use DATABASE_URL_RO (app_ro); only --execute opens DATABASE_URL. One
 * transaction; each update requires the vote to still hold its old result.
 */
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

loadEnv({ path: ".env.local", quiet: true });

const EXECUTE = process.argv.includes("--execute");
const BATCH_ID = "p7-q13-lv-results-2026-10";
const SCRIPT = "scripts/correct-congress-votes-lv-results.ts";

function pool(url: string, readOnly: boolean): Pool {
  return new Pool({
    connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""),
    ssl: { rejectUnauthorized: false },
    max: 1,
    ...(readOnly ? { options: "-c default_transaction_read_only=on" } : {}),
  });
}

type Row = {
  lv: string;
  result: string | null;
  threshold: string | null;
  claims: string[];
  exts: string[];
  twins: (string | null)[];
  twinResults: (string | null)[];
  twinThresholds: (string | null)[];
};

async function main() {
  const rwUrl = process.env.DATABASE_URL;
  if (!rwUrl) throw new Error("DATABASE_URL is not set (expected in .env.local)");
  const ro = pool(process.env.DATABASE_URL_RO ?? rwUrl, true);
  console.log(`reads: ${process.env.DATABASE_URL_RO ? "app_ro (DATABASE_URL_RO)" : "DATABASE_URL, read-only session"}`);
  try {
    const rows = (
      await ro.query<Row>(
        `SELECT lv.id AS lv, lv.result, lv."passageThreshold" AS threshold,
                array_agg(cv.id ORDER BY cv."externalId") AS claims,
                array_agg(cv."externalId" ORDER BY cv."externalId") AS exts,
                array_agg(vv.id ORDER BY cv."externalId") AS twins,
                array_agg(vv.metadata->>'result' ORDER BY cv."externalId") AS "twinResults",
                array_agg(vlv."passageThreshold" ORDER BY cv."externalId") AS "twinThresholds"
         FROM "LegislativeVote" lv
         JOIN "Source" s ON s.id = lv."sourceId"
         JOIN "Claim" cv ON cv."externalId" LIKE 'congress\\_vote\\_%'
              AND s."externalId" = 'congress_law_source_' || (cv.metadata->>'congress') || '_' || lower(cv.metadata->>'billType') || '_' || (cv.metadata->>'billNumber')
              AND lv."voteDate"::date = (cv.metadata->>'voteDate')::date
              AND lower(lv.chamber) LIKE lower(left(cv.metadata->>'chamber', 1)) || '%'
              AND lv."yesCount" = (cv.metadata->>'yea')::int AND lv."noCount" = (cv.metadata->>'nay')::int
         LEFT JOIN "Claim" vv ON vv.id = cv.metadata->>'duplicateOf' AND NOT vv.deleted
         LEFT JOIN "LegislativeVote" vlv ON vlv.id = vv.metadata->>'legislativeVoteId'
         WHERE lv."dataSource" = 'congress_votes_v1'
         GROUP BY lv.id`,
      )
    ).rows;

    const plans: { lv: string; before: string | null; after: string; thBefore: string | null; thAfter: string; claims: string[]; exts: string[]; twins: string[] }[] = [];
    const tally = new Map<string, number>();
    const bump = (k: string) => tally.set(k, (tally.get(k) ?? 0) + 1);
    for (const r of rows) {
      if (r.twins.some((t) => t === null)) { bump("no voteview twin (claim still live)"); continue; }
      const res = new Set(r.twinResults);
      const th = new Set(r.twinThresholds);
      if (res.size !== 1 || th.size !== 1) { bump("twins disagree"); continue; }
      const after = r.twinResults[0]!;
      const thAfter = r.twinThresholds[0] ?? r.threshold ?? "simple_majority";
      if (after === r.result) { bump("already agrees with its twin"); continue; }
      if (after !== "passed" && after !== "failed") { bump(`twin result ${after}`); continue; }
      bump(r.claims.length > 1 ? "to correct (two same-day claims, twins agree)" : "to correct");
      plans.push({ lv: r.lv, before: r.result, after, thBefore: r.threshold, thAfter, claims: r.claims, exts: r.exts, twins: r.twins as string[] });
    }
    console.log(`congress_votes_v1 votes: ${rows.length}`);
    for (const [k, n] of tally) console.log(`  ${n}: ${k}`);
    console.log(`\n${plans.length} votes to correct:`);
    for (const p of plans)
      console.log(`  ${p.lv}  ${p.before} → ${p.after}  ${p.thBefore} → ${p.thAfter}  [${p.exts.join(", ")}]`);

    if (!EXECUTE) {
      console.log("\nNo writes. --execute applies the plan, after the owner's yes.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const rw = pool(rwUrl, false);
    const db = await rw.connect();
    try {
      await db.query("BEGIN");
      for (const p of plans) {
        const v = await db.query(
          `UPDATE "LegislativeVote" SET result = $2, "passageThreshold" = $3, "updatedAt" = now()
           WHERE id = $1 AND result IS NOT DISTINCT FROM $4 AND "dataSource" = 'congress_votes_v1'`,
          [p.lv, p.after, p.thAfter, p.before],
        );
        if (v.rowCount !== 1) throw new Error(`${p.lv}: expected 1 vote, got ${v.rowCount} — rolled back`);
        const corr = {
          batch: BATCH_ID, date: today, field: "LegislativeVote.result", legislativeVoteId: p.lv,
          before: { result: p.before, passageThreshold: p.thBefore }, after: { result: p.after, passageThreshold: p.thAfter },
          evidence: { source: "the corrected voteview_v1 twin claim(s) (Voteview vote_result)", twins: p.twins },
          ...(p.claims.length > 1 ? { note: "one of two same-day votes with identical tallies; both twins agree" } : {}),
          by: SCRIPT,
        };
        const c = await db.query(
          `UPDATE "Claim" SET metadata = metadata || jsonb_build_object('corrections', coalesce(metadata->'corrections', '[]'::jsonb) || jsonb_build_array($2::jsonb)), "updatedAt" = now()
           WHERE id = ANY($1) AND "externalId" LIKE 'congress\\_vote\\_%'`,
          [p.claims, JSON.stringify(corr)],
        );
        if (c.rowCount !== p.claims.length) throw new Error(`${p.lv}: expected ${p.claims.length} claims, got ${c.rowCount} — rolled back`);
      }
      await db.query("COMMIT");
    } catch (e) {
      await db.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      db.release();
      await rw.end();
    }
    const n = (
      await ro.query<{ n: number }>(
        `SELECT count(DISTINCT e->>'legislativeVoteId')::int AS n
         FROM "Claim" c, jsonb_array_elements(c.metadata->'corrections') e
         WHERE c."externalId" LIKE 'congress\\_vote\\_%' AND e->>'batch' = $1`,
        [BATCH_ID],
      )
    ).rows[0];
    console.log(`database: ${n.n} votes recorded as corrected in ${BATCH_ID}`);
  } finally {
    await ro.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
