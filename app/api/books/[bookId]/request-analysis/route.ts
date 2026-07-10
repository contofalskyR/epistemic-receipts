import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrDev } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const OWNER_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const denied = requireAdminOrDev(req);
  if (denied) return denied;

  const { bookId } = await params;

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, title: true, author: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const [claimCount, matchCount, pendingReasons] = await Promise.all([
    prisma.bookClaim.count({ where: { chunk: { bookId } } }),
    prisma.bookClaimMatch.count({
      where: { bookClaim: { chunk: { bookId } } },
    }),
    prisma.bookClaimMatch.count({
      where: {
        bookClaim: { chunk: { bookId } },
        OR: [{ reason: null }, { reason: "" }],
      },
    }),
  ]);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN not configured" },
      { status: 500 },
    );
  }

  if (!OWNER_CHAT_ID) {
    console.log(
      "[request-analysis] TELEGRAM_CHAT_ID not set — skipping Telegram notification.",
    );
    return NextResponse.json({ status: "skipped", matchCount, pendingReasons });
  }

  const needsMatch = matchCount === 0 && claimCount > 0;
  const text = [
    `📚 Book ready for analysis`,
    `"${book.title}"${book.author ? ` — ${book.author}` : ""}`,
    `ID: ${book.id}`,
    ``,
    `Claims extracted: ${claimCount}`,
    `Graph matches: ${matchCount}${pendingReasons > 0 ? ` (${pendingReasons} need reasons)` : ""}`,
    ``,
    needsMatch
      ? `Run match locally:\nnpx ts-node --project tsconfig.scripts.json scripts/match-book-to-graph.ts --book ${book.id}`
      : `Push reasons back via:\nPATCH /api/books/${book.id}/matches/reasons\nbody: {"reasons":[{"matchId":"...","reason":"..."}]}`,
  ].join("\n");

  const tgRes = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: OWNER_CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    },
  );

  if (!tgRes.ok) {
    const detail = await tgRes.text().catch(() => "");
    return NextResponse.json(
      {
        error: `Telegram send failed (${tgRes.status})`,
        detail: detail.slice(0, 500),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    status: "requested",
    matchCount,
    pendingReasons,
  });
}
