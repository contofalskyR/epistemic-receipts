// Epistemic-receipt enrichment: post-publication trajectory for
// Rao, Savsani & Vakharia (2011), "Teaching–learning-based optimization: A novel
// method for constrained mechanical design optimization problems",
// Computer-Aided Design 43(3):303–315.
// DOI: 10.1016/j.cad.2010.12.015
// OpenAlex: W1999284878. Claim id: cmq2w5s650133sa8hl5xzoy7z.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2011-01-08) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2012-12, EXPERT_LITERATURE)
//     Črepinšek, Liu & Mernik, "A note on teaching–learning-based optimization
//     algorithm" (Information Sciences 212:79–93) — the reference methodological
//     critique of exactly the claims made here: it showed TLBO's reported
//     benchmark superiority could not be reproduced, that the algorithm is not
//     genuinely "parameter-less" (it carries implicit control parameters / an
//     elitism step), and that the original experiments effectively used more
//     function evaluations than reported, biasing the comparisons.
//
// No SETTLED/REVERSED transition is added: the dispute continued (Waghmare's
// comments and Rao's responses) but no systematic review or meta-analysis has
// adjudicated the parameter-less superiority claim as vindicated or overturned.
// The finding remains contested.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-rao-2011-teaching-learning-based-optimization.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w5s650133sa8hl5xzoy7z'

type FactStatus =
  | 'OPEN'
  | 'RECORDED'
  | 'SETTLED'
  | 'CONTESTED'
  | 'REVERSED'
  | 'ABANDONED'
  | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE'
  | 'INSTITUTIONAL'
  | 'JUDICIAL'
  | 'PUBLIC'
  | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2012-12-01',
    datePrecision: 'MONTH',
    reason:
      'Črepinšek, Liu & Mernik\'s "A note on teaching–learning-based optimization algorithm" (Information Sciences 212:79–93) is the reference methodological critique of the very claims asserted here. It reports that TLBO\'s published benchmark superiority could not be reproduced, that the algorithm is not genuinely "parameter-less" (it carries implicit control parameters and an elitism/duplicate-handling step), and that the original experiments effectively consumed more function evaluations than reported, biasing the comparisons in TLBO\'s favour. The paper opened a sustained dispute over TLBO\'s reported advantages that directly contests this finding.',
    source: {
      externalId: 'src:crepinsek-liu-mernik-note-on-tlbo-2012',
      name: 'Črepinšek M, Liu S-H, Mernik L. A note on teaching–learning-based optimization algorithm. Information Sciences 2012;212:79–93.',
      url: 'https://doi.org/10.1016/j.ins.2012.05.009',
      publishedAt: '2012-12-01',
      methodologyType: 'opinion',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
