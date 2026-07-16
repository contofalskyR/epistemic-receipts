// Epistemic-receipt enrichment: post-publication trajectory for
// "Surviving sepsis campaign: international guidelines for management of
// sepsis and septic shock 2021" (Evans L, Rhodes A, Alhazzani W, et al.),
// Intensive Care Medicine 47:1181–1247.
// DOI: 10.1007/s00134-021-06506-y. OpenAlex: W3202964273.
// Claim id: cmpm0o9vk0kwvsat0hwnrtgut.
//
// This is the 2021 edition of the international consensus guideline for the
// management of sepsis and septic shock, endorsed at publication by dozens of
// critical-care and infectious-disease societies.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2021-10-02) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2026-03-23, INSTITUTIONAL)
//     Surviving Sepsis Campaign: International Guidelines for Management of
//     Sepsis and Septic Shock 2026 (Critical Care Medicine; DOI
//     10.1097/CCM.0000000000007075; PMID 41869847). The guideline body
//     (SCCM/ESICM and endorsing societies) issued a full successor edition
//     that explicitly updates the 2021 recommendations, expanding to 129
//     statements. Rather than overturning the 2021 guideline, the 2026 update
//     reaffirms its core pillars — early recognition, timely treatment of
//     infection, and hemodynamic resuscitation — establishing the 2021
//     framework as the continuously-maintained institutional standard of care
//     for sepsis. This is a field-consensus / institutional-adoption event,
//     not a reversal.
//
// NOTE ON WHAT WAS DELIBERATELY OMITTED:
//   - No retraction or expression of concern exists (Crossref shows no
//     update-to relation).
//   - The well-known IDSA non-endorsement applies to the 2016 edition; IDSA
//     endorsed the 2021 edition, so it is not a contest on this claim.
//   - Ongoing debate over the 30 mL/kg fluid recommendation and strong
//     recommendations from low-quality evidence is real but has no single
//     canonical, dated adjudicating paper overturning the guideline, so no
//     RECORDED -> CONTESTED transition was fabricated.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-surviving-sepsis-campaign-2021.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm0o9vk0kwvsat0hwnrtgut'

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
    occurredAt: '2026-03-23',
    datePrecision: 'DAY',
    reason:
      'The Surviving Sepsis Campaign issued a full successor edition — "Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2026" (Critical Care Medicine; DOI 10.1097/CCM.0000000000007075) — that explicitly updates the 2021 recommendations and expands to 129 statements. The successor reaffirms the 2021 guideline\'s core pillars (early recognition, timely treatment of infection, and hemodynamic resuscitation) rather than overturning them, establishing the 2021 framework as the continuously-maintained institutional standard of care for sepsis. This is a field-consensus / institutional-adoption event ratified by the SCCM/ESICM guideline body and its endorsing societies.',
    source: {
      externalId: 'src:surviving-sepsis-campaign-2026-guidelines',
      name: 'Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2026. Critical Care Medicine 2026. DOI 10.1097/CCM.0000000000007075; PMID 41869847.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/41869847/',
      publishedAt: '2026-03-23',
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
