// Epistemic-receipt enrichment for claim cmplxm4ai00p7sa7fi07m3ulj
// Schachter, S. & Singer, J. E. (1962). "Cognitive, social, and physiological
// determinants of emotional state." Psychological Review, 69(5), 379–399.
// DOI 10.1037/h0046234 · OpenAlex W2061131717 · the two-factor theory of emotion.
//
// Post-publication arc (baseline fromAxis=null -> RECORDED at 1962-09-01 already exists):
//   RECORDED -> CONTESTED (1979-06): Marshall & Zimbardo and Maslach publish direct
//     failed replications of the arousal-labeling manipulation in the same volume of JPSP.
//   CONTESTED -> REVERSED (1983): Reisenzein's Psychological Bulletin review adjudicates
//     two decades of evidence and finds the core emotional-plasticity claim unsupported.
//
// Idempotent: upserts source on externalId, status rows on deterministic slug id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-schachter-singer-two-factor-emotion.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-schachter-singer-two-factor-emotion.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmplxm4ai00p7sa7fi07m3ulj'

interface Transition {
  fromAxis: 'RECORDED' | 'CONTESTED'
  toAxis: 'CONTESTED' | 'REVERSED'
  community: 'EXPERT_LITERATURE'
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

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1979-06-01',
    datePrecision: 'MONTH',
    reason:
      "Marshall & Zimbardo (1979), 'Affective consequences of inadequately explained physiological arousal' (JPSP 37(6):970–988), reported that epinephrine-injected subjects given no explanation for their arousal did not show the emotional plasticity Schachter & Singer had claimed — if anything they biased negative. In the same JPSP volume, Maslach (1979), 'Negative emotional biasing of unexplained arousal' (37(6):953–969), independently found the same negative bias. These two direct failed replications of the euphoria/anger manipulation moved the finding into active dispute.",
    source: {
      externalId: 'src:marshall-zimbardo-1979-arousal-replication',
      name: 'Marshall, G. D. & Zimbardo, P. G. (1979). Affective consequences of inadequately explained physiological arousal. Journal of Personality and Social Psychology, 37(6), 970–988.',
      url: 'https://doi.org/10.1037/0022-3514.37.6.970',
      publishedAt: '1979-06-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1983-01-01',
    datePrecision: 'YEAR',
    reason:
      "Reisenzein (1983), 'The Schachter theory of emotion: Two decades later' (Psychological Bulletin 94(2):239–264), reviewed twenty years of replication attempts and concluded that the central Schachter–Singer claim — that undifferentiated arousal is cognitively labeled into qualitatively distinct emotions (emotional plasticity of arousal) — was not empirically supported, the original 1962 experiment had never been cleanly replicated, and only a weaker 'arousal intensifies existing emotion' residue survived. This adjudicating review overturned the specific 1962 differentiation finding.",
    source: {
      externalId: 'src:reisenzein-1983-schachter-two-decades',
      name: 'Reisenzein, R. (1983). The Schachter theory of emotion: Two decades later. Psychological Bulletin, 94(2), 239–264.',
      url: 'https://doi.org/10.1037/0033-2909.94.2.239',
      publishedAt: '1983-01-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const slug = `${claimId}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source upsert ${t.source.externalId}`)
      console.log(`[dry-run] status  ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt}  id=${slug}`)
      continue
    }

    await prisma.source.upsert({
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
        markerSource: { connect: { externalId: t.source.externalId } },
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        markerSource: { connect: { externalId: t.source.externalId } },
      },
    })

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt}  id=${slug}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
