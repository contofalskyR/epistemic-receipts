// Enrichment: post-publication epistemic trajectory for
// Bower, G. H. (1981). Mood and memory. American Psychologist, 36(2), 129–148.
// DOI: 10.1037/0003-066X.36.2.129 · OpenAlex: W2102573486 · Claim: cmplxnjvo01evsa7f3fw6t4ct
//
// Baseline (fromAxis=null -> RECORDED @ 1981) already exists — NOT duplicated here.
// This script adds the two documented post-publication transitions:
//   RECORDED -> CONTESTED (1985): Bower & Mayer's own failure to replicate
//                                 mood-dependent retrieval.
//   CONTESTED -> SETTLED  (1989): Ucros meta-analysis of 40 studies adjudicating
//                                 the phenomenon as real but moderated.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bower-mood-and-memory.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxnjvo01evsa7f3fw6t4ct'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
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
  // ── RECORDED -> CONTESTED (1985): authors' own failure to replicate ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1985-01-01',
    datePrecision: 'YEAR',
    reason:
      'Bower himself, with Mayer, tried and failed to reproduce the mood-state-dependent ' +
      'retrieval effect central to the 1981 paper: in a two-list interference design, subjects ' +
      'recalled about the same percentage of words whether or not retrieval mood matched encoding ' +
      'mood. The blunt "Failure to replicate mood-dependent retrieval" made the original strong ' +
      'MSDM claim contested within the expert literature.',
    source: {
      externalId: 'src:bower-mayer-1985-failure-replicate',
      name: 'Bower, G. H., & Mayer, J. D. (1985). Failure to replicate mood-dependent retrieval. Bulletin of the Psychonomic Society, 23(1), 39–42.',
      url: 'https://doi.org/10.3758/BF03329773',
      publishedAt: '1985-01-01',
      methodologyType: 'primary',
    },
  },
  // ── CONTESTED -> SETTLED (1989): meta-analysis adjudicates the phenomenon as real but moderated ──
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1989-01-01',
    datePrecision: 'YEAR',
    reason:
      'Ucros meta-analyzed 40 studies (25 articles, 1975–1985) of mood state-dependent memory and ' +
      'found a genuine overall effect (mean effect size ≈ 0.44), reliably larger for positive than ' +
      'negative moods. The review vindicated MSDM as a real phenomenon while qualifying it as ' +
      'condition-dependent rather than the robust effect the 1981 paper implied, resolving the ' +
      'post-1985 reliability dispute toward the effect being established but bounded.',
    source: {
      externalId: 'src:ucros-1989-msdm-meta-analysis',
      name: 'Ucros, C. G. (1989). Mood state-dependent memory: A meta-analysis. Cognition and Emotion, 3(2), 139–169.',
      url: 'https://doi.org/10.1080/02699938908408077',
      publishedAt: '1989-01-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} post-publication transitions...`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-bower-mood-and-memory',
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
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
