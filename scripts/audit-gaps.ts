import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });

type Row = Record<string, unknown>;
function tab(rows: Row[], cols: string[]) {
  for (const r of rows) {
    console.log(cols.map(c => String(r[c] ?? "")).join("\t"));
  }
}

async function main() {
  const totalLive = await p.claim.count({ where: { deleted: false } });
  const totalAll = await p.claim.count();
  console.log("=== TOTALS ===");
  console.log("Claims (not deleted):", totalLive);
  console.log("Claims (incl deleted):", totalAll);

  // ---------- 1. pipeline_tag breakdown ----------
  console.log("\n=== 1. PIPELINE_TAG (ingestedBy) BREAKDOWN ===");
  const tags = await p.$queryRaw<Row[]>`
    SELECT "ingestedBy" AS tag, COUNT(*)::int AS n
    FROM "Claim"
    WHERE deleted = false
    GROUP BY "ingestedBy"
    ORDER BY n DESC
  `;
  console.log(`Distinct pipelines: ${tags.length}`);
  tab(tags, ["n", "tag"]);

  // ---------- 2. Country/polity coverage ----------
  console.log("\n=== 2. COUNTRY/POLITY COVERAGE ===");
  const polityTotal = await p.polity.count();
  const polityActive = await p.polity.count({ where: { endYear: null } });
  console.log("Polity rows total:", polityTotal);
  console.log("Polity rows still active (endYear null):", polityActive);

  // Distinct countries with ANY claim (via PolityClaim → Polity.name)
  const claimCountries = await p.$queryRaw<Row[]>`
    SELECT COUNT(DISTINCT pol.name)::int AS n
    FROM "PolityClaim" pc
    JOIN "Polity" pol ON pol.id = pc."polityId"
    JOIN "Claim"   c   ON c.id   = pc."claimId"
    WHERE c.deleted = false
  `;
  console.log("Distinct polity names linked to claims:", claimCountries[0]?.n);

  // Country list of UN members (active polities) NOT linked to any claim
  const top20 = await p.$queryRaw<Row[]>`
    SELECT pol.name AS country, pol."countryCode" AS code, COUNT(*)::int AS n
    FROM "PolityClaim" pc
    JOIN "Polity" pol ON pol.id = pc."polityId"
    JOIN "Claim"   c   ON c.id   = pc."claimId"
    WHERE c.deleted = false
    GROUP BY pol.name, pol."countryCode"
    ORDER BY n DESC
    LIMIT 25
  `;
  console.log("\nTop 25 polities by claim count:");
  tab(top20, ["n", "code", "country"]);

  // Active polities (endYear IS NULL, govt democracy/republic etc) WITHOUT any claim links
  const unlinkedPolities = await p.$queryRaw<Row[]>`
    SELECT pol.name AS country, pol."countryCode" AS code
    FROM "Polity" pol
    WHERE pol."endYear" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "PolityClaim" pc WHERE pc."polityId" = pol.id)
    ORDER BY pol.name
  `;
  console.log(`\nActive polities (endYear NULL) with ZERO claim links: ${unlinkedPolities.length}`);
  console.log("Sample (first 40):");
  tab(unlinkedPolities.slice(0, 40), ["code", "country"]);

  // ---------- 3. ClaimRelation coverage ----------
  console.log("\n=== 3. CLAIM RELATION COVERAGE ===");
  const relCount = await p.claimRelation.count();
  console.log("Total ClaimRelation rows:", relCount);

  const claimsWithRel = await p.$queryRaw<Row[]>`
    SELECT COUNT(DISTINCT cid)::int AS n FROM (
      SELECT "fromClaimId" AS cid FROM "ClaimRelation"
      UNION
      SELECT "toClaimId" AS cid FROM "ClaimRelation"
    ) s
  `;
  console.log("Distinct claims with at least one relation:", claimsWithRel[0]?.n);
  console.log("Percent of live claims with a relation:", (((claimsWithRel[0]?.n as number) / totalLive) * 100).toFixed(2) + "%");

  const byRel = await p.$queryRaw<Row[]>`
    SELECT "relationType" AS rt, COUNT(*)::int AS n
    FROM "ClaimRelation"
    GROUP BY "relationType"
    ORDER BY n DESC
  `;
  console.log("Relation type counts:");
  tab(byRel, ["n", "rt"]);

  // ---------- 4. Temporal coverage ----------
  console.log("\n=== 4. TEMPORAL COVERAGE ===");
  const emerged = await p.$queryRaw<Row[]>`
    SELECT
      MIN(EXTRACT(YEAR FROM "claimEmergedAt"))::int AS minY,
      MAX(EXTRACT(YEAR FROM "claimEmergedAt"))::int AS maxY,
      COUNT(*)::int AS withDate
    FROM "Claim"
    WHERE deleted = false AND "claimEmergedAt" IS NOT NULL
  `;
  console.log("claimEmergedAt range:", emerged[0]);
  const noDate = await p.claim.count({ where: { deleted: false, claimEmergedAt: null } });
  console.log("Claims with NO claimEmergedAt:", noDate, "(", ((noDate / totalLive) * 100).toFixed(1) + "%)");

  const byDecade = await p.$queryRaw<Row[]>`
    SELECT (FLOOR(EXTRACT(YEAR FROM "claimEmergedAt")/10)*10)::int AS decade, COUNT(*)::int AS n
    FROM "Claim"
    WHERE deleted = false AND "claimEmergedAt" IS NOT NULL
    GROUP BY decade
    ORDER BY decade
  `;
  console.log("\nClaims by decade (claimEmergedAt):");
  tab(byDecade, ["decade", "n"]);

  // Also look at HistoricalEvent.startDate decades
  const evByDecade = await p.$queryRaw<Row[]>`
    SELECT (FLOOR(EXTRACT(YEAR FROM "startDate")/10)*10)::int AS decade, COUNT(*)::int AS n
    FROM "HistoricalEvent"
    WHERE "startDate" IS NOT NULL
    GROUP BY decade
    ORDER BY decade
  `;
  console.log("\nHistoricalEvent.startDate by decade:");
  tab(evByDecade, ["decade", "n"]);

  // ---------- 5. Source diversity ----------
  console.log("\n=== 5. SOURCE DIVERSITY ===");
  const srcTotal = await p.source.count({ where: { deleted: false } });
  console.log("Total Source (not deleted):", srcTotal);

  const byMethod = await p.$queryRaw<Row[]>`
    SELECT "methodologyType" AS mt, COUNT(*)::int AS n
    FROM "Source"
    WHERE deleted = false
    GROUP BY "methodologyType"
    ORDER BY n DESC
  `;
  console.log("By methodologyType:");
  tab(byMethod, ["n", "mt"]);

  const byIngestion = await p.$queryRaw<Row[]>`
    SELECT "ingestedBy" AS ib, COUNT(*)::int AS n
    FROM "Source"
    WHERE deleted = false
    GROUP BY "ingestedBy"
    ORDER BY n DESC
    LIMIT 30
  `;
  console.log("\nSources by ingestedBy (top 30):");
  tab(byIngestion, ["n", "ib"]);

  // Domain breakdown from URL
  const byDomain = await p.$queryRaw<Row[]>`
    SELECT
      SUBSTRING(url FROM 'https?://([^/]+)') AS domain,
      COUNT(*)::int AS n
    FROM "Source"
    WHERE deleted = false AND url IS NOT NULL
    GROUP BY domain
    ORDER BY n DESC
    LIMIT 25
  `;
  console.log("\nTop 25 source domains:");
  tab(byDomain, ["n", "domain"]);
  const distinctDomains = await p.$queryRaw<Row[]>`
    SELECT COUNT(DISTINCT SUBSTRING(url FROM 'https?://([^/]+)'))::int AS n
    FROM "Source"
    WHERE deleted = false AND url IS NOT NULL
  `;
  console.log("Distinct source domains total:", distinctDomains[0]?.n);

  // ---------- 6. Field/topic gaps via AcademicField ----------
  console.log("\n=== 6. ACADEMIC FIELD COVERAGE ===");
  const afTotal = await p.academicField.count();
  console.log("AcademicField rows total:", afTotal);

  const byField = await p.$queryRaw<Row[]>`
    SELECT af.name AS field, af.level AS lvl, COUNT(c.id)::int AS n
    FROM "AcademicField" af
    LEFT JOIN "Claim" c ON c."academicFieldId" = af.id AND c.deleted = false
    GROUP BY af.id, af.name, af.level
    ORDER BY n DESC
    LIMIT 30
  `;
  console.log("Top 30 academic fields by claim count:");
  tab(byField, ["n", "lvl", "field"]);

  const fieldsZero = await p.$queryRaw<Row[]>`
    SELECT COUNT(*)::int AS n
    FROM "AcademicField" af
    WHERE NOT EXISTS (SELECT 1 FROM "Claim" c WHERE c."academicFieldId" = af.id AND c.deleted = false)
  `;
  console.log("AcademicField rows with ZERO claims:", fieldsZero[0]?.n);
  const claimsNoField = await p.claim.count({ where: { deleted: false, academicFieldId: null } });
  console.log("Claims with NO academicFieldId:", claimsNoField, "(", ((claimsNoField / totalLive) * 100).toFixed(1) + "%)");

  // ---------- 7. Polity link gap ----------
  console.log("\n=== 7. POLITY LINK GAP ===");
  const claimsWithPolity = await p.$queryRaw<Row[]>`
    SELECT COUNT(DISTINCT "claimId")::int AS n
    FROM "PolityClaim" pc
    JOIN "Claim" c ON c.id = pc."claimId"
    WHERE c.deleted = false
  `;
  const n = claimsWithPolity[0]?.n as number;
  console.log("Live claims with ≥1 PolityClaim:", n, `(${((n / totalLive) * 100).toFixed(2)}%)`);
  console.log("Live claims with NO PolityClaim:", totalLive - n, `(${(((totalLive - n) / totalLive) * 100).toFixed(2)}%)`);

  // ---------- Bonus: topic coverage ----------
  console.log("\n=== BONUS: TOPIC COVERAGE ===");
  const topicsTotal = await p.topic.count();
  console.log("Topic rows total:", topicsTotal);
  const claimsWithTopic = await p.$queryRaw<Row[]>`
    SELECT COUNT(DISTINCT "claimId")::int AS n FROM "ClaimTopic" ct
    JOIN "Claim" c ON c.id = ct."claimId" WHERE c.deleted = false
  `;
  const nt = claimsWithTopic[0]?.n as number;
  console.log("Live claims with ≥1 topic:", nt, `(${((nt / totalLive) * 100).toFixed(2)}%)`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
