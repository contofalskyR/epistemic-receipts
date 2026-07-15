// Enrichment: epistemic trajectory for Nisbett, R. E., & Wilson, T. D. (1977),
// "Telling more than we can know: Verbal reports on mental processes."
// Psychological Review, 84(3), 231–259. DOI 10.1037/0033-295X.84.3.231.
// OpenAlex W2164558494. Claim id cmplxpu5j02k7sa7fdwm4kbp5.
//
// The paper argued that people have little or no direct introspective access to
// the higher-order cognitive processes mediating their behavior, and that verbal
// self-reports about those processes are often confabulated. It became one of the
// most-cited papers in psychology.
//
// Post-publication event (verified): in 1980, the same journal (Psychological
// Review) carried two direct, dated challenges. (1) K. A. Ericsson & H. A. Simon,
// "Verbal reports as data" (Psychological Review 87(3), 215–251;
// DOI 10.1037/0033-295X.87.3.215) mounted the major methodological rebuttal,
// arguing that verbal reports elicited under the right conditions (concurrent
// think-aloud on information in short-term memory) ARE valid data on cognition —
// directly contesting Nisbett & Wilson's pessimistic conclusion. (2) P. White,
// "Limitations on verbal reports of internal events: A refutation of Nisbett and
// Wilson and of Bem" (Psychological Review 87(1), 105–112;
// DOI 10.1037/0033-295X.87.1.105) explicitly framed itself as a refutation.
// Together these establish that the finding became actively CONTESTED in the
// expert literature in 1980. (No adjudicating meta-analysis has since settled the
// dispute, and the paper is not retracted — so no SETTLED/REVERSED arc is added.)
//
// The claim already has its baseline null -> RECORDED first entry at the 1977
// publication date. This script adds only the single downstream arc:
//   RECORDED -> CONTESTED (1980, YEAR precision): 1980 wave of direct rebuttals.
//
// Community: EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nisbett-wilson-telling-more-than-we-can-know.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nisbett-wilson-telling-more-than-we-can-know.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxpu5j02k7sa7fdwm4kbp5'

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

// Do NOT duplicate the existing null -> RECORDED (1977 publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1980-01-01',
    datePrecision: 'YEAR',
    reason:
      'In 1980 the same journal, Psychological Review, carried two direct, dated challenges to Nisbett & Wilson (1977). K. A. Ericsson & H. A. Simon, "Verbal reports as data" (Psychological Review 87(3), 215–251), mounted the major methodological rebuttal, arguing that verbal reports collected as concurrent think-aloud protocols over information in short-term memory are a valid source of data on cognitive processes — directly contesting the paper\'s claim that introspective reports are systematically uninformative. In the same volume, P. White\'s "Limitations on verbal reports of internal events: A refutation of Nisbett and Wilson and of Bem" (Psychological Review 87(1), 105–112) explicitly presented itself as a refutation. The finding thus became actively contested in the expert literature in 1980; the dispute over introspective access has never been closed by an adjudicating meta-analysis.',
    source: {
      externalId: 'src:ericsson-simon-verbal-reports-as-data-1980',
      name:
        'Ericsson, K. A., & Simon, H. A. (1980). Verbal reports as data. Psychological Review, 87(3), 215–251. Companion refutation the same year: White, P. (1980). Limitations on verbal reports of internal events: A refutation of Nisbett and Wilson and of Bem. Psychological Review, 87(1), 105–112 (DOI 10.1037/0033-295X.87.1.105).',
      url: 'https://doi.org/10.1037/0033-295x.87.3.215',
      publishedAt: '1980-05-01',
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
