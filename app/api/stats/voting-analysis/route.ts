import { NextResponse } from "next/server";
import { getVotingAnalysis } from "@/lib/voting-analysis";

export const revalidate = 3600;

export async function GET() {
  const data = await getVotingAnalysis();
  return NextResponse.json(data);
}
