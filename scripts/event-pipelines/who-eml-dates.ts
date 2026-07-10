/**
 * who-eml-dates.ts — first-added-date backfill for dateless
 * who_essential_medicines_v1 claims, from the WHO Electronic EML
 * (list.essentialmeds.org). Probe/decision: STOP memo
 * logs/who-eml-deletions-probe-2026-07-10.md (briefing 18 Q3).
 *
 * THIS IS NOT A TRANSITION PIPELINE. It writes Claim.claimEmergedAt (+
 * claimEmergedPrecision='YEAR' + provenance keys merged into metadata) on the
 * ~147 who_essential_medicines_v1 claims that carry NO date, from the eEML
 * "EML status history" line "First added in YYYY (TRS NNN)" (YEAR precision,
 * TRS-linked, verified 1979→2005 in the memo). It NEVER touches
 * ClaimStatusHistory — after it runs, the existing Layer-1 pass baselines the
 * newly dated claims (null→SETTLED @ first-added year).
 *
 * Two stages, per the memo:
 *   STAGE 1 (writes, --execute only): backfill claimEmergedAt on matched,
 *     null-dated claims from "First added in YYYY".
 *   STAGE 2 (REPORT ONLY — never writes transitions): detect corpus medicines
 *     that show a WHOLE-medicine removal (present under ?showRemoved=1 but
 *     ABSENT from the active list). Removals on the eEML are per-INDICATION;
 *     only a full removal (medicine gone from the active list) reverses our
 *     per-medicine membership claim. These are written to
 *     logs/who-eml-removal-candidates.jsonl + a console CHECKPOINT for eyeball
 *     review BEFORE any transition is emitted by a separate pipeline.
 *
 * Guardrails (a wrong DATE corrupts a claim; a skipped arc doesn't):
 *   - Matching is normalized-exact-only: corpus INN ↔ eEML medicine name,
 *     case-insensitive, parenthetical form-suffixes dropped. Ambiguous
 *     (>1 eEML id) or unmatched → residue, no write.
 *   - Writes only claims whose claimEmergedAt IS NULL (updateMany-guarded,
 *     race-safe; existing dates — e.g. the ingest's 2023-07 edition baseline —
 *     are never overwritten). Dates are never invented: a medicine whose page
 *     has no parseable "First added in YYYY" → residue.
 *   - Defensive INN re-check: the matched page's own INN field must normalize
 *     to the same key, else residue (guards a mis-grabbed list heading).
 *
 * PREFLIGHT/DRY-RUN BY DEFAULT; writes only with --execute. eEML HTML (the two
 * list pages + one page per matched medicine) is cached under logs/eml-cache/
 * so re-runs and the pilot→full sequence hit disk. Plain node fetch + 300ms
 * politeness delay (this file executes on a Mac; the sandbox has no DB/egress).
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/who-eml-dates.ts
 *   ... --limit 20            first N corpus medicines (pilot)
 *   ... --residue-path PATH   override residue JSONL location
 *   ... --execute             write (after the sample-review gate!)
 *
 * After --execute:
 *   npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json \
 *     scripts/ingest-auto-trajectories.ts --pipeline who_essential_medicines_v1
 */

import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { parseHTML } from "linkedom";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const PIPELINE = "who_essential_medicines_v1";
const DATED_BY = "event:who_eml_dates_v1";
const EML_BASE = "https://list.essentialmeds.org";
const FETCH_DELAY_MS = 300;
const CACHE_DIR = path.join(__dirname, "../../logs/eml-cache");
const PLANNED_PATH = path.join(__dirname, "../../logs/who-eml-planned.jsonl");
const REMOVALS_PATH = path.join(__dirname, "../../logs/who-eml-removal-candidates.jsonl");
const MIN_PLAUSIBLE_MEDICINES = 100; // fail-closed: active list far below this ⇒ structure changed

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const EXECUTE = process.argv.includes("--execute");
const LIMIT = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : null;
const RESIDUE_PATH = argValue("--residue-path")
  ?? path.join(__dirname, "../../logs/who-eml-dates-residue.jsonl");

// ── Fetch + cache ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BROWSERISH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchHtml(url: string): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(url, { headers: BROWSERISH_HEADERS, redirect: "follow", signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Cache key is a filesystem-safe token; list pages use fixed keys, medicine
 *  pages use their numeric id. On a miss we fetch and observe the delay. */
async function fetchCached(key: string, url: string): Promise<{ html: string; fromCache: boolean }> {
  const cachePath = path.join(CACHE_DIR, `${key}.html`);
  if (fs.existsSync(cachePath)) return { html: fs.readFileSync(cachePath, "utf8"), fromCache: true };
  const html = await fetchHtml(url);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath, html);
  await sleep(FETCH_DELAY_MS);
  return { html, fromCache: false };
}

// ── Normalization ─────────────────────────────────────────────────────────────

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** Normalize an INN / medicine name for exact matching: lowercase, drop
 *  parenthetical form/qualifier suffixes ("Kanamycin (injection)" → "kanamycin",
 *  our "tetracycline (ophthalmic)" → "tetracycline"), collapse whitespace,
 *  strip trailing punctuation. */
function normName(s: string): string {
  return collapse(s.toLowerCase().replace(/\([^)]*\)/g, " ")).replace(/[.,;:]+$/g, "").trim();
}

const GENERIC_ANCHOR = /^(general information|more|details|view|read more|print|export|en|fr|pdf|word|cancel|caveats|about|contact)$/i;

// ── List-page parser (name → eEML ids) ────────────────────────────────────────

interface ListParse {
  ids: Set<number>;
  byName: Map<string, Set<number>>;
}

/**
 * Collect (medicine name → id) from a server-rendered list page. Each medicine
 * card links to /medicines/<id>; the visible name is the card heading and/or
 * the anchor text (the two known renderings), so we register BOTH the anchor's
 * own text and its enclosing heading as candidate name keys. Extra/garbage keys
 * are harmless: a corpus INN that resolves to >1 id is treated as ambiguous.
 */
function parseListPage(html: string): ListParse {
  const { document } = parseHTML(html);
  const ids = new Set<number>();
  const byName = new Map<string, Set<number>>();
  const register = (name: string, id: number) => {
    const k = normName(name);
    if (!k || k.length < 2) return;
    if (!byName.has(k)) byName.set(k, new Set());
    byName.get(k)!.add(id);
  };
  for (const a of Array.from(document.querySelectorAll("a"))) {
    const m = /\/medicines\/(\d+)(?:[/?#]|$)/.exec(a.getAttribute("href") ?? "");
    if (!m) continue;
    const id = parseInt(m[1], 10);
    ids.add(id);
    const anchorText = collapse(a.textContent ?? "");
    if (anchorText && !GENERIC_ANCHOR.test(anchorText)) register(anchorText, id);
    const heading = a.closest("h1,h2,h3,h4,h5,h6");
    if (heading) {
      const headingText = collapse((heading.textContent ?? "").replace(anchorText, " ").replace(/general information/gi, " "));
      if (headingText) register(headingText, id);
    }
  }
  return { ids, byName };
}

// ── Medicine-page parser (INN + EML status history) ───────────────────────────

interface MedicinePage {
  displayName: string | null;
  inn: string | null;
  firstAddedYear: number | null;
  firstAddedTrs: string | null;
  removedYear: number | null;
  removedTrs: string | null;
}

const NOW_YEAR = new Date().getUTCFullYear();

function parseMedicinePage(html: string): MedicinePage {
  const { document } = parseHTML(html);
  const root = document.body ?? document.documentElement;
  const text = collapse(root?.textContent ?? "");

  // INN sits between the "INN" label and the next known label.
  const innM =
    /\bINN\b\s+(.+?)\s+(?:ATC codes?|Medicine type|Antibiotic groups|EML status history|Wikipedia|DrugBank)\b/i.exec(text);
  const inn = innM ? innM[1].trim() : null;

  // Display name: the first non-generic <h1> (the site title is generic).
  let displayName: string | null = null;
  for (const h of Array.from(document.querySelectorAll("h1"))) {
    const t = collapse(h.textContent ?? "");
    if (t && !/electronic essential medicines list/i.test(t) && !/^eEML\b/i.test(t)) {
      displayName = t;
      break;
    }
  }

  // Scope history parsing to the "EML status history" section so the repeated
  // "Removed Removed …" status badge on removed pages (which precedes the
  // history) can't leak in. Requiring "in YYYY" is a second guard.
  let hist = text;
  const hi = text.search(/EML status history/i);
  if (hi !== -1) {
    const after = text.slice(hi + "EML status history".length);
    const endM = /(Wikipedia|DrugBank|Recommendations|Indications|Section\b|General information)/i.exec(after);
    hist = endM ? after.slice(0, endM.index) : after;
  }

  const faM = /First added in (\d{4})(?:\s*\(\s*TRS\s*([0-9]+)\s*\))?/i.exec(hist);
  const firstAddedYear = faM ? parseInt(faM[1], 10) : null;
  const firstAddedTrs = faM && faM[2] ? `TRS ${faM[2]}` : null;

  const removedAll = [...hist.matchAll(/Removed in (\d{4})(?:\s*\(\s*TRS\s*([0-9]+)\s*\))?/gi)];
  const lastRemoved = removedAll.length ? removedAll[removedAll.length - 1] : null;
  const removedYear = lastRemoved ? parseInt(lastRemoved[1], 10) : null;
  const removedTrs = lastRemoved && lastRemoved[2] ? `TRS ${lastRemoved[2]}` : null;

  return { displayName, inn, firstAddedYear, firstAddedTrs, removedYear, removedTrs };
}

// ── Corpus index ──────────────────────────────────────────────────────────────

interface ClaimLite {
  id: string;
  inn: string | null;
  claimEmergedAt: Date | null;
  metadata: Record<string, unknown>;
}

const liteSelect = {
  id: true,
  text: true,
  metadata: true,
  claimEmergedAt: true,
} satisfies Prisma.ClaimSelect;

const TEXT_INN_FRAME = /^(.*?)\s*\(ATC code:/i;

function toLite(c: { id: string; text: string; metadata: unknown; claimEmergedAt: Date | null }): ClaimLite {
  const meta = (c.metadata ?? {}) as Record<string, unknown>;
  const inn =
    typeof meta.inn === "string" && meta.inn.trim()
      ? meta.inn.trim()
      : TEXT_INN_FRAME.exec(c.text)?.[1]?.trim() ?? null;
  return { id: c.id, inn, claimEmergedAt: c.claimEmergedAt, metadata: meta };
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface PlannedWrite {
  claimId: string;
  inn: string;
  medicineId: number;
  url: string;
  year: number;
  trs: string | null;
  metadata: Prisma.InputJsonObject;
}

interface RemovalCandidate {
  inn: string;
  claimId: string;
  removedYear: number | null;
  trs: string | null;
  url: string;
}

async function main() {
  console.log(
    `\n=== WHO EML first-added date-backfill — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (no writes)"}${LIMIT ? `, limit ${LIMIT} medicines` : ""} ===\n`,
  );
  console.log(`NOT a transition pipeline: writes Claim.claimEmergedAt on dateless ${PIPELINE} claims only.`);
  console.log(`Stage 2 (whole-medicine removals) is REPORT ONLY — never writes transitions.\n`);

  const residue: object[] = [];
  const removals: RemovalCandidate[] = [];

  // Corpus: one findMany → in-memory index keyed by normalized INN.
  console.log("Loading corpus claims (one findMany over the pipeline)…");
  const rows = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: PIPELINE },
    select: liteSelect,
  });
  const claims = rows.map(toLite);
  const byInn = new Map<string, ClaimLite[]>();
  for (const c of claims) {
    if (!c.inn) continue;
    const k = normName(c.inn);
    if (!k) continue;
    const list = byInn.get(k) ?? [];
    list.push(c);
    byInn.set(k, list);
  }
  console.log(`Corpus: ${claims.length} claims, ${byInn.size} distinct normalized INNs.`);

  // Feed: active list + showRemoved list (one fetch each, cached).
  console.log("Fetching eEML list pages (active + showRemoved)…");
  const activeParse = parseListPage((await fetchCached("list-active", `${EML_BASE}/`)).html);
  const removedParse = parseListPage((await fetchCached("list-removed", `${EML_BASE}/?showRemoved=1`)).html);
  const activeIds = activeParse.ids;
  const allIds = removedParse.ids; // superset: active + fully-removed
  const nameMap = removedParse.byName; // match against the superset so removed meds still resolve
  if (activeIds.size < MIN_PLAUSIBLE_MEDICINES || allIds.size < activeIds.size)
    throw new Error(
      `List parse implausible (active=${activeIds.size}, all=${allIds.size}) — eEML structure changed? FAIL-CLOSED`,
    );
  const removedOnly = [...allIds].filter((id) => !activeIds.has(id));
  console.log(
    `Feed: ${activeIds.size} active medicines, ${allIds.size} incl. removed (${removedOnly.length} removed-only), ${nameMap.size} name keys.`,
  );

  const counts = {
    corpusClaims: claims.length,
    processed: 0,
    matchedUnique: 0,
    unmatched: 0,
    ambiguous: 0,
    innMismatch: 0,
    noFirstAdded: 0,
    invalidYear: 0,
    alreadyDated: 0,
    planned: 0,
    removalCandidates: 0,
    updated: 0,
    skippedRace: 0,
  };

  // Deterministic order; --limit slices corpus medicines (Stage 2 still sees
  // the full list diff, so removal detection is complete under --limit).
  const ordered = [...claims].sort((a, b) => (a.inn ?? "").localeCompare(b.inn ?? ""));
  const pool = LIMIT ? ordered.slice(0, LIMIT) : ordered;

  const planned: PlannedWrite[] = [];

  for (const claim of pool) {
    counts.processed++;
    if (counts.processed % 25 === 0)
      console.log(`  … ${counts.processed}/${pool.length} medicines (${counts.matchedUnique} matched, ${planned.length} planned)`);

    if (!claim.inn) {
      counts.unmatched++;
      residue.push({ kind: "no-inn", claimId: claim.id });
      continue;
    }
    const key = normName(claim.inn);
    const ids = nameMap.get(key);
    if (!ids || ids.size === 0) {
      counts.unmatched++;
      residue.push({ kind: "unmatched", inn: claim.inn, claimId: claim.id });
      continue;
    }
    if (ids.size > 1) {
      counts.ambiguous++;
      residue.push({ kind: "ambiguous", inn: claim.inn, claimId: claim.id, ids: [...ids] });
      continue;
    }
    const medicineId = [...ids][0];
    const url = `${EML_BASE}/medicines/${medicineId}`;
    const { html } = await fetchCached(String(medicineId), url);
    const page = parseMedicinePage(html);

    // Defensive: the matched page's own INN must normalize to the same key.
    if (page.inn && normName(page.inn) !== key) {
      counts.innMismatch++;
      residue.push({ kind: "inn-mismatch", inn: claim.inn, claimId: claim.id, medicineId, pageInn: page.inn, url });
      continue;
    }
    counts.matchedUnique++;

    // STAGE 2 (report only) — independent of the claim's date-null-ness.
    // Gate is the memo's rule: flag only if the medicine is ABSENT from the
    // active list (a whole-medicine removal, not a per-indication removal).
    if (allIds.has(medicineId) && !activeIds.has(medicineId)) {
      counts.removalCandidates++;
      removals.push({
        inn: claim.inn,
        claimId: claim.id,
        removedYear: page.removedYear,
        trs: page.removedTrs,
        url,
      });
    }

    // STAGE 1 — first-added date backfill (null-only).
    if (page.firstAddedYear === null) {
      counts.noFirstAdded++;
      residue.push({ kind: "no-first-added", inn: claim.inn, claimId: claim.id, medicineId, url });
      continue;
    }
    if (page.firstAddedYear < 1900 || page.firstAddedYear > NOW_YEAR + 1) {
      counts.invalidYear++;
      residue.push({ kind: "invalid-year", inn: claim.inn, claimId: claim.id, year: page.firstAddedYear, url });
      continue;
    }
    if (claim.claimEmergedAt !== null) {
      counts.alreadyDated++;
      continue; // never overwrite an existing date (e.g. the ingest's 2023-07 baseline)
    }

    planned.push({
      claimId: claim.id,
      inn: claim.inn,
      medicineId,
      url,
      year: page.firstAddedYear,
      trs: page.firstAddedTrs,
      metadata: {
        ...claim.metadata,
        eml_medicine_url: url,
        eml_first_added_trs: page.firstAddedTrs,
        eml_dated_by: DATED_BY,
      } as Prisma.InputJsonObject,
    });
  }

  counts.planned = planned.length;

  // Full planned list to disk — the review gate reads THIS (console shows a
  // 15-row sample; the reviewer audits the file + cached eEML HTML).
  fs.mkdirSync(path.dirname(PLANNED_PATH), { recursive: true });
  fs.writeFileSync(PLANNED_PATH, planned.map((p) => JSON.stringify(p)).join("\n") + (planned.length ? "\n" : ""));
  console.log(`\nPlanned writes (${planned.length}) → ${PLANNED_PATH}`);

  console.log(`\n── First 15 planned writes (sample-review gate) ──`);
  for (const p of planned.slice(0, 15))
    console.log(`  · ${p.year}-01-01  ${p.inn}  [${p.trs ?? "no-TRS"}]  medicine=${p.medicineId}  claim=${p.claimId}`);

  if (EXECUTE) {
    console.log(`\nWriting ${planned.length} dates (null-guarded updateMany; heartbeat every 25)…`);
    let written = 0;
    for (const p of planned) {
      const res = await prisma.claim.updateMany({
        where: { id: p.claimId, claimEmergedAt: null }, // race-safe null guard
        data: {
          claimEmergedAt: new Date(`${p.year}-01-01T00:00:00Z`),
          claimEmergedPrecision: "YEAR",
          metadata: p.metadata,
        },
      });
      if (res.count === 1) counts.updated++;
      else counts.skippedRace++;
      written++;
      if (written % 25 === 0)
        console.log(`  … ${written}/${planned.length} written (${counts.updated} updated, ${counts.skippedRace} race-skipped)`);
    }
  }

  // Stage-2 removal candidates → disk + CHECKPOINT.
  fs.mkdirSync(path.dirname(REMOVALS_PATH), { recursive: true });
  fs.writeFileSync(REMOVALS_PATH, removals.map((r) => JSON.stringify(r)).join("\n") + (removals.length ? "\n" : ""));

  fs.mkdirSync(path.dirname(RESIDUE_PATH), { recursive: true });
  fs.writeFileSync(RESIDUE_PATH, residue.map((r) => JSON.stringify(r)).join("\n") + (residue.length ? "\n" : ""));

  console.log(`\n── Summary ──`);
  console.log(counts);
  console.log(`Residue (${residue.length}) → ${RESIDUE_PATH}`);

  console.log(`\n══ CHECKPOINT — Stage 2 whole-medicine removal candidates ══`);
  console.log(`Removal candidates: ${removals.length} → ${REMOVALS_PATH}`);
  if (removals.length) {
    for (const r of removals.slice(0, 15))
      console.log(`  ! ${r.inn}  removed ${r.removedYear ?? "?"}  [${r.trs ?? "no-TRS"}]  claim=${r.claimId}  ${r.url}`);
    console.log(
      `\nThese medicines are ABSENT from the eEML active list. eEML removals are per-INDICATION,\n` +
      `so each MUST be eyeballed against its page + TRS before any REVERSED transition is emitted.\n` +
      `This script does NOT emit transitions. Do not auto-promote these.`,
    );
  } else {
    console.log(`  (none — all matched corpus medicines are still on the active eEML list)`);
  }

  if (!EXECUTE) {
    console.log(`\nPreflight only. Review the sample + removal candidates above (STOP gate), then re-run with --execute.`);
  } else {
    console.log(`\nNext: Layer-1 baselines the newly dated claims (ingest-auto-trajectories --pipeline ${PIPELINE}).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
