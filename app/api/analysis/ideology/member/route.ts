import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RawRow = {
  voteDate: Date | null;
  vote: string;
  byPartyJson: string | null;
  sourceName: string;
  sourceExtId: string | null;
};

type DefectionRow = {
  rollcallId: string | null;
  date: string;
  memberVote: string;
  partyMajority: string;
  partyYes: number;
  partyNo: number;
  billName: string;
};

function parseMajority(
  byPartyJson: string,
  party: string
): { direction: "Yea" | "Nay"; yes: number; no: number } | null {
  let parsed: Record<string, { yes?: number; no?: number }>;
  try {
    parsed = JSON.parse(byPartyJson);
  } catch {
    return null;
  }
  // Try direct key match, then numeric↔abbr mapping
  const PARTY_MAP: Record<string, string> = {
    "100": "D", "200": "R", D: "100", R: "200",
  };
  const candidates = [party, PARTY_MAP[party]].filter(Boolean);
  const partyKey = Object.keys(parsed).find((k) => candidates.includes(k));
  if (!partyKey) return null;
  const yes = parsed[partyKey]?.yes ?? 0;
  const no = parsed[partyKey]?.no ?? 0;
  if (yes === 0 && no === 0) return null;
  return { direction: yes >= no ? "Yea" : "Nay", yes, no };
}

function canonicalVote(v: string): "Yea" | "Nay" | "Present" | "Not Voting" | null {
  const u = v?.toUpperCase().trim();
  if (u === "YEA" || u === "YES" || u === "AYE") return "Yea";
  if (u === "NAY" || u === "NO") return "Nay";
  if (u === "PRESENT") return "Present";
  if (u === "NOT VOTING" || u === "NOTVOTING") return "Not Voting";
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bioguideId = searchParams.get("bioguideId");
  const congressParam = searchParams.get("congress");
  const chamber = searchParams.get("chamber") ?? "House";

  if (!bioguideId || !congressParam) {
    return NextResponse.json({ error: "bioguideId and congress required" }, { status: 400 });
  }
  const congress = Number.parseInt(congressParam, 10);

  // 1. Member ideology score
  const ideology = await prisma.memberIdeology.findFirst({
    where: { bioguideId, congress, chamber },
    select: { memberName: true, party: true, stateAbbrev: true, nominateDim1: true, nominateDim2: true },
  });

  // 2. All MemberVote rows for this member from congress_votes_v1 (the only US source with byPartyJson)
  //    Exclude Present / Not Voting from defection math per amendment #4
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      lv."voteDate",
      mv.vote,
      lv."byPartyJson",
      s.name AS "sourceName",
      s."externalId" AS "sourceExtId"
    FROM "MemberVote" mv
    JOIN "LegislativeVote" lv ON lv.id = mv."legislativeVoteId"
    JOIN "Source" s ON s.id = lv."sourceId"
    WHERE mv."memberId" = ${bioguideId}
      AND lv."dataSource" = 'congress_votes_v1'
      AND lv."byPartyJson" IS NOT NULL
    ORDER BY lv."voteDate" DESC NULLS LAST
  `;

  const party = ideology?.party ?? null;
  let cohesionWith = 0;
  let coveredRollcalls = 0;
  const defections: DefectionRow[] = [];

  for (const row of rows) {
    const memberSide = canonicalVote(row.vote);
    // Exclude present/not-voting from cohesion math (amendment #4 fine print)
    if (!memberSide || memberSide === "Present" || memberSide === "Not Voting") continue;
    if (!row.byPartyJson || !party) continue;

    const majority = parseMajority(row.byPartyJson, party);
    if (!majority) continue;

    coveredRollcalls++;
    if (memberSide === majority.direction) {
      cohesionWith++;
    } else {
      defections.push({
        rollcallId: row.sourceExtId ?? null,
        date: row.voteDate ? row.voteDate.toISOString().slice(0, 10) : "—",
        memberVote: memberSide,
        partyMajority: majority.direction,
        partyYes: majority.yes,
        partyNo: majority.no,
        billName: row.sourceName,
      });
    }
  }

  const cohesionPct = coveredRollcalls > 0 ? Math.round((cohesionWith / coveredRollcalls) * 100) : null;

  // Top 10 most recent defections (already ordered by voteDate DESC)
  const topDefections = defections.slice(0, 10);

  // Total US rollcalls with party breakdown in this dataset
  const datasetCountRow = await prisma.$queryRaw<[{ n: bigint }]>`
    SELECT COUNT(*) as n FROM "LegislativeVote"
    WHERE "dataSource" = 'congress_votes_v1' AND "byPartyJson" IS NOT NULL
  `;
  const datasetRollcalls = Number(datasetCountRow[0]?.n ?? 505);

  return NextResponse.json({
    bioguideId,
    ideology: ideology ?? null,
    cohesion: {
      pct: cohesionPct,
      coveredRollcalls,
      withParty: cohesionWith,
      defectionCount: defections.length,
    },
    defections: topDefections,
    datasetRollcalls,
  });
}
