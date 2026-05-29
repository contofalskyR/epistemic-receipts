import * as os from "node:os";
import * as path from "node:path";

export type MatchJobState = {
  status: "idle" | "running" | "done" | "error";
  processed: number;
  matched: number;
  total: number;
  errors: number;
  startedAt?: number;
  finishedAt?: number;
  errorMessage?: string;
};

export function progressFilePath(bookId: string): string {
  const safe = bookId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(os.tmpdir(), `match-progress-${safe}.json`);
}

export function logFilePath(bookId: string): string {
  const safe = bookId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(os.tmpdir(), `match-log-${safe}.txt`);
}
