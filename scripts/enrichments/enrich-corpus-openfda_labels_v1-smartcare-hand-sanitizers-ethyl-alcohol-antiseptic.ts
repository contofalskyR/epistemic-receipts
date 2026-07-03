// Enrichment: epistemic arc for the Smart Care 4 Hand Sanitizers (ETHYL ALCOHOL)
// OTC drug-label claim (claim id cmpiyc2bd8r90plo7759qfqvk — "Purpose Antiseptic").
//
// The product is a branded consumer alcohol-based hand sanitizer; its single labeled
// purpose ("Antiseptic") rests on ethyl alcohol, whose standing as a topical hand
// antiseptic has a genuine, dateable, multi-step epistemic trajectory:
//   OPEN -> RECORDED    : landmark hospital-wide clinical evidence that alcohol-based
//                         handrub antisepsis reduces nosocomial infection (Pittet, Lancet 2000)
//   RECORDED -> SETTLED : CDC Guideline for Hand Hygiene in Health-Care Settings recommends
//                         alcohol-based hand rub as the standard of care (MMWR, 2002)
//   SETTLED -> CONTESTED: FDA post-market safety signal — methanol contamination and
//                         subpotency across marketed alcohol-based hand sanitizers (2020)
//
// The antiseptic *purpose* of properly formulated ethyl-alcohol sanitizer remains sound;
// the 2020 signal contested the safety of the marketed product category, not the chemistry.
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on a deterministic id.
// Does NOT create a new Claim and does NOT duplicate the existing fromAxis=null status row.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-smartcare-hand-sanitizers-ethyl-alcohol-antiseptic.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyc2bd8r90plo7759qfqvk'

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
  // 1) OPEN -> RECORDED : landmark clinical evidence for alcohol-based hand antisepsis
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2000-10-14',
    datePrecision: 'DAY',
    reason:
      'Pittet and colleagues published the Geneva hospital-wide hand-hygiene study in The Lancet, showing that promoting an alcohol-based hand-rub antiseptic drove a sustained rise in hand-hygiene compliance and a significant fall in nosocomial infection and MRSA transmission rates. This was the first large-scale clinical evidence that ethyl-alcohol hand antisepsis — the labeled "Antiseptic" purpose of alcohol-based sanitizers like this product — reduces real patient harm, moving the effectiveness claim from open assertion into the peer-reviewed clinical record.',
    source: {
      externalId: 'src:pittet-2000-lancet-hand-hygiene',
      name: 'Pittet D, Hugonnet S, Harbarth S, et al. Effectiveness of a hospital-wide programme to improve compliance with hand hygiene. Lancet. 2000;356(9238):1307-1312.',
      url: 'https://doi.org/10.1016/S0140-6736(00)02814-2',
      publishedAt: '2000-10-14',
      methodologyType: 'primary',
    },
  },

  // 2) RECORDED -> SETTLED : CDC guideline makes alcohol-based hand rub standard of care
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2002-10-25',
    datePrecision: 'DAY',
    reason:
      'The CDC published its "Guideline for Hand Hygiene in Health-Care Settings" (MMWR Recommendations and Reports), synthesizing the accumulated trial evidence and formally recommending alcohol-based hand rubs as the preferred method for routine hand antisepsis when hands are not visibly soiled. This guideline settled ethyl alcohol as the standard-of-care topical antiseptic for hand hygiene, the recognized basis for the "Antiseptic" purpose that consumer sanitizers such as this one carry.',
    source: {
      externalId: 'src:cdc-mmwr-2002-hand-hygiene-guideline',
      name: 'CDC. Guideline for Hand Hygiene in Health-Care Settings: Recommendations of the Healthcare Infection Control Practices Advisory Committee and the HICPAC/SHEA/APIC/IDSA Hand Hygiene Task Force. MMWR Recomm Rep. 2002;51(RR-16):1-45.',
      url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5116a1.htm',
      publishedAt: '2002-10-25',
      methodologyType: 'derivative',
    },
  },

  // 3) SETTLED -> CONTESTED : FDA post-market safety signal on alcohol-based hand sanitizers
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-06-19',
    datePrecision: 'DAY',
    reason:
      'The FDA issued a safety communication warning consumers not to use a growing list of alcohol-based hand sanitizers found to contain methanol (wood alcohol) — a toxic substitute for the labeled ethyl alcohol — with some products also subpotent or contaminated. The alert, which expanded into a standing "hand sanitizers consumers should not use" list through 2020, contested the safety of the marketed alcohol-based sanitizer category on which this product\'s "Antiseptic" purpose depends, even though correctly formulated ethyl alcohol remained an effective antiseptic.',
    source: {
      externalId: 'src:fda-2020-hand-sanitizers-do-not-use',
      name: 'U.S. Food and Drug Administration. FDA updates on hand sanitizers consumers should not use (methanol contamination safety communication).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-updates-hand-sanitizers-consumers-should-not-use',
      publishedAt: '2020-06-19',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} ethyl-alcohol-antiseptic-arc transitions...`)

  for (const t of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const id = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id },
      create: {
        id,
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${id})`)
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
