import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";
import { requireAdminOrDev } from "@/lib/adminAuth";

const VALID_PRECISIONS = ["DAY", "MONTH", "QUARTER", "YEAR"];
const VALID_STATUSES = ["DISPUTED", "HARD_FACT", "NEVER_RESOLVES"];
const VALID_CLAIM_TYPES = ["EMPIRICAL", "INSTITUTIONAL", "INTERPRETIVE", "HYBRID"];

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

// Vote-claim source externalId: `congress_vote_{chamberSlug}_{congress}_{type}_{number}_{rollKey}_source`
// Bill source externalId:       `congress_law_source_{congress}_{type}_{number}`
// Member votes were enriched onto the BILL source's LV (see enrich-member-votes.ts).
// For vote-claim source rows that have no LV directly, fall back to the matching bill source's LV
// so the page can show the vote summary + lazy-loadable member breakdown.
const VOTE_SOURCE_RE = /^congress_vote_([^_]+)_(\d+)_([a-z]+)_(\d+)_.+_source$/;

function normalizeChamber(s: string): "house" | "senate" | "other" {
  const lower = s.toLowerCase();
  if (lower.includes("house")) return "house";
  if (lower.includes("senate")) return "senate";
  return "other";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let claim;
  try {
    claim = await prisma.claim.findUnique({
      where: { id },
      include: {
        _count: { select: { statusHistory: true } },
        parent: { select: { id: true, text: true } },
        children: {
          include: {
            _count: { select: { edges: { where: { deleted: false } } } },
          },
        },
        edges: {
          where: { deleted: false },
          include: {
            source: {
              include: {
                politicalContext: {
                  select: { headOfGovernment: true, hogParty: true, country: true },
                },
                legislativeVotes: { select: LV_SELECT },
              },
            },
            revisions: { orderBy: { changedAt: "asc" } },
            metaEdges: {
              where: { deleted: false },
              include: { actorSource: true },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        thresholdEvents: {
          include: { triggeredBySource: true },
          orderBy: { createdAt: "desc" },
        },
        topics: {
          select: { topic: { select: { id: true, name: true, slug: true, domain: true } } },
        },
      },
    });
  } catch (err) {
    console.error(`[/api/claims/${id}] DB error:`, err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
  if (!claim) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Backfill member-vote LVs for vote-claim sources by looking up the matching bill source.
  const voteSourceLookups: { sourceIndex: number; billExternalId: string; chamber: "house" | "senate" | "other" }[] = [];
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

  return NextResponse.json(claim);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isReadOnly()) return NextResponse.json({ error: "Editing disabled in production" }, { status: 403 });
  const denied = requireAdminOrDev(req);
  if (denied) return denied;
  const { id } = await params;
  const { text, claimEmergedAt, claimEmergedPrecision, currentStatus, claimType, topicIds } = await req.json();

  if (claimEmergedPrecision && !VALID_PRECISIONS.includes(claimEmergedPrecision)) {
    return NextResponse.json({ error: "invalid claimEmergedPrecision" }, { status: 400 });
  }
  if (currentStatus && !VALID_STATUSES.includes(currentStatus)) {
    return NextResponse.json({ error: "invalid currentStatus" }, { status: 400 });
  }
  if (claimType && !VALID_CLAIM_TYPES.includes(claimType)) {
    return NextResponse.json({ error: "invalid claimType" }, { status: 400 });
  }

  const claim = await prisma.claim.update({
    where: { id },
    data: {
      text: text?.trim() ?? undefined,
      claimEmergedAt: claimEmergedAt ? new Date(claimEmergedAt) : undefined,
      claimEmergedPrecision: claimEmergedPrecision ?? undefined,
      currentStatus: currentStatus ?? undefined,
      claimType: claimType ?? undefined,
    },
  });

  // Replace topic associations if topicIds is provided (null = no change, [] = remove all)
  if (Array.isArray(topicIds)) {
    await prisma.claimTopic.deleteMany({ where: { claimId: id } });
    if (topicIds.length > 0) {
      await prisma.claimTopic.createMany({
        data: topicIds.map((topicId: string) => ({ claimId: id, topicId })),
      });
    }
  }

  return NextResponse.json(claim);
}
