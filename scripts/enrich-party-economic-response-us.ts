/**
 * enrich-party-economic-response-us.ts
 *
 * US-only variant of enrich-party-economic-response.ts. Same methodology,
 * same crisis thresholds, same party keyword tables — but restricted to
 * laws ingested by US legislative pipelines and US World Bank indicators.
 *
 * US pipelines: congress_v1, congress_bills_v1, fr_rules_v1 (ISO3 = USA).
 *
 * Output: scripts/output/party-economic-response-us.json
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.scripts.json \
 *     scripts/enrich-party-economic-response-us.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const BATCH = 5000;

type Alignment = "left" | "right" | "center" | "unknown";
type CrisisTag = "recession" | "high-unemployment" | "high-inflation";

const LEFT_KEYWORDS = [
  "labour",
  "labor",
  "social democrat",
  "social-democrat",
  "socialist",
  "socialdemokrat",
  "workers",
  "workers'",
  "communist",
  "green",
  "left",
  "sandinista",
  "awami",
  "social democracy",
  "democratic", // US Democratic Party
];

const RIGHT_KEYWORDS = [
  "conservative",
  "republican",
  "christian democrat",
  "christian democracy",
  "christian-democrat",
  "christian social",
  "christdemokrat",
  "national party",
  "people's party",
  "likud",
  "law and justice",
  "brothers of italy",
  "fianna fáil",
  "fianna fail",
  "bharatiya janata",
  "isamaa",
  "forza italia",
];

const CENTER_KEYWORDS = [
  "liberal",
  "centrist",
  "centre party",
  "center party",
  "reform party",
  "free democrat",
  "renaissance",
  "civic platform",
];

const US_PIPELINES = ["congress_v1", "congress_bills_v1", "fr_rules_v1"];
const US_ISO3 = "USA";

function classifyParty(party: string | null | undefined): Alignment {
  if (!party) return "unknown";
  const p = party.toLowerCase();
  for (const k of LEFT_KEYWORDS) if (p.includes(k)) return "left";
  for (const k of RIGHT_KEYWORDS) if (p.includes(k)) return "right";
  for (const k of CENTER_KEYWORDS) if (p.includes(k)) return "center";
  return "unknown";
}

type IndicatorCode = "NY.GDP.MKTP.KD.ZG" | "SL.UEM.TOTL.ZS" | "FP.CPI.TOTL.ZG";

const TAG_FOR_CODE: Record<IndicatorCode, CrisisTag> = {
  "NY.GDP.MKTP.KD.ZG": "recession",
  "SL.UEM.TOTL.ZS": "high-unemployment",
  "FP.CPI.TOTL.ZG": "high-inflation",
};

// US-tuned thresholds (per task spec): recession = GDP < 0 (contraction),
// high unemployment > 7%, high inflation > 5%. These are calibrated for the
// US macro regime since 1947 — broader than the global 10/20 thresholds.
function evaluate(code: IndicatorCode, value: number): boolean {
  if (code === "NY.GDP.MKTP.KD.ZG") return value < 0;
  if (code === "SL.UEM.TOTL.ZS") return value > 7;
  if (code === "FP.CPI.TOTL.ZG") return value > 5;
  return false;
}

/**
 * The three crisis indicators are not ingested into worldbank_v1 for USA
 * (current US coverage in the DB: GDP level, GDP per capita, population,
 * life expectancy, CO2 only). Rather than block on extending the WB
 * ingester, fetch the three series directly from the World Bank public
 * API. No auth required.
 */
async function loadUsCrisisIndicators(): Promise<Map<IndicatorCode, Map<number, number>>> {
  const codes: IndicatorCode[] = ["NY.GDP.MKTP.KD.ZG", "SL.UEM.TOTL.ZS", "FP.CPI.TOTL.ZG"];
  const out = new Map<IndicatorCode, Map<number, number>>();
  for (const code of codes) {
    const url = `https://api.worldbank.org/v2/country/USA/indicator/${code}?format=json&per_page=200`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`WB API ${r.status} for ${code}`);
    const body = (await r.json()) as [unknown, Array<{ date: string; value: number | null }>];
    if (!Array.isArray(body) || body.length < 2 || !Array.isArray(body[1])) {
      throw new Error(`WB API unexpected shape for ${code}`);
    }
    const byYear = new Map<number, number>();
    for (const row of body[1]) {
      if (row.value == null) continue;
      const y = parseInt(row.date, 10);
      if (!Number.isFinite(y)) continue;
      byYear.set(y, row.value);
    }
    out.set(code, byYear);
    console.log(`  Fetched ${byYear.size} US observations for ${code}`);
  }
  return out;
}

interface LawRow {
  lawClaimId: string;
  lawText: string;
  ingestedBy: string;
  legislationYear: number | null;
  hogParty: string | null;
}

async function* streamUsInScopeLaws(): AsyncGenerator<LawRow[]> {
  let lastId = "";
  while (true) {
    const rows = await prisma.$queryRaw<LawRow[]>`
      SELECT DISTINCT ON (law.id)
             law.id                                          AS "lawClaimId",
             law.text                                        AS "lawText",
             law."ingestedBy"                                AS "ingestedBy",
             EXTRACT(YEAR FROM law."claimEmergedAt")::int    AS "legislationYear",
             pc."hogParty"                                   AS "hogParty"
      FROM "Claim" law
      JOIN "ClaimRelation" cr ON cr."fromClaimId" = law.id
      LEFT JOIN "Edge"   e  ON e."claimId" = law.id AND e.deleted = false
      LEFT JOIN "Source" s  ON s.id = e."sourceId" AND s.deleted = false
      LEFT JOIN "PoliticalContext" pc ON pc."sourceId" = s.id
      WHERE cr."relationType" = 'ECONOMIC_CONTEXT'
        AND law."ingestedBy" IN (${US_PIPELINES[0]}, ${US_PIPELINES[1]}, ${US_PIPELINES[2]})
        AND law.id > ${lastId}
      ORDER BY law.id ASC, (pc."hogParty" IS NULL) ASC
      LIMIT ${BATCH}
    `;
    if (rows.length === 0) break;
    lastId = rows[rows.length - 1].lawClaimId;
    yield rows;
  }
}

async function loadUsVoteResults(): Promise<Map<string, { passed: number; failed: number }>> {
  const rows = await prisma.$queryRaw<
    Array<{ claimid: string; result: string; n: bigint }>
  >`
    SELECT e."claimId"        AS claimid,
           lv.result          AS result,
           COUNT(*)::bigint   AS n
    FROM "LegislativeVote" lv
    JOIN "Edge" e ON e."sourceId" = lv."sourceId" AND e.deleted = false
    JOIN "Claim" c ON c.id = e."claimId" AND c.deleted = false
    WHERE lv.result IN ('passed','failed')
      AND c."ingestedBy" IN (${US_PIPELINES[0]}, ${US_PIPELINES[1]}, ${US_PIPELINES[2]})
    GROUP BY e."claimId", lv.result
  `;
  const out = new Map<string, { passed: number; failed: number }>();
  for (const r of rows) {
    const cur = out.get(r.claimid) ?? { passed: 0, failed: 0 };
    if (r.result === "passed") cur.passed += Number(r.n);
    else cur.failed += Number(r.n);
    out.set(r.claimid, cur);
  }
  return out;
}

interface Bucket {
  laws: number;
  lawsWithVoteData: number;
  passed: number;
  failed: number;
}

function newBucket(): Bucket {
  return { laws: 0, lawsWithVoteData: 0, passed: 0, failed: 0 };
}

function summarize(b: Bucket) {
  const total = b.passed + b.failed;
  return {
    laws: b.laws,
    lawsWithVoteData: b.lawsWithVoteData,
    passed: b.passed,
    failed: b.failed,
    passRate: total > 0 ? Number((b.passed / total).toFixed(4)) : null,
  };
}

function emptyAlignmentSet(): Record<Alignment, Bucket> {
  return { left: newBucket(), right: newBucket(), center: newBucket(), unknown: newBucket() };
}

async function fullAnalysis() {
  console.log("\n=== Party × Economic Response (US-only) ===\n");

  console.log("Step 1: Loading US crisis indicator series (3 codes)…");
  const crisis = await loadUsCrisisIndicators();
  let cells = 0;
  for (const m of crisis.values()) cells += m.size;
  console.log(`  Loaded ${cells.toLocaleString()} (code, year) cells for US.`);

  console.log("\nStep 2: Loading US vote pass/fail tallies by claim…");
  const votes = await loadUsVoteResults();
  console.log(`  ${votes.size.toLocaleString()} US claims have at least one pass/fail vote.`);

  console.log("\nStep 3: Streaming US in-scope legislation claims…");

  const byIndicator: Record<CrisisTag, Record<Alignment, Bucket>> = {
    recession: emptyAlignmentSet(),
    "high-unemployment": emptyAlignmentSet(),
    "high-inflation": emptyAlignmentSet(),
  };
  const baseline: Record<CrisisTag, Record<Alignment, Bucket>> = {
    recession: emptyAlignmentSet(),
    "high-unemployment": emptyAlignmentSet(),
    "high-inflation": emptyAlignmentSet(),
  };

  let totalLaws = 0;
  let lawsWithParty = 0;
  let lawsWithAnyCrisisLookup = 0;

  const examples: Array<{
    tag: CrisisTag;
    alignment: Alignment;
    year: number;
    indicatorCode: string;
    indicatorValue: number;
    hogParty: string | null;
    law: string;
  }> = [];
  const exampleQuota: Record<CrisisTag, Record<Alignment, number>> = {
    recession: { left: 0, right: 0, center: 0, unknown: 0 },
    "high-unemployment": { left: 0, right: 0, center: 0, unknown: 0 },
    "high-inflation": { left: 0, right: 0, center: 0, unknown: 0 },
  };

  for await (const batch of streamUsInScopeLaws()) {
    for (const law of batch) {
      totalLaws++;
      if (law.hogParty) lawsWithParty++;
      if (law.legislationYear == null) continue;

      const alignment = classifyParty(law.hogParty);
      const vote = votes.get(law.lawClaimId);

      let anyLookup = false;
      for (const code of ["NY.GDP.MKTP.KD.ZG", "SL.UEM.TOTL.ZS", "FP.CPI.TOTL.ZG"] as IndicatorCode[]) {
        const tag = TAG_FOR_CODE[code];
        const byYear = crisis.get(code);
        if (!byYear) continue;

        let crisisHit: { value: number; year: number } | null = null;
        let anyValueSeen: { value: number; year: number } | null = null;
        for (const dy of [-1, 0, 1]) {
          const y = law.legislationYear + dy;
          const v = byYear.get(y);
          if (v == null) continue;
          anyValueSeen = { value: v, year: y };
          if (evaluate(code, v)) {
            crisisHit = { value: v, year: y };
            break;
          }
        }
        if (!anyValueSeen) continue;
        anyLookup = true;

        const target = crisisHit ? byIndicator[tag][alignment] : baseline[tag][alignment];
        target.laws++;
        if (vote) {
          target.lawsWithVoteData++;
          target.passed += vote.passed;
          target.failed += vote.failed;
        }

        if (crisisHit && exampleQuota[tag][alignment] < 5) {
          examples.push({
            tag,
            alignment,
            year: crisisHit.year,
            indicatorCode: code,
            indicatorValue: crisisHit.value,
            hogParty: law.hogParty,
            law: (law.lawText || "").slice(0, 240),
          });
          exampleQuota[tag][alignment]++;
        }
      }
      if (anyLookup) lawsWithAnyCrisisLookup++;
    }
  }

  console.log(`\n  Streamed ${totalLaws.toLocaleString()} US in-scope laws total.`);
  console.log(`  With hogParty:                ${lawsWithParty.toLocaleString()}`);
  console.log(`  With ≥1 crisis indicator hit: ${lawsWithAnyCrisisLookup.toLocaleString()}`);

  const summary = (set: Record<Alignment, Bucket>) => ({
    left: summarize(set.left),
    right: summarize(set.right),
    center: summarize(set.center),
    unknown: summarize(set.unknown),
  });

  const out = {
    generatedAt: new Date().toISOString(),
    scope: "US-only — congress_v1, congress_bills_v1, fr_rules_v1 vs World Bank API (USA, fetched live: NY.GDP.MKTP.KD.ZG, SL.UEM.TOTL.ZS, FP.CPI.TOTL.ZG)",
    thresholds: {
      recession: "NY.GDP.MKTP.KD.ZG (GDP growth) < 0 (contraction)",
      "high-unemployment": "SL.UEM.TOTL.ZS (unemployment) > 7",
      "high-inflation": "FP.CPI.TOTL.ZG (inflation, CPI YoY) > 5",
    },
    method: {
      scope:
        "US legislation claims (congress_v1, congress_bills_v1, fr_rules_v1) linked into the ECONOMIC_CONTEXT graph. Year from claimEmergedAt. Crisis values looked up from worldbank_v1 (USA) in a ±1-year window (any in-window hit counts).",
      partyAlignment:
        "Substring keyword match on PoliticalContext.hogParty (lowercased), first-match wins, no match → unknown. 'democratic' keyword added for US Democratic Party.",
      voteData:
        "LegislativeVote.result aggregated per legislation claim through Edge.sourceId → LegislativeVote.sourceId. Pass rate = passed / (passed + failed) over individual roll-call records, not deduplicated by claim.",
    },
    partyAlignmentRules: {
      left: LEFT_KEYWORDS,
      right: RIGHT_KEYWORDS,
      center: CENTER_KEYWORDS,
    },
    coverage: {
      totalInScopeLaws: totalLaws,
      lawsWithParty,
      lawsWithAnyCrisisLookup,
    },
    byIndicator: {
      recession: summary(byIndicator.recession),
      "high-unemployment": summary(byIndicator["high-unemployment"]),
      "high-inflation": summary(byIndicator["high-inflation"]),
    },
    baseline_noCrisis: {
      recession: summary(baseline.recession),
      "high-unemployment": summary(baseline["high-unemployment"]),
      "high-inflation": summary(baseline["high-inflation"]),
    },
    topExamples: examples,
  };

  const outDir = path.join(__dirname, "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "party-economic-response-us.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n  Wrote ${outPath}`);

  console.log("\n=== US Summary table ===\n");
  const tags: CrisisTag[] = ["recession", "high-unemployment", "high-inflation"];
  console.log(`  ${"condition".padEnd(22)} ${"alignment".padEnd(10)} ${"laws".padStart(8)} ${"votes".padStart(8)} ${"passed".padStart(8)} ${"failed".padStart(8)} ${"passRate".padStart(10)}`);
  for (const tag of tags) {
    for (const al of ["left", "right", "center", "unknown"] as Alignment[]) {
      const sCrisis = summarize(byIndicator[tag][al]);
      const pr = sCrisis.passRate == null ? "—" : `${(sCrisis.passRate * 100).toFixed(1)}%`;
      console.log(
        `  ${tag.padEnd(22)} ${al.padEnd(10)} ${String(sCrisis.laws).padStart(8)} ${String(sCrisis.lawsWithVoteData).padStart(8)} ${String(sCrisis.passed).padStart(8)} ${String(sCrisis.failed).padStart(8)} ${pr.padStart(10)}`,
      );
    }
    console.log("");
  }

  return out;
}

async function main() {
  console.log("enrich-party-economic-response-us.ts — FULL ANALYSIS (US only)");
  await fullAnalysis();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
