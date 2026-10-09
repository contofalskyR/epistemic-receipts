/**
 * review-transition-sources.ts — read and judge claude_sourcing_v1 candidates.
 * Writes only "TransitionSourceCandidate" (status, reviewedAt, trace.review, trace.verify).
 *
 *   npx tsx scripts/review-transition-sources.ts                 # counts + spend
 *   npx tsx scripts/review-transition-sources.ts --sample 50     # random candidates
 *   npx tsx scripts/review-transition-sources.ts --sample 20 --status no_source_found
 *   npx tsx scripts/review-transition-sources.ts --accept <id>[,<id>…]
 *   npx tsx scripts/review-transition-sources.ts --reject <id>[,<id>…]
 *   npx tsx scripts/review-transition-sources.ts --auto-review logs/transition-verify.jsonl [--apply]
 *
 * --accept / --reject record trace.review.by = "human"; promotion then marks the
 * Source and Edge humanReviewed. --auto-review applies autoReviewDecision() (scripts/lib)
 * to the output of scripts/verify-transition-sources.ts. It re-checks each dead link
 * with a browser user-agent before rejecting it, and is a dry run unless --apply. Its
 * decisions record trace.review.by = "machine:verify-transition-sources"; promotion
 * marks those humanReviewed false, autoApproved true (AGENTS.md: the two are separate
 * signals).
 *
 * --sample also takes --min-confidence / --max-confidence and --seed <any text>
 * (the same seed gives the same sample). Promoted rows can no longer be flipped.
 */
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import {
  MACHINE_REVIEWER,
  autoReviewDecision,
  formatTransitionDate,
  isDeadLink,
  makePool,
  truncate,
  type VerifyLike,
} from "./lib/transition-sourcing";

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
           SET status = $2::"TransitionSourceStatus", "reviewedAt" = now(),
               trace = jsonb_set(coalesce(trace, '{}'::jsonb), '{review}', jsonb_build_object('by', 'human', 'at', now()))
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

    const autoFile = opt("auto-review");
    if (autoFile) return await autoReview(pool, autoFile, argv.includes("--apply"));

    const sample = opt("sample");
    if (sample) {
      const n = Number(sample);
      if (!Number.isInteger(n) || n < 1) die("--sample takes a positive integer");
      const status = opt("status") ?? "candidate";
      if (!STATUSES.includes(status)) die(`--status must be one of ${STATUSES.join(", ")}`);
      const r = await pool.query(
        `SELECT t.id, t.url, t.title, t.publisher, t."publishedAt", t.excerpt, t.confidence, t.rationale, t.model,
                t."urlInSearchResults", t."costUsd"::float AS cost, c.text AS claim, c."externalId",
                t.trace->'verify' AS verify, t.trace->'review'->>'by' AS "reviewedBy",
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
        if (x.verify) {
          const m = x.verify.match === null ? "no text" : `excerpt match ${Number(x.verify.match).toFixed(2)}`;
          console.log(`  check     HTTP ${x.verify.status ?? "—"} · ${m} · ${x.verify.rule}${x.reviewedBy ? ` · reviewed by ${x.reviewedBy}` : ""}`);
        }
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

type Verified = VerifyLike & { id: string; url: string };

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

/** One more look before a link is called dead: a browser user-agent, 20 s. */
async function stillDead(url: string): Promise<boolean> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20_000);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ac.signal, headers: { "user-agent": BROWSER_UA } });
    await res.body?.cancel().catch(() => {});
    return res.status === 404 || res.status === 410;
  } catch (e) {
    return /ENOTFOUND/.test((e as { cause?: { code?: string } }).cause?.code ?? "");
  } finally {
    clearTimeout(timer);
  }
}

async function autoReview(pool: ReturnType<typeof makePool>, file: string, apply: boolean) {
  const verified = new Map<string, Verified>();
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const v = JSON.parse(line) as Verified;
      verified.set(v.id, v);
    } catch {
      /* torn line */
    }
  }
  const rows = (
    await pool.query<{ id: string; url: string; confidence: number | null }>(
      `SELECT id, url, confidence FROM "TransitionSourceCandidate" WHERE status = 'candidate' AND "promotedAt" IS NULL AND url IS NOT NULL`,
    )
  ).rows;
  const decided = rows.map((r) => ({ ...r, v: verified.get(r.id), ...autoReviewDecision(verified.get(r.id), r.confidence) }));

  const rejects = decided.filter((d) => d.decision === "reject");
  let i = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (i < rejects.length) {
        const d = rejects[i++];
        if (!(await stillDead(d.url))) Object.assign(d, { decision: "keep", rule: "dead on first check, alive on re-check" });
      }
    }),
  );

  const tally = new Map<string, number>();
  for (const d of decided) tally.set(`${d.decision.padEnd(6)}  ${d.rule}`, (tally.get(`${d.decision.padEnd(6)}  ${d.rule}`) ?? 0) + 1);
  console.log(`${rows.length} candidates · ${verified.size} verification records (${file})`);
  for (const [k, n] of [...tally].sort()) console.log(`  ${String(n).padStart(5)}  ${k}`);
  if (!apply) {
    console.log("Dry run — nothing written. Re-run with --apply to record these decisions.");
    return;
  }

  const at = new Date().toISOString();
  const verifyOf = (d: (typeof decided)[number]) =>
    JSON.stringify(d.v ? { status: d.v.status, match: d.v.match, textLen: d.v.textLen, metaExcerpt: d.v.metaExcerpt, dead: isDeadLink(d.v), rule: d.rule, at } : { rule: d.rule, at });
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    // Every candidate keeps its check result, so a human reviewer sees it in --sample.
    await db.query(
      `UPDATE "TransitionSourceCandidate" t SET trace = jsonb_set(coalesce(t.trace, '{}'::jsonb), '{verify}', x.v)
       FROM unnest($1::text[], $2::jsonb[]) AS x(id, v) WHERE t.id = x.id`,
      [decided.map((d) => d.id), decided.map(verifyOf)],
    );
    const flip = async (decision: "accept" | "reject", status: string) => {
      const list = decided.filter((d) => d.decision === decision);
      const r = await db.query(
        `UPDATE "TransitionSourceCandidate" t
           SET status = $2::"TransitionSourceStatus", "reviewedAt" = now(),
               trace = jsonb_set(t.trace, '{review}', jsonb_build_object('by', $3::text, 'at', now(), 'rule', x.rule))
         FROM unnest($1::text[], $4::text[]) AS x(id, rule)
         WHERE t.id = x.id AND t.status = 'candidate' AND t."promotedAt" IS NULL`,
        [list.map((d) => d.id), status, MACHINE_REVIEWER, list.map((d) => d.rule)],
      );
      return r.rowCount ?? 0;
    };
    const accepted = await flip("accept", "accepted");
    const rejected = await flip("reject", "rejected");
    await db.query("COMMIT");
    console.log(`applied: accepted ${accepted} · rejected ${rejected} · left as candidate ${decided.length - accepted - rejected}`);
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    db.release();
  }
  const v = await pool.query(
    `SELECT status::text, coalesce(trace->'review'->>'by', '—') AS by, count(*)::int AS n FROM "TransitionSourceCandidate" GROUP BY 1, 2 ORDER BY 1, 2`,
  );
  console.log("table now:", v.rows.map((r) => `${r.status}/${r.by} ${r.n}`).join(" · "));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
