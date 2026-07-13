// Shared feed/"what's new" data access, used by both /feed and the homepage strip.
//
// Two sources of "new":
//   1. Recent epistemic transitions — rows added to ClaimStatusHistory (a claim
//      just moved RECORDED → SETTLED, or SETTLED → REVERSED, etc). This is the
//      on-theme "knowledge changed" feed and drives the homepage WhatsNewStrip.
//      ClaimStatusHistory carries a `createdAt` ingestion timestamp; we order by it.
//   2. Recent claims by pipeline + threshold events — powers the full /feed page.

import { prisma } from "@/lib/prisma";

export const PIPELINE_WINDOW_DAYS = 7;
export const PIPELINE_LIMIT = 6;
export const SAMPLES_PER_PIPELINE = 3;
export const EVENT_WINDOW_DAYS = 7;
export const EVENT_LIMIT = 10;
export const SNIPPET_LEN = 80;

export function snippet(text: string, max = SNIPPET_LEN): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Raw pipeline tag → friendly label ──────────────────────────────────────────

const PIPELINE_LABELS: Record<string, string> = {
  crossref_retractions_v1: "Retraction Watch",
  retraction_watch_v1: "Retraction Watch",
  vdem_v1: "V-Dem democracy data",
  world_bank_v1: "World Bank",
  who_gho_v1: "WHO Global Health",
  openalex_v1: "OpenAlex papers",
  congress_v1: "US Congress",
  congress_bills_v1: "US Congress bills",
  voteview_v1: "Voteview roll-calls",
  courtlistener_scotus_v1: "SCOTUS opinions",
  courtlistener_circuits_v1: "Federal circuit courts",
  courtlistener_state_supreme_v1: "State supreme courts",
  openfda_labels_v1: "openFDA labels",
  drugsatfda_v1: "Drugs@FDA",
  faers_adverse_v1: "FAERS adverse events",
  faers_normalized_drugs_v1: "FAERS drugs",
  nara_catalog_v1: "National Archives",
  miller_center_v1: "Miller Center",
  frus_v1: "Foreign Relations of the US",
  nasa_exoplanet_v1: "NASA exoplanets",
  ofac_sdn_v1: "OFAC sanctions",
  fred_v1: "FRED economics",
  openfec_v1: "OpenFEC campaign finance",
  manual: "Curated trajectories",
};

export function friendlyPipelineLabel(ingestedBy: string): string {
  if (PIPELINE_LABELS[ingestedBy]) return PIPELINE_LABELS[ingestedBy];
  // Fallback: strip a trailing _v<digits>, replace underscores, title-case.
  return ingestedBy
    .replace(/_v\d+$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Homepage strip: recent epistemic transitions ───────────────────────────────

export type WhatsNewItem = {
  id: string; // ClaimStatusHistory id (stable key)
  claimText: string;
  toAxis: string;
  occurredYear: number | null;
  reason: string | null;
  href: string; // settling-curve for trajectories, otherwise the claim page
};

export async function loadRecentTransitions(limit = 6): Promise<WhatsNewItem[]> {
  // Pull a few extra so we can dedupe to one row per claim and still fill `limit`.
  const rows = await prisma.claimStatusHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: limit * 6,
    select: {
      id: true,
      claimId: true,
      toAxis: true,
      occurredAt: true,
      reason: true,
      claim: { select: { text: true, externalId: true, deleted: true } },
    },
  });

  const seen = new Set<string>();
  const items: WhatsNewItem[] = [];
  for (const r of rows) {
    if (!r.claim || r.claim.deleted) continue;
    const ext = r.claim.externalId ?? "";
    // Dedupe to one entry per CLAIM (a claim can gain several transitions at once).
    const key = ext || r.claimId;
    if (seen.has(key)) continue;
    seen.add(key);

    const isTrajectory = ext.startsWith("trajectory:");
    // NOTE: r.id is the ClaimStatusHistory row's id — claim links MUST use
    // r.claimId (linking r.id produced "Claim not found", fixed 2026-07-04).
    const href = isTrajectory
      ? `/settling-curve?t=${ext.replace(/^trajectory:/, "")}`
      : `/claims/${r.claimId}`;

    items.push({
      id: r.id,
      claimText: r.claim.text,
      toAxis: r.toAxis,
      occurredYear: r.occurredAt ? r.occurredAt.getUTCFullYear() : null,
      reason: r.reason,
      href,
    });
    if (items.length >= limit) break;
  }
  return items;
}

// ─── /feed page: recent claims grouped by pipeline ──────────────────────────────

export type PipelineBucket = {
  ingestedBy: string;
  label: string;
  count: number;
  samples: { id: string; text: string }[];
};

export async function loadPipelineBuckets(): Promise<PipelineBucket[]> {
  const since = new Date(Date.now() - PIPELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Non-English pipelines are excluded from the default feed so that claims in
  // Swedish, German, Japanese, etc. don't surface on English-language pages
  // without a gloss. They remain accessible via /foreign-legislation and direct
  // claim links. Guardrail: source text is never altered — only excluded here.
  const { NON_ENGLISH_PIPELINES } = await import("@/lib/non-english-pipelines");
  const excludedTags = Array.from(NON_ENGLISH_PIPELINES);

  const grouped = await prisma.claim.groupBy({
    by: ["ingestedBy"],
    where: {
      deleted: false,
      createdAt: { gte: since },
      ingestedBy: { notIn: excludedTags },
    },
    _count: { _all: true },
    orderBy: { _count: { ingestedBy: "desc" } },
    take: PIPELINE_LIMIT,
  });

  if (grouped.length === 0) return [];

  const ingestedByList = grouped.map((g) => g.ingestedBy);
  const samples = await prisma.claim.findMany({
    where: {
      deleted: false,
      createdAt: { gte: since },
      ingestedBy: { in: ingestedByList, notIn: excludedTags },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, text: true, ingestedBy: true, createdAt: true },
    take: ingestedByList.length * SAMPLES_PER_PIPELINE * 4,
  });

  const byPipeline = new Map<string, { id: string; text: string }[]>();
  for (const c of samples) {
    const bucket = byPipeline.get(c.ingestedBy) ?? [];
    if (bucket.length < SAMPLES_PER_PIPELINE) {
      bucket.push({ id: c.id, text: c.text });
      byPipeline.set(c.ingestedBy, bucket);
    }
  }

  return grouped.map((g) => ({
    ingestedBy: g.ingestedBy,
    label: friendlyPipelineLabel(g.ingestedBy),
    count: g._count._all,
    samples: byPipeline.get(g.ingestedBy) ?? [],
  }));
}

// ─── /feed page: recent threshold events ────────────────────────────────────────

export type RecentEvent = {
  id: string;
  claimId: string;
  claimText: string;
  triggeredBy: string;
  createdAt: Date;
};

export async function loadRecentThresholdEvents(): Promise<RecentEvent[]> {
  const since = new Date(Date.now() - EVENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const events = await prisma.thresholdEvent.findMany({
    where: { deleted: false, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: EVENT_LIMIT,
    select: {
      id: true,
      claimId: true,
      triggeredBy: true,
      createdAt: true,
      claim: { select: { text: true, deleted: true } },
    },
  });
  return events
    .filter((e) => e.claim && !e.claim.deleted)
    .map((e) => ({
      id: e.id,
      claimId: e.claimId,
      claimText: e.claim!.text,
      triggeredBy: e.triggeredBy,
      createdAt: e.createdAt,
    }));
}
