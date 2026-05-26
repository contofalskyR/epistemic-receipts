import { NextResponse } from "next/server";
import { buildVoteAnalysis } from "@/lib/voteAnalysis";

export const revalidate = 300;

export async function GET() {
  const data = await buildVoteAnalysis();
  return NextResponse.json(data);
}
