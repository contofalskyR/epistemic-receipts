import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const members = await prisma.memberVote.findMany({
    where: { legislativeVoteId: id },
    select: {
      id: true,
      memberName: true,
      memberState: true,
      memberParty: true,
      memberId: true,
      chamber: true,
      vote: true,
    },
    orderBy: [{ vote: "asc" }, { memberParty: "asc" }, { memberName: "asc" }],
  });
  return NextResponse.json(members);
}
