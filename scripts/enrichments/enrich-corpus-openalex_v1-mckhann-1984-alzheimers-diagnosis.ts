// Enrichment: epistemic trajectory for McKhann, Drachman, Folstein, Katzman,
// Price & Stadlan (1984), "Clinical diagnosis of Alzheimer's disease: Report of
// the NINCDS-ADRDA Work Group," Neurology 34(7): 939–944.
// DOI 10.1212/wnl.34.7.939. OpenAlex W2156220037.
//
// This is the founding statement of the NINCDS-ADRDA clinical diagnostic
// criteria for Alzheimer's disease — insidious onset, progressive memory and
// cognitive impairment, absence of early motor/sensory deficits, and diagnosis
// by exclusion (laboratory tests rule out other causes of dementia). For ~25
// years these were the international standard for clinical AD diagnosis.
//
// Post-publication research state:
//   - No retraction, expression of concern, or erratum exists. Crossref returns
//     an empty `update-to` and the DOI resolves 200.
//   - The claim was NOT overturned as wrong; rather, the specific criteria set
//     was first challenged as outdated (2007) and then formally superseded as
//     the operative standard by new consensus criteria (2011). The clinical
//     core (insidious onset, progressive amnestic decline, exclusion of other
//     causes) was retained in the successor guidelines, but the named
//     NINCDS-ADRDA instrument was officially revised and replaced.
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 1984 publication). This script adds the downstream arc:
//
//   RECORDED -> CONTESTED (2007-08): Dubois et al., "Research criteria for the
//     diagnosis of Alzheimer's disease: revising the NINCDS–ADRDA criteria"
//     (Lancet Neurology 6(8): 734–746) argues the 1984 criteria are outdated in
//     light of biomarkers and neuroimaging and proposes replacing the
//     diagnosis-by-exclusion framework. A specific, dated, expert-literature
//     challenge to the standard.
//
//   CONTESTED -> REVERSED (2011-05): McKhann et al., "The diagnosis of dementia
//     due to Alzheimer's disease: Recommendations from the National Institute on
//     Aging-Alzheimer's Association workgroups on diagnostic guidelines for
//     Alzheimer's disease" (Alzheimer's & Dementia 7(3): 263–269) is the
//     official NIA-AA revision that formally supersedes and replaces the 1984
//     NINCDS-ADRDA criteria as the diagnostic standard. Institutional
//     adjudication that retired the named instrument.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mckhann-1984-alzheimers-diagnosis.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mckhann-1984-alzheimers-diagnosis.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxmepv00ujsa7f0zofy4w2'

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
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// Do NOT duplicate the existing null -> RECORDED (1984 publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-08-01',
    datePrecision: 'MONTH',
    reason:
      'Dubois et al., "Research criteria for the diagnosis of Alzheimer\'s disease: revising the NINCDS–ADRDA criteria" (Lancet Neurology 6(8): 734–746, Aug 2007), explicitly argues that the 1984 NINCDS-ADRDA criteria are outdated: their diagnosis-by-exclusion, probabilistic framework does not incorporate the biomarker and neuroimaging evidence that had become available. The paper proposes a new criteria set built on a core clinical phenotype plus supportive biomarkers, directly challenging the adequacy of the 1984 standard. This is a specific, dated, well-cited methodological critique from the expert literature.',
    source: {
      externalId: 'src:lancetneurol-dubois-2007-revising-nincds-adrda',
      name:
        'B. Dubois et al., "Research criteria for the diagnosis of Alzheimer\'s disease: revising the NINCDS–ADRDA criteria," The Lancet Neurology 6(8): 734–746 (August 2007). DOI 10.1016/S1474-4422(07)70178-3.',
      url: 'https://doi.org/10.1016/S1474-4422(07)70178-3',
      publishedAt: '2007-08-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-05-01',
    datePrecision: 'MONTH',
    reason:
      'McKhann et al., "The diagnosis of dementia due to Alzheimer\'s disease: Recommendations from the National Institute on Aging-Alzheimer\'s Association workgroups on diagnostic guidelines for Alzheimer\'s disease" (Alzheimer\'s & Dementia 7(3): 263–269, May 2011), is the official NIA-AA revision that formally supersedes the 1984 NINCDS-ADRDA criteria as the diagnostic standard. Written by the original lead author, it retires the named 1984 instrument, incorporates biomarkers, and defines new probable/possible AD dementia categories. The clinical core (insidious onset, progressive decline, exclusion of other causes) was retained, but the specific criteria set this paper established was institutionally replaced as the operative standard.',
    source: {
      externalId: 'src:jalz-mckhann-2011-nia-aa-diagnostic-guidelines',
      name:
        'G.M. McKhann et al., "The diagnosis of dementia due to Alzheimer\'s disease: Recommendations from the National Institute on Aging-Alzheimer\'s Association workgroups on diagnostic guidelines for Alzheimer\'s disease," Alzheimer\'s & Dementia 7(3): 263–269 (May 2011). DOI 10.1016/j.jalz.2011.03.005.',
      url: 'https://doi.org/10.1016/j.jalz.2011.03.005',
      publishedAt: '2011-05-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${
      DRY_RUN ? ' (DRY RUN)' : ''
    }`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`)
  }

  for (const t of TRANSITIONS) {
    const s = t.source
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    console.log(
      `  ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${s.externalId})`,
    )
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: s.externalId },
      create: {
        externalId: s.externalId,
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
        ingestedBy: 'enrich:openalex_v1',
        autoApproved: true,
      },
      update: {
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
