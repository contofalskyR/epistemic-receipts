/**
 * link-congress-vote-lvs.ts — Phase 7 Q8 (owner decision 2026-10-12, scope cut
 * to the congress_votes_v1 claims still live after Q7).
 *
 * congress_votes_v1 claims carry no key to their LegislativeVote. For each
 * live one, find the congress_votes_v1 LegislativeVote on the claim's bill
 * Source (congress_law_source_<congress>_<type>_<number>), in the same chamber,
 * on the same date, with the same yea/nay tally. Exactly one match → write
 * metadata.legislativeVoteId (+ metadata.legislativeVoteLink: batch, method,
 * date, script). Zero or several → skipped and reported, never guessed.
 *
 *   npx tsx scripts/link-congress-vote-lvs.ts             # plan only
 *   npx tsx scripts/link-congress-vote-lvs.ts --execute   # write (needs the owner's yes)
 *
 * --retired (Q13 step 2, owner 2026-10-13): the same, for the claims Q7 retired
 * as duplicates (deleted, metadata.retired batch p7-congress-dedup-2026-10), so
 * every congress_votes_v1 vote reaches a claim (the twin, via duplicateOf).
 *
 * Reads use DATABASE_URL_RO (app_ro); only --execute opens DATABASE_URL. One
 * transaction; each update requires the claim to be live and still unkeyed.
 */
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

loadEnv({ path: ".env.local", quiet: true });

const EXECUTE = process.argv.includes("--execute");
const RETIRED = process.argv.includes("--retired");
// Batch labels, not secrets ("keys" = vote keys); gitleaks' generic-api-key rule reads "keys…" : "…" as one.
const BATCH_ID = RETIRED ? "p7-q13-lv-keys-retired-2026-10" : "p7-q8-lv-keys-2026-10"; // gitleaks:allow
const SCOPE = RETIRED
  ? `deleted AND metadata->'retired'->>'batch' = 'p7-congress-dedup-2026-10'`
  : "NOT deleted";
const METHOD = "bill source + chamber + vote date + yea/nay tally, exactly one congress_votes_v1 LegislativeVote";

function pool(url: string, readOnly: boolean): Pool {
  return new Pool({
    connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""),
    ssl: { rejectUnauthorized: false },
    max: 1,
    ...(readOnly ? { options: "-c default_transaction_read_only=on" } : {}),
  });
}

type Cand = { claimId: string; ext: string; tally: string; date: string; lvIds: string[] | null; claimedElsewhere: number };

async function main() {
  const rwUrl = process.env.DATABASE_URL;
  if (!rwUrl) throw new Error("DATABASE_URL is not set (expected in .env.local)");
  const ro = pool(process.env.DATABASE_URL_RO ?? rwUrl, true);
  console.log(`reads: ${process.env.DATABASE_URL_RO ? "app_ro (DATABASE_URL_RO)" : "DATABASE_URL, read-only session"}`);
  try {
    const rows = (
      await ro.query<Cand>(
        `WITH keyed AS (
           -- only congress_votes_v1 claims point at congress_votes_v1 votes; voteview_v1 claims key their own
           SELECT metadata->>'legislativeVoteId' AS lv FROM "Claim"
           WHERE "externalId" LIKE 'congress\\_vote\\_%' AND metadata ? 'legislativeVoteId'
         ),
         cv AS (
           SELECT id, "externalId" AS ext, metadata AS m FROM "Claim"
           WHERE "externalId" LIKE 'congress\\_vote\\_%' AND ${SCOPE} AND metadata->>'legislativeVoteId' IS NULL
         )
         SELECT cv.id AS "claimId", cv.ext, (cv.m->>'yea') || '–' || (cv.m->>'nay') AS tally, cv.m->>'voteDate' AS date,
                array_agg(lv.id) FILTER (WHERE lv.id IS NOT NULL) AS "lvIds",
                (SELECT count(*)::int FROM keyed k WHERE k.lv = ANY(array_agg(lv.id))) AS "claimedElsewhere"
         FROM cv
         LEFT JOIN "Source" s ON s."externalId" = 'congress_law_source_' || (cv.m->>'congress') || '_' || lower(cv.m->>'billType') || '_' || (cv.m->>'billNumber')
         LEFT JOIN "LegislativeVote" lv ON lv."sourceId" = s.id AND lv."dataSource" = 'congress_votes_v1'
              AND lv."voteDate"::date = (cv.m->>'voteDate')::date
              AND lower(lv.chamber) LIKE lower(left(cv.m->>'chamber', 1)) || '%'
              AND lv."yesCount" = (cv.m->>'yea')::int AND lv."noCount" = (cv.m->>'nay')::int
         GROUP BY cv.id, cv.ext, cv.m
         ORDER BY cv.ext`,
      )
    ).rows;
    const ok = rows.filter((r) => r.lvIds?.length === 1 && r.claimedElsewhere === 0);
    console.log(`${RETIRED ? "retired" : "live"}, unkeyed congress_votes_v1 claims: ${rows.length} · to key: ${ok.length}`);
    for (const r of rows) {
      const why = r.lvIds?.length === 1 ? (r.claimedElsewhere ? "vote already keyed by another claim" : "") : `${r.lvIds?.length ?? 0} matching votes`;
      console.log(`  ${why ? "skip" : "key "} ${r.ext} (${r.tally}, ${r.date}) → ${r.lvIds?.join(", ") ?? "—"}${why ? `  [${why}]` : ""}`);
    }
    if (!EXECUTE) {
      console.log("\nNo writes. --execute writes metadata.legislativeVoteId, after the owner's yes.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const rw = pool(rwUrl, false);
    const db = await rw.connect();
    try {
      await db.query("BEGIN");
      for (const r of ok) {
        const res = await db.query(
          `UPDATE "Claim"
           SET metadata = metadata || jsonb_build_object('legislativeVoteId', $2::text,
                 'legislativeVoteLink', jsonb_build_object('batch', $3::text, 'method', $4::text, 'date', $5::text, 'by', 'scripts/link-congress-vote-lvs.ts')),
               "updatedAt" = now()
           WHERE id = $1 AND ${SCOPE} AND metadata->>'legislativeVoteId' IS NULL`,
          [r.claimId, r.lvIds![0], BATCH_ID, METHOD, today],
        );
        if (res.rowCount !== 1) throw new Error(`${r.claimId}: expected 1 row, got ${res.rowCount} — rolled back`);
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
      await ro.query<{ keyed: number; live: number }>(
        `SELECT count(*) FILTER (WHERE metadata->'legislativeVoteLink'->>'batch' = $1)::int AS keyed,
                count(*)::int AS live
         FROM "Claim" WHERE "externalId" LIKE 'congress\\_vote\\_%' AND ${SCOPE}`,
        [BATCH_ID],
      )
    ).rows[0];
    console.log(`database: ${n.keyed} of ${n.live} ${RETIRED ? "retired" : "live"} congress_votes_v1 claims carry ${BATCH_ID}`);
  } finally {
    await ro.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
