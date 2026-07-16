/**
 * lib/following.ts — one source of truth for the follow set and "what moved"
 * queries (B12). Shared by /api/follow (the /following page), the /feed
 * digest section, and /api/feed/following.rss so page and feed can't disagree.
 *
 * Anonymous-first: callers pass the client-held profile key; only its SHA-256
 * hash ever touches the DB (same contract as /api/bookmarks). No emails, no
 * PII anywhere in these shapes.
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export const FOLLOW_ENTITY_TYPES = [
  "claim",
  "trajectory",
  "topic",
  "domain",
  "story",
] as const;

export type FollowEntityType = (typeof FOLLOW_ENTITY_TYPES)[number];

export function isFollowEntityType(v: unknown): v is FollowEntityType {
  return (
    typeof v === "string" &&
    (FOLLOW_ENTITY_TYPES as readonly string[]).includes(v)
  );
}

export function isValidProfileKey(key: unknown): key is string {
  return typeof key === "string" && key.length >= 8 && key.length <= 128;
}

export function hashProfileKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function getProfileIdByKey(key: string): Promise<string | null> {
  const profile = await prisma.profile.findUnique({
    where: { key: hashProfileKey(key) },
    select: { id: true },
  });
  return profile?.id ?? null;
}

// ── Resolving follows for the /following page ────────────────────────────────

export type ResolvedFollow = {
  followId: string;
  entityType: FollowEntityType;
  entityId: string;
  followedAt: string;
  title: string;
  /** null = entity is gone/deprecated — render a grayed card, never a link. */
  href: string | null;
  status: string | null;
  deprecated: boolean;
  lastMoveAt: string | null;
};

function slugTitle(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type FollowRow = {
  id: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
};

type ClaimLite = {
  id: string;
  text: string;
  epistemicAxis: string | null;
  verificationStatus: string | null;
  deleted: boolean;
  statusHistory: { occurredAt: Date }[];
};

const CLAIM_LITE_SELECT = {
  id: true,
  text: true,
  epistemicAxis: true,
  verificationStatus: true,
  deleted: true,
  statusHistory: {
    orderBy: [{ seq: "desc" as const }, { occurredAt: "desc" as const }],
    take: 1,
    select: { seq: true, occurredAt: true },
  },
};

function claimIsDeprecated(c: ClaimLite): boolean {
  return c.deleted || c.verificationStatus === "DEPRECATED";
}

function resolveClaimFollow(
  f: FollowRow,
  c: ClaimLite | undefined,
  hrefBase: string,
): ResolvedFollow {
  const deprecated = !c || claimIsDeprecated(c);
  return {
    followId: f.id,
    entityType: f.entityType as FollowEntityType,
    entityId: f.entityId,
    followedAt: f.createdAt.toISOString(),
    title: c ? c.text.slice(0, 220) : "This claim is no longer available",
    href: deprecated ? null : `${hrefBase}/${encodeURIComponent(f.entityId)}`,
    status: c ? (c.epistemicAxis ?? c.verificationStatus) : null,
    deprecated,
    lastMoveAt: c?.statusHistory[0]?.occurredAt.toISOString() ?? null,
  };
}

/**
 * Trajectory follows store the /settling-curve/[id] param, which resolves to
 * a claim via externalId `trajectory:<id>` first, then claim id (mirrors
 * lib/trajectory-detail).
 */
async function claimsForTrajectoryIds(
  ids: string[],
): Promise<Map<string, ClaimLite>> {
  if (ids.length === 0) return new Map();
  const byExternal = await prisma.claim.findMany({
    where: { externalId: { in: ids.map((id) => `trajectory:${id}`) } },
    select: { ...CLAIM_LITE_SELECT, externalId: true },
  });
  const out = new Map<string, ClaimLite>();
  for (const c of byExternal) {
    const id = c.externalId?.replace(/^trajectory:/, "");
    if (id) out.set(id, c);
  }
  const missing = ids.filter((id) => !out.has(id));
  if (missing.length > 0) {
    const byId = await prisma.claim.findMany({
      where: { id: { in: missing } },
      select: CLAIM_LITE_SELECT,
    });
    for (const c of byId) out.set(c.id, c);
  }
  return out;
}

export async function resolveFollows(
  profileId: string,
): Promise<ResolvedFollow[]> {
  const follows: FollowRow[] = await prisma.follow.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    select: { id: true, entityType: true, entityId: true, createdAt: true },
  });
  if (follows.length === 0) return [];

  const byType = (t: FollowEntityType) =>
    follows.filter((f) => f.entityType === t);

  const claimFollows = byType("claim");
  const trajFollows = byType("trajectory");
  const topicFollows = byType("topic");

  const [claims, trajClaims, topics] = await Promise.all([
    claimFollows.length > 0
      ? prisma.claim.findMany({
          where: { id: { in: claimFollows.map((f) => f.entityId) } },
          select: CLAIM_LITE_SELECT,
        })
      : Promise.resolve([]),
    claimsForTrajectoryIds(trajFollows.map((f) => f.entityId)),
    topicFollows.length > 0
      ? prisma.topic.findMany({
          where: { slug: { in: topicFollows.map((f) => f.entityId) } },
          select: { slug: true, name: true, _count: { select: { claims: true } } },
        })
      : Promise.resolve([]),
  ]);

  const claimById = new Map(claims.map((c) => [c.id, c]));
  const topicBySlug = new Map(topics.map((t) => [t.slug, t]));

  return follows.map((f) => {
    switch (f.entityType as FollowEntityType) {
      case "claim":
        return resolveClaimFollow(f, claimById.get(f.entityId), "/claims");
      case "trajectory":
        return resolveClaimFollow(
          f,
          trajClaims.get(f.entityId),
          "/settling-curve",
        );
      case "topic": {
        const t = topicBySlug.get(f.entityId);
        return {
          followId: f.id,
          entityType: "topic" as const,
          entityId: f.entityId,
          followedAt: f.createdAt.toISOString(),
          title: t?.name ?? slugTitle(f.entityId),
          href: t ? `/topics/${encodeURIComponent(f.entityId)}` : null,
          status: t ? `${t._count.claims.toLocaleString()} claims` : null,
          deprecated: !t,
          lastMoveAt: null,
        };
      }
      case "domain":
      case "story": {
        const base = f.entityType === "domain" ? "/domains" : "/stories";
        return {
          followId: f.id,
          entityType: f.entityType as FollowEntityType,
          entityId: f.entityId,
          followedAt: f.createdAt.toISOString(),
          title: slugTitle(f.entityId),
          href: `${base}/${encodeURIComponent(f.entityId)}`,
          status: null,
          deprecated: false,
          lastMoveAt: null,
        };
      }
    }
  });
}

// ── "What moved" — digest + RSS query ────────────────────────────────────────

export type FollowedMove = {
  claimId: string;
  claimText: string;
  fromAxis: string | null;
  toAxis: string;
  /** Historical date the transition happened (dated, honest). */
  occurredAt: string;
  /** When the transition was recorded in the graph (recency window key). */
  recordedAt: string;
  /** Why this claim is in the reader's follow set. */
  via: string;
};

/**
 * Real recorded transitions (ClaimStatusHistory) on the follow set within the
 * window, keyed on recordedAt (createdAt) — same recency semantics as /feed.
 * Empty array when nothing moved; callers render/emit nothing.
 */
export async function loadFollowingMoves(
  profileId: string,
  windowDays = 7,
  limit = 50,
): Promise<FollowedMove[]> {
  const follows: FollowRow[] = await prisma.follow.findMany({
    where: { profileId },
    select: { id: true, entityType: true, entityId: true, createdAt: true },
  });
  if (follows.length === 0) return [];

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const directClaimIds = new Set(
    follows.filter((f) => f.entityType === "claim").map((f) => f.entityId),
  );
  const trajClaims = await claimsForTrajectoryIds(
    follows.filter((f) => f.entityType === "trajectory").map((f) => f.entityId),
  );
  const trajClaimIds = new Set(
    Array.from(trajClaims.values()).map((c) => c.id),
  );
  const topicSlugs = follows
    .filter((f) => f.entityType === "topic")
    .map((f) => f.entityId);

  const orClauses: object[] = [];
  const idUnion = [...directClaimIds, ...trajClaimIds];
  if (idUnion.length > 0) orClauses.push({ claimId: { in: idUnion } });
  if (topicSlugs.length > 0) {
    orClauses.push({
      claim: { topics: { some: { topic: { slug: { in: topicSlugs } } } } },
    });
  }
  if (orClauses.length === 0) return [];

  const rows = await prisma.claimStatusHistory.findMany({
    where: {
      createdAt: { gte: since },
      claim: { deleted: false },
      OR: orClauses,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      claimId: true,
      fromAxis: true,
      toAxis: true,
      occurredAt: true,
      createdAt: true,
      claim: {
        select: {
          text: true,
          topics: { select: { topic: { select: { slug: true, name: true } } } },
        },
      },
    },
  });

  return rows.map((r) => {
    let via = "topic";
    if (directClaimIds.has(r.claimId)) via = "followed claim";
    else if (trajClaimIds.has(r.claimId)) via = "followed trajectory";
    else {
      const t = r.claim.topics.find((ct) => topicSlugs.includes(ct.topic.slug));
      via = t ? `topic: ${t.topic.name}` : "topic";
    }
    return {
      claimId: r.claimId,
      claimText: r.claim.text.slice(0, 220),
      fromAxis: r.fromAxis,
      toAxis: r.toAxis,
      occurredAt: r.occurredAt.toISOString(),
      recordedAt: r.createdAt.toISOString(),
      via,
    };
  });
}
