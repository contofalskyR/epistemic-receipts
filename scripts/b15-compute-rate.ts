/**
 * B15-3 — Compute the measured error rate from verified worksheets.
 *
 * Reads findings/b15-error-audit/worksheet-*.md (verdicts filled in by the
 * owner per B15-2) plus sampling-manifest.json, computes overall and
 * per-stratum error rates with Wilson 95% CIs, and writes:
 *
 *   findings/b15-error-audit/report.md          — full audit report
 *   findings/b15-error-audit/published-rate.json — machine-readable rate that
 *     /methodology renders (the page shows nothing until this file exists)
 *
 * Zero DB access; pure file processing. Run: npx tsx scripts/b15-compute-rate.ts
 * Flags:
 *   --allow-partial   compute even if some rows are PENDING/DISPUTED
 *                     (published-rate.json is still withheld unless complete)
 *   --dry-run         print the report to stdout, write nothing
 *
 * Error definition (per brief): WRONG_DATE, WRONG_AXIS, SOURCE_MISMATCH,
 * IDENTITY_MISMATCH are errors. UNVERIFIABLE is excluded from the error
 * denominator and reported as its own rate. Verdicts are the owner's alone —
 * this script tallies, it never judges.
 */

import * as fs from "fs";
import * as path from "path";

const AUDIT_DIR = path.join(process.cwd(), "findings", "b15-error-audit");
const ERROR_VERDICTS = new Set(["WRONG_DATE", "WRONG_AXIS", "SOURCE_MISMATCH", "IDENTITY_MISMATCH"]);
const KNOWN_VERDICTS = new Set([...ERROR_VERDICTS, "CORRECT", "UNVERIFIABLE", "DISPUTED"]);

type Row = {
  cshId: string;
  claimId: string;
  pipeline: string;
  stratum: string;
  verdict: string; // one of KNOWN_VERDICTS or "PENDING"
  flags: string[];
  notes: string;
};

function wilson(k: number, n: number, z = 1.959964): { p: number; low: number; high: number } {
  if (n === 0) return { p: 0, low: 0, high: 0 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { p, low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

function pct(x: number, digits = 2): string {
  return (100 * x).toFixed(digits) + "%";
}

function parseWorksheet(file: string): Row[] {
  const stratum = path
    .basename(file, ".md")
    .replace(/^worksheet-/, "")
    .replace(/-([^-]+)$/, ":$1"); // last hyphen separates family:class
  const text = fs.readFileSync(file, "utf8");
  const rowChunks = text.split(/^## Row /m).slice(1);
  const rows: Row[] = [];
  for (const chunk of rowChunks) {
    const cshId = /·\s*CSH\.id:\s*(\S+)/.exec(chunk)?.[1] ?? "(unknown)";
    const claimId = /\*\*Claim ID:\*\*\s*(\S+)/.exec(chunk)?.[1] ?? "(unknown)";
    const pipeline = /\*\*Pipeline:\*\*\s*(\S+)/.exec(chunk)?.[1] ?? "(unknown)";
    const verdictLine = /\*\*Verdict:\*\*\s*([^\n]*)/.exec(chunk)?.[1] ?? "";
    const flagsLine = /\*\*Secondary flags:\*\*\s*([^\n]*)/.exec(chunk)?.[1] ?? "";
    const notes = (/\*\*Notes:\*\*\s*([^\n]*)/.exec(chunk)?.[1] ?? "")
      .replace(/^_\(optional\)_?$/, "")
      .trim();

    let verdict = "PENDING";
    if (!/_\(fill in/.test(verdictLine)) {
      const m = verdictLine.toUpperCase().match(/[A-Z_]{4,}/g) ?? [];
      const found = m.find((w) => KNOWN_VERDICTS.has(w));
      if (found) verdict = found;
      else if (verdictLine.trim() !== "") verdict = "UNRECOGNIZED:" + verdictLine.trim();
    }

    const flags = /_\(optional/.test(flagsLine)
      ? []
      : (flagsLine.toUpperCase().match(/DEAD_LINK|PRECISION_SHARPENING/g) ?? []);

    rows.push({ cshId, claimId, pipeline, stratum, verdict, flags, notes });
  }
  return rows;
}

function main() {
  const allowPartial = process.argv.includes("--allow-partial");
  const dryRun = process.argv.includes("--dry-run");

  const manifest = JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, "sampling-manifest.json"), "utf8"));
  const files = fs
    .readdirSync(AUDIT_DIR)
    .filter((f) => f.startsWith("worksheet-") && f.endsWith(".md"))
    .map((f) => path.join(AUDIT_DIR, f));
  if (files.length === 0) throw new Error("No worksheets found in " + AUDIT_DIR);

  const rows = files.flatMap(parseWorksheet);
  const unrecognized = rows.filter((r) => r.verdict.startsWith("UNRECOGNIZED:"));
  if (unrecognized.length > 0) {
    console.error("Unrecognized verdicts (fix the worksheet wording):");
    for (const r of unrecognized) console.error(`  ${r.cshId}: ${r.verdict.slice("UNRECOGNIZED:".length)}`);
    process.exit(1);
  }

  const pending = rows.filter((r) => r.verdict === "PENDING");
  const disputed = rows.filter((r) => r.verdict === "DISPUTED");
  const complete = pending.length === 0 && disputed.length === 0;
  if (!complete && !allowPartial) {
    console.error(
      `Verification incomplete: ${pending.length} PENDING, ${disputed.length} DISPUTED of ${rows.length} rows.\n` +
        `Finish the worksheets (B15-2) or re-run with --allow-partial for an interim view.`
    );
    process.exit(1);
  }

  const decided = rows.filter((r) => r.verdict !== "PENDING" && r.verdict !== "DISPUTED");
  const unverifiable = decided.filter((r) => r.verdict === "UNVERIFIABLE");
  const denominatorRows = decided.filter((r) => r.verdict !== "UNVERIFIABLE");
  const errorRows = denominatorRows.filter((r) => ERROR_VERDICTS.has(r.verdict));

  const overall = wilson(errorRows.length, denominatorRows.length);
  const unverifiableRate = decided.length > 0 ? unverifiable.length / decided.length : 0;

  // Per-stratum table + population-weighted supplementary estimate
  const strata = [...new Set(rows.map((r) => r.stratum))].sort();
  let weightedSum = 0;
  let weightedPop = 0;
  const stratumStats = strata.map((s) => {
    const sRows = rows.filter((r) => r.stratum === s);
    const sDecided = sRows.filter((r) => r.verdict !== "PENDING" && r.verdict !== "DISPUTED");
    const sDenom = sDecided.filter((r) => r.verdict !== "UNVERIFIABLE");
    const sErr = sDenom.filter((r) => ERROR_VERDICTS.has(r.verdict));
    const w = wilson(sErr.length, sDenom.length);
    const population: number = manifest.strata?.[s]?.population ?? 0;
    const thin = sDenom.length < 20;
    if (!thin && population > 0) {
      weightedSum += w.p * population;
      weightedPop += population;
    }
    return { stratum: s, sampled: sRows.length, verified: sDenom.length, errors: sErr.length, w, population, thin };
  });
  const weightedRate = weightedPop > 0 ? weightedSum / weightedPop : overall.p;

  const verdictCounts: Record<string, number> = {};
  for (const r of rows) verdictCounts[r.verdict] = (verdictCounts[r.verdict] ?? 0) + 1;

  const computedAt = new Date().toISOString();
  const quotable =
    `Across a seeded, stratified random sample of ${denominatorRows.length} machine-written status transitions ` +
    `(population ${Number(manifest.totalPopulation).toLocaleString("en-US")}), ` +
    `${errorRows.length} contained a verified error — a measured error rate of ${pct(overall.p)} ` +
    `(95% CI ${pct(overall.low)}–${pct(overall.high)}). ` +
    `A further ${pct(unverifiableRate, 1)} of sampled rows could not be verified against a live source and are reported separately, not counted as correct.`;

  const lines: string[] = [];
  lines.push(`# B15 Error-Rate Audit — Computed Report`);
  lines.push(``);
  lines.push(`**Computed:** ${computedAt}  `);
  lines.push(`**Sampling manifest:** seed ${manifest.seed}, cutoff ${manifest.cutoffTimestamp}, population ${Number(manifest.totalPopulation).toLocaleString("en-US")}, drawn n=${manifest.actualN}  `);
  lines.push(`**Verification status:** ${rows.length} rows · ${pending.length} pending · ${disputed.length} disputed${complete ? " · COMPLETE" : " · **PARTIAL — not publishable**"}`);
  lines.push(``);
  lines.push(`## Headline`);
  lines.push(``);
  lines.push(quotable);
  lines.push(``);
  lines.push(`Supplementary population-weighted estimate (strata with ≥20 verified rows): ${pct(weightedRate)}. The pooled Wilson interval above is the published number; the weighted figure is a robustness check.`);
  lines.push(``);
  lines.push(`## Verdict counts`);
  lines.push(``);
  for (const [v, c] of Object.entries(verdictCounts).sort((a, b) => b[1] - a[1])) lines.push(`- ${v}: ${c}`);
  lines.push(``);
  lines.push(`## Per-stratum rates`);
  lines.push(``);
  lines.push(`| Stratum | Population | Sampled | Verified | Errors | Rate | 95% CI |`);
  lines.push(`|---|---|---|---|---|---|---|`);
  for (const s of stratumStats) {
    const rate = s.thin ? "insufficient n" : pct(s.w.p);
    const ci = s.thin ? "—" : `${pct(s.w.low)}–${pct(s.w.high)}`;
    lines.push(
      `| ${s.stratum} | ${s.population.toLocaleString("en-US")} | ${s.sampled} | ${s.verified} | ${s.errors} | ${rate} | ${ci} |`
    );
  }
  lines.push(``);
  lines.push(`## Confirmed-wrong rows (pre-correction)`);
  lines.push(``);
  if (errorRows.length === 0) lines.push(`None.`);
  for (const r of errorRows) {
    lines.push(`- \`${r.cshId}\` (claim \`${r.claimId}\`, ${r.pipeline}, ${r.stratum}): **${r.verdict}**${r.flags.length ? " [" + r.flags.join(", ") + "]" : ""}${r.notes ? " — " + r.notes : ""}`);
  }
  lines.push(``);
  if (disputed.length > 0) {
    lines.push(`## Disputed rows (adjudicate before publishing)`);
    lines.push(``);
    for (const r of disputed) lines.push(`- \`${r.cshId}\` (${r.stratum})${r.notes ? " — " + r.notes : ""}`);
    lines.push(``);
  }
  lines.push(`## Method note`);
  lines.push(``);
  lines.push(
    `Stratified random sample (seeded, reproducible — seed and strata in sampling-manifest.json). ` +
      `Verdicts rendered exclusively by the human owner against live sources (B15-2); workers prepared evidence only. ` +
      `UNVERIFIABLE rows are excluded from the error denominator and reported separately. ` +
      `Corrections to confirmed-wrong rows happen only after this rate is published (B15-4); the published rate reflects the corpus as sampled.`
  );
  const report = lines.join("\n") + "\n";

  if (dryRun) {
    console.log(report);
    return;
  }

  fs.writeFileSync(path.join(AUDIT_DIR, "report.md"), report);
  console.log(`Wrote ${path.join(AUDIT_DIR, "report.md")}`);

  if (complete) {
    const published = {
      version: 1,
      computedAt,
      populationDescription: "machine-written ClaimStatusHistory rows (humanReviewed claims and hand-curated seeds excluded)",
      population: manifest.totalPopulation,
      seed: manifest.seed,
      cutoffTimestamp: manifest.cutoffTimestamp,
      sampledRows: rows.length,
      verifiedRows: denominatorRows.length,
      errorRows: errorRows.length,
      errorRate: overall.p,
      wilsonLow: overall.low,
      wilsonHigh: overall.high,
      unverifiableRate,
      quotableSentence: quotable,
      perStratum: stratumStats.map((s) => ({
        stratum: s.stratum,
        population: s.population,
        verified: s.verified,
        errors: s.errors,
        rate: s.thin ? null : s.w.p,
        wilsonLow: s.thin ? null : s.w.low,
        wilsonHigh: s.thin ? null : s.w.high,
        insufficientN: s.thin,
      })),
    };
    fs.writeFileSync(path.join(AUDIT_DIR, "published-rate.json"), JSON.stringify(published, null, 2) + "\n");
    console.log(`Wrote ${path.join(AUDIT_DIR, "published-rate.json")} — /methodology will render it on next deploy.`);
  } else {
    console.log(`PARTIAL run: published-rate.json withheld (${pending.length} pending, ${disputed.length} disputed).`);
  }
}

main();
