// Enrichment: post-publication epistemic trajectory for
// IPCC (2007), "Climate Change 2007: The Physical Science Basis" —
// Contribution of Working Group I to the Fourth Assessment Report (AR4 WG1).
// OpenAlex W1520428197 · claim cmq2w46lh0049sa8hrwx9id27 · no DOI (report)
//
// Baseline row (fromAxis=null -> RECORDED at 2007-01-01) already exists; not duplicated here.
//
// Arc added:
//   RECORDED -> SETTLED (2013-09-27) via IPCC AR5 WG1, "Climate Change 2013: The
//   Physical Science Basis." The Fifth Assessment Report is the IPCC's own successor
//   consensus assessment and functions as the field-consensus adjudication of AR4's
//   central attribution finding. AR4 (2007) judged it "very likely" (>90%) that most of
//   the observed mid-20th-century warming was due to anthropogenic greenhouse gases;
//   AR5 (2013) reaffirmed and STRENGTHENED that finding to "extremely likely" (>95%)
//   that human influence has been the dominant cause of observed warming since 1950.
//   This is a dated, citable, intergovernmental consensus document that settles (vindicates)
//   the finding, so the axis is RECORDED -> SETTLED with an INSTITUTIONAL ratifying
//   community. Date is the AR5 WG1 Summary for Policymakers approval (27 Sept 2013).
//
// No retraction or expression of concern exists for the WG1 physical-science volume.
// (The 2009–2010 "Climategate"/glacier-error controversies and the 2010 InterAcademy
// Council process review concerned IPCC procedures and the WG2 impacts volume, not the
// WG1 attribution finding, so no CONTESTED arc is asserted here.)
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ipcc-2007-ar4-wg1-physical-science-basis.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ipcc-2007-ar4-wg1-physical-science-basis.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w46lh0049sa8hrwx9id27'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  edgeType: 'SUPPORTS' | 'AGAINST'
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
    community: 'INSTITUTIONAL',
    occurredAt: '2013-09-27',
    datePrecision: 'DAY',
    edgeType: 'SUPPORTS',
    reason:
      'IPCC Working Group I\'s Fifth Assessment Report, "Climate Change 2013: The Physical Science Basis," is the intergovernmental consensus successor to AR4 WG1 and adjudicates its central attribution finding. AR4 (2007) assessed it "very likely" (>90%) that most observed mid-20th-century warming was due to anthropogenic greenhouse gases; AR5 (2013) reaffirmed and strengthened this to "extremely likely" (>95%) that human influence has been the dominant cause of the observed warming since the mid-20th century. This dated, citable consensus assessment vindicates the finding via an institutional community, moving it from RECORDED to SETTLED. Date is the AR5 WG1 Summary for Policymakers approval, 27 September 2013.',
    source: {
      externalId: 'src:ipcc-2013-ar5-wg1-physical-science-basis',
      name: 'IPCC, 2013: Climate Change 2013: The Physical Science Basis. Contribution of Working Group I to the Fifth Assessment Report of the IPCC (Summary for Policymakers approved 27 Sept 2013)',
      url: 'https://www.ipcc.ch/report/ar5/wg1/',
      publishedAt: '2013-09-27',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} (IPCC 2007, AR4 WG1 — The Physical Science Basis)`)
  console.log(DRY_RUN ? '[DRY RUN — no writes]\n' : '')

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  would upsert source  ${tr.source.externalId}`)
      console.log(`  would upsert history ${slug}  (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
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
        ingestedBy: 'enrich:openalex_v1-ipcc-2007-ar4-wg1-physical-science-basis',
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: tr.edgeType } })
    }

    console.log(`  ✓ ${slug}  (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
  }

  console.log('\nDone.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
