// Enrichment: post-publication epistemic trajectory for Proctor et al. (2011),
// "Outcomes for Implementation Research: Conceptual Distinctions, Measurement
// Challenges, and Research Agenda" (Adm Policy Ment Health, online 2010-10-18).
// Claim: cmplya92t02zrsaihw53ppbhu — the eight-outcome implementation-outcomes taxonomy.
//
// Baseline row (fromAxis=null -> RECORDED at 2010-10-18) already exists; do NOT duplicate.
//
// Added arc:
//   RECORDED -> SETTLED (2015-11-04, EXPERT_LITERATURE)
//     Lewis et al. (2015), "Outcomes for implementation science: an enhanced
//     systematic review of instruments using evidence-based rating criteria"
//     (Implementation Science), the SIRC Instrument Review Project, adopted the
//     eight Proctor implementation outcomes as its organizing framework to
//     catalog and rate measurement instruments — consolidating the taxonomy as
//     the field's standard classification of implementation outcomes.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-proctor-implementation-outcomes-2011.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-proctor-implementation-outcomes-2011.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmplya92t02zrsaihw53ppbhu'

interface Transition {
  fromAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
  toAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
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
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-11-04',
    datePrecision: 'DAY',
    reason:
      'Lewis et al. (2015), "Outcomes for implementation science: an enhanced systematic review of instruments using evidence-based rating criteria" (Implementation Science), the SIRC Instrument Review Project, adopted Proctor\'s eight implementation outcomes as its organizing framework to catalog and evidence-rate measurement instruments. Structuring the field\'s leading instrument review entirely around the taxonomy consolidated it as the standard classification of implementation outcomes, moving the proposal from a "heuristic, working" framework to accepted field consensus.',
    source: {
      externalId: 'src:doi:10.1186/s13012-015-0342-x',
      name: 'Lewis et al. (2015), Outcomes for implementation science: an enhanced systematic review of instruments using evidence-based rating criteria, Implementation Science 10:155',
      url: 'https://doi.org/10.1186/s13012-015-0342-x',
      publishedAt: '2015-11-04',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const slug = `${claimId}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${slug})`)
    if (DRY_RUN) continue

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

    const source = await prisma.source.findUnique({ where: { externalId: t.source.externalId } })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source?.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source?.id,
      },
    })
  }

  console.log(DRY_RUN ? 'Dry-run complete.' : 'Enrichment complete.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
