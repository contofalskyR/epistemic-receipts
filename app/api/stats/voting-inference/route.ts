import { NextResponse } from "next/server";
import { getVotingInferenceStats } from "@/lib/voting-stats";

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(await getVotingInferenceStats());
}
