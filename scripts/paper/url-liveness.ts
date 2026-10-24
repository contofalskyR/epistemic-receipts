/**
 * url-liveness.ts — does a Source.url still resolve? A seeded sample of
 * Source URLs, stratified by the pipeline of the claim they support, checked
 * with HEAD (GET when HEAD is refused). For docs/paper Technical Validation.
 * Reads the DB through app_ro (read-only session); writes only local files.
 *
 *   npx tsx scripts/paper/url-liveness.ts                 # sample 1,000, seed "er-paper-2026-10"
 *   npx tsx scripts/paper/url-liveness.ts --n 1000 --seed er-paper-2026-10
 *   npx tsx scripts/paper/url-liveness.ts --summary       # rebuild the summary from results.csv
 *   npx tsx scripts/paper/url-liveness.ts --markers --n 300   # transition marker sources instead
 *
 * Sample: Sources with an http(s) URL, linked by a non-deleted Edge to a corpus
 * claim, assigned to that claim's pipeline (a Source on several pipelines counts
 * once, for the first pipeline in md5 order). Every pipeline gets min(3, its
 * URLs); the rest of n is split in proportion to each pipeline's URL count.
 * Order within a pipeline is md5(source id || seed), so a rerun with the same
 * seed draws the same rows (until the data change).
 *
 * Politeness: one request at a time per host, ≥ 1.5 s apart; 6 hosts at a time;
 * 10 s timeout; a User-Agent naming the project. Redirects are followed and the
 * final status is recorded. HEAD → GET fallback on 403/405/400/501 or a network
 * error (many servers refuse HEAD); the GET body is not read.
 *
 * --markers samples instead the Sources attached to transitions (ClaimStatusHistory
 * rows after a claim's first, sourceId non-null): the evidence behind the T1
 * trajectory count, which the Edge-based sample barely reaches. Same allocation,
 * by the transition's claim pipeline.
 *
 * Output: docs/paper/url-liveness/results.csv + summary.md (results-markers.csv +
 * summary-markers.md with --markers). Nothing is written to the database.
 */
import { config as loadEnv } from "dotenv";
import { execSync } from "child_process";
import * as fs from "fs";
import { Pool } from "pg";

loadEnv({ path: ".env.local", quiet: true });

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const N = Number(opt("n", "1000"));
const SEED = opt("seed", "er-paper-2026-10");
const OUT_DIR = "docs/paper/url-liveness";
const MARKERS = argv.includes("--markers");
const RESULTS = `${OUT_DIR}/results${MARKERS ? "-markers" : ""}.csv`;
const SUMMARY = `${OUT_DIR}/summary${MARKERS ? "-markers" : ""}.md`;
const TIMEOUT_MS = 10_000;
const HOST_GAP_MS = 1_500;
const HOST_PARALLEL = 6;
const UA = "EpistemicReceipts-LinkCheck/1.0 (research link-rot audit; +https://epistemic-receipts.vercel.app/methodology)";

type Row = { pipeline: string; source_id: string; url: string; pipeline_urls: number; pipeline_claims: number };
type Result = Row & {
  method: string; status: number | null; final_host: string; redirected: boolean; error: string; ms: number; checked_at: string;
};

const SAMPLE_SQL = `
  WITH su AS (
    SELECT DISTINCT ON (s.id) c."ingestedBy" AS pipeline, s.id AS source_id, s.url
    FROM "Edge" e
    JOIN "Claim" c ON c.id = e."claimId" AND NOT c.deleted
    JOIN "Source" s ON s.id = e."sourceId" AND NOT s.deleted
    WHERE NOT e.deleted AND s.url ~* '^https?://[a-z0-9.-]+\\.[a-z]{2,}'
    ORDER BY s.id, md5(c."ingestedBy" || $1)
  ), sized AS (
    SELECT pipeline, count(*)::int AS pipeline_urls FROM su GROUP BY 1
  ), claims AS (
    SELECT "ingestedBy" AS pipeline, count(*)::int AS pipeline_claims FROM "Claim" WHERE NOT deleted GROUP BY 1
  ), ranked AS (
    SELECT su.*, sized.pipeline_urls, claims.pipeline_claims,
           row_number() OVER (PARTITION BY su.pipeline ORDER BY md5(su.source_id || $1)) AS rk
    FROM su JOIN sized USING (pipeline) JOIN claims USING (pipeline)
  )
  SELECT pipeline, source_id, url, pipeline_urls, pipeline_claims, rk::int AS rk FROM ranked WHERE rk <= $2`;

const MARKER_SQL = `
  WITH h AS (
    SELECT h."claimId", h."sourceId",
           row_number() OVER (PARTITION BY h."claimId" ORDER BY h.seq ASC NULLS LAST, h."occurredAt", h."createdAt") AS rn
    FROM "ClaimStatusHistory" h
  ), su AS (
    SELECT DISTINCT ON (s.id) c."ingestedBy" AS pipeline, s.id AS source_id, s.url
    FROM h
    JOIN "Claim" c ON c.id = h."claimId" AND NOT c.deleted
    JOIN "Source" s ON s.id = h."sourceId" AND NOT s.deleted
    WHERE h.rn > 1 AND s.url ~* '^https?://[a-z0-9.-]+\\.[a-z]{2,}'
    ORDER BY s.id, md5(c."ingestedBy" || $1)
  ), sized AS (
    SELECT pipeline, count(*)::int AS pipeline_urls FROM su GROUP BY 1
  ), claims AS (
    SELECT "ingestedBy" AS pipeline, count(*)::int AS pipeline_claims FROM "Claim" WHERE NOT deleted GROUP BY 1
  ), ranked AS (
    SELECT su.*, sized.pipeline_urls, claims.pipeline_claims,
           row_number() OVER (PARTITION BY su.pipeline ORDER BY md5(su.source_id || $1)) AS rk
    FROM su JOIN sized USING (pipeline) JOIN claims USING (pipeline)
  )
  SELECT pipeline, source_id, url, pipeline_urls, pipeline_claims, rk::int AS rk FROM ranked WHERE rk <= $2`;

/** min(3, size) each, then the remainder in proportion to size (largest remainder). */
function allocate(sizes: Map<string, number>, n: number): Map<string, number> {
  const a = new Map<string, number>();
  for (const [p, s] of sizes) a.set(p, Math.min(3, s));
  let left = n - [...a.values()].reduce((x, y) => x + y, 0);
  const room = [...sizes].map(([p, s]) => ({ p, s, room: s - a.get(p)! })).filter((x) => x.room > 0);
  const total = room.reduce((x, y) => x + y.s, 0);
  const shares = room.map((x) => ({ ...x, exact: (left * x.s) / total }));
  for (const x of shares) {
    const k = Math.min(Math.floor(x.exact), x.room);
    a.set(x.p, a.get(x.p)! + k);
  }
  left = n - [...a.values()].reduce((x, y) => x + y, 0);
  for (const x of shares.sort((u, v) => (v.exact % 1) - (u.exact % 1))) {
    if (left <= 0) break;
    if (a.get(x.p)! < x.s) { a.set(x.p, a.get(x.p)! + 1); left--; }
  }
  return a;
}

async function sample(): Promise<Row[]> {
  const url = process.env.DATABASE_URL_RO;
  if (!url) throw new Error("DATABASE_URL_RO missing from .env.local");
  const pool = new Pool({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ""), ssl: { rejectUnauthorized: false }, max: 1 });
  try {
    const c = await pool.connect();
    try {
      await c.query("SET default_transaction_read_only = on");
      await c.query("SET statement_timeout = 1800000");
      // Draw up to N per pipeline, then trim to the allocation.
      const rows = (await c.query(MARKERS ? MARKER_SQL : SAMPLE_SQL, [SEED, N])).rows as (Row & { rk: number })[];
      const sizes = new Map<string, number>();
      for (const r of rows) sizes.set(r.pipeline, r.pipeline_urls);
      const alloc = allocate(sizes, N);
      return rows.filter((r) => r.rk <= (alloc.get(r.pipeline) ?? 0)).map(({ rk: _rk, ...r }) => r);
    } finally {
      c.release();
    }
  } finally {
    await pool.end();
  }
}

async function request(url: string, method: "HEAD" | "GET") {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method, redirect: "follow", signal: ctl.signal, headers: { "User-Agent": UA, Accept: "*/*" } });
    await res.body?.cancel().catch(() => {});
    return { status: res.status, finalUrl: res.url, redirected: res.redirected, error: "" };
  } catch (e) {
    const err = e as { name?: string; cause?: { code?: string }; message?: string };
    return { status: null, finalUrl: url, redirected: false, error: err.name === "AbortError" ? "timeout" : (err.cause?.code ?? err.message ?? String(e)).slice(0, 80) };
  } finally {
    clearTimeout(timer);
  }
}

async function check(r: Row): Promise<Result> {
  const t0 = Date.now();
  let method = "HEAD";
  let out = await request(r.url, "HEAD");
  if (out.status === null || [400, 403, 405, 501].includes(out.status)) {
    method = "HEAD→GET";
    out = await request(r.url, "GET");
  }
  let finalHost = "";
  try { finalHost = new URL(out.finalUrl).host.replace(/^www\./, ""); } catch { /* keep empty */ }
  return { ...r, method, status: out.status, final_host: finalHost, redirected: out.redirected, error: out.error, ms: Date.now() - t0, checked_at: new Date().toISOString() };
}

const host = (u: string) => { try { return new URL(u).host.toLowerCase(); } catch { return u; } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const csvCell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const COLS: (keyof Result)[] = ["pipeline", "source_id", "url", "pipeline_urls", "pipeline_claims", "method", "status", "final_host", "redirected", "error", "ms", "checked_at"];

async function run(rows: Row[]): Promise<Result[]> {
  const byHost = new Map<string, Row[]>();
  for (const r of rows) byHost.set(host(r.url), [...(byHost.get(host(r.url)) ?? []), r]);
  const queues = [...byHost.values()].sort((a, b) => b.length - a.length);
  const results: Result[] = [];
  let next = 0;
  async function worker() {
    while (next < queues.length) {
      const q = queues[next++];
      for (const r of q) {
        const t = Date.now();
        results.push(await check(r));
        if (results.length % 50 === 0) console.error(`  ${results.length}/${rows.length}`);
        const wait = HOST_GAP_MS - (Date.now() - t);
        if (wait > 0) await sleep(wait);
      }
    }
  }
  await Promise.all(Array.from({ length: HOST_PARALLEL }, worker));
  return results;
}

function parseCsv(text: string): Result[] {
  const lines: string[][] = [];
  let cur: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { cur.push(cell); cell = ""; }
    else if (ch === "\n") { cur.push(cell); lines.push(cur); cur = []; cell = ""; }
    else cell += ch;
  }
  if (cell || cur.length) { cur.push(cell); lines.push(cur); }
  const [head, ...body] = lines;
  return body.filter((l) => l.length === head.length).map((l) => {
    const o = Object.fromEntries(head.map((h, i) => [h, l[i]])) as Record<string, string>;
    return { ...o, pipeline_urls: Number(o.pipeline_urls), pipeline_claims: Number(o.pipeline_claims), status: o.status === "" ? null : Number(o.status), redirected: o.redirected === "true", ms: Number(o.ms) } as unknown as Result;
  });
}

// Four categories for the paper (owner, 2026-10-24); refusals are never "dead".
//   resolve      final status 2xx/3xx, except 202
//   bot-refused  403, 429, 405 (the server refuses this automated client), other 4xx except 404/410,
//                and 202: the hosts that answer 202 here (courtlistener.com, legislation.govt.nz,
//                eur-lex.europa.eu, digitallibrary.un.org, pubmed …) serve an empty bot-challenge
//                page with that status, not the document (checked by hand with curl, 2026-10-24)
//   gone         404, 410
//   unreachable  timeout, network or TLS error, 5xx
type Bucket = "resolve" | "bot-refused" | "gone" | "unreachable";
function bucket(r: Result): Bucket {
  if (r.status === null || r.status >= 500) return "unreachable";
  if (r.status === 202) return "bot-refused";
  if (r.status < 400) return "resolve";
  if (r.status === 404 || r.status === 410) return "gone";
  return "bot-refused";
}
const BUCKETS: Bucket[] = ["resolve", "bot-refused", "gone", "unreachable"];

function summarise(results: Result[], meta: string) {
  const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) : "—");
  const count = (rs: Result[]) => { const m = new Map<Bucket, number>(BUCKETS.map((b) => [b, 0])); for (const r of rs) m.set(bucket(r), m.get(bucket(r))! + 1); return m; };
  const all = count(results);
  // Corpus-weighted: each pipeline's bucket shares weighted by its claim count.
  const byP = new Map<string, Result[]>();
  for (const r of results) byP.set(r.pipeline, [...(byP.get(r.pipeline) ?? []), r]);
  const totalClaims = [...byP.values()].reduce((s, rs) => s + rs[0].pipeline_claims, 0);
  const weighted = new Map<Bucket, number>(BUCKETS.map((b) => [b, 0]));
  for (const rs of byP.values()) {
    const c = count(rs);
    for (const b of BUCKETS) weighted.set(b, weighted.get(b)! + (c.get(b)! / rs.length) * (rs[0].pipeline_claims / totalClaims));
  }
  const out: string[] = [
    "# Source URL liveness",
    "",
    meta,
    "",
    "Statuses are final statuses after redirects. Categories: **resolve** = 2xx/3xx except 202; **bot-refused** = 403, 429, 405, another 4xx except 404/410, or 202 (an empty bot-challenge page; the server refused this automated client, and the document may well open in a browser); **gone** = 404/410; **unreachable** = timeout, network or TLS error, or 5xx. HEAD was retried as GET on 400/403/405/501 or a network error.",
    "",
    "## Overall",
    "",
    "| Outcome | URLs (unweighted) | % | % weighted by pipeline claim count |",
    "|---|---:|---:|---:|",
    ...BUCKETS.map((b) => `| ${b} | ${all.get(b)} | ${pct(all.get(b)!, results.length)} | ${(100 * weighted.get(b)!).toFixed(1)} |`),
    `| **Total** | **${results.length}** | 100 | 100 |`,
    "",
    `Redirected (final URL differs): ${results.filter((r) => r.redirected).length} (${pct(results.filter((r) => r.redirected).length, results.length)} %). Needed the GET fallback: ${results.filter((r) => r.method !== "HEAD").length}. Exact statuses: ${[...new Map(results.map((r) => [String(r.status ?? r.error), 0])).keys()].map((k) => `${k} ${results.filter((r) => String(r.status ?? r.error) === k).length}`).join(", ")}.`,
    "",
    "## Hosts per category (final host, top 15)",
    "",
    ...(["bot-refused", "gone", "unreachable"] as Bucket[]).map((b) => {
      const m = new Map<string, number>();
      for (const r of results.filter((x) => bucket(x) === b)) { const h = r.final_host || host(r.url); m.set(h, (m.get(h) ?? 0) + 1); }
      return `- **${b}:** ${[...m].sort((x, y) => y[1] - x[1]).slice(0, 15).map(([h, n]) => `${h} ${n}`).join(", ") || "none"}`;
    }),
    "",
    "## By pipeline",
    "",
    `| Pipeline | Pipeline URLs | Sampled | ${BUCKETS.join(" | ")} |`,
    `|---|---:|---:|${BUCKETS.map(() => "---:").join("|")}|`,
    ...[...byP].sort((a, b) => b[1][0].pipeline_claims - a[1][0].pipeline_claims).map(([p, rs]) => {
      const c = count(rs);
      return `| \`${p}\` | ${rs[0].pipeline_urls.toLocaleString("en-US")} | ${rs.length} | ${BUCKETS.map((b) => c.get(b)).join(" | ")} |`;
    }),
    "",
    "## Hosts that refused or failed most (final host)",
    "",
    "| Host | Not 2xx/3xx | Of sampled |",
    "|---|---:|---:|",
    ...(() => {
      const m = new Map<string, { bad: number; n: number }>();
      for (const r of results) { const h = r.final_host || host(r.url); const x = m.get(h) ?? { bad: 0, n: 0 }; x.n++; if (bucket(r) !== "2xx/3xx") x.bad++; m.set(h, x); }
      return [...m].filter(([, x]) => x.bad > 0).sort((a, b) => b[1].bad - a[1].bad).slice(0, 20).map(([h, x]) => `| ${h} | ${x.bad} | ${x.n} |`);
    })(),
    "",
  ];
  fs.writeFileSync(SUMMARY, out.join("\n"));
  console.error(`wrote ${SUMMARY}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const git = execSync("git rev-parse --short HEAD").toString().trim();
  if (argv.includes("--summary")) {
    const results = parseCsv(fs.readFileSync(RESULTS, "utf8"));
    const first = results.map((r) => r.checked_at).sort()[0], last = results.map((r) => r.checked_at).sort().at(-1);
    summarise(results, `Generated by \`scripts/paper/url-liveness.ts --summary\` from \`results.csv\` (checked ${first} → ${last}; git ${git}).`);
    return;
  }
  const rows = await sample();
  console.error(`sampled ${rows.length} URLs across ${new Set(rows.map((r) => r.pipeline)).size} pipelines (seed ${SEED})`);
  const t0 = new Date().toISOString();
  const results = await run(rows);
  results.sort((a, b) => a.pipeline.localeCompare(b.pipeline) || a.source_id.localeCompare(b.source_id));
  fs.writeFileSync(RESULTS, [COLS.join(","), ...results.map((r) => COLS.map((k) => csvCell(r[k])).join(","))].join("\n") + "\n");
  summarise(results, `Generated by \`scripts/paper/url-liveness.ts --n ${N} --seed ${SEED}\` (git ${git}), checked ${t0} → ${new Date().toISOString()} from one client. Sample: ${rows.length} ${MARKERS ? "transition marker" : "Edge-linked"} Source URLs, stratified by claim pipeline (min 3 per pipeline, the rest proportional to each pipeline's URL count). Timeout ${TIMEOUT_MS / 1000} s, ≥ ${HOST_GAP_MS / 1000} s between requests to one host.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
