/**
 * Structured JSON-lines logger for pipeline scripts.
 * Output format: {"ts":"...","level":"info","pipeline":"tag","event":"name",...fields}
 *
 * Writes to stdout. In Vercel functions, stdout is captured into function logs.
 * In scripts, pipe to a file or stream to a log aggregator.
 */

type Level = "debug" | "info" | "warn" | "error";

type LogRecord = {
  ts: string;
  level: Level;
  pipeline: string;
  event: string;
  [key: string]: unknown;
};

function emit(record: LogRecord): void {
  process.stdout.write(JSON.stringify(record) + "\n");
}

export function makeLogger(pipeline: string) {
  function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
    emit({ ts: new Date().toISOString(), level, pipeline, event, ...fields });
  }

  return {
    debug: (event: string, fields?: Record<string, unknown>) => log("debug", event, fields),
    info: (event: string, fields?: Record<string, unknown>) => log("info", event, fields),
    warn: (event: string, fields?: Record<string, unknown>) => log("warn", event, fields),
    error: (event: string, fields?: Record<string, unknown>) => log("error", event, fields),
  };
}
