/**
 * ofac-additions-dates.ts — designation-date backfill for dateless
 * ofac_sdn_v1 claims (probe memo logs/ofac-additions-probe-2026-07-10.md;
 * decision recorded in briefing 18 §2, Robert 2026-07-10).
 *
 * THIS IS NOT A TRANSITION PIPELINE. It writes Claim.claimEmergedAt (+
 * claimEmergedPrecision='DAY' + provenance keys merged into metadata) on
 * claims that have NO date, from OFAC Recent Actions ADDITION notices
 * ("The following individuals/entities/... have been added to OFAC's SDN
 * list", dated to the DAY, verified 2005→2026). It NEVER touches
 * ClaimStatusHistory — after it runs, the existing Layer-1 pass
 * (ingest-auto-trajectories.ts --pipeline ofac_sdn_v1) baselines the newly
 * dated claims, and re-running ofac-delistings.ts emits the arcs that were
 * residue for want of a baseline.
 *
 * Guardrails (stricter than the delistings pipeline — a wrong DATE corrupts
 * a claim, a skipped arc doesn't):
 *   - Matching is EXACT-ONLY: claim-text frame "<name> (OFAC SDN)" and
 *     metadata.aliases exact hits. NO normalized tier (Robert's condition).
 *   - Writes only claims whose claimEmergedAt IS NULL (updateMany-guarded,
 *     race-safe; existing dates are never overwritten).
 *   - One-notice-per-claim: a claim matched by addition notices with more
 *     than one distinct date is a re-listing or a name collision → residue,
 *     no write.
 *   - Designation date must precede the claim's snapshot ingest (createdAt);
 *     a later "addition" matching a snapshot claim is a re-listing artifact →
 *     residue.
 *   - Unmatched/undatable → residue JSONL. Dates never invented.
 *
 * PREFLIGHT/DRY-RUN BY DEFAULT; writes only with --execute. Notice HTML is
 * cached under logs/ofac-notice-cache/ so the ~1,900-notice history is
 * fetched from Treasury once (re-runs and the pilot→full sequence hit disk).
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/ofac-additions-dates.ts
 *   ... --limit 50          first N notices (pilot; oldest first)
 *   ... --max-pages 200     listing-page cap (default 200; ~189 exist)
 *   ... --execute           write (after the sample-review gate!)
 *
 * After --execute:
 *   npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json \
 *     scripts/ingest-auto-trajectories.ts --pipeline ofac_sdn_v1
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/ofac-delistings.ts --since 2026-06-04
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --pipeline ofac_sdn_v1
 */

import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import {
  OFAC_BASE,
  fetchHtml,
  sleep,
  noticeRefsFromListing,
  parseNoticeSections,
  ADDITIONS_HEADING,
  type NoticeRef,
  type SdnEntryBlock,
} from "./ofac-notice-lib";

const prisma = new PrismaClient();

const PIPELINE = "ofac_sdn_v1";
const DATED_BY = "event:ofac_additions_v1";
const CATEGORY_PATH = "/recent-actions/sanctions-list-updates";
const FETCH_DELAY_MS = 300;
const CACHE_DIR = path.join(__dirname, "../../logs/ofac-notice-cache");

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const EXECUTE = process.argv.includes("--execute");
const LIMIT = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : null;
const MAX_PAGES = argValue("--max-pages") ? parseInt(argValue("--max-pages")!, 10) : 200;
const RESIDUE_PATH = argValue("--residue-path")
  ?? path.join(__dirname, "../../logs/ofac-additions-residue.jsonl");

// ── Cached notice fetch ───────────────────────────────────────────────────────

async function fetchNoticeCached(ref: NoticeRef): Promise<{ html: string; fromCache: boolean }> {
  const cachePath = path.join(CACHE_DIR, `${ref.id}.html`);
  if (fs.existsSync(cachePath)) return { html: fs.readFileSync(cachePath, "utf8"), fromCache: true };
  const html = await fetchHtml(ref.url);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath, html);
  return { html, fromCache: false };
}

// ── Enumerate the full category (all sanctions-list updates) ─────────────────

async function enumerateAllNotices(): Promise<NoticeRef[]> {
  const notices = new Map<string, NoticeRef>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const { refs } = noticeRefsFromListing(await fetchHtml(`${OFAC_BASE}${CATEGORY_PATH}?page=${page}`));
    if (refs.length === 0) {
      if (page === 0)
        throw new Error("enumerator parsed 0 notice links on page 0 — page structure changed? FAIL-CLOSED");
      break;
    }
    for (const ref of refs) if (!notices.has(ref.id)) notices.set(ref.id, ref);
    await sleep(FETCH_DELAY_MS);
  }
  // Oldest first: designation order, and the pilot slice covers the era where
  // most dateless claims live.
  return [...notices.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ── Exact-only matching (C3: no normalized tier) ─────────────────────────────

interface ClaimLite {
  id: string;
  text: string;
  uid: number | null;
  claimEmergedAt: Date | null;
  createdAt: Date;
}

const liteSelect = {
  id: true,
  text: true,
  metadata: true,
  claimEmergedAt: true,
  createdAt: true,
} satisfies Prisma.ClaimSelect;

function toLite(c: { id: string; text: string; metadata: unknown; claimEmergedAt: Date | null; createdAt: Date }): ClaimLite {
  const meta = (c.metadata ?? {}) as { uid?: number };
  return {
    id: c.id,
    text: c.text,
    uid: typeof meta.uid === "number" ? meta.uid : null,
    claimEmergedAt: c.claimEmergedAt,
    createdAt: c.createdAt,
  };
}

async function findSdnClaimExact(entry: SdnEntryBlock): Promise<
  { hit: ClaimLite; method: "text-exact" | "alias-exact" } | "ambiguous" | null
> {
  for (const name of entry.matchNames) {
    const rows = await prisma.claim.findMany({
      where: {
        deleted: false,
        ingestedBy: PIPELINE,
        text: { contains: `${name} (OFAC SDN)`, mode: "insensitive" },
      },
      select: liteSelect,
      take: 3,
    });
    if (rows.length === 1) return { hit: toLite(rows[0]), method: "text-exact" };
    if (rows.length > 1) return "ambiguous";
  }
  for (const name of entry.matchNames) {
    const ids = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Claim"
      WHERE "ingestedBy" = ${PIPELINE}
        AND deleted = false
        AND (metadata -> 'aliases') @> jsonb_build_array(${name}::text)
      LIMIT 3`;
    if (ids.length === 1) {
      const row = await prisma.claim.findUnique({ where: { id: ids[0].id }, select: liteSelect });
      if (row) return { hit: toLite(row), method: "alias-exact" };
    }
    if (ids.length > 1) return "ambiguous";
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface PlannedWrite {
  claimId: string;
  uid: number | null;
  entryName: string;
  method: string;
  date: string;        // designation date, DAY
  noticeId: string;
  noticeUrl: string;
  noticeTitle: string;
}

async function main() {
  console.log(
    `\n=== OFAC additions date-backfill — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (no writes)"}${LIMIT ? `, limit ${LIMIT} notices` : ""} ===\n`,
  );
  console.log(`NOT a transition pipeline: writes Claim.claimEmergedAt on dateless ${PIPELINE} claims only.\n`);

  const residue: object[] = [];
  let notices = await enumerateAllNotices();
  console.log(`Notices enumerated: ${notices.length} (oldest ${notices[0]?.date} → newest ${notices[notices.length - 1]?.date})`);
  if (LIMIT) notices = notices.slice(0, LIMIT);

  const counts = {
    notices: 0, withAdditions: 0, cacheHits: 0, entries: 0,
    matched: 0, unmatched: 0, ambiguous: 0,
    alreadyDated: 0, multiDate: 0, postdatesSnapshot: 0,
    planned: 0, updated: 0, skippedRace: 0,
  };

  // Stage 1: collect claimId → set of distinct designation dates seen.
  const byClaim = new Map<string, PlannedWrite[]>();

  for (const ref of notices) {
    counts.notices++;
    const { html, fromCache } = await fetchNoticeCached(ref);
    if (fromCache) counts.cacheHits++;
    else await sleep(FETCH_DELAY_MS);

    const section = parseNoticeSections(html, ADDITIONS_HEADING, ref.id);
    if (!section.hadHeading || section.entries.length === 0) continue;
    counts.withAdditions++;

    const seenInNotice = new Set<string>(); // aka cross-posts within one notice
    for (const entry of section.entries) {
      counts.entries++;
      const match = await findSdnClaimExact(entry);
      if (match === null) {
        counts.unmatched++;
        // High-volume by construction (delisted-before-snapshot entities have
        // no claims) — count, and sample the first 200 into the residue file.
        if (counts.unmatched <= 200)
          residue.push({ kind: "unmatched", notice: ref.id, date: ref.date, entry: entry.primaryName });
        continue;
      }
      if (match === "ambiguous") {
        counts.ambiguous++;
        residue.push({ kind: "ambiguous-exact-match", notice: ref.id, date: ref.date, entry: entry.primaryName });
        continue;
      }
      counts.matched++;
      const { hit, method } = match;
      if (seenInNotice.has(hit.id)) continue;
      seenInNotice.add(hit.id);

      const plan: PlannedWrite = {
        claimId: hit.id,
        uid: hit.uid,
        entryName: entry.primaryName,
        method,
        date: ref.date,
        noticeId: ref.id,
        noticeUrl: ref.url,
        noticeTitle: section.title,
      };
      const list = byClaim.get(hit.id) ?? [];
      list.push(plan);
      byClaim.set(hit.id, list);
    }
  }

  // Stage 2: apply the guardrails per claim, then write.
  const planned: PlannedWrite[] = [];
  for (const [claimId, plans] of byClaim) {
    const dates = [...new Set(plans.map((p) => p.date))];
    if (dates.length > 1) {
      counts.multiDate++;
      residue.push({
        kind: "multiple-designation-dates",
        claimId,
        entry: plans[0].entryName,
        dates,
        notices: plans.map((p) => p.noticeId),
        note: "re-listing or name collision — no write (one-notice-per-claim rule)",
      });
      continue;
    }
    const plan = plans[0];
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      select: { claimEmergedAt: true, createdAt: true },
    });
    if (!claim) continue;
    if (claim.claimEmergedAt) {
      counts.alreadyDated++;
      continue; // never overwrite an existing date
    }
    if (new Date(`${plan.date}T00:00:00Z`).getTime() > claim.createdAt.getTime()) {
      counts.postdatesSnapshot++;
      residue.push({ kind: "postdates-snapshot", claimId, entry: plan.entryName, date: plan.date, claimCreatedAt: isoOf(claim.createdAt) });
      continue;
    }
    planned.push(plan);
  }

  counts.planned = planned.length;

  // Sample for the review gate.
  console.log(`\n── First 15 planned writes (sample-review gate) ──`);
  for (const p of planned.slice(0, 15))
    console.log(`  · ${p.date}  ${p.entryName}  [${p.method}]  notice=${p.noticeId}  claim=${p.claimId}${p.uid ? ` uid=${p.uid}` : ""}`);

  if (EXECUTE) {
    for (const p of planned) {
      const row = await prisma.claim.findUnique({ where: { id: p.claimId }, select: { metadata: true } });
      const meta = ((row?.metadata ?? {}) as Record<string, unknown>);
      const merged = {
        ...meta,
        designation_notice_url: p.noticeUrl,
        designation_notice_id: p.noticeId,
        designation_dated_by: DATED_BY,
      } as Prisma.InputJsonObject;
      const res = await prisma.claim.updateMany({
        where: { id: p.claimId, claimEmergedAt: null }, // race-safe null guard
        data: {
          claimEmergedAt: new Date(`${p.date}T00:00:00Z`),
          claimEmergedPrecision: "DAY",
          metadata: merged,
        },
      });
      if (res.count === 1) {
        counts.updated++;
        console.log(`  + dated ${p.date}  ${p.entryName}  claim=${p.claimId}`);
      } else {
        counts.skippedRace++;
      }
    }
  }

  fs.mkdirSync(path.dirname(RESIDUE_PATH), { recursive: true });
  fs.writeFileSync(RESIDUE_PATH, residue.map((r) => JSON.stringify(r)).join("\n") + (residue.length ? "\n" : ""));

  console.log(`\n── Summary ──`);
  console.log(counts);
  console.log(`Residue (${residue.length}${counts.unmatched > 200 ? `; unmatched sampled at 200 of ${counts.unmatched}` : ""}) → ${RESIDUE_PATH}`);
  if (!EXECUTE) {
    console.log(`\nPreflight only. Review the sample above (STOP gate), then re-run with --execute.`);
  } else {
    console.log(`\nNext: Layer-1 baselines → re-run delistings --since 2026-06-04 → audit --pipeline ${PIPELINE} (commands in the file header).`);
  }
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
