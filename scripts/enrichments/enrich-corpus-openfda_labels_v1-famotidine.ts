// Enrichment: epistemic arc for the FDA famotidine (Pepcid) label claim.
//
// Claim: cmpiyk2nw90h6plo7vajbvn9m (openfda_labels_v1)
//   FAMOTIDINE — an H2-receptor antagonist indicated for active duodenal
//   ulcer, active gastric ulcer, symptomatic nonerosive GERD, erosive
//   esophagitis due to GERD, and pathological hypersecretory conditions
//   (e.g., Zollinger-Ellison syndrome).
//
// Arc (extends the existing fromAxis=null -> OPEN entry; do not duplicate it):
//   OPEN     -> RECORDED (1986-10-15) FDA approval of Pepcid (famotidine),
//                         NDA 019462. Approval rested on Phase III placebo-
//                         controlled trials showing superior duodenal- and
//                         gastric-ulcer healing. This regulatory action first
//                         entered the therapeutic claim on this label into the
//                         official record. Ratified by INSTITUTIONAL.
//   RECORDED -> SETTLED  (2013-03) American College of Gastroenterology (ACG)
//                         clinical guideline for the diagnosis and management of
//                         GERD endorses H2-receptor antagonists (the famotidine
//                         class) as established acid-suppression therapy,
//                         reflecting the broad standard-of-care adoption that
//                         famotidine had by then achieved. Ratified by
//                         EXPERT_LITERATURE.
//
// SETTLED -> CONTESTED / REVERSED is deliberately NOT included. Famotidine
// carries no black-box warning and has never been withdrawn. Notably, when the
// N-nitrosodimethylamine (NDMA) contamination crisis forced the market
// withdrawal of the related H2 antagonist ranitidine (Zantac) in 2020, FDA
// testing found famotidine did NOT form NDMA — the episode reinforced rather
// than contested famotidine's standing as the preferred H2 blocker. Per
// AGENTS.md hard-fact principles, no post-market reversal is fabricated where
// the verifiable record does not support one.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-famotidine.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyk2nw90h6plo7vajbvn9m'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1986-10-15',
    datePrecision: 'DAY',
    reason:
      'The FDA approved famotidine (Pepcid, NDA 019462) on 1986-10-15 for the treatment of active duodenal ulcer, active gastric ulcer, GERD, and pathological hypersecretory conditions. Approval was based on Phase III placebo-controlled trials demonstrating that famotidine produced significantly higher ulcer-healing rates than placebo. This regulatory action first recorded the therapeutic claim carried on this label in the official U.S. drug-approval record.',
    source: {
      externalId: 'src:famotidine-fda-approval-1986',
      name: 'U.S. FDA, Drugs@FDA — Pepcid (famotidine), NDA 019462, original approval 1986-10-15.',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=019462',
      publishedAt: '1986-10-15',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2013-03-01',
    datePrecision: 'MONTH',
    reason:
      'The American College of Gastroenterology guideline for the diagnosis and management of gastroesophageal reflux disease established acid-suppression pharmacotherapy as the standard of care and recognized histamine-2 receptor antagonists — the class to which famotidine belongs — as an established maintenance and symptom-control option. Its expert-panel endorsement reflects the broad, guideline-anchored clinical adoption famotidine had achieved for its labeled acid-related indications, settling the therapeutic consensus.',
    source: {
      externalId: 'src:famotidine-acg-gerd-2013',
      name: 'Katz PO, Gerson LB, Vela MF. "Guidelines for the Diagnosis and Management of Gastroesophageal Reflux Disease." Am J Gastroenterol 2013;108(3):308-328.',
      url: 'https://doi.org/10.1038/ajg.2012.444',
      publishedAt: '2013-03-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const occurredAt = new Date(t.occurredAt)
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
    })

    console.log(`upserted ${slug} (${t.fromAxis} -> ${t.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
