/**
 * One-off enrichment: insert verified intermediate epistemic transitions into
 * existing curated settling curves that skipped a well-documented, dateable
 * intermediate phase. Each intermediate is sourced to a verifiable external
 * record, and the immediately-downstream transition's fromAxis is updated so
 * the from/to chain stays continuous.
 *
 * Sources verified via web search 2026-06-30 (see reason fields + URLs).
 *
 * Usage: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-intermediate-transitions.ts [--dry-run]
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
  // The downstream transition to re-anchor (matched by its current fromAxis +
  // toAxis) so the chain stays continuous after the insert.
  fixDownstream: { matchFromAxis: string; toAxis: string; newFromAxis: string };
};

const ENRICHMENTS: Enrichment[] = [
  {
    claimId: "cmqyz9nt208rf8omubul3rskj",
    label: "Wakefield MMR — 2004 retraction of interpretation",
    insert: {
      fromAxis: "RECORDED",
      toAxis: "CONTESTED",
      occurredAt: "2004-03-06",
      datePrecision: "DAY",
      community: "EXPERT_LITERATURE",
      reason:
        "Ten of the twelve contactable co-authors published a formal 'Retraction of an interpretation' in The Lancet on 6 March 2004, withdrawing the paper's suggested causal link between MMR vaccine and autism after disclosure of Wakefield's undeclared conflict of interest — moving the claim from recorded to actively contested years before the full retraction.",
    },
    source: {
      name: "Murch et al., 'Retraction of an interpretation,' The Lancet, 6 March 2004",
      url: "https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(04)15715-2/fulltext",
      publishedAt: "2004-03-06",
      methodologyType: "primary",
      externalId: "src:wakefield-mmr-interpretation-retraction-2004",
    },
    fixDownstream: { matchFromAxis: "RECORDED", toAxis: "REVERSED", newFromAxis: "CONTESTED" },
  },
  {
    claimId: "cmqkgw1xw046msachwh8n2y2e",
    label: "Rainbow Warrior — Tricot report official denial",
    insert: {
      fromAxis: "RECORDED",
      toAxis: "CONTESTED",
      occurredAt: "1985-08-26",
      datePrecision: "DAY",
      community: "INSTITUTIONAL",
      reason:
        "The French government inquiry headed by Bernard Tricot reported on 26 August 1985 that the agents had only been gathering intelligence and cleared France of responsibility for the sinking — an official denial that left French involvement contested until the Fabius admission of 22 September 1985.",
    },
    source: {
      name: "Tricot inquiry report clearing the French government of the Rainbow Warrior bombing, 26 August 1985 (contemporaneous report, Washington Post)",
      url: "https://www.washingtonpost.com/archive/politics/1985/08/27/french-panel-clears-agents-of-sabotage/6420665e-9d8f-4bd9-95d3-8e4ceab886cc/",
      publishedAt: "1985-08-26",
      methodologyType: "derivative",
      externalId: "src:rainbow-warrior-tricot-report-1985",
    },
    fixDownstream: { matchFromAxis: "RECORDED", toAxis: "REVERSED", newFromAxis: "CONTESTED" },
  },
  {
    claimId: "cmqoda27w06zusawivvpg9y95",
    label: "Vietnam 2016 fish kill — disputed 'red tide' official account",
    insert: {
      fromAxis: "OPEN",
      toAxis: "CONTESTED",
      occurredAt: "2016-04-27",
      datePrecision: "DAY",
      community: "INSTITUTIONAL",
      reason:
        "At a 27 April 2016 press conference Deputy Minister of Natural Resources and Environment Vo Tuan Nhan attributed the deaths to a possible 'red tide' algal bloom and human-generated toxins and stated no evidence linked the Formosa Ha Tinh plant — an official explanation publicly disputed and rejected by the Vietnam Fisheries Society, marking a contested phase before the 30 June 2016 finding against Formosa.",
    },
    source: {
      name: "Vietnamese government press conference attributing the fish deaths to red tide / human toxins and finding no Formosa link, 27 April 2016",
      url: "https://en.wikipedia.org/wiki/2016_Vietnam_marine_life_disaster",
      publishedAt: "2016-04-27",
      methodologyType: "derivative",
      externalId: "src:vietnam-fishkill-redtide-presser-2016",
    },
    fixDownstream: { matchFromAxis: "OPEN", toAxis: "SETTLED", newFromAxis: "CONTESTED" },
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

    // Locate the downstream transition to re-anchor.
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
