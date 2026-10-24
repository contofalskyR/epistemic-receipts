/**
 * corrections-counts.ts — the static side of the corrections record, for
 * docs/paper/numbers.md §8: every entry on the public /corrections page
 * (app/corrections/page.tsx ENTRIES) and the under-review list
 * (data/vote-results-under-review.json), with "records affected" over the
 * corpus (Claim.deleted = false, read through app_ro).
 *
 *   npx tsx scripts/paper/corrections-counts.ts > docs/paper/sql/out/corrections-counts.out
 *
 * The page's recordsAffected values are literals (one is reviewList.votes.length),
 * so they are read from the source text, not executed. Read-only.
 */
import { config as loadEnv } from "dotenv";
import { execSync } from "child_process";
import * as fs from "fs";
import { Pool } from "pg";

loadEnv({ path: ".env.local", quiet: true });

type Entry = { date: string; kind: string; source: string; recordsAffected: number | null };

function pageEntries(reviewTotal: number): Entry[] {
  const src = fs.readFileSync("app/corrections/page.tsx", "utf8");
  const block = src.slice(src.indexOf("const ENTRIES"), src.indexOf("const KIND_STYLE"));
  // Each entry opens with `date: "YYYY-MM-DD"`; split on that and read the fields it carries.
  return block
    .split(/\n\s*\{\n\s*date: /)
    .slice(1)
    .map((chunk) => {
      const field = (name: string) => chunk.match(new RegExp(`\\b${name}:\\s*"([^"]*)"`))?.[1] ?? "";
      const ra = chunk.match(/recordsAffected:\s*([A-Za-z0-9_.]+)/)?.[1];
      return {
        date: chunk.match(/^"([^"]+)"/)?.[1] ?? "",
        kind: field("kind"),
        source: field("source"),
        recordsAffected: ra === undefined ? null : ra === "reviewTotal" ? reviewTotal : Number(ra),
      };
    });
}

async function main() {
  const review = JSON.parse(fs.readFileSync("data/vote-results-under-review.json", "utf8")) as {
    generated: string; counts: Record<string, number>; votes: [string, string][];
  };
  const entries = pageEntries(review.votes.length);

  const url = process.env.DATABASE_URL_RO;
  if (!url) throw new Error("DATABASE_URL_RO missing from .env.local");
  const pool = new Pool({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ""), ssl: { rejectUnauthorized: false }, max: 1 });
  let corpus: number;
  try {
    const c = await pool.connect();
    try {
      await c.query("SET default_transaction_read_only = on");
      corpus = Number((await c.query(`SELECT count(*)::int AS n FROM "Claim" WHERE NOT deleted`)).rows[0].n);
    } finally {
      c.release();
    }
  } finally {
    await pool.end();
  }

  const pct = (n: number) => `${((100 * n) / corpus).toFixed(3)}%`;
  console.log(`-- script: scripts/paper/corrections-counts.ts`);
  console.log(`-- run:    ${new Date().toISOString()} · git ${execSync("git rev-parse --short HEAD").toString().trim()} · role app_ro`);
  console.log(`\ncorpus (Claim.deleted = false): ${corpus}`);
  console.log(`\n== /corrections page entries (app/corrections/page.tsx)`);
  console.log(`date        kind        recordsAffected  % corpus  source`);
  for (const e of entries)
    console.log(`${e.date}  ${e.kind.padEnd(10)}  ${String(e.recordsAffected ?? "—").padStart(15)}  ${(e.recordsAffected === null ? "—" : pct(e.recordsAffected)).padStart(8)}  ${e.source}`);
  const total = entries.reduce((s, e) => s + (e.recordsAffected ?? 0), 0);
  console.log(`\nentries: ${entries.length} · sum of recordsAffected: ${total} (${pct(total)} of corpus)`);
  const byKind = new Map<string, number>();
  for (const e of entries) byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + (e.recordsAffected ?? 0));
  console.log(`by kind: ${[...byKind].map(([k, n]) => `${k} ${n} (${pct(n)})`).join(" · ")}`);

  console.log(`\n== data/vote-results-under-review.json (generated ${review.generated})`);
  console.log(`votes: ${review.votes.length} (${pct(review.votes.length)} of corpus)`);
  for (const [g, n] of Object.entries(review.counts)) console.log(`  ${g}: ${n}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
