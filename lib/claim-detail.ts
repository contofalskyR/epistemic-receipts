import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ── Serialized (JSON-safe) claim-detail types ─────────────────────────────────
// These mirror the wire shape the old client page received from
// GET /api/claims/[id]: every Prisma Date is an ISO-8601 string, nulls stay
// null. Client components (`ClaimInteractive` etc.) receive exactly this shape
// as props — do not pass raw Date objects across the server/client boundary or
// hydration breaks. Type-only imports of these from client files are fine
// (erased at compile time, so `server-only` is not violated).

export type RevisionDetail = {
  id: string;
  priorScore: number | null;
  newScore: number;
  reason: string | null;
  changedAt: string;
};

export type MetaEdgeDetail = {
  id: string;
  type: string;
  reason: string | null;
  createdAt: string;
  actorSource: { id: string; name: string };
};

export type LegislativeVoteRecord = {
  id: string;
  chamber: string;
  yesCount: number | null;
  noCount: number | null;
  abstainCount: number | null;
  totalSeats: number | null;
  passageThreshold: string | null;
  voteDate: string | null;
  passageType: string | null;
  byPartyJson: string | null;
  dataSource: string | null;
  _count: { memberVotes: number };
};

export type EdgeDetail = {
  id: string;
  type: string;
  evidenceType: string;
  createdAt: string;
  source: {
    id: string;
    name: string;
    url: string | null;
    publishedAt: string | null;
    methodologyType: string;
    externalId: string | null;
    politicalContext: {
      headOfGovernment: string | null;
      hogParty: string | null;
      country: string;
    } | null;
    legislativeVotes: LegislativeVoteRecord[];
  };
  revisions: RevisionDetail[];
  metaEdges: MetaEdgeDetail[];
};

export type ThresholdEventDetail = {
  id: string;
  triggeredBy: string;
  confirmedBy: string;
  note: string | null;
  evidenceSnapshot: string;
  createdAt: string;
  triggeredBySource: { name: string; url: string | null } | null;
};

export type ChildClaimDetail = {
  id: string;
  text: string;
  currentStatus: string;
  epistemicAxis: string | null;
  claimType: string;
  _count: { edges: number };
  /** Terminal transition only (take 1) — feeds resolveDisplayAxis so child
   *  badges can't leak a stale stored axis (leak site #5, 2026-07-10). */
  statusHistory: { toAxis: string; seq: number | null }[];
};

export type TopicTag = { id: string; name: string; slug: string; domain: string };

export type StatusTransitionSummary = {
  /** Explicit chain order (1..n per claim); null on unbackfilled legacy rows. */
  seq: number | null;
  fromAxis: string | null;
  toAxis: string;
  community: string;
  occurredAt: string;
  datePrecision: string | null;
};

export type ClaimDetail = {
  id: string;
  text: string;
  currentStatus: string;
  epistemicAxis: string | null;
  claimType: string;
  claimEmergedAt: string | null;
  claimEmergedPrecision: string | null;
  createdAt: string;
  humanReviewed: boolean;
  epistemicStatus: string | null;
  ingestedBy: string;
  verificationStatus: string | null;
  _count: { statusHistory: number };
  parent: { id: string; text: string } | null;
  children: ChildClaimDetail[];
  edges: EdgeDetail[];
  thresholdEvents: ThresholdEventDetail[];
  topics: { topic: TopicTag }[];
  /** Settling-curve transitions, newest first ([0] = latest, used by meta
   *  description + JSON-LD; the page timeline sorts ascending locally). */
  statusHistory: StatusTransitionSummary[];
};

// ── Query ─────────────────────────────────────────────────────────────────────

const LV_SELECT = {
  id: true,
  chamber: true,
  yesCount: true,
  noCount: true,
  abstainCount: true,
  totalSeats: true,
  passageThreshold: true,
  voteDate: true,
  passageType: true,
  byPartyJson: true,
  dataSource: true,
  _count: { select: { memberVotes: true } },
} as const;

// COLD-CRAWL HOT PATH — read before adding fields.
// /claims/[id] is ISR'd, but the corpus has ~1.76M claim URLs and a crawler
// can hit any of them cold; every ISR miss runs this query live against Neon
// (which has suspended under light load before). Keep it ONE round-trip with
// explicit `select`s of only the fields the page/API consumers actually
// render — no bare `include`s, no over-fetching. The only second query is the
// congress vote-source LV backfill below, which fires solely for vote claims.
const CLAIM_DETAIL_SELECT = Prisma.validator<Prisma.ClaimSelect>()({
  id: true,
  text: true,
  currentStatus: true,
  epistemicAxis: true,
  claimType: true,
  claimEmergedAt: true,
  claimEmergedPrecision: true,
  createdAt: true,
  humanReviewed: true,
  epistemicStatus: true,
  ingestedBy: true,
  verificationStatus: true,
  _count: { select: { statusHistory: true } },
  parent: { select: { id: true, text: true } },
  children: {
    select: {
      id: true,
      text: true,
      currentStatus: true,
      epistemicAxis: true,
      claimType: true,
      _count: { select: { edges: { where: { deleted: false } } } },
      // Terminal row only — resolveDisplayAxis input for the child badge
      // (axis-leak site #5). take-1 keeps the hot path lean (children are few).
      statusHistory: {
        orderBy: [
          { seq: { sort: "desc", nulls: "last" } },
          { occurredAt: "desc" },
          { createdAt: "desc" },
        ],
        take: 1,
        select: { toAxis: true, seq: true },
      },
    },
  },
  edges: {
    where: { deleted: false },
    select: {
      id: true,
      type: true,
      evidenceType: true,
      createdAt: true,
      source: {
        select: {
          id: true,
          name: true,
          url: true,
          publishedAt: true,
          methodologyType: true,
          externalId: true, // needed by the vote-source LV backfill
          politicalContext: {
            select: { headOfGovernment: true, hogParty: true, country: true },
          },
          legislativeVotes: { select: LV_SELECT },
        },
      },
      revisions: {
        orderBy: { changedAt: "asc" },
        select: { id: true, priorScore: true, newScore: true, reason: true, changedAt: true },
      },
      metaEdges: {
        where: { deleted: false },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          reason: true,
          createdAt: true,
          actorSource: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
  thresholdEvents: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      triggeredBy: true,
      confirmedBy: true,
      note: true,
      evidenceSnapshot: true,
      createdAt: true,
      triggeredBySource: { select: { name: true, url: true } },
    },
  },
  topics: {
    select: { topic: { select: { id: true, name: true, slug: true, domain: true } } },
  },
  // Full transition list, newest first — [0] powers the meta description /
  // JSON-LD; the page timeline renders all of them (it previously ignored
  // statusHistory entirely, so pages said "no revisions" while the OG
  // description cited a transition — AUDIT-PRELAUNCH-2026-07-06 §5).
  // Still cheap: leftmost-prefix of the [claimId, community, occurredAt]
  // index, and real-world claims carry at most a few dozen transitions.
  statusHistory: {
    orderBy: [
      { seq: { sort: "desc", nulls: "last" } },
      { occurredAt: "desc" },
      { createdAt: "desc" },
    ],
    select: { seq: true, fromAxis: true, toAxis: true, community: true, occurredAt: true, datePrecision: true },
  },
});

// Vote-claim source externalId: `congress_vote_{chamberSlug}_{congress}_{type}_{number}_{rollKey}_source`
// Bill source externalId:       `congress_law_source_{congress}_{type}_{number}`
// Member votes were enriched onto the BILL source's LV (see enrich-member-votes.ts).
// For vote-claim source rows that have no LV directly, fall back to the matching
// bill source's LV so the page can show the vote summary + lazy-loadable member
// breakdown.
const VOTE_SOURCE_RE = /^congress_vote_([^_]+)_(\d+)_([a-z]+)_(\d+)_.+_source$/;

function normalizeChamber(s: string): "house" | "senate" | "other" {
  const lower = s.toLowerCase();
  if (lower.includes("house")) return "house";
  if (lower.includes("senate")) return "senate";
  return "other";
}

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);

type RawClaimDetail = NonNullable<
  Awaited<ReturnType<typeof queryClaimDetail>>
>;

function queryClaimDetail(id: string) {
  return prisma.claim.findUnique({ where: { id }, select: CLAIM_DETAIL_SELECT });
}

function serializeClaimDetail(claim: RawClaimDetail): ClaimDetail {
  return {
    id: claim.id,
    text: claim.text,
    currentStatus: claim.currentStatus,
    epistemicAxis: claim.epistemicAxis,
    claimType: claim.claimType,
    claimEmergedAt: isoOrNull(claim.claimEmergedAt),
    claimEmergedPrecision: claim.claimEmergedPrecision,
    createdAt: iso(claim.createdAt),
    humanReviewed: claim.humanReviewed,
    epistemicStatus: claim.epistemicStatus,
    ingestedBy: claim.ingestedBy,
    verificationStatus: claim.verificationStatus,
    _count: claim._count,
    parent: claim.parent,
    children: claim.children,
    edges: claim.edges.map(edge => ({
      id: edge.id,
      type: edge.type,
      evidenceType: edge.evidenceType,
      createdAt: iso(edge.createdAt),
      source: {
        id: edge.source.id,
        name: edge.source.name,
        url: edge.source.url,
        publishedAt: isoOrNull(edge.source.publishedAt),
        methodologyType: edge.source.methodologyType,
        externalId: edge.source.externalId,
        politicalContext: edge.source.politicalContext,
        legislativeVotes: edge.source.legislativeVotes.map(lv => ({
          ...lv,
          voteDate: isoOrNull(lv.voteDate),
        })),
      },
      revisions: edge.revisions.map(r => ({ ...r, changedAt: iso(r.changedAt) })),
      metaEdges: edge.metaEdges.map(me => ({ ...me, createdAt: iso(me.createdAt) })),
    })),
    thresholdEvents: claim.thresholdEvents.map(te => ({
      ...te,
      createdAt: iso(te.createdAt),
    })),
    topics: claim.topics,
    statusHistory: claim.statusHistory.map(sh => ({
      ...sh,
      community: String(sh.community),
      occurredAt: iso(sh.occurredAt),
    })),
  };
}

/**
 * Fetch + serialize the claim-detail payload for /claims/[id] (page,
 * generateMetadata) and GET /api/claims/[id]. Wrapped in React cache() so the
 * page render and generateMetadata share ONE query per request.
 * Returns null when the claim doesn't exist.
 */
export const getClaimDetail = cache(async (id: string): Promise<ClaimDetail | null> => {
  const claim = await queryClaimDetail(id);
  if (!claim) return null;

  // Backfill member-vote LVs for vote-claim sources by looking up the matching
  // bill source. (Second query; only fires for congress vote claims.)
  const voteSourceLookups: {
    sourceIndex: number;
    billExternalId: string;
    chamber: "house" | "senate" | "other";
  }[] = [];
  claim.edges.forEach((edge, i) => {
    const ext = edge.source.externalId ?? "";
    const m = VOTE_SOURCE_RE.exec(ext);
    if (!m) return;
    if (edge.source.legislativeVotes.length > 0) return;
    const [, chamberSlug, congress, type, number] = m;
    voteSourceLookups.push({
      sourceIndex: i,
      billExternalId: `congress_law_source_${congress}_${type}_${number}`,
      chamber: normalizeChamber(chamberSlug ?? ""),
    });
  });

  if (voteSourceLookups.length > 0) {
    const billSources = await prisma.source.findMany({
      where: { externalId: { in: voteSourceLookups.map(v => v.billExternalId) } },
      select: { externalId: true, legislativeVotes: { select: LV_SELECT } },
    });
    const lvByBillExtId = new Map(billSources.map(bs => [bs.externalId, bs.legislativeVotes]));
    for (const lookup of voteSourceLookups) {
      const lvs = lvByBillExtId.get(lookup.billExternalId);
      if (!lvs || lvs.length === 0) continue;
      const filtered = lookup.chamber === "other"
        ? lvs
        : lvs.filter(lv => normalizeChamber(lv.chamber) === lookup.chamber);
      claim.edges[lookup.sourceIndex]!.source.legislativeVotes = filtered.length > 0 ? filtered : lvs;
    }
  }

  return serializeClaimDetail(claim);
});
