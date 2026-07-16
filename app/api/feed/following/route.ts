import { NextRequest, NextResponse } from "next/server";
import {
  getProfileIdByKey,
  isValidProfileKey,
  loadFollowingMoves,
} from "@/lib/following";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 7;

// GET /api/feed/following?key=… — real transitions on the follow set this
// week (the /feed digest section). Empty ⇒ the section renders nothing.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!isValidProfileKey(key)) {
    return NextResponse.json({ moves: [], windowDays: WINDOW_DAYS });
  }
  try {
    const profileId = await getProfileIdByKey(key);
    if (!profileId) {
      return NextResponse.json({ moves: [], windowDays: WINDOW_DAYS });
    }
    const moves = await loadFollowingMoves(profileId, WINDOW_DAYS);
    return NextResponse.json({ moves, windowDays: WINDOW_DAYS });
  } catch {
    // Follow table absent (pre-migration edition) → nothing to show.
    return NextResponse.json({ moves: [], windowDays: WINDOW_DAYS });
  }
}
