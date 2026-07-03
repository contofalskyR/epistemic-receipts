// Enrichment: epistemic trajectory for the retraction of the Ag-decorated
// zinc-ferrite nanoparticle antibacterial/antibiofilm paper (RSC Adv. 2021).
//
// Claim: 3710d09e-1497-4067-9552-9431a02a0215
//   "Retraction of 'Antibacterial and antibiofilm activities of silver-decorated
//    zinc ferrite nanoparticles ...' by M. I. A. Abdel Maksoud et al.,
//    RSC Adv., 2021, 11, 28361-28374, https://doi.org/10.1039/D1RA04785J."
//
// The claim record IS the retraction notice. Its underlying finding — the
// reported antibacterial/antibiofilm activity — entered the literature as a
// RECORDED result in 2021 and was subsequently REVERSED when the Royal Society
// of Chemistry retracted the article (indexed 2025). The existing first status
// entry (fromAxis=null -> RECORDED) is NOT duplicated here; this adds only the
// RECORDED -> REVERSED reversal.
//
// Source URL is the original article DOI asserted in the claim text
// (10.1039/D1RA04785J), which resolves to the RSC article page now carrying the
// retraction banner. No separate retraction-notice DOI is fabricated.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-agnzn-ferrite-retraction.ts
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = '3710d09e-1497-4067-9552-9431a02a0215'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
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
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // RECORDED -> REVERSED : the Royal Society of Chemistry retracts the article.
  {
    fromAxis: 'RECORDED',
    toAxis: 'REVERSED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2025-01-01',
    datePrecision: 'YEAR',
    reason:
      "The Royal Society of Chemistry retracted 'Antibacterial and antibiofilm activities of silver-decorated zinc ferrite nanoparticles synthesized by a gamma irradiation-coupled sol-gel method against some pathogenic bacteria from medical operating room surfaces' (M. I. A. Abdel Maksoud et al., RSC Adv., 2021, 11, 28361-28374, doi:10.1039/D1RA04785J). The retraction notice — indexed 2025 — withdraws the reported antibacterial/antibiofilm findings from the scholarly record, reversing the result the 2021 article had placed in the literature.",
    source: {
      externalId: 'src:retraction-d1ra04785j-2025',
      name: "Retraction: Antibacterial and antibiofilm activities of silver-decorated zinc ferrite nanoparticles (RSC Adv., 2021, 11, 28361-28374)",
      url: 'https://doi.org/10.1039/D1RA04785J',
      publishedAt: '2025-01-01',
      methodologyType: 'primary',
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
        ingestedBy: 'enrich:openalex_v1-agnzn-ferrite-retraction',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`Upserted transition ${tr.fromAxis} -> ${tr.toAxis} (${histId})`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
