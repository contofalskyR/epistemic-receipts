// Epistemic-receipt enrichment for claim cmq2w4ypn00lfsa8hwk0ia10o
// "Observation of a single-beam gradient force optical trap for dielectric
//   particles" — Ashkin A, Dziedzic JM, Bjorkholm JE, Chu S. Optics Letters
//   11(5):288–290 (May 1986). First demonstration of the single-beam gradient
//   force trap — the invention of "optical tweezers."
//   DOI: 10.1364/ol.11.000288 · OpenAlex W2113372755
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 1986-05-01) already
// exists — do NOT duplicate it. This script adds the post-publication arc.
//
// Post-publication finding:
//   No retraction, expression of concern, failed replication, or methodological
//   reversal exists — the finding was, if anything, the opposite. The
//   single-beam gradient force trap Ashkin reported in this 1986 paper became
//   the standard tool of the field ("optical tweezers"), and on 2 October 2018
//   the Royal Swedish Academy of Sciences awarded Arthur Ashkin one half of the
//   Nobel Prize in Physics 2018 "for the optical tweezers and their application
//   to biological systems." The Nobel citation and its Scientific Background
//   name this invention directly, ratifying the original claim at the highest
//   institutional level. This supports one transition: RECORDED -> SETTLED,
//   community INSTITUTIONAL, at the Nobel announcement date.
//   (There was never a contested phase; the result was never seriously
//   challenged, so no RECORDED->CONTESTED transition is seeded.)
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ashkin-1986-optical-trap.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ashkin-1986-optical-trap.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

const CLAIM_ID = 'cmq2w4ypn00lfsa8hwk0ia10o'

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
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2018-10-02',
    datePrecision: 'DAY',
    reason:
      'On 2 October 2018 the Royal Swedish Academy of Sciences awarded one half of the Nobel Prize in Physics 2018 to Arthur Ashkin "for the optical tweezers and their application to biological systems." The single-beam gradient force trap first demonstrated in this 1986 Optics Letters paper is precisely the invention being honoured — the Nobel citation and its Scientific Background identify this work as the invention of optical tweezers. The prize ratifies the original claim at the highest institutional level. No retraction, failed replication, or methodological reversal exists; optical trapping over the 10 µm to ~25 nm range is settled physics and optical tweezers are now a standard laboratory tool.',
    source: {
      externalId: 'src:nobel-physics-2018-ashkin-optical-tweezers',
      name: 'The Nobel Prize in Physics 2018 — press release, Royal Swedish Academy of Sciences (2 October 2018): one half to Arthur Ashkin "for the optical tweezers and their application to biological systems."',
      url: 'https://www.nobelprize.org/prizes/physics/2018/press-release/',
      publishedAt: '2018-10-02',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source upsert: ${tr.source.externalId}`)
      console.log(`[dry-run] history upsert: ${histId} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
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
        ingestedBy: 'enrich:openalex_v1-ashkin-1986-optical-trap',
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

    console.log(`✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
