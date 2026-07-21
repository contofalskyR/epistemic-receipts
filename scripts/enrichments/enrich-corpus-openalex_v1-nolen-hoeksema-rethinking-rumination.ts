// Enrichment: epistemic trajectory for "Rethinking Rumination"
// (Nolen-Hoeksema, Wisco & Lyubomirsky, 2008), Perspectives on Psychological Science.
// Claim id: cmpm13eez028jsadn4p405aps  ·  DOI 10.1111/j.1745-6924.2008.00088.x  ·  OpenAlex W4211130665
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the 2008-09
// publication date) already exists — this script does NOT duplicate it.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2013-09) — Olatunji, Naragon-Gainey & Wolitzky-Taylor's
//   independent multimodal meta-analysis "Specificity of Rumination in Anxiety and
//   Depression" adjudicated the review's core supported claim, confirming a robust
//   association between rumination and depression across self-report and behavioral
//   modalities (while showing the link is transdiagnostic rather than depression-specific).
//   There was no prior dated contest event, so this is RECORDED -> SETTLED directly.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nolen-hoeksema-rethinking-rumination.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nolen-hoeksema-rethinking-rumination.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm13eez028jsadn4p405aps'

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
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2013-09-01',
    datePrecision: 'MONTH',
    reason:
      'Olatunji, Naragon-Gainey & Wolitzky-Taylor published an independent multimodal meta-analysis ("Specificity of Rumination in Anxiety and Depression," Clinical Psychology: Science and Practice, Sept 2013) that adjudicated the review\'s core supported claim. It confirmed a robust, replicable association between rumination and depression across self-report and behavioral measures, vindicating the central rumination–depression link of response styles theory. It refined the picture by showing the association is transdiagnostic (also elevated in anxiety) rather than specific to depression, but did not overturn the finding.',
    source: {
      externalId: 'src:olatunji-rumination-meta-analysis-2013',
      name: 'Olatunji BO, Naragon-Gainey K, Wolitzky-Taylor KB. Specificity of Rumination in Anxiety and Depression: A Multimodal Meta-Analysis. Clinical Psychology: Science and Practice. 2013;20(3):225–257.',
      url: 'https://doi.org/10.1111/cpsp.12037',
      publishedAt: '2013-09-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} post-publication transition(s)${DRY_RUN ? ' (DRY RUN)' : ''}`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  would upsert source ${tr.source.externalId}`)
      console.log(`  would upsert history ${slug}: ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.datePrecision})`)
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
        ingestedBy: 'enrich:openalex_v1-nolen-hoeksema-rethinking-rumination',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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

    console.log(`  ✓ ${slug}: ${tr.fromAxis} -> ${tr.toAxis} (source ${source.id})`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
