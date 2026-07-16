import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Claim: Pope CA III & Dockery DW (2006), "Health Effects of Fine Particulate
// Air Pollution: Lines That Connect", Journal of the Air & Waste Management
// Association 56(6):709-742.
// DOI 10.1080/10473289.2006.10464485 | OpenAlex W2140282454
// Baseline row (fromAxis=null -> RECORDED @ 2006-06-01) already exists; do NOT duplicate.
const claimId = 'cmpm16h6l0or2sa86a9zuj7ap'

type Transition = {
  fromAxis: 'RECORDED'
  toAxis: 'SETTLED'
  community: 'INSTITUTIONAL'
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

const transitions: Transition[] = [
  {
    // Global institutional consensus adjudicating the review's core thesis:
    // PM air pollution damages health, with effects at ever-lower concentrations.
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2021-09-22',
    datePrecision: 'DAY',
    reason:
      'On 22 September 2021 the World Health Organization released its new Global Air Quality Guidelines, halving the recommended annual PM2.5 level from 10 to 5 µg/m³ after a systematic review of the accumulated evidence (six systematic reviews covering more than 500 papers). WHO concluded that air pollution damages human health "at even lower concentrations than previously understood," directly ratifying the two central claims of Pope & Dockery\'s review—that fine particulate matter causes cardiovascular and respiratory mortality, and that the concentration-response function extends below previously assumed thresholds. This global institutional adoption of a lower, evidence-based standard moves the finding from RECORDED to SETTLED.',
    source: {
      externalId: 'src:who-2021-global-air-quality-guidelines',
      name: 'World Health Organization (2021), "New WHO Global Air Quality Guidelines aim to save millions of lives from air pollution" (news release, 22 Sep 2021), accompanying the 2021 WHO Global Air Quality Guidelines (PM2.5 annual level lowered to 5 µg/m³)',
      url: 'https://www.who.int/news/item/22-09-2021-new-who-global-air-quality-guidelines-aim-to-save-millions-of-lives-from-air-pollution',
      publishedAt: '2021-09-22',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of transitions) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1-pope-dockery-pm-health-2006',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
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

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
  }

  console.log('Done: 1 transition upserted for Pope & Dockery (PM health effects, 2006).')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
