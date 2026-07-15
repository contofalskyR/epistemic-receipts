// Enrichment: post-publication epistemic trajectory for Baumeister & Leary (1995),
// "The need to belong: Desire for interpersonal attachments as a fundamental human motivation,"
// Psychological Bulletin 117(3), 497–529. DOI 10.1037/0033-2909.117.3.497 (OpenAlex W2081155210).
//
// Baseline row (fromAxis=null -> RECORDED at 1995-05) already exists; do NOT duplicate it.
//
// Adjudicating event added here:
//   RECORDED -> SETTLED (2010-07-27, EXPERT_LITERATURE)
//   Holt-Lunstad, Smith & Layton, "Social Relationships and Mortality Risk: A Meta-analytic
//   Review," PLoS Medicine, DOI 10.1371/journal.pmed.1000316. A 148-study meta-analysis
//   (308,849 participants) quantitatively confirms the health-consequence arm of the
//   belongingness hypothesis: stronger social relationships raise the odds of survival ~50%.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-baumeister-1995-need-to-belong.ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmplxqxxk0331sa7fctsmcl1b'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
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

const transitions: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2010-07-27',
    datePrecision: 'DAY',
    reason:
      "Baumeister & Leary hypothesized that failure to satisfy the need to belong produces detrimental " +
      "effects on health and well-being. Holt-Lunstad, Smith & Layton's meta-analytic review of 148 studies " +
      "(308,849 participants) quantitatively confirmed this pathway, finding a ~50% greater likelihood of survival " +
      "for individuals with stronger social relationships — an effect on par with quitting smoking. The review " +
      "cemented the belongingness–health link as settled in the expert literature.",
    source: {
      externalId: 'src:holt-lunstad-2010-social-relationships-mortality',
      name: 'Holt-Lunstad, Smith & Layton (2010), "Social Relationships and Mortality Risk: A Meta-analytic Review," PLoS Medicine 7(7):e1000316',
      url: 'https://doi.org/10.1371/journal.pmed.1000316',
      publishedAt: '2010-07-27',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of transitions) {
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

    const id = `${claimId}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id },
      create: {
        id,
        claimId,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
    })
    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
