// Epistemic-receipt enrichment for the 2014 AHA/ACC/HRS Guideline for the
// Management of Patients With Atrial Fibrillation (January et al., Circulation
// 2014;130(23):e199–e267. DOI 10.1161/CIR.0000000000000041, OpenAlex W2121394112).
//
// The claim already has its baseline ClaimStatusHistory row
// (fromAxis=null -> RECORDED at the 2014-03-29 publication date). This script
// adds the post-publication arc.
//
// Post-publication event (verified 2026-07-15):
//   RECORDED -> SETTLED (2019-01-28): The 2019 AHA/ACC/HRS Focused Update of the
//   2014 Guideline (January et al., Circulation 2019;140(2):e125–e151,
//   DOI 10.1161/CIR.0000000000000665, PMID 30686041) explicitly revised and
//   extended the 2014 guideline as its base document, institutionally reaffirming
//   it as the standing official policy of the ACC, AHA and HRS while strengthening
//   core recommendations (NOACs preferred over warfarin, CHA2DS2-VASc-based
//   anticoagulation thresholds). The framework was subsequently carried forward
//   and refined — not overturned — by the 2023 ACC/AHA/ACCP/HRS AF Guideline
//   (Joglar et al., DOI 10.1161/CIR.0000000000001193), so the terminal axis
//   remains SETTLED institutional consensus.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-january-2014-af-guideline.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-january-2014-af-guideline.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmplyw6hs04e5saqk3drgi1nb'

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
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2019-01-28',
    datePrecision: 'DAY',
    reason:
      'The 2019 AHA/ACC/HRS Focused Update of the 2014 AF Guideline (January et al., ' +
      'Circulation 2019;140(2):e125–e151) explicitly revised and extended the 2014 guideline ' +
      'as its base document, institutionally reaffirming it as the standing official policy of ' +
      'the ACC, AHA and HRS while strengthening core recommendations (direct oral anticoagulants ' +
      'preferred over warfarin, CHA2DS2-VASc-based anticoagulation thresholds). This consolidated ' +
      'the 2014 guideline into durable institutional consensus, later carried forward and refined ' +
      'by the 2023 ACC/AHA/ACCP/HRS AF Guideline (Joglar et al., DOI 10.1161/CIR.0000000000001193).',
    source: {
      externalId: 'src:aha-acc-hrs-af-focused-update-2019',
      name:
        'January CT, Wann LS, Calkins H, et al. 2019 AHA/ACC/HRS Focused Update of the 2014 ' +
        'AHA/ACC/HRS Guideline for the Management of Patients With Atrial Fibrillation. ' +
        'Circulation. 2019;140(2):e125–e151.',
      url: 'https://doi.org/10.1161/CIR.0000000000000665',
      publishedAt: '2019-01-28',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${claimId} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const tr of TRANSITIONS) {
    const histId = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
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
        ingestedBy: 'enrich:openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
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

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
