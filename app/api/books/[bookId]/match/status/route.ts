import { NextResponse } from "next/server";
import * as fs from "node:fs";
import { prisma } from "@/lib/prisma";
import { progressFilePath, type MatchJobState } from "@/lib/bookMatchJob";

export const dynamic = "force-dynamic";

const IDLE: MatchJobState = {
  status: "idle",
  processed: 0,
  matched: 0,
  total: 0,
  errors: 0,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params;

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const file = progressFilePath(bookId);
  let state: MatchJobState = IDLE;
  if (fs.existsSync(file)) {
    try {
      state = JSON.parse(fs.readFileSync(file, "utf-8")) as MatchJobState;
    } catch {
      state = IDLE;
    }
  }

  // Always also report the authoritative DB-side match count so the UI has a
  // ground-truth fallback if the temp progress file is stale or missing.
  const dbMatchCount = await prisma.bookClaimMatch.count({
    where: { bookClaim: { chunk: { bookId } } },
  });

  return NextResponse.json({ ...state, dbMatchCount });
}
