/**
 * B15-2 review CLI — makes the OWNER's verdict pass fast without touching the
 * circularity rule: this tool renders evidence and records keystrokes; every
 * verdict is yours. (Workers prepared evidence; verdicts are the owner's
 * alone — brief B15, STOP conditions.)
 *
 * Run on the Mac:  npx tsx scripts/b15-review.ts [--stratum legislation-baseline]
 *
 * For each PENDING row it prints the full worksheet entry (claim, transition,
 * source, pre-fetched evidence) and takes one key:
 *
 *   c  CORRECT            d  WRONG_DATE         x  WRONG_AXIS
 *   s  SOURCE_MISMATCH    i  IDENTITY_MISMATCH  u  UNVERIFIABLE
 *   p  DISPUTED (adjudicate later)
 *   o  open the source URL in your browser      n  add a note first
 *   f  toggle flags (DEAD_LINK / PRECISION_SHARPENING) for this row
 *   enter  skip for now                         q  quit (everything saved)
 *
 * The file is rewritten after EVERY verdict — quit or crash any time, rerun
 * to resume; only pending rows are shown. Progress tally on every row.
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { spawn } from "child_process";

const AUDIT_DIR = path.join(process.cwd(), "findings", "b15-error-audit");
const PENDING_RE = /\*\*Verdict:\*\*\s*_\(fill in[^\n]*/;

const KEY_TO_VERDICT: Record<string, string> = {
  c: "CORRECT",
  d: "WRONG_DATE",
  x: "WRONG_AXIS",
  s: "SOURCE_MISMATCH",
  i: "IDENTITY_MISMATCH",
  u: "UNVERIFIABLE",
  p: "DISPUTED",
};

type RowRef = { file: string; rowHeader: string; body: string };

function listPendingRows(files: string[]): RowRef[] {
  const rows: RowRef[] = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const chunks = text.split(/^(?=## Row )/m);
    for (const chunk of chunks) {
      if (!chunk.startsWith("## Row ")) continue;
      if (PENDING_RE.test(chunk)) {
        rows.push({ file, rowHeader: chunk.split("\n")[0], body: chunk });
      }
    }
  }
  return rows;
}

function writeVerdict(file: string, rowHeader: string, verdict: string, flags: string[], note: string) {
  const text = fs.readFileSync(file, "utf8");
  const chunks = text.split(/^(?=## Row )/m);
  const idx = chunks.findIndex((c) => c.startsWith(rowHeader));
  if (idx === -1) throw new Error(`Row not found (edited elsewhere?): ${rowHeader} in ${file}`);
  let chunk = chunks[idx];
  chunk = chunk.replace(PENDING_RE, `**Verdict:** ${verdict}  `);
  if (flags.length > 0) {
    chunk = chunk.replace(/\*\*Secondary flags:\*\*\s*_\(optional[^\n]*/, `**Secondary flags:** ${flags.join(", ")}  `);
  }
  if (note.trim()) {
    chunk = chunk.replace(/\*\*Notes:\*\*\s*_\(optional\)_?[^\n]*/, `**Notes:** ${note.trim()}  `);
  }
  chunks[idx] = chunk;
  fs.writeFileSync(file, chunks.join(""));
}

function extractUrl(body: string): string | null {
  const m = /\*\*Source:\*\*\s*(\S+)/.exec(body);
  if (!m || m[1].startsWith("*(")) return null;
  return m[1];
}

async function main() {
  const stratumIdx = process.argv.indexOf("--stratum");
  const stratumFilter = stratumIdx > -1 ? process.argv[stratumIdx + 1] : null;

  const files = fs
    .readdirSync(AUDIT_DIR)
    .filter((f) => f.startsWith("worksheet-") && f.endsWith(".md"))
    .filter((f) => (stratumFilter ? f.includes(stratumFilter) : true))
    .map((f) => path.join(AUDIT_DIR, f));
  if (files.length === 0) {
    console.error(`No worksheets${stratumFilter ? ` matching --stratum ${stratumFilter}` : ""} in ${AUDIT_DIR}`);
    process.exit(1);
  }

  let pending = listPendingRows(files);
  const totalPendingAtStart = pending.length;
  if (pending.length === 0) {
    console.log("Nothing pending — every row has a verdict. Run: npx tsx scripts/b15-compute-rate.ts");
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((res) => rl.question(q, res));

  console.log(`\nB15-2 review — ${pending.length} pending rows across ${files.length} worksheet(s).`);
  console.log(`Verdicts are yours alone; this tool only records them.\n`);

  let done = 0;
  const tally: Record<string, number> = {};

  while (pending.length > 0) {
    const row = pending[0];
    const url = extractUrl(row.body);
    console.log("\n" + "─".repeat(78));
    console.log(`[${totalPendingAtStart - pending.length + 1}/${totalPendingAtStart}] ${path.basename(row.file)}`);
    console.log("─".repeat(78));
    // Print the row body up to (not including) the verdict scaffold lines.
    console.log(row.body.split("**Verdict:**")[0].trim());
    console.log("─".repeat(78));

    let flags: string[] = [];
    let note = "";
    let decided = false;
    while (!decided) {
      const key = (
        await ask(
          `verdict [c/d/x/s/i/u/p] · o=open-url f=flags n=note enter=skip q=quit ${flags.length ? `(flags: ${flags.join(",")}) ` : ""}> `
        )
      )
        .trim()
        .toLowerCase();

      if (key === "q") {
        console.log(`\nSaved. ${done} verdicts this session · ${pending.length} still pending. Rerun to resume.`);
        rl.close();
        return;
      } else if (key === "") {
        pending.push(pending.shift()!); // skip to the back of the queue
        decided = true;
      } else if (key === "o") {
        if (url) {
          console.log(`  ${url}`);
          try {
            spawn("open", [url], { stdio: "ignore", detached: true }).unref();
          } catch {
            /* printing it is enough on non-mac */
          }
        } else {
          console.log("  (no source URL recorded for this row)");
        }
      } else if (key === "f") {
        const f = (await ask("  flags — 1=DEAD_LINK 2=PRECISION_SHARPENING (e.g. 12, empty=clear) > ")).trim();
        flags = [];
        if (f.includes("1")) flags.push("DEAD_LINK");
        if (f.includes("2")) flags.push("PRECISION_SHARPENING");
      } else if (key === "n") {
        note = await ask("  note > ");
      } else if (KEY_TO_VERDICT[key]) {
        const verdict = KEY_TO_VERDICT[key];
        writeVerdict(row.file, row.rowHeader, verdict, flags, note);
        tally[verdict] = (tally[verdict] ?? 0) + 1;
        done++;
        pending.shift();
        const tallyStr = Object.entries(tally)
          .map(([v, n]) => `${v}:${n}`)
          .join(" · ");
        console.log(`  ✓ ${verdict}   (session: ${tallyStr})`);
        decided = true;
      } else {
        console.log("  unrecognized key");
      }
    }
    // Refresh pending list from disk every 25 verdicts (cheap safety re-sync).
    if (done > 0 && done % 25 === 0) pending = listPendingRows(files).filter((r) => pending.some((p) => p.rowHeader === r.rowHeader && p.file === r.file));
  }

  rl.close();
  console.log(`\nAll rows decided. Next: npx tsx scripts/b15-compute-rate.ts`);
}

main();
