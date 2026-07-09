/**
 * openalex-retraction-join.ts — Tier-2 identity-join transition-event pipeline.
 *
 * Both halves of this arc are ALREADY IN THE DB (briefing 08 §Tier-2 /
 * briefing 13 Phase A): openalex_v1 (318,775 paper claims, BORN_RECORDED —
 * every claim's baseline is null→RECORDED @ its own publication date) and
 * crossref_retractions_v1 (26,624 retraction-record claims, each already
 * carrying the retraction date on claimEmergedAt/claimEmergedPrecision and a
 * marker Source on its own Edge). No external fetch for the join itself — this
 * is a DB-internal DOI join.
 *
 * Join: normalize metadata.doi on both sides (strip any "https://doi.org/"
 * prefix, lowercase). Where DOIs match, the openalex claim gets the dormant
 * second half of its arc:
 *
 *     RECORDED → REVERSED   @ retraction date, honest precision from the
 *                             crossref record, community EXPERT_LITERATURE
 *
 * SETTLED→REVERSED is not offered as an option: openalex_v1 claims are never
 * SETTLED (confirmed via full-population terminal-axis census, briefing 13
 * Phase A CHECKPOINT 3), so it is structurally excluded by chain coherence.
 * This mirrors exoplanet-retractions.ts's RECORDED→REVERSED precedent exactly.
 *
 * Marker source: REUSED, never created. Each crossref_retractions_v1 claim
 * already has an Edge → Source (ingest-retractions.ts); this pipeline looks
 * that Source up and passes its own externalId/url/name straight through, so
 * emitTransition's upsert finds it and writes nothing new to Source.
 *
 * CHECKPOINT 3 advisor verdict (2026-07-09, Fable via Robert) — both gates
 * below are non-negotiable, not tuning knobs:
 *   - Date-sanity guard: retraction date STRICTLY BEFORE the openalex claim's
 *     own claimEmergedAt (publication date) is treated as corpus noise (e.g. a
 *     crossref ".toc" front-matter DOI wrongly flagged retracted) — skip+count
 *     to residue, never write. Retraction date EQUAL to claimEmergedAt (at
 *     stored precision — the old YEAR-truncation inverted-retraction family)
 *     is NOT residue: seq now gives explicit row order, so append with
 *     allowSameDate and count it separately (sameDate) — refusing a solved
 *     ambiguity would fabricate residue.
 *   - Claims whose terminal axis isn't RECORDED (already curved — mostly by
 *     the pre-contract populate-retraction-curves.ts / link-retractions-
 *     crossref.ts path) are skip+counted, never amended. Where the existing
 *     REVERSED date already matches the crossref date, that's silently
 *     correct (alreadyReversedMatch). Where it differs, that's a real
 *     conflict — logged to residue (kind: conflicting-date) with enough shape
 *     {claimId, doi, existingRowId, existingDate, crossrefDate} that a future
 *     fix pass is one script reading the file, not a re-census. Same file,
 *     kind: retraction-before-emergence, for the noise population above —
 *     crossref_retractions_v1 evidently carries some non-article records, and
 *     that is a finding worth keeping receipts on, not silently discarding.
 *
 * No claim creation, ever — this pipeline only appends transitions to
 * existing openalex_v1 claims. PREFLIGHT/DRY-RUN BY DEFAULT; writes only with
 * --execute. Idempotent (deterministic ids + the (claimId, toAxis, occurredAt)
 * unique constraint) — safe to re-run.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/openalex-retraction-join.ts --direct
 *   ... --limit 25 --execute       pilot (see briefing 13 Phase A step 3)
 *   ... --execute                  full run
 *
 * After --execute:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --pipeline openalex_v1
 */

import "dotenv/config";

// --direct must take effect before the client is constructed (house convention,
// audit-chain-integrity.ts): the DOI-normalization scan touches all of
// openalex_v1 (308k+ DOI-bearing rows) and crossref_retractions_v1 (26.6k) —
// the Neon pooler kills scans like this (P1017).
if (process.argv.includes("--direct")) {
  if (!process.env.DIRECT_URL) {
    console.error("--direct passed but DIRECT_URL is not set");
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { emitTransition, type TransitionSpec, type DatePrecisionT } from "../../lib/transition-contract";

const prisma = new PrismaClient();

const OPENALEX_PIPELINE = "openalex_v1";
const RETRACTION_PIPELINE = "crossref_retractions_v1";
const RESIDUE_PATH = path.join(__dirname, "../../logs/openalex-retraction-conflicts.jsonl");

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const EXECUTE = process.argv.includes("--execute");
const LIMIT = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : null;

function normalizeDoiSql(col: string): string {
  return `lower(CASE WHEN ${col}->>'doi' LIKE 'https://doi.org/%' THEN substring(${col}->>'doi' FROM length('https://doi.org/')+1) ELSE ${col}->>'doi' END)`;
}

/** House date convention, honest precision — never fabricate finer grain than
 *  the crossref record actually gives. */
function formatByPrecision(date: Date, precision: string | null): string {
  const iso = date.toISOString();
  const y = iso.slice(0, 4), m = iso.slice(5, 7), d = iso.slice(8, 10);
  if (precision === "DAY") return `${y}-${m}-${d}`;
  if (precision === "MONTH") return `${y}-${m}`;
  return y; // YEAR, QUARTER (collapsed to year — house convention has no quarter string form), or defensive fallback
}

interface Pair {
  openalexId: string;
  retractionId: string;
  doi: string;
}

interface RetractionInfo {
  claimEmergedAt: Date | null;
  claimEmergedPrecision: string | null;
  title: string | null;
  journal: string | null;
  firstAuthor: string | null;
}

interface SourceInfo {
  externalId: string;
  name: string;
  url: string;
  publishedAt: Date | null;
}

interface TerminalInfo {
  toAxis: string;
  occurredAt: Date;
  id: string;
}

async function main() {
  console.log(
    `\n=== openalex ↔ crossref-retraction DOI join — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (no writes)"}${LIMIT ? `, limit ${LIMIT}` : ""} ===\n`,
  );

  // ── Stage 1: DOI join (DB-internal, no external fetch) ────────────────────
  const retractionRows = await prisma.$queryRawUnsafe<Array<{ id: string; doi: string }>>(
    `SELECT id, ${normalizeDoiSql("metadata")} AS doi FROM "Claim"
     WHERE "ingestedBy" = '${RETRACTION_PIPELINE}' AND deleted = false
       AND metadata->>'doi' IS NOT NULL AND metadata->>'doi' != ''`,
  );
  const openalexRows = await prisma.$queryRawUnsafe<Array<{ id: string; doi: string }>>(
    `SELECT id, ${normalizeDoiSql("metadata")} AS doi FROM "Claim"
     WHERE "ingestedBy" = '${OPENALEX_PIPELINE}' AND deleted = false
       AND metadata->>'doi' IS NOT NULL AND metadata->>'doi' != ''
     ORDER BY id`,
  );
  const retractionByDoi = new Map<string, string>();
  for (const r of retractionRows) if (!retractionByDoi.has(r.doi)) retractionByDoi.set(r.doi, r.id);

  let pairs: Pair[] = [];
  for (const r of openalexRows) {
    const retractionId = retractionByDoi.get(r.doi);
    if (retractionId) pairs.push({ openalexId: r.id, retractionId, doi: r.doi });
  }
  console.log(`DOI join: ${pairs.length} matched pairs (openalex ${openalexRows.length} DOI-bearing, retraction ${retractionRows.length} DOI-bearing).`);
  if (LIMIT) pairs = pairs.slice(0, LIMIT);

  // ── Stage 2: batch-fetch details for the (possibly limited) pair set ─────
  const openalexIds = pairs.map((p) => p.openalexId);
  const retractionIds = pairs.map((p) => p.retractionId);

  const historyRows = await prisma.claimStatusHistory.findMany({
    where: { claimId: { in: openalexIds } },
    orderBy: [{ claimId: "asc" }, { seq: "asc" }, { occurredAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, claimId: true, toAxis: true, occurredAt: true },
  });
  const terminalByOpenalexId = new Map<string, TerminalInfo>();
  for (const h of historyRows) {
    terminalByOpenalexId.set(h.claimId, { id: h.id, toAxis: h.toAxis, occurredAt: h.occurredAt }); // last write per claimId wins = terminal, given ASC order
  }
  const emergedByOpenalexId = new Map<string, Date | null>(
    (
      await prisma.claim.findMany({ where: { id: { in: openalexIds } }, select: { id: true, claimEmergedAt: true } })
    ).map((c) => [c.id, c.claimEmergedAt]),
  );

  const retractionClaims = await prisma.claim.findMany({
    where: { id: { in: retractionIds } },
    select: { id: true, claimEmergedAt: true, claimEmergedPrecision: true, metadata: true },
  });
  const retractionInfoById = new Map<string, RetractionInfo>();
  for (const c of retractionClaims) {
    const md = (c.metadata ?? {}) as Record<string, unknown>;
    retractionInfoById.set(c.id, {
      claimEmergedAt: c.claimEmergedAt,
      claimEmergedPrecision: c.claimEmergedPrecision,
      title: typeof md.title === "string" ? md.title : null,
      journal: typeof md.journal === "string" ? md.journal : null,
      firstAuthor: typeof md.firstAuthor === "string" ? md.firstAuthor : null,
    });
  }

  const edgeRows = await prisma.$queryRawUnsafe<
    Array<{ claimid: string; externalid: string; name: string; url: string | null; publishedat: Date | null }>
  >(
    `SELECT e."claimId" AS claimid, s."externalId" AS externalid, s.name AS name, s.url AS url, s."publishedAt" AS publishedat
     FROM "Edge" e JOIN "Source" s ON s.id = e."sourceId"
     WHERE e."claimId" = ANY($1::text[]) AND e.deleted = false`,
    retractionIds,
  );
  const sourceByRetractionId = new Map<string, SourceInfo>();
  for (const e of edgeRows) {
    if (!sourceByRetractionId.has(e.claimid) && e.externalid && e.url) {
      sourceByRetractionId.set(e.claimid, { externalId: e.externalid, name: e.name, url: e.url, publishedAt: e.publishedat });
    }
  }

  // ── Stage 3: branch + write ────────────────────────────────────────────────
  const residue: object[] = [];
  const counts = {
    planned: 0, inserted: 0, exists: 0, skipped: 0,
    sameDate: 0, alreadyReversedMatch: 0, conflictingDate: 0,
    noiseBeforeEmergence: 0, missingPrecision: 0, missingSource: 0, otherTerminal: 0,
  };

  for (const pair of pairs) {
    const terminal = terminalByOpenalexId.get(pair.openalexId) ?? null;
    const retraction = retractionInfoById.get(pair.retractionId);
    const openalexEmergedAt = emergedByOpenalexId.get(pair.openalexId) ?? null;

    if (!terminal) {
      residue.push({ kind: "no-history", claimId: pair.openalexId, doi: pair.doi });
      counts.otherTerminal++;
      continue;
    }

    // ── Already curved: not our job to touch it, but worth knowing whether
    //    the existing curve agrees with the crossref record. ──────────────
    if (terminal.toAxis !== "RECORDED") {
      if (terminal.toAxis === "REVERSED" && retraction?.claimEmergedAt) {
        const same = terminal.occurredAt.getTime() === retraction.claimEmergedAt.getTime();
        if (same) {
          counts.alreadyReversedMatch++;
        } else {
          residue.push({
            kind: "conflicting-date",
            claimId: pair.openalexId,
            doi: pair.doi,
            existingRowId: terminal.id,
            existingDate: terminal.occurredAt.toISOString().slice(0, 10),
            crossrefDate: retraction.claimEmergedAt.toISOString().slice(0, 10),
          });
          counts.conflictingDate++;
        }
      } else {
        residue.push({ kind: "unexpected-terminal-axis", claimId: pair.openalexId, doi: pair.doi, terminal: terminal.toAxis });
        counts.otherTerminal++;
      }
      continue;
    }

    // ── terminal === RECORDED: the real target. ───────────────────────────
    if (!retraction?.claimEmergedAt || !retraction.claimEmergedPrecision) {
      residue.push({ kind: "missing-precision", claimId: pair.openalexId, doi: pair.doi });
      counts.missingPrecision++;
      continue;
    }
    const markerSource = sourceByRetractionId.get(pair.retractionId);
    if (!markerSource) {
      residue.push({ kind: "missing-marker-source", claimId: pair.openalexId, doi: pair.doi, retractionId: pair.retractionId });
      counts.missingSource++;
      continue;
    }

    const cmpToEmergence = openalexEmergedAt
      ? retraction.claimEmergedAt.getTime() - openalexEmergedAt.getTime()
      : 1; // no emergedAt on file to compare against — don't block on it
    if (cmpToEmergence < 0) {
      residue.push({
        kind: "retraction-before-emergence",
        claimId: pair.openalexId,
        doi: pair.doi,
        crossrefDate: retraction.claimEmergedAt.toISOString().slice(0, 10),
        claimEmergedAt: openalexEmergedAt ? openalexEmergedAt.toISOString().slice(0, 10) : null,
        title: retraction.title,
      });
      counts.noiseBeforeEmergence++;
      console.log(`  ~ residue (retraction predates emergence): ${pair.doi}`);
      continue;
    }
    const isSameDate = cmpToEmergence === 0;
    if (isSameDate) counts.sameDate++;

    const occurredAtStr = formatByPrecision(retraction.claimEmergedAt, retraction.claimEmergedPrecision);
    const precisionNote =
      retraction.claimEmergedPrecision === "YEAR"
        ? " (year precision — CrossRef's retraction-update record gives only the year)"
        : retraction.claimEmergedPrecision === "MONTH"
          ? " (month precision — CrossRef's retraction-update record gives only year and month)"
          : "";
    const journalPart = retraction.journal ? ` in ${retraction.journal}` : "";
    const reason =
      `Retracted per CrossRef's publisher-reported retraction record for this paper${journalPart}` +
      ` (DOI ${pair.doi}), dated ${occurredAtStr}.${precisionNote} Marker: the crossref_retractions_v1` +
      ` claim's own source record for this DOI.`;

    const spec: TransitionSpec = {
      claimId: pair.openalexId,
      fromAxis: "RECORDED",
      toAxis: "REVERSED",
      community: "EXPERT_LITERATURE",
      occurredAt: occurredAtStr,
      datePrecision: retraction.claimEmergedPrecision as DatePrecisionT,
      reason,
      source: {
        externalId: markerSource.externalId,
        name: markerSource.name,
        url: markerSource.url,
        publishedAt: markerSource.publishedAt ?? retraction.claimEmergedAt,
        methodologyType: "primary",
      },
    };

    const result = await emitTransition(prisma, spec, { execute: EXECUTE, allowSameDate: true });
    counts[result.action === "planned" ? "planned" : result.action]++;
    const flag = { inserted: "+", planned: "·", exists: "=", skipped: "✗" }[result.action];
    console.log(`  ${flag} ${result.action.padEnd(8)} RECORDED→REVERSED @ ${occurredAtStr}${isSameDate ? " [sameDate]" : ""}  ${pair.doi}  (${pair.openalexId})`);
    if (result.violations.length > 0) for (const v of result.violations) console.log(`        ! ${v}`);
  }

  fs.mkdirSync(path.dirname(RESIDUE_PATH), { recursive: true });
  fs.writeFileSync(RESIDUE_PATH, residue.map((r) => JSON.stringify(r)).join("\n") + (residue.length ? "\n" : ""));

  console.log(`\n── Summary ──`);
  console.log(counts);
  console.log(`Residue (${residue.length}) → ${RESIDUE_PATH}`);
  console.log(`  conflictingDate + noiseBeforeEmergence entries there are a future curation queue, not this pipeline's job.`);
  if (!EXECUTE) console.log(`\nPreflight only. Review the plan above, then re-run with --execute.`);
  else console.log(`\nVerify: npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --pipeline ${OPENALEX_PIPELINE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
