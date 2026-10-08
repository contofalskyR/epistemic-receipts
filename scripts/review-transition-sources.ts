/**
 * review-transition-sources.ts — read and judge claude_sourcing_v1 candidates.
 * Writes only "TransitionSourceCandidate".status / reviewedAt.
 *
 *   npx tsx scripts/review-transition-sources.ts                 # counts + spend
 *   npx tsx scripts/review-transition-sources.ts --sample 50     # random candidates
 *   npx tsx scripts/review-transition-sources.ts --sample 20 --status no_source_found
 *   npx tsx scripts/review-transition-sources.ts --accept <id>[,<id>…]
 *   npx tsx scripts/review-transition-sources.ts --reject <id>[,<id>…]
 *
 * --sample also takes --min-confidence / --max-confidence and --seed <any text>
 * (the same seed gives the same sample). Promoted rows can no longer be flipped.
 */
import { config as loadEnv } from "dotenv";
import { formatTransitionDate, makePool, truncate } from "./lib/transition-sourcing";

loadEnv({ path: ".env.local", quiet: true });

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const STATUSES = ["candidate", "accepted", "rejected", "no_source_found"];

function die(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const ids = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

async function main() {
  const pool = makePool(2);
  try {
    const accept = opt("accept");
    const reject = opt("reject");
    if (accept || reject) {
      const list = ids((accept ?? reject)!);
      if (!list.length) die("no ids given");
      const status = accept ? "accepted" : "rejected";
      const r = await pool.query(
        `UPDATE "TransitionSourceCandidate"
           SET status = $2::"TransitionSourceStatus", "reviewedAt" = now()
         WHERE id = ANY($1) AND "promotedAt" IS NULL ${accept ? `AND url IS NOT NULL` : ""}
         RETURNING id`,
        [list, status],
      );
      const changed = new Set(r.rows.map((x) => x.id as string));
      console.log(`${status}: ${changed.size} of ${list.length}`);
      const missed = list.filter((id) => !changed.has(id));
      if (missed.length) console.log(`not changed (unknown id, already promoted${accept ? ", or no URL to accept" : ""}): ${missed.join(", ")}`);
      return;
    }

    const sample = opt("sample");
    if (sample) {
      const n = Number(sample);
      if (!Number.isInteger(n) || n < 1) die("--sample takes a positive integer");
      const status = opt("status") ?? "candidate";
      if (!STATUSES.includes(status)) die(`--status must be one of ${STATUSES.join(", ")}`);
      const r = await pool.query(
        `SELECT t.id, t.url, t.title, t.publisher, t."publishedAt", t.excerpt, t.confidence, t.rationale, t.model,
                t."urlInSearchResults", t."costUsd"::float AS cost, c.text AS claim, c."externalId",
                h."fromAxis", h."toAxis", h."occurredAt", h."datePrecision", s.url AS prior
         FROM "TransitionSourceCandidate" t
         JOIN "ClaimStatusHistory" h ON h.id = t."transitionId"
         JOIN "Claim" c ON c.id = t."claimId"
         LEFT JOIN "Source" s ON s.id = t."priorSourceId"
         WHERE t.status = $1::"TransitionSourceStatus"
           AND ($2::float IS NULL OR t.confidence >= $2) AND ($3::float IS NULL OR t.confidence <= $3)
         ORDER BY md5(t.id || coalesce($5, random()::text)) LIMIT $4`,
        [status, opt("min-confidence") ?? null, opt("max-confidence") ?? null, n, opt("seed") ?? null],
      );
      const rule = "─".repeat(100);
      console.log(`${r.rows.length} ${status} row(s)\n${rule}`);
      console.log(`${"id".padEnd(25)}  ${"conf".padEnd(4)}  ${"model".padEnd(17)}  transition`);
      console.log(rule);
      for (const x of r.rows) {
        const when = formatTransitionDate(x.occurredAt, x.datePrecision);
        const conf = x.confidence === null ? "—" : x.confidence.toFixed(2);
        console.log(`${x.id.padEnd(25)}  ${conf.padEnd(4)}  ${x.model.padEnd(17)}  ${x.fromAxis ?? "∅"} → ${x.toAxis} · ${when}`);
        console.log(`  claim     ${truncate(x.claim, 140)}  [${x.externalId ?? ""}]`);
        if (x.prior) console.log(`  was       ${x.prior}`);
        if (x.url) {
          const pub = [x.publisher, x.publishedAt ? x.publishedAt.toISOString().slice(0, 10) : null].filter(Boolean).join(", ");
          console.log(`  url       ${x.url}${x.urlInSearchResults ? "" : "   ⚠ not among search results"}`);
          console.log(`  title     ${truncate(x.title ?? "", 140)}${pub ? `  (${pub})` : ""}`);
          console.log(`  excerpt   ${truncate((x.excerpt ?? "").replace(/\s+/g, " "), 300)}`);
        }
        console.log(`  why       ${truncate((x.rationale ?? "").replace(/\s+/g, " "), 300)}`);
        console.log(rule);
      }
      return;
    }

    const r = await pool.query(
      `SELECT status::text, count(*)::int AS n, coalesce(sum("costUsd"), 0)::float AS usd,
              count(*) FILTER (WHERE "promotedAt" IS NOT NULL)::int AS promoted
       FROM "TransitionSourceCandidate" GROUP BY 1 ORDER BY 1`,
    );
    if (!r.rows.length) console.log("TransitionSourceCandidate is empty.");
    for (const x of r.rows)
      console.log(`${x.status.padEnd(16)} ${String(x.n).padStart(6)}  $${x.usd.toFixed(4)}${x.promoted ? `  (${x.promoted} promoted)` : ""}`);
    const total = r.rows.reduce((a, x) => a + x.usd, 0);
    if (r.rows.length) console.log(`${"total".padEnd(16)} ${String(r.rows.reduce((a, x) => a + x.n, 0)).padStart(6)}  $${total.toFixed(4)}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
