/**
 * build-vote-review-list.ts — writes data/vote-results-under-review.json, the
 * list of voteview_v1 votes whose stored result is known to disagree with
 * Voteview's record (rules: scripts/lib/vote-review.ts). The public vote page
 * shows "Result under review" for exactly these votes (owner decision
 * 2026-10-13). Read-only: it writes a repo file, never the database. Rerun
 * after each correction batch so fixed votes leave the list.
 *
 *   curl -sSfL -o logs/HSall_rollcalls.csv https://voteview.com/static/data/out/rollcalls/HSall_rollcalls.csv
 *   npx tsx scripts/build-vote-review-list.ts
 */
import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import { parse as csvParse } from "csv-parse/sync";
import { Pool } from "pg";
import { reviewGroup, type ReviewGroup, type VoteviewRow } from "../lib/vote-review";

loadEnv({ path: ".env.local", quiet: true });

const CSV_PATH = "logs/HSall_rollcalls.csv";
const OUT = "data/vote-results-under-review.json";

async function main() {
  if (!fs.existsSync(CSV_PATH)) throw new Error(`${CSV_PATH} missing — see the header for the curl line`);
  const retrieved = fs.statSync(CSV_PATH).mtime.toISOString().slice(0, 10);
  const rows = new Map<string, VoteviewRow>();
  for (const r of csvParse(fs.readFileSync(CSV_PATH), { columns: true, skip_empty_lines: true }) as (VoteviewRow & { rollnumber: string })[]) {
    const ch = r.chamber === "Senate" ? "s" : "h";
    rows.set(`voteview_source_${parseInt(r.congress, 10)}_${ch}_${parseInt(r.rollnumber, 10)}`, r);
  }

  const url = process.env.DATABASE_URL_RO ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_RO / DATABASE_URL not set (expected in .env.local)");
  const db = new Pool({
    connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""),
    ssl: { rejectUnauthorized: false },
    max: 1,
    options: "-c default_transaction_read_only=on",
  });
  try {
    const votes = (
      await db.query<{ id: string; result: string | null; ext: string }>(
        `SELECT lv.id, lv.result, s."externalId" AS ext
         FROM "LegislativeVote" lv JOIN "Source" s ON s.id = lv."sourceId"
         WHERE lv."dataSource" = 'voteview_v1'
         ORDER BY lv.id`,
      )
    ).rows;
    const entries: [string, ReviewGroup][] = [];
    const counts: Partial<Record<ReviewGroup, number>> = {};
    for (const v of votes) {
      const r = rows.get(v.ext);
      if (!r) continue;
      const g = reviewGroup(r, v.result);
      if (!g) continue;
      entries.push([v.id, g]);
      counts[g] = (counts[g] ?? 0) + 1;
    }
    fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync(
      OUT,
      JSON.stringify(
        {
          generated: new Date().toISOString().slice(0, 10),
          source: "Voteview HSall_rollcalls.csv vote_result vs LegislativeVote.result (voteview_v1)",
          retrieved,
          by: "scripts/build-vote-review-list.ts",
          counts,
          // [LegislativeVote id, review group]
          votes: entries,
        },
        null,
        0,
      ).replace(/\],\[/g, "],\n[") + "\n",
    );
    console.log(`${votes.length} voteview_v1 votes · under review: ${entries.length}`);
    for (const [g, n] of Object.entries(counts)) console.log(`  ${n}  ${g}`);
    console.log(`→ ${OUT}`);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
