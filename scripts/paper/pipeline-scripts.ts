/**
 * pipeline-scripts.ts — for every ingestedBy tag in the corpus, the script(s)
 * under scripts/ that name it, and whether any of them calls an LLM and records
 * a prompt or model id. Feeds docs/paper/sources.md. Read-only (one SELECT via
 * app_ro; scans files).
 *
 *   npx tsx scripts/paper/pipeline-scripts.ts > docs/paper/sql/out/pipeline-scripts.tsv
 *   npx tsx scripts/paper/pipeline-scripts.ts --md docs/paper/sources.md > docs/paper/sql/out/pipeline-scripts.tsv
 *
 * With --md it also writes the sources table (adds the top Source.url hosts per
 * pipeline: the same query as docs/paper/sql/07_pipelines.sql §7b).
 *
 * Matching, in order: (1) files containing the tag as a quoted string literal;
 * (2) failing that, scripts/ingest-<tag minus _v1, _→->.ts. Of the matches, a
 * "writer" is a file whose name starts with ingest-/seed-/import- or that both
 * names the tag and contains an INSERT or a prisma create/upsert. Tags built at
 * run time (template strings) are covered by DYNAMIC below, each checked by hand
 * (2026-10-24); anything still unmatched prints "not found". Upstream name/URL
 * come from lib/pipelines/registry.ts (PIPELINES).
 */
import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";
import { PIPELINES } from "../../lib/pipelines/registry";

const argv = process.argv.slice(2);

loadEnv({ path: ".env.local", quiet: true });

const ROOT = "scripts";
const SKIP_DIRS = new Set(["paper", "output", "node_modules"]);
// Code-level LLM calls only (SDK import, API host, or the `claude` CLI), so a
// claim text that merely mentions GPT-4 or OpenAI does not count.
const LLM_RE = /from ['"]@anthropic-ai\/sdk['"]|new Anthropic\(|api\.anthropic\.com|from ['"]openai['"]|new OpenAI\(|api\.openai\.com|exec(File)?(Sync)?\(\s*[`'"]claude\b/;
// Model ids as quoted string literals.
const MODEL_RE = /['"`]((?:claude-(?:haiku|sonnet|opus|fable|instant|[0-9])[a-z0-9.-]*)|gpt-[0-9][a-z0-9.-]*|text-embedding-[a-z0-9-]+)['"`]/g;

// Tags assembled at run time, so no literal names them. Checked by hand 2026-10-24.
const DYNAMIC: [RegExp, string][] = [
  // `${country}_legislation_v1` over its AfricanLII country list
  [/^(zambia|uganda|zimbabwe|mauritius|rwanda|tanzania|ghana|namibia|malawi|eswatini|lesotho|sierra_leone)_legislation_v1$/, "scripts/ingest-africa-lii.ts"],
  // `book-analysis:${BOOK_ID}`
  [/^book-analysis:/, "scripts/analyze-book-connections.ts"],
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(p, out);
    } else if (/\.(ts|mts|js|mjs|cjs|py|sh)$/.test(e.name)) out.push(p);
  }
  return out;
}

type Row = { tag: string; claims: number; edges: number; hosts: number; top_hosts: string | null };

const HOSTS_SQL = `
  WITH ce AS (
    SELECT c."ingestedBy" AS pipeline, lower(regexp_replace(substring(s.url FROM '^https?://([^/?#:]+)'), '^www\\.', '')) AS host
    FROM "Claim" c
    JOIN "Edge" e ON e."claimId" = c.id AND NOT e.deleted
    JOIN "Source" s ON s.id = e."sourceId" AND NOT s.deleted
    WHERE NOT c.deleted
  ), agg AS (SELECT pipeline, count(*)::int AS edges, count(DISTINCT host)::int AS hosts FROM ce GROUP BY 1),
  h AS (SELECT pipeline, host, count(*) AS n, row_number() OVER (PARTITION BY pipeline ORDER BY count(*) DESC, host) AS r
        FROM ce WHERE host IS NOT NULL GROUP BY 1, 2),
  top AS (SELECT pipeline, string_agg(host || ' (' || n || ')', ', ' ORDER BY r) AS top_hosts FROM h WHERE r <= 2 GROUP BY 1),
  cl AS (SELECT "ingestedBy" AS pipeline, count(*)::int AS claims FROM "Claim" WHERE NOT deleted GROUP BY 1)
  SELECT cl.pipeline AS tag, cl.claims, coalesce(a.edges, 0) AS edges, coalesce(a.hosts, 0) AS hosts, t.top_hosts
  FROM cl LEFT JOIN agg a USING (pipeline) LEFT JOIN top t USING (pipeline)
  ORDER BY cl.claims DESC`;

async function tags(withHosts: boolean): Promise<Row[]> {
  const url = process.env.DATABASE_URL_RO;
  if (!url) throw new Error("DATABASE_URL_RO missing from .env.local");
  const pool = new Pool({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ""), ssl: { rejectUnauthorized: false }, max: 1 });
  try {
    const c = await pool.connect();
    try {
      await c.query("SET default_transaction_read_only = on");
      await c.query("SET statement_timeout = 1800000");
      const r = await c.query(
        withHosts
          ? HOSTS_SQL
          : `SELECT "ingestedBy" AS tag, count(*)::int AS claims, 0 AS edges, 0 AS hosts, NULL AS top_hosts FROM "Claim" WHERE NOT deleted GROUP BY 1 ORDER BY 2 DESC`,
      );
      return r.rows;
    } finally {
      c.release();
    }
  } finally {
    await pool.end();
  }
}

const CURATED = /^(seed[:-]|law-settler|book-analysis:|manual$)/;

function provenance(tag: string, writers: string[], llm: string[], models: string[]): string {
  if (llm.length) {
    return `LLM call in ${llm.map((f) => "`" + f + "`").join(", ")}; prompt text in that file; model ${models.length ? models.map((m) => "`" + m + "`").join(", ") : "not pinned (CLI default at run time) — not recorded"}`;
  }
  if (CURATED.test(tag)) {
    return writers.length
      ? `no LLM call in the script; claim and transition text hardcoded in ${writers.map((f) => "`" + f + "`").join(", ")}; authoring process not recorded per record (git trailers only, numbers.md §7)`
      : "not recorded";
  }
  return writers.length ? "n/a — no LLM call in the writer script (claim text from a code template)" : "not recorded (writer script not found)";
}

async function main() {
  const mdAt = argv.indexOf("--md");
  const mdPath = mdAt >= 0 ? argv[mdAt + 1] : null;
  const md: string[] = [];
  const seen: string[] = [];
  const noWriter: string[] = [];
  const withLlm: string[] = [];
  const files = walk(ROOT).map((f) => ({ f, text: fs.readFileSync(f, "utf8") }));
  const registry = new Map(PIPELINES.map((p) => [p.tag, p]));
  console.log(["pipeline", "claims", "registry_upstream", "registry_url", "registry_method", "writer_scripts", "later_writer_scripts", "other_mentions", "llm_call_in_writer", "model_ids_in_writer"].join("\t"));
  for (const { tag, claims, edges, hosts, top_hosts } of await tags(mdPath !== null)) {
    const esc = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const lit = new RegExp(`['"\`]${esc}['"\`]`);
    let hits = files.filter((x) => lit.test(x.text));
    const dyn = DYNAMIC.find(([re]) => re.test(tag));
    if (hits.length === 0 && dyn) hits = files.filter((x) => x.f === dyn[1]);
    if (hits.length === 0) {
      const guess = path.join(ROOT, `ingest-${tag.replace(/_v\d+$/, "").replace(/_/g, "-")}.ts`);
      hits = files.filter((x) => x.f === guess);
    }
    const writes = (x: { f: string; text: string }) =>
      /^(ingest|seed|import)-/.test(path.basename(x.f)) || /INSERT INTO|\.create(Many)?\(|\.upsert\(/.test(x.text);
    const allWriters = hits.filter(writes);
    // The primary ingester: an ingest-/seed-/import- script, or the hand-mapped
    // DYNAMIC writer. Other writers (link-, enrich-, backfill-, bulk-, dedupe-…)
    // modify the pipeline's rows later and are counted, not listed.
    const primary = allWriters.filter((x) => /^(ingest|seed|import)-/.test(path.basename(x.f)) || x.f === dyn?.[1]);
    const writers = primary.length ? primary : allWriters;
    const laterWriters = allWriters.length - writers.length;
    const others = hits.filter((x) => !writes(x));
    const llm = writers.filter((x) => LLM_RE.test(x.text));
    const models = new Set<string>();
    for (const x of llm) for (const m of x.text.matchAll(MODEL_RE)) models.add(m[1]);
    console.log(
      [
        tag,
        claims,
        registry.get(tag)?.upstreamName ?? "not in registry",
        registry.get(tag)?.upstreamUrl ?? "",
        registry.get(tag)?.method ?? "",
        writers.map((x) => x.f).join(", ") || "not found",
        laterWriters,
        others.length,
        llm.map((x) => x.f).join(", ") || "none",
        [...models].join(", ") || "—",
      ].join("\t"),
    );
    seen.push(tag);
    if (!writers.length) noWriter.push(tag);
    if (llm.length) withLlm.push(tag);
    const reg = registry.get(tag);
    const cell = (x: string) => x.replace(/\|/g, "\\|");
    md.push(
      `| \`${tag}\` | ${claims.toLocaleString("en-US")} | ${cell(reg ? reg.upstreamName + (reg.upstreamUrl ? ` (${reg.upstreamUrl})` : "") : "not in registry")} | ${writers.map((x) => "`" + x.f + "`").join(", ") || "not found"}${laterWriters ? ` (+${laterWriters} later writers)` : ""} | ${edges.toLocaleString("en-US")} | ${hosts} | ${cell(top_hosts ?? "—")} | ${cell(provenance(tag, writers.map((x) => x.f), llm.map((x) => x.f), [...models]))} |`,
    );
  }
  if (mdPath) {
    const total = md.length;
    const regs = [...seen].map((t) => registry.get(t)).filter((r) => r !== undefined);
    const upstreams = new Set(regs.map((r) => r!.upstreamName));
    const topLevel = fs.readdirSync(ROOT).filter((f) => /^(ingest|seed)-.*\.ts$/.test(f)).length;
    const summary =
      `Summary: ${total} pipelines; ${regs.length} have a registry entry; ${upstreams.size} distinct registry \`upstreamName\` values among them; ` +
      `${topLevel} \`scripts/ingest-*.ts\` + \`scripts/seed-*.ts\` files at the top of \`scripts/\` (some ingest several tags, some are superseded); ` +
      `${noWriter.length} pipeline(s) with no writer script found: ${noWriter.map((t) => "\`" + t + "\`").join(", ") || "none"}; ` +
      `${withLlm.length} pipeline(s) whose writer calls an LLM: ${withLlm.map((t) => "\`" + t + "\`").join(", ") || "none"}.`;
    fs.writeFileSync(
      mdPath,
      [
        "# Sources and pipelines",
        "",
        `Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/paper/pipeline-scripts.ts --md\` (read-only, app_ro). ${total} pipelines = distinct \`Claim.ingestedBy\` values with ≥1 claim where \`deleted = false\`. Do not edit by hand; rerun the script.`,
        "",
        summary,
        "",
        "Columns:",
        "- **Upstream** — `upstreamName` (`upstreamUrl`) from `lib/pipelines/registry.ts`. Editorial text in the repo, not checked against the upstream here.",
        "- **Writer script** — the primary ingester: a file under `scripts/` named `ingest-`/`seed-`/`import-*` that names the tag as a string literal (run-time-built tags are mapped by hand in the script's `DYNAMIC` list). \"+N later writers\" counts other scripts that name the tag and write (INSERT/create/upsert: link-, enrich-, backfill-, correction scripts). A file listed here is a candidate, not proof it produced every row.",
        "- **Edges / hosts / top hosts** — non-deleted `Edge` rows from the pipeline's corpus claims to non-deleted `Source` rows, the number of distinct `Source.url` hosts (`www.` stripped), and the two most common hosts. A host stands in for the source institution; one institution can serve several hosts.",
        "- **Prompt / model recorded** — whether a writer script calls an LLM (Anthropic/OpenAI SDK or API host, or the `claude` CLI), and if so whether it pins a model id. \"n/a\" means the writer makes no LLM call: the claim text comes from a code template over the upstream record.",
        "",
        "Processes that write status-history rows or sources but no claims of their own (`claude_sourcing_v1`, the corpus promoter, `bulk-promote-corpus.ts`, `ingest-auto-trajectories.ts`, the `event:*` and `enrich*` tags) are in `docs/paper/numbers.md` §3 and §9.",
        "",
        "| Pipeline | Claims | Upstream (registry) | Writer script | Edges | Hosts | Top hosts | Prompt / model recorded |",
        "|---|---:|---|---|---:|---:|---|---|",
        ...md,
        "",
      ].join("\n"),
    );
    console.error(`wrote ${mdPath} (${total} pipelines)`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
