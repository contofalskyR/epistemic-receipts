import { NextResponse } from "next/server";
import { buildSettlingRateAnalysis } from "@/lib/settlingRate";

export const revalidate = 3600;

export async function GET() {
  const data = await buildSettlingRateAnalysis();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" },
  });
}
