// Enrichment: post-publication epistemic trajectory for Easterly & Levine (1997),
// "Africa's Growth Tragedy: Policies and Ethnic Divisions," QJE 112(4):1203–1250.
// DOI 10.1162/003355300555466 · OpenAlex W2041692102 · Claim cmplynhj0002hsaqk7jxcp2m7
//
// The baseline row (fromAxis=null -> RECORDED at 1997-11-01) already exists and is
// NOT recreated here. This adds two verified post-publication transitions:
//
//   1) RECORDED -> CONTESTED (2004-09) — Posner, "Measuring Ethnic Fractionalization
//      in Africa" (AJPS 48(4):849–863). A direct replication of Easterly & Levine that
//      shows the Atlas-Narodov-Mira ELF index central to their African finding is
//      inappropriate (it counts all ethnographically distinct groups regardless of
//      political relevance) and introduces the PREG index, contesting the robustness
//      of the ELF-based result.
//
//   2) CONTESTED -> REVERSED (2025-01-22) — Sintos, "Population Diversity and Economic
//      Growth: A Meta-Regression Analysis" (Journal of Economic Surveys 39(5):1947–1970).
//      A meta-regression of 1,537 estimates from 83 studies finds the effect of ethnic
//      and linguistic diversity on growth is small and statistically insignificant (with
//      mild publication bias toward negative results), overturning the robust negative
//      diversity->growth relationship at the core of the "growth tragedy."
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-africas-growth-tragedy-easterly-levine.ts
// Dry-run: append --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplynhj0002hsaqk7jxcp2m7'

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

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-09-01',
    datePrecision: 'MONTH',
    reason:
      'Daniel Posner replicated Easterly & Levine and showed that the Ethno-Linguistic Fractionalization (ELF) index built from the Soviet Atlas Narodov Mira — the measure driving their African "growth tragedy" result — is inappropriate for the hypothesis, because it counts all ethnographically distinct groups regardless of whether they engage in the political competition whose policy effects are being tested. Re-estimating their regressions with a new "Politically Relevant Ethnic Groups" (PREG) index, he found PREG better accounts for the policy-mediated effects of diversity on African growth, directly contesting the robustness of the ELF-based finding.',
    source: {
      externalId: 'src:posner-2004-ethnic-fractionalization-africa',
      name: 'Posner DN. Measuring Ethnic Fractionalization in Africa. American Journal of Political Science 2004;48(4):849–863.',
      url: 'https://web.mit.edu/posner/www/papers/ethnic_fraction.pdf',
      publishedAt: '2004-09-07',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2025-01-22',
    datePrecision: 'DAY',
    reason:
      'Andreas Sintos aggregated 1,537 estimates from 83 studies of population diversity and economic growth in a meta-regression analysis. Correcting for publication selection, the analysis finds that ethnic and linguistic diversity have a small and statistically insignificant effect on growth (and detects a mild bias toward publishing negative diversity–growth results), overturning the robust negative ethnic-diversity-reduces-growth relationship at the heart of Easterly & Levine\'s "growth tragedy."',
    source: {
      externalId: 'src:sintos-2025-population-diversity-growth-meta',
      name: 'Sintos A. Population Diversity and Economic Growth: A Meta-Regression Analysis. Journal of Economic Surveys 2025;39(5):1947–1970.',
      url: 'https://doi.org/10.1111/joes.12681',
      publishedAt: '2025-01-22',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    console.log(`  • ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
    if (DRY_RUN) continue

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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
