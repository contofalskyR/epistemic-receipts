import { NextResponse } from "next/server";
import * as fs from "node:fs";
import { prisma } from "@/lib/prisma";
import {
  ingestProgressFilePath,
  INGEST_IDLE,
  type IngestJobState,
} from "@/lib/bookIngestJob";

export const dynamic = "force-dynamic";

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

  const file = ingestProgressFilePath(bookId);
  let state: IngestJobState = INGEST_IDLE;
  if (fs.existsSync(file)) {
    try {
      state = JSON.parse(fs.readFileSync(file, "utf-8")) as IngestJobState;
    } catch {
      state = INGEST_IDLE;
    }
  }

  const claimCount = await prisma.bookClaim.count({
    where: { chunk: { bookId } },
  });

  return NextResponse.json({ ...state, claimCount });
}
