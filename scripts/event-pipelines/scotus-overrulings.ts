/**
 * scotus-overrulings.ts — Tier-1 transition-event pipeline.
 *
 * Event feed: the Library of Congress Constitution Annotated "Table of Supreme
 * Court Decisions Overruled by Subsequent Decisions" (~300 entries; overruling
 * case + date, overruled case(s) + citations, loc.gov U.S. Reports PDFs).
 *
 * Join: courtlistener_scotus_v1 claims are BORN_SETTLED (null→SETTLED @ decision
 * date). For each overruled decision matched to an existing claim, this adds the
 * dormant second half of its arc:
 *
 *     SETTLED → REVERSED   @ overruling decision date   (full overruling)
 *     SETTLED → CONTESTED  @ overruling decision date   ("in part" — default;
 *                            override with --partial-as REVERSED)
 *
 * community JUDICIAL, receipt citing the overruling case, marker source
 * preferring the overruling opinion's own page (CourtListener via DB match,
 * else the table's opinion link), falling back to the table itself.
 *
 * Match strategy (preflight prints method + matched text for eyeballing):
 *   1. reporter citation ("505 U.S. 833") in a courtlistener_scotus_v1 Source
 *      name → its claim (precise);
 *   2. case name + decision year in courtlistener_scotus_v1 claim text;
 *   3. no/ambiguous match → residue JSONL for the law loop (never guessed).
 * Claims whose terminal axis isn't SETTLED (already curved by curation) are
 * skipped into the residue as well — editorial owns those.
 *
 * PREFLIGHT/DRY-RUN BY DEFAULT. Writes only with --execute. Idempotent via
 * deterministic ids + the (claimId, toAxis, occurredAt) unique constraint.
 * All row writes go through lib/transition-contract.emitTransition (URL-verified).
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/scotus-overrulings.ts
 *   ... --limit 20                      first N table rows (pilot)
 *   ... --execute                       write (after reviewing preflight!)
 *   ... --partial-as REVERSED           treat "in part" as full reversal
 *   ... --feed-file page.html           parse a browser-saved copy (Akamai
 *                                       sometimes 403s scripted fetches)
 *
 * After --execute:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts \
 *     --pipeline courtlistener_scotus_v1
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { parseHTML } from "linkedom";
import * as fs from "fs";
import * as path from "path";
import {
  emitTransition,
  verifyUrl,
  isoDay,
  BROWSERISH_HEADERS,
  type FactStatusT,
  type TransitionSpec,
} from "../../lib/transition-contract";

const prisma = new PrismaClient();

const TABLE_URL = "https://constitution.congress.gov/resources/decisions-overruled/";
const PIPELINE = "courtlistener_scotus_v1";

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const EXECUTE = process.argv.includes("--execute");
const LIMIT = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : null;
const PARTIAL_AS: FactStatusT = argValue("--partial-as") === "REVERSED" ? "REVERSED" : "CONTESTED";
const RESIDUE_PATH = argValue("--residue-path")
  ?? path.join(__dirname, "../../logs/scotus-overrulings-residue.jsonl");
// Offline fallback: constitution.congress.gov sits behind Akamai and may 403
// scripted fetches even with a browser UA. Save the page from your browser
// (File → Save Page As… , HTML only) and pass it here.
const FEED_FILE = argValue("--feed-file");

// ── Feed parsing ──────────────────────────────────────────────────────────────

interface CaseRef {
  name: string;
  citation: string | null;   // "505 U.S. 833"
  year: number | null;
  fullDate: string | null;   // "YYYY-MM-DD" when the table gives a day
  url: string | null;        // loc.gov PDF / cite.case.law when linked
  partial: boolean;          // "(in part)" qualifier
}

interface TableRow {
  seq: number;
  overruling: CaseRef;
  overruled: CaseRef[];
}

const MONTHS: Record<string, string> = {
  "jan.": "01", january: "01", "feb.": "02", february: "02", "mar.": "03", march: "03",
  "apr.": "04", april: "04", may: "05", june: "06", july: "07", "aug.": "08", august: "08",
  "sept.": "09", september: "09", "oct.": "10", october: "10", "nov.": "11", november: "11",
  "dec.": "12", december: "12",
};

function parseCaseFragment(fragment: string, href: string | null): CaseRef | null {
  const text = fragment.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const partial = /\bin part\b/i.test(text);
  const citation = /(\d{1,3})\s+U\.?\s*S\.?\s+(\d{1,4})/.exec(text);
  const citationStr = citation ? `${citation[1]} U.S. ${citation[2]}` : null;

  // "(U.S. June 24, 2022)" slip-opinion style → DAY precision
  let fullDate: string | null = null;
  const slip = /\(U\.S\.\s+([A-Za-z.]+)\s+(\d{1,2}),\s+(\d{4})\)/.exec(text);
  if (slip) {
    const mm = MONTHS[slip[1].toLowerCase()];
    if (mm) fullDate = `${slip[3]}-${mm}-${String(Number(slip[2])).padStart(2, "0")}`;
  }

  const yearMatch = /\((?:U\.S\. [^)]*?)?(\d{4})\)/.exec(text) ?? /\b(1[789]\d{2}|20\d{2})\b(?!.*\b(?:1[789]\d{2}|20\d{2})\b)/.exec(text);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  // Name = everything before the first comma-then-citation/docket marker.
  const name = text
    .split(/,\s*(?=\d{1,3}\s+U\.?\s*S\.?|No\.\s*\d)/)[0]
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,;]$/, "");
  if (!name || !/\sv\.?\s|\bIn re\b|\bEx parte\b/i.test(name)) return null;

  return { name, citation: citationStr, year, fullDate, url: href, partial };
}

async function loadFeedHtml(): Promise<string> {
  if (FEED_FILE) {
    console.log(`Reading feed from file: ${FEED_FILE}`);
    return fs.readFileSync(FEED_FILE, "utf8");
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(TABLE_URL, { headers: BROWSERISH_HEADERS, signal: ctl.signal });
    if (!res.ok)
      throw new Error(
        `Constitution Annotated returned ${res.status}. The Akamai CDN sometimes blocks ` +
        `scripted fetches — save the page from your browser and re-run with --feed-file <path>.`,
      );
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTable(): Promise<TableRow[]> {
  const { document } = parseHTML(await loadFeedHtml());

  const rows: TableRow[] = [];
  for (const tr of Array.from(document.querySelectorAll("table tr"))) {
    const cells = Array.from(tr.querySelectorAll("td"));
    if (cells.length < 4) continue;
    const seq = parseInt(cells[0].textContent?.trim() ?? "", 10);
    if (!Number.isFinite(seq)) continue;

    const overrulingHref = cells[1].querySelector("a")?.getAttribute("href") ?? null;
    const overruling = parseCaseFragment(cells[1].textContent ?? "", overrulingHref);
    if (!overruling) continue;
    if (!overruling.year) {
      const y = parseInt(cells[2].textContent?.trim() ?? "", 10);
      if (Number.isFinite(y)) overruling.year = y;
    }

    // Overruled cell: split on ';', pair each fragment with its own <a> when present.
    const overruledCell = cells[3];
    const anchors = Array.from(overruledCell.querySelectorAll("a"));
    const fragments = (overruledCell.textContent ?? "").split(";");
    const overruled: CaseRef[] = [];
    for (const frag of fragments) {
      const anchor = anchors.find((a) => frag.includes((a.textContent ?? "").trim().slice(0, 40)));
      const ref = parseCaseFragment(frag, anchor?.getAttribute("href") ?? null);
      if (ref) overruled.push(ref);
    }
    if (overruled.length > 0) rows.push({ seq, overruling, overruled });
  }
  return rows;
}

// ── DB matching ───────────────────────────────────────────────────────────────

interface Match {
  claimId: string;
  claimText: string;
  terminalAxis: string | null;
  emergedAt: Date | null;
  method: "citation" | "name+year";
  sourceUrl: string | null; // the matched claim's own CL page (for overruling lookups)
}

async function findScotusClaim(ref: CaseRef): Promise<Match | "ambiguous" | null> {
  // 1. Citation in Source.name (ingester embeds "…, 505 U.S. 833 — SCOTUS (1992)").
  if (ref.citation) {
    const edges = await prisma.edge.findMany({
      where: {
        deleted: false,
        ingestedBy: PIPELINE,
        source: { name: { contains: ref.citation } },
      },
      select: {
        claim: {
          select: {
            id: true, text: true, deleted: true, claimEmergedAt: true,
            statusHistory: { orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 1, select: { toAxis: true } },
          },
        },
        source: { select: { url: true } },
      },
      take: 3,
    });
    const alive = edges.filter((e) => !e.claim.deleted);
    const uniq = new Map(alive.map((e) => [e.claim.id, e]));
    if (uniq.size === 1) {
      const e = [...uniq.values()][0];
      return {
        claimId: e.claim.id,
        claimText: e.claim.text,
        terminalAxis: e.claim.statusHistory[0]?.toAxis ?? null,
        emergedAt: e.claim.claimEmergedAt,
        method: "citation",
        sourceUrl: e.source.url,
      };
    }
    if (uniq.size > 1) return "ambiguous";
  }

  // 2. Case name (+year sanity) in claim text.
  const claims = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: PIPELINE, text: { contains: ref.name, mode: "insensitive" } },
    select: {
      id: true, text: true, claimEmergedAt: true,
      edges: { where: { deleted: false }, take: 1, select: { source: { select: { url: true } } } },
      statusHistory: { orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 1, select: { toAxis: true } },
    },
    take: 5,
  });
  const yearOk = claims.filter(
    (c) => !ref.year || !c.claimEmergedAt || Math.abs(c.claimEmergedAt.getUTCFullYear() - ref.year) <= 1,
  );
  if (yearOk.length === 1) {
    const c = yearOk[0];
    return {
      claimId: c.id,
      claimText: c.text,
      terminalAxis: c.statusHistory[0]?.toAxis ?? null,
      emergedAt: c.claimEmergedAt,
      method: "name+year",
      sourceUrl: c.edges[0]?.source.url ?? null,
    };
  }
  if (yearOk.length > 1) return "ambiguous";
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
}

async function main() {
  console.log(
    `\n=== SCOTUS overrulings pipeline — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (no writes)"}${LIMIT ? `, limit ${LIMIT}` : ""}, partial→${PARTIAL_AS} ===\n`,
  );
  console.log(`Feed: ${FEED_FILE ?? TABLE_URL}`);

  if (!FEED_FILE) {
    const feedCheck = await verifyUrl(TABLE_URL);
    if (!feedCheck.ok)
      throw new Error(
        `feed unreachable (${feedCheck.status ?? feedCheck.note}) — save the page in your ` +
        `browser and re-run with --feed-file <path>`,
      );
    if (feedCheck.note) console.log(`(${feedCheck.note})`);
  }

  let rows = await fetchTable();
  console.log(`Parsed ${rows.length} table rows.`);
  if (LIMIT) rows = rows.slice(0, LIMIT);

  const residue: object[] = [];
  const counts = { planned: 0, inserted: 0, exists: 0, skipped: 0, residue: 0 };

  for (const row of rows) {
    // Overruling case: prefer its own DB record for the decision date + URL.
    const overrulingMatch = await findScotusClaim(row.overruling);
    const overrulingInDb = overrulingMatch !== null && overrulingMatch !== "ambiguous" ? overrulingMatch : null;

    let occurredAt: string;
    let precisionNote: string;
    if (overrulingInDb?.emergedAt) {
      occurredAt = isoDay(overrulingInDb.emergedAt);
      precisionNote = "decision date from courtlistener record";
    } else if (row.overruling.fullDate) {
      occurredAt = row.overruling.fullDate;
      precisionNote = "decision date from the table";
    } else if (row.overruling.year) {
      occurredAt = String(row.overruling.year);
      precisionNote = "year precision — table lists only the term year";
    } else {
      residue.push({ kind: "no-overruling-date", row });
      counts.residue++;
      continue;
    }

    for (const target of row.overruled) {
      const label = `#${row.seq} ${target.name} ← ${row.overruling.name}`;
      const match = await findScotusClaim(target);

      if (match === null || match === "ambiguous") {
        residue.push({
          kind: match === "ambiguous" ? "ambiguous-match" : "no-claim",
          seq: row.seq,
          overruled: target,
          overruling: row.overruling,
          occurredAt,
        });
        counts.residue++;
        console.log(`  ~ residue (${match === "ambiguous" ? "ambiguous" : "no claim"}): ${label}`);
        continue;
      }

      if (match.terminalAxis !== "SETTLED") {
        residue.push({
          kind: "terminal-axis-not-settled",
          terminalAxis: match.terminalAxis,
          claimId: match.claimId,
          seq: row.seq,
          overruled: target,
          overruling: row.overruling,
        });
        counts.residue++;
        console.log(`  ~ residue (terminal ${match.terminalAxis}): ${label}`);
        continue;
      }

      const toAxis: FactStatusT = target.partial ? PARTIAL_AS : "REVERSED";
      const markerUrl =
        overrulingInDb?.sourceUrl ?? row.overruling.url ?? TABLE_URL;
      const partialNote = target.partial ? " (overruled in part; the decision otherwise stands)" : "";
      const overrulingCite = row.overruling.citation ? `, ${row.overruling.citation}` : "";

      const spec: TransitionSpec = {
        claimId: match.claimId,
        fromAxis: "SETTLED",
        toAxis,
        community: "JUDICIAL",
        occurredAt,
        reason:
          `Overruled${target.partial ? " in part" : ""} by ${row.overruling.name}${overrulingCite}` +
          ` (${row.overruling.year ?? occurredAt.slice(0, 4)}), as recorded in the Library of Congress ` +
          `Constitution Annotated Table of Supreme Court Decisions Overruled (entry ${row.seq}).` +
          `${partialNote} ${precisionNote.startsWith("year") ? "Dated to the year of the overruling decision." : ""}`.trim(),
        source: {
          externalId: `src:scotus-overruling-${row.seq}-${slugify(target.name)}`,
          name: `${row.overruling.name}${overrulingCite} — overruling ${target.name}${target.citation ? `, ${target.citation}` : ""}`,
          url: markerUrl,
          publishedAt: occurredAt,
          methodologyType: markerUrl === TABLE_URL ? "derivative" : "primary",
          ingestedBy: "event:scotus_overrulings_v1",
        },
      };

      // The table URL itself 403s scripted fetches (Akamai) — but when running
      // from --feed-file the human just saved that exact page, so it is
      // human-verified. Bot-UA 403 is not link rot (transition-contract note).
      const skipVerify = markerUrl === TABLE_URL && !!FEED_FILE;
      const result = await emitTransition(prisma, spec, { execute: EXECUTE, verifyUrls: !skipVerify });
      counts[result.action === "planned" ? "planned" : result.action]++;
      const flag = { inserted: "+", planned: "·", exists: "=", skipped: "✗" }[result.action];
      console.log(`  ${flag} ${result.action.padEnd(8)} ${toAxis.padEnd(9)} @ ${occurredAt}  ${label}  [${match.method}]`);
      if (result.violations.length > 0)
        for (const v of result.violations) console.log(`        ! ${v}`);
    }
  }

  fs.mkdirSync(path.dirname(RESIDUE_PATH), { recursive: true });
  fs.writeFileSync(RESIDUE_PATH, residue.map((r) => JSON.stringify(r)).join("\n") + (residue.length ? "\n" : ""));

  console.log(`\n── Summary ──`);
  console.log(counts);
  console.log(`Residue (${residue.length}) → ${RESIDUE_PATH} — feed the law loop / curation.`);
  if (!EXECUTE)
    console.log(`\nPreflight only. Review the plan above, then re-run with --execute.`);
  else
    console.log(
      `\nVerify: npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --pipeline ${PIPELINE}`,
    );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
