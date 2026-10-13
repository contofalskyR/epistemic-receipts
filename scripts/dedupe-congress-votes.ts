/**
 * dedupe-congress-votes.ts — Phase 7 Q7 (owner decisions 2026-10-12).
 *
 *   (a) Retire every congress_votes_v1 vote claim with exactly one voteview_v1
 *       twin (same Congress, chamber, date and official roll number in
 *       Voteview's HSall_rollcalls.csv, same tally and bill number):
 *       deleted = true, metadata.duplicateOf = the twin, metadata.retired.
 *   (b) Carry its official senate.gov / clerk.house.gov roll-call Source onto
 *       the twin as a second FOR edge (+ EdgeRevision score 95, autoApproved).
 *       Topic tags, locations and PASSED_DURING relations stay behind.
 *   (c) ENACTED_AS from each congress_bills_tracker_v1 bill to the congress_v1
 *       law with the same Congress, type and number (machine provenance in
 *       followUpContext, as VOTE_ON).
 * Rules and guards: scripts/lib/congress-dedup.ts.
 *
 *   curl -sSfL -o logs/HSall_rollcalls.csv https://voteview.com/static/data/out/rollcalls/HSall_rollcalls.csv
 *   npx tsx scripts/dedupe-congress-votes.ts                   # plan only → logs/p7-dedup-plan.jsonl
 *   npx tsx scripts/dedupe-congress-votes.ts --sample 12       # plan, print a spread of pairs
 *   npx tsx scripts/dedupe-congress-votes.ts --execute --all   # write (needs the owner's yes)
 *
 * Reads use DATABASE_URL_RO (app_ro); only --execute opens DATABASE_URL. Each
 * vote pair (edge + revision + retirement) commits with its chunk of 50 in one
 * transaction, guarded on the claim still being live; ENACTED_AS inserts use
 * ON CONFLICT DO NOTHING. A killed run resumes by rerunning.
 */
import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import { parse as csvParse } from "csv-parse/sync";
import { Pool } from "pg";
import { cuid } from "./lib/transition-sourcing";
import {
  BATCH_ID,
  EDGE_INGESTED_BY,
  EDGE_REASON,
  EDGE_SCORE,
  ENACTED_AS,
  clerkKey,
  cvChamber,
  enactedAsContext,
  planRetire,
  trackerToLawExternalId,
  type CvClaim,
  type RetirePlan,
  type VoteviewCandidate,
} from "./lib/congress-dedup";

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
const PLAN_OUT = "logs/p7-dedup-plan.jsonl";
const CHUNK = 50;

type Row = Record<string, string>;
type Retire = Extract<RetirePlan, { ok: true }>;

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
  const today = new Date().toISOString().slice(0, 10);

  // Voteview rows by Congress + chamber + date + official roll number.
  const byClerk = new Map<string, { ext: string; yea: number; nay: number; bill: string }[]>();
  for (const r of csvParse(fs.readFileSync(CSV_PATH), { columns: true, skip_empty_lines: true }) as Row[]) {
    if (!r.clerk_rollnumber?.trim()) continue;
    const chamber = r.chamber === "Senate" ? "Senate" : "House";
    const k = clerkKey(parseInt(r.congress, 10), chamber, r.date.trim(), parseInt(r.clerk_rollnumber, 10));
    const ext = `voteview_source_${parseInt(r.congress, 10)}_${chamber === "Senate" ? "s" : "h"}_${parseInt(r.rollnumber, 10)}`;
    (byClerk.get(k) ?? byClerk.set(k, []).get(k)!).push({
      ext, yea: parseInt(r.yea_count, 10), nay: parseInt(r.nay_count, 10), bill: r.bill_number.trim(),
    });
  }

  const roUrl = process.env.DATABASE_URL_RO;
  const rwUrl = process.env.DATABASE_URL;
  if (!rwUrl) throw new Error("DATABASE_URL is not set (expected in .env.local)");
  const ro = pool(roUrl ?? rwUrl, true);
  console.log(`reads: ${roUrl ? "app_ro (DATABASE_URL_RO)" : "DATABASE_URL, read-only session (app_ro not configured)"}`);

  try {
    // (a)+(b) plan
    const cvs = (
      await ro.query<{ id: string; externalId: string; deleted: boolean; meta: CvClaim["meta"] & { retired?: { batch?: string } }; edges: CvClaim["edges"]; text: string }>(
        `SELECT c.id, c."externalId", c.deleted, c.metadata AS meta, c.text,
                coalesce(json_agg(json_build_object('sourceId', s.id, 'url', s.url)) FILTER (WHERE s.id IS NOT NULL), '[]') AS edges
         FROM "Claim" c
         LEFT JOIN "Edge" e ON e."claimId" = c.id AND NOT e.deleted
         LEFT JOIN "Source" s ON s.id = e."sourceId"
         WHERE c."externalId" LIKE 'congress\\_vote\\_%'
         GROUP BY c.id`,
      )
    ).rows;
    const keys = new Map(cvs.map((c) => [c.id, clerkKey(c.meta.congress, cvChamber(c.meta.chamber), c.meta.voteDate, c.meta.rollNumber)]));
    const wantedExts = [...new Set([...keys.values()].flatMap((k) => (byClerk.get(k) ?? []).map((x) => x.ext)))];
    const vv = new Map(
      (
        await ro.query<{ claimId: string; deleted: boolean; ext: string; sourceIds: string[]; text: string }>(
          `SELECT c.id AS "claimId", c.deleted, s."externalId" AS ext, c.text,
                  array(SELECT e."sourceId" FROM "Edge" e WHERE e."claimId" = c.id AND NOT e.deleted) AS "sourceIds"
           FROM "Source" s
           JOIN "LegislativeVote" lv ON lv."sourceId" = s.id AND lv."dataSource" = 'voteview_v1'
           JOIN "Claim" c ON c."externalId" = 'voteview_claim_' || lv.id
           WHERE s."externalId" = ANY($1)`,
          [wantedExts],
        )
      ).rows.map((r) => [r.ext, r]),
    );

    const retire: (Retire & { cvText: string; survivorText: string; rollUrl: string })[] = [];
    const skips = new Map<string, number>();
    let done = 0;
    for (const c of cvs) {
      if (c.deleted && c.meta.retired?.batch === BATCH_ID) { done++; continue; }
      const cands: VoteviewCandidate[] = (byClerk.get(keys.get(c.id)!) ?? []).flatMap((x) => {
        const v = vv.get(x.ext);
        return v ? [{ claimId: v.claimId, deleted: v.deleted, yea: x.yea, nay: x.nay, billNumber: x.bill, sourceIds: v.sourceIds }] : [];
      });
      const p = planRetire({ id: c.id, externalId: c.externalId, deleted: c.deleted, meta: c.meta, edges: c.edges }, cands, today);
      if (p.ok) {
        const survivorText = [...vv.values()].find((v) => v.claimId === p.survivorId)?.text ?? "";
        retire.push({ ...p, cvText: c.text, survivorText, rollUrl: c.meta.rollUrl ?? "" });
      } else {
        const k = p.skip.replace(/\(official .*\)/, "").replace(/"[^"]*"/, "").trim();
        skips.set(k, (skips.get(k) ?? 0) + 1);
      }
    }
    retire.sort((a, b) => a.cvClaimId.localeCompare(b.cvClaimId));
    const survivors = new Set(retire.map((r) => r.survivorId));
    console.log(`congress_votes_v1: ${cvs.length} claims · to retire: ${retire.length} (distinct survivors ${survivors.size}) · already retired: ${done}`);
    for (const [why, n] of skips) console.log(`  stays live ${n}: ${why}`);
    console.log(`  roll-call edges to add to survivors: ${retire.filter((r) => r.addEdge).length}`);

    // (c) plan
    const pairs = (
      await ro.query<{ tid: string; text: string; tdel: boolean; lid: string; lext: string; ldel: boolean; linked: boolean; enacted: string | null }>(
        `SELECT t.id AS tid, t."externalId" AS text, t.deleted AS tdel, l.id AS lid, l."externalId" AS lext, l.deleted AS ldel,
                l.metadata->>'enactedDate' AS enacted,
                EXISTS (SELECT 1 FROM "ClaimRelation" r WHERE r."fromClaimId" = t.id AND r."toClaimId" = l.id AND r."relationType" = $1) AS linked
         FROM "Claim" l
         JOIN "Claim" t ON t."externalId" = replace(l."externalId", 'congress_law_', 'congress_bill_tracker_')
         WHERE l."externalId" LIKE 'congress\\_law\\_%'`,
        [ENACTED_AS],
      )
    ).rows.filter((p) => trackerToLawExternalId(p.text) === p.lext);
    const enacted = pairs.filter((p) => !p.linked && !p.tdel && !p.ldel);
    console.log(`tracker bill ↔ law pairs: ${pairs.length} · to link ${ENACTED_AS}: ${enacted.length} · already linked: ${pairs.filter((p) => p.linked).length} · a side deleted: ${pairs.filter((p) => !p.linked && (p.tdel || p.ldel)).length}`);

    fs.writeFileSync(
      PLAN_OUT,
      [
        ...retire.map((r) =>
          JSON.stringify({ kind: "retire", cvClaimId: r.cvClaimId, survivorId: r.survivorId, rollSourceId: r.rollSourceId, addEdge: r.addEdge, retired: r.retired }),
        ),
        ...enacted.map((p) => JSON.stringify({ kind: ENACTED_AS, from: p.tid, to: p.lid, tracker: p.text, law: p.lext })),
      ].join("\n") + "\n",
    );
    console.log(`plan → ${PLAN_OUT}`);

    if (SAMPLE) {
      console.log(`\n${Math.min(SAMPLE, retire.length)} retirements spread across the batch:`);
      for (const r of spread(retire, SAMPLE))
        console.log(`- retire ${r.cvClaimId}: ${r.cvText.slice(0, 110)}\n  keep   ${r.survivorId}: ${r.survivorText.slice(0, 110)}\n  + edge ${r.addEdge ? "add" : "exists"}: ${r.rollUrl}`);
      console.log(`\n5 ${ENACTED_AS} pairs:`);
      for (const p of spread(enacted, 5)) console.log(`- ${p.text} → ${p.lext}`);
    }

    if (!EXECUTE) {
      console.log("\nNo writes. --execute --all applies the plan, after the owner's yes.");
      return;
    }

    const rw = pool(rwUrl, false);
    try {
      let n = 0;
      for (let i = 0; i < retire.length; i += CHUNK) {
        const chunk = retire.slice(i, i + CHUNK);
        const db = await rw.connect();
        try {
          await db.query("BEGIN");
          for (const r of chunk) {
            if (r.addEdge) {
              const edgeId = cuid();
              const e = await db.query(
                `INSERT INTO "Edge" (id, "sourceId", "claimId", type, "evidenceType", "ingestedBy", "humanReviewed", "autoApproved")
                 SELECT $1, $2, $3, 'FOR', 'EVIDENTIARY', $4, false, true
                 WHERE NOT EXISTS (SELECT 1 FROM "Edge" WHERE "sourceId" = $2 AND "claimId" = $3 AND NOT deleted)`,
                [edgeId, r.rollSourceId, r.survivorId, EDGE_INGESTED_BY],
              );
              if (e.rowCount === 1)
                await db.query(
                  `INSERT INTO "EdgeRevision" (id, "edgeId", "priorScore", "newScore", reason) VALUES ($1, $2, NULL, $3, $4)`,
                  [cuid(), edgeId, EDGE_SCORE, EDGE_REASON],
                );
            }
            const c = await db.query(
              `UPDATE "Claim"
               SET deleted = true,
                   metadata = metadata || jsonb_build_object('duplicateOf', $2::text, 'retired', $3::jsonb),
                   "updatedAt" = now()
               WHERE id = $1 AND deleted = false AND "externalId" LIKE 'congress\\_vote\\_%'`,
              [r.cvClaimId, r.survivorId, JSON.stringify(r.retired)],
            );
            if (c.rowCount !== 1) throw new Error(`${r.cvClaimId}: expected 1 claim retired, got ${c.rowCount} — chunk rolled back`);
          }
          await db.query("COMMIT");
        } catch (e) {
          await db.query("ROLLBACK").catch(() => {});
          throw e;
        } finally {
          db.release();
        }
        n += chunk.length;
        console.log(`retired ${n}/${retire.length}`);
      }

      if (enacted.length) {
        const res = await rw.query(
          `INSERT INTO "ClaimRelation" (id, "fromClaimId", "toClaimId", "relationType", year, "followUpContext")
           SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::jsonb[])
           ON CONFLICT ("fromClaimId", "toClaimId", "relationType") DO NOTHING`,
          [
            enacted.map(() => cuid()),
            enacted.map((p) => p.tid),
            enacted.map((p) => p.lid),
            enacted.map(() => ENACTED_AS),
            enacted.map((p) => (p.enacted ? parseInt(p.enacted.slice(0, 4), 10) : null)), // year enacted
            enacted.map((p) => JSON.stringify(enactedAsContext(p.text, p.lext))),
          ],
        );
        console.log(`${ENACTED_AS} inserted: ${res.rowCount}`);
      }
    } finally {
      await rw.end();
    }

    // Counts from the database, not the loop (AGENTS.md "Verify ingester counters").
    const a = (
      await ro.query<{ retired: number; live: number; edges: number; rels: number }>(
        `SELECT (SELECT count(*)::int FROM "Claim" WHERE "externalId" LIKE 'congress\\_vote\\_%' AND deleted AND metadata->'retired'->>'batch' = $1) AS retired,
                (SELECT count(*)::int FROM "Claim" WHERE "externalId" LIKE 'congress\\_vote\\_%' AND NOT deleted) AS live,
                (SELECT count(*)::int FROM "Edge" WHERE "ingestedBy" = $2 AND NOT deleted) AS edges,
                (SELECT count(*)::int FROM "ClaimRelation" WHERE "relationType" = $3 AND "followUpContext"->>'batch' = $1) AS rels`,
        [BATCH_ID, EDGE_INGESTED_BY, ENACTED_AS],
      )
    ).rows[0];
    console.log(`database: ${a.retired} congress_votes_v1 claims retired in ${BATCH_ID} (${a.live} live) · ${a.edges} carried roll-call edges · ${a.rels} ${ENACTED_AS}`);
  } finally {
    await ro.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
