// Enrichment: post-publication trajectory for Baddeley (1992),
// "Working Memory", Science 255(5044):556-559.
// Claim: cmplxvd7e056dsa7f97jeexhe (openalex_v1, W4213346165)
//
// Baseline ClaimStatusHistory row (null -> RECORDED at 1992-01-31) already exists.
// The claim states the three-subcomponent model of working memory (central
// executive + visuospatial sketchpad + phonological loop). This script adds the
// two verified post-publication adjudications of that specific tripartite claim:
//
//   RECORDED -> CONTESTED (2000-11) — Baddeley, "The episodic buffer: a new
//     component of working memory?" (Trends in Cognitive Sciences 4:417-423),
//     which argued the three-component structure was incomplete and proposed a
//     fourth component to account for cross-subsystem integration, chunking, and
//     the influence of long-term memory on immediate recall.
//   CONTESTED -> SETTLED (2012-01-10) — Baddeley, "Working Memory: Theories,
//     Models, and Controversies" (Annual Review of Psychology 63:1-29), the
//     canonical review consolidating the matured multicomponent model as the
//     field-standard framework of working memory.
//
// No retraction or expression of concern exists. Both adjudications are by the
// original author; this is a documented revision-then-consolidation of the model,
// not an overturn.
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-working-memory-baddeley.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxvd7e056dsa7f97jeexhe'

async function main() {
  // ── RECORDED -> CONTESTED: 2000 episodic-buffer paper finds the tripartite model incomplete ──
  await prisma.source.upsert({
    where: { externalId: 'src:baddeley-episodic-buffer-2000' },
    create: {
      externalId: 'src:baddeley-episodic-buffer-2000',
      name: 'Baddeley, A. D. (2000), "The episodic buffer: a new component of working memory?", Trends in Cognitive Sciences 4(11):417-423',
      url: 'https://doi.org/10.1016/S1364-6613(00)01538-2',
      publishedAt: new Date('2000-11-01'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Baddeley, A. D. (2000), "The episodic buffer: a new component of working memory?", Trends in Cognitive Sciences 4(11):417-423',
      url: 'https://doi.org/10.1016/S1364-6613(00)01538-2',
      publishedAt: new Date('2000-11-01'),
      methodologyType: 'derivative',
    },
  })

  {
    const occurredAt = new Date('2000-11-01')
    const slug = `${CLAIM_ID}-CONTESTED-${occurredAt.toISOString().slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason:
          'In "The episodic buffer: a new component of working memory?" (Trends in Cognitive Sciences, Nov 2000), Baddeley argued that the original three-subcomponent structure asserted in the 1992 claim could not account for how information from the phonological loop and visuospatial sketchpad is integrated, for chunking in immediate recall, or for the influence of long-term memory on it. He therefore proposed a fourth component (the episodic buffer). This is a dated, explicit finding that the specific tripartite claim was incomplete and required revision.',
        sourceExternalId: 'src:baddeley-episodic-buffer-2000',
      },
      update: {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason:
          'In "The episodic buffer: a new component of working memory?" (Trends in Cognitive Sciences, Nov 2000), Baddeley argued that the original three-subcomponent structure asserted in the 1992 claim could not account for how information from the phonological loop and visuospatial sketchpad is integrated, for chunking in immediate recall, or for the influence of long-term memory on it. He therefore proposed a fourth component (the episodic buffer). This is a dated, explicit finding that the specific tripartite claim was incomplete and required revision.',
        sourceExternalId: 'src:baddeley-episodic-buffer-2000',
      },
    })
  }

  // ── CONTESTED -> SETTLED: 2012 Annual Review consolidates the matured multicomponent model ──
  await prisma.source.upsert({
    where: { externalId: 'src:baddeley-working-memory-annurev-2012' },
    create: {
      externalId: 'src:baddeley-working-memory-annurev-2012',
      name: 'Baddeley, A. D. (2012), "Working Memory: Theories, Models, and Controversies", Annual Review of Psychology 63:1-29',
      url: 'https://doi.org/10.1146/annurev-psych-120710-100422',
      publishedAt: new Date('2012-01-10'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Baddeley, A. D. (2012), "Working Memory: Theories, Models, and Controversies", Annual Review of Psychology 63:1-29',
      url: 'https://doi.org/10.1146/annurev-psych-120710-100422',
      publishedAt: new Date('2012-01-10'),
      methodologyType: 'derivative',
    },
  })

  {
    const occurredAt = new Date('2012-01-10')
    const slug = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'DAY',
        reason:
          'Baddeley\u2019s "Working Memory: Theories, Models, and Controversies" (Annual Review of Psychology, Jan 2012) is the field\u2019s canonical consolidating review. It integrates the episodic-buffer revision into a matured multicomponent model and presents the multicomponent framework as the established, field-standard account of working memory against which rival theories are compared. This marks the community\u2019s settled acceptance of the (revised) multicomponent model that grew directly out of the 1992 claim.',
        sourceExternalId: 'src:baddeley-working-memory-annurev-2012',
      },
      update: {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'DAY',
        reason:
          'Baddeley\u2019s "Working Memory: Theories, Models, and Controversies" (Annual Review of Psychology, Jan 2012) is the field\u2019s canonical consolidating review. It integrates the episodic-buffer revision into a matured multicomponent model and presents the multicomponent framework as the established, field-standard account of working memory against which rival theories are compared. This marks the community\u2019s settled acceptance of the (revised) multicomponent model that grew directly out of the 1992 claim.',
        sourceExternalId: 'src:baddeley-working-memory-annurev-2012',
      },
    })
  }

  console.log(`Enriched claim ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED 2000-11, CONTESTED -> SETTLED 2012-01-10)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
