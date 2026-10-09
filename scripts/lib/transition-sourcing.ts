/**
 * Shared, pure pieces of the transition-sourcing pipeline (claude_sourcing_v1):
 * prices, prompt, answer parsing/validation, URL checks, ids, and the pg pool.
 * Used by scripts/source-transitions.ts, review-transition-sources.ts and
 * promote-transition-sources.ts; unit-tested in tests/unit/transition-sourcing.test.ts.
 *
 * Every price, model id and tool version below was read from the Claude docs
 * on 2026-10-08 — re-check them there before changing anything:
 *   https://platform.claude.com/docs/en/about-claude/pricing
 *   https://platform.claude.com/docs/en/about-claude/models/overview
 *   https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
 */
import { randomBytes } from "node:crypto";
import { hostname } from "node:os";
import { Pool } from "pg";
import { z } from "zod";

export const PIPELINE_TAG = "claude_sourcing_v1";

// ── Models and prices ───────────────────────────────────────────────────────

/** Escalation ladder, cheapest first. Both accept the web search tool. */
export const MODEL_TIERS = ["claude-haiku-5-5", "claude-sonnet-5-5"] as const;
export type ModelId = (typeof MODEL_TIERS)[number];

type Price = {
  input: number; // USD per MTok
  output: number;
  cacheWrite: number; // 5-minute write (1.25x input)
  cacheRead: number;
  /** Haiku 5.5 prices a prompt over 100k tokens at a higher rate. */
  long?: { threshold: number; input: number; output: number; cacheWrite: number; cacheRead: number };
};

export const PRICES: Record<ModelId, Price> = {
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cacheWrite: 0.125,
    cacheRead: 0.01,
    long: { threshold: 100_000, input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05 },
  },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
};

/** $10 per 1,000 searches, on top of tokens (same on the Batch API). */
export const WEB_SEARCH_USD = 0.01;

/** The basic (direct) web search tool — no code-execution container needed. */
export const WEB_SEARCH_TOOL_TYPE = "web_search_20250305";

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

/** USD for one Messages API response. Errs high: the long-context tier applies
 *  when the request's whole prompt (all server-loop iterations) passes 100k. */
export function costOf(model: ModelId, u: Usage): number {
  const base = PRICES[model];
  const cw = u.cache_creation_input_tokens ?? 0;
  const cr = u.cache_read_input_tokens ?? 0;
  const prompt = u.input_tokens + cw + cr;
  const p = base.long && prompt > base.long.threshold ? base.long : base;
  const tokens = (u.input_tokens * p.input + cw * p.cacheWrite + cr * p.cacheRead + u.output_tokens * p.output) / 1e6;
  return tokens + (u.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD;
}

/** Worst case one request may cost, reserved against the budget before it starts. */
export function reserveFor(model: ModelId, maxSearches: number): number {
  // ~80k prompt tokens (system + up to `maxSearches` result pages) and 8k output.
  return costOf(model, { input_tokens: 80_000, output_tokens: 8_000, server_tool_use: { web_search_requests: maxSearches } });
}

// ── Transitions ────────────────────────────────────────────────────────────

export type TransitionInput = {
  transitionId: string;
  claimId: string;
  externalId: string | null;
  claimText: string;
  fromAxis: string | null;
  toAxis: string;
  community: string;
  reason: string | null;
  occurredAt: Date;
  datePrecision: string | null;
  priorSource: { id: string; name: string; url: string | null } | null;
  claimSources: { name: string; url: string | null; methodologyType: string }[];
  domain: string;
  topics: string[];
};

/** "1919-05-04", "1919-05", "1919" or "c. 500 BCE", following the row's precision. */
export function formatTransitionDate(d: Date, precision: string | null): string {
  const y = d.getUTCFullYear();
  const year = y <= 0 ? `${1 - y} BCE` : String(y).padStart(4, "0");
  if (y <= 0) return year;
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  switch (precision) {
    case "DAY":
      return `${year}-${mm}-${dd}`;
    case "MONTH":
      return `${year}-${mm}`;
    case "QUARTER":
      return `${year} Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    default:
      return year;
  }
}

/** A readable domain from a curated set's seed tag ("seed:medicine-trajectories"
 *  → "medicine", "law-settler" → "law"); none of the curated targets has topics. */
export function domainFromTag(tag: string): string {
  if (/medic|pharma|drug|clinical/i.test(tag)) return "medicine";
  if (/law|court|judicial/i.test(tag)) return "law";
  if (/astronom|space/i.test(tag)) return "astronomy";
  if (/nutrition|diet/i.test(tag)) return "nutrition";
  if (/histor/i.test(tag)) return "history";
  return "general";
}

// The axis meanings are /glossary's (app/glossary/page.tsx), shortened.
export const SYSTEM_PROMPT = `You find the primary source of record for one dated event in a claim's history.

Each claim on this site has a trajectory: a sequence of transitions, each a change in the claim's status within one community (expert literature, institutions, courts, the public, markets) on a date. Statuses: RECORDED (a matter of official record: a law enacted, a judgment issued, a vote cast), SETTLED (stable consensus in that community), CONTESTED (credible dissent or contradicting evidence), OPEN (not yet resolved), UNRESOLVABLE (cannot be resolved with the evidence that exists), REVERSED (formally overturned: a retraction, a conviction quashed, a law struck down), ABANDONED (dropped without refutation).

You get one transition. Search the web and return the single best document that records or constitutes that transition. Rank candidates, best first:
1. The document that is the event: the paper, ruling or opinion, statute, regulation, agency decision or record, standards-body publication, treaty text, official report, or the acting body's own announcement.
2. The publisher of record or an authoritative archive of it: journal article page, DOI landing page, PubMed record, court or government site, national archive, digitised primary text.
3. Only when neither exists online: a reputable scholarly or contemporaneous news account.
Never return Wikipedia or any wiki, a blog, a content farm, a news aggregator, or a search-results page. An existing Wikipedia link is a lead, not an answer: find what it cites.

The source must support this transition (the status change and roughly its date), not just the topic. The excerpt is a passage copied from the source as you saw it in the search results, at most 500 characters. Return only a URL that appeared in your search results; never construct or guess one. confidence is your probability (0 to 1) that the URL is the primary or authoritative record of this transition and that the excerpt supports it; use less than 0.5 for a secondary account or a loose fit.

Your final message is one JSON object and nothing else, either
{"url": "...", "title": "...", "publisher": "...", "publishedAt": "YYYY-MM-DD" | "YYYY-MM" | "YYYY" | null, "excerpt": "...", "confidence": 0.0, "rationale": "at most 300 characters: why this is the primary record"}
or
{"no_source_found": true, "rationale": "at most 300 characters: what you searched and why nothing qualified"}`;

export function buildUserPrompt(t: TransitionInput): string {
  const lines = [
    `Claim: ${t.claimText}`,
    `Domain: ${t.domain}${t.topics.length ? ` (topics: ${t.topics.join("; ")})` : ""}`,
    "",
    `Transition: ${t.fromAxis ?? "(first recorded status)"} → ${t.toAxis}`,
    `Community: ${t.community}`,
    `Date: ${formatTransitionDate(t.occurredAt, t.datePrecision)} (precision: ${t.datePrecision ?? "unknown"})`,
  ];
  if (t.reason) lines.push(`Recorded reason: ${t.reason}`);
  lines.push("");
  lines.push(
    t.priorSource
      ? `Source currently attached to this transition: ${t.priorSource.name}${t.priorSource.url ? ` <${t.priorSource.url}>` : ""}`
      : "Source currently attached to this transition: none",
  );
  if (t.claimSources.length) {
    lines.push("Other sources already attached to the claim:");
    for (const s of t.claimSources) lines.push(`- [${s.methodologyType}] ${s.name}${s.url ? ` <${s.url}>` : ""}`);
  }
  lines.push("", "Find the primary source for this transition and reply with the JSON object only.");
  return lines.join("\n");
}

// ── Answers ────────────────────────────────────────────────────────────────

export const EXCERPT_MAX = 500;
export const RATIONALE_MAX = 300;

const cap = (n: number) => z.string().transform((s) => truncate(s.trim(), n));

const SourceAnswerSchema = z.object({
  url: z.string().trim().url().refine((u) => /^https?:\/\//i.test(u), "url must be http(s)"),
  title: z.string().trim().min(1),
  publisher: z.string().trim().nullish().transform((s) => s || null),
  publishedAt: z.string().trim().nullish().transform((s) => s || null),
  excerpt: cap(EXCERPT_MAX),
  confidence: z.coerce.number().finite().transform((n) => Math.min(1, Math.max(0, n))),
  rationale: cap(RATIONALE_MAX),
});

const NoSourceAnswerSchema = z.object({
  no_source_found: z.literal(true),
  rationale: cap(RATIONALE_MAX),
});

export type SourceAnswer = z.infer<typeof SourceAnswerSchema> & { kind: "source" };
export type NoSourceAnswer = z.infer<typeof NoSourceAnswerSchema> & { kind: "no_source" };
export type Answer = SourceAnswer | NoSourceAnswer;

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

/** The JSON object in a model reply: bare, fenced, or after a line of prose. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function parseAnswer(raw: unknown): { ok: true; answer: Answer } | { ok: false; error: string } {
  if (raw && typeof raw === "object" && (raw as { no_source_found?: unknown }).no_source_found === true) {
    const r = NoSourceAnswerSchema.safeParse(raw);
    return r.success ? { ok: true, answer: { ...r.data, kind: "no_source" } } : { ok: false, error: r.error.issues[0]?.message ?? "invalid" };
  }
  const r = SourceAnswerSchema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, error: i ? `${i.path.join(".") || "answer"}: ${i.message}` : "invalid" };
  }
  return { ok: true, answer: { ...r.data, kind: "source" } };
}

/** JSON schema for the reformat retry (output_config.format, no tools). One
 *  flat object: every field required, nullable where a no-source answer leaves
 *  it empty (structured outputs need additionalProperties: false). */
export const ANSWER_JSON_SCHEMA = {
  type: "object",
  properties: {
    no_source_found: { type: "boolean" },
    url: { type: ["string", "null"] },
    title: { type: ["string", "null"] },
    publisher: { type: ["string", "null"] },
    publishedAt: { type: ["string", "null"] },
    excerpt: { type: ["string", "null"] },
    confidence: { type: ["number", "null"] },
    rationale: { type: "string" },
  },
  required: ["no_source_found", "url", "title", "publisher", "publishedAt", "excerpt", "confidence", "rationale"],
  additionalProperties: false,
} as const;

/** The flat reformat shape → the two-branch answer shape parseAnswer expects. */
export function fromFlat(o: Record<string, unknown>): unknown {
  if (o.no_source_found === true || !o.url) return { no_source_found: true, rationale: o.rationale ?? "" };
  const { no_source_found: _drop, ...rest } = o;
  void _drop;
  return rest;
}

export function reformatPrompt(previousReply: string, resultUrls: string[]): string {
  return [
    "Below is a reply that should have been a single JSON object but was not valid. Convert it to the required JSON.",
    "Use only information present in the reply. The url must be one of the search-result URLs listed (or the reply's own URL if it is listed); if the reply names no qualifying source, set no_source_found to true and the other fields except rationale to null.",
    "",
    "Search-result URLs:",
    ...resultUrls.slice(0, 60).map((u) => `- ${u}`),
    "",
    "Reply:",
    truncate(previousReply, 6000),
  ].join("\n");
}

// ── URLs ───────────────────────────────────────────────────────────────────

/** Tertiary or user-edited hosts the brief rules out as an answer. Wikisource
 *  is allowed on purpose (owner decision 2026-10-08): it hosts transcribed
 *  primary texts, not summaries. */
const DISALLOWED_HOSTS = /(^|\.)(wikipedia\.org|wikimedia\.org|wikiwand\.com|wikidata\.org|dbpedia\.org|fandom\.com|wikia\.com|everybodywiki\.com)$/i;

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isDisallowedHost(url: string): boolean {
  const h = hostOf(url);
  return h == null || DISALLOWED_HOSTS.test(h);
}

/** Comparable form: lower-case host without www., no fragment, no trailing slash, http=https. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}${u.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export function urlInResults(url: string, resultUrls: Iterable<string>): boolean {
  const n = normalizeUrl(url);
  const noQuery = n.replace(/\?.*$/, "");
  for (const r of resultUrls) {
    const m = normalizeUrl(r);
    if (m === n || m.replace(/\?.*$/, "") === noQuery) return true;
  }
  return false;
}

/** "1919-05-04" | "1919-05" | "1919" → a UTC date; anything else → null. */
export function parsePublishedAt(s: string | null): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), m[2] ? Number(m[2]) : 1, m[3] ? Number(m[3]) : 1];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(2000, mo - 1, d));
  date.setUTCFullYear(y);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ── Escalation ─────────────────────────────────────────────────────────────

export type Attempt = {
  model: ModelId;
  answer: Answer | null; // null = malformed after the reformat retry, or a refusal
  urlInSearchResults: boolean;
};

/** A source answer worth keeping: allowed host, URL actually returned by search. */
export function isUsable(a: Attempt): boolean {
  return a.answer?.kind === "source" && !isDisallowedHost(a.answer.url) && a.urlInSearchResults;
}

/** Escalate when the first pass has nothing usable, or (with `below` > 0)
 *  when its confidence is under `below`. The pilot (2026-10-08) escalated
 *  below 0.5: 71% of transitions, 10.5¢ each; the owner chose unusable-only
 *  (below = 0) for the full run. */
export function needsEscalation(a: Attempt, below = 0): boolean {
  return !isUsable(a) || (a.answer as SourceAnswer).confidence < below;
}

/** Usable beats unusable; then the higher confidence; ties keep the cheaper pass. */
export function pickBetter(first: Attempt, second: Attempt): Attempt {
  const u1 = isUsable(first);
  const u2 = isUsable(second);
  if (u1 !== u2) return u1 ? first : second;
  if (!u1) return second.answer ? second : first;
  return (second.answer as SourceAnswer).confidence > (first.answer as SourceAnswer).confidence ? second : first;
}

// ── Misc ───────────────────────────────────────────────────────────────────

/** Source.name for a promoted candidate: "Title — Publisher (Year)". */
export function sourceName(r: { title: string | null; publisher: string | null; publishedAt: Date | null; url: string }): string {
  const year = r.publishedAt ? ` (${r.publishedAt.getUTCFullYear()})` : "";
  const base = [r.title, r.publisher].filter(Boolean).join(" — ") || r.url;
  return truncate(base, 480) + year;
}

let counter = randomBytes(2).readUInt16BE() % 36 ** 4;
const fingerprint = (
  (process.pid % 1296).toString(36).padStart(2, "0") +
  ([...hostname()].reduce((a, c) => a + c.charCodeAt(0), 0) % 1296).toString(36).padStart(2, "0")
).slice(0, 4);

/** A 25-char cuid-shaped id, like the ones Prisma's @default(cuid()) writes. */
export function cuid(): string {
  counter = (counter + 1) % 36 ** 4;
  const ts = Date.now().toString(36).padStart(8, "0").slice(-8);
  const rnd = (randomBytes(6).readUIntBE(0, 6) % 36 ** 8).toString(36).padStart(8, "0");
  return `c${ts}${counter.toString(36).padStart(4, "0")}${fingerprint}${rnd}`;
}

/** Same connection handling as lib/prisma.ts: drop sslmode so the explicit
 *  ssl option wins over the self-signed cert. */
export function makePool(max = 4): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (expected in .env.local)");
  return new Pool({
    connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""),
    ssl: { rejectUnauthorized: false },
    max,
  });
}

/** Curated transitions this pipeline targets: the transition's marker source is
 *  missing, has no URL, or is Wikipedia (owner decision 2026-10-08). */
export const TARGET_SOURCE_SQL = `(h."sourceId" IS NULL OR s.id IS NULL OR coalesce(s.url, '') = '' OR s.url ~* '^https?://([a-z0-9-]+\\.)*wikipedia\\.org/')`;
