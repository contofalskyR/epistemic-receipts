import { NextResponse } from "next/server";
import { buildVoteAnalysis } from "@/lib/voteAnalysis";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await buildVoteAnalysis();
  return NextResponse.json(data);
}
