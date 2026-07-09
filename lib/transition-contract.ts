/**
 * transition-contract.ts — THE single write path for ClaimStatusHistory rows.
 *
 * Every transition writer (bulk scripts, event pipelines, LLM enrichments via
 * apply-enrichment, seed scripts) should route row-level writes through
 * emitTransition(). It enforces the transition contract:
 *
 *   1. occurredAt + datePrecision come from a document, never now(), never
 *      approximated (parseFlexibleDate implements the house convention:
 *      ISO date → DAY, "YYYY-MM" → MONTH at the 1st, bare year → YEAR at Jan-1).
 *   2. Every row carries a marker Source with a fetch-verified URL
 *      (methodologyType honest), unless the caller explicitly opts out.
 *   3. fromAxis must match the claim's current terminal axis (chain coherence);
 *      entry rows (fromAxis = null) are only written when allowEntryRow is set
 *      and no entry row already exists.
 *   4. Deterministic id `${claimId}-${toAxis}-${YYYY-MM-DD}` + the DB's
 *      @@unique([claimId, toAxis, occurredAt]) make every write idempotent.
 *   5. reason is receipt-grade prose (length-guarded), written from the document.
 *   6. seq (ORDERING-SEMANTICS-2026-07-08.md): every insert assigns the row's
 *      explicit per-claim order inside the insert transaction. Appends take the
 *      next position; entry-row prepends renumber the WHOLE claim in the same
 *      transaction (never a bare max+1 counter — NZ phase-2 prepends). Existing
 *      stamps are the order authority and are preserved; only unstamped rows
 *      fall back to (occurredAt, createdAt). @@unique([claimId, seq]) guards;
 *      renumbering NULLs the claim's seqs first, so shifts never collide.
 *
 * DRY-RUN BY DEFAULT (house rule): emitTransition plans and validates but does
 * not write unless opts.execute is true. Violations are returned, not thrown —
 * the caller decides whether a skip is fatal.
 *
 * See: CORPUS-PROMOTER-BULK-PLAN.md (deterministic ids, entry-amend semantics),
 * briefings/00-INDEX.md (house rules), briefings/08-transition-event-pipelines.md.
 */

import type { PrismaClient, Prisma } from "@prisma/client";

// Works with either a full client or a transaction client.
export type Db = PrismaClient | Prisma.TransactionClient;

export type FactStatusT =
  | "RECORDED" | "SETTLED" | "CONTESTED" | "OPEN"
  | "UNRESOLVABLE" | "REVERSED" | "ABANDONED";
export type CommunityT =
  | "EXPERT_LITERATURE" | "INSTITUTIONAL" | "JUDICIAL" | "PUBLIC" | "MARKET";
export type DatePrecisionT = "DAY" | "MONTH" | "QUARTER" | "YEAR";

export const FACT_STATUSES: readonly FactStatusT[] = [
  "RECORDED", "SETTLED", "CONTESTED", "OPEN", "UNRESOLVABLE", "REVERSED", "ABANDONED",
];
export const COMMUNITIES: readonly CommunityT[] = [
  "EXPERT_LITERATURE", "INSTITUTIONAL", "JUDICIAL", "PUBLIC", "MARKET",
];

// ── Display / filter axis ─────────────────────────────────────────────────────

/**
 * Axes that exist ONLY as transition outcomes (ClaimStatusHistory.toAxis) and
 * structurally cannot appear in the 5-value Claim.epistemicAxis column. When a
 * claim's terminal transition lands on one of these, it is authoritative over
 * the stored axis for display and filtering — the stored axis is stale.
 */
export const REVERSAL_AXES: readonly FactStatusT[] = ["REVERSED", "ABANDONED"];

/**
 * The axis a claim should DISPLAY (and filter) as. Claim.epistemicAxis cannot
 * represent REVERSED/ABANDONED, so when a claim's terminal transition (the
 * latest by seq) is one of those, it overrides the stored axis; otherwise the
 * stored axis stands. This is the JS mirror of the DB-side terminal computation
 * used by the /v1/claims and /search filters (see lib/effective-axis.ts).
 *
 * seq is the order authority (contract §6); rows entering through the contract
 * are always stamped, so `seq ?? 0` reliably puts the terminal row last.
 */
export function resolveDisplayAxis(claim: {
  epistemicAxis: string | null;
  statusHistory: { toAxis: string; seq: number | null }[];
}): string | null {
  const latest = [...claim.statusHistory].sort((a, b) => (b.seq ?? 0) - (a.seq ?? 0))[0];
  if (latest && (REVERSAL_AXES as readonly string[]).includes(latest.toAxis)) {
    return latest.toAxis;
  }
  return claim.epistemicAxis;
}

// ── Dates ─────────────────────────────────────────────────────────────────────

export interface ParsedFlexibleDate {
  date: Date;
  precision: DatePrecisionT;
}

/**
 * House date convention (schema's own): "YYYY-MM-DD" → DAY, "YYYY-MM" → MONTH
 * (truncated to the 1st), "YYYY" → YEAR (truncated to Jan-1). All UTC.
 * Returns null on anything unparsable — callers must skip, never guess.
 */
export function parseFlexibleDate(input: string): ParsedFlexibleDate | null {
  const s = input.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const d = new Date(`${s}T00:00:00Z`);
    if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
    return { date: d, precision: "DAY" };
  }
  m = /^(\d{4})-(\d{2})$/.exec(s);
  if (m) {
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    return { date: new Date(`${s}-01T00:00:00Z`), precision: "MONTH" };
  }
  m = /^(\d{4})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    if (y < 1 || y > 9999) return null;
    return { date: new Date(Date.UTC(y, 0, 1)), precision: "YEAR" };
  }
  return null;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The repo's deterministic-id slug convention for bulk/idempotent writes. */
export function deterministicTransitionId(
  claimId: string,
  toAxis: FactStatusT,
  occurredAt: Date,
): string {
  return `${claimId}-${toAxis}-${isoDay(occurredAt)}`;
}

// ── URL verification ──────────────────────────────────────────────────────────

export interface UrlCheck {
  url: string;
  ok: boolean;
  status: number | null;
  note?: string;
}

const urlCheckCache = new Map<string, UrlCheck>();

/** Some public registries (constitution.congress.gov via Akamai, ADS) 403 or
 *  406 non-browser user agents. Verification retries with a browser-like UA
 *  before declaring a URL dead — a bot-UA 403 is not link rot. */
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
export const POLITE_UA = "epistemic-receipts/1.0 (transition-contract verifier)";

export const BROWSERISH_HEADERS: Record<string, string> = {
  "User-Agent": BROWSER_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * Fetch-verify a source URL (GET, redirects followed). 2xx/3xx pass.
 * Retries on 429/503 (backoff) and on 403/406 (browser UA). Results are
 * memoized per process so preflight+execute don't double-hit hosts.
 */
export async function verifyUrl(url: string, timeoutMs = 15000): Promise<UrlCheck> {
  const cached = urlCheckCache.get(url);
  if (cached) return cached;

  const attempt = async (ua: string): Promise<UrlCheck> => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: ctl.signal,
        headers: { ...BROWSERISH_HEADERS, "User-Agent": ua },
      });
      return { url, ok: res.status < 400, status: res.status };
    } catch (e) {
      return { url, ok: false, status: null, note: e instanceof Error ? e.message : String(e) };
    } finally {
      clearTimeout(timer);
    }
  };

  let result = await attempt(POLITE_UA);
  if (!result.ok && (result.status === 403 || result.status === 406)) {
    result = await attempt(BROWSER_UA);
    if (result.ok) result = { ...result, note: "passed with browser UA (host blocks bot UAs)" };
  }
  if (!result.ok && (result.status === 429 || result.status === 503)) {
    await new Promise((r) => setTimeout(r, 2500));
    result = await attempt(BROWSER_UA);
  }
  urlCheckCache.set(url, result);
  return result;
}

// ── Specs ─────────────────────────────────────────────────────────────────────

export interface TransitionSourceSpec {
  /** Stable source slug, e.g. `src:scotus-overruling-16-citizens-united`. */
  externalId: string;
  name: string;
  url: string;
  /** Document date. String uses parseFlexibleDate; Date passed through. */
  publishedAt: string | Date;
  methodologyType: "primary" | "derivative" | "opinion";
  ingestedBy?: string;
}

export interface TransitionSpec {
  claimId: string;
  fromAxis: FactStatusT | null;
  toAxis: FactStatusT;
  community: CommunityT;
  /** String uses parseFlexibleDate (precision inferred); Date requires datePrecision. */
  occurredAt: string | Date;
  datePrecision?: DatePrecisionT;
  reason: string;
  source: TransitionSourceSpec | null;
}

export interface EmitOptions {
  /** Writes happen only when true. Default false — dry-run by default. */
  execute?: boolean;
  /** Fetch-verify source URLs before accepting the row. Default true. */
  verifyUrls?: boolean;
  /** Permit source = null (Layer-1-style baseline). Default false. */
  allowSourceless?: boolean;
  /** Permit fromAxis = null entry rows. Default false. */
  allowEntryRow?: boolean;
  /** Permit occurredAt equal to the previous transition's date (same-date
   *  completions like wave 1). Strictly-earlier is always rejected. */
  allowSameDate?: boolean;
  /** Minimum receipt length. Default 40 chars. */
  minReasonLength?: number;
  urlTimeoutMs?: number;
}

export type EmitAction = "inserted" | "exists" | "planned" | "skipped";

export interface EmitResult {
  id: string;
  action: EmitAction;
  violations: string[];
  urlCheck?: UrlCheck;
}

// ── The write path ────────────────────────────────────────────────────────────

export async function emitTransition(
  db: Db,
  spec: TransitionSpec,
  opts: EmitOptions = {},
): Promise<EmitResult> {
  const {
    execute = false,
    verifyUrls = true,
    allowSourceless = false,
    allowEntryRow = false,
    allowSameDate = false,
    minReasonLength = 40,
    urlTimeoutMs = 15000,
  } = opts;

  const violations: string[] = [];

  // 1. Vocabulary.
  if (!FACT_STATUSES.includes(spec.toAxis)) violations.push(`toAxis "${spec.toAxis}" not a FactStatus`);
  if (spec.fromAxis !== null && !FACT_STATUSES.includes(spec.fromAxis))
    violations.push(`fromAxis "${spec.fromAxis}" not a FactStatus`);
  if (!COMMUNITIES.includes(spec.community)) violations.push(`community "${spec.community}" not a RatifyingCommunity`);
  // Same-axis transitions are checked against the terminal row below: re-ratification
  // by a DIFFERENT community is legitimate (the multi-lane concept); same axis
  // re-affirmed by the SAME community carries no information.

  // 2. Receipt prose.
  if (!spec.reason || spec.reason.trim().length < minReasonLength)
    violations.push(`reason shorter than ${minReasonLength} chars — not receipt-grade`);

  // 3. Date + precision.
  let occurredAt: Date;
  let precision: DatePrecisionT;
  if (typeof spec.occurredAt === "string") {
    const parsed = parseFlexibleDate(spec.occurredAt);
    if (!parsed) {
      violations.push(`occurredAt "${spec.occurredAt}" unparsable — skip, never guess`);
      return { id: "", action: "skipped", violations };
    }
    occurredAt = parsed.date;
    precision = spec.datePrecision ?? parsed.precision;
  } else {
    occurredAt = spec.occurredAt;
    if (!spec.datePrecision) {
      violations.push("Date object passed without explicit datePrecision");
      return { id: "", action: "skipped", violations };
    }
    precision = spec.datePrecision;
  }
  if (isNaN(occurredAt.getTime())) {
    violations.push("occurredAt is an invalid Date");
    return { id: "", action: "skipped", violations };
  }

  const id = deterministicTransitionId(spec.claimId, spec.toAxis, occurredAt);

  // 4. Claim exists, isn't deleted; date sanity vs emergence.
  const claim = await db.claim.findUnique({
    where: { id: spec.claimId },
    select: {
      id: true,
      deleted: true,
      claimEmergedAt: true,
      statusHistory: {
        // seq is the order authority (Postgres ASC puts NULLs last, so
        // unstamped legacy rows fall back to date order during rollout).
        orderBy: [{ seq: "asc" }, { occurredAt: "asc" }, { createdAt: "asc" }],
        select: { id: true, fromAxis: true, toAxis: true, occurredAt: true, community: true },
      },
    },
  });
  if (!claim) {
    violations.push(`claim ${spec.claimId} not found`);
    return { id, action: "skipped", violations };
  }
  if (claim.deleted) violations.push(`claim ${spec.claimId} is deleted`);
  if (
    spec.fromAxis !== null &&
    claim.claimEmergedAt &&
    occurredAt.getTime() < claim.claimEmergedAt.getTime()
  ) {
    violations.push(
      `occurredAt ${isoDay(occurredAt)} precedes claimEmergedAt ${isoDay(claim.claimEmergedAt)} on a non-entry row`,
    );
  }

  // 5. Idempotency short-circuit.
  const history = claim.statusHistory;
  const existing = history.find(
    (h) => h.toAxis === spec.toAxis && h.occurredAt.getTime() === occurredAt.getTime(),
  );
  if (existing) return { id: existing.id, action: "exists", violations: [] };

  // 6. Chain coherence.
  const entryRows = history.filter((h) => h.fromAxis === null);
  const terminal = history.length > 0 ? history[history.length - 1] : null;
  if (spec.fromAxis === null) {
    if (!allowEntryRow) violations.push("entry row (fromAxis=null) requires allowEntryRow");
    if (entryRows.length > 0)
      violations.push(`claim already has an entry row (${entryRows[0].id}) — one per claim, ever`);
    if (terminal && occurredAt.getTime() > terminal.occurredAt.getTime())
      violations.push("entry row would postdate existing history — prepends must precede the chain");
  } else {
    if (!terminal) {
      violations.push(`fromAxis=${spec.fromAxis} but claim has no history — write the entry row first`);
    } else {
      if (terminal.toAxis !== spec.fromAxis)
        violations.push(
          `chain break: claim's terminal axis is ${terminal.toAxis}, spec.fromAxis is ${spec.fromAxis}`,
        );
      if (spec.fromAxis === spec.toAxis && terminal.community === spec.community)
        violations.push(
          `degenerate transition ${spec.fromAxis}→${spec.toAxis} within the same community (${spec.community})`,
        );
      const cmp = occurredAt.getTime() - terminal.occurredAt.getTime();
      if (cmp < 0)
        violations.push(
          `occurredAt ${isoDay(occurredAt)} precedes terminal transition ${isoDay(terminal.occurredAt)}`,
        );
      if (cmp === 0 && !allowSameDate)
        violations.push("same-date append requires allowSameDate (wave-1-style completions only)");
    }
  }

  // 7. Source + URL verification.
  let urlCheck: UrlCheck | undefined;
  if (!spec.source) {
    if (!allowSourceless) violations.push("source is null — every receipt needs a marker source");
  } else {
    if (!spec.source.externalId.trim()) violations.push("source.externalId empty");
    if (!spec.source.url.trim()) violations.push("source.url empty");
    else if (verifyUrls) {
      urlCheck = await verifyUrl(spec.source.url, urlTimeoutMs);
      if (!urlCheck.ok)
        violations.push(
          `source URL failed verification (${urlCheck.status ?? urlCheck.note}): ${spec.source.url}`,
        );
    }
  }

  if (violations.length > 0) return { id, action: "skipped", violations, urlCheck };
  if (!execute) return { id, action: "planned", violations: [], urlCheck };

  // 8. Write: source first, then the row. Upserts keyed on stable ids; the
  //    unique constraint is the final guard against logical duplicates racing in.
  let sourceId: string | null = null;
  if (spec.source) {
    const pubParsed =
      typeof spec.source.publishedAt === "string"
        ? parseFlexibleDate(spec.source.publishedAt)
        : { date: spec.source.publishedAt, precision: "DAY" as DatePrecisionT };
    if (!pubParsed) {
      return {
        id, action: "skipped", urlCheck,
        violations: [`source.publishedAt "${spec.source.publishedAt}" unparsable`],
      };
    }
    const src = await db.source.upsert({
      where: { externalId: spec.source.externalId },
      create: {
        externalId: spec.source.externalId,
        name: spec.source.name,
        url: spec.source.url,
        publishedAt: pubParsed.date,
        methodologyType: spec.source.methodologyType,
        ...(spec.source.ingestedBy ? { ingestedBy: spec.source.ingestedBy } : {}),
      },
      update: {}, // never clobber an existing source record
      select: { id: true },
    });
    sourceId = src.id;
  }

  try {
    const writeRowAndSeq = async (tx: Db) => {
      await tx.claimStatusHistory.upsert({
        where: { id },
        create: {
          id,
          claimId: spec.claimId,
          fromAxis: spec.fromAxis,
          toAxis: spec.toAxis,
          community: spec.community,
          occurredAt,
          datePrecision: precision,
          reason: spec.reason.trim(),
          sourceId,
        },
        update: {}, // idempotent: existing row is left exactly as it was
      });
      // seq is assigned in the SAME transaction as the insert (contract §6).
      // Appends land at n+1; entry-row prepends shift the whole claim.
      await renumberClaimSeq(tx, spec.claimId);
      // Keep the denormalized Claim.epistemicAxis in lockstep with the trajectory's
      // latest row — this is what lets REVERSED/ABANDONED reach every raw-field
      // reader (v1 API, topic pages, filters) instead of leaking as stale CONTESTED.
      await stampClaimAxis(tx, spec.claimId);
    };
    if ("$transaction" in db) {
      await (db as PrismaClient).$transaction((tx) => writeRowAndSeq(tx));
    } else {
      // Caller already holds a transaction (e.g. NZ phase-2's amend+prepend) —
      // run inside it so amend, insert, and renumber commit atomically.
      await writeRowAndSeq(db);
    }
  } catch (e) {
    // P2002 on @@unique([claimId, toAxis, occurredAt]) — same logical transition
    // already exists under another id (e.g. a Layer-1 cuid row). That's "exists".
    if (
      typeof e === "object" && e !== null &&
      (e as { code?: string }).code === "P2002"
    ) {
      return { id, action: "exists", violations: [], urlCheck };
    }
    throw e;
  }

  return { id, action: "inserted", violations: [], urlCheck };
}

// ── Explicit row order (seq) ──────────────────────────────────────────────────

/**
 * Renumber a claim's transition rows to contiguous seq 1..n (contract §6).
 *
 * Order rule: the entry row (fromAxis=null) is always first; already-stamped
 * rows keep their relative order (existing seq is the order AUTHORITY — dates
 * never reorder stamped receipts); unstamped rows follow, by (occurredAt,
 * createdAt, id). This places a fresh append at n+1 and a fresh entry prepend
 * at 1 (shifting the rest), and opportunistically stamps legacy rows it meets.
 * Legacy-truth stamping at scale is scripts/backfill-transition-seq.ts's job —
 * run it before relying on seq ordering (it prefers pointer chains over
 * possibly-lying date order; this helper only handles rows entering through
 * the contract, where chain coherence is already enforced).
 *
 * Collision safety: if more than one row changes, all the claim's seqs are set
 * NULL first (NULLs are distinct under @@unique([claimId, seq])), then finals
 * are written — shifts never trip the unique index. Call inside a transaction.
 */
export async function renumberClaimSeq(
  db: Db,
  claimId: string,
): Promise<{ changed: number }> {
  const rows = await db.claimStatusHistory.findMany({
    where: { claimId },
    select: { id: true, fromAxis: true, occurredAt: true, createdAt: true, seq: true },
  });
  if (rows.length === 0) return { changed: 0 };

  const INF = Number.MAX_SAFE_INTEGER;
  const ordered = [...rows].sort(
    (a, b) =>
      (a.fromAxis === null ? 0 : 1) - (b.fromAxis === null ? 0 : 1) ||
      (a.seq ?? INF) - (b.seq ?? INF) ||
      a.occurredAt.getTime() - b.occurredAt.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
  const desired = ordered.map((r, i) => ({ id: r.id, seq: i + 1, current: r.seq }));
  const changes = desired.filter((d) => d.current !== d.seq);
  if (changes.length === 0) return { changed: 0 };

  if (changes.length > 1) {
    // NULL-phase: clear the claim's seqs so the rewrite can't transiently
    // collide with a value another row still holds.
    await db.claimStatusHistory.updateMany({ where: { claimId }, data: { seq: null } });
    for (const d of desired) {
      await db.claimStatusHistory.update({ where: { id: d.id }, data: { seq: d.seq } });
    }
  } else {
    // Single change (the common append): its target position is provably free.
    const d = changes[0];
    await db.claimStatusHistory.update({ where: { id: d.id }, data: { seq: d.seq } });
  }
  return { changed: changes.length };
}

// ── Consented baseline amendment (wave-2 / prepend pattern) ───────────────────

export interface AmendBaselineSpec {
  claimId: string;
  /** The baseline row must currently be fromAxis=null AND toAxis=expectToAxis. */
  expectToAxis: FactStatusT;
  /** New fromAxis — re-points the baseline at the prepended entry row's axis. */
  setFromAxis: FactStatusT;
  /** Optional re-date (e.g. NZ repeals: move REVERSED from enactment-year to
   *  the actual repeal date). Requires redatePrecision. */
  redateTo?: Date;
  redatePrecision?: DatePrecisionT;
  /** Optional receipt replacement when the re-date changes what the row means. */
  setReason?: string;
}

/**
 * The ONE sanctioned mutation of existing rows: re-pointing (and optionally
 * re-dating) a claim's baseline so a prepended entry row forms a coherent
 * chain. Refuses to run without allowEntryAmend (the wave-2 consent flag).
 * Returns the number of rows amended (0 = guard mismatch, 1 = amended).
 *
 * seq note: amending mutates no row COUNT and seq — not dates — is the order
 * authority, so no renumber happens here. The prepend that follows (via
 * emitTransition, same transaction) performs the whole-claim renumber.
 */
export async function amendBaseline(
  db: Db,
  spec: AmendBaselineSpec,
  opts: { execute?: boolean; allowEntryAmend?: boolean } = {},
): Promise<{ amended: number; violations: string[] }> {
  const violations: string[] = [];
  if (!opts.allowEntryAmend) {
    violations.push("amendBaseline requires allowEntryAmend — this mutates an existing row");
    return { amended: 0, violations };
  }
  if (spec.redateTo && !spec.redatePrecision) {
    violations.push("redateTo requires redatePrecision");
    return { amended: 0, violations };
  }

  const baseline = await db.claimStatusHistory.findFirst({
    where: { claimId: spec.claimId, fromAxis: null, toAxis: spec.expectToAxis },
    select: { id: true },
  });
  if (!baseline) {
    violations.push(
      `no baseline row (fromAxis=null, toAxis=${spec.expectToAxis}) on claim ${spec.claimId}`,
    );
    return { amended: 0, violations };
  }

  if (!opts.execute) return { amended: 1, violations: [] }; // planned

  await db.claimStatusHistory.update({
    where: { id: baseline.id },
    data: {
      fromAxis: spec.setFromAxis,
      ...(spec.redateTo ? { occurredAt: spec.redateTo, datePrecision: spec.redatePrecision } : {}),
      ...(spec.setReason ? { reason: spec.setReason } : {}),
    },
  });
  return { amended: 1, violations: [] };
}


// ── Denormalized axis stamp ───────────────────────────────────────────────────

/**
 * Claim.epistemicAxis is a denormalized copy of the trajectory's CURRENT state,
 * i.e. the toAxis of the latest ClaimStatusHistory row (seq order; renumber first).
 * Historically it was only written at ingest with the 5 "live" values, so claims
 * whose latest transition is REVERSED/ABANDONED kept a stale axis — the leak found
 * in the 2026-07 app-feasibility review (v1 claims API, topic pages, filters all
 * read the raw field). Called by emitTransition in the same transaction as the
 * insert; scripts/backfill-terminal-axis.ts repairs pre-existing rows.
 *
 * COEXISTENCE with resolveDisplayAxis()/lib/effective-axis.ts (committed on
 * main before this landed): once the stamp + backfill run, stored and terminal
 * axis agree, so the read-time override layer returns identical answers and
 * becomes a redundant safety net. Keep it — defense in depth costs nothing —
 * but its "structurally cannot represent" comments describe the pre-stamp
 * world; the column is a plain String and now holds terminal values.
 */
export async function stampClaimAxis(
  db: Db,
  claimId: string,
): Promise<{ stamped: boolean; axis: string | null }> {
  const latest = await db.claimStatusHistory.findFirst({
    where: { claimId },
    orderBy: [{ seq: "desc" }, { occurredAt: "desc" }, { createdAt: "desc" }],
    select: { toAxis: true },
  });
  if (!latest) return { stamped: false, axis: null };
  const claim = await db.claim.findUnique({ where: { id: claimId }, select: { epistemicAxis: true } });
  if (!claim || claim.epistemicAxis === latest.toAxis) return { stamped: false, axis: latest.toAxis };
  await db.claim.update({ where: { id: claimId }, data: { epistemicAxis: latest.toAxis } });
  return { stamped: true, axis: latest.toAxis };
}
