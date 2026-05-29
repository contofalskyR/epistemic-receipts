import { NextResponse } from "next/server";
import { getTopicTrends } from "@/lib/topic-trends";

export const revalidate = 3600;

export async function GET() {
  const data = await getTopicTrends();
  return NextResponse.json(data);
}
