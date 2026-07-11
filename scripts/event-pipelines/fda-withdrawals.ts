/**
 * fda-withdrawals.ts — Tier-1 transition-event pipeline (briefing 13 Phase B /
 * briefing 18 Q2; probe memo logs/fda-withdrawals-probe-2026-07-10.md).
 *
 * Event feed: Federal Register FDA notices "…Withdrawal of Approval of …
 * (Abbreviated) New Drug Application(s)…". Enumerated via the FR JSON API,
 * parsed from each document's full-text XML. Every notice carries a
 * publication date AND a legal effective date ("Approval is withdrawn as of
 * August 5, 2026") plus the CFR ground for withdrawal.
 *
 * DECISIONS IN FORCE (Robert 2026-07-10, briefing 18 §2 — do not relitigate):
 *   - §314.150(c) "no longer marketed" (voluntary commercial withdrawal,
 *     "without prejudice to refiling") emits NO transition — the approval's
 *     evidentiary judgment stands. Counted + sampled to residue for the
 *     record, never written.
 *   - Safety/efficacy grounds — §314.150(a)/(b)/(d), §314.151, accelerated-
 *     approval withdrawals under FD&C 506(c) — emit SETTLED→REVERSED.
 *   - occurredAt = the EFFECTIVE date (DAY precision), not publication.
 *   - Never emit a future-dated transition: notices whose effective date is
 *     still ahead are HELD (counted; a later run emits them — state-file
 *     accrual makes this automatic).
 *
 * Join: drugsatfda_v1 claims are BORN_SETTLED (Layer-1: null→SETTLED @ ORIG
 * approval date, INSTITUTIONAL); one claim per PRODUCT, application number in
 * metadata.applNo. A withdrawal notice names its applications ("NDA 021579",
 * ANDA batches) and legally withdraws each ENTIRE application — so the
 * reversal is emitted on every product claim of each named application.
 * Number-match only; no name matching anywhere.
 *
 * Ground classification is conservative: a notice whose ground can't be
 * classified from its text goes to residue (kind unclassified-ground) for a
 * human call — never guessed. Same for missing effective dates. Animal-drug
 * notices and "; Correction" notices are excluded/residued.
 *
 * PREFLIGHT/DRY-RUN BY DEFAULT. Writes only with --execute. Idempotent via
 * deterministic ids + the (claimId, toAxis, occurredAt) unique constraint.
 * All row writes go through lib/transition-contract.emitTransition.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/fda-withdrawals.ts
 *   ... --limit 25                 first N notices (pilot; oldest first)
 *   ... --since 1994-01-01         override the enumeration start date
 *   ... --execute                  write (after CHECKPOINT 1 review!)
 *
 * After --execute:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts \
 *     --pipeline drugsatfda_v1
 */

import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import {
  emitTransition,
  type TransitionSpec,
} from "../../lib/transition-contract";

const prisma = new PrismaClient();

const PIPELINE = "drugsatfda_v1";
const EVENT_PIPELINE = "event:fda_withdrawals_v1";
const FR_API = "https://www.federalregister.gov/api/v1/documents.json";
const FETCH_DELAY_MS = 250;
const CACHE_DIR = path.join(__dirname, "../../logs/fr-withdrawal-cache");

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const EXECUTE = process.argv.includes("--execute");
const LIMIT = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : null;
const SINCE_ARG = argValue("--since");
const RESIDUE_PATH = argValue("--residue-path")
  ?? path.join(__dirname, "../../logs/fda-withdrawals-residue.jsonl");
const STATE_PATH = path.join(__dirname, "../../logs/fda-withdrawals-last-run.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    return await fetch(url, {
      headers: { Accept: accept, "User-Agent": "epistemic-receipts/1.0 (fda-withdrawals pipeline)" },
      redirect: "follow",
      signal: ctl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── FR enumeration (JSON API) ─────────────────────────────────────────────────

interface FrDoc {
  document_number: string;
  title: string;
  publication_date: string;   // YYYY-MM-DD
  html_url: string;
  full_text_xml_url: string | null;
}

const TITLE_INCLUDE = /withdrawal of approval/i;
const TITLE_DRUG = /(abbreviated )?new drug application/i;
const TITLE_EXCLUDE_ANIMAL = /animal/i;
const TITLE_CORRECTION = /;\s*correction/i;

async function enumerateFrDocs(sinceIso: string): Promise<FrDoc[]> {
  const docs: FrDoc[] = [];
  let page = 1;
  for (;;) {
    const params = new URLSearchParams();
    params.append("conditions[term]", `"withdrawal of approval"`);
    params.append("conditions[agencies][]", "food-and-drug-administration");
    params.append("conditions[type][]", "NOTICE");
    params.append("conditions[publication_date][gte]", sinceIso);
    params.append("order", "oldest");
    params.append("per_page", "100");
    params.append("page", String(page));
    for (const f of ["document_number", "title", "publication_date", "html_url", "full_text_xml_url"])
      params.append("fields[]", f);

    const res = await fetchWithTimeout(`${FR_API}?${params.toString()}`, "application/json");
    if (!res.ok) throw new Error(`FR API HTTP ${res.status} on page ${page} — FAIL-CLOSED, nothing written`);
    const body = (await res.json()) as { results?: FrDoc[]; total_pages?: number };
    const results = body.results ?? [];
    docs.push(...results);
    if (!body.total_pages || page >= body.total_pages || results.length === 0) break;
    page++;
    await sleep(FETCH_DELAY_MS);
  }
  return docs;
}

// ── Notice parsing (full-text XML, regex-level — no DOM needed) ──────────────

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function parseLongDate(s: string): string | null {
  let m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(s);
  if (m) {
    const mm = MONTHS[m[1].toLowerCase()];
    if (!mm) return null;
    return `${m[3]}-${mm}-${String(Number(m[2])).padStart(2, "0")}`;
  }
  // "Month Year" (no day) — rare, but occurs in the corpus. Yields MONTH
  // precision (parseFlexibleDate infers this from the "YYYY-MM" shape).
  m = /([A-Za-z]+)\s+(\d{4})/.exec(s);
  if (m) {
    const mm = MONTHS[m[1].toLowerCase()];
    if (!mm) return null;
    return `${m[2]}-${mm}`;
  }
  return null;
}

// Lead-in phrasings observed in the DATES: field, most-specific first so a
// generic "applicable"/"effective" doesn't pre-empt a longer, more precise
// match at the same position.
const DATE_RE = "[A-Za-z]+\\s+\\d{1,2},\\s*\\d{4}|[A-Za-z]+\\s+\\d{4}";
const EFFECTIVE_DATE_PATTERNS: RegExp[] = [
  new RegExp(`withdrawn as of\\s+(${DATE_RE})`, "i"),
  new RegExp(`withdrawal of approval is applicable\\s+(${DATE_RE})`, "i"),
  new RegExp(`the effective date is\\s+(${DATE_RE})`, "i"),
  new RegExp(`\\beffective\\s+(${DATE_RE})`, "i"),
  new RegExp(`\\bapplicable\\s+(${DATE_RE})`, "i"),
];

/** Scope date extraction to the DATES: field only — never the whole notice. */
function extractEffectiveDate(plain: string): string | null {
  const datesMatch =
    /\bDATES:\s*(.*?)\s*(?:ADDRESSES:|FOR FURTHER INFORMATION CONTACT:|SUPPLEMENTARY INFORMATION:|EFFECTIVE DATE:|$)/i.exec(
      plain,
    );
  const section = datesMatch ? datesMatch[1] : plain;
  for (const re of EFFECTIVE_DATE_PATTERNS) {
    const m = re.exec(section);
    if (m) return parseLongDate(m[1]);
  }
  return null;
}

type Ground = "commercial-c" | "safety-efficacy" | "unclassified";

interface ParsedNotice {
  effectiveDate: string | null;   // "YYYY-MM-DD"
  ground: Ground;
  groundCite: string;             // what we matched, for the receipt
  applNos: string[];              // zero-padded 6-digit, deduped
}

function classifyGround(text: string): { ground: Ground; cite: string } {
  const hasC = /314\.150\s*\(c\)/.test(text);
  const hasSafety =
    /314\.150\s*\((a|b|d)\)/.exec(text)?.[0] ??
    (/314\.151/.test(text) ? "314.151" : null) ??
    (/506\s*\(c\)/.test(text) && /accelerated approval/i.test(text) ? "506(c) accelerated approval" : null);
  // A notice can cite (c) for some applications and (d) for others in
  // combined documents — treat any safety cite as safety (the rarer, higher-
  // value class); pure-(c) documents are the overwhelming majority.
  if (hasSafety) return { ground: "safety-efficacy", cite: hasSafety };
  if (hasC) return { ground: "commercial-c", cite: "21 CFR 314.150(c)" };
  return { ground: "unclassified", cite: "" };
}

function parseNoticeXml(xml: string): ParsedNotice {
  const plain = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // DATES section: "Approval is withdrawn as of August 5, 2026." / "Effective
  // April 6, 2005." / "The effective date is April 18, 2016." / "Withdrawal
  // of approval is applicable December 23, 2020." / "Applicable ...".
  const effectiveDate = extractEffectiveDate(plain);

  const { ground, cite } = classifyGround(plain);

  const applNos = [...new Set(
    [...plain.matchAll(/\b(?:A?NDA)\s+(\d{5,6})\b/g)].map((m) => m[1].padStart(6, "0")),
  )];

  return { effectiveDate, ground, groundCite: cite, applNos };
}

async function fetchNoticeXmlCached(doc: FrDoc): Promise<string | null> {
  if (!doc.full_text_xml_url) return null;
  const cachePath = path.join(CACHE_DIR, `${doc.document_number}.xml`);
  if (fs.existsSync(cachePath)) return fs.readFileSync(cachePath, "utf8");
  const res = await fetchWithTimeout(doc.full_text_xml_url, "application/xml, text/xml, */*");
  if (!res.ok) return null;
  const xml = await res.text();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath, xml);
  await sleep(FETCH_DELAY_MS);
  return xml;
}

// ── DB matching (application number only) ─────────────────────────────────────

interface ProductClaim {
  id: string;
  text: string;
  terminalAxis: string | null;
}

async function claimsForApplNo(applNo: string): Promise<ProductClaim[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Claim"
    WHERE "ingestedBy" = ${PIPELINE}
      AND deleted = false
      AND metadata ->> 'applNo' = ${applNo}`;
  if (rows.length === 0) return [];
  const claims = await prisma.claim.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    select: {
      id: true,
      text: true,
      statusHistory: {
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { toAxis: true },
      },
    } satisfies Prisma.ClaimSelect,
  });
  return claims.map((c) => ({
    id: c.id,
    text: c.text,
    terminalAxis: c.statusHistory[0]?.toAxis ?? null,
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function resolveSince(): Promise<string> {
  if (SINCE_ARG) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(SINCE_ARG)) throw new Error(`--since must be YYYY-MM-DD, got "${SINCE_ARG}"`);
    return SINCE_ARG;
  }
  if (fs.existsSync(STATE_PATH)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as { lastPublicationDate?: string };
      if (state.lastPublicationDate && /^\d{4}-\d{2}-\d{2}$/.test(state.lastPublicationDate)) {
        console.log(`Since: ${state.lastPublicationDate} (state file)`);
        return state.lastPublicationDate;
      }
    } catch { /* fall through */ }
  }
  // FR online coverage starts 1994; drugsatfda approvals go back decades, so
  // walk the full FR history by default on the first run.
  console.log(`Since: 1994-01-01 (FR online coverage start — first full walk)`);
  return "1994-01-01";
}

async function main() {
  console.log(
    `\n=== FDA withdrawals pipeline — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (no writes)"}${LIMIT ? `, limit ${LIMIT} notices` : ""} ===\n`,
  );

  const residue: object[] = [];
  const sinceIso = await resolveSince();
  const today = todayIso();

  let docs = await enumerateFrDocs(sinceIso);
  // Title filtering: human-drug withdrawal notices only.
  const excluded = { notDrug: 0, animal: 0, correction: 0 };
  docs = docs.filter((d) => {
    if (!TITLE_INCLUDE.test(d.title)) { excluded.notDrug++; return false; }
    if (!TITLE_DRUG.test(d.title)) { excluded.notDrug++; return false; }
    if (TITLE_EXCLUDE_ANIMAL.test(d.title)) { excluded.animal++; return false; }
    if (TITLE_CORRECTION.test(d.title)) {
      excluded.correction++;
      residue.push({ kind: "correction-notice", doc: d.document_number, title: d.title, url: d.html_url });
      return false;
    }
    return true;
  });
  console.log(`FR documents in scope: ${docs.length} (excluded: ${excluded.notDrug} non-drug-title, ${excluded.animal} animal, ${excluded.correction} corrections)`);
  if (LIMIT) docs = docs.slice(0, LIMIT);

  const counts = {
    notices: 0, commercialC: 0, safety: 0, unclassified: 0,
    applications: 0, applMatched: 0, applUnmatched: 0, productClaims: 0,
    heldFuture: 0, otherTerminal: 0,
    planned: 0, inserted: 0, exists: 0, skipped: 0, residue: 0,
  };
  let lastPublicationDate: string | null = null;

  for (const doc of docs) {
    if (LIMIT && counts.notices >= LIMIT) break;
    counts.notices++;

    const xml = await fetchNoticeXmlCached(doc);
    if (!xml) {
      residue.push({ kind: "no-full-text-xml", doc: doc.document_number, url: doc.html_url });
      counts.residue++;
      continue;
    }
    const parsed = parseNoticeXml(xml);

    if (parsed.ground === "commercial-c") {
      // Decision in force: §314.150(c) emits NOTHING. Sample to residue.
      counts.commercialC++;
      if (counts.commercialC <= 100)
        residue.push({ kind: "commercial-314.150c-skipped-by-decision", doc: doc.document_number, title: doc.title, applNos: parsed.applNos.length });
      continue;
    }
    if (parsed.ground === "unclassified") {
      counts.unclassified++;
      counts.residue++;
      residue.push({ kind: "unclassified-ground", doc: doc.document_number, title: doc.title, url: doc.html_url });
      console.log(`  ~ residue (unclassified ground): ${doc.document_number} "${doc.title.slice(0, 90)}"`);
      continue;
    }

    // safety-efficacy from here.
    counts.safety++;
    if (!parsed.effectiveDate) {
      counts.residue++;
      residue.push({ kind: "no-effective-date", doc: doc.document_number, title: doc.title, url: doc.html_url });
      console.log(`  ~ residue (no effective date): ${doc.document_number}`);
      continue;
    }
    if (parsed.effectiveDate > today) {
      counts.heldFuture++;
      console.log(`  ≫ held (effective ${parsed.effectiveDate} is in the future): ${doc.document_number} "${doc.title.slice(0, 70)}"`);
      // Do NOT advance the state file past a held notice: cap below.
      continue;
    }
    if (parsed.applNos.length === 0) {
      counts.residue++;
      residue.push({ kind: "no-application-numbers", doc: doc.document_number, title: doc.title, url: doc.html_url });
      continue;
    }

    console.log(`\n${doc.document_number} (${doc.publication_date}, effective ${parsed.effectiveDate}) [${parsed.groundCite}] "${doc.title.slice(0, 90)}"`);

    for (const applNo of parsed.applNos) {
      counts.applications++;
      const products = await claimsForApplNo(applNo);
      if (products.length === 0) {
        counts.applUnmatched++;
        residue.push({ kind: "application-not-in-corpus", applNo, doc: doc.document_number, date: parsed.effectiveDate });
        console.log(`  ~ residue (applNo ${applNo} not in corpus)`);
        continue;
      }
      counts.applMatched++;

      for (const product of products) {
        counts.productClaims++;
        if (product.terminalAxis !== "SETTLED" && product.terminalAxis !== "REVERSED") {
          counts.otherTerminal++;
          counts.residue++;
          residue.push({ kind: "terminal-axis-not-settled", terminalAxis: product.terminalAxis, claimId: product.id, applNo, doc: doc.document_number });
          console.log(`  ~ residue (terminal ${product.terminalAxis ?? "none"}): applNo ${applNo} claim=${product.id}`);
          continue;
        }

        const spec: TransitionSpec = {
          claimId: product.id,
          fromAxis: "SETTLED",
          toAxis: "REVERSED",
          community: "INSTITUTIONAL",
          occurredAt: parsed.effectiveDate,
          reason:
            `FDA withdrew approval of application ${applNo} effective ${parsed.effectiveDate}, per the Federal ` +
            `Register notice "${doc.title}" (${doc.document_number}, published ${doc.publication_date}), on ` +
            `safety/efficacy grounds (${parsed.groundCite}). The withdrawal reverses the approval this claim records.`,
          source: {
            externalId: `src:fda-withdrawal-${doc.document_number}-${applNo}`,
            name: `Federal Register ${doc.document_number} — ${doc.title.slice(0, 140)} (application ${applNo})`,
            url: doc.html_url,
            publishedAt: doc.publication_date,
            methodologyType: "primary",
            ingestedBy: EVENT_PIPELINE,
          },
        };

        const result = await emitTransition(prisma, spec, { execute: EXECUTE });
        counts[result.action === "planned" ? "planned" : result.action]++;
        const flag = { inserted: "+", planned: "·", exists: "=", skipped: "✗" }[result.action];
        console.log(`  ${flag} ${result.action.padEnd(8)} SETTLED→REVERSED @ ${parsed.effectiveDate}  applNo=${applNo}  claim=${product.id}`);
        if (result.violations.length > 0) {
          for (const v of result.violations) console.log(`        ! ${v}`);
          residue.push({ kind: "contract-violation", claimId: product.id, applNo, doc: doc.document_number, violations: result.violations });
        }
      }
    }
    // State only advances past FULLY handled notices; a held-future notice
    // above `continue`d before this line, so re-runs revisit it.
    lastPublicationDate = doc.publication_date;
  }

  fs.mkdirSync(path.dirname(RESIDUE_PATH), { recursive: true });
  fs.writeFileSync(RESIDUE_PATH, residue.map((r) => JSON.stringify(r)).join("\n") + (residue.length ? "\n" : ""));

  console.log(`\n── Summary ──`);
  console.log(counts);
  console.log(`Residue (${residue.length}) → ${RESIDUE_PATH}`);

  if (!EXECUTE) {
    console.log(`\nPreflight only. Review the plan above (CHECKPOINT 1), then re-run with --execute.`);
  } else {
    if (lastPublicationDate && counts.heldFuture === 0 && process.exitCode !== 2) {
      fs.writeFileSync(STATE_PATH, JSON.stringify({ lastPublicationDate, ranAt: new Date().toISOString() }, null, 2));
    } else if (counts.heldFuture > 0) {
      console.log(`(state file NOT advanced — ${counts.heldFuture} held-future notice(s) must be revisited)`);
    }
    console.log(
      `\nVerify: npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --pipeline ${PIPELINE}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
