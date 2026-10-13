/**
 * merge-senate-member-ids.ts — Phase 7 Q13 step 3 (owner decision 2026-10-13).
 *
 * congress_votes_v1 member votes for senators carry the Senate's LIS id
 * ("S270") while voteview_v1 member votes carry the bioguide id ("S000148"),
 * so one senator has two /members profiles. MemberVote.memberId is documented
 * as the bioguide id. Using the unitedstates/congress-legislators crosswalk
 * (id.lis → id.bioguide), rewrite each LIS id on congress_votes_v1 member
 * votes to its bioguide id. Guards: exactly one legislator with that LIS id,
 * the legislator's last name appears in our member name, and our state is one
 * the legislator served in the Senate. Votes with no member id are left alone.
 *
 * The applied mapping is written to data/crosswalks/senate-lis-bioguide.json
 * (MemberVote has no metadata column; the file is the audit record).
 *
 *   curl -sSfL -o logs/legislators-current.json https://unitedstates.github.io/congress-legislators/legislators-current.json
 *   curl -sSfL -o logs/legislators-historical.json https://unitedstates.github.io/congress-legislators/legislators-historical.json
 *   npx tsx scripts/merge-senate-member-ids.ts             # plan only
 *   npx tsx scripts/merge-senate-member-ids.ts --execute   # write (needs the owner's yes)
 *
 * Reads use DATABASE_URL_RO (app_ro); only --execute opens DATABASE_URL. One
 * transaction; each id's update must touch exactly the rows counted in the plan.
 */
import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import { Pool } from "pg";

loadEnv({ path: ".env.local", quiet: true });

const EXECUTE = process.argv.includes("--execute");
const MAP_OUT = "data/crosswalks/senate-lis-bioguide.json";
const SOURCES = ["logs/legislators-current.json", "logs/legislators-historical.json"];

type Legislator = {
  id: { bioguide: string; lis?: string };
  name: { first: string; last: string; official_full?: string };
  terms: { type: string; state: string }[];
};

function pool(url: string, readOnly: boolean): Pool {
  return new Pool({
    connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""),
    ssl: { rejectUnauthorized: false },
    max: 1,
    ...(readOnly ? { options: "-c default_transaction_read_only=on" } : {}),
  });
}

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function main() {
  for (const f of SOURCES) if (!fs.existsSync(f)) throw new Error(`${f} missing — see the header for the curl lines`);
  const retrieved = fs.statSync(SOURCES[0]).mtime.toISOString().slice(0, 10);
  const byLis = new Map<string, Legislator[]>();
  for (const f of SOURCES)
    for (const p of JSON.parse(fs.readFileSync(f, "utf8")) as Legislator[])
      if (p.id.lis) byLis.set(p.id.lis, [...(byLis.get(p.id.lis) ?? []), p]);

  const rwUrl = process.env.DATABASE_URL;
  if (!rwUrl) throw new Error("DATABASE_URL is not set (expected in .env.local)");
  const ro = pool(process.env.DATABASE_URL_RO ?? rwUrl, true);
  console.log(`reads: ${process.env.DATABASE_URL_RO ? "app_ro (DATABASE_URL_RO)" : "DATABASE_URL, read-only session"}`);
  try {
    const rows = (
      await ro.query<{ lis: string; names: string[]; states: (string | null)[]; n: number }>(
        `SELECT m."memberId" AS lis, array_agg(DISTINCT m."memberName") AS names,
                array_agg(DISTINCT m."memberState") AS states, count(*)::int AS n
         FROM "MemberVote" m JOIN "LegislativeVote" lv ON lv.id = m."legislativeVoteId"
         WHERE lv."dataSource" = 'congress_votes_v1' AND m."memberId" ~ '^S[0-9]{3}$'
         GROUP BY 1 ORDER BY 1`,
      )
    ).rows;

    const plan: { lis: string; bioguide: string; name: string; ours: string[]; state: string; votes: number }[] = [];
    const skips: string[] = [];
    for (const r of rows) {
      const c = byLis.get(r.lis) ?? [];
      if (c.length !== 1) { skips.push(`${r.lis}: ${c.length} legislators with this LIS id`); continue; }
      const p = c[0];
      const last = fold(p.name.last);
      const senStates = new Set(p.terms.filter((t) => t.type === "sen").map((t) => t.state));
      if (!r.names.every((n) => fold(n).includes(last))) { skips.push(`${r.lis}: name ${r.names.join(" / ")} vs ${p.name.last}`); continue; }
      if (r.states.length !== 1 || !r.states[0] || !senStates.has(r.states[0])) { skips.push(`${r.lis}: state ${r.states.join("/")} vs Senate ${[...senStates].join("/")}`); continue; }
      plan.push({ lis: r.lis, bioguide: p.id.bioguide, name: p.name.official_full ?? `${p.name.first} ${p.name.last}`, ours: r.names, state: r.states[0], votes: r.n });
    }
    const votes = plan.reduce((s, p) => s + p.votes, 0);
    console.log(`LIS ids on congress_votes_v1 member votes: ${rows.length} (${rows.reduce((s, r) => s + r.n, 0)} votes) · to merge: ${plan.length} (${votes} votes) · skipped: ${skips.length}`);
    for (const s of skips) console.log(`  skip ${s}`);
    const already = (
      await ro.query<{ n: number }>(`SELECT count(DISTINCT "memberId")::int AS n FROM "MemberVote" WHERE "memberId" = ANY($1)`, [plan.map((p) => p.bioguide)])
    ).rows[0].n;
    console.log(`  ${already} of the ${plan.length} bioguide ids already have Voteview member votes (their profiles merge)`);
    for (const p of plan.filter((_, i) => i % 20 === 0)) console.log(`  ${p.lis} → ${p.bioguide}  ${p.ours.join(" / ")} (${p.state}) = ${p.name}  · ${p.votes} votes`);

    if (!EXECUTE) {
      console.log("\nNo writes. --execute rewrites the ids, after the owner's yes.");
      return;
    }
    const rw = pool(rwUrl, false);
    const db = await rw.connect();
    try {
      await db.query("BEGIN");
      for (const p of plan) {
        const res = await db.query(
          `UPDATE "MemberVote" m SET "memberId" = $2
           FROM "LegislativeVote" lv
           WHERE lv.id = m."legislativeVoteId" AND lv."dataSource" = 'congress_votes_v1' AND m."memberId" = $1`,
          [p.lis, p.bioguide],
        );
        if (res.rowCount !== p.votes) throw new Error(`${p.lis}: expected ${p.votes} rows, got ${res.rowCount} — rolled back`);
      }
      await db.query("COMMIT");
    } catch (e) {
      await db.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      db.release();
      await rw.end();
    }
    fs.mkdirSync("data/crosswalks", { recursive: true });
    fs.writeFileSync(
      MAP_OUT,
      JSON.stringify(
        {
          applied: new Date().toISOString().slice(0, 10),
          table: "MemberVote (congress_votes_v1 votes)",
          source: "https://github.com/unitedstates/congress-legislators (legislators-current.json + legislators-historical.json)",
          retrieved,
          by: "scripts/merge-senate-member-ids.ts",
          map: plan.map(({ lis, bioguide, name, state, votes }) => ({ lis, bioguide, name, state, votes })),
        },
        null,
        1,
      ) + "\n",
    );
    const left = (
      await ro.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "MemberVote" m JOIN "LegislativeVote" lv ON lv.id = m."legislativeVoteId"
         WHERE lv."dataSource" = 'congress_votes_v1' AND m."memberId" ~ '^S[0-9]{3}$'`,
      )
    ).rows[0].n;
    console.log(`database: ${left} congress_votes_v1 member votes still carry an LIS id · mapping → ${MAP_OUT}`);
  } finally {
    await ro.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
