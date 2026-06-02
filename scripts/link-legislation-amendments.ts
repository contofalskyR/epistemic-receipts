/**
 * link-legislation-amendments.ts
 *
 * Detects amendment / repeal relationships across legislation_v1 corpora and writes
 * ClaimRelation rows with relationType = SUPERSEDED_BY (original law → amending law).
 *
 * Per-corpus configs: text patterns + a referenced-law extractor + a parent-claim lookup.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-legislation-amendments.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-legislation-amendments.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");

type AmendmentType = "amends" | "repeals" | "modifies" | "consolidates";

interface ExtractedRef {
  parentRef: string;
  amendmentType: AmendmentType;
}

interface CorpusConfig {
  corpus: string;
  country: string;
  language: string;
  detect: RegExp;
  extract: (text: string, metadata: Record<string, unknown> | null) => ExtractedRef | null;
  findParent: (
    parentRef: string,
    selfClaimId: string,
    metadata: Record<string, unknown> | null
  ) => Promise<{ id: string; externalId: string | null } | null>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeLawNumber(raw: string): string {
  return raw.replace(/[.\s]/g, "");
}

async function lookupChileByNumero(
  numero: string,
  selfId: string
): Promise<{ id: string; externalId: string | null } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; externalId: string | null }>>`
    SELECT id, "externalId"
    FROM "Claim"
    WHERE "ingestedBy" = 'chile_legislation_v1'
      AND deleted = false
      AND metadata->>'numero' = ${numero}
      AND id <> ${selfId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function lookupUkByTitle(
  title: string,
  selfId: string
): Promise<{ id: string; externalId: string | null } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; externalId: string | null }>>`
    SELECT id, "externalId"
    FROM "Claim"
    WHERE "ingestedBy" = 'uk_legislation_v1'
      AND deleted = false
      AND text = ${title}
      AND id <> ${selfId}
    LIMIT 1
  `;
  if (rows[0]) return rows[0];
  // Try with " (repealed)" suffix (UK encodes repealed status in the title)
  const rowsRep = await prisma.$queryRaw<Array<{ id: string; externalId: string | null }>>`
    SELECT id, "externalId"
    FROM "Claim"
    WHERE "ingestedBy" = 'uk_legislation_v1'
      AND deleted = false
      AND text = ${title + " (repealed)"}
      AND id <> ${selfId}
    LIMIT 1
  `;
  return rowsRep[0] ?? null;
}

async function lookupCyprusByTitleStem(
  stem: string,
  selfId: string
): Promise<{ id: string; externalId: string | null } | null> {
  // stem is e.g. "Ο περί Εταιρειών Νόμος" — match Cyprus laws whose title contains this stem
  // and is NOT itself an amendment (i.e. no Τροποποιητικός).
  const like = `%${stem}%`;
  const rows = await prisma.$queryRaw<Array<{ id: string; externalId: string | null }>>`
    SELECT id, "externalId"
    FROM "Claim"
    WHERE "ingestedBy" = 'cyprus_legislation_v1'
      AND deleted = false
      AND text ILIKE ${like}
      AND text NOT ILIKE '%Τροποποιητικ%'
      AND id <> ${selfId}
    ORDER BY (metadata->>'year')::int ASC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function lookupLuxembourgByDate(
  isoDate: string,
  selfId: string
): Promise<{ id: string; externalId: string | null } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; externalId: string | null }>>`
    SELECT id, "externalId"
    FROM "Claim"
    WHERE "ingestedBy" = 'luxembourg_legislation_v1'
      AND deleted = false
      AND metadata->>'date' = ${isoDate}
      AND id <> ${selfId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

// ─── Configs ─────────────────────────────────────────────────────────────────

const CHILE_RE = /MODIFICA[^,]{0,80}LEY\s*N[ºo°]?\.?\s*([\d.]+)/i;
const CHILE_DETECT = /modifica|deroga|sustituye|reforma/i;

const UK_AMEND_RE = /^(.+?)\s+\((?:[A-Z][a-z]*\s+)?Amendment(?:\s+(?:and\s+\w+|No\.?\s*\d+))?\)\s+Act\s+\d{4}$/;
const UK_REPEAL_RE = / Act \d{4} \(repealed\)$/;
const UK_DETECT = /\(Amendment\)\s+Act\s+\d{4}/i;

const CYPRUS_AMEND_RE = /\(Τροποποιητικ[όή]ς\)/;

const LUX_DATE_RE =
  /(?:modification|abrog\w+|portant\s+modifi\w+)\s+(?:de\s+)?(?:la\s+)?(?:loi|ordonnance|arr[êe]t[ée])\s+(?:royale\s+grand-ducale\s+)?du\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i;

const FRENCH_MONTHS: Record<string, string> = {
  janvier: "01",
  fevrier: "02",
  février: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  aout: "08",
  août: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  decembre: "12",
  décembre: "12",
};

function classifyAmendment(text: string): AmendmentType {
  const t = text.toLowerCase();
  if (/repeal|deroga|abrog|revoga|abolish/i.test(t)) return "repeals";
  if (/consolidat/i.test(t)) return "consolidates";
  if (/modif/i.test(t)) return "modifies";
  return "amends";
}

const CONFIGS: CorpusConfig[] = [
  {
    corpus: "chile_legislation_v1",
    country: "Chile",
    language: "es",
    detect: CHILE_DETECT,
    extract: (text) => {
      const m = text.match(CHILE_RE);
      if (!m) return null;
      const parentRef = normalizeLawNumber(m[1]);
      if (parentRef.length < 3 || parentRef.length > 7) return null;
      return { parentRef, amendmentType: classifyAmendment(text) };
    },
    findParent: (parentRef, selfId) => lookupChileByNumero(parentRef, selfId),
  },
  {
    corpus: "uk_legislation_v1",
    country: "United Kingdom",
    language: "en",
    detect: UK_DETECT,
    extract: (text) => {
      const cleaned = text.replace(UK_REPEAL_RE, " Act $&".replace(" Act $&", "")).replace(/\s+\(repealed\)$/, "");
      const m = cleaned.match(UK_AMEND_RE);
      if (!m) return null;
      // m[1] is e.g. "Building Societies Act 1986" — but sometimes it's just the subject
      // ("Mental Capacity"). We only attempt a match when m[1] ends with " Act YYYY".
      const stem = m[1].trim();
      if (!/Act\s+\d{4}$/.test(stem)) return null;
      return { parentRef: stem, amendmentType: classifyAmendment(text) };
    },
    findParent: (parentRef, selfId) => lookupUkByTitle(parentRef, selfId),
  },
  {
    corpus: "cyprus_legislation_v1",
    country: "Cyprus",
    language: "el",
    detect: CYPRUS_AMEND_RE,
    extract: (text, metadata) => {
      // Use metadata.title when present (cleaner than the prefixed claim text)
      const title =
        metadata && typeof metadata === "object" && typeof (metadata as Record<string, unknown>).title === "string"
          ? ((metadata as Record<string, unknown>).title as string)
          : text;
      // Drop "(Τροποποιητικός)" and the trailing " του YYYY" year fragment.
      // Match against the remaining subject stem, e.g. "Ο περί Εταιρειών Νόμος".
      const stripped = title
        .replace(/\s*\(Τροποποιητικ[όή]ς\)\s*/g, " ")
        .replace(/\s*\(Τροποποιητικ[όή]ς\)\s+Ν[όο]μος\s+του\s+\d{4}\s*$/g, " Νόμος")
        .replace(/\s+του\s+\d{4}\s*$/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (stripped.length < 8) return null;
      return { parentRef: stripped, amendmentType: "amends" };
    },
    findParent: (parentRef, selfId) => lookupCyprusByTitleStem(parentRef, selfId),
  },
  {
    corpus: "luxembourg_legislation_v1",
    country: "Luxembourg",
    language: "fr",
    detect: /modifi|abrog|portant\s+modifi/i,
    extract: (text) => {
      const m = text.match(LUX_DATE_RE);
      if (!m) return null;
      const day = m[1].padStart(2, "0");
      const monthRaw = m[2].toLowerCase();
      const month = FRENCH_MONTHS[monthRaw];
      const year = m[3];
      if (!month) return null;
      return { parentRef: `${year}-${month}-${day}`, amendmentType: classifyAmendment(text) };
    },
    findParent: (isoDate, selfId) => lookupLuxembourgByDate(isoDate, selfId),
  },
];

// ─── Main loop ────────────────────────────────────────────────────────────────

interface CorpusResult {
  corpus: string;
  country: string;
  candidates: number;
  parents_found: number;
  inserted: number;
  skipped: number;
}

async function runCorpus(cfg: CorpusConfig): Promise<CorpusResult> {
  console.log(`\n--- ${cfg.country} (${cfg.corpus}) ---`);
  const candidates = await prisma.claim.findMany({
    where: {
      deleted: false,
      ingestedBy: cfg.corpus,
      text: { contains: "", mode: "insensitive" }, // placeholder, filtered below
    },
    select: { id: true, text: true, metadata: true },
  });

  // Filter to amendment-pattern candidates in-memory (regex variety > SQL ILIKE)
  const amendCandidates = candidates.filter((c) => cfg.detect.test(c.text));
  console.log(
    `  ${candidates.length} total claims · ${amendCandidates.length} match amendment language`
  );

  let parentsFound = 0;
  let inserted = 0;
  let skipped = 0;

  for (const claim of amendCandidates) {
    const ref = cfg.extract(claim.text, claim.metadata as Record<string, unknown> | null);
    if (!ref) continue;
    const parent = await cfg.findParent(
      ref.parentRef,
      claim.id,
      claim.metadata as Record<string, unknown> | null
    );
    if (!parent) continue;
    parentsFound++;

    if (DRY_RUN) {
      inserted++;
      continue;
    }

    try {
      await prisma.claimRelation.create({
        data: {
          fromClaimId: parent.id,
          toClaimId: claim.id,
          relationType: "SUPERSEDED_BY",
          followUpContext: {
            amendmentType: ref.amendmentType,
            country: cfg.country,
            corpus: cfg.corpus,
            lawNumber: ref.parentRef,
            heuristic: `legislation_${cfg.corpus}`,
            confidence: cfg.corpus === "chile_legislation_v1" ? "high" : "medium",
          },
        },
      });
      inserted++;
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") skipped++;
      else throw e;
    }
  }

  console.log(
    `  parents resolved: ${parentsFound} · inserted: ${inserted} · skipped (existing): ${skipped}`
  );
  return {
    corpus: cfg.corpus,
    country: cfg.country,
    candidates: amendCandidates.length,
    parents_found: parentsFound,
    inserted,
    skipped,
  };
}

async function main() {
  console.log(`\nlink-legislation-amendments.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  const results: CorpusResult[] = [];
  for (const cfg of CONFIGS) {
    results.push(await runCorpus(cfg));
  }

  console.log("\n=== SUMMARY ===");
  let totalCandidates = 0;
  let totalInserted = 0;
  for (const r of results) {
    console.log(
      `  ${r.country.padEnd(15)} ${r.corpus.padEnd(32)} candidates=${r.candidates} parents=${r.parents_found} inserted=${r.inserted} skipped=${r.skipped}`
    );
    totalCandidates += r.candidates;
    totalInserted += r.inserted;
  }
  console.log(
    `\n  Total amendment candidates: ${totalCandidates} · total inserted: ${totalInserted} (mode: ${DRY_RUN ? "DRY RUN" : "LIVE"})`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
