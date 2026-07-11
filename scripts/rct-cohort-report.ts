/**
 * rct-cohort-report.ts
 * ====================
 * The RCT tracker's shakedown cruise: pull one bounded cohort from
 * ClinicalTrials.gov, run every study through the status engine, and write a
 * distribution report. This single output is three things at once — the
 * engine's first run on real data, the evidence for whether the tracker
 * product is real, and the seed of a publishable finding ("X% of completed
 * trials in <condition> never posted results").
 *
 * Usage:
 *   npx tsx scripts/rct-cohort-report.ts --query 'AREA[ConditionSearch] "heart failure" AND AREA[OverallStatus] COMPLETED' --max-pages 5
 *   npx tsx scripts/rct-cohort-report.ts --query 'AREA[OverallStatus] COMPLETED AND AREA[Phase] PHASE3' --max-pages 3
 *
 * Notes:
 * - query.term takes CT.gov Essie syntax; see https://clinicaltrials.gov/find-studies/constructing-complex-search-queries
 * - Pages are 100 studies; --max-pages caps the pull (default 3 = 300 studies).
 * - Read-only against the public API; polite 1s delay between pages; no DB writes.
 * - Output: markdown report to stdout AND scripts/output/rct-cohort-report-<date>.md
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { classifyStudy, searchStudies, type CtgovStudy } from "../tracker/ctgov_adapter";
import type { Status } from "../tracker/dropped_story_classifier";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const QUERY = arg("query");
const MAX_PAGES = Number.parseInt(arg("max-pages", "3")!, 10);
const AS_OF = arg("as-of", new Date().toISOString().slice(0, 10))!;

if (!QUERY) {
  console.error('Missing --query. Example: --query \'AREA[ConditionSearch] "heart failure" AND AREA[OverallStatus] COMPLETED\'');
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const studies: CtgovStudy[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await searchStudies(QUERY!, pageToken);
    studies.push(...res.studies);
    process.stderr.write(`page ${page + 1}: ${res.studies.length} studies (total ${studies.length})\n`);
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
    await sleep(1000);
  }

  const counts: Record<Status, number> = { OPEN: 0, STALLED: 0, RESOLVED: 0, ORPHANED: 0 };
  const orphans: { nct: string; title: string; sponsor: string; completed: string; reason: string }[] = [];
  const oddities: string[] = [];
  // Full per-study rows (every study pulled, not just ORPHANED) so downstream reports can
  // trace every count in the markdown summary back to an individual record.
  const csvRows: string[] = [
    "nctId,title,sponsor,primaryCompletionDate,completionDate,overallStatus,hasResults,classifiedStatus,reason",
  ];
  const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  for (const st of studies) {
    const ident = st.protocolSection.identificationModule;
    const s = st.protocolSection.statusModule;
    try {
      const r = classifyStudy(st, AS_OF);
      counts[r.status]++;
      csvRows.push(
        [
          ident.nctId,
          csvEscape(ident.briefTitle ?? ""),
          csvEscape(st.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name ?? ""),
          s.primaryCompletionDateStruct?.date ?? "",
          s.completionDateStruct?.date ?? "",
          s.overallStatus ?? "",
          String(!!st.hasResults),
          r.status,
          csvEscape(r.reason),
        ].join(","),
      );
      if (r.status === "ORPHANED") {
        orphans.push({
          nct: ident.nctId,
          title: ident.briefTitle.slice(0, 90),
          sponsor: st.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name ?? "—",
          completed: s.completionDateStruct?.date ?? s.primaryCompletionDateStruct?.date ?? "—",
          reason: r.reason,
        });
      }
    } catch (e) {
      oddities.push(`${ident?.nctId ?? "?"}: ${(e as Error).message}`);
    }
  }

  const total = studies.length;
  const pct = (n: number) => (total ? ((100 * n) / total).toFixed(1) + "%" : "—");
  const lines: string[] = [];
  lines.push(`# RCT cohort status report`);
  lines.push(``);
  lines.push(`- Query: \`${QUERY}\``);
  lines.push(`- As-of date: ${AS_OF} · Studies pulled: ${total} (max ${MAX_PAGES} pages)`);
  lines.push(``);
  lines.push(`| Status | Count | Share |`);
  lines.push(`|---|---|---|`);
  (Object.keys(counts) as Status[]).forEach((k) => lines.push(`| ${k} | ${counts[k]} | ${pct(counts[k])} |`));
  lines.push(``);
  lines.push(`## ORPHANED — completed, resultless, past the reporting window (${orphans.length})`);
  lines.push(``);
  lines.push(`| NCT | Sponsor | Completed | Title |`);
  lines.push(`|---|---|---|---|`);
  for (const o of orphans.slice(0, 200)) lines.push(`| ${o.nct} | ${o.sponsor} | ${o.completed} | ${o.title} |`);
  if (orphans.length > 200) lines.push(`| … | | | ${orphans.length - 200} more |`);
  if (oddities.length) {
    lines.push(``, `## Records that failed to classify (${oddities.length})`, ``);
    oddities.slice(0, 20).forEach((o) => lines.push(`- ${o}`));
  }
  lines.push(``, `---`, `Sanity checks before believing this: spot-check 5 ORPHANED rows on clinicaltrials.gov by hand `);
  lines.push(`(results genuinely absent? completion date right?), and confirm the RESOLVED share isn't inflated by `);
  lines.push(`hasResults=true records with no resultsFirstPostDate. The engine errs STALLED when unsure — a low `);
  lines.push(`ORPHANED count is conservative by design, not broken.`);

  const report = lines.join("\n");
  console.log(report);
  mkdirSync("scripts/output", { recursive: true });
  const path = `scripts/output/rct-cohort-report-${AS_OF}.md`;
  writeFileSync(path, report);
  process.stderr.write(`\nwritten: ${path}\n`);
  const csvPath = `scripts/output/rct-cohort-data-${AS_OF}.csv`;
  writeFileSync(csvPath, csvRows.join("\n") + "\n");
  process.stderr.write(`written: ${csvPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
