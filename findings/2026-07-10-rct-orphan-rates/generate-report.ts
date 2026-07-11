/**
 * generate-report.ts
 * ===================
 * Per-condition aggregator for the RCT-orphan-rate finding.
 *
 * scripts/rct-cohort-report.ts (unmodified, not touched by this file) runs ONE
 * CT.gov query per invocation and prints a markdown report. This finding needs
 * several conditions compared side by side and a row-level CSV that a third
 * party can re-derive the report's numbers from — neither of which the base
 * script does. So this driver imports the SAME unmodified classification
 * engine (tracker/ctgov_adapter.ts -> tracker/dropped_story_classifier.ts) and
 * loops it over a fixed condition list, writing one CSV row per study.
 *
 * Scope note: "ORPHANED" here is the engine's definition — a COMPLETED,
 * randomized-allocation trial with no results ever posted to ClinicalTrials.gov,
 * past the 365-day FDAAA-style grace window (see tracker/ctgov_adapter.ts
 * RESULTS_GRACE_DAYS). That is NOT the same thing as "results never cited by a
 * later systematic review or guideline" — this script has no way to check
 * Cochrane/guideline citation graphs. See report.md Limitations.
 *
 * Regeneration command:
 *   npx tsx findings/2026-07-10-rct-orphan-rates/generate-report.ts
 *
 * Writes findings/2026-07-10-rct-orphan-rates/data.csv directly (not via shell
 * redirection) because dropped_story_classifier.ts runs its own eval-example
 * self-test on import and prints PASS/FAIL lines to stdout; redirecting stdout
 * would corrupt the CSV.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { classifyStudy, searchStudies, type CtgovStudy } from "../../tracker/ctgov_adapter";

const AS_OF = new Date().toISOString().slice(0, 10);

const CONDITIONS: { label: string; term: string }[] = [
  { label: "heart failure", term: '"heart failure"' },
  { label: "type 2 diabetes", term: '"type 2 diabetes"' },
  { label: "breast cancer", term: '"breast cancer"' },
  { label: "major depressive disorder", term: '"major depressive disorder"' },
  { label: "COVID-19", term: '"COVID-19"' },
  { label: "Alzheimer disease", term: '"Alzheimer disease"' },
];

function queryFor(term: string): string {
  return `AREA[ConditionSearch] ${term} AND AREA[OverallStatus] COMPLETED AND AREA[DesignAllocation] RANDOMIZED`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

async function fetchAllForCondition(term: string): Promise<CtgovStudy[]> {
  const query = queryFor(term);
  const studies: CtgovStudy[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 200; page++) {
    const res = await searchStudies(query, pageToken);
    studies.push(...res.studies);
    process.stderr.write(`  page ${page + 1}: ${res.studies.length} (total ${studies.length})\n`);
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
    await sleep(1000);
  }
  return studies;
}

async function main() {
  const header = [
    "condition", "query", "nct_id", "sponsor", "overall_status", "has_results",
    "completion_date", "primary_completion_date", "results_first_post_date",
    "computed_status", "reason", "as_of_date",
  ];
  const rows: string[] = [header.join(",")];

  for (const c of CONDITIONS) {
    process.stderr.write(`\n=== ${c.label} ===\n`);
    const query = queryFor(c.term);
    const studies = await fetchAllForCondition(c.term);
    for (const st of studies) {
      try {
        const r = classifyStudy(st, AS_OF);
        const s = st.protocolSection.statusModule;
        const row = [
          c.label,
          query,
          st.protocolSection.identificationModule.nctId,
          st.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name ?? "",
          s.overallStatus,
          String(!!st.hasResults),
          s.completionDateStruct?.date ?? "",
          s.primaryCompletionDateStruct?.date ?? "",
          s.resultsFirstPostDateStruct?.date ?? "",
          r.status,
          r.reason,
          AS_OF,
        ].map((v) => csvEscape(String(v)));
        rows.push(row.join(","));
      } catch (e) {
        process.stderr.write(`  ERROR ${st.protocolSection?.identificationModule?.nctId}: ${(e as Error).message}\n`);
      }
    }
  }

  mkdirSync("findings/2026-07-10-rct-orphan-rates", { recursive: true });
  const path = "findings/2026-07-10-rct-orphan-rates/data.csv";
  writeFileSync(path, rows.join("\n") + "\n");
  process.stderr.write(`\nwritten: ${path} (${rows.length - 1} rows)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
