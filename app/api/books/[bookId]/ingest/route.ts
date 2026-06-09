import { NextResponse } from "next/server";
import * as fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";
import {
  ingestProgressFilePath,
  type IngestJobState,
} from "@/lib/bookIngestJob";

export const dynamic = "force-dynamic";
// Vercel Hobby max is 60s; we return quickly and run background work in-process.
export const maxDuration = 60;

const BATCH_SIZE = 10;
const MODEL = "claude-haiku-4-5-20251001";

function checkPassphrase(provided: string | null): boolean {
  const expected = process.env.BOOK_UPLOAD_PASSPHRASE;
  if (!expected || !provided) return false;
  return provided === expected;
}

function writeState(bookId: string, state: IngestJobState) {
  try {
    fs.writeFileSync(ingestProgressFilePath(bookId), JSON.stringify(state));
  } catch {
    // progress write is best-effort
  }
}

function parseClaimsFromResponse(text: string): string[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

async function runIngest(bookId: string) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const chunks = await prisma.bookChunk.findMany({
    where: { bookId },
    orderBy: { paragraphIndex: "asc" },
    select: { id: true, text: true },
  });

  const state: IngestJobState = {
    status: "running",
    processed: 0,
    total: chunks.length,
    claimCount: 0,
    errors: 0,
    startedAt: Date.now(),
  };
  writeState(bookId, state);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (chunk) => {
        try {
          const message = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 512,
            messages: [
              {
                role: "user",
                content:
                  `Extract factual claims from this paragraph as a JSON array of strings. ` +
                  `Return [] if no claims.\n\nParagraph: ${chunk.text}`,
              },
            ],
          });

          const responseText =
            message.content[0]?.type === "text" ? message.content[0].text : "";
          const claims = parseClaimsFromResponse(responseText);

          if (claims.length > 0) {
            await prisma.bookClaim.createMany({
              data: claims.map((claimText, positionIndex) => ({
                chunkId: chunk.id,
                claimText,
                positionIndex,
              })),
            });
            state.claimCount += claims.length;
          }
        } catch {
          state.errors += 1;
        } finally {
          state.processed += 1;
          writeState(bookId, state);
        }
      }),
    );
  }

  state.status = "done";
  state.finishedAt = Date.now();
  writeState(bookId, state);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  if (isReadOnly()) {
    return NextResponse.json(
      { error: "Editing disabled in production" },
      { status: 403 },
    );
  }

  const { bookId } = await params;

  let passphrase: string | null = null;
  try {
    const body = (await req.json()) as { passphrase?: string };
    passphrase = body.passphrase ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!checkPassphrase(passphrase)) {
    return NextResponse.json({ error: "Invalid passphrase" }, { status: 403 });
  }

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const progressFile = ingestProgressFilePath(bookId);
  if (fs.existsSync(progressFile)) {
    try {
      const existing = JSON.parse(
        fs.readFileSync(progressFile, "utf-8"),
      ) as IngestJobState;
      if (existing.status === "running") {
        return NextResponse.json(
          { error: "Ingest already running for this book", jobId: bookId },
          { status: 409 },
        );
      }
    } catch {
      // corrupt state file — proceed
    }
  }

  // Fire-and-forget: background work runs in the Node.js process.
  // On Vercel Hobby the function lives until the Promise resolves or 60s elapses.
  void runIngest(bookId);

  return NextResponse.json({ started: true, jobId: bookId });
}
