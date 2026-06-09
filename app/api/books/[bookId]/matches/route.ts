import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MATCH_PRIORITY: Record<string, number> = {
  SUPPORTS: 0,
  CONTRADICTS: 1,
  RELATED: 2,
  UNVERIFIED: 3,
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params;
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));

  const all = await prisma.bookClaimMatch.findMany({
    where: { bookClaim: { chunk: { bookId } } },
    select: {
      id: true,
      matchType: true,
      similarityScore: true,
      reason: true,
      claimId: true,
      bookClaim: { select: { claimText: true } },
      claim: { select: { text: true } },
    },
  });

  all.sort((a, b) => {
    const pa = MATCH_PRIORITY[a.matchType] ?? 3;
    const pb = MATCH_PRIORITY[b.matchType] ?? 3;
    if (pa !== pb) return pa - pb;
    return b.similarityScore - a.similarityScore;
  });

  const total = all.length;
  const offset = (page - 1) * limit;
  const pageItems = all.slice(offset, offset + limit);

  return NextResponse.json({
    total,
    page,
    matches: pageItems.map((m) => ({
      matchId: m.id,
      bookClaimText: m.bookClaim.claimText,
      claimId: m.claimId,
      claimText: m.claim.text,
      matchType: m.matchType,
      reason: m.reason,
      similarityScore: m.similarityScore,
    })),
  });
}
