/**
 * ofac-delistings.ts — Tier-1 transition-event pipeline (briefing 16, queue Q1
 * of briefing 18).
 *
 * Event feed: OFAC "Recent Actions" removal notices
 * (https://ofac.treasury.gov/recent-actions/YYYYMMDD[_NN]). Each notice carries
 * a Release Date (DAY precision) and, when it removes SDN entries, the literal
 * body heading "The following deletions have been made to OFAC's SDN List"
 * followed by SDN-format entity blocks.
 *
 * Join: ofac_sdn_v1 claims (one per SDN entry, keyed ofac_sdn_<uid>) are
 * BORN_RECORDED — Layer-1 gave each a null→RECORDED baseline @ INSTITUTIONAL
 * (ingest-auto-trajectories.ts). For each deletion entry matched to an
 * existing claim, this appends the reversal half of the arc:
 *
 *     RECORDED → REVERSED   @ notice release date (DAY)   community INSTITUTIONAL
 *
 * marker source = the Recent Actions notice itself (primary).
 *
 * STRUCTURAL CAVEAT (probe memo C2, logs/ofac-feed-probe-2026-07-10.md): the
 * ingest was an ACTIVE-list snapshot, so entities delisted before the snapshot
 * never got claims and this pipeline creates none — pre-snapshot notices are
 * residue by construction. The enumerator therefore walks the (newest-first)
 * removals search and STOPS at the snapshot date (default: min(createdAt) of
 * ofac_sdn_v1 claims; override with --since).
 *
 * Match strategy (exact-first, conservative; preflight prints method):
 *   1. exact claim-text match on "<name> (OFAC SDN)" (ingest embeds the full
 *      name in that exact frame) — individuals are matched on the
 *      "First Last" reconstruction of the notice's "LAST, First" form;
 *   2. exact alias hit in metadata.aliases (bind-parameterized jsonb query);
 *   3. normalized compare (uppercase, punctuation/whitespace collapsed)
 *      against candidates sharing a distinctive token;
 *   4. none/ambiguous → residue JSONL (never guessed). No loose fuzzy.
 * Claims whose terminal axis isn't RECORDED are skipped into residue —
 * editorial owns already-curved claims.
 *
 * PREFLIGHT/DRY-RUN BY DEFAULT. Writes only with --execute. Idempotent via
 * deterministic ids + the (claimId, toAxis, occurredAt) unique constraint —
 * safe to re-run; the weekly accrual cron relies on this. All row writes go
 * through lib/transition-contract.emitTransition (URL-verified).
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/ofac-delistings.ts
 *   ... --limit 25                    first N deletion entries (pilot)
 *   ... --since 2026-06-04            override the snapshot cutoff (YYYY-MM-DD)
 *   ... --notice 20260629             process a single notice id (debugging)
 *   ... --max-pages 42                enumerator page cap (default 42)
 *   ... --execute                     write (after reviewing preflight!)
 *
 * After --execute:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts \
 *     --pipeline ofac_sdn_v1
 */

import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { parseHTML } from "linkedom";
import * as fs from "fs";
import * as path from "path";
import {
  emitTransition,
  isoDay,
  BROWSERISH_HEADERS,
  type TransitionSpec,
} from "../../lib/transition-contract";

const prisma = new PrismaClient();

const PIPELINE = "ofac_sdn_v1";
const EVENT_PIPELINE = "event:ofac_delistings_v1";
const BASE = "https://ofac.treasury.gov";
const SEARCH_PATH = "/recent-actions/sanctions-list-updates?search_api_fulltext=removals";
const FETCH_DELAY_MS = 300;

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const EXECUTE = process.argv.includes("--execute");
const LIMIT = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : null;
const SINCE_ARG = argValue("--since");
const SINGLE_NOTICE = argValue("--notice");
const MAX_PAGES = argValue("--max-pages") ? parseInt(argValue("--max-pages")!, 10) : 42;
const RESIDUE_PATH = argValue("--residue-path")
  ?? path.join(__dirname, "../../logs/ofac-delistings-residue.jsonl");
const STATE_PATH = path.join(__dirname, "../../logs/ofac-delistings-last-run.json");

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

// ── Enumerator ────────────────────────────────────────────────────────────────

interface NoticeRef {
  id: string;        // "20260629" or "20260520_33"
  url: string;
  date: string;      // "YYYY-MM-DD" from the id — matches the Release Date
}

function noticeIdToDate(id: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:_\d+)?$/.exec(id);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return isNaN(d.getTime()) || isoDay(d) !== iso ? null : iso;
}

/** Walk the newest-first removals search; stop once a page is entirely older
 *  than `sinceIso` (pre-snapshot notices are residue by construction, C2). */
async function enumerateNotices(
  sinceIso: string,
  residue: object[],
): Promise<NoticeRef[]> {
  const notices = new Map<string, NoticeRef>();
  let preSnapshotSeen = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${BASE}${SEARCH_PATH}&page=${page}`;
    const html = await fetchHtml(url);
    const { document } = parseHTML(html);

    const anchors = Array.from(document.querySelectorAll("a"))
      .map((a) => a.getAttribute("href") ?? "")
      .map((h) => /\/recent-actions\/(\d{8}(?:_\d+)?)\b/.exec(h))
      .filter((m): m is RegExpExecArray => m !== null);

    if (anchors.length === 0) {
      if (page === 0)
        throw new Error(
          "enumerator parsed 0 notice links on page 0 — page structure changed? FAIL-CLOSED, nothing written",
        );
      break; // ran off the end of the pagination
    }

    let pageHasCurrent = false;
    for (const m of anchors) {
      const id = m[1];
      const date = noticeIdToDate(id);
      if (!date) {
        residue.push({ kind: "undatable-notice-id", id });
        continue;
      }
      if (date < sinceIso) {
        preSnapshotSeen++;
        continue;
      }
      pageHasCurrent = true;
      if (!notices.has(id)) notices.set(id, { id, url: `${BASE}/recent-actions/${id}`, date });
    }

    // Newest-first: once a whole page is pre-snapshot, everything after is too.
    if (!pageHasCurrent) break;
    await sleep(FETCH_DELAY_MS);
  }

  if (preSnapshotSeen > 0)
    residue.push({
      kind: "pre-snapshot-notices",
      count: preSnapshotSeen,
      note: `notices dated before ${sinceIso} are residue by construction (active-snapshot corpus, probe memo C2) — not fetched`,
    });

  // Oldest first, so a partial run + re-run converges forward.
  return [...notices.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ── Notice parsing ────────────────────────────────────────────────────────────

interface DeletionEntry {
  raw: string;            // full SDN-format block
  primaryName: string;    // as printed ("AYDIN, Recep Cetin" / "MEGASAN ...")
  matchNames: string[];   // candidate names to match against the DB
  individual: boolean;
  programs: string[];     // ["RUSSIA-EO14024"]
}

const DELETIONS_HEADING = /following deletions have been made to OFAC['’]s SDN List/i;

/** "LAST, First Middle" → "First Middle LAST" (the ingest's fullName frame). */
function reconstructIndividual(name: string): string | null {
  const m = /^([^,]+),\s*(.+)$/.exec(name);
  return m ? `${m[2].trim()} ${m[1].trim()}` : null;
}

function parseDeletionBlock(raw: string): DeletionEntry | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const individual = /\(individual\)/i.test(text);
  // Program tags: usually ALL-CAPS ([RUSSIA-EO14024], [SDGT]) but a few carry
  // digits/mixed case ([561-Related]) — require a leading capital/digit only.
  const programs = [...text.matchAll(/\[([A-Z0-9][A-Za-z0-9-]*)\]/g)].map((m) => m[1]);
  // Program tag is what distinguishes an SDN entry block from stray prose.
  if (programs.length === 0) return null;

  // a.k.a. list (inside the parenthetical after the primary name).
  const akas = [...text.matchAll(/a\.k\.a\.\s+([^;)]+)[;)]/g)]
    .map((m) => m[1].replace(/["“”]/g, "").trim())
    .filter(Boolean);

  let primaryName: string;
  const beforeParen = text.split(/\s+\(a\.k\.a\./)[0];
  if (individual) {
    // "LAST, First Middle, City, Country; DOB ..." → first two comma fields.
    const fields = beforeParen.split(",").map((s) => s.trim());
    primaryName = fields.length >= 2 ? `${fields[0]}, ${fields[1]}` : fields[0];
  } else {
    primaryName = beforeParen.split(",")[0].trim();
  }
  if (!primaryName) return null;

  const matchNames = [primaryName, ...akas];
  if (individual) {
    const rebuilt = reconstructIndividual(primaryName);
    if (rebuilt) matchNames.unshift(rebuilt); // ingest frame first — best exact hit
  }

  return { raw: text, primaryName, matchNames, individual, programs };
}

interface ParsedNotice {
  ref: NoticeRef;
  title: string;
  entries: DeletionEntry[];
  hadDeletionsHeading: boolean;
}

/** Text lines of a block element, split on <br> boundaries. linkedom's
 *  textContent drops <br> entirely, which would concatenate <br>-separated
 *  SDN entries into one undelimited string — so walk child nodes instead. */
function blockLines(el: Element): string[] {
  const lines: string[] = [];
  let cur = "";
  const walk = (n: Node) => {
    for (const child of Array.from(n.childNodes)) {
      if (child.nodeType === 1 && (child as Element).tagName === "BR") {
        lines.push(cur);
        cur = "";
      } else if (child.nodeType === 3) {
        cur += child.textContent ?? "";
      } else if (child.nodeType === 1) {
        walk(child);
      }
    }
  };
  walk(el);
  lines.push(cur);
  return lines.map((l) => l.trim()).filter(Boolean);
}

async function parseNotice(ref: NoticeRef): Promise<ParsedNotice> {
  const html = await fetchHtml(ref.url);
  const { document } = parseHTML(html);
  const title = document.querySelector("h1")?.textContent?.trim() ?? ref.id;

  const entries: DeletionEntry[] = [];
  let hadDeletionsHeading = false;

  // The deletions section = heading matching DELETIONS_HEADING, then sibling
  // blocks until the next heading (h1–h6). Drupal renders entries as <p>
  // (sometimes one <p> holding several entries separated by <br>).
  // Dedupe on the block-level container so a <p> and its inner <strong>
  // matching the same heading text don't walk the section twice.
  const containers = new Set<Element>();
  for (const el of Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,strong"))) {
    if (!DELETIONS_HEADING.test(el.textContent ?? "")) continue;
    containers.add(/^H[1-6]$/.test(el.tagName) ? el : el.closest("p,h1,h2,h3,h4,h5,h6") ?? el);
  }

  for (const heading of containers) {
    hadDeletionsHeading = true;
    // Walk forward from the heading's own block-level container.
    let node: Element = heading;
    while (node.nextElementSibling) {
      node = node.nextElementSibling;
      if (/^H[1-6]$/.test(node.tagName)) break; // next section
      const blockText = node.textContent ?? "";
      if (/following (additions|deletions|changes)/i.test(blockText) && !DELETIONS_HEADING.test(blockText)) break;
      for (const line of blockLines(node)) {
        const entry = parseDeletionBlock(line);
        if (entry) entries.push(entry);
      }
    }
  }

  return { ref, title, entries, hadDeletionsHeading };
}

// ── DB matching ───────────────────────────────────────────────────────────────

interface ClaimHit {
  id: string;
  text: string;
  uid: number | null;
  terminalAxis: string | null;
  method: "text-exact" | "alias-exact" | "normalized";
}

function normalizeName(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const claimSelect = {
  id: true,
  text: true,
  metadata: true,
  statusHistory: {
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 1,
    select: { toAxis: true },
  },
} satisfies Prisma.ClaimSelect;

type ClaimRow = {
  id: string;
  text: string;
  metadata: unknown;
  statusHistory: { toAxis: string }[];
};

function toHit(c: ClaimRow, method: ClaimHit["method"]): ClaimHit {
  const meta = (c.metadata ?? {}) as { uid?: number };
  return {
    id: c.id,
    text: c.text,
    uid: typeof meta.uid === "number" ? meta.uid : null,
    terminalAxis: c.statusHistory[0]?.toAxis ?? null,
    method,
  };
}

async function findSdnClaim(entry: DeletionEntry): Promise<ClaimHit | "ambiguous" | null> {
  // 1. Exact text frame "<name> (OFAC SDN)" — the ingest's buildClaimText shape.
  for (const name of entry.matchNames) {
    const rows = await prisma.claim.findMany({
      where: {
        deleted: false,
        ingestedBy: PIPELINE,
        text: { contains: `${name} (OFAC SDN)`, mode: "insensitive" },
      },
      select: claimSelect,
      take: 3,
    });
    if (rows.length === 1) return toHit(rows[0], "text-exact");
    if (rows.length > 1) return "ambiguous";
  }

  // 2. Exact alias hit in metadata.aliases (bind-parameterized jsonb).
  for (const name of entry.matchNames) {
    const ids = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Claim"
      WHERE "ingestedBy" = ${PIPELINE}
        AND deleted = false
        AND (metadata -> 'aliases') @> jsonb_build_array(${name}::text)
      LIMIT 3`;
    if (ids.length === 1) {
      const row = await prisma.claim.findUnique({ where: { id: ids[0].id }, select: claimSelect });
      if (row) return toHit(row, "alias-exact");
    }
    if (ids.length > 1) return "ambiguous";
  }

  // 3. Normalized compare against candidates sharing a distinctive token —
  //    conservative: unique normalized equality only, never similarity scores.
  const target = normalizeName(entry.matchNames[0]);
  const token = target.split(" ").filter((w) => w.length >= 5).sort((a, b) => b.length - a.length)[0];
  if (token) {
    const rows = await prisma.claim.findMany({
      where: { deleted: false, ingestedBy: PIPELINE, text: { contains: token, mode: "insensitive" } },
      select: claimSelect,
      take: 25,
    });
    const nameOf = (t: string) => {
      const m = /^[^:]+:\s*(.*?)\s*\(OFAC SDN\)/.exec(t);
      return m ? normalizeName(m[1]) : null;
    };
    const targets = new Set(entry.matchNames.map(normalizeName));
    const hits = rows.filter((r) => {
      const n = nameOf(r.text);
      return n !== null && targets.has(n);
    });
    const uniq = new Map(hits.map((h) => [h.id, h]));
    if (uniq.size === 1) return toHit([...uniq.values()][0], "normalized");
    if (uniq.size > 1) return "ambiguous";
  }

  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
}

async function resolveSince(): Promise<string> {
  if (SINCE_ARG) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(SINCE_ARG)) throw new Error(`--since must be YYYY-MM-DD, got "${SINCE_ARG}"`);
    return SINCE_ARG;
  }
  // Cron/state file: resume from the last processed notice date.
  if (fs.existsSync(STATE_PATH)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as { lastNoticeDate?: string };
      if (state.lastNoticeDate && /^\d{4}-\d{2}-\d{2}$/.test(state.lastNoticeDate)) {
        console.log(`Since: ${state.lastNoticeDate} (state file ${STATE_PATH})`);
        return state.lastNoticeDate;
      }
    } catch {
      /* unreadable state → fall through to the DB snapshot date */
    }
  }
  // Snapshot date = first ingest of the active SDN list (probe memo C2).
  const agg = await prisma.claim.aggregate({
    where: { ingestedBy: PIPELINE, deleted: false },
    _min: { createdAt: true },
  });
  if (!agg._min.createdAt)
    throw new Error(`no ${PIPELINE} claims in the DB — nothing to match against. FAIL-CLOSED`);
  const since = isoDay(agg._min.createdAt);
  console.log(`Since: ${since} (snapshot date = min(createdAt) on ${PIPELINE} claims)`);
  return since;
}

async function main() {
  console.log(
    `\n=== OFAC delistings pipeline — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (no writes)"}${LIMIT ? `, limit ${LIMIT}` : ""} ===\n`,
  );

  const residue: object[] = [];
  const sinceIso = await resolveSince();

  const noticeRefs = SINGLE_NOTICE
    ? [{ id: SINGLE_NOTICE, url: `${BASE}/recent-actions/${SINGLE_NOTICE}`, date: noticeIdToDate(SINGLE_NOTICE) ?? "" }]
    : await enumerateNotices(sinceIso, residue);
  if (SINGLE_NOTICE && !noticeRefs[0].date) throw new Error(`--notice "${SINGLE_NOTICE}" is not a YYYYMMDD[_NN] id`);
  console.log(`Notices in scope (≥ ${sinceIso}): ${noticeRefs.length}`);

  const counts = {
    planned: 0, inserted: 0, exists: 0, skipped: 0,
    entries: 0, matched: 0, unmatched: 0, ambiguous: 0, otherTerminal: 0, residue: 0,
  };
  let entriesProcessed = 0;
  let lastNoticeDate: string | null = null;
  const seenClaimIds = new Set<string>(); // dedupe aka cross-listings within a run

  outer: for (const ref of noticeRefs) {
    await sleep(FETCH_DELAY_MS);
    const notice = await parseNotice(ref);

    if (!notice.hadDeletionsHeading) {
      // Title matched the removals search, but no SDN deletions section (e.g.
      // non-SDN-list unblockings). Honest residue, not an error.
      residue.push({ kind: "no-deletions-section", notice: ref.id, title: notice.title, url: ref.url });
      counts.residue++;
      console.log(`  ~ residue (no deletions section): ${ref.id} "${notice.title}"`);
      continue;
    }
    if (notice.entries.length === 0) {
      // Heading present but 0 entries parsed — parser/page drift. FAIL-CLOSED:
      // record + stop rather than silently under-emitting on a cron.
      residue.push({ kind: "deletions-heading-but-zero-entries", notice: ref.id, url: ref.url });
      counts.residue++;
      console.error(`  ! ${ref.id}: deletions heading found but 0 entries parsed — page drift? Stopping (fail-closed).`);
      process.exitCode = 2;
      break;
    }

    console.log(`\n${ref.id} (${ref.date}) "${notice.title}" — ${notice.entries.length} deletion entries`);

    for (const entry of notice.entries) {
      if (LIMIT && entriesProcessed >= LIMIT) break outer;
      entriesProcessed++;
      counts.entries++;
      const label = `${entry.primaryName}${entry.individual ? " (individual)" : ""} [${entry.programs.join(", ")}]`;

      const match = await findSdnClaim(entry);
      if (match === null) {
        counts.unmatched++;
        counts.residue++;
        residue.push({ kind: "unmatched-entity", notice: ref.id, date: ref.date, entry: entry.primaryName, programs: entry.programs, raw: entry.raw.slice(0, 400) });
        console.log(`  ~ residue (no claim — pre-snapshot or never ingested): ${label}`);
        continue;
      }
      if (match === "ambiguous") {
        counts.ambiguous++;
        counts.residue++;
        residue.push({ kind: "ambiguous-match", notice: ref.id, date: ref.date, entry: entry.primaryName, programs: entry.programs });
        console.log(`  ~ residue (ambiguous match): ${label}`);
        continue;
      }
      counts.matched++;

      if (seenClaimIds.has(match.id)) {
        console.log(`  = duplicate in-notice listing (aka cross-post), claim already handled: ${label}`);
        continue;
      }
      seenClaimIds.add(match.id);

      if (match.terminalAxis !== "RECORDED") {
        counts.otherTerminal++;
        counts.residue++;
        residue.push({ kind: "terminal-axis-not-recorded", terminalAxis: match.terminalAxis, claimId: match.id, notice: ref.id, entry: entry.primaryName });
        console.log(`  ~ residue (terminal ${match.terminalAxis ?? "none"}): ${label}`);
        continue;
      }

      const programsPart = entry.programs.length ? ` under the ${entry.programs.join(", ")} program${entry.programs.length > 1 ? "s" : ""}` : "";
      const spec: TransitionSpec = {
        claimId: match.id,
        fromAxis: "RECORDED",
        toAxis: "REVERSED",
        community: "INSTITUTIONAL",
        occurredAt: ref.date, // DAY precision from the notice's release date
        reason:
          `Removed from OFAC's Specially Designated Nationals List${programsPart} per the OFAC ` +
          `Recent Actions notice "${notice.title}" of ${ref.date}, which lists ${entry.primaryName} ` +
          `under "The following deletions have been made to OFAC's SDN List." The delisting reverses ` +
          `the recorded designation${match.uid ? ` (SDN uid ${match.uid})` : ""}.`,
        source: {
          externalId: `src:ofac-delisting-${ref.id}-${slugify(entry.primaryName)}`,
          name: `OFAC Recent Actions ${ref.id} — ${notice.title} (deletion: ${entry.primaryName})`,
          url: ref.url,
          publishedAt: ref.date,
          methodologyType: "primary",
          ingestedBy: EVENT_PIPELINE,
        },
      };

      const result = await emitTransition(prisma, spec, { execute: EXECUTE });
      counts[result.action === "planned" ? "planned" : result.action]++;
      const flag = { inserted: "+", planned: "·", exists: "=", skipped: "✗" }[result.action];
      console.log(`  ${flag} ${result.action.padEnd(8)} RECORDED→REVERSED @ ${ref.date}  ${label}  [${match.method}]`);
      if (result.violations.length > 0) {
        for (const v of result.violations) console.log(`        ! ${v}`);
        residue.push({ kind: "contract-violation", claimId: match.id, notice: ref.id, entry: entry.primaryName, violations: result.violations });
      }
    }
    lastNoticeDate = ref.date;
  }

  fs.mkdirSync(path.dirname(RESIDUE_PATH), { recursive: true });
  fs.writeFileSync(RESIDUE_PATH, residue.map((r) => JSON.stringify(r)).join("\n") + (residue.length ? "\n" : ""));

  // Match-rate census (briefing 16 CHECKPOINT 2 trigger).
  const attempted = counts.matched + counts.unmatched + counts.ambiguous;
  const rate = attempted > 0 ? Math.round((100 * counts.matched) / attempted) : null;

  console.log(`\n── Summary ──`);
  console.log(counts);
  if (rate !== null) {
    console.log(`Match rate: ${counts.matched}/${attempted} = ${rate}%`);
    if (rate < 70)
      console.log(`!! CHECKPOINT 2 (briefing 16): match rate <70% — STOP, memo the unmatched samples before any --execute.`);
  }
  console.log(`Residue (${residue.length}) → ${RESIDUE_PATH}`);

  if (!EXECUTE) {
    console.log(`\nPreflight only. Review the plan above, then re-run with --execute.`);
  } else {
    // State file: the weekly accrual cron resumes from here (idempotent ids
    // make the ≥/> boundary harmless — a re-processed notice hits "exists").
    if (lastNoticeDate && process.exitCode !== 2)
      fs.writeFileSync(STATE_PATH, JSON.stringify({ lastNoticeDate, ranAt: new Date().toISOString() }, null, 2));
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
