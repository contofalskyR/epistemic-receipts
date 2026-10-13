/**
 * restore-voteview-full-text.ts — restore the full Voteview description in
 * voteview_v1 claim texts (LATER §1; owner request 2026-10-13).
 *
 * scripts/ingest-voteview-claims.ts cut each vote's description to 77
 * characters + "...". Matching each claim to HSall_rollcalls.csv on Congress +
 * chamber + roll number (its Source externalId voteview_source_<c>_<h|s>_<roll>),
 * this puts back the whole description (whitespace runs collapsed) and leaves
 * the rest of the text exactly as stored. The old text goes into
 * metadata.corrections (batch voteview-full-text-2026-10). Rules:
 * scripts/lib/voteview-text.ts.
 *
 * The dry run also reports which ClaimEmbedding rows go stale (their
 * contentHash no longer matches the claim's embed text, lib/embeddings.ts) and
 * the estimated text-embedding-3-small cost of re-embedding them. It writes the
 * new embed texts to logs/voteview-full-text-embed.jsonl for an exact count.
 *
 *   curl -sSfL -o logs/HSall_rollcalls.csv https://voteview.com/static/data/out/rollcalls/HSall_rollcalls.csv
 *   npx tsx scripts/restore-voteview-full-text.ts --sample 25
 *   npx tsx scripts/restore-voteview-full-text.ts --execute --all    # needs the owner's yes
 *
 * Reads use DATABASE_URL_RO (app_ro); only --execute opens DATABASE_URL.
 * Updates commit in chunks of 1,000, each guarded on the text still being the
 * old one, so a killed run resumes by rerunning. Embeddings are not touched.
 */
import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import { parse as csvParse } from "csv-parse/sync";
import { Pool } from "pg";
import { buildEmbedText, hashContent } from "../lib/embeddings";
import { BATCH_ID, fullDescription, planFullText, textCorrection } from "./lib/voteview-text";

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
const EMBED_OUT = "logs/voteview-full-text-embed.jsonl";
const CHUNK = 1000;
const USD_PER_M_TOKENS = 0.02; // text-embedding-3-small (lib/embeddings.ts)

type Row = Record<string, string>;

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

const pct = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * (xs.length - 1)))];

async function main() {
  if (EXECUTE && !ALL) throw new Error("--execute needs --all (the plan is all or nothing)");
  if (!fs.existsSync(CSV_PATH)) throw new Error(`${CSV_PATH} missing — see the header for the curl line`);
  const retrieved = fs.statSync(CSV_PATH).mtime.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const desc = new Map<string, { full: string; url: string }>();
  for (const r of csvParse(fs.readFileSync(CSV_PATH), { columns: true, skip_empty_lines: true }) as Row[]) {
    const c = parseInt(r.congress, 10);
    const ch = r.chamber === "Senate" ? "s" : "h";
    const roll = parseInt(r.rollnumber, 10);
    desc.set(`voteview_source_${c}_${ch}_${roll}`, {
      full: fullDescription(r),
      url: `https://voteview.com/rollcall/R${ch.toUpperCase()}${String(c).padStart(3, "0")}${String(roll).padStart(4, "0")}`,
    });
  }
  console.log(`Voteview (${CSV_PATH}, retrieved ${retrieved}): ${desc.size} roll calls`);

  const roUrl = process.env.DATABASE_URL_RO;
  const rwUrl = process.env.DATABASE_URL;
  if (!rwUrl) throw new Error("DATABASE_URL is not set (expected in .env.local)");
  const ro = pool(roUrl ?? rwUrl, true);
  console.log(`reads: ${roUrl ? "app_ro (DATABASE_URL_RO)" : "DATABASE_URL, read-only session (app_ro not configured)"}`);

  try {
    const claims = (
      await ro.query<{ id: string; text: string; ingestedBy: string; ext: string; hash: string | null; topics: string[]; done: boolean }>(
        `SELECT c.id, c.text, c."ingestedBy", s."externalId" AS ext, e."contentHash" AS hash,
                array(SELECT t.name FROM "ClaimTopic" ct JOIN "Topic" t ON t.id = ct."topicId" WHERE ct."claimId" = c.id LIMIT 3) AS topics,
                coalesce(c.metadata->'corrections', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('batch', $1::text)) AS done
         FROM "Claim" c
         JOIN "LegislativeVote" lv ON c."externalId" = 'voteview_claim_' || lv.id
         JOIN "Source" s ON s.id = lv."sourceId"
         LEFT JOIN "ClaimEmbedding" e ON e."claimId" = c.id
         WHERE lv."dataSource" = 'voteview_v1' AND NOT c.deleted`,
        [BATCH_ID],
      )
    ).rows;

    type P = { id: string; before: string; text: string; url: string; staleNow: boolean; staleAfter: boolean; embedText: string };
    const plans: P[] = [];
    const skips = new Map<string, number>();
    let done = 0;
    let staleAlready = 0;
    for (const c of claims) {
      const oldEmbed = buildEmbedText(c.text, c.topics, c.ingestedBy);
      const staleNow = c.hash !== null && c.hash !== hashContent(oldEmbed);
      if (staleNow) staleAlready++;
      if (c.done) { done++; continue; }
      const d = desc.get(c.ext);
      if (!d) { skips.set("no Voteview row", (skips.get("no Voteview row") ?? 0) + 1); continue; }
      const p = planFullText(c.text, d.full);
      if (!p.ok) { skips.set(p.skip, (skips.get(p.skip) ?? 0) + 1); continue; }
      const embedText = buildEmbedText(p.text, c.topics, c.ingestedBy);
      plans.push({ id: c.id, before: c.text, text: p.text, url: d.url, staleNow, staleAfter: c.hash !== null && c.hash !== hashContent(embedText), embedText });
    }
    plans.sort((a, b) => a.id.localeCompare(b.id));

    const truncated = claims.filter((c) => /\.\.\." \(Congress/.test(c.text)).length;
    console.log(`live voteview_v1 claims: ${claims.length} · truncated descriptions: ${truncated} · get a longer text: ${plans.length} · already restored: ${done}`);
    for (const [why, n] of [...skips].sort((a, b) => b[1] - a[1])) console.log(`  unchanged ${n}: ${why}`);
    const lens = plans.map((p) => p.text.length).sort((a, b) => a - b);
    const gain = plans.map((p) => p.text.length - p.before.length).sort((a, b) => a - b);
    if (plans.length)
      console.log(
        `  new text length: median ${pct(lens, 0.5)}, p90 ${pct(lens, 0.9)}, p99 ${pct(lens, 0.99)}, max ${lens[lens.length - 1]} chars` +
          ` (longer by median ${pct(gain, 0.5)}, max ${gain[gain.length - 1]}); over 1,000 chars: ${lens.filter((l) => l > 1000).length}`,
      );

    // Embeddings: rows whose contentHash will no longer match the new embed text.
    const reembed = plans.filter((p) => p.staleAfter);
    const overlap = plans.filter((p) => p.staleNow).length;
    const chars = reembed.reduce((s, p) => s + p.embedText.length, 0);
    const tokens = Math.ceil(chars / 4);
    console.log(
      `embeddings: ${reembed.length} go stale with this change · ${staleAlready} live voteview_v1 embeddings are stale already ` +
        `(${overlap} of them in this batch, ${staleAlready - overlap} not) → ${reembed.length + staleAlready - overlap} stale after the write`,
    );
    console.log(
      `re-embedding the ${reembed.length} changed claims: ~${(tokens / 1e6).toFixed(2)}M tokens (chars/4) ≈ $${((tokens / 1e6) * USD_PER_M_TOKENS).toFixed(2)} at $${USD_PER_M_TOKENS}/1M`,
    );
    fs.writeFileSync(EMBED_OUT, reembed.map((p) => JSON.stringify({ id: p.id, text: p.embedText })).join("\n") + "\n");
    console.log(`embed texts → ${EMBED_OUT}`);

    if (SAMPLE) {
      console.log(`\n${Math.min(SAMPLE, plans.length)} before/after pairs spread across the batch:`);
      for (const p of spread(plans, SAMPLE)) console.log(`- ${p.id}  ${p.url}\n  before: ${p.before}\n  after:  ${p.text}`);
    }

    if (!EXECUTE) {
      console.log("\nNo writes. --execute --all applies the plan, after the owner's yes.");
      return;
    }

    const rw = pool(rwUrl, false);
    try {
      for (let i = 0; i < plans.length; i += CHUNK) {
        const chunk = plans.slice(i, i + CHUNK);
        const db = await rw.connect();
        try {
          await db.query("BEGIN");
          const res = await db.query(
            `UPDATE "Claim" c
             SET text = u.text,
                 metadata = c.metadata || jsonb_build_object('corrections', coalesce(c.metadata->'corrections', '[]'::jsonb) || jsonb_build_array(u.corr)),
                 "updatedAt" = now()
             FROM unnest($1::text[], $2::text[], $3::text[], $4::jsonb[]) AS u(id, before, text, corr)
             WHERE c.id = u.id AND c.text = u.before AND NOT c.deleted`,
            [
              chunk.map((p) => p.id),
              chunk.map((p) => p.before),
              chunk.map((p) => p.text),
              chunk.map((p) => JSON.stringify(textCorrection(p.before, p.url, retrieved, today))),
            ],
          );
          if (res.rowCount !== chunk.length)
            throw new Error(`chunk at ${i}: expected ${chunk.length} rows, updated ${res.rowCount} — rolled back`);
          await db.query("COMMIT");
        } catch (e) {
          await db.query("ROLLBACK").catch(() => {});
          throw e;
        } finally {
          db.release();
        }
        console.log(`committed ${Math.min(i + CHUNK, plans.length)}/${plans.length}`);
      }
    } finally {
      await rw.end();
    }

    // Counts from the database, not the loop (AGENTS.md "Verify ingester counters").
    const n = (
      await ro.query<{ restored: number; truncated: number }>(
        `SELECT count(*) FILTER (WHERE coalesce(metadata->'corrections', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('batch', $1::text)))::int AS restored,
                count(*) FILTER (WHERE text LIKE '%..." (Congress%')::int AS truncated
         FROM "Claim" WHERE "externalId" LIKE 'voteview\\_claim\\_%' AND NOT deleted`,
        [BATCH_ID],
      )
    ).rows[0];
    console.log(`database: ${n.restored} claims carry ${BATCH_ID}; ${n.truncated} live voteview_v1 texts still end in "..."`);
  } finally {
    await ro.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
