import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { compactCount } from "@/lib/format";

// Front door phase 1 (STATUS.md, locked 2026-09-30): the corpus total has ONE
// definition (lib/corpus.ts) and NO hand-written figures. Before the fix the
// site said 1.62M (homepage), "1.76M" (nav), "1.7M+" (layout metadata) and
// "over 1.7 million" (/start-here) at the same time. This guard fails the
// moment someone types a corpus figure into rendered code again.

const ROOT = path.resolve(__dirname, "../..");
const DIRS = ["app", "components", "lib"].map((d) => path.join(ROOT, d));

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Strip block comments, line comments and JSX comments — scale notes in
 *  comments ("~1.76M claim URLs") are fine; rendered strings are not. */
function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\"'`])\/\/.*$/gm, "$1");
}

// A typed corpus total: "1.76M claims", "1.7M+ sourced claims", "over 1.7 million
// claims", "1,758,084 claims" — a figure of at least 1,000 within two words of
// "claims". Historical or financial figures ("1.5 million arrived") are not matched.
const CORPUS_LITERAL =
  /\b(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?\s?(?:M\+?|million))\+?\s+(?:\w+\s+){0,2}claims\b/i;

// A figure next to an ISO date is a record of what was true then ("seeded
// 2026-06-06 (5,000 claims)"), not a live total; /corrections is an audit log
// of such records by design. Both are exempt.
const DATED = /\b\d{4}-\d{2}-\d{2}\b/;
const AUDIT_LOG = path.join(ROOT, "app", "corrections") + path.sep;

describe("corpus total: derived from lib/corpus.ts, never typed", () => {
  const offenders: string[] = [];
  for (const file of DIRS.flatMap((d) => walk(d))) {
    if (file.startsWith(AUDIT_LOG)) continue;
    const lines = stripComments(fs.readFileSync(file, "utf8")).split("\n");
    lines.forEach((line, i) => {
      if (CORPUS_LITERAL.test(line) && !DATED.test(line)) {
        offenders.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
      }
    });
  }

  it("scans a meaningful number of files", () => {
    expect(DIRS.flatMap((d) => walk(d)).length).toBeGreaterThan(100);
  });

  it("finds no hand-written corpus figure in rendered code", () => {
    expect(offenders).toEqual([]);
  });
});

describe("compactCount — the public corpus figure", () => {
  it("renders the locked corpus count as 1.76M", () => {
    expect(compactCount(1_758_084)).toBe("1.76M");
    expect(compactCount(1_758_090)).toBe("1.76M");
  });

  it("would move with the data instead of drifting", () => {
    expect(compactCount(1_619_751)).toBe("1.62M");
    expect(compactCount(2_004_000)).toBe("2M");
    expect(compactCount(412_345)).toBe("412k");
    expect(compactCount(9_340)).toBe("9,340");
  });
});
