// Enrichment: epistemic trajectory for Gibbons et al., "The New Production of
// Knowledge: The Dynamics of Science and Research in Contemporary Societies"
// (SAGE, 1994; Choice review DOI 10.5860/choice.32-4463, publ. 1995-04-01).
// OpenAlex W2048002078. claimId cmplzy7bf04e1sa86wrqi0qkc.
//
// This is the founding statement of the "Mode 2" knowledge-production thesis.
// It is a theoretical/conceptual work, so retraction, failed replication, and
// meta-analysis do not apply. What DID happen after publication is a sustained,
// prominent scholarly contestation of the thesis. The baseline row
// (fromAxis=null -> RECORDED at the 1995-04-01 review date) already exists and
// is NOT recreated here.
//
// Arc added: RECORDED -> CONTESTED (2002-08) via Terry Shinn's landmark critique
// in Social Studies of Science, "The Triple Helix and New Production of
// Knowledge: Prepackaged Thinking on Science and Technology" (291+ citations),
// which argued the Mode 2 framework was empirically underpowered "prepackaged
// thinking." The thesis remained contested rather than resolving to consensus —
// the authors themselves responded with "'Mode 2' Revisited" (Minerva, 2003) —
// so the arc honestly terminates at CONTESTED, with no SETTLED/REVERSED step.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-gibbons-1994-new-production-of-knowledge.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-gibbons-1994-new-production-of-knowledge.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplzy7bf04e1sa86wrqi0qkc'

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

interface Arc {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const ARCS: Arc[] = [
  // ── RECORDED -> CONTESTED: Shinn 2002 critique ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-08-01',
    datePrecision: 'MONTH',
    reason:
      'Terry Shinn, "The Triple Helix and New Production of Knowledge: Prepackaged Thinking on Science and Technology" (Social Studies of Science, Aug 2002), delivered a prominent, widely cited critique of the Mode 2 thesis, arguing it was empirically thin and conflated normative advocacy with description. Together with adjacent critiques it moved the Mode 2 claim from an accepted framing into open scholarly contestation; the original authors felt compelled to defend it in "\'Mode 2\' Revisited" (Minerva, 2003), confirming the dispute rather than resolving it.',
    source: {
      externalId: 'src:shinn-2002-triple-helix-mode2-critique',
      name: 'Shinn T. The Triple Helix and New Production of Knowledge: Prepackaged Thinking on Science and Technology. Social Studies of Science. 2002;32(4):599–614.',
      url: 'https://doi.org/10.1177/0306312702032004004',
      publishedAt: '2002-08-01',
      methodologyType: 'opinion',
    },
  },
]

async function main() {
  console.log(
    `[enrich] claim ${CLAIM_ID} — Gibbons et al. "The New Production of Knowledge" (Mode 2)`,
  )
  console.log(`[enrich] ${ARCS.length} transition(s) to upsert${DRY_RUN ? ' (DRY RUN)' : ''}`)

  for (const arc of ARCS) {
    const slug = `${CLAIM_ID}-${arc.toAxis}-${arc.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(
        `  would upsert source ${arc.source.externalId} + history ${slug} (${arc.fromAxis} -> ${arc.toAxis} @ ${arc.occurredAt})`,
      )
      continue
    }

    // 1) Source (marker artifact) first, so we can link it.
    const source = await prisma.source.upsert({
      where: { externalId: arc.source.externalId },
      create: {
        externalId: arc.source.externalId,
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
        ingestedBy: 'enrichment',
        humanReviewed: true,
      },
      update: {
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
      },
    })

    // 2) ClaimStatusHistory row keyed on the deterministic slug id.
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        reason: arc.reason,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        reason: arc.reason,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`  upserted ${slug} (${arc.fromAxis} -> ${arc.toAxis} @ ${arc.occurredAt})`)
  }

  console.log('[enrich] done')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
