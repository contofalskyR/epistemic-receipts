/**
 * link-sipri-unsc.ts
 *
 * Builds MILITARY_CONTEXT ClaimRelation rows from SIPRI military-expenditure
 * claims (sipri_milex_v1) to UN Security Council resolutions
 * (un_sc_resolutions_v1) when:
 *   - The country in the SIPRI claim metadata appears in the UNSC resolution's
 *     metadata.geography.iso_name array OR metadata.subjects array.
 *   - The UNSC year is within ±2 years of the SIPRI year.
 *
 * Country name normalization handles the common SIPRI ↔ UN spelling gaps
 * (United States of America ↔ United States, Russian Federation ↔ Russia,
 * USSR / Soviet Union, Iran (Islamic Republic of), Congo DRC, Korea, etc.).
 *
 * Confidence is "medium" per task spec — the country mention establishes
 * temporal/topical context, not a direct causal link.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-sipri-unsc.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-sipri-unsc.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");

const RELATION_TYPE = "MILITARY_CONTEXT";
const YEAR_WINDOW = 2;
const INSERT_BATCH = 1000;

// SIPRI canonical country name → set of alias strings (normalized lowercase)
const COUNTRY_ALIASES: Record<string, string[]> = {
  "United States of America": ["united states", "united states of america", "usa", "u.s.a.", "u.s."],
  "United Kingdom": ["united kingdom", "uk", "britain", "great britain"],
  "Russia": ["russia", "russian federation", "ussr", "soviet union"],
  "Iran": ["iran", "iran (islamic republic of)", "islamic republic of iran"],
  "Syria": ["syria", "syrian arab republic"],
  "South Korea": ["south korea", "korea, republic of", "republic of korea"],
  "North Korea": [
    "north korea",
    "korea, democratic people's republic of",
    "democratic people's republic of korea",
    "dprk",
  ],
  "Vietnam": ["vietnam", "viet nam"],
  "Tanzania": ["tanzania", "united republic of tanzania"],
  "Venezuela": ["venezuela", "venezuela (bolivarian republic of)", "bolivarian republic of venezuela"],
  "Bolivia": ["bolivia", "bolivia (plurinational state of)", "plurinational state of bolivia"],
  "Moldova": ["moldova", "republic of moldova"],
  "Macedonia": ["macedonia", "north macedonia", "former yugoslav republic of macedonia"],
  "Czechia": ["czechia", "czech republic"],
  "Côte d'Ivoire": ["cote d'ivoire", "ivory coast", "côte d'ivoire"],
  "Cabo Verde": ["cabo verde", "cape verde"],
  "Eswatini": ["eswatini", "swaziland"],
  "Myanmar": ["myanmar", "burma"],
  "Lao PDR": ["lao pdr", "laos", "lao people's democratic republic"],
  "Brunei": ["brunei", "brunei darussalam"],
  "Congo, Republic of": ["congo", "congo, republic of", "republic of the congo"],
  "Congo, DR": [
    "congo, dr",
    "democratic republic of the congo",
    "congo, the democratic republic of the",
    "zaire",
  ],
  "East Timor": ["east timor", "timor-leste"],
  "Macedonia, North": ["macedonia, north", "north macedonia"],
};

function normalizeCountry(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ',.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasesFor(country: string): string[] {
  const base = normalizeCountry(country);
  const aliases = new Set<string>([base]);
  const found = COUNTRY_ALIASES[country];
  if (found) {
    for (const a of found) aliases.add(normalizeCountry(a));
  }
  return [...aliases];
}

interface SipriClaim {
  id: string;
  country: string;
  year: number;
  aliases: string[];
}

interface UnscClaim {
  id: string;
  year: number;
  countries: Set<string>; // normalized country strings (iso_name + filtered subjects)
}

const UNSC_SUBJECT_COUNTRIES_HINT_RE = /[A-Z]{2,}/; // subjects are uppercase

async function loadSipri(): Promise<SipriClaim[]> {
  const rows = await prisma.claim.findMany({
    where: { ingestedBy: "sipri_milex_v1", deleted: false },
    select: { id: true, metadata: true },
  });
  const out: SipriClaim[] = [];
  for (const r of rows) {
    const m = r.metadata as Record<string, unknown> | null;
    const country = typeof m?.country === "string" ? m.country : null;
    const year = typeof m?.year === "number" ? m.year : null;
    if (!country || !year) continue;
    out.push({
      id: r.id,
      country,
      year,
      aliases: aliasesFor(country),
    });
  }
  return out;
}

async function loadUnsc(): Promise<UnscClaim[]> {
  const rows = await prisma.claim.findMany({
    where: { ingestedBy: "un_sc_resolutions_v1", deleted: false },
    select: { id: true, metadata: true },
  });
  const out: UnscClaim[] = [];
  for (const r of rows) {
    const m = r.metadata as Record<string, unknown> | null;
    const year = typeof m?.year === "number" ? m.year : null;
    if (!year) continue;
    const countries = new Set<string>();
    const geo = m?.geography as Record<string, unknown> | undefined;
    const isoNames = Array.isArray(geo?.iso_name) ? (geo?.iso_name as unknown[]) : [];
    for (const v of isoNames) {
      if (typeof v === "string") countries.add(normalizeCountry(v));
    }
    const subjects = Array.isArray(m?.subjects) ? (m?.subjects as unknown[]) : [];
    for (const v of subjects) {
      if (typeof v !== "string") continue;
      // Subjects look like "IRAN (ISLAMIC REPUBLIC OF)", "USSR", "USSR > GENERAL".
      // Split on '>' and take the lead token, then add as-is (normalized).
      const head = v.split(">")[0].trim();
      if (!head) continue;
      if (!UNSC_SUBJECT_COUNTRIES_HINT_RE.test(head)) continue;
      countries.add(normalizeCountry(head));
    }
    if (countries.size === 0) continue;
    out.push({ id: r.id, year, countries });
  }
  return out;
}

async function main() {
  console.log(`\nlink-sipri-unsc.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  console.log("Loading SIPRI milex claims...");
  const sipri = await loadSipri();
  console.log(`  Loaded ${sipri.length} SIPRI claims`);

  console.log("Loading UNSC resolutions...");
  const unsc = await loadUnsc();
  console.log(`  Loaded ${unsc.length} UNSC resolutions with country tags`);

  // Index UNSC: country alias → list of (year, claimId)
  const unscByCountry = new Map<
    string,
    Array<{ year: number; id: string }>
  >();
  for (const u of unsc) {
    for (const c of u.countries) {
      let bucket = unscByCountry.get(c);
      if (!bucket) {
        bucket = [];
        unscByCountry.set(c, bucket);
      }
      bucket.push({ year: u.year, id: u.id });
    }
  }
  console.log(`  UNSC country-alias keys indexed: ${unscByCountry.size}`);

  // Idempotency
  const existing = await prisma.claimRelation.findMany({
    where: { relationType: RELATION_TYPE },
    select: { fromClaimId: true, toClaimId: true },
  });
  const existingPairs = new Set<string>();
  for (const e of existing) existingPairs.add(`${e.fromClaimId}|${e.toClaimId}`);
  console.log(`  ${existing.length} existing ${RELATION_TYPE} relations`);

  // Pair generation: each SIPRI (country, year) → UNSC resolutions for any
  // matching country alias within ±YEAR_WINDOW.
  type Candidate = {
    sipriId: string;
    unscId: string;
    country: string;
    sipriYear: number;
    unscYear: number;
    matchedAlias: string;
  };
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  let sipriWithMatch = 0;
  for (const s of sipri) {
    let matchedAny = false;
    for (const alias of s.aliases) {
      const bucket = unscByCountry.get(alias);
      if (!bucket) continue;
      for (const u of bucket) {
        if (Math.abs(u.year - s.year) > YEAR_WINDOW) continue;
        const key = `${s.id}|${u.id}`;
        if (seen.has(key) || existingPairs.has(key)) continue;
        seen.add(key);
        candidates.push({
          sipriId: s.id,
          unscId: u.id,
          country: s.country,
          sipriYear: s.year,
          unscYear: u.year,
          matchedAlias: alias,
        });
        matchedAny = true;
      }
    }
    if (matchedAny) sipriWithMatch++;
  }

  console.log(
    `  SIPRI claims with ≥1 UNSC match: ${sipriWithMatch}` +
      `\n  Candidate ${RELATION_TYPE} pairs (new): ${candidates.length}`,
  );

  let inserted = 0;
  if (DRY_RUN) {
    inserted = candidates.length;
  } else {
    for (let i = 0; i < candidates.length; i += INSERT_BATCH) {
      const batch = candidates.slice(i, i + INSERT_BATCH);
      const data = batch.map((c) => ({
        fromClaimId: c.sipriId,
        toClaimId: c.unscId,
        relationType: RELATION_TYPE,
        year: c.unscYear,
        followUpContext: {
          heuristic: "country_year_window_match",
          confidence: "medium",
          country: c.country,
          matchedAlias: c.matchedAlias,
          sipriYear: c.sipriYear,
          unscYear: c.unscYear,
          yearDelta: c.unscYear - c.sipriYear,
          yearWindow: YEAR_WINDOW,
          pipeline_from: "sipri_milex_v1",
          pipeline_to: "un_sc_resolutions_v1",
        },
      }));
      const result = await prisma.claimRelation.createMany({
        data,
        skipDuplicates: true,
      });
      inserted += result.count;
      if ((i / INSERT_BATCH) % 10 === 0) {
        console.log(`  inserted ${inserted}/${candidates.length}`);
      }
    }
  }

  console.log(
    `\n  ${RELATION_TYPE} relations ${DRY_RUN ? "would-be-inserted" : "inserted"}: ${inserted}` +
      ` · already-existed: ${existing.length} · mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`,
  );

  if (!DRY_RUN) {
    const total = await prisma.claimRelation.count({
      where: { relationType: RELATION_TYPE },
    });
    console.log(`  Total ${RELATION_TYPE} relations in DB after run: ${total}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
