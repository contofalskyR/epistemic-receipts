/**
 * nz-repealed-prepend.ts — completes nz_repealed_acts_v1 curves (briefing 03's
 * wave-2-style prepend), with a repeal-date backfill the briefing didn't know
 * it needed:
 *
 * DATA BUG THIS FIXES: the Layer-1 baseline for nz_repealed_acts_v1 is
 * null→REVERSED @ claimEmergedAt — but claimEmergedAt is the ENACTMENT year
 * (works-list API carries no repeal date), so every repeal is currently dated
 * to the year the act was passed. The repeal date lives only on each act's
 * legislation.govt.nz page ("Repealed, on 1 April 1988, by section 2 of …").
 *
 * Phase 1 — fetch (default):  probe each claim's existing Source URL for the
 *   repeal statement; store metadata.repealedAt / repealedBy (merged, never
 *   clobbered). Resumable: claims already carrying repealedAt are skipped.
 *   Fetches MUST send X-Api-Key + the probe UA/Accept: www.legislation.govt.nz
 *   answers keyless scripted clients HTTP 202 with 0 bytes (probe 2,
 *   logs/nz-probe2.log, 2026-07-08 — note 202 passes res.ok, which is how the
 *   old run misread the wall as noPattern). Pre-consolidation acts (~pre-1909)
 *   carry NO dated repeal note on their pages at all — those stay noPattern
 *   residue, honestly counted.
 *
 * Phase 2 — apply (--phase apply, requires --allow-entry-amend to write):
 *   per claim, in one transaction:
 *     a. amend the baseline: fromAxis null→SETTLED, occurredAt re-dated from
 *        the enactment-year placeholder to the actual repeal date (DAY),
 *        reason rewritten to cite the repeal notice;
 *     b. prepend the entry row: null→SETTLED @ enactment year (YEAR precision,
 *        the honest grain — NZ acts are cited by year), community INSTITUTIONAL,
 *        marker = the act's own page.
 *   Result: SETTLED(enactment) → REVERSED(repeal) — 4,372 drawable reversals.
 *
 * Guards (skip + count, never guess): strict single-step baseline only;
 * repealedAt must parse to a DAY and be strictly after Jan-1 of the enactment
 * year (equal dates would tie-break wrong against the older baseline row);
 * URL re-verified before the transaction. PREFLIGHT BY DEFAULT; --execute writes.
 * Row writes go through lib/transition-contract (emitTransition/amendBaseline).
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/nz-repealed-prepend.ts                 # phase 1 preflight
 *   ... --execute                                                              # phase 1: write metadata
 *   ... --phase apply                                                          # phase 2 preflight
 *   ... --phase apply --execute --allow-entry-amend [--limit 25]               # phase 2: write curves
 *
 * After phase 2:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts \
 *     --pipeline nz_repealed_acts_v1
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import {
  emitTransition,
  amendBaseline,
  verifyUrl,
  isoDay,
} from "../../lib/transition-contract";

const prisma = new PrismaClient();

const PIPELINE = "nz_repealed_acts_v1";
const FETCH_DELAY_MS = 300; // ingest-nz-legislation's politeness convention
const NZ_API_KEY = process.env.NZ_LEGISLATION_API_KEY;

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const PHASE = argValue("--phase") === "apply" ? "apply" : "fetch";
const EXECUTE = process.argv.includes("--execute");
const ALLOW_AMEND = process.argv.includes("--allow-entry-amend");
const LIMIT = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : null;
const OFFSET = argValue("--offset") ? parseInt(argValue("--offset")!, 10) : 0;
const REFETCH = process.argv.includes("--refetch");

import { extractRepeal } from "../../lib/nz-repeal";

type Meta = Record<string, unknown>;
const asMeta = (v: Prisma.JsonValue | null): Meta =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Meta) : {};

// ── Phase 1: repeal-date backfill ─────────────────────────────────────────────

async function phaseFetch() {
  if (!NZ_API_KEY) {
    console.error(
      "NZ_LEGISLATION_API_KEY not set — www.legislation.govt.nz serves HTTP 202 / 0 bytes to keyless scripted clients (probe 2, 2026-07-08). Aborting.",
    );
    process.exitCode = 2;
    return;
  }
  const claims = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: PIPELINE },
    select: {
      id: true, text: true, metadata: true, claimEmergedAt: true,
      edges: {
        where: { deleted: false },
        take: 1,
        select: { source: { select: { url: true } } },
      },
    },
    orderBy: { id: "asc" },
    ...(LIMIT ? { take: LIMIT } : {}),
    ...(OFFSET ? { skip: OFFSET } : {}),
  });

  const counts = { total: claims.length, alreadyHave: 0, found: 0, noPattern: 0, fetchFailed: 0, emptyBody: 0, noUrl: 0 };
  const patternInventory = new Map<string, number>();
  const noPatternDecades = new Map<string, number>();
  const noPatternSamples: string[] = [];

  let processed = 0;
  for (const c of claims) {
    processed++;
    if (processed % 250 === 0)
      console.log(`  … ${processed}/${counts.total} (found ${counts.found}, noPattern ${counts.noPattern}, fetchFailed ${counts.fetchFailed})`);
    const meta = asMeta(c.metadata);
    if (meta.repealedAt && !REFETCH) { counts.alreadyHave++; continue; }

    const url = c.edges[0]?.source.url;
    if (!url) { counts.noUrl++; continue; }

    let html: string;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/xml, text/html, */*",
          "User-Agent": "EpistemicReceipts/1.0 (nz-repeal-date backfill)",
          "X-Api-Key": NZ_API_KEY,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      // Bot-wall answers HTTP 202 + 0 bytes and res.ok is TRUE for 202 —
      // only a 200 with a non-empty body is a real page.
      if (res.status !== 200) { counts.fetchFailed++; continue; }
      html = await res.text();
      if (html.length === 0) { counts.emptyBody++; continue; }
    } catch {
      counts.fetchFailed++;
      continue;
    } finally {
      await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
    }

    const repeal = extractRepeal(html);
    if (!repeal) {
      counts.noPattern++;
      const yr = /\/act\/[a-z]+\/(\d{4})\//.exec(url)?.[1];
      if (yr) {
        const decade = `${yr.slice(0, 3)}0s`;
        noPatternDecades.set(decade, (noPatternDecades.get(decade) ?? 0) + 1);
      }
      if (noPatternSamples.length < 5) noPatternSamples.push(`${url}  ${c.text.slice(0, 60)}`);
      continue;
    }
    counts.found++;
    patternInventory.set(repeal.repealedAt.slice(0, 4), (patternInventory.get(repeal.repealedAt.slice(0, 4)) ?? 0) + 1);

    if (EXECUTE) {
      await prisma.claim.update({
        where: { id: c.id },
        data: {
          metadata: {
            ...meta,
            repealedAt: repeal.repealedAt,
            ...(repeal.repealedBy ? { repealedBy: repeal.repealedBy } : {}),
            repealSourceUrl: url,
            repealCheckedAt: new Date().toISOString(),
          },
        },
      });
    } else if (counts.found <= 10) {
      console.log(`  would-store ${repeal.repealedAt}  ${c.text.slice(0, 80)}${repeal.repealedBy ? `  (by ${repeal.repealedBy.slice(0, 60)})` : ""}`);
    }
  }

  console.log(`\n── Phase 1 summary (${EXECUTE ? "EXECUTED" : "PREFLIGHT — nothing written"}) ──`);
  console.log(counts);
  const decades = [...patternInventory.entries()].sort();
  if (decades.length) console.log(`Repeal years found:`, Object.fromEntries(decades));
  const misses = [...noPatternDecades.entries()].sort();
  if (misses.length) console.log(`noPattern by act decade:`, Object.fromEntries(misses));
  if (noPatternSamples.length) {
    console.log(`first noPattern samples:`);
    noPatternSamples.forEach((s) => console.log(`  ${s}`));
  }
  if (!EXECUTE) console.log(`\nRe-run with --execute to store metadata.repealedAt.`);
  else console.log(`\nNext: --phase apply (preflight), then --phase apply --execute --allow-entry-amend.`);
}

// ── Phase 2: prepend + amend ──────────────────────────────────────────────────

async function phaseApply() {
  const claims = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: PIPELINE },
    select: {
      id: true, text: true, metadata: true, claimEmergedAt: true, claimEmergedPrecision: true,
      edges: {
        where: { deleted: false },
        take: 1,
        select: { source: { select: { externalId: true, name: true, url: true } } },
      },
      statusHistory: {
        orderBy: [{ seq: "asc" }, { occurredAt: "asc" }, { createdAt: "asc" }],
        select: { id: true, fromAxis: true, toAxis: true, occurredAt: true },
      },
    },
    orderBy: { id: "asc" },
    ...(LIMIT ? { take: LIMIT } : {}),
    ...(OFFSET ? { skip: OFFSET } : {}),
  });

  const counts = {
    total: claims.length, noRepealDate: 0, notSingleStepBaseline: 0, badDateOrder: 0,
    noSource: 0, urlFailed: 0, planned: 0, applied: 0, skippedViolations: 0,
  };

  for (const c of claims) {
    const meta = asMeta(c.metadata);
    const repealedAt = typeof meta.repealedAt === "string" ? meta.repealedAt : null;
    const repealedBy = typeof meta.repealedBy === "string" ? meta.repealedBy : null;
    if (!repealedAt || !/^\d{4}-\d{2}-\d{2}$/.test(repealedAt)) { counts.noRepealDate++; continue; }

    // Strict single-step REVERSED baseline only (their singleStepJoin discipline).
    const h = c.statusHistory;
    if (h.length !== 1 || h[0].fromAxis !== null || h[0].toAxis !== "REVERSED") {
      counts.notSingleStepBaseline++;
      continue;
    }
    if (!c.claimEmergedAt) { counts.badDateOrder++; continue; }

    const enactYear = c.claimEmergedAt.getUTCFullYear();
    const entryDate = new Date(Date.UTC(enactYear, 0, 1));
    const repealDate = new Date(`${repealedAt}T00:00:00Z`);
    // Strictly after Jan-1 of the enactment year: an equal timestamp would
    // tie-break against the (older-createdAt) baseline row and break the chain.
    if (!(repealDate.getTime() > entryDate.getTime())) { counts.badDateOrder++; continue; }

    const srcRaw = c.edges[0]?.source;
    if (!srcRaw?.url || !srcRaw.externalId) { counts.noSource++; continue; }
    const src = { externalId: srcRaw.externalId, name: srcRaw.name, url: srcRaw.url };

    const amendedReason =
      `Repealed on ${repealedAt}${repealedBy ? `, by ${repealedBy}` : ""} — repeal notice recorded on the ` +
      `New Zealand Legislation website (${src.url}). Re-dated from the Layer-1 enactment-year placeholder ` +
      `to the actual repeal date.`;
    const entryReason =
      `Enacted in ${enactYear} (${src.name}); entered the settled New Zealand statute book. ` +
      `Year precision — NZ public acts are cited by enactment year.`;

    if (!EXECUTE) {
      counts.planned++;
      if (counts.planned <= 10)
        console.log(
          `  plan: SETTLED @ ${enactYear} (YEAR) → REVERSED @ ${repealedAt} (DAY)  ${c.text.slice(0, 72)}`,
        );
      continue;
    }

    if (!ALLOW_AMEND) {
      console.error("--execute for phase apply requires --allow-entry-amend (mutates baseline rows). Aborting.");
      process.exitCode = 2;
      return;
    }

    const urlCheck = await verifyUrl(src.url);
    if (!urlCheck.ok) { counts.urlFailed++; continue; }

    const outcome = await prisma.$transaction(async (tx) => {
      const amend = await amendBaseline(
        tx,
        {
          claimId: c.id,
          expectToAxis: "REVERSED",
          setFromAxis: "SETTLED",
          redateTo: repealDate,
          redatePrecision: "DAY",
          setReason: amendedReason,
        },
        { execute: true, allowEntryAmend: true },
      );
      if (amend.amended !== 1) return { ok: false as const, violations: amend.violations };

      const entry = await emitTransition(
        tx,
        {
          claimId: c.id,
          fromAxis: null,
          toAxis: "SETTLED",
          community: "INSTITUTIONAL",
          occurredAt: entryDate,
          datePrecision: "YEAR",
          reason: entryReason,
          source: {
            externalId: src.externalId,
            name: src.name,
            url: src.url,
            publishedAt: entryDate,
            methodologyType: "primary",
          },
        },
        { execute: true, allowEntryRow: true, verifyUrls: false /* verified above */ },
      );
      if (entry.action !== "inserted" && entry.action !== "exists")
        return { ok: false as const, violations: entry.violations };
      return { ok: true as const, violations: [] };
    });

    if (outcome.ok) {
      counts.applied++;
      if (counts.applied % 200 === 0) console.log(`  … ${counts.applied} applied`);
    } else {
      counts.skippedViolations++;
      console.log(`  ✗ ${c.id}: ${outcome.violations.join(" | ")}`);
    }
  }

  console.log(`\n── Phase 2 summary (${EXECUTE ? "EXECUTED" : "PREFLIGHT — nothing written"}) ──`);
  console.log(counts);
  if (!EXECUTE)
    console.log(`\nRe-run with --execute --allow-entry-amend to write. Pilot with --limit 25 first.`);
  else
    console.log(
      `\nVerify: npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --pipeline ${PIPELINE}`,
    );
}

async function main() {
  console.log(
    `\n=== NZ repealed acts — phase ${PHASE} — ${EXECUTE ? "EXECUTE" : "PREFLIGHT"}${LIMIT ? `, limit ${LIMIT}` : ""}${OFFSET ? `, offset ${OFFSET}` : ""} ===`,
  );
  if (PHASE === "fetch") await phaseFetch();
  else await phaseApply();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
