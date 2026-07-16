// Epistemic-receipt enrichment for claim cmplxl2jw0087sa7fsczkspbk
// "Cognitive and emotional influences in anterior cingulate cortex"
// Bush G, Luu P, Posner MI. Trends in Cognitive Sciences 2000;4(6):215-222.
// DOI: 10.1016/s1364-6613(00)01483-2 · OpenAlex: W2125823313
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 2000-06-01) already exists.
// This script adds the post-publication arc.
//
// Adjudicating event: Bush et al. proposed a functional dissociation of the ACC into a
// dorsal "cognitive" division and a rostral/ventral "affective" division. Shackman et al.
// (Nat Rev Neurosci 2011) meta-analytically reappraised this, arguing that cognitive
// control, negative affect and pain are anatomically INTEGRATED in the anterior
// midcingulate cortex rather than segregated — a direct, well-cited contest of the
// cognitive/emotional subdivision. => RECORDED -> CONTESTED.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bush-2000-acc-cognitive-emotional.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bush-2000-acc-cognitive-emotional.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmplxl2jw0087sa7fsczkspbk'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus | null
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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2011-02-18',
    datePrecision: 'DAY',
    reason:
      'Shackman AJ, Salomons TV, Slagter HA, Fox AS, Winter JJ, Davidson RJ. "The integration of negative affect, pain and cognitive control in the cingulate cortex" (Nature Reviews Neuroscience, advance online 18 Feb 2011; 12(3):154-167) meta-analytically reappraised the ACC. It argued that cognitive control, negative affect and pain are anatomically INTEGRATED in the anterior midcingulate cortex, directly contesting the dorsal-cognitive / rostral-affective functional dissociation that Bush, Luu & Posner had proposed. The reappraisal has itself been cited >1,700 times, marking a sustained expert-literature challenge to the strict subdivision.',
    source: {
      externalId: 'src:shackman-2011-cingulate-integration',
      name: 'Shackman AJ, et al. The integration of negative affect, pain and cognitive control in the cingulate cortex. Nature Reviews Neuroscience 2011;12(3):154-167.',
      url: 'https://doi.org/10.1038/nrn2994',
      publishedAt: '2011-02-18',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } })
  if (!claim) throw new Error(`Claim ${claimId} not found`)

  for (const tr of TRANSITIONS) {
    const histId = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
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
        ingestedBy: 'enrich:openalex_v1-bush-2000-acc',
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
        claimId: claim.id,
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: claim.id, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: claim.id, sourceId: source.id, type: 'AGAINST' } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
