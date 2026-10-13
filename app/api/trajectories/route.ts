import { NextRequest, NextResponse } from "next/server";
import { AUTO_LIMIT, getAutoTrajectories, getCuratedTrajectories } from "@/lib/trajectory-list";
import { getMachineTrajectories } from "@/lib/machine-lens";

// The list the /settling-curve explorer loads on mount. Both halves come from
// lib/trajectory-list.ts, cached for an hour (STATUS.md Phase 5) — this
// handler is dynamic (it reads searchParams) but never queries Postgres on a
// warm cache. The CDN absorbs repeats on top.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  // minMilestones=2 ensures single-point auto-generated entries never appear
  // (filtered in SQL; the loader falls back to 2 on garbage)
  const minMilestones = parseInt(searchParams.get("minMilestones") ?? "2");
  // source=curated → only trajectory: claims | source=auto → only non-trajectory |
  // source=machine → the explorer's machine lens (lib/machine-lens.ts) | omit → curated + auto
  const source = searchParams.get("source") ?? "all";
  if (source === "machine") {
    return NextResponse.json(await getMachineTrajectories(), {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  }
  // cap for non-curated results to avoid returning millions at once
  const limit = Math.min(AUTO_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? "") || AUTO_LIMIT));

  const [curated, auto] = await Promise.all([
    source !== "auto" ? getCuratedTrajectories() : Promise.resolve([]),
    source !== "curated" ? getAutoTrajectories(limit, minMilestones) : Promise.resolve([]),
  ]);

  return NextResponse.json([...curated, ...auto], {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
