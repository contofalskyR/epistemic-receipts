/**
 * link-votes-to-laws.ts — Phase 7 Q6 (owner decision 2026-10-12).
 *
 * Writes one ClaimRelation `VOTE_ON` from each voteview_v1 roll-call claim to
 * the congress_v1 law claim it voted on, matched on the exact bill number in
 * Voteview's HSall_rollcalls.csv (congress + bill type + number; Voteview's
 * HJR/HJRE/HJRES spellings normalised). Votes on resolutions, nominations and
 * treaties, votes with no bill_number, and bills with no congress_v1 law are
 * skipped and counted. followUpContext carries autoApproved: true, the
 * method, the Voteview link and bill_number, and the batch id. The guards
 * live in scripts/lib/vote-on.ts.
 *
 *   curl -sSfL -o logs/HSall_rollcalls.csv https://voteview.com/static/data/out/rollcalls/HSall_rollcalls.csv
 *   npx tsx scripts/link-votes-to-laws.ts                    # plan only → logs/p7-vote-on-plan.jsonl
 *   npx tsx scripts/link-votes-to-laws.ts --sample 25        # plan, print 25 pairs spread across the batch
 *   npx tsx scripts/link-votes-to-laws.ts --execute --all    # write (needs the owner's yes)
 *
 * Reads use DATABASE_URL_RO (app_ro). Only --execute opens DATABASE_URL.
 * Inserts commit in chunks of 500, each one transaction, with ON CONFLICT DO
 * NOTHING on @@unique([fromClaimId, toClaimId, relationType]): a killed run
 * resumes by rerunning (linked pairs are skipped as "already linked").
 */
import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import { parse as csvParse } from "csv-parse/sync";
import { Pool } from "pg";
import { cuid } from "./lib/transition-sourcing";
import { BATCH_ID, RELATION_TYPE, lawExternalId, planLink, type LawSide, type LinkPlan, type VoteSide } from "./lib/vote-on";

loadEnv({ path: ".env.local", quiet: true });

const args = process.argv.slice(2);
const opt = (f: string) => {
  const i = args.indexOf(f);
  return i === -1 ? null : args[i + 1] ?? null;
};
const EXECUTE = args.includes("--execute");
const ALL = args.includes("--all");
const SAMPLE = opt("--sample") ? parseInt(opt("--sample")!, 10) : null;
const CSV_PATH = opt("--csv") ?? "logs/HSall_rollcalls.csv";
const PLAN_OUT = "logs/p7-vote-on-plan.jsonl";
const SKIP_OUT = "logs/p7-vote-on-skipped.jsonl";
const CHUNK = 500;

type Row = Record<string, string>;
type Planned = Extract<LinkPlan, { ok: true }>;

function pool(url: string, readOnly: boolean): Pool {
  return new Pool({
    connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""),
    ssl: { rejectUnauthorized: false },
    max: 1,
    ...(readOnly ? { options: "-c default_transaction_read_only=on" } : {}),
  });
}

function spread<T>(xs: T[], n: number): T[] {
  if (n >= xs.length) return xs;
  return Array.from({ length: n }, (_, i) => xs[Math.floor((i * xs.length) / n)]);
}

async function main() {
  if (EXECUTE && !ALL) throw new Error("--execute needs --all (the plan is all or nothing)");
  if (!fs.existsSync(CSV_PATH)) throw new Error(`${CSV_PATH} missing — see the header for the curl line`);
  const retrieved = fs.statSync(CSV_PATH).mtime.toISOString().slice(0, 10);

  const voteview = new Map<string, Row>();
  for (const r of csvParse(fs.readFileSync(CSV_PATH), { columns: true, skip_empty_lines: true }) as Row[]) {
    const ch = r.chamber === "Senate" ? "s" : "h";
    voteview.set(`voteview_source_${parseInt(r.congress, 10)}_${ch}_${parseInt(r.rollnumber, 10)}`, r);
  }
  console.log(`Voteview (${CSV_PATH}, retrieved ${retrieved}): ${voteview.size} roll calls`);

  const roUrl = process.env.DATABASE_URL_RO;
  const rwUrl = process.env.DATABASE_URL;
  if (!rwUrl) throw new Error("DATABASE_URL is not set (expected in .env.local)");
  const ro = pool(roUrl ?? rwUrl, true);
  console.log(`reads: ${roUrl ? "app_ro (DATABASE_URL_RO)" : "DATABASE_URL, read-only session (app_ro not configured)"}`);

  try {
    const votes = (
      await ro.query<{ claimId: string; deleted: boolean; ext: string }>(
        `SELECT c.id AS "claimId", c.deleted, s."externalId" AS ext
         FROM "LegislativeVote" lv
         JOIN "Source" s ON s.id = lv."sourceId"
         JOIN "Claim" c ON c."externalId" = 'voteview_claim_' || lv.id
         WHERE lv."dataSource" = 'voteview_v1'`,
      )
    ).rows;
    const laws = new Map<string, LawSide>();
    for (const l of (
      await ro.query<LawSide>(
        `SELECT id AS "claimId", "externalId", deleted, metadata->>'enactedDate' AS "enactedDate"
         FROM "Claim" WHERE "externalId" LIKE 'congress\\_law\\_%'`,
      )
    ).rows)
      laws.set(l.externalId, l);
    const existing = new Map<string, string>();
    for (const r of (
      await ro.query<{ f: string; t: string; type: string }>(
        `SELECT r."fromClaimId" AS f, r."toClaimId" AS t, r."relationType" AS type
         FROM "ClaimRelation" r JOIN "Claim" c ON c.id = r."toClaimId"
         WHERE c."externalId" LIKE 'congress\\_law\\_%'
         ORDER BY (r."relationType" = $1) DESC`,
        [RELATION_TYPE],
      )
    ).rows)
      if (!existing.has(`${r.f}|${r.t}`)) existing.set(`${r.f}|${r.t}`, r.type);
    console.log(`database: ${votes.length} voteview_v1 vote claims · ${laws.size} congress_v1 law claims · ${existing.size} relations into laws`);

    const plans: (Planned & { sort: string })[] = [];
    const skips = new Map<string, number>();
    const skipRows: string[] = [];
    for (const v of votes) {
      const r = voteview.get(v.ext);
      if (!r) {
        skips.set("no Voteview row", (skips.get("no Voteview row") ?? 0) + 1);
        continue;
      }
      const side: VoteSide = {
        claimId: v.claimId, deleted: v.deleted, congress: parseInt(r.congress, 10),
        chamber: r.chamber === "Senate" ? "s" : "h", roll: parseInt(r.rollnumber, 10),
        date: r.date.trim(), billNumber: r.bill_number,
      };
      const ext = lawExternalId(side.congress, side.billNumber);
      const law = ext ? laws.get(ext) : undefined;
      const p = planLink(side, law, law ? existing.get(`${v.claimId}|${law.claimId}`) : undefined, retrieved);
      if (p.ok) plans.push({ ...p, sort: `${side.date}|${side.chamber}|${String(side.roll).padStart(5, "0")}` });
      else {
        skips.set(p.skip, (skips.get(p.skip) ?? 0) + 1);
        if (!/no bill_number|cannot become law|no congress_v1 law|already linked/.test(p.skip))
          skipRows.push(JSON.stringify({ vote: v.claimId, law: law?.claimId, skip: p.skip, bill_number: side.billNumber, date: side.date, enacted: law?.enactedDate }));
      }
    }
    plans.sort((a, b) => a.sort.localeCompare(b.sort));
    const strip = (p: Planned & { sort: string }): Planned => ({ ok: p.ok, fromClaimId: p.fromClaimId, toClaimId: p.toClaimId, year: p.year, context: p.context });
    const lawsLinked = new Set(plans.map((p) => p.toClaimId)).size;
    console.log(`to link: ${plans.length} votes → ${lawsLinked} laws`);
    for (const [why, n] of [...skips].sort((a, b) => b[1] - a[1])) console.log(`  skipped ${n}: ${why}`);
    fs.writeFileSync(PLAN_OUT, plans.map((p) => JSON.stringify(strip(p))).join("\n") + (plans.length ? "\n" : ""));
    fs.writeFileSync(SKIP_OUT, skipRows.join("\n") + (skipRows.length ? "\n" : ""));
    console.log(`plan → ${PLAN_OUT} · unusual skips → ${SKIP_OUT}`);

    if (SAMPLE) {
      const lawText = new Map(
        (
          await ro.query<{ id: string; text: string }>(`SELECT id, text FROM "Claim" WHERE id = ANY($1)`, [
            spread(plans, SAMPLE).flatMap((p) => [p.fromClaimId, p.toClaimId]),
          ])
        ).rows.map((r) => [r.id, r.text]),
      );
      console.log(`\n${Math.min(SAMPLE, plans.length)} pairs spread across the batch:`);
      for (const p of spread(plans, SAMPLE))
        console.log(
          `- ${p.context.evidence.url}  ${p.context.evidence.bill_number}\n    vote: ${(lawText.get(p.fromClaimId) ?? "").slice(0, 150)}\n` +
            `    law:  ${(lawText.get(p.toClaimId) ?? "").slice(0, 150)}`,
        );
    }

    if (!EXECUTE) {
      console.log("\nNo writes. --execute --all inserts the plan, after the owner's yes.");
      return;
    }

    const rw = pool(rwUrl, false);
    let inserted = 0;
    try {
      for (let i = 0; i < plans.length; i += CHUNK) {
        const chunk = plans.slice(i, i + CHUNK);
        const db = await rw.connect();
        try {
          await db.query("BEGIN");
          const res = await db.query(
            `INSERT INTO "ClaimRelation" (id, "fromClaimId", "toClaimId", "relationType", year, "followUpContext")
             SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::jsonb[])
             ON CONFLICT ("fromClaimId", "toClaimId", "relationType") DO NOTHING`,
            [
              chunk.map(() => cuid()),
              chunk.map((p) => p.fromClaimId),
              chunk.map((p) => p.toClaimId),
              chunk.map(() => RELATION_TYPE),
              chunk.map((p) => p.year),
              chunk.map((p) => JSON.stringify(p.context)),
            ],
          );
          await db.query("COMMIT");
          inserted += res.rowCount ?? 0;
        } catch (e) {
          await db.query("ROLLBACK").catch(() => {});
          throw e;
        } finally {
          db.release();
        }
        console.log(`committed ${Math.min(i + CHUNK, plans.length)}/${plans.length} (inserted ${inserted})`);
      }
    } finally {
      await rw.end();
    }

    // Counts from the database, not the loop (AGENTS.md "Verify ingester counters").
    const n = (
      await ro.query<{ rels: number; votes: number; laws: number }>(
        `SELECT count(*)::int AS rels, count(DISTINCT "fromClaimId")::int AS votes, count(DISTINCT "toClaimId")::int AS laws
         FROM "ClaimRelation" WHERE "relationType" = $1 AND "followUpContext"->>'batch' = $2`,
        [RELATION_TYPE, BATCH_ID],
      )
    ).rows[0];
    console.log(`database: ${n.rels} ${RELATION_TYPE} relations in ${BATCH_ID} (${n.votes} votes → ${n.laws} laws)`);
  } finally {
    await ro.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
