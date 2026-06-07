import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";

export const dynamic = "force-dynamic";

const OWNER_CHAT_ID = "7688025079";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  if (isReadOnly()) {
    return NextResponse.json(
      { error: "Editing disabled in production" },
      { status: 403 },
    );
  }

  const { bookId } = await params;

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, title: true, author: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const [matchCount, pendingReasons] = await Promise.all([
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

  const text = [
    `📚 Analysis request`,
    `Book: ${book.title}${book.author ? ` — ${book.author}` : ""}`,
    `Book ID: ${book.id}`,
    `Matches in DB: ${matchCount}`,
    `Pending reasons: ${pendingReasons}`,
    ``,
    `Push reasons back via:`,
    `PATCH /api/books/${book.id}/matches/reasons`,
    `body: {"reasons":[{"matchId":"...","reason":"..."}]}`,
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
