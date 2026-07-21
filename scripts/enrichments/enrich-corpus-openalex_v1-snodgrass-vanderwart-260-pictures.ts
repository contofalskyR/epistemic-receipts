// Enrichment: epistemic receipt for Snodgrass & Vanderwart (1980),
// "A standardized set of 260 pictures: Norms for name agreement, image
// agreement, familiarity, and visual complexity." J. Exp. Psychol.: Human
// Learning and Memory 6(2):174-215. DOI 10.1037/0278-7393.6.2.174.
// OpenAlex W2109616123. Claim id cmpm25t2u0k5dsadno8vt3xsa.
//
// Baseline row (fromAxis=null -> RECORDED at 1980 publication) already exists;
// this script adds only the post-publication transition.
//
// Post-publication event: Rossion & Pourtois (2004), "Revisiting Snodgrass and
// Vanderwart's Object Pictorial Set" (Perception 33(2):217-236,
// DOI 10.1068/p5117), independently re-collected norms on the full 260-item set
// for the same four variables — name agreement, image agreement, familiarity,
// and visual complexity — 24 years later, found high correlations with the
// original norms, and extended the set with colored/textured versions. This is
// a dated, citable revalidation that settles the set as the field-standard
// stimulus corpus. RECORDED -> SETTLED, EXPERT_LITERATURE.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-snodgrass-vanderwart-260-pictures.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-snodgrass-vanderwart-260-pictures.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmpm25t2u0k5dsadno8vt3xsa'

interface EnrichTransition {
  fromAxis: string
  toAxis: string
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: EnrichTransition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-02-01',
    datePrecision: 'MONTH',
    reason:
      'Rossion & Pourtois independently re-normed the full 260-item Snodgrass & Vanderwart set on the same four variables (name agreement, image agreement, familiarity, visual complexity) 24 years after the original, reporting high correlations with the 1980 norms and extending the set with colorized/textured versions. The revalidation confirmed the descriptive norms held up and cemented the set as the standard stimulus corpus for picture-processing experiments.',
    source: {
      externalId: 'src:rossion-pourtois-revisiting-snodgrass-vanderwart-2004',
      name: "Rossion B, Pourtois G. Revisiting Snodgrass and Vanderwart's Object Pictorial Set: The Role of Surface Detail in Basic-Level Object Recognition. Perception 2004;33(2):217-236.",
      url: 'https://doi.org/10.1068/p5117',
      publishedAt: '2004-02-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const slug = `${claimId}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`
    if (DRY_RUN) {
      console.log(`[dry-run] would upsert source ${t.source.externalId} and history ${slug}`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-corpus-openalex_v1',
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
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

    console.log(`Upserted transition ${t.fromAxis} -> ${t.toAxis} (${slug})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
