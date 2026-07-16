import { NextRequest, NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import {
  getProfileIdByKey,
  isValidProfileKey,
  loadFollowingMoves,
} from "@/lib/following";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 90;
const FEED_LIMIT = 100;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function emptyFeed(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Following — Epistemic Receipts</title>
    <link>${SITE_URL}/following</link>
    <description>Dated epistemic-status moves in what you follow.</description>
  </channel>
</rss>`;
}

// GET /api/feed/following.rss?key=… — personal RSS of real transitions on the
// follow set. Keyed on the reader's unguessable anonymous profile key (the
// same client-generated UUID the bookmarks use; only its hash is stored).
// Same query module as the /feed digest, so page and feed can't disagree.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const headers = {
    "Content-Type": "application/rss+xml; charset=utf-8",
    // Personal feed — never cache across readers.
    "Cache-Control": "private, max-age=900",
  };

  if (!isValidProfileKey(key)) {
    return new NextResponse(emptyFeed(), { headers });
  }

  let moves: Awaited<ReturnType<typeof loadFollowingMoves>> = [];
  try {
    const profileId = await getProfileIdByKey(key);
    if (profileId) {
      moves = await loadFollowingMoves(profileId, WINDOW_DAYS, FEED_LIMIT);
    }
  } catch {
    // Follow table absent (pre-migration edition) → empty feed.
  }

  const items = moves
    .map((m) => {
      const link = `${SITE_URL}/claims/${m.claimId}`;
      const title = `${m.fromAxis ? `${m.fromAxis} → ` : ""}${m.toAxis}: ${m.claimText.slice(0, 140)}`;
      const description =
        `Status moved ${m.fromAxis ? `from ${m.fromAxis} ` : ""}to ${m.toAxis} ` +
        `on ${m.occurredAt.slice(0, 10)} (via ${m.via}).`;
      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(`${m.claimId}:${m.recordedAt}`)}</guid>
      <pubDate>${new Date(m.recordedAt).toUTCString()}</pubDate>
      <description>${escapeXml(description)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Following — Epistemic Receipts</title>
    <link>${SITE_URL}/following</link>
    <description>Dated epistemic-status moves in what you follow — real transitions only, nothing invented.</description>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, { headers });
}
