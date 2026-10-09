/**
 * verify-transition-sources.ts — mechanical check of claude_sourcing_v1 candidates.
 *
 * For every candidate: fetch the URL, extract its text (HTML incl. meta tags, or
 * PDF), and measure how much of the stored excerpt appears on the page. Reads the
 * database only; writes logs/transition-verify.jsonl (gitignored), one line per
 * candidate, resumable (ids already in the file are skipped). No API calls.
 *
 *   npx tsx scripts/verify-transition-sources.ts            # all unverified candidates
 *   npx tsx scripts/verify-transition-sources.ts --limit 50
 *   npx tsx scripts/verify-transition-sources.ts --summary  # tally the file, no fetching
 *
 * `match` is the share of the excerpt's 24-character windows (step 12, after
 * normalising case, accents, punctuation and whitespace away) found in the page
 * text. That works for any script, spaced or not. A bot wall (403), a JS-only
 * page or a scanned PDF without a text layer gives `match: null`, not 0.
 */
import { config as loadEnv } from "dotenv";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { excerptMatch, hostOf, htmlToText, isMetaExcerpt, makePool, truncate } from "./lib/transition-sourcing";

loadEnv({ path: ".env.local", quiet: true });

const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const LIMIT = opt("limit") ? Number(opt("limit")) : null;
const OUT = resolve(opt("out") ?? "logs/transition-verify.jsonl");
const CONCURRENCY = 12;
const PER_HOST = 2;
const HOST_GAP_MS = 300;
const TIMEOUT_MS = 25_000;
const MAX_BYTES = 8 * 1024 * 1024;
const UA = "Mozilla/5.0 (compatible; epistemic-receipts source check; +https://github.com/contofalskyR/epistemic-receipts)";

export type VerifyResult = {
  id: string;
  url: string;
  status: number | null; // HTTP status after redirects; null = no response
  finalUrl: string | null;
  contentType: string | null;
  bytes: number;
  textLen: number;
  match: number | null; // 0–1, null when there was no usable text
  metaExcerpt: boolean; // the excerpt reads like catalogue metadata
  error: string | null;
  ms: number;
};

// ── Fetch ──────────────────────────────────────────────────────────────────

async function readCapped(res: Response): Promise<Buffer> {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
    if (total >= MAX_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return Buffer.concat(chunks);
}

type PdfParse = (b: Buffer) => Promise<{ text: string }>;
let pdfParse: PdfParse | null = null;
async function pdfText(buf: Buffer): Promise<string> {
  // The package's index.js reads a bundled test PDF when it has no parent module; the lib entry does not.
  // @ts-expect-error the lib entry ships no type declarations
  pdfParse ??= ((await import("pdf-parse/lib/pdf-parse.js")) as unknown as { default: PdfParse }).default;
  return (await pdfParse(buf)).text;
}

export async function verifyOne(c: { id: string; url: string; excerpt: string | null }): Promise<VerifyResult> {
  const t0 = Date.now();
  const r: VerifyResult = {
    id: c.id, url: c.url, status: null, finalUrl: null, contentType: null, bytes: 0, textLen: 0,
    match: null, metaExcerpt: isMetaExcerpt(c.excerpt ?? ""), error: null, ms: 0,
  };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(c.url, {
      redirect: "follow",
      signal: ac.signal,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8", "accept-language": "en,*;q=0.5" },
    });
    r.status = res.status;
    r.finalUrl = res.url || c.url;
    r.contentType = res.headers.get("content-type");
    const buf = await readCapped(res);
    r.bytes = buf.byteLength;
    if (res.ok && buf.byteLength) {
      const isPdf = /pdf/i.test(r.contentType ?? "") || buf.subarray(0, 5).toString("latin1") === "%PDF-";
      let text = "";
      if (isPdf) {
        try {
          text = await pdfText(buf);
        } catch (e) {
          r.error = `pdf: ${truncate(e instanceof Error ? e.message : String(e), 120)}`;
        }
      } else {
        const charset = /charset=([\w-]+)/i.exec(r.contentType ?? "")?.[1];
        let decoded: string;
        try {
          decoded = new TextDecoder(charset || "utf-8").decode(buf);
        } catch {
          decoded = new TextDecoder("utf-8").decode(buf);
        }
        text = /html|xml/i.test(r.contentType ?? "") || /^\s*</.test(decoded) ? htmlToText(decoded) : decoded;
      }
      r.textLen = text.length;
      r.match = c.excerpt ? excerptMatch(c.excerpt, text) : null;
    }
  } catch (e) {
    const err = e as { name?: string; cause?: { code?: string }; message?: string };
    r.error = err.name === "AbortError" ? "timeout" : truncate(err.cause?.code ?? err.message ?? String(e), 160);
  } finally {
    clearTimeout(timer);
    r.ms = Date.now() - t0;
  }
  return r;
}

// ── Main ───────────────────────────────────────────────────────────────────

function readDone(): Map<string, VerifyResult> {
  const m = new Map<string, VerifyResult>();
  if (!existsSync(OUT)) return m;
  for (const line of readFileSync(OUT, "utf8").split("\n")) {
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

function summarise(results: VerifyResult[]) {
  const by = (f: (r: VerifyResult) => string) => {
    const m = new Map<string, number>();
    for (const r of results) m.set(f(r), (m.get(f(r)) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const statusBucket = (r: VerifyResult) =>
    r.status === null ? `no response (${r.error?.split(":")[0] ?? "?"})` : r.status < 300 ? "2xx" : String(r.status);
  const matchBucket = (r: VerifyResult) =>
    r.match === null ? "no text" : r.match >= 0.6 ? "≥0.6 (excerpt on page)" : r.match >= 0.2 ? "0.2–0.6 (partly)" : "<0.2 (not on page)";
  console.log(`verified: ${results.length}`);
  console.log("HTTP:", by(statusBucket).map(([k, n]) => `${k} ${n}`).join(" · "));
  const ok = results.filter((r) => r.status !== null && r.status < 300);
  const okBy = new Map<string, number>();
  for (const r of ok) okBy.set(matchBucket(r), (okBy.get(matchBucket(r)) ?? 0) + 1);
  console.log("excerpt match on 2xx pages:", [...okBy].map(([k, n]) => `${k} ${n}`).join(" · "), `(of ${ok.length})`);
  console.log("metadata-like excerpts:", results.filter((r) => r.metaExcerpt).length);
}

async function main() {
  const done = readDone();
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
  const todo = rows.filter((r) => !done.has(r.id)).slice(0, LIMIT ?? undefined);
  console.log(`${rows.length} candidates · ${done.size} already verified · checking ${todo.length}`);
  mkdirSync(dirname(OUT), { recursive: true });

  const active = new Map<string, number>();
  const lastStart = new Map<string, number>();
  let finished = 0;
  const worker = async () => {
    for (;;) {
      // Next row whose host has a free slot; wait briefly if none does.
      let idx = -1;
      for (let i = 0; i < todo.length && i < 200; i++) {
        const h = hostOf(todo[i].url) ?? "?";
        if ((active.get(h) ?? 0) < PER_HOST && Date.now() - (lastStart.get(h) ?? 0) >= HOST_GAP_MS) {
          idx = i;
          break;
        }
      }
      if (!todo.length) return;
      if (idx < 0) {
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }
      const [row] = todo.splice(idx, 1);
      const h = hostOf(row.url) ?? "?";
      active.set(h, (active.get(h) ?? 0) + 1);
      lastStart.set(h, Date.now());
      try {
        const r = await verifyOne(row);
        appendFileSync(OUT, JSON.stringify(r) + "\n");
        done.set(r.id, r);
      } finally {
        active.set(h, (active.get(h) ?? 1) - 1);
        finished++;
        if (finished % 250 === 0) console.log(`[${finished}] checked`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  summarise([...done.values()]);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
