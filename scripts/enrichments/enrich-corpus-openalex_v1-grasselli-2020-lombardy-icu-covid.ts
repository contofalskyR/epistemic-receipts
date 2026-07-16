// Enrichment: post-publication epistemic trajectory for
// Grasselli et al. (2020), "Baseline Characteristics and Outcomes of 1591
// Patients Infected With SARS-CoV-2 Admitted to ICUs of the Lombardy Region,
// Italy," JAMA. DOI 10.1001/jama.2020.5394 · OpenAlex W3014294089.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// publication date, 2020-04-06) already exists and is NOT duplicated here.
//
// Arc added:
//   RECORDED -> SETTLED (2020-07-15, EXPERT_LITERATURE)
//     The April case series reported that the majority of the 1591 patients
//     were still in the ICU at data cutoff, leaving outcomes incomplete. The
//     same COVID-19 Lombardy ICU Network published the definitive outcomes
//     study — Grasselli et al., "Risk Factors Associated With Mortality Among
//     Patients With COVID-19 in Intensive Care Units in Lombardy, Italy,"
//     JAMA Internal Medicine (online 2020-07-15) — reporting the completed
//     mortality data on the expanded regional cohort and corroborating the
//     original clinical characterization of ICU patients (older men with
//     comorbidities, high mechanical-ventilation need and mortality).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-grasselli-2020-lombardy-icu-covid.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmpm0oxul0l87sat0vy1nsoog'

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
    community: 'EXPERT_LITERATURE',
    occurredAt: '2020-07-15',
    datePrecision: 'DAY',
    reason:
      'The original April 2020 case series characterized 1591 Lombardy ICU patients but reported outcomes as incomplete, with the majority of patients still in the ICU at data cutoff. On 2020-07-15 the same COVID-19 Lombardy ICU Network published the definitive outcomes study in JAMA Internal Medicine ("Risk Factors Associated With Mortality Among Patients With COVID-19 in Intensive Care Units in Lombardy, Italy"), reporting the completed mortality data on the expanded regional cohort. It corroborated and extended the original clinical characterization — predominantly older men with comorbidities requiring mechanical ventilation, with high mortality — settling the descriptive finding.',
    source: {
      externalId: 'src:grasselli-lombardy-icu-mortality-2020',
      name: 'Grasselli G, Greco M, Zanella A, et al. Risk Factors Associated With Mortality Among Patients With COVID-19 in Intensive Care Units in Lombardy, Italy. JAMA Intern Med. 2020;180(10):1345-1355. doi:10.1001/jamainternmed.2020.3539',
      url: 'https://pubmed.ncbi.nlm.nih.gov/32667669/',
      publishedAt: '2020-07-15',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } })
  if (!claim) throw new Error(`Claim ${claimId} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
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

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({
        data: { claimId, sourceId: source.id, type: 'FOR' },
      })
    }

    console.log(`  ✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
