import * as os from "node:os";
import * as path from "node:path";

export type IngestJobState = {
  status: "idle" | "running" | "done" | "error";
  processed: number;
  total: number;
  claimCount: number;
  errors: number;
  startedAt?: number;
  finishedAt?: number;
  errorMessage?: string;
};

export const INGEST_IDLE: IngestJobState = {
  status: "idle",
  processed: 0,
  total: 0,
  claimCount: 0,
  errors: 0,
};

export function ingestProgressFilePath(bookId: string): string {
  const safe = bookId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(os.tmpdir(), `ingest-progress-${safe}.json`);
}
