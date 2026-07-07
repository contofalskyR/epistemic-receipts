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
const REFETCH = process.argv.includes("--refetch");

const NZ_MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** "1 April 1988" → "1988-04-01" */
function parseNzDate(s: string): string | null {
  const m = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(s);
  if (!m) return null;
  const month = NZ_MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
}

/** Extract "Repealed, on 1 April 1988, by section 2 of the …" from an act page. */
function extractRepeal(html: string): { repealedAt: string; repealedBy: string | null } | null {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  // by-clause may contain "section 92(1)"-style parens; terminate on a period
  // or the trailing act citation " (1992 No 76)" — not on any "(".
  const m = /[Rr]epealed\s*,?\s+on\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})(?:\s*,?\s+by\s+([^.]{3,220}?))?(?:\.|\s\(\d{4}\s)/.exec(text);
  if (!m) return null;
  const repealedAt = parseNzDate(m[1]);
  if (!repealedAt) return null;
  return { repealedAt, repealedBy: m[2]?.trim() ?? null };
}

type Meta = Record<string, unknown>;
const asMeta = (v: Prisma.JsonValue | null): Meta =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Meta) : {};

// ── Phase 1: repeal-date backfill ─────────────────────────────────────────────

async function phaseFetch() {
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
  });

  const counts = { total: claims.length, alreadyHave: 0, found: 0, noPattern: 0, fetchFailed: 0, noUrl: 0 };
  const patternInventory = new Map<string, number>();

  for (const c of claims) {
    const meta = asMeta(c.metadata);
    if (meta.repealedAt && !REFETCH) { counts.alreadyHave++; continue; }

    const url = c.edges[0]?.source.url;
    if (!url) { counts.noUrl++; continue; }

    let html: string;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "epistemic-receipts/1.0 (nz-repeal-date backfill)" },
        redirect: "follow",
      });
      if (!res.ok) { counts.fetchFailed++; continue; }
      html = await res.text();
    } catch {
      counts.fetchFailed++;
      continue;
    } finally {
      await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
    }

    const repeal = extractRepeal(html);
    if (!repeal) {
      counts.noPattern++;
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
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
        select: { id: true, fromAxis: true, toAxis: true, occurredAt: true },
      },
    },
    orderBy: { id: "asc" },
    ...(LIMIT ? { take: LIMIT } : {}),
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
    `\n=== NZ repealed acts — phase ${PHASE} — ${EXECUTE ? "EXECUTE" : "PREFLIGHT"}${LIMIT ? `, limit ${LIMIT}` : ""} ===`,
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
