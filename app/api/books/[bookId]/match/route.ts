import { NextResponse } from "next/server";
import * as fs from "node:fs";
import { spawn } from "node:child_process";
import * as path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireAdminOrDev } from "@/lib/adminAuth";
import {
  progressFilePath,
  logFilePath,
  type MatchJobState,
} from "@/lib/bookMatchJob";

export const dynamic = "force-dynamic";

function readState(bookId: string): MatchJobState | null {
  const file = progressFilePath(bookId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as MatchJobState;
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const denied = requireAdminOrDev(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const passphrase: string = body?.passphrase ?? "";
  if (!passphrase || passphrase !== process.env.BOOK_UPLOAD_PASSPHRASE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookId } = await params;

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, title: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const existing = readState(bookId);
  if (existing?.status === "running") {
    return NextResponse.json(
      { error: "Match already running for this book", state: existing },
      { status: 409 },
    );
  }

  const progressFile = progressFilePath(bookId);
  const logFile = logFilePath(bookId);

  const initial: MatchJobState = {
    status: "running",
    processed: 0,
    matched: 0,
    total: 0,
    errors: 0,
    startedAt: Date.now(),
  };
  fs.writeFileSync(progressFile, JSON.stringify(initial));

  const cwd = process.cwd();
  const scriptPath = path.join(cwd, "scripts", "match-book-to-graph.ts");
  const tsconfigPath = path.join(cwd, "tsconfig.scripts.json");

  const logStream = fs.openSync(logFile, "w");
  const child = spawn(
    "npx",
    [
      "ts-node",
      "--project",
      tsconfigPath,
      scriptPath,
      "--book",
      bookId,
    ],
    {
      cwd,
      detached: true,
      stdio: ["ignore", logStream, logStream],
      env: {
        ...process.env,
        MATCH_PROGRESS_FILE: progressFile,
      },
    },
  );
  child.unref();

  return NextResponse.json({
    bookId,
    pid: child.pid,
    progressFile,
    logFile,
    state: initial,
  });
}
