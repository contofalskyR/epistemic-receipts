import { NextResponse } from "next/server";
import { buildCorpusAnalysis } from "@/lib/corpusAnalysis";

export const revalidate = 3600;

export async function GET() {
  const data = await buildCorpusAnalysis();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" },
  });
}
