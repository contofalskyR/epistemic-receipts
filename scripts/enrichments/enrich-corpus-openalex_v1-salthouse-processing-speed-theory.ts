// Enrichment: post-publication epistemic trajectory for
// "The processing-speed theory of adult age differences in cognition"
// Salthouse TA. Psychological Review 1996;103(3):403–428.
// DOI 10.1037/0033-295x.103.3.403 · OpenAlex W2039752037
//
// Salthouse's processing-speed theory proposes that increased adult age reduces
// the speed of many processing operations, and that this slowing degrades fluid
// (Type-A) cognition via the "limited time" and "simultaneity" mechanisms.
//
// Baseline RECORDED transition (fromAxis=null -> RECORDED at 1996-01-01) already
// exists and is NOT duplicated here.
//
// Post-publication events added:
//   RECORDED -> SETTLED (1997-11, EXPERT_LITERATURE)
//     Verhaeghen & Salthouse's Psychological Bulletin meta-analysis synthesized
//     the adult age–cognition literature and, via meta-analytic structural
//     equation models across many independent samples, showed that processing
//     speed statistically mediates the large majority of age-related variance in
//     fluid/Type-A measures (reasoning, memory, spatial ability). This is the
//     canonical quantitative consolidation that gave the speed theory its
//     empirical footing. Verhaeghen P, Salthouse TA. Psychological Bulletin
//     1997;122(3):231–249. DOI 10.1037/0033-2909.122.3.231.
//
//   SETTLED -> CONTESTED (2004-06, EXPERT_LITERATURE)
//     Ratcliff, Thapar, Gomez & McKoon applied diffusion-model decomposition to
//     age differences in choice reaction time and found older adults' slower
//     responses arise mainly from more conservative decision boundaries and
//     slower non-decision (encoding/motor) time, while drift rate — the actual
//     rate of evidence accumulation — is often comparatively preserved. This
//     challenged the theory's core mechanistic claim that a global reduction in
//     the speed of processing operations drives age-related impairment.
//     Ratcliff R, Thapar A, Gomez P, McKoon G. "A Diffusion Model Analysis of
//     the Effects of Aging in the Lexical-Decision Task." Psychology and Aging
//     2004;19(2):278–289. DOI 10.1037/0882-7974.19.2.278.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-salthouse-processing-speed-theory.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmply0x0z07sdsa7fgqmzmivo'

async function main() {
  // ── RECORDED -> SETTLED : Verhaeghen & Salthouse meta-analysis (1997) ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:verhaeghen-salthouse-meta-analyses-age-cognition-1997' },
    create: {
      externalId: 'src:verhaeghen-salthouse-meta-analyses-age-cognition-1997',
      name: 'Verhaeghen P, Salthouse TA. "Meta-analyses of age–cognition relations in adulthood: Estimates of linear and nonlinear age effects and structural models." Psychological Bulletin 1997;122(3):231–249.',
      url: 'https://doi.org/10.1037/0033-2909.122.3.231',
      publishedAt: new Date('1997-11-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:corpus-openalex_v1',
    },
    update: {
      name: 'Verhaeghen P, Salthouse TA. "Meta-analyses of age–cognition relations in adulthood: Estimates of linear and nonlinear age effects and structural models." Psychological Bulletin 1997;122(3):231–249.',
      url: 'https://doi.org/10.1037/0033-2909.122.3.231',
      publishedAt: new Date('1997-11-01'),
    },
  })

  {
    const occurredAt = new Date('1997-11-01')
    const slug = `${claimId}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`
    const reason =
      'Verhaeghen and Salthouse\'s meta-analysis in Psychological Bulletin synthesized results across the adult age–cognition literature and, using meta-analytic structural equation models, showed that processing speed statistically mediates the large majority of age-related variance in fluid/Type-A cognitive measures such as reasoning, episodic memory, and spatial ability. This quantitative consolidation across many independent samples established speed as the dominant proximal correlate of adult cognitive aging and gave the processing-speed theory its empirical footing in the field.'

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason,
        sourceId: settleSource.id,
      },
      update: {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason,
        sourceId: settleSource.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId, sourceId: settleSource.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: settleSource.id, type: 'FOR' } })
    }
  }

  // ── SETTLED -> CONTESTED : Ratcliff et al. diffusion-model analysis (2004) ──
  const contestSource = await prisma.source.upsert({
    where: { externalId: 'src:ratcliff-thapar-gomez-mckoon-diffusion-aging-lexical-2004' },
    create: {
      externalId: 'src:ratcliff-thapar-gomez-mckoon-diffusion-aging-lexical-2004',
      name: 'Ratcliff R, Thapar A, Gomez P, McKoon G. "A Diffusion Model Analysis of the Effects of Aging in the Lexical-Decision Task." Psychology and Aging 2004;19(2):278–289.',
      url: 'https://doi.org/10.1037/0882-7974.19.2.278',
      publishedAt: new Date('2004-06-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:corpus-openalex_v1',
    },
    update: {
      name: 'Ratcliff R, Thapar A, Gomez P, McKoon G. "A Diffusion Model Analysis of the Effects of Aging in the Lexical-Decision Task." Psychology and Aging 2004;19(2):278–289.',
      url: 'https://doi.org/10.1037/0882-7974.19.2.278',
      publishedAt: new Date('2004-06-01'),
    },
  })

  {
    const occurredAt = new Date('2004-06-01')
    const slug = `${claimId}-CONTESTED-${occurredAt.toISOString().slice(0, 10)}`
    const reason =
      'Ratcliff, Thapar, Gomez and McKoon applied diffusion-model decomposition to age differences in choice reaction time and found that older adults\' slower responses arise mainly from more conservative decision boundaries and slower non-decision (encoding/motor) time, while the drift rate — the actual rate of evidence accumulation — is often comparatively preserved. This challenged the theory\'s central mechanistic claim that a global reduction in the speed of processing operations drives age-related cognitive impairment, reframing "general slowing" as partly a strategic and peripheral phenomenon rather than a unitary loss of processing speed.'

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason,
        sourceId: contestSource.id,
      },
      update: {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason,
        sourceId: contestSource.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId, sourceId: contestSource.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: contestSource.id, type: 'AGAINST' } })
    }
  }

  console.log(
    `  ✓ enriched ${claimId} (+2 transitions: RECORDED -> SETTLED 1997-11, SETTLED -> CONTESTED 2004-06)`,
  )
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
