import { NextResponse } from "next/server";
import {
  getCusumChangePoints,
  getBimodalityResult,
  getRunsTestResult,
  getWarPeriodEffect,
} from "@/lib/advanced-voting-stats";

export const revalidate = 3600;

export async function GET() {
  const [cusum, bimodal, runs, war] = await Promise.all([
    getCusumChangePoints(),
    getBimodalityResult(),
    getRunsTestResult(),
    getWarPeriodEffect(),
  ]);
  return NextResponse.json({ cusum, bimodal, runs, war });
}
