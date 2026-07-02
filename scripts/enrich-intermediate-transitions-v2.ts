/**
 * One-off enrichment (batch v2): insert verified intermediate epistemic
 * transitions into existing curated settling curves (seed:human-history-
 * trajectories) that skipped a well-documented, dateable intermediate phase.
 *
 * Each intermediate is a real, citable event marking a CONTESTED phase between
 * the initial position and its eventual reversal. The immediately-downstream
 * transition's fromAxis is re-anchored so the from/to chain stays continuous.
 *
 * Sources verified via web search 2026-06-30 (see reason fields + URLs):
 *   - Galileo / Index of Forbidden Books: 1758 general prohibition on
 *     heliocentric works dropped under Benedict XIV (Galileo affair, Wikipedia)
 *   - Loving v. Virginia: McLaughlin v. Florida, 379 U.S. 184 (7 Dec 1964)
 *   - Shayara Bano / triple talaq: Shamim Ara v. State of U.P., (2002) 7 SCC
 *     518 (1 Oct 2002)
 *
 * Usage: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-intermediate-transitions-v2.ts [--dry-run]
 */
import { PrismaClient, RatifyingCommunity } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

type Enrichment = {
  claimId: string;
  label: string;
  insert: {
    fromAxis: string;
    toAxis: string;
    occurredAt: string;
    datePrecision: string;
    community: RatifyingCommunity;
    reason: string;
  };
  source: {
    name: string;
    url: string;
    publishedAt: string;
    methodologyType: string;
    externalId: string;
  };
  fixDownstream: { matchFromAxis: string; toAxis: string; newFromAxis: string };
};

const ENRICHMENTS: Enrichment[] = [
  {
    claimId: "cmqywetoh00008oubterrrgbh",
    label: "Galileo / Copernicanism — 1758 general prohibition dropped",
    insert: {
      fromAxis: "RECORDED",
      toAxis: "CONTESTED",
      occurredAt: "1758-01-01",
      datePrecision: "YEAR",
      community: "INSTITUTIONAL",
      reason:
        "In the 1758 edition of the Index Librorum Prohibitorum, issued under Pope Benedict XIV, the general prohibition on books teaching heliocentrism was dropped — a decisive partial reversal of the 1616 condemnation. It did not, however, rescind the 1633 judgment against Galileo nor lift the ban on the uncensored De Revolutionibus and Dialogue, leaving the doctrine's status contested until the uncensored works were finally removed from the Index in 1835.",
    },
    source: {
      name: "Index Librorum Prohibitorum (1758 edition, Benedict XIV) dropping the general prohibition on heliocentric works — Galileo affair",
      url: "https://en.wikipedia.org/wiki/Galileo_affair#Reversal",
      publishedAt: "1758-01-01",
      methodologyType: "derivative",
      externalId: "src:index-1758-heliocentrism-dropped",
    },
    fixDownstream: { matchFromAxis: "RECORDED", toAxis: "REVERSED", newFromAxis: "CONTESTED" },
  },
  {
    claimId: "cmqgaqim400fcsakadn1hdge4",
    label: "Loving v. Virginia — McLaughlin v. Florida (1964) rejects Pace reasoning",
    insert: {
      fromAxis: "SETTLED",
      toAxis: "CONTESTED",
      occurredAt: "1964-12-07",
      datePrecision: "DAY",
      community: "JUDICIAL",
      reason:
        "In McLaughlin v. Florida, 379 U.S. 184 (decided 7 December 1964), the U.S. Supreme Court unanimously struck down Florida's criminal ban on interracial cohabitation and expressly rejected the equal-protection reasoning of Pace v. Alabama (1883), while declining to reach the constitutionality of anti-miscegenation marriage bans themselves — leaving the Pace doctrine contested until it was fully overturned in Loving v. Virginia (1967).",
    },
    source: {
      name: "McLaughlin v. Florida, 379 U.S. 184 (1964)",
      url: "https://supreme.justia.com/cases/federal/us/379/184/",
      publishedAt: "1964-12-07",
      methodologyType: "primary",
      externalId: "src:mclaughlin-v-florida-1964",
    },
    fixDownstream: { matchFromAxis: "SETTLED", toAxis: "REVERSED", newFromAxis: "CONTESTED" },
  },
  {
    claimId: "cmqnoniei06jk8ovcon6ubrjk",
    label: "Triple talaq — Shamim Ara v. State of U.P. (2002)",
    insert: {
      fromAxis: "RECORDED",
      toAxis: "CONTESTED",
      occurredAt: "2002-10-01",
      datePrecision: "DAY",
      community: "JUDICIAL",
      reason:
        "In Shamim Ara v. State of U.P., (2002) 7 SCC 518 (judgment delivered 1 October 2002), the Supreme Court of India held that a mere assertion of triple talaq, without proof of proper pronouncement and a preceding attempt at reconciliation, does not validly dissolve a marriage — beginning the judicial dismantling of the instant-talaq practice that had been recognised since the 1937 Shariat Act, fifteen years before it was held unconstitutional in Shayara Bano (2017).",
    },
    source: {
      name: "Shamim Ara v. State of U.P. & Anr., (2002) 7 SCC 518 (Supreme Court of India)",
      url: "https://indiankanoon.org/doc/332673/",
      publishedAt: "2002-10-01",
      methodologyType: "primary",
      externalId: "src:shamim-ara-v-up-2002",
    },
    fixDownstream: { matchFromAxis: "RECORDED", toAxis: "REVERSED", newFromAxis: "CONTESTED" },
  },
];

async function main() {
  let enriched = 0;
  const details: string[] = [];

  for (const e of ENRICHMENTS) {
    const claim = await prisma.claim.findUnique({ where: { id: e.claimId }, select: { id: true } });
    if (!claim) {
      console.log(`SKIP ${e.label}: claim ${e.claimId} not found`);
      continue;
    }

    // Idempotency: skip if a transition with this toAxis+occurredAt already exists.
    const existing = await prisma.claimStatusHistory.findFirst({
      where: { claimId: e.claimId, toAxis: e.insert.toAxis, occurredAt: new Date(e.insert.occurredAt) },
    });
    if (existing) {
      console.log(`SKIP ${e.label}: intermediate already present`);
      continue;
    }

    const downstream = await prisma.claimStatusHistory.findFirst({
      where: { claimId: e.claimId, fromAxis: e.fixDownstream.matchFromAxis, toAxis: e.fixDownstream.toAxis },
    });
    if (!downstream) {
      console.log(`SKIP ${e.label}: downstream ${e.fixDownstream.matchFromAxis}->${e.fixDownstream.toAxis} not found`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`DRY ${e.label}: would insert ${e.insert.fromAxis}->${e.insert.toAxis} @ ${e.insert.occurredAt}, re-anchor downstream fromAxis -> ${e.fixDownstream.newFromAxis}`);
      enriched++;
      details.push(`${e.claimId}: added ${e.insert.fromAxis}→${e.insert.toAxis}`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const src = await tx.source.upsert({
        where: { externalId: e.source.externalId },
        update: {},
        create: {
          name: e.source.name,
          url: e.source.url,
          publishedAt: new Date(e.source.publishedAt),
          methodologyType: e.source.methodologyType,
          ingestedBy: "enrich:intermediate-transitions",
          externalId: e.source.externalId,
        },
      });

      await tx.claimStatusHistory.create({
        data: {
          claimId: e.claimId,
          fromAxis: e.insert.fromAxis,
          toAxis: e.insert.toAxis,
          occurredAt: new Date(e.insert.occurredAt),
          datePrecision: e.insert.datePrecision,
          community: e.insert.community,
          reason: e.insert.reason,
          sourceId: src.id,
        },
      });

      await tx.claimStatusHistory.update({
        where: { id: downstream.id },
        data: { fromAxis: e.fixDownstream.newFromAxis },
      });
    });

    console.log(`ENRICHED ${e.label}`);
    enriched++;
    details.push(`${e.claimId}: added ${e.insert.fromAxis}→${e.insert.toAxis} transition`);
  }

  console.log(`\nENRICHED:${enriched}`);
  console.log(`DETAILS:${details.join(" | ")}`);
}

main().finally(() => prisma.$disconnect());
