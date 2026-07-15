import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type MemberHit = {
  memberId: string;
  memberName: string;
  memberState: string | null;
  memberParty: string | null;
  voteCount: number;
  nominateDim1: number | null;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const stateFilter = (url.searchParams.get("state") ?? "").trim().toUpperCase();
  const partyFilter = (url.searchParams.get("party") ?? "").trim();
  const limit = Math.max(
    1,
    Math.min(
      MAX_LIMIT,
      Number.parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT,
    ),
  );

  if (q.length === 0 && stateFilter.length === 0 && partyFilter.length === 0) {
    return NextResponse.json({ members: [] as MemberHit[] });
  }

  // Raw SQL — group by memberId, take most-recent memberName/state/party per member,
  // and rank by number of recorded votes. Search by memberName ILIKE.
  // memberId is bioguide id; we only include rows that have one (Voteview rows do).
  const params: unknown[] = [];
  const conds: string[] = [`mv."memberId" IS NOT NULL`];

  if (q.length > 0) {
    params.push(`%${q}%`);
    conds.push(`mv."memberName" ILIKE $${params.length}`);
  }
  if (stateFilter.length > 0) {
    params.push(stateFilter);
    conds.push(`mv."memberState" = $${params.length}`);
  }
  if (partyFilter.length > 0) {
    params.push(partyFilter);
    conds.push(`mv."memberParty" = $${params.length}`);
  }

  params.push(limit);
  const sql = `
    SELECT
      mv."memberId" AS "memberId",
      (SELECT "memberName" FROM "MemberVote" m2 WHERE m2."memberId" = mv."memberId" ORDER BY m2."createdAt" DESC LIMIT 1) AS "memberName",
      (SELECT "memberState" FROM "MemberVote" m3 WHERE m3."memberId" = mv."memberId" ORDER BY m3."createdAt" DESC LIMIT 1) AS "memberState",
      (SELECT "memberParty" FROM "MemberVote" m4 WHERE m4."memberId" = mv."memberId" ORDER BY m4."createdAt" DESC LIMIT 1) AS "memberParty",
      COUNT(*)::int AS "voteCount",
      (SELECT "nominateDim1" FROM "MemberIdeology" mi
       WHERE mi."bioguideId" = mv."memberId"
       ORDER BY mi.congress DESC LIMIT 1) AS "nominateDim1"
    FROM "MemberVote" mv
    WHERE ${conds.join(" AND ")}
    GROUP BY mv."memberId"
    ORDER BY COUNT(*) DESC
    LIMIT $${params.length}
  `;

  const rows = await prisma.$queryRawUnsafe<MemberHit[]>(sql, ...params);
  return NextResponse.json({ members: rows });
}
