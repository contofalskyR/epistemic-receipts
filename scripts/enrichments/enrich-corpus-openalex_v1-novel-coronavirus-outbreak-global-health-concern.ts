// Enrichment: epistemic trajectory for claim cmply9e7i02l9saih5ca52kmm
// "A novel coronavirus outbreak of global health concern"
// Wang C, Horby PW, Hayden FG, Gao GF. The Lancet 2020 (online 2020-01-24).
// DOI: 10.1016/S0140-6736(20)30185-9 · OpenAlex: W3001465255
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 2020-01-24) already
// exists — this script does NOT duplicate it.
//
// Post-publication event: the paper's central assertion — that the novel
// coronavirus outbreak was of *global health concern* — was ratified by the WHO
// institutionally six days later, when the IHR (2005) Emergency Committee declared
// the outbreak a Public Health Emergency of International Concern (PHEIC) on
// 2020-01-30. This is an institutional consensus adjudication of the claim, not a
// scientific dispute: RECORDED -> SETTLED, community INSTITUTIONAL.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-novel-coronavirus-outbreak-global-health-concern.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-novel-coronavirus-outbreak-global-health-concern.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmply9e7i02l9saih5ca52kmm'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-01-30',
    datePrecision: 'DAY',
    reason:
      "On 30 January 2020 the WHO Director-General, on the advice of the IHR (2005) Emergency Committee, declared the outbreak of 2019-nCoV a Public Health Emergency of International Concern. That declaration is a direct institutional ratification of the paper's central assertion that the novel coronavirus outbreak was of global health concern. The finding was settled by institutional consensus six days after publication, not contested — WHO's determination confirmed rather than challenged it.",
    source: {
      externalId: 'src:who-pheic-2019-ncov-2020-01-30',
      name: 'WHO. Statement on the second meeting of the International Health Regulations (2005) Emergency Committee regarding the outbreak of novel coronavirus (2019-nCoV). 30 January 2020.',
      url: 'https://www.who.int/news/item/30-01-2020-statement-on-the-second-meeting-of-the-international-health-regulations-(2005)-emergency-committee-regarding-the-outbreak-of-novel-coronavirus-(2019-ncov)',
      publishedAt: '2020-01-30',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${claimId} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const tr of TRANSITIONS) {
    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${slug} — ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.community})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-novel-coronavirus-outbreak-global-health-concern',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
