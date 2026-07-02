// Enrichment: epistemic trajectory for
//   Fang Z, Yang C, Song X (2022) "How Do Green Finance and Energy Efficiency
//   Mitigate Carbon Emissions Without Reducing Economic Growth in G7 Countries?"
//   Frontiers in Psychology 13:879741. DOI 10.3389/fpsyg.2022.879741
//
// The corpus claim (caf86995-...) is the verbatim Frontiers RETRACTION notice for
// the article above. Its already-seeded first entry (fromAxis=null -> RECORDED,
// dated to the 2025-08-07 ingestion of the retraction work) is a data artifact of
// how OpenAlex indexed the retraction notice. This script reconstructs the real
// underlying trajectory of the retracted research:
//
//   OPEN -> RECORDED (2022): the original research article was published and entered
//     the literature as Front. Psychol. 13:879741.
//   RECORDED -> REVERSED (2025-08-07): Frontiers retracted the article. The
//     Research Integrity Auditing team uncovered a network of authors and editors
//     who ran peer review with undisclosed conflicts of interest and manipulated
//     the process; the finding was withdrawn from the record.
//
// No independently datable CONTESTED step (e.g., a published critique or expression
// of concern) could be verified, so none is asserted — the arc goes publication ->
// institutional retraction.
//
// URL note: live web fetch was unavailable in the authoring session. The DOI
// 10.3389/fpsyg.2022.879741 is taken directly from the retraction notice text of the
// claim itself and resolves to the (now-retracted) article record at Frontiers.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-green-finance-energy-efficiency-g7-retraction.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-green-finance-energy-efficiency-g7-retraction.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'caf86995-f504-4e7f-9ff5-3683ac32b08d'

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

// Do NOT duplicate the existing null -> RECORDED first entry (dated 2025-08-07).
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2022-01-01',
    datePrecision: 'YEAR',
    reason:
      'The original research article — Fang, Yang & Song, "How Do Green Finance and Energy Efficiency Mitigate Carbon Emissions Without Reducing Economic Growth in G7 Countries?" — was published in Frontiers in Psychology, volume 13, article 879741, entering the peer-reviewed literature in 2022 (DOI 10.3389/fpsyg.2022.879741). Volume 13 of Frontiers in Psychology corresponds to the 2022 publication year; day/month precision is not asserted.',
    source: {
      externalId: 'src:fang-2022-green-finance-g7-fpsyg',
      name:
        'Fang Z, Yang C, Song X (2022). How Do Green Finance and Energy Efficiency Mitigate Carbon Emissions Without Reducing Economic Growth in G7 Countries? Frontiers in Psychology 13:879741.',
      url: 'https://doi.org/10.3389/fpsyg.2022.879741',
      publishedAt: '2022-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2025-08-07',
    datePrecision: 'DAY',
    reason:
      'Frontiers retracted the 2022 article. The publisher\'s Research Integrity Auditing team investigated and uncovered a network of authors and editors who conducted peer review with undisclosed conflicts of interest and engaged in manipulation of the editorial process. On these grounds the journal withdrew the article from the scholarly record — an institutional reversal of the finding rather than a scientific refutation of its content.',
    source: {
      externalId: 'src:fang-2022-green-finance-g7-retraction',
      name:
        'Retraction: "How Do Green Finance and Energy Efficiency Mitigate Carbon Emissions Without Reducing Economic Growth in G7 Countries?" Frontiers in Psychology, 7 Aug 2025 (retracting 10.3389/fpsyg.2022.879741).',
      url: 'https://doi.org/10.3389/fpsyg.2022.879741',
      publishedAt: '2025-08-07',
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
