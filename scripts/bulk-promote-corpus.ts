/**
 * bulk-promote-corpus.ts — deterministic bulk settling-curve completion ("Layer 1.5").
 *
 * Converts single-step corpus claims (exactly one ClaimStatusHistory row, the
 * Layer-1 baseline with fromAxis = null) into multi-step settling curves using
 * per-pipeline deterministic rules — one INSERT ... SELECT per pipeline, no LLM.
 *
 * Companion plan: CORPUS-PROMOTER-BULK-PLAN.md (rules rationale, edge cases,
 * corrections to the original corpus-promoter briefing).
 *
 * IMPORTANT — what the briefing got wrong (verified against
 * scripts/ingest-auto-trajectories.ts, which created the baseline rows):
 *   - Legislation pipelines' baseline rows are toAxis=SETTLED (not RECORDED).
 *     A blanket "add RECORDED→SETTLED" would no-op or corrupt them. They are
 *     born-settled: their single-step curve is already complete.
 *   - crossref_retractions_v1 baselines are toAxis=REVERSED. The fix there is
 *     to PREPEND the publication row and re-point the baseline's fromAxis
 *     (wave 2, opt-in), mirroring populate-retraction-curves.ts Phase A.
 *   - drugsatfda_v1 baselines are SETTLED (briefing grouped it with
 *     openfda_labels_v1, which is RECORDED). Only the latter gets a rule.
 *
 * Every rule is guarded by the baseline row's expected toAxis, so a rule can
 * never touch a claim whose curve doesn't match the shape it was written for.
 *
 * House rules honored (populate-retraction-curves.ts / AGENTS.md / security model):
 *   - NEVER fabricates a date: occurredAt comes from claimEmergedAt or a
 *     metadata field — rows without a usable date are skipped and counted.
 *   - Deterministic ids `${claimId}-${toAxis}-${YYYY-MM-DD}` + ON CONFLICT DO
 *     NOTHING → idempotent (same slug convention as corpus-promoter-prompt.md).
 *   - Existing baseline rows are never modified in wave 1. Wave 2 amends ONLY
 *     the fromAxis column of retraction baselines (null → 'RECORDED'), and only
 *     behind --allow-entry-amend.
 *   - All SQL runs through $queryRawUnsafe/$executeRawUnsafe with $1..$n bind
 *     parameters (security-model rule 2) — no value is ever interpolated into
 *     the statement text. The sqlt`` tag below renders fragments to
 *     { text, params } pairs.
 *   - $transaction timeout raised per AGENTS.md large-pipeline rule.
 *   - Counters are verified against DB state, not in-script tallies.
 *
 * Usage (dry-run/preflight is the DEFAULT — prints a report, writes nothing):
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts --pipeline voteview_v1
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts --print-sql
 *
 * Execute wave 1 (pure additive inserts):
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts \
 *     --execute --direct [--pipeline voteview_v1] [--sync-axis]
 *
 * Execute wave 2 (retractions: prepend publication + re-point baseline fromAxis):
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts \
 *     --execute --direct --wave 2 --allow-entry-amend --pub-date-key <metadataKey>
 *
 * Flags:
 *   --execute           actually write (default: read-only preflight report)
 *   --wave <1|2>        which rule wave to run (default 1)
 *   --pipeline <tag>    restrict to one pipeline (repeatable)
 *   --sync-axis         after inserting, sync Claim.epistemicAxis to the new
 *                       terminal status (default OFF — changes site-wide stats)
 *   --allow-entry-amend required for wave 2's one-column baseline UPDATE
 *   --pub-date-key <k>  metadata key holding the original publication date
 *                       (wave 2; discover candidates via the preflight report)
 *   --direct            use DIRECT_URL (non-pooled) — recommended for --execute
 *   --print-sql         print the exact SQL that would run, then exit
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// ── Minimal SQL fragment tag: bind-parameterized, nestable, testable ──────────
export type SqlFrag = {
  readonly __sql: true;
  readonly parts: readonly string[];
  readonly values: readonly unknown[];
};
const isFrag = (v: unknown): v is SqlFrag =>
  typeof v === "object" && v !== null && (v as { __sql?: unknown }).__sql === true;

export function sqlt(parts: TemplateStringsArray, ...values: unknown[]): SqlFrag {
  return { __sql: true, parts: Array.from(parts), values };
}

/** Render a fragment tree to { text, params } with $1..$n placeholders. */
export function render(frag: SqlFrag): { text: string; params: unknown[] } {
  const params: unknown[] = [];
  const walk = (f: SqlFrag): string => {
    let out = f.parts[0];
    f.values.forEach((v, i) => {
      out += isFrag(v) ? walk(v) : `$${params.push(v)}`;
      out += f.parts[i + 1];
    });
    return out;
  };
  return { text: walk(frag), params };
}

/** Render with values inlined as quoted literals — for --print-sql review only. */
export function renderLiteral(frag: SqlFrag): string {
  const { text, params } = render(frag);
  return text.replace(/\$(\d+)/g, (_, n) => {
    const v = params[Number(n) - 1];
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  });
}

// ── Types (string literals kept in sync with prisma enums; toAxis/fromAxis are
//    TEXT columns by design — see schema comment on FactStatus) ───────────────
export type FactStatusT =
  | "RECORDED" | "SETTLED" | "CONTESTED" | "OPEN"
  | "UNRESOLVABLE" | "REVERSED" | "ABANDONED";
export type CommunityT =
  | "EXPERT_LITERATURE" | "INSTITUTIONAL" | "JUDICIAL" | "PUBLIC" | "MARKET";

export interface ForwardRule {
  pipeline: string;
  /** Guard: only complete curves whose Layer-1 baseline row has this toAxis. */
  expectedEntryAxis: FactStatusT;
  toAxis: FactStatusT;
  community: CommunityT;
  reason: string;
  note?: string;
}

// ── Wave 1: forward completion, pure additive INSERT ... SELECT ──────────────
// Only pipelines whose baseline is RECORDED and whose completing transition is
// deterministic from data already in the DB. occurredAt = claimEmergedAt (the
// same certified event date the baseline used — no fabricated dates).
//
// Deliberately EXCLUDED from wave 1 (see plan doc §3):
//   - all *_legislation_v1, drugsatfda_v1, courts, un_sc, nobel… — baseline is
//     already SETTLED (born-settled; single-step is the complete curve)
//   - worldbank_v1, who_gho_v1, vdem_v1, fred_v1… — indicators; RECORDED is
//     their honest terminal state (values are subject to revision)
//   - chebi_v1, nara_catalog_v1, jacar_v1, openalex_journals_v1, sec_edgar_v1,
//     fec/fara filings… — registry/archival facts; born-recorded, complete
//   - congress_bills_tracker_v1, nz_bills_v1 — outcome not yet determined for
//     in-flight bills; needs metadata-conditional handling (wave 3, future)
//   - openalex_v1 — genuinely needs research; stays with the LLM promoter
const VOTE_REASON =
  "Roll-call result certified in the official parliamentary record — the recorded outcome is institutionally settled.";

export const WAVE1_RULES: ForwardRule[] = [
  {
    pipeline: "voteview_v1",
    expectedEntryAxis: "RECORDED",
    toAxis: "SETTLED",
    community: "INSTITUTIONAL",
    reason:
      "Roll-call result certified in the official congressional record (House/Senate Journal; Voteview/ICPSR archive) — the recorded outcome is institutionally settled.",
  },
  { pipeline: "congress_votes_v1", expectedEntryAxis: "RECORDED", toAxis: "SETTLED", community: "INSTITUTIONAL", reason: VOTE_REASON },
  { pipeline: "uk_commons_v1", expectedEntryAxis: "RECORDED", toAxis: "SETTLED", community: "INSTITUTIONAL", reason: VOTE_REASON },
  { pipeline: "openparliament_ca_v1", expectedEntryAxis: "RECORDED", toAxis: "SETTLED", community: "INSTITUTIONAL", reason: VOTE_REASON },
  { pipeline: "howtheyvote_eu_v1", expectedEntryAxis: "RECORDED", toAxis: "SETTLED", community: "INSTITUTIONAL", reason: VOTE_REASON },
  { pipeline: "eu_parliament_v1", expectedEntryAxis: "RECORDED", toAxis: "SETTLED", community: "INSTITUTIONAL", reason: VOTE_REASON },
  { pipeline: "tweedekamer_v1", expectedEntryAxis: "RECORDED", toAxis: "SETTLED", community: "INSTITUTIONAL", reason: VOTE_REASON },
  {
    pipeline: "openfda_labels_v1",
    expectedEntryAxis: "RECORDED",
    toAxis: "SETTLED",
    community: "INSTITUTIONAL",
    reason:
      "FDA marketing authorization in force — the approved label is the operative regulatory document for this product.",
  },
  {
    pipeline: "canada_bills_v1",
    expectedEntryAxis: "RECORDED",
    toAxis: "SETTLED",
    community: "INSTITUTIONAL",
    reason: "Bill received Royal Assent and was enacted into Canadian law.",
    note: "Ingester scope is assented bills only (35th–45th Parliament), so SETTLED is safe here.",
  },
];

// ── Wave 2: crossref_retractions_v1 — prepend publication, re-point baseline ──
export const RETRACTION_PIPELINE = "crossref_retractions_v1";
export const PUB_REASON =
  "Original paper published, entering the expert literature via peer review.";

// Candidate metadata keys scanned by the preflight to find the publication date.
// "originalPublished" is written by scripts/backfill-retraction-pub-dates.ts
// (the ingester itself stores no publication date — verified 2026-07-03).
const PUB_DATE_KEY_CANDIDATES = [
  "originalPublished",
  "publishedAt", "published", "publicationDate", "publication_date",
  "originalPublicationDate", "original_publication_date", "issued",
  "pubDate", "publishedDate", "published_print", "published_online",
];

// ISO-date-shaped (safe to cast the first 10 chars to timestamp).
const ISO_DAY_RE = "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])";
const ISO_MONTH_RE = "^\\d{4}-(0[1-9]|1[0-2])$";
const YEAR_RE = "^\\d{4}$";

// ── SQL fragments ─────────────────────────────────────────────────────────────

/** Claims in `pipeline` that are live and strictly single-step (their only
 *  history row is the Layer-1 baseline, fromAxis IS NULL). */
export function singleStepJoin(pipeline: string): SqlFrag {
  return sqlt`
    FROM "Claim" c
    JOIN "ClaimStatusHistory" h
      ON h."claimId" = c.id AND h."fromAxis" IS NULL
    WHERE c."ingestedBy" = ${pipeline}
      AND c.deleted = false
      AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
      AND NOT EXISTS (
        SELECT 1 FROM "ClaimStatusHistory" h2
        WHERE h2."claimId" = c.id AND h2.id <> h.id
      )`;
}

export function wave1InsertSql(rule: ForwardRule): SqlFrag {
  return sqlt`
    INSERT INTO "ClaimStatusHistory"
      (id, "claimId", "fromAxis", "toAxis", community, reason, "occurredAt", "datePrecision")
    SELECT
      c.id || '-' || ${rule.toAxis} || '-' || to_char(c."claimEmergedAt", 'YYYY-MM-DD'),
      c.id,
      h."toAxis",
      ${rule.toAxis},
      ${rule.community}::"RatifyingCommunity",
      ${rule.reason},
      c."claimEmergedAt",
      COALESCE(c."claimEmergedPrecision", h."datePrecision", 'DAY')
    ${singleStepJoin(rule.pipeline)}
      AND h."toAxis" = ${rule.expectedEntryAxis}
      AND c."claimEmergedAt" IS NOT NULL
    ON CONFLICT (id) DO NOTHING`;
}

/** Sync Claim.epistemicAxis for claims that carry our deterministic promo row.
 *  Keyed off the row id, so it is correct even inside the same transaction as
 *  the insert, and idempotent across re-runs. */
export function syncAxisSql(rule: ForwardRule): SqlFrag {
  return sqlt`
    UPDATE "Claim" c
    SET "epistemicAxis" = ${rule.toAxis}
    WHERE c."ingestedBy" = ${rule.pipeline}
      AND c.deleted = false
      AND c."epistemicAxis" IS DISTINCT FROM ${rule.toAxis}
      AND EXISTS (
        SELECT 1 FROM "ClaimStatusHistory" h
        WHERE h."claimId" = c.id
          AND h.id = c.id || '-' || ${rule.toAxis} || '-' || to_char(c."claimEmergedAt", 'YYYY-MM-DD')
      )`;
}

/** Wave 2 eligibility: single-step REVERSED retraction claims with a parseable
 *  publication date at metadata->>key. Full ISO dates → DAY; "YYYY-MM" → MONTH
 *  (1st of month); bare years → YEAR (Jan-1). Truncated timestamp + precision
 *  label is the schema's own convention (claimEmergedPrecision). */
function retractionEligibleSql(key: string): SqlFrag {
  return sqlt`
    SELECT
      c.id AS claim_id,
      h."occurredAt" AS retracted_at,
      CASE
        WHEN (c.metadata->>${key}) ~ ${ISO_DAY_RE}
          THEN substring(c.metadata->>${key} from 1 for 10)::timestamp
        WHEN (c.metadata->>${key}) ~ ${ISO_MONTH_RE}
          THEN make_timestamp(
            substring(c.metadata->>${key} from 1 for 4)::int,
            substring(c.metadata->>${key} from 6 for 2)::int, 1, 0, 0, 0)
        WHEN (c.metadata->>${key}) ~ ${YEAR_RE}
          THEN make_timestamp((c.metadata->>${key})::int, 1, 1, 0, 0, 0)
      END AS pub_at,
      CASE
        WHEN (c.metadata->>${key}) ~ ${ISO_DAY_RE} THEN 'DAY'
        WHEN (c.metadata->>${key}) ~ ${ISO_MONTH_RE} THEN 'MONTH'
        WHEN (c.metadata->>${key}) ~ ${YEAR_RE} THEN 'YEAR'
      END AS pub_precision
    ${singleStepJoin(RETRACTION_PIPELINE)}
      AND h."toAxis" = 'REVERSED'`;
}

/** Wave 2, statement 1: prepend `null → RECORDED` at the publication date.
 *  Skips rows without a parseable date or where pub date >= retraction date. */
export function wave2InsertSql(key: string): SqlFrag {
  return sqlt`
    INSERT INTO "ClaimStatusHistory"
      (id, "claimId", "fromAxis", "toAxis", community, reason, "occurredAt", "datePrecision")
    SELECT
      e.claim_id || '-RECORDED-' || to_char(e.pub_at, 'YYYY-MM-DD'),
      e.claim_id, NULL, 'RECORDED',
      'EXPERT_LITERATURE'::"RatifyingCommunity",
      ${PUB_REASON},
      e.pub_at, e.pub_precision
    FROM (${retractionEligibleSql(key)}) e
    WHERE e.pub_at IS NOT NULL
      AND e.pub_at < e.retracted_at
    ON CONFLICT (id) DO NOTHING`;
}

// ── Wave 3: bill lifecycles — metadata-conditional forward completion ─────────
// congress_bills_tracker_v1 baselines are null→RECORDED @ introducedDate.
// The ingester (scripts/ingest-congress-bills-tracker.ts) stores the outcome:
//   metadata.statusSlug ∈ status-introduced | status-passed-house |
//     status-passed-senate | status-enacted | status-vetoed | status-failed |
//     status-in-progress
//   metadata.latestActionDate (YYYY-MM-DD), metadata.congress (number)
// Rules (all single-step + entry-axis guarded, dates from metadata only):
//   status-enacted → RECORDED→SETTLED  @ latestActionDate
//   status-failed  → RECORDED→ABANDONED @ latestActionDate
//   anything else whose congress has ENDED → RECORDED→ABANDONED @ term end
//     (bills die with their congress; sitting congresses are honest OPEN
//      business and are left single-step — re-run after a term ends)
export const BILLS_PIPELINE = "congress_bills_tracker_v1";

/** Congress end dates (noon Jan 3, per 20th Amendment). Only congresses whose
 *  end date is in the past ever fire; the map is safe to extend. */
export const CONGRESS_END: Record<number, string> = {
  115: "2019-01-03",
  116: "2021-01-03",
  117: "2023-01-03",
  118: "2025-01-03",
  119: "2027-01-03",
};

const ENACTED_REASON =
  "Enacted into law — Congress.gov recorded the final action (became law).";
const FAILED_REASON =
  "Failed passage — terminal action recorded by Congress.gov.";

/** status-enacted / status-failed → terminal transition @ latestActionDate. */
export function wave3OutcomeSql(kind: "enacted" | "failed"): SqlFrag {
  const toAxis = kind === "enacted" ? "SETTLED" : "ABANDONED";
  const slug = kind === "enacted" ? "status-enacted" : "status-failed";
  const reason = kind === "enacted" ? ENACTED_REASON : FAILED_REASON;
  return sqlt`
    INSERT INTO "ClaimStatusHistory"
      (id, "claimId", "fromAxis", "toAxis", community, reason, "occurredAt", "datePrecision")
    SELECT
      c.id || '-' || ${toAxis} || '-' || (c.metadata->>'latestActionDate'),
      c.id,
      h."toAxis",
      ${toAxis},
      'INSTITUTIONAL'::"RatifyingCommunity",
      ${reason},
      (c.metadata->>'latestActionDate')::timestamp,
      'DAY'
    ${singleStepJoin(BILLS_PIPELINE)}
      AND h."toAxis" = 'RECORDED'
      AND c.metadata->>'statusSlug' = ${slug}
      AND (c.metadata->>'latestActionDate') ~ ${ISO_DAY_RE}
      AND (c.metadata->>'latestActionDate')::timestamp >= h."occurredAt"
    ON CONFLICT (id) DO NOTHING`;
}

/** Bills of an ENDED congress that never reached a terminal action → ABANDONED
 *  at that congress's end date. Never fires for sitting congresses. */
export function wave3DiedWithCongressSql(congress: number, endDate: string): SqlFrag {
  const reason = `Died with the ${congress}th Congress — introduced but not enacted before the term ended ${endDate}.`;
  return sqlt`
    INSERT INTO "ClaimStatusHistory"
      (id, "claimId", "fromAxis", "toAxis", community, reason, "occurredAt", "datePrecision")
    SELECT
      c.id || '-ABANDONED-' || ${endDate},
      c.id,
      h."toAxis",
      'ABANDONED',
      'INSTITUTIONAL'::"RatifyingCommunity",
      ${reason},
      ${endDate}::timestamp,
      'DAY'
    ${singleStepJoin(BILLS_PIPELINE)}
      AND h."toAxis" = 'RECORDED'
      AND (c.metadata->>'congress') = ${String(congress)}
      AND (c.metadata->>'statusSlug') NOT IN ('status-enacted', 'status-failed')
    ON CONFLICT (id) DO NOTHING`;
}

export function endedCongresses(now = new Date()): [number, string][] {
  return Object.entries(CONGRESS_END)
    .map(([c, d]) => [Number(c), d] as [number, string])
    .filter(([, d]) => new Date(d + "T12:00:00Z") < now)
    .sort((a, b) => a[0] - b[0]);
}

/** Wave 2, statement 2: re-point the baseline row's fromAxis (null → RECORDED)
 *  ONLY where our prepended publication row exists. Self-healing + idempotent. */
export function wave2AmendSql(): SqlFrag {
  return sqlt`
    UPDATE "ClaimStatusHistory" h
    SET "fromAxis" = 'RECORDED'
    FROM "Claim" c, "ClaimStatusHistory" pub
    WHERE c.id = h."claimId"
      AND c."ingestedBy" = ${RETRACTION_PIPELINE}
      AND h."fromAxis" IS NULL
      AND h."toAxis" = 'REVERSED'
      AND pub."claimId" = h."claimId"
      AND pub.id <> h.id
      AND pub."toAxis" = 'RECORDED'
      AND pub."fromAxis" IS NULL
      AND pub.reason = ${PUB_REASON}`;
}

// ── CLI / runtime (only used when executed directly, not when imported) ───────
const ARGS = process.argv.slice(2);
const EXECUTE = ARGS.includes("--execute");
const PRINT_SQL = ARGS.includes("--print-sql");
const SYNC_AXIS = ARGS.includes("--sync-axis");
const ALLOW_ENTRY_AMEND = ARGS.includes("--allow-entry-amend");
const USE_DIRECT = ARGS.includes("--direct");

function argValue(flag: string): string | null {
  const idx = ARGS.indexOf(flag);
  if (idx === -1) return null;
  const val = ARGS[idx + 1];
  if (!val || val.startsWith("--")) {
    console.error(`Missing value for ${flag}`);
    process.exit(1);
  }
  return val;
}
function argValues(flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < ARGS.length; i++) {
    if (ARGS[i] === flag && ARGS[i + 1] && !ARGS[i + 1].startsWith("--")) out.push(ARGS[i + 1]);
  }
  return out;
}

const WAVE = parseInt(argValue("--wave") ?? "1", 10);
const PIPELINE_FILTER = argValues("--pipeline");
const PUB_DATE_KEY = argValue("--pub-date-key");

// Lazy client so importing this module (e.g. from tests) never needs a DB.
let _prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!_prisma) {
    // --direct must take effect before the client is constructed.
    if (USE_DIRECT) {
      if (!process.env.DIRECT_URL) {
        console.error("--direct passed but DIRECT_URL is not set");
        process.exit(1);
      }
      process.env.DATABASE_URL = process.env.DIRECT_URL;
    }
    _prisma = new PrismaClient();
  }
  return _prisma;
}

async function q<T>(frag: SqlFrag): Promise<T[]> {
  const { text, params } = render(frag);
  return (await db().$queryRawUnsafe(text, ...params)) as T[];
}
async function one<T>(frag: SqlFrag): Promise<T> {
  return (await q<T>(frag))[0];
}

type CountRow = { n: number | bigint };
const num = (v: number | bigint | unknown) => Number(v);

// ── Preflight (read-only) ─────────────────────────────────────────────────────
async function preflightRule(rule: ForwardRule): Promise<number> {
  const [total, byAxis, projected, missingDate, multi, none] = await Promise.all([
    one<CountRow>(sqlt`
      SELECT COUNT(*) n FROM "Claim" c
      WHERE c."ingestedBy" = ${rule.pipeline} AND c.deleted = false
        AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'`),
    q<{ toAxis: string; n: number | bigint }>(sqlt`
      SELECT h."toAxis", COUNT(*) n ${singleStepJoin(rule.pipeline)}
      GROUP BY h."toAxis" ORDER BY n DESC`),
    one<CountRow>(sqlt`
      SELECT COUNT(*) n ${singleStepJoin(rule.pipeline)}
        AND h."toAxis" = ${rule.expectedEntryAxis}
        AND c."claimEmergedAt" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "ClaimStatusHistory" p
          WHERE p.id = c.id || '-' || ${rule.toAxis} || '-' || to_char(c."claimEmergedAt", 'YYYY-MM-DD')
        )`),
    one<CountRow>(sqlt`
      SELECT COUNT(*) n ${singleStepJoin(rule.pipeline)}
        AND h."toAxis" = ${rule.expectedEntryAxis}
        AND c."claimEmergedAt" IS NULL`),
    one<CountRow>(sqlt`
      SELECT COUNT(*) n FROM "Claim" c
      WHERE c."ingestedBy" = ${rule.pipeline} AND c.deleted = false
        AND (SELECT COUNT(*) FROM "ClaimStatusHistory" x WHERE x."claimId" = c.id) >= 2`),
    one<CountRow>(sqlt`
      SELECT COUNT(*) n FROM "Claim" c
      WHERE c."ingestedBy" = ${rule.pipeline} AND c.deleted = false
        AND NOT EXISTS (SELECT 1 FROM "ClaimStatusHistory" h WHERE h."claimId" = c.id)`),
  ]);

  console.log(`\n── ${rule.pipeline} ─ ${rule.expectedEntryAxis} → ${rule.toAxis} (${rule.community})`);
  if (rule.note) console.log(`   note: ${rule.note}`);
  console.log(`   live claims:                 ${num(total.n)}`);
  console.log(`   already multi-step:          ${num(multi.n)}`);
  console.log(`   no history at all:           ${num(none.n)}  (Layer-1 gap — run ingest-auto-trajectories first)`);
  for (const r of byAxis) {
    const flag = r.toAxis === rule.expectedEntryAxis ? "" : "  ← UNEXPECTED entry axis, will be skipped";
    console.log(`   single-step @ ${r.toAxis.padEnd(12)} ${num(r.n)}${flag}`);
  }
  console.log(`   missing claimEmergedAt:      ${num(missingDate.n)}  (skipped — never fabricate dates)`);
  console.log(`   → PROJECTED INSERTS:         ${num(projected.n)}`);

  const samples = await q<{ id: string; text: string; d: Date | null }>(sqlt`
    SELECT c.id, left(c.text, 96) AS text, c."claimEmergedAt" AS d
    ${singleStepJoin(rule.pipeline)}
      AND h."toAxis" = ${rule.expectedEntryAxis} AND c."claimEmergedAt" IS NOT NULL
    LIMIT 3`);
  for (const s of samples)
    console.log(`     e.g. [${s.id}] ${s.d ? new Date(s.d).toISOString().slice(0, 10) : "?"} — ${s.text}`);
  return num(projected.n);
}

async function preflightRetractions(): Promise<void> {
  console.log(`\n── ${RETRACTION_PIPELINE} ─ wave 2: prepend RECORDED @ publication, re-point baseline`);
  const byAxis = await q<{ toAxis: string; n: number | bigint }>(sqlt`
    SELECT h."toAxis", COUNT(*) n ${singleStepJoin(RETRACTION_PIPELINE)}
    GROUP BY h."toAxis" ORDER BY n DESC`);
  for (const r of byAxis) console.log(`   single-step @ ${r.toAxis.padEnd(12)} ${num(r.n)}`);

  console.log(`   metadata key coverage among single-step claims (candidates for --pub-date-key):`);
  for (const key of PUB_DATE_KEY_CANDIDATES) {
    const c = await one<CountRow>(sqlt`
      SELECT COUNT(*) n ${singleStepJoin(RETRACTION_PIPELINE)}
        AND h."toAxis" = 'REVERSED'
        AND ((c.metadata->>${key}) ~ ${ISO_DAY_RE} OR (c.metadata->>${key}) ~ ${ISO_MONTH_RE} OR (c.metadata->>${key}) ~ ${YEAR_RE})`);
    if (num(c.n) > 0) console.log(`     metadata.${key.padEnd(28)} ${num(c.n)} parseable dates`);
  }
  const keys = await q<{ k: string; n: number | bigint }>(sqlt`
    SELECT k, COUNT(*) n FROM (
      SELECT jsonb_object_keys(c.metadata) k ${singleStepJoin(RETRACTION_PIPELINE)}
        AND c.metadata IS NOT NULL LIMIT 50000
    ) s GROUP BY k ORDER BY n DESC LIMIT 15`);
  console.log(`   most common metadata keys (sampled):`);
  for (const r of keys) console.log(`     ${r.k.padEnd(30)} ${num(r.n)}`);

  if (PUB_DATE_KEY) {
    const proj = await one<CountRow>(sqlt`
      SELECT COUNT(*) n FROM (${retractionEligibleSql(PUB_DATE_KEY)}) e
      WHERE e.pub_at IS NOT NULL AND e.pub_at < e.retracted_at`);
    console.log(`   → PROJECTED INSERTS with --pub-date-key ${PUB_DATE_KEY}: ${num(proj.n)} (+ same number of fromAxis amendments)`);
  } else {
    console.log(`   (pass --pub-date-key <key> to see projected inserts)`);
  }
}

async function preflightWave3(): Promise<void> {
  console.log(`\n── ${BILLS_PIPELINE} ─ wave 3: bill lifecycles (metadata-conditional)`);
  const statuses = await q<{ slug: string | null; n: number | bigint; dated: number | bigint }>(sqlt`
    SELECT c.metadata->>'statusSlug' AS slug, COUNT(*) n,
           COUNT(*) FILTER (WHERE (c.metadata->>'latestActionDate') ~ ${ISO_DAY_RE}) AS dated
    ${singleStepJoin(BILLS_PIPELINE)}
      AND h."toAxis" = 'RECORDED'
    GROUP BY 1 ORDER BY n DESC`);
  console.log(`   single-step bills by statusSlug (dated = parseable latestActionDate):`);
  for (const r of statuses)
    console.log(`     ${(r.slug ?? "(none)").padEnd(24)} ${String(num(r.n)).padStart(7)}   dated ${num(r.dated)}`);

  const congresses = await q<{ congress: string | null; n: number | bigint }>(sqlt`
    SELECT c.metadata->>'congress' AS congress, COUNT(*) n
    ${singleStepJoin(BILLS_PIPELINE)} AND h."toAxis" = 'RECORDED'
    GROUP BY 1 ORDER BY 1`);
  console.log(`   by congress: ${congresses.map((r) => `${r.congress ?? "?"}: ${num(r.n)}`).join("  ·  ")}`);
  const ended = endedCongresses();
  console.log(`   ended congresses eligible for died-with-congress: ${ended.map(([c, d]) => `${c} (${d})`).join(", ") || "none in data range"}`);

  console.log(`\n   projected inserts:`);
  console.log(`     enacted → SETTLED:   ${num((await one<CountRow>(sqlt`SELECT COUNT(*) n ${singleStepJoin(BILLS_PIPELINE)} AND h."toAxis"='RECORDED' AND c.metadata->>'statusSlug'='status-enacted' AND (c.metadata->>'latestActionDate') ~ ${ISO_DAY_RE} AND (c.metadata->>'latestActionDate')::timestamp >= h."occurredAt"`)).n)}`);
  console.log(`     failed  → ABANDONED: ${num((await one<CountRow>(sqlt`SELECT COUNT(*) n ${singleStepJoin(BILLS_PIPELINE)} AND h."toAxis"='RECORDED' AND c.metadata->>'statusSlug'='status-failed' AND (c.metadata->>'latestActionDate') ~ ${ISO_DAY_RE} AND (c.metadata->>'latestActionDate')::timestamp >= h."occurredAt"`)).n)}`);
  for (const [cg, endDate] of ended) {
    const n = await one<CountRow>(sqlt`SELECT COUNT(*) n ${singleStepJoin(BILLS_PIPELINE)} AND h."toAxis"='RECORDED' AND (c.metadata->>'congress') = ${String(cg)} AND (c.metadata->>'statusSlug') NOT IN ('status-enacted','status-failed')`);
    console.log(`     died with ${cg}th   → ABANDONED @ ${endDate}: ${num(n.n)}`);
  }

  // Reconnaissance for the future NZ rules (report-only, no rules yet).
  for (const p of ["nz_bills_v1", "nz_repealed_acts_v1"]) {
    const keys = await q<{ k: string; n: number | bigint }>(sqlt`
      SELECT k, COUNT(*) n FROM (
        SELECT jsonb_object_keys(c.metadata) k ${singleStepJoin(p)} AND c.metadata IS NOT NULL LIMIT 20000
      ) s GROUP BY k ORDER BY n DESC LIMIT 10`);
    if (keys.length)
      console.log(`\n   ${p} metadata keys (for future rules): ${keys.map((r) => `${r.k}(${num(r.n)})`).join(", ")}`);
  }
}

async function executeWave3(): Promise<void> {
  const ended = endedCongresses();
  const frags: [string, SqlFrag][] = [
    ["enacted→SETTLED", wave3OutcomeSql("enacted")],
    ["failed→ABANDONED", wave3OutcomeSql("failed")],
    ...ended.map(([cg, d]) => [`died-with-${cg}th→ABANDONED`, wave3DiedWithCongressSql(cg, d)] as [string, SqlFrag]),
  ];
  const rendered = frags.map(([label, f]) => [label, render(f)] as const);
  const t0 = Date.now();
  const ops = [
    db().$executeRawUnsafe(`SET LOCAL statement_timeout = '600s'`),
    ...rendered.map(([, r]) => db().$executeRawUnsafe(r.text, ...r.params)),
  ];
  const results = await db().$transaction(ops);
  rendered.forEach(([label], i) =>
    console.log(`[${BILLS_PIPELINE}] ${label}: ${num(results[i + 1])} rows`),
  );
  console.log(`[${BILLS_PIPELINE}] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const verify = await one<CountRow>(sqlt`
    SELECT COUNT(*) n FROM "ClaimStatusHistory" h
    JOIN "Claim" c ON c.id = h."claimId"
    WHERE c."ingestedBy" = ${BILLS_PIPELINE} AND h."fromAxis" = 'RECORDED'`);
  console.log(`[${BILLS_PIPELINE}] DB verification: ${num(verify.n)} chained transitions now present`);
}

// ── Execution ─────────────────────────────────────────────────────────────────
async function execFrag(frag: SqlFrag): Promise<number> {
  const { text, params } = render(frag);
  return num(await db().$executeRawUnsafe(text, ...params));
}

async function executeWave1(rules: ForwardRule[]): Promise<void> {
  for (const rule of rules) {
    const t0 = Date.now();
    const ops = [
      db().$executeRawUnsafe(`SET LOCAL statement_timeout = '600s'`),
      (() => { const r = render(wave1InsertSql(rule)); return db().$executeRawUnsafe(r.text, ...r.params); })(),
      ...(SYNC_AXIS ? [(() => { const r = render(syncAxisSql(rule)); return db().$executeRawUnsafe(r.text, ...r.params); })()] : []),
    ];
    const results = await db().$transaction(ops);
    const inserted = num(results[1]);
    const synced = SYNC_AXIS ? num(results[2]) : 0;
    console.log(
      `[${rule.pipeline}] inserted ${inserted} rows${SYNC_AXIS ? `, synced epistemicAxis on ${synced} claims` : ""} in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
    // AGENTS.md: verify against DB state, not in-script counters.
    const verify = await one<CountRow>(sqlt`
      SELECT COUNT(*) n FROM "ClaimStatusHistory" h
      JOIN "Claim" c ON c.id = h."claimId"
      WHERE c."ingestedBy" = ${rule.pipeline}
        AND h."fromAxis" = ${rule.expectedEntryAxis} AND h."toAxis" = ${rule.toAxis}`);
    console.log(`[${rule.pipeline}] DB verification: ${num(verify.n)} ${rule.expectedEntryAxis}→${rule.toAxis} rows now present`);
  }
}

async function executeWave2(): Promise<void> {
  if (!ALLOW_ENTRY_AMEND) {
    console.error(
      "Wave 2 re-points the retraction baseline rows' fromAxis (null → 'RECORDED').\n" +
      "That is a one-column amendment of existing rows — re-run with --allow-entry-amend to consent.",
    );
    process.exit(1);
  }
  if (!PUB_DATE_KEY) {
    console.error("Wave 2 requires --pub-date-key <metadataKey>. Run preflight first to see candidates.");
    process.exit(1);
  }
  const t0 = Date.now();
  const ins = render(wave2InsertSql(PUB_DATE_KEY));
  const amd = render(wave2AmendSql());
  const [, inserted, amended] = await db().$transaction([
    db().$executeRawUnsafe(`SET LOCAL statement_timeout = '600s'`),
    db().$executeRawUnsafe(ins.text, ...ins.params),
    db().$executeRawUnsafe(amd.text, ...amd.params),
  ] as const);
  console.log(
    `[${RETRACTION_PIPELINE}] prepended ${num(inserted)} publication rows, re-pointed ${num(amended)} baselines in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  const dangling = await one<CountRow>(sqlt`
    SELECT COUNT(*) n FROM "ClaimStatusHistory" pub
    JOIN "Claim" c ON c.id = pub."claimId"
    WHERE c."ingestedBy" = ${RETRACTION_PIPELINE}
      AND pub."fromAxis" IS NULL AND pub."toAxis" = 'RECORDED' AND pub.reason = ${PUB_REASON}
      AND NOT EXISTS (
        SELECT 1 FROM "ClaimStatusHistory" rev
        WHERE rev."claimId" = pub."claimId" AND rev."fromAxis" = 'RECORDED' AND rev."toAxis" = 'REVERSED'
      )`);
  console.log(`[${RETRACTION_PIPELINE}] DB verification: ${num(dangling.n)} publication rows lack a chained REVERSED row (expect 0)`);
}

// ── SQL preview / selection ───────────────────────────────────────────────────
function wave1Selection(): ForwardRule[] {
  const unknown = PIPELINE_FILTER.filter((p) => !WAVE1_RULES.some((r) => r.pipeline === p));
  if (unknown.length && WAVE === 1) {
    console.error(`No wave-1 rule for: ${unknown.join(", ")} (see plan doc for why some pipelines are excluded)`);
    process.exit(1);
  }
  return PIPELINE_FILTER.length
    ? WAVE1_RULES.filter((r) => PIPELINE_FILTER.includes(r.pipeline))
    : WAVE1_RULES;
}

function printSql(): void {
  const dump = (label: string, f: SqlFrag) => console.log(`\n-- ${label}\n${renderLiteral(f)};`);
  if (WAVE === 1) {
    for (const rule of wave1Selection()) {
      dump(`wave 1 insert — ${rule.pipeline}`, wave1InsertSql(rule));
      if (SYNC_AXIS) dump(`wave 1 axis sync — ${rule.pipeline}`, syncAxisSql(rule));
    }
  } else {
    dump("wave 2 insert — crossref_retractions_v1", wave2InsertSql(PUB_DATE_KEY ?? "<pub-date-key>"));
    dump("wave 2 baseline amend — crossref_retractions_v1", wave2AmendSql());
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (PRINT_SQL) {
    printSql();
    return;
  }

  console.log(
    `bulk-promote-corpus — wave ${WAVE} — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (read-only; pass --execute to write)"}${USE_DIRECT ? " — direct (non-pooled)" : ""}`,
  );

  if (WAVE === 1) {
    const rules = wave1Selection();
    if (!EXECUTE) {
      let totalProjected = 0;
      for (const rule of rules) totalProjected += await preflightRule(rule);
      console.log(`\nTOTAL PROJECTED WAVE-1 INSERTS: ${totalProjected}`);
      console.log(`(re-run with --execute --direct to apply; add --sync-axis to also update Claim.epistemicAxis)`);
    } else {
      await executeWave1(rules);
    }
  } else if (WAVE === 2) {
    if (!EXECUTE) {
      await preflightRetractions();
      console.log(`\n(re-run with --execute --direct --wave 2 --allow-entry-amend --pub-date-key <key> to apply)`);
    } else {
      await executeWave2();
    }
  } else if (WAVE === 3) {
    if (!EXECUTE) {
      await preflightWave3();
      console.log(`\n(re-run with --execute --direct --wave 3 to apply; sitting congresses stay single-step by design)`);
    } else {
      await executeWave3();
    }
  } else {
    console.error(`Unknown wave: ${WAVE}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => _prisma?.$disconnect());
}
