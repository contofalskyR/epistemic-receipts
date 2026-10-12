/**
 * verify-transition-sources-api.ts — the URL check of verify-transition-sources.ts,
 * with the page fetched by the Claude API's web fetch tool instead of from this
 * machine. The excerpt match is still computed here, on the text the tool
 * returned, with the same excerptMatch(), so results are comparable.
 *
 * Writes logs/transition-verify-api.jsonl in the same VerifyResult shape, so
 * `review-transition-sources.ts --auto-review logs/transition-verify-api.jsonl`
 * reads it unchanged. Reads the database only. Resumable (ids already in the
 * output file are skipped). Every request's cost goes to the sourcing ledger
 * (kind "verify-fetch"), so lifetime spend stays in one place.
 *
 * The tool reports no HTTP status: a successful fetch is recorded as 200, a
 * failed one as status null with error "api:<error_code>". Auto-review therefore
 * keeps every failed fetch for a human and never rejects one as a dead link.
 * The tool refuses robots.txt-disallowed URLs (url_not_allowed) and does not
 * run JavaScript.
 *
 *   npx tsx scripts/verify-transition-sources-api.ts --limit 10       # try a few
 *   npx tsx scripts/verify-transition-sources-api.ts                  # candidates not in logs/transition-verify.jsonl
 *   npx tsx scripts/verify-transition-sources-api.ts --all            # every candidate
 *   npx tsx scripts/verify-transition-sources-api.ts --summary
 * A request the API rejects with a 400 for this URL's content (an unreadable PDF,
 * a PDF longer than the context window) is recorded as api:pdf_unprocessable /
 * api:too_long; five 400s in a row stop the run; the tool's transient errors (too_many_requests,
 * unavailable) are not recorded, so a re-run retries them.
 *
 * Flags: --budget USD (default 10)  --limit N  --all  --out FILE
 */
import { config as loadEnv } from "dotenv";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { costOf, excerptMatch, htmlToText, isMetaExcerpt, makePool, truncate, type Usage } from "./lib/transition-sourcing";

loadEnv({ path: ".env.local", quiet: true });

const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const LIMIT = opt("limit") ? Number(opt("limit")) : null;
const BUDGET = Number(opt("budget") ?? 10);
const OUT = resolve(opt("out") ?? "logs/transition-verify-api.jsonl");
const LOCAL_OUT = resolve("logs/transition-verify.jsonl");
const LEDGER = resolve(process.env.TRANSITION_SOURCING_LEDGER ?? "logs/transition-sourcing-ledger.jsonl");
const RUN_ID = `verify_api_${new Date().toISOString().replace(/[:.]/g, "-")}`;
const MODEL = "claude-haiku-5-5" as const;
const CONCURRENCY = 4;
const MAX_CONTENT_TOKENS = 30_000;

type VerifyResult = {
  id: string;
  url: string;
  status: number | null;
  finalUrl: string | null;
  contentType: string | null;
  bytes: number;
  textLen: number;
  match: number | null;
  metaExcerpt: boolean;
  error: string | null;
  ms: number;
  via: "api";
  costUsd: number;
};

function readIds(file: string): Map<string, VerifyResult> {
  const m = new Map<string, VerifyResult>();
  if (!existsSync(file)) return m;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as VerifyResult;
      m.set(r.id, r);
    } catch {
      /* torn last line */
    }
  }
  return m;
}

function ledgerAppend(entry: Record<string, unknown>) {
  mkdirSync(dirname(LEDGER), { recursive: true });
  appendFileSync(LEDGER, JSON.stringify({ ts: new Date().toISOString(), runId: RUN_ID, ...entry }) + "\n");
}

type PdfParse = (b: Buffer) => Promise<{ text: string }>;
let pdfParse: PdfParse | null = null;
async function pdfText(buf: Buffer): Promise<string> {
  // @ts-expect-error the lib entry ships no type declarations
  pdfParse ??= ((await import("pdf-parse/lib/pdf-parse.js")) as unknown as { default: PdfParse }).default;
  return (await pdfParse(buf)).text;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set (expected in .env.local)");
  const ws = process.env.ANTHROPIC_WORKSPACE_ID;
  return new Anthropic({ maxRetries: 0, timeout: 5 * 60_000, defaultHeaders: ws ? { "anthropic-workspace-id": ws } : undefined });
}

async function create(client: Anthropic, params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (e) {
      const status = e instanceof Anthropic.APIError ? e.status : undefined;
      const transient = e instanceof Anthropic.APIConnectionError || status === 429 || status === 529 || (status !== undefined && status >= 500);
      if (!transient || attempt >= 6) throw e;
      const ra = e instanceof Anthropic.APIError ? Number(e.headers?.get?.("retry-after")) : NaN;
      const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(60_000, 1000 * 2 ** attempt) + Math.random() * 500;
      console.warn(`  ↻ ${status ?? "connection"} — retry ${attempt + 1}/6 in ${(wait / 1000).toFixed(1)}s`);
      await sleep(wait);
    }
  }
}

async function verifyOne(client: Anthropic, c: { id: string; url: string; excerpt: string | null }): Promise<VerifyResult> {
  const t0 = Date.now();
  const r: VerifyResult = {
    id: c.id, url: c.url, status: null, finalUrl: null, contentType: null, bytes: 0, textLen: 0,
    match: null, metaExcerpt: isMetaExcerpt(c.excerpt ?? ""), error: null, ms: 0, via: "api", costUsd: 0,
  };
  let msg: Anthropic.Message;
  try {
    msg = await create(client, {
    model: MODEL,
    max_tokens: 2000,
    tools: [{ type: "web_fetch_20250910", name: "web_fetch", max_uses: 1, max_content_tokens: MAX_CONTENT_TOKENS, citations: { enabled: false } }],
    messages: [{ role: "user", content: `Fetch this exact URL once with web_fetch, then reply with the single word "done". Do not summarise it.\n\n${c.url}` }],
    });
  } catch (e) {
    // A PDF the API cannot read, or one too long for the context window, fails the whole
    // request with a 400; that is a fact about this URL, not a fatal error. Five 400s in a row
    // (a broken request, not a broken page) still stop the run.
    if (e instanceof Anthropic.BadRequestError) {
      r.error = /could not process pdf/i.test(e.message) ? "api:pdf_unprocessable" : /prompt is too long/i.test(e.message) ? "api:too_long" : `api:400 ${truncate(e.message, 120)}`;
      r.ms = Date.now() - t0;
      return r;
    }
    throw e;
  }
  const usage = msg.usage as Usage;
  r.costUsd = Number(costOf(MODEL, usage).toFixed(6));
  ledgerAppend({ transitionId: c.id, model: MODEL, kind: "verify-fetch", usage, costUsd: r.costUsd });

  const block = msg.content.find((b): b is Anthropic.WebFetchToolResultBlock => b.type === "web_fetch_tool_result");
  if (!block) r.error = `api:no_fetch (${msg.stop_reason})`;
  else if (block.content.type === "web_fetch_tool_result_error") r.error = `api:${block.content.error_code}`;
  else {
    r.status = 200;
    r.finalUrl = block.content.url;
    const src = block.content.content.source;
    let text = "";
    if (src.type === "base64") {
      r.contentType = src.media_type;
      const buf = Buffer.from(src.data, "base64");
      r.bytes = buf.byteLength;
      try {
        text = await pdfText(buf);
      } catch (e) {
        r.error = `pdf: ${truncate(e instanceof Error ? e.message : String(e), 120)}`;
      }
    } else if (src.type === "text") {
      r.contentType = src.media_type;
      r.bytes = Buffer.byteLength(src.data);
      text = /^\s*</.test(src.data) ? htmlToText(src.data) : src.data;
    } else {
      r.error = `api:unexpected source ${src.type}`;
    }
    r.textLen = text.length;
    if (text) r.match = c.excerpt ? excerptMatch(c.excerpt, text) : null;
  }
  r.ms = Date.now() - t0;
  return r;
}

function summarise(results: VerifyResult[]) {
  const tally = (f: (r: VerifyResult) => string, rs = results) => {
    const m = new Map<string, number>();
    for (const r of rs) m.set(f(r), (m.get(f(r)) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ");
  };
  const ok = results.filter((r) => r.status === 200);
  console.log(`verified: ${results.length} · cost $${results.reduce((s, r) => s + (r.costUsd ?? 0), 0).toFixed(4)}`);
  console.log("fetch:", tally((r) => (r.status === 200 ? "ok" : (r.error ?? "?"))));
  console.log(
    "excerpt match on fetched pages:",
    ok.length ? tally((r) => (r.match === null ? "no text" : r.match >= 0.6 ? "≥0.6 (on page)" : r.match >= 0.2 ? "0.2–0.6 (partly)" : "<0.2 (not on page)"), ok) : "-",
    `(of ${ok.length})`,
  );
  console.log("metadata-like excerpts:", results.filter((r) => r.metaExcerpt).length);
}

async function main() {
  const done = readIds(OUT);
  if (argv.includes("--summary")) return summarise([...done.values()]);

  const pool = makePool(2);
  let rows: { id: string; url: string; excerpt: string | null }[];
  try {
    rows = (
      await pool.query(`SELECT id, url, excerpt FROM "TransitionSourceCandidate" WHERE status = 'candidate' AND url IS NOT NULL ORDER BY md5(id)`)
    ).rows;
  } finally {
    await pool.end();
  }
  const local = argv.includes("--all") ? new Map() : readIds(LOCAL_OUT);
  const todo = rows.filter((r) => !done.has(r.id) && !local.has(r.id)).slice(0, LIMIT ?? undefined);
  console.log(
    `${rows.length} candidates · ${local.size} checked locally before · ${done.size} checked via API · checking ${todo.length} · budget $${BUDGET} · ${RUN_ID}`,
  );
  mkdirSync(dirname(OUT), { recursive: true });

  const client = makeClient();
  let spent = 0;
  let maxCost = 0.02;
  let finished = 0;
  let stop: string | null = null;
  let consecutive400 = 0;
  const results: VerifyResult[] = [];
  const worker = async () => {
    while (!stop) {
      if (spent + maxCost * CONCURRENCY > BUDGET) {
        stop = `budget $${BUDGET}`;
        return;
      }
      const row = todo.shift();
      if (!row) return;
      try {
        const r = await verifyOne(client, row);
        consecutive400 = r.error?.startsWith("api:400") || r.error === "api:pdf_unprocessable" || r.error === "api:too_long" ? consecutive400 + 1 : 0;
        if (consecutive400 >= 5) stop = "five 400s in a row";
        spent += r.costUsd;
        maxCost = Math.max(maxCost, r.costUsd);
        // The tool's own transient errors are not stored, so the next run retries them.
        if (r.error === "api:too_many_requests" || r.error === "api:unavailable") continue;
        appendFileSync(OUT, JSON.stringify(r) + "\n");
        results.push(r);
      } catch (e) {
        const status = e instanceof Anthropic.APIError ? e.status : undefined;
        console.error(`  ✗ ${row.id}: ${e instanceof Error ? e.message : String(e)}`);
        if (status === 400 || status === 401 || status === 403 || status === 404) stop = `fatal API error ${status}`;
      } finally {
        finished++;
        if (finished % 50 === 0) console.log(`[${finished}] checked · $${spent.toFixed(4)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (stop) console.log(`■ stopped: ${stop}`);
  console.log(`this run: ${results.length} checked · $${spent.toFixed(4)} (ledger ${LEDGER})`);
  summarise(results);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
