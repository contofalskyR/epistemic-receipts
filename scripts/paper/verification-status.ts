/**
 * verification-status.ts — where each Claim.verificationStatus value comes from,
 * for docs/paper/numbers.md §1.1. Per pipeline: the status literals its primary
 * writer script contains (writer = column 6 of docs/paper/sql/out/pipeline-scripts.tsv,
 * so run scripts/paper/pipeline-scripts.ts first) beside the values the DB holds
 * (corpus claims) and the humanReviewed / autoApproved counts. Plus the
 * post-ingest scripts known to rewrite the field. Read-only.
 *
 *   npx tsx scripts/paper/verification-status.ts > docs/paper/sql/out/verification-status.out
 */
import { config as loadEnv } from "dotenv";
import { execSync } from "child_process";
import * as fs from "fs";
import { Pool } from "pg";

loadEnv({ path: ".env.local", quiet: true });

const STATUS_LITERAL = /verificationStatus["']?\s*[:=]\s*["'`](VERIFIED|PROVISIONAL|DISPUTED|HARD_FACT|DEPRECATED)["'`]/g;

// Scripts that rewrite verificationStatus after ingest (found by grepping scripts/
// for status literals outside ingesters, 2026-10-24). Their header comments state the rule.
const REWRITERS = [
  "scripts/_audit-fixes/backfill-verification-status.ts", // null → PROVISIONAL when autoApproved && !humanReviewed
  "scripts/tag-retracted-claims.ts",                      // openalex_v1 PROVISIONAL → DISPUTED when a REVERSED ClaimRelation points at a retraction notice
  "scripts/fix-nobel-deprecated.ts",                      // nobel_v1 DEPRECATED → VERIFIED (deprecation_reason left in metadata)
  "scripts/retired/ingest-uspto-patents.ts",              // uspto_v1 → DEPRECATED at retirement
];

async function main() {
  const tsv = fs.readFileSync("docs/paper/sql/out/pipeline-scripts.tsv", "utf8").trim().split("\n").slice(1);
  const writerOf = new Map(tsv.map((l) => { const c = l.split("\t"); return [c[0], c[5]]; }));

  const url = process.env.DATABASE_URL_RO;
  if (!url) throw new Error("DATABASE_URL_RO missing from .env.local");
  const pool = new Pool({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ""), ssl: { rejectUnauthorized: false }, max: 1 });
  let rows: { tag: string; status: string; n: number; human: number; auto: number }[];
  try {
    const c = await pool.connect();
    try {
      await c.query("SET default_transaction_read_only = on");
      rows = (await c.query(`
        SELECT "ingestedBy" AS tag, coalesce("verificationStatus", '(null)') AS status, count(*)::int AS n,
               count(*) FILTER (WHERE "humanReviewed")::int AS human, count(*) FILTER (WHERE "autoApproved")::int AS auto
        FROM "Claim" WHERE NOT deleted GROUP BY 1, 2 ORDER BY 1, 3 DESC`)).rows;
    } finally {
      c.release();
    }
  } finally {
    await pool.end();
  }

  const byTag = new Map<string, typeof rows>();
  for (const r of rows) byTag.set(r.tag, [...(byTag.get(r.tag) ?? []), r]);

  console.log(`-- script: scripts/paper/verification-status.ts`);
  console.log(`-- run:    ${new Date().toISOString()} · git ${execSync("git rev-parse --short HEAD").toString().trim()} · role app_ro\n`);
  console.log(["pipeline", "writer_literals", "db_values", "human_reviewed", "auto_approved", "claims"].join("\t"));

  // Tally: does the writer hard-code exactly the value the DB holds?
  const tally = new Map<string, { pipelines: number; claims: number }>();
  for (const [tag, rs] of byTag) {
    const files = (writerOf.get(tag) ?? "").split(", ").filter((f) => f && f !== "not found" && fs.existsSync(f));
    const lits = new Set<string>();
    for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(STATUS_LITERAL)) lits.add(m[1]);
    const claims = rs.reduce((s, r) => s + r.n, 0);
    const human = rs.reduce((s, r) => s + r.human, 0);
    const auto = rs.reduce((s, r) => s + r.auto, 0);
    console.log([tag, [...lits].join("|") || "none", rs.map((r) => `${r.status} ${r.n}`).join(", "), human, auto, claims].join("\t"));
    const dbVals = rs.map((r) => r.status);
    const key =
      lits.size === 1 && dbVals.length === 1 && dbVals[0] === [...lits][0]
        ? `writer hard-codes ${dbVals[0]}`
        : lits.size === 0
          ? `writer sets no literal (DB: ${dbVals.join("/")})`
          : `mixed or rewritten (writer ${[...lits].join("/")}; DB ${dbVals.join("/")})`;
    const t = tally.get(key) ?? { pipelines: 0, claims: 0 };
    tally.set(key, { pipelines: t.pipelines + 1, claims: t.claims + claims });
  }

  console.log(`\n== summary: writer literal vs DB value`);
  for (const [k, t] of [...tally].sort((a, b) => b[1].claims - a[1].claims)) console.log(`${k}\tpipelines ${t.pipelines}\tclaims ${t.claims}`);

  console.log(`\n== post-ingest rewriters`);
  for (const f of REWRITERS) console.log(`${f}\t${fs.existsSync(f) ? "present" : "MISSING"}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
