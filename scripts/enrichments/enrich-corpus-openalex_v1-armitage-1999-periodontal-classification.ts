// Enrichment: epistemic trajectory for Armitage GC (1999),
// "Development of a Classification System for Periodontal Diseases and Conditions,"
// Annals of Periodontology 4(1):1–6. DOI 10.1902/annals.1999.4.1.1.
// OpenAlex W2174784305.
//
// This paper is the output of the 1999 International Workshop for a
// Classification of Periodontal Diseases and Conditions (sponsored by the
// American Academy of Periodontology). It became the field-standard
// classification of periodontal diseases — centrally, the distinction between
// "chronic" and "aggressive" periodontitis — used internationally for ~19 years.
//
// The claim already carries its baseline (null -> RECORDED) first entry at the
// December 1999 publication date. This script adds the single downstream arc:
//
//   RECORDED -> REVERSED (2018-06): The 2017 World Workshop on the Classification
//     of Periodontal and Peri-Implant Diseases and Conditions, co-sponsored by
//     the American Academy of Periodontology (AAP) and the European Federation of
//     Periodontology (EFP), produced a new classification that explicitly
//     replaced the 1999 scheme. Published June 2018 as Caton et al., "A new
//     classification scheme for periodontal and peri-implant diseases and
//     conditions – Introduction and key changes from the 1999 classification"
//     (J Clin Periodontol; DOI 10.1111/jcpe.12935), it abandoned the 1999
//     chronic/aggressive periodontitis dichotomy in favour of a staging-and-
//     grading framework, superseding the 1999 classification as the agreed
//     standard.
//
// Community: INSTITUTIONAL (AAP/EFP consensus World Workshop).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-armitage-1999-periodontal-classification.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-armitage-1999-periodontal-classification.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply7yni01wlsaihbdbe0p45'

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

// Do NOT duplicate the existing null -> RECORDED (publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2018-06-01',
    datePrecision: 'MONTH',
    reason:
      'The 2017 World Workshop on the Classification of Periodontal and Peri-Implant Diseases and Conditions, co-sponsored by the American Academy of Periodontology and the European Federation of Periodontology, produced a new classification that explicitly superseded Armitage\'s 1999 scheme. Published June 2018 (Caton et al., "A new classification scheme for periodontal and peri-implant diseases and conditions – Introduction and key changes from the 1999 classification," J Clin Periodontol; DOI 10.1111/jcpe.12935), it discarded the 1999 chronic-vs-aggressive periodontitis dichotomy in favour of a multidimensional staging-and-grading framework. The 1999 classification thereby ceased to be the agreed standard of the field.',
    source: {
      externalId: 'src:jcpe-2018-new-periodontal-classification-12935',
      name:
        'Caton JG, Armitage G, Berglundh T, Chapple ILC, et al. A new classification scheme for periodontal and peri-implant diseases and conditions – Introduction and key changes from the 1999 classification. Journal of Clinical Periodontology 2018;45(Suppl 20):S1–S8.',
      url: 'https://doi.org/10.1111/jcpe.12935',
      publishedAt: '2018-06-01',
      methodologyType: 'primary',
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
