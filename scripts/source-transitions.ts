/**
 * source-transitions.ts — claude_sourcing_v1
 *
 * For each target transition (a curated trajectory's ClaimStatusHistory row
 * whose marker source is Wikipedia, URL-less or missing), ask Claude with the
 * server-side web search tool for the primary source of that transition, and
 * store the answer in "TransitionSourceCandidate" for human review. Nothing
 * else in the database is written: review with
 * scripts/review-transition-sources.ts, promote with
 * scripts/promote-transition-sources.ts --confirm.
 *
 * Model ladder: claude-haiku-5-5 first; claude-sonnet-5-5 only when the first
 * pass is unusable (no source, malformed, Wikipedia, URL not among the search
 * results) or below 0.5 confidence. The stored row names the model whose
 * answer it keeps; tokens and cost cover both passes.
 *
 * Guardrails: every request's cost (tokens × documented prices + $0.01 per
 * search) is appended to logs/transition-sourcing-ledger.jsonl before its
 * result is stored. A run stops starting requests when the next one could
 * cross --budget (default $40 with --limit, else $140), when the ledger's
 * lifetime total could cross --total-cap ($180), or 15 minutes before
 * --deadline (2026-10-11 18:00 New York). Concurrency ≤ 4; 429/529/5xx back
 * off exponentially and honour retry-after. Resumable by construction: a
 * transition already in the table is never selected again.
 *
 * Usage:
 *   npx tsx scripts/source-transitions.ts --dry-run            # 3 prompts, no API calls
 *   caffeinate -i npx tsx scripts/source-transitions.ts --limit 200
 *   npx tsx scripts/source-transitions.ts --budget 140         # full curated run
 * Flags: --limit N  --claim <id|slug>  --since YYYY-MM-DD (transition date ≥)
 *        --budget USD  --total-cap USD  --concurrency ≤4  --max-searches N
 *        --no-escalate  --deadline ISO
 * Env (.env.local): DATABASE_URL, ANTHROPIC_API_KEY, ANTHROPIC_WORKSPACE_ID
 * (required with a multi-workspace "sk-ant-usr…" key).
 */
import { config as loadEnv } from "dotenv";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Pool } from "pg";
import {
  ANSWER_JSON_SCHEMA,
  MODEL_TIERS,
  PIPELINE_TAG,
  SYSTEM_PROMPT,
  TARGET_SOURCE_SQL,
  WEB_SEARCH_TOOL_TYPE,
  buildUserPrompt,
  costOf,
  cuid,
  domainFromTag,
  extractJson,
  fromFlat,
  isDisallowedHost,
  makePool,
  needsEscalation,
  parseAnswer,
  parsePublishedAt,
  pickBetter,
  reformatPrompt,
  reserveFor,
  truncate,
  urlInResults,
  type Answer,
  type Attempt,
  type ModelId,
  type TransitionInput,
  type Usage,
} from "./lib/transition-sourcing";

loadEnv({ path: ".env.local", quiet: true });

// ── Args ───────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const num = (name: string, fallback: number): number => {
  const v = opt(name);
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) die(`--${name} must be a non-negative number (got ${v})`);
  return n;
};

function die(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const DRY_RUN = flag("dry-run");
const LIMIT = opt("limit") !== undefined ? Math.floor(num("limit", 0)) : null;
const CLAIM = opt("claim") ?? null;
const SINCE = opt("since") ?? null;
const BUDGET = num("budget", LIMIT !== null ? 40 : 140);
const TOTAL_CAP = num("total-cap", 180);
const CONCURRENCY = Math.floor(num("concurrency", 4));
const MAX_SEARCHES = Math.floor(num("max-searches", 3));
const ESCALATE = !flag("no-escalate");
const DEADLINE = new Date(opt("deadline") ?? "2026-10-11T22:00:00Z"); // 18:00 EDT
const STOP_BEFORE_DEADLINE_MS = 15 * 60_000;
const LEDGER = resolve(process.env.TRANSITION_SOURCING_LEDGER ?? "logs/transition-sourcing-ledger.jsonl");
const MAX_TOKENS = 8000;
const MAX_CONTINUATIONS = 3; // pause_turn re-sends per pass

if (CONCURRENCY < 1 || CONCURRENCY > 4) die("--concurrency must be 1–4");
if (MAX_SEARCHES < 1 || MAX_SEARCHES > 10) die("--max-searches must be 1–10");
if (SINCE && Number.isNaN(Date.parse(SINCE))) die(`--since must be a date (got ${SINCE})`);
if (Number.isNaN(DEADLINE.getTime())) die("--deadline must be an ISO timestamp");
// --resume is accepted and is the only behaviour: rows already in the table are never reselected.

// ── Selection ──────────────────────────────────────────────────────────────

type TargetRow = {
  id: string;
  claimId: string;
  fromAxis: string | null;
  toAxis: string;
  community: string;
  reason: string | null;
  occurredAt: Date;
  datePrecision: string | null;
  text: string;
  externalId: string | null;
  ingestedBy: string;
  sid: string | null;
  sname: string | null;
  surl: string | null;
};

async function tableExists(pool: Pool): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass('"TransitionSourceCandidate"') AS t`);
  return r.rows[0].t !== null;
}

function targetWhere(withTable: boolean): string {
  return `
    c."externalId" LIKE 'trajectory:%'
    AND c.deleted = false AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
    AND ${TARGET_SOURCE_SQL}
    ${withTable ? `AND NOT EXISTS (SELECT 1 FROM "TransitionSourceCandidate" t WHERE t."transitionId" = h.id)` : ""}
    AND ($1::text IS NULL OR c.id = $1 OR c."externalId" = $1 OR c."externalId" = 'trajectory:' || $1)
    AND ($2::timestamptz IS NULL OR h."occurredAt" >= $2)`;
}

const FROM = `FROM "ClaimStatusHistory" h
  JOIN "Claim" c ON c.id = h."claimId"
  LEFT JOIN "Source" s ON s.id = h."sourceId"`;

async function countTargets(pool: Pool, withTable: boolean): Promise<number> {
  const r = await pool.query(`SELECT count(*)::int AS n ${FROM} WHERE ${targetWhere(withTable)}`, [CLAIM, SINCE]);
  return r.rows[0].n;
}

async function selectTargets(pool: Pool, withTable: boolean, limit: number | null): Promise<TargetRow[]> {
  // Transitions with no source at all first, then a stable pseudo-random order
  // (md5 of the id) so any --limit is a fair sample and reruns pick the same rows.
  const r = await pool.query<TargetRow>(
    `SELECT h.id, h."claimId", h."fromAxis", h."toAxis", h.community::text AS community, h.reason,
            h."occurredAt", h."datePrecision", c.text, c."externalId", c."ingestedBy",
            s.id AS sid, s.name AS sname, s.url AS surl
     ${FROM}
     WHERE ${targetWhere(withTable)}
     ORDER BY (s.id IS NULL OR coalesce(s.url, '') = '') DESC, md5(h.id)
     LIMIT $3`,
    [CLAIM, SINCE, limit],
  );
  return r.rows;
}

async function hydrate(pool: Pool, rows: TargetRow[]): Promise<TransitionInput[]> {
  const ids = [...new Set(rows.map((r) => r.claimId))];
  const [src, top] = await Promise.all([
    pool.query<{ claimId: string; name: string; url: string | null; methodologyType: string }>(
      `SELECT x."claimId", x.name, x.url, x."methodologyType" FROM (
         SELECT e."claimId", s.name, s.url, s."methodologyType",
                row_number() OVER (PARTITION BY e."claimId" ORDER BY s."methodologyType" = 'primary' DESC, e."createdAt") AS rn
         FROM "Edge" e JOIN "Source" s ON s.id = e."sourceId"
         WHERE e."claimId" = ANY($1) AND e.deleted = false AND s.deleted = false) x
       WHERE x.rn <= 8`,
      [ids],
    ),
    pool.query<{ claimId: string; name: string; domain: string }>(
      `SELECT ct."claimId", t.name, t.domain FROM "ClaimTopic" ct JOIN "Topic" t ON t.id = ct."topicId"
       WHERE ct."claimId" = ANY($1)`,
      [ids],
    ),
  ]);
  const srcBy = groupBy(src.rows, (r) => r.claimId);
  const topBy = groupBy(top.rows, (r) => r.claimId);
  return rows.map((r) => {
    const topics = topBy.get(r.claimId) ?? [];
    const domains = [...new Set(topics.map((t) => t.domain).filter(Boolean))];
    return {
      transitionId: r.id,
      claimId: r.claimId,
      externalId: r.externalId,
      claimText: r.text,
      fromAxis: r.fromAxis,
      toAxis: r.toAxis,
      community: r.community,
      reason: r.reason,
      occurredAt: r.occurredAt,
      datePrecision: r.datePrecision,
      priorSource: r.sid ? { id: r.sid, name: r.sname ?? "", url: r.surl } : null,
      claimSources: (srcBy.get(r.claimId) ?? [])
        .filter((s) => !r.surl || s.url !== r.surl)
        .map((s) => ({ name: truncate(s.name, 300), url: s.url, methodologyType: s.methodologyType })),
      // Topic domains when the claim has topics; else the curated set's seed tag.
      domain: domains.length ? domains.join(", ") : domainFromTag(r.ingestedBy),
      topics: topics.slice(0, 5).map((t) => t.name),
    };
  });
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const a = m.get(k);
    if (a) a.push(x);
    else m.set(k, [x]);
  }
  return m;
}

// ── Ledger ─────────────────────────────────────────────────────────────────

const RUN_ID = `run_${new Date().toISOString().replace(/[:.]/g, "-")}`;

function ledgerTotal(): number {
  if (!existsSync(LEDGER)) return 0;
  let t = 0;
  for (const line of readFileSync(LEDGER, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      t += Number(JSON.parse(line).costUsd) || 0;
    } catch {
      /* a torn last line from a killed run — its cost is unknown, already spent */
    }
  }
  return t;
}

function ledgerAppend(entry: Record<string, unknown>) {
  mkdirSync(dirname(LEDGER), { recursive: true });
  appendFileSync(LEDGER, JSON.stringify({ ts: new Date().toISOString(), runId: RUN_ID, ...entry }) + "\n");
}

// ── API ────────────────────────────────────────────────────────────────────

class FatalApiError extends Error {}

function makeClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) die("ANTHROPIC_API_KEY is not set (expected in .env.local)");
  const ws = process.env.ANTHROPIC_WORKSPACE_ID;
  return new Anthropic({
    maxRetries: 0, // retries are ours (withRetry), so the budget sees every attempt
    timeout: 10 * 60_000,
    defaultHeaders: ws ? { "anthropic-workspace-id": ws } : undefined,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(what: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const status = e instanceof Anthropic.APIError ? e.status : undefined;
      const transient =
        e instanceof Anthropic.APIConnectionError || status === 429 || status === 529 || (status !== undefined && status >= 500);
      if (!transient) {
        const msg = e instanceof Error ? e.message : String(e);
        if (status === 400 || status === 401 || status === 403 || status === 404) throw new FatalApiError(`${status}: ${msg}`);
        throw e;
      }
      if (attempt >= 6) throw e;
      const ra = e instanceof Anthropic.APIError ? Number(e.headers?.get?.("retry-after")) : NaN;
      const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(60_000, 1000 * 2 ** attempt) + Math.random() * 500;
      console.warn(`  ↻ ${what}: ${status ?? "connection"} — retry ${attempt + 1}/6 in ${(wait / 1000).toFixed(1)}s`);
      await sleep(wait);
    }
  }
}

type PassResult = Attempt & {
  usage: { input: number; output: number; searches: number };
  costUsd: number;
  queries: string[];
  resultUrls: string[];
  searchErrors: string[];
  stopReasons: string[];
  rawText: string;
  parseError: string | null;
  reformatted: boolean;
};

async function runPass(client: Anthropic, model: ModelId, t: TransitionInput, account: (usd: number) => void): Promise<PassResult> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildUserPrompt(t) }];
  const res: PassResult = {
    model,
    answer: null,
    urlInSearchResults: false,
    usage: { input: 0, output: 0, searches: 0 },
    costUsd: 0,
    queries: [],
    resultUrls: [],
    searchErrors: [],
    stopReasons: [],
    rawText: "",
    parseError: null,
    reformatted: false,
  };
  const seen = new Set<string>();
  const addResult = (url: string) => {
    if (seen.has(url)) return;
    seen.add(url);
    res.resultUrls.push(url);
  };
  const book = (u: Usage, kind: string) => {
    const usd = costOf(model, u);
    res.costUsd += usd;
    res.usage.input += u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    res.usage.output += u.output_tokens;
    res.usage.searches += u.server_tool_use?.web_search_requests ?? 0;
    ledgerAppend({ transitionId: t.transitionId, model, kind, usage: u, costUsd: Number(usd.toFixed(6)) });
    account(usd);
  };

  let last: Anthropic.Message | null = null;
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const msg = await withRetry(`${model} ${t.transitionId}`, () =>
      client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
        tools: [{ type: WEB_SEARCH_TOOL_TYPE, name: "web_search", max_uses: MAX_SEARCHES }],
      }),
    );
    book(msg.usage as Usage, i === 0 ? "search" : "continue");
    res.stopReasons.push(msg.stop_reason ?? "null");
    for (const b of msg.content) {
      if (b.type === "server_tool_use" && b.name === "web_search") {
        const q = (b.input as { query?: string } | null)?.query;
        if (q) res.queries.push(q);
      } else if (b.type === "web_search_tool_result") {
        if (Array.isArray(b.content)) {
          for (const r of b.content) addResult(r.url);
        } else {
          res.searchErrors.push(b.content.error_code);
        }
      } else if (b.type === "text") {
        for (const c of b.citations ?? []) {
          if (c.type === "web_search_result_location") addResult(c.url);
        }
      }
    }
    last = msg;
    if (msg.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: msg.content });
  }

  res.rawText = (last?.content ?? [])
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (last?.stop_reason === "refusal") {
    res.parseError = "refusal";
    return res;
  }

  let parsed = parseAnswer(extractJson(res.rawText));
  if (!parsed.ok && res.rawText.trim()) {
    // One retry: a tool-free structured-output call that only reshapes the reply
    // (structured outputs can't share a request with web search's citations).
    res.reformatted = true;
    const fix = await withRetry(`${model} reformat ${t.transitionId}`, () =>
      client.messages.create({
        model,
        max_tokens: 2000,
        messages: [{ role: "user", content: reformatPrompt(res.rawText, res.resultUrls) }],
        output_config: { format: { type: "json_schema", schema: ANSWER_JSON_SCHEMA as unknown as Record<string, unknown> } },
      }),
    );
    book(fix.usage as Usage, "reformat");
    const text = fix.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const obj = extractJson(text);
    parsed = parseAnswer(obj && typeof obj === "object" ? fromFlat(obj as Record<string, unknown>) : null);
  }
  if (!parsed.ok) {
    res.parseError = parsed.error;
    return res;
  }
  res.answer = parsed.answer;
  if (parsed.answer.kind === "source") res.urlInSearchResults = urlInResults(parsed.answer.url, res.resultUrls);
  return res;
}

// ── Per transition ─────────────────────────────────────────────────────────

type Outcome = "candidate" | "no_source_found" | "deferred";

const TRANSIENT_SEARCH_ERRORS = new Set(["too_many_requests", "unavailable"]);

function noSourceReason(p: PassResult): string {
  const a = p.answer;
  if (a?.kind === "no_source") return a.rationale;
  if (a?.kind === "source" && isDisallowedHost(a.url)) return truncate(`Only a tertiary source was found (${a.url}). ${a.rationale}`, 300);
  if (a?.kind === "source" && !p.urlInSearchResults)
    return truncate(`The model's URL (${a.url}) was not among the search results, so it was not kept. ${a.rationale}`, 300);
  return truncate(`Malformed answer after one reformat retry (${p.parseError ?? "unknown"}).`, 300);
}

function passSummary(p: PassResult) {
  return {
    model: p.model,
    kind: p.answer?.kind ?? null,
    url: p.answer?.kind === "source" ? p.answer.url : null,
    confidence: p.answer?.kind === "source" ? p.answer.confidence : null,
    urlInSearchResults: p.urlInSearchResults,
    searches: p.usage.searches,
    costUsd: Number(p.costUsd.toFixed(6)),
    stopReasons: p.stopReasons,
    parseError: p.parseError,
    reformatted: p.reformatted,
    rationale: p.answer?.rationale ?? null,
  };
}

async function sourceOne(
  client: Anthropic,
  pool: Pool,
  t: TransitionInput,
  account: (usd: number) => void,
  mayEscalate: () => boolean,
): Promise<{ outcome: Outcome; costUsd: number; model: ModelId; confidence: number | null; escalated: boolean }> {
  const passes: PassResult[] = [await runPass(client, MODEL_TIERS[0], t, account)];
  if (ESCALATE && needsEscalation(passes[0]) && mayEscalate()) passes.push(await runPass(client, MODEL_TIERS[1], t, account));
  const chosen = (passes.length === 2 ? pickBetter(passes[0], passes[1]) : passes[0]) as PassResult;
  const cost = passes.reduce((a, p) => a + p.costUsd, 0);
  const isCandidate = chosen.answer?.kind === "source" && !isDisallowedHost(chosen.answer.url) && chosen.urlInSearchResults;

  // A "nothing found" that is really the search tool failing would be skipped
  // forever by resume — leave it out of the table so the next run retries it.
  const searchFailed = passes.every((p) => p.searchErrors.some((e) => TRANSIENT_SEARCH_ERRORS.has(e)) && p.resultUrls.length === 0);
  if (!isCandidate && searchFailed) {
    ledgerAppend({ transitionId: t.transitionId, kind: "deferred", costUsd: 0, searchErrors: passes.flatMap((p) => p.searchErrors) });
    return { outcome: "deferred", costUsd: cost, model: chosen.model, confidence: null, escalated: passes.length === 2 };
  }

  const a = chosen.answer as Answer | null;
  const src = isCandidate && a?.kind === "source" ? a : null;
  await pool.query(
    `INSERT INTO "TransitionSourceCandidate"
       (id, "transitionId", "claimId", url, title, publisher, "publishedAt", excerpt, confidence, rationale,
        model, "inputTokens", "outputTokens", "searchCount", "costUsd", "urlInSearchResults", "priorSourceId",
        trace, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::"TransitionSourceStatus")
     ON CONFLICT ("transitionId") DO NOTHING`,
    [
      cuid(),
      t.transitionId,
      t.claimId,
      src?.url ?? null,
      src ? truncate(src.title, 500) : null,
      src?.publisher ? truncate(src.publisher, 300) : null,
      src ? parsePublishedAt(src.publishedAt) : null,
      src?.excerpt ?? null,
      src?.confidence ?? null,
      src ? src.rationale : noSourceReason(chosen),
      chosen.model,
      passes.reduce((x, p) => x + p.usage.input, 0),
      passes.reduce((x, p) => x + p.usage.output, 0),
      passes.reduce((x, p) => x + p.usage.searches, 0),
      cost.toFixed(6),
      chosen.urlInSearchResults,
      t.priorSource?.id ?? null,
      JSON.stringify({
        pipeline: PIPELINE_TAG,
        runId: RUN_ID,
        publishedAtRaw: src?.publishedAt ?? null,
        queries: passes.flatMap((p) => p.queries),
        resultUrls: [...new Set(passes.flatMap((p) => p.resultUrls))].slice(0, 60),
        searchErrors: passes.flatMap((p) => p.searchErrors),
        passes: passes.map(passSummary),
      }),
      src ? "candidate" : "no_source_found",
    ],
  );
  return {
    outcome: src ? "candidate" : "no_source_found",
    costUsd: cost,
    model: chosen.model,
    confidence: src?.confidence ?? null,
    escalated: passes.length === 2,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const pool = makePool(CONCURRENCY + 1);
  try {
    const withTable = await tableExists(pool);
    if (!withTable && !DRY_RUN) die('"TransitionSourceCandidate" does not exist — apply prisma/migrations/20261008120000_transition_source_candidates first');
    const eligible = await countTargets(pool, withTable);

    if (DRY_RUN) {
      const rows = await hydrate(pool, await selectTargets(pool, withTable, 3));
      console.log(`DRY RUN — no API calls. ${eligible.toLocaleString()} eligible transitions (curated, Wikipedia/no source, not yet in the table).`);
      console.log(`Model ${MODEL_TIERS[0]}${ESCALATE ? ` → ${MODEL_TIERS[1]} (when unusable or confidence < 0.5)` : ""}; tool ${WEB_SEARCH_TOOL_TYPE}, max_uses ${MAX_SEARCHES}; max_tokens ${MAX_TOKENS}.`);
      console.log(`Budget $${BUDGET} this run · lifetime cap $${TOTAL_CAP} (ledger so far $${ledgerTotal().toFixed(4)}) · deadline ${DEADLINE.toISOString()}`);
      console.log(`Workspace header: ${process.env.ANTHROPIC_WORKSPACE_ID ? "set" : "NOT SET (required for a multi-workspace key)"}`);
      console.log(`\n${"═".repeat(78)}\nSYSTEM PROMPT (identical for every request)\n${"═".repeat(78)}\n${SYSTEM_PROMPT}`);
      rows.forEach((t, i) => {
        console.log(`\n${"═".repeat(78)}\nUSER PROMPT ${i + 1}/3 — transition ${t.transitionId} · claim ${t.externalId ?? t.claimId}\n${"═".repeat(78)}`);
        console.log(buildUserPrompt(t));
      });
      return;
    }

    const lifetimeAtStart = ledgerTotal();
    const targets = await selectTargets(pool, withTable, LIMIT);
    console.log(`${RUN_ID} · ${targets.length} of ${eligible.toLocaleString()} eligible transitions · budget $${BUDGET} · lifetime $${lifetimeAtStart.toFixed(4)} of $${TOTAL_CAP} · concurrency ${CONCURRENCY}`);
    if (!targets.length) return;
    const client = makeClient();

    let spent = 0;
    let reserved = 0;
    let stopReason: string | null = null;
    let consecutiveErrors = 0;
    let done = 0;
    const counts = { candidate: 0, no_source_found: 0, deferred: 0, error: 0, escalated: 0 };
    const byModel = new Map<string, number>();
    const confidences: number[] = [];
    const tier0Reserve = reserveFor(MODEL_TIERS[0], MAX_SEARCHES);
    const tier1Reserve = reserveFor(MODEL_TIERS[1], MAX_SEARCHES);
    const perTransitionReserve = tier0Reserve + (ESCALATE ? tier1Reserve : 0);

    let interrupted = false;
    process.on("SIGINT", () => {
      if (interrupted) process.exit(130);
      interrupted = true;
      stopReason = "interrupted (Ctrl-C again to abort in-flight requests)";
      console.warn(`\n■ ${stopReason}`);
    });

    const canStart = (need: number): boolean => {
      if (stopReason) return false;
      if (Date.now() > DEADLINE.getTime() - STOP_BEFORE_DEADLINE_MS) stopReason = `deadline ${DEADLINE.toISOString()} (−15 min)`;
      else if (spent + reserved + need > BUDGET) stopReason = `run budget $${BUDGET}`;
      else if (lifetimeAtStart + spent + reserved + need > TOTAL_CAP) stopReason = `lifetime cap $${TOTAL_CAP}`;
      return !stopReason;
    };
    const account = (usd: number) => {
      spent += usd;
    };
    const report = () => {
      const lifetime = lifetimeAtStart + spent;
      console.log(
        `[${done}/${targets.length}] run $${spent.toFixed(4)} · lifetime $${lifetime.toFixed(4)} · ` +
          `candidates ${counts.candidate} · no_source ${counts.no_source_found} · escalated ${counts.escalated} · ` +
          `deferred ${counts.deferred} · errors ${counts.error} · $${(spent / Math.max(1, done)).toFixed(4)}/transition`,
      );
    };

    let next = 0;
    const worker = async () => {
      while (next < targets.length) {
        if (!canStart(perTransitionReserve)) return;
        const row = targets[next++];
        reserved += perTransitionReserve;
        try {
          const [t] = await hydrate(pool, [row]);
          // The escalation was reserved with the transition; this only catches a
          // first pass that overran its reserve (it double-counts, so errs safe).
          const mayEscalate = () => spent + reserved <= BUDGET && lifetimeAtStart + spent + reserved <= TOTAL_CAP;
          const r = await sourceOne(client, pool, t, account, mayEscalate);
          counts[r.outcome]++;
          if (r.escalated) counts.escalated++;
          if (r.outcome !== "deferred") byModel.set(r.model, (byModel.get(r.model) ?? 0) + 1);
          if (r.confidence !== null) confidences.push(r.confidence);
          consecutiveErrors = 0;
        } catch (e) {
          counts.error++;
          consecutiveErrors++;
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`  ✗ ${row.id}: ${truncate(msg, 300)}`);
          ledgerAppend({ transitionId: row.id, kind: "error", costUsd: 0, error: truncate(msg, 500) });
          if (e instanceof FatalApiError) stopReason = `fatal API error: ${truncate(msg, 200)}`;
          else if (consecutiveErrors >= 10) stopReason = "10 consecutive errors";
        } finally {
          reserved -= perTransitionReserve;
          done++;
          if (done % 50 === 0) report();
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    report();
    if (stopReason) console.log(`■ stopped: ${stopReason}`);
    const hist = Array.from({ length: 10 }, (_, i) => confidences.filter((c) => Math.min(9, Math.floor(c * 10)) === i).length);
    console.log("\nconfidence (candidates):");
    hist.forEach((n, i) => console.log(`  ${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}  ${String(n).padStart(4)}  ${"█".repeat(n)}`));
    console.log(`answered by: ${[...byModel].map(([m, n]) => `${m} ${n}`).join(" · ") || "—"}`);
    console.log(`spent this run $${spent.toFixed(4)} · lifetime $${(lifetimeAtStart + spent).toFixed(4)} (ledger ${LEDGER})`);
    const db = await pool.query(
      `SELECT status::text, count(*)::int AS n, sum("costUsd")::float AS usd FROM "TransitionSourceCandidate" GROUP BY 1 ORDER BY 1`,
    );
    console.log("table now:", db.rows.map((r) => `${r.status} ${r.n} ($${r.usd.toFixed(4)})`).join(" · "));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
