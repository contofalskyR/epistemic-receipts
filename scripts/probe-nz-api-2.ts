// probe-nz-api-2.ts — READ-ONLY follow-up to probe-nz-api.ts. Zero DB, zero writes.
// ~13 throttled HTTP requests.
//
// Probe 1 established: (a) no repeal-date FIELD anywhere in the API JSON, and
// (b) www.legislation.govt.nz served FULL bytes (249,955) to probe 1's fetch —
// the 0-byte bot-wall did not fire. But probe 1 grepped raw HTML only (the
// production regex works on TAG-STRIPPED text) and only sampled the oldest act
// (1841 — no XML, pre-modern note wording).
//
// This probe answers the two questions that decide path (b):
//   1. WHICH request shape unblocks www — phase-1's original fetch, or the
//      probe's UA/Accept, or the X-Api-Key header? (header matrix, one URL)
//   2. Does the REAL lib/nz-repeal extractRepeal() pull dates from modern and
//      mid-century repealed-act pages? (★ lines)
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/probe-nz-api-2.ts
import "dotenv/config";
import { extractRepeal, stripTags } from "../lib/nz-repeal";

const API = "https://api.legislation.govt.nz";
const KEY = process.env.NZ_LEGISLATION_API_KEY;
if (!KEY) {
  console.error("NZ_LEGISLATION_API_KEY not set in .env.local");
  process.exit(1);
}

const KNOWN_1841_HTML = "https://www.legislation.govt.nz/act/public/1841/4/en/latest/";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

type Recipe = { name: string; headers: Record<string, string> };
const RECIPES: Recipe[] = [
  {
    name: "phase1-original (plain UA, no key, no Accept)",
    headers: { "User-Agent": "epistemic-receipts/1.0 (nz-repeal-date backfill)" },
  },
  {
    name: "probe-UA+Accept, NO key",
    headers: {
      Accept: "application/xml, text/html, */*",
      "User-Agent": "EpistemicReceipts/1.0 (read-only research probe)",
    },
  },
  {
    name: "probe-UA+Accept, WITH key (probe 1's known-good)",
    headers: {
      Accept: "application/xml, text/html, */*",
      "User-Agent": "EpistemicReceipts/1.0 (read-only research probe)",
      "X-Api-Key": KEY,
    },
  },
];

async function get(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; bytes: number; text: string }> {
  try {
    const res = await fetch(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    return { status: res.status, bytes: text.length, text };
  } catch (err) {
    console.log(`   FETCH ERROR: ${err instanceof Error ? err.message : String(err)}`);
    return { status: 0, bytes: 0, text: "" };
  }
}

function debugWindows(stripped: string, re: RegExp, ctx: number, max: number): string[] {
  const out: string[] = [];
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = g.exec(stripped)) && out.length < max) {
    const start = Math.max(0, m.index - Math.floor(ctx / 3));
    out.push(squash(stripped.slice(start, m.index + m[0].length + ctx)));
    g.lastIndex = m.index + Math.max(1, m[0].length);
  }
  return out;
}

type WorkEntry = {
  work_id?: string;
  act_status?: string;
  latest_matching_version?: {
    title?: string;
    version_id?: string;
    formats?: Array<{ type?: string; format?: string; url: string }>;
  };
};

function htmlFormatUrl(w: WorkEntry): string | null {
  const f = (w.latest_matching_version?.formats ?? []).find(
    (x) => (x.type ?? x.format) === "html",
  );
  return f?.url ?? null;
}
function xmlFormatUrl(w: WorkEntry): string | null {
  const f = (w.latest_matching_version?.formats ?? []).find(
    (x) => (x.type ?? x.format) === "xml",
  );
  return f?.url ?? null;
}

async function listWorks(query: string, label: string): Promise<WorkEntry[]> {
  const url = `${API}/v0/works/?legislation_type=act&act_type=public&act_status=repealed&act_classification=principal&${query}`;
  const r = await get(url, {
    Accept: "application/json",
    "User-Agent": "EpistemicReceipts/1.0 (read-only research probe)",
    "X-Api-Key": KEY!,
  });
  console.log(`\n── list ${label} → HTTP ${r.status} | ${r.bytes} bytes`);
  await sleep(400);
  if (r.status !== 200) {
    console.log("   head: " + squash(r.text).slice(0, 200));
    return [];
  }
  try {
    const parsed = JSON.parse(r.text) as { results?: WorkEntry[] };
    return parsed.results ?? [];
  } catch {
    console.log("   (not JSON) head: " + squash(r.text).slice(0, 200));
    return [];
  }
}

async function main() {
  console.log("PCO probe 2 — header matrix + tag-stripped extractRepeal on real pages");

  // ── 1. header matrix: which request shape gets full bytes from www? ────────
  console.log(`\n═ 1. header matrix on ${KNOWN_1841_HTML}`);
  let working: Recipe | null = null;
  for (const recipe of RECIPES) {
    const r = await get(KNOWN_1841_HTML, recipe.headers);
    const verdict = r.status === 200 && r.bytes > 5_000 ? "FULL BODY ✓" : "blocked/empty ✗";
    console.log(`   [${recipe.name}] → HTTP ${r.status} | ${r.bytes} bytes | ${verdict}`);
    if (!working && r.status === 200 && r.bytes > 5_000) working = recipe;
    await sleep(400);
  }
  console.log(
    `   ⇒ minimal working recipe: ${working ? working.name : "NONE — www is blocking all three shapes"}`,
  );
  if (!working) working = RECIPES[2];

  // ── 2. sample repealed acts across eras ────────────────────────────────────
  const modern = await listWorks("per_page=3&page=1&sort_by=year_desc", "modern (year_desc p1)");
  const mid = await listWorks("per_page=2&page=1093&sort_by=year_asc", "mid-range (year_asc p1093)");
  const oldest = await listWorks("per_page=1&page=1&sort_by=year_asc", "oldest (year_asc p1)");
  const seen = new Set<string>();
  const sample: WorkEntry[] = [];
  for (const w of [...modern, ...mid, ...oldest]) {
    const id = String(w.work_id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    sample.push(w);
  }
  console.log(`\n═ 2. sampled ${sample.length} repealed works`);

  // ── 3. run the PRODUCTION extractor on each act page ───────────────────────
  let extracted = 0;
  for (const w of sample) {
    const title = w.latest_matching_version?.title ?? w.work_id ?? "?";
    const url = htmlFormatUrl(w);
    console.log(`\n── 3. ${title}`);
    if (!url) {
      console.log("   (no html format url)");
      continue;
    }
    const r = await get(url, working.headers);
    console.log(`   GET ${url} → HTTP ${r.status} | ${r.bytes} bytes`);
    await sleep(400);
    if (r.status !== 200 || r.bytes === 0) continue;
    const hit = extractRepeal(r.text);
    if (hit) {
      extracted++;
      console.log(`   ★ extractRepeal → repealedAt=${hit.repealedAt}  by=${hit.repealedBy ?? "(none)"}`);
    } else {
      console.log("   ✗ extractRepeal returned null — tag-stripped context:");
      const stripped = stripTags(r.text);
      const near = debugWindows(stripped, /[Rr]epealed\s*,?\s+on/, 260, 3);
      const fallback = near.length ? near : debugWindows(stripped, /[Rr]epealed/, 200, 2);
      if (fallback.length === 0) console.log("     (no 'repealed' in stripped text at all)");
      fallback.forEach((h, i) => console.log(`     ${i + 1}. …${h}…`));
    }
  }

  // ── 4. official XML for the newest sampled act (future cleaner path?) ──────
  const xmlUrl = sample.map(xmlFormatUrl).find((u): u is string => !!u);
  console.log(`\n═ 4. XML format check`);
  if (!xmlUrl) console.log("   (no xml format url in sample)");
  else {
    const r = await get(xmlUrl, working.headers);
    console.log(`   GET ${xmlUrl} → HTTP ${r.status} | ${r.bytes} bytes`);
    if (r.status === 200 && r.bytes > 0) {
      const hits = debugWindows(r.text, /(repeal|terminat)[^>]{0,100}?\d{4}/i, 120, 5);
      if (hits.length === 0) console.log("   no date-shaped repeal/terminat attrs found in XML");
      hits.forEach((h, i) => console.log(`   ★ xml ${i + 1}. …${h}…`));
    }
  }

  console.log(
    `\n═ SUMMARY: extractRepeal succeeded on ${extracted}/${sample.length} sampled pages; ` +
      `working recipe = ${working.name}`,
  );
  console.log(
    extracted > 0
      ? "⇒ path (b) CONFIRMED: patch phase-1 fetch headers to the working recipe and run its preflight."
      : "⇒ still no extraction — inspect the debug windows above before deciding (b) vs (c).",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
