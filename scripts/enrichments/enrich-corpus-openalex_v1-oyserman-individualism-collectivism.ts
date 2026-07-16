// Epistemic enrichment: Oyserman, Coon & Kemmelmeier (2002),
// "Rethinking individualism and collectivism: Evaluation of theoretical
// assumptions and meta-analyses," Psychological Bulletin 128(1):3–72.
// DOI 10.1037/0033-2909.128.1.3 · OpenAlex W2055684847 · claim cmpm21p8s0i7psadnbjvsxe4y
//
// Baseline row (fromAxis=null -> RECORDED at 2002-01-01) already exists; not duplicated.
//
// Post-publication arc:
//   RECORDED -> CONTESTED (2002-01): In the SAME January 2002 issue of Psychological
//   Bulletin, Alan Page Fiske published a direct methodological critique of the
//   validity and measurement of the individualism/collectivism constructs on which
//   the finding rests (Psychol Bull 128(1):78–88, doi:10.1037/0033-2909.128.1.78).
//   A companion comment by Joan Miller (128(1):97–109) reinforced the contest.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-oyserman-individualism-collectivism.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-oyserman-individualism-collectivism.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmpm21p8s0i7psadnbjvsxe4y'

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
    occurredAt: '2002-01-01',
    datePrecision: 'MONTH',
    reason:
      'In the same January 2002 issue of Psychological Bulletin that carried the target article, Alan Page Fiske published "Using individualism and collectivism to compare cultures—a critique of the validity and measurement of the constructs" (128(1):78–88), arguing that the IND-COL constructs treat nations as cultures, conflate distinct social relations and forms of autonomy, and rarely establish external validity—directly contesting the measurement foundations of the finding that European Americans are more individualistic and less collectivistic. A companion comment by Joan Miller ("Bringing culture to basic psychological theory—beyond individualism and collectivism") reinforced the critique in the same issue.',
    source: {
      externalId: 'src:fiske-2002-individualism-collectivism-critique',
      name: 'Fiske AP. Using individualism and collectivism to compare cultures—a critique of the validity and measurement of the constructs: comment on Oyserman et al. (2002). Psychol Bull. 2002 Jan;128(1):78–88. doi:10.1037/0033-2909.128.1.78. PMID 11843549.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/11843549/',
      publishedAt: '2002-01-01',
      methodologyType: 'opinion',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${claimId} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const tr of TRANSITIONS) {
    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${slug} — ${tr.fromAxis ?? 'null'} -> ${tr.toAxis} (${tr.source.externalId})`)
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
        ingestedBy: 'enrich:openalex_v1-oyserman-individualism-collectivism',
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
        claimId,
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

    console.log(`  ✓ ${slug}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
