/**
 * enrich-party-economic-response.ts
 *
 * Analysis (not ingest) script: does left- vs right-leaning governments
 * legislate differently under the same economic conditions?
 *
 * Inputs:
 *   - ClaimRelation rows of type ECONOMIC_CONTEXT (legislation Claim →
 *     worldbank_v1 indicator Claim). Used only to enumerate the in-scope set of
 *     legislation claims and resolve country+year — the WB target claims here
 *     happen to be GDP level indicators (NY.GDP.MKTP.CD / NY.GDP.PCAP.CD), not
 *     the crisis-threshold indicators we care about.
 *   - worldbank_v1 Claims for the three crisis indicators
 *     (NY.GDP.MKTP.KD.ZG, SL.UEM.TOTL.ZS, FP.CPI.TOTL.ZG) — looked up
 *     separately by (iso3, year) for each in-scope law-year.
 *   - PoliticalContext.hogParty for the legislation's Source.
 *   - LegislativeVote.result for pass/fail tallies when available.
 *
 * Threshold rules (mirror enrich-economic-crisis-detector.ts):
 *   recession           ⇐ NY.GDP.MKTP.KD.ZG value < -2
 *   high-unemployment   ⇐ SL.UEM.TOTL.ZS  value > 10
 *   high-inflation      ⇐ FP.CPI.TOTL.ZG  value > 20
 *
 * Party alignment is a simple keyword lookup over PoliticalContext.hogParty.
 *
 * Output:
 *   scripts/output/party-economic-response.json
 *   plus a console summary table.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.scripts.json \
 *     scripts/enrich-party-economic-response.ts --dry-run
 *   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.scripts.json \
 *     scripts/enrich-party-economic-response.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
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

const PIPELINE_TO_ISO3: Record<string, string> = {
  congress_v1: "USA",
  congress_bills_v1: "USA",
  fr_rules_v1: "USA",
  riksdag_v1: "SWE",
  tweedekamer_v1: "NLD",
  bundestag_v1: "DEU",
  nationalrat_v1: "AUT",
  oireachtas_v1: "IRL",
  canada_bills_v1: "CAN",
  uk_legislation_v1: "GBR",
  australia_legislation_v1: "AUS",
  norway_legislation_v1: "NOR",
  nz_legislation_v1: "NZL",
  india_legislation_v1: "IND",
  singapore_legislation_v1: "SGP",
  iceland_legislation_v1: "ISL",
  denmark_legislation_v1: "DNK",
  finland_legislation_v1: "FIN",
  switzerland_legislation_v1: "CHE",
  belgium_legislation_v1: "BEL",
  portugal_legislation_v1: "PRT",
  spain_legislation_v1: "ESP",
  poland_legislation_v1: "POL",
  italy_legislation_v1: "ITA",
  japan_legislation_v1: "JPN",
  argentina_legislation_v1: "ARG",
  taiwan_legislation_v1: "TWN",
  mexico_legislation_v1: "MEX",
  brazil_legislation_v1: "BRA",
  south_africa_legislation_v1: "ZAF",
  chile_legislation_v1: "CHL",
  colombia_legislation_v1: "COL",
  philippines_legislation_v1: "PHL",
  france_legislation_v1: "FRA",
  bangladesh_legislation_v1: "BGD",
  russia_legislation_v1: "RUS",
  israel_knesset_v1: "ISR",
  scotland_legislation_v1: "GBR",
  wales_senedd_v1: "GBR",
  malaysia_legislation_v1: "MYS",
  estonia_legislation_v1: "EST",
  malta_legislation_v1: "MLT",
  georgia_legislation_v1: "GEO",
  jamaica_legislation_v1: "JAM",
  srilanka_legislation_v1: "LKA",
  pakistan_legislation_v1: "PAK",
  tt_legislation_v1: "TTO",
  brunei_legislation_v1: "BRN",
  uruguay_legislation_v1: "URY",
  peru_legislation_v1: "PER",
  costarica_legislation_v1: "CRI",
  uae_legislation_v1: "ARE",
  romania_legislation_v1: "ROU",
  latvia_legislation_v1: "LVA",
  lithuania_legislation_v1: "LTU",
  hungary_legislation_v1: "HUN",
  croatia_legislation_v1: "HRV",
  bulgaria_legislation_v1: "BGR",
  czech_legislation_v1: "CZE",
  cyprus_legislation_v1: "CYP",
  indonesia_legislation_v1: "IDN",
  kenya_legislation_v1: "KEN",
  korea_legislation_v1: "KOR",
  luxembourg_legislation_v1: "LUX",
};

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

function evaluate(code: IndicatorCode, value: number): boolean {
  if (code === "NY.GDP.MKTP.KD.ZG") return value < -2;
  if (code === "SL.UEM.TOTL.ZS") return value > 10;
  if (code === "FP.CPI.TOTL.ZG") return value > 20;
  return false;
}

async function loadCrisisIndicators(): Promise<
  Map<IndicatorCode, Map<string, Map<number, number>>>
> {
  const rows = await prisma.$queryRaw<
    Array<{ code: IndicatorCode; iso3: string; year: number; value: number }>
  >`
    SELECT metadata->>'indicatorCode'  AS code,
           metadata->>'countryIso3'    AS iso3,
           (metadata->>'year')::int    AS year,
           (metadata->>'value')::float AS value
    FROM "Claim"
    WHERE "ingestedBy" = 'worldbank_v1'
      AND deleted = false
      AND metadata->>'indicatorCode' IN ('NY.GDP.MKTP.KD.ZG','SL.UEM.TOTL.ZS','FP.CPI.TOTL.ZG')
      AND metadata->>'countryIso3' IS NOT NULL
      AND metadata->>'year' IS NOT NULL
      AND metadata->>'value' IS NOT NULL
  `;
  const out = new Map<IndicatorCode, Map<string, Map<number, number>>>();
  for (const r of rows) {
    let byIso = out.get(r.code);
    if (!byIso) {
      byIso = new Map();
      out.set(r.code, byIso);
    }
    let byYear = byIso.get(r.iso3);
    if (!byYear) {
      byYear = new Map();
      byIso.set(r.iso3, byYear);
    }
    byYear.set(r.year, r.value);
  }
  return out;
}

interface LawRow {
  lawClaimId: string;
  lawText: string;
  ingestedBy: string;
  legislationYear: number | null;
  hogParty: string | null;
  pcCountry: string | null;
}

async function* streamInScopeLaws(): AsyncGenerator<LawRow[]> {
  let lastId = "";
  while (true) {
    const rows = await prisma.$queryRaw<LawRow[]>`
      SELECT DISTINCT ON (law.id)
             law.id                                          AS "lawClaimId",
             law.text                                        AS "lawText",
             law."ingestedBy"                                AS "ingestedBy",
             EXTRACT(YEAR FROM law."claimEmergedAt")::int    AS "legislationYear",
             pc."hogParty"                                   AS "hogParty",
             pc.country                                      AS "pcCountry"
      FROM "Claim" law
      JOIN "ClaimRelation" cr ON cr."fromClaimId" = law.id
      LEFT JOIN "Edge"   e  ON e."claimId" = law.id AND e.deleted = false
      LEFT JOIN "Source" s  ON s.id = e."sourceId" AND s.deleted = false
      LEFT JOIN "PoliticalContext" pc ON pc."sourceId" = s.id
      WHERE cr."relationType" = 'ECONOMIC_CONTEXT'
        AND law.id > ${lastId}
      ORDER BY law.id ASC, (pc."hogParty" IS NULL) ASC
      LIMIT ${BATCH}
    `;
    if (rows.length === 0) break;
    lastId = rows[rows.length - 1].lawClaimId;
    yield rows;
  }
}

async function loadVoteResults(): Promise<Map<string, { passed: number; failed: number }>> {
  // claimId → { passed, failed }
  const rows = await prisma.$queryRaw<
    Array<{ claimid: string; result: string; n: bigint }>
  >`
    SELECT e."claimId"        AS claimid,
           lv.result          AS result,
           COUNT(*)::bigint   AS n
    FROM "LegislativeVote" lv
    JOIN "Edge" e ON e."sourceId" = lv."sourceId" AND e.deleted = false
    WHERE lv.result IN ('passed','failed')
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

async function dryRunCoverage() {
  console.log("\n=== DRY RUN — Party Classification Coverage ===\n");

  const lawCounts = await prisma.$queryRaw<
    Array<{ has_party: boolean; n: bigint }>
  >`
    SELECT (pc."hogParty" IS NOT NULL) AS has_party,
           COUNT(DISTINCT law.id)::bigint AS n
    FROM "Claim" law
    JOIN "ClaimRelation" cr ON cr."fromClaimId" = law.id AND cr."relationType" = 'ECONOMIC_CONTEXT'
    LEFT JOIN "Edge"   e  ON e."claimId" = law.id AND e.deleted = false
    LEFT JOIN "Source" s  ON s.id = e."sourceId" AND s.deleted = false
    LEFT JOIN "PoliticalContext" pc ON pc."sourceId" = s.id
    GROUP BY has_party
  `;
  let withParty = 0;
  let withoutParty = 0;
  for (const r of lawCounts) {
    if (r.has_party) withParty = Number(r.n);
    else withoutParty = Number(r.n);
  }
  const total = withParty + withoutParty;

  const partyAgg = await prisma.$queryRaw<Array<{ hogparty: string; n: bigint }>>`
    SELECT pc."hogParty" AS hogparty, COUNT(DISTINCT law.id)::bigint AS n
    FROM "Claim" law
    JOIN "ClaimRelation" cr ON cr."fromClaimId" = law.id AND cr."relationType" = 'ECONOMIC_CONTEXT'
    JOIN "Edge"   e  ON e."claimId" = law.id AND e.deleted = false
    JOIN "Source" s  ON s.id = e."sourceId" AND s.deleted = false
    JOIN "PoliticalContext" pc ON pc."sourceId" = s.id
    WHERE pc."hogParty" IS NOT NULL
    GROUP BY pc."hogParty"
  `;
  const byAlignment: Record<Alignment, number> = { left: 0, right: 0, center: 0, unknown: 0 };
  for (const r of partyAgg) byAlignment[classifyParty(r.hogparty)] += Number(r.n);
  const classified = byAlignment.left + byAlignment.right + byAlignment.center;

  console.log(`  In-scope legislation claims (those with any ECONOMIC_CONTEXT relation): ${total.toLocaleString()}`);
  console.log(`  With PoliticalContext.hogParty:              ${withParty.toLocaleString()} (${total > 0 ? ((withParty / total) * 100).toFixed(1) : "0"}%)`);
  console.log(`  Without hogParty:                            ${withoutParty.toLocaleString()}`);
  console.log("");
  console.log(`  Classified alignment (left/right/center):    ${classified.toLocaleString()} (${total > 0 ? ((classified / total) * 100).toFixed(1) : "0"}% of total)`);
  console.log(`    left:    ${byAlignment.left.toLocaleString()}`);
  console.log(`    right:   ${byAlignment.right.toLocaleString()}`);
  console.log(`    center:  ${byAlignment.center.toLocaleString()}`);
  console.log(`    unknown: ${byAlignment.unknown.toLocaleString()} (party name present but did not match any keyword)`);
  console.log("");

  const topUnknown = partyAgg
    .filter((r) => classifyParty(r.hogparty) === "unknown")
    .sort((a, b) => Number(b.n) - Number(a.n))
    .slice(0, 15);
  if (topUnknown.length > 0) {
    console.log(`  Top "unknown" party names (consider extending keyword tables):`);
    for (const r of topUnknown) {
      console.log(`    ${r.n.toString().padStart(7)}  ${r.hogparty}`);
    }
  }
}

async function fullAnalysis() {
  console.log("\n=== Party × Economic Response Analysis ===\n");

  console.log("Step 1: Loading crisis indicator series (3 codes)…");
  const crisis = await loadCrisisIndicators();
  let cells = 0;
  for (const m of crisis.values()) for (const m2 of m.values()) cells += m2.size;
  console.log(`  Loaded ${cells.toLocaleString()} (code, iso3, year) cells.`);

  console.log("\nStep 2: Loading vote pass/fail tallies by claim…");
  const votes = await loadVoteResults();
  console.log(`  ${votes.size.toLocaleString()} claims have at least one pass/fail vote.`);

  console.log("\nStep 3: Streaming in-scope legislation claims (those with any ECONOMIC_CONTEXT relation)…");

  // Crisis-tagged buckets are deduplicated at the law level — one law that
  // sits inside a recession year shouldn't count twice if its country has
  // multiple GDP-growth observations in the ±1 window. Baseline (no crisis)
  // is the same law's contribution when the indicator was below threshold.
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
  let lawsWithCountry = 0;
  let lawsWithAnyCrisisLookup = 0;

  const examples: Array<{
    tag: CrisisTag;
    alignment: Alignment;
    country: string | null;
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

  for await (const batch of streamInScopeLaws()) {
    for (const law of batch) {
      totalLaws++;
      if (law.hogParty) lawsWithParty++;

      const iso3 = PIPELINE_TO_ISO3[law.ingestedBy];
      if (!iso3 || law.legislationYear == null) continue;
      lawsWithCountry++;

      const alignment = classifyParty(law.hogParty);
      const vote = votes.get(law.lawClaimId);

      let anyLookup = false;
      // For each crisis indicator: search the ±1-year window. If any year in
      // the window is in crisis, the law counts toward the crisis bucket;
      // else toward the baseline bucket.
      for (const code of ["NY.GDP.MKTP.KD.ZG", "SL.UEM.TOTL.ZS", "FP.CPI.TOTL.ZG"] as IndicatorCode[]) {
        const tag = TAG_FOR_CODE[code];
        const byYear = crisis.get(code)?.get(iso3);
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
            country: law.pcCountry,
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
    if (totalLaws % (BATCH * 4) === 0) {
      console.log(`  Streamed ${totalLaws.toLocaleString()} laws…`);
    }
  }

  console.log(`\n  Streamed ${totalLaws.toLocaleString()} in-scope laws total.`);
  console.log(`  With hogParty:                ${lawsWithParty.toLocaleString()}`);
  console.log(`  With known country (iso3):    ${lawsWithCountry.toLocaleString()}`);
  console.log(`  With ≥1 crisis indicator hit: ${lawsWithAnyCrisisLookup.toLocaleString()}`);

  const summary = (set: Record<Alignment, Bucket>) => ({
    left: summarize(set.left),
    right: summarize(set.right),
    center: summarize(set.center),
    unknown: summarize(set.unknown),
  });

  const out = {
    generatedAt: new Date().toISOString(),
    thresholds: {
      recession: "NY.GDP.MKTP.KD.ZG (GDP growth) < -2",
      "high-unemployment": "SL.UEM.TOTL.ZS (unemployment) > 10",
      "high-inflation": "FP.CPI.TOTL.ZG (inflation, CPI YoY) > 20",
    },
    method: {
      scope:
        "Legislation claims linked into the ECONOMIC_CONTEXT graph. Country resolved via legislation pipeline → ISO3 map; year from claimEmergedAt. Crisis values looked up from worldbank_v1 in a ±1-year window (any in-window hit counts).",
      partyAlignment:
        "Substring keyword match on PoliticalContext.hogParty (lowercased), first-match wins, no match → unknown.",
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
      lawsWithKnownCountry: lawsWithCountry,
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
  const outPath = path.join(outDir, "party-economic-response.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n  Wrote ${outPath}`);

  console.log("\n=== Summary table ===\n");
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
  console.log("  (baseline_noCrisis is in the JSON output for the same tags.)");

  return out;
}

function buildKeyFinding(out: Awaited<ReturnType<typeof fullAnalysis>>): string {
  const tags: CrisisTag[] = ["recession", "high-unemployment", "high-inflation"];
  const parts: string[] = [];
  for (const tag of tags) {
    const sec = out.byIndicator[tag];
    const L = sec.left;
    const R = sec.right;
    if (L.passRate != null && R.passRate != null) {
      const diff = (L.passRate - R.passRate) * 100;
      const dir = diff >= 0 ? "+" : "";
      parts.push(`${tag}: L pass ${(L.passRate * 100).toFixed(1)}% vs R ${(R.passRate * 100).toFixed(1)}% (${dir}${diff.toFixed(1)}pp left); laws L=${L.laws.toLocaleString()} R=${R.laws.toLocaleString()}`);
    } else {
      parts.push(`${tag}: laws L=${L.laws.toLocaleString()} R=${R.laws.toLocaleString()} (insufficient vote data)`);
    }
  }
  return parts.join(" | ");
}

async function sendTelegram(msg: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("\n  TELEGRAM_BOT_TOKEN not set; skipping Telegram ping.");
    return;
  }
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.log("\n  TELEGRAM_CHAT_ID not set; skipping Telegram ping.");
    return;
  }
  try {
    const truncated = msg.length > 3500 ? msg.slice(0, 3500) + "…" : msg;
    execSync(
      `curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" -d chat_id=${chatId} --data-urlencode text=${JSON.stringify(truncated)} >/dev/null`,
      { stdio: "inherit" },
    );
    console.log("\n  Telegram ping sent.");
  } catch (e) {
    console.error("  Telegram ping failed:", e);
  }
}

async function main() {
  console.log(`enrich-party-economic-response.ts — ${DRY_RUN ? "DRY RUN (coverage only)" : "FULL ANALYSIS"}`);

  if (DRY_RUN) {
    await dryRunCoverage();
    await prisma.$disconnect();
    return;
  }

  const out = await fullAnalysis();
  const finding = buildKeyFinding(out);
  console.log(`\n  Key finding: ${finding}\n`);

  await sendTelegram(`✅ Party×economic response done — ${finding}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
