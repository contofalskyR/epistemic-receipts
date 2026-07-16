// Epistemic-receipt enrichment: post-publication trajectory for
// Rossi, Hallett, Rossini, Pascual-Leone & The Safety of TMS Consensus Group (2009),
// "Safety, ethical considerations, and application guidelines for the use of
// transcranial magnetic stimulation in clinical practice and research",
// Clinical Neurophysiology 120(12):2008–2039. DOI 10.1016/j.clinph.2009.08.016.
// OpenAlex: W2156092714. Claim id: cmply6ugz01d3saih1x4ow7fq.
// Citations (OpenAlex): 5469.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2009-10-15) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2020-10-23, INSTITUTIONAL)
//     Rossi S, Antal A, et al. (International Federation of Clinical Neurophysiology,
//     IFCN), "Safety and recommendations for TMS use in healthy subjects and patient
//     populations, with updates on training, ethical and regulatory issues: Expert
//     Guidelines" (Clin Neurophysiol 132(1):269–306, online 2020-10-23, print 2021-01;
//     DOI 10.1016/j.clinph.2020.10.003; PMID 33243615). This IFCN expert consensus,
//     led by the same senior author, formally revisits and UPDATES the 2009 guidelines.
//     It carries forward the 2009 safety framework (dosing/seizure-risk parameters,
//     screening, and ethical/application guidance) as the field-standard reference,
//     confirming that the 2009 document became — and remained — the adopted safety
//     consensus for TMS, while extending it to new populations, devices and protocols.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-rossi-tms-safety-guidelines-2009.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply6ugz01d3saih1x4ow7fq'

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
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-10-23',
    datePrecision: 'DAY',
    reason:
      'The 2009 IFCN safety guidelines were formally updated by Rossi, Antal, et al., "Safety and recommendations for TMS use in healthy subjects and patient populations, with updates on training, ethical and regulatory issues: Expert Guidelines" (Clin Neurophysiol 132(1):269–306, online 2020-10-23; DOI 10.1016/j.clinph.2020.10.003; PMID 33243615). This International Federation of Clinical Neurophysiology expert consensus, led by the same senior author, revisits the 2009 document, carries forward its safety framework (dosing/seizure-risk parameters, screening, and ethical/application guidance) as the field-standard reference, and extends it to new populations, devices and protocols — confirming the 2009 guidelines as the adopted, institutionally ratified TMS safety consensus.',
    source: {
      externalId: 'src:rossi-ifcn-tms-safety-expert-guidelines-2021',
      name: 'Rossi S, Antal A, et al. Safety and recommendations for TMS use in healthy subjects and patient populations, with updates on training, ethical and regulatory issues: Expert Guidelines. Clinical Neurophysiology 2021;132(1):269–306. DOI:10.1016/j.clinph.2020.10.003. PMID:33243615.',
      url: 'https://doi.org/10.1016/j.clinph.2020.10.003',
      publishedAt: '2020-10-23',
      methodologyType: 'derivative',
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
