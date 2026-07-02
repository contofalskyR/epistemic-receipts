// Enrichment: epistemic trajectory for an OpenAlex-ingested claim — the opening
// abstract of a paper on classifying lung diseases (LGDs: pneumonia, lung cancer,
// tuberculosis, COVID-19) from medical imaging (X-ray/CT/MRI), typically via a
// deep-learning classifier.
//
// Claim: '9eac8ef7-468f-4f24-95c1-b2159ec4cc35' ("Lung diseases (LGDs) are related
// to an extensive range of lung disorders, including pneumonia (PNEUM), lung
// cancer (LC), tuberculosis (TB), and COVID-19 etc. ..."), published 2025-08-08,
// ingestedBy openalex_v1.
//
// The claim already has its OPEN/null -> RECORDED first entry (the article itself,
// 2025-08-08). This script adds the downstream failure arc:
//
//   RECORDED -> REVERSED (2025-08-09): The article was withdrawn/retracted at the
//     request of the authors under Elsevier's article-withdrawal policy. The
//     withdrawal notice — captured in the same OpenAlex corpus as a distinct record
//     (claim id '83c44171-eb04-497a-8baa-69f9a229c2e3', ingested 2025-08-09) —
//     states: "This article is retracted at the request of the Authors. Following
//     publication of this article, the authors found significant errors in model
//     selection and data processing that affected the results and conclusions.
//     After correcting the errors, key findings remain, but some conclusions are no
//     longer reliable, and most figures need updating." Because the reported
//     results and several conclusions are disavowed by the authors themselves, the
//     recorded finding is reversed rather than merely contested.
//
// Source anchoring: the withdrawal notice cites Elsevier's canonical article-
// withdrawal policy page verbatim; that stable URL is used as the marker artifact.
// Web-search/fetch tools were unavailable in the enrichment environment, so the
// specific host-journal DOI could not be independently confirmed and is not cited
// (per project rule: no unverifiable identifiers from model memory). The arc rests
// on the two co-ingested OpenAlex records (paper + author-requested withdrawal).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lung-diseases-lgd-classification-retracted.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lung-diseases-lgd-classification-retracted.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = '9eac8ef7-468f-4f24-95c1-b2159ec4cc35'

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

// Do NOT duplicate the existing null -> RECORDED first entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'REVERSED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2025-08-09',
    datePrecision: 'DAY',
    reason:
      "The article was retracted/withdrawn at the request of the authors under Elsevier's article-withdrawal policy, one day after appearing. The withdrawal notice (a distinct OpenAlex record in the same corpus, ingested 2025-08-09) states that following publication the authors found significant errors in model selection and data processing that affected the results and conclusions; after correcting the errors some conclusions were no longer reliable and most figures required updating. Because the reported empirical results and several conclusions of the lung-disease classification study were disavowed by the authors themselves, the recorded finding is reversed by the scholarly literature's self-correction mechanism.",
    source: {
      externalId: 'src:lgd-classification-elsevier-author-withdrawal-2025',
      name:
        'Retraction/withdrawal notice (author-requested) for the lung-disease (LGD) classification article, per Elsevier policy on article withdrawal: "the authors found significant errors in model selection and data processing that affected the results and conclusions ... some conclusions are no longer reliable, and most figures need updating." (OpenAlex record, 2025-08-09.)',
      url: 'https://www.elsevier.com/about/policies-and-standards/article-withdrawal',
      publishedAt: '2025-08-09',
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
