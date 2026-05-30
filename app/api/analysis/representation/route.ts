import { NextResponse } from "next/server";
import { buildRepresentationAnalysis } from "@/lib/representationGap";

export const revalidate = 600;

export async function GET() {
  const data = await buildRepresentationAnalysis();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=3600" },
  });
}
