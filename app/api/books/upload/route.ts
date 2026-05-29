// BOOK_UPLOAD_PASSPHRASE must be set in environment to enable book uploads.
// Set to a strong secret in Vercel env vars; use "changeme" only for local dev.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import pdfParse from "pdf-parse";

export const dynamic = "force-dynamic";

function checkPassphrase(provided: string | null): boolean {
  const expected = process.env.BOOK_UPLOAD_PASSPHRASE;
  if (!expected || !provided) return false;
  return provided === expected;
}

function parseChunks(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 50);
}

export async function POST(req: Request) {
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const passphrase = formData.get("passphrase");
  if (!checkPassphrase(typeof passphrase === "string" ? passphrase : null)) {
    return NextResponse.json({ error: "Invalid passphrase" }, { status: 403 });
  }

  const title = formData.get("title");
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const author = formData.get("author");
  const authorStr =
    typeof author === "string" && author.trim() ? author.trim() : null;

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  let rawText: string;

  if (fileName.endsWith(".pdf")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(buffer).catch((e: unknown) => {
      throw new Error(`PDF parse failed: ${e instanceof Error ? e.message : String(e)}`);
    });
    rawText = parsed.text;
  } else if (fileName.endsWith(".txt")) {
    rawText = await file.text();
  } else {
    return NextResponse.json(
      { error: "Only .pdf and .txt files are supported" },
      { status: 400 },
    );
  }

  const chunks = parseChunks(rawText);
  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "No text content found in the file" },
      { status: 400 },
    );
  }

  const book = await prisma.book.create({
    data: {
      title: title.trim(),
      author: authorStr,
      chunks: {
        create: chunks.map((text, paragraphIndex) => ({
          paragraphIndex,
          text,
        })),
      },
    },
    select: { id: true, _count: { select: { chunks: true } } },
  });

  return NextResponse.json({ bookId: book.id, chunkCount: book._count.chunks });
}
