// Epistemic-receipt enrichment: post-publication trajectory for
// Miller & Modigliani (1961), "Dividend Policy, Growth, and the Valuation of
// Shares", The Journal of Business 34(4):411–433. DOI: 10.1086/294442
// OpenAlex: W2123343520. Claim id: cmplynfgp001hsaqkv6r5ysti.
//
// The claim states the MM dividend-irrelevance / valuation framework: under
// perfect capital markets, rational behavior, and perfect certainty, dividend
// policy has no effect on the current price of shares.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 1961-01-01) already exists and is NOT duplicated here.
//
// Post-publication events added:
//   RECORDED -> CONTESTED (1976, EXPERT_LITERATURE)
//     Fischer Black, "The Dividend Puzzle" (J. Portfolio Management 2(2):5–8) —
//     the canonical statement that observed corporate behavior (firms pay
//     dividends; investors reward payers with higher valuations) is at odds
//     with the real-world implication of MM dividend irrelevance. It opened a
//     sustained empirical dispute over whether dividend policy is truly
//     value-neutral outside MM's idealized assumptions.
//   CONTESTED -> SETTLED (1990-10-16, INSTITUTIONAL)
//     The Sveriges Riksbank Prize in Economic Sciences (Nobel) to Merton Miller.
//     The Royal Swedish Academy's press release explicitly names "MM's second
//     invariance theorem, i.e., that dividend policy does not affect the market
//     value of the firm in equilibrium," ratifying this paper's result as the
//     foundational benchmark of valuation theory — with all subsequent work
//     (including the dividend-puzzle literature) framed as studying deviations
//     from its explicit assumptions rather than refuting the theorem.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-miller-modigliani-dividend-policy-1961.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplynfgp001hsaqkv6r5ysti'

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
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1976-01-01',
    datePrecision: 'YEAR',
    reason:
      'Fischer Black\'s "The Dividend Puzzle" (Journal of Portfolio Management, Winter 1976, 2(2):5–8) is the canonical empirical challenge to the real-world reach of the Miller–Modigliani dividend-irrelevance proposition. Black observed that, contrary to what MM irrelevance implies, corporations persistently pay dividends and investors reward dividend-paying firms with higher valuations — "the harder we look at the dividend picture, the more it seems like a puzzle, with pieces that just don\'t fit together." The paper launched a decades-long dispute over whether dividend policy is truly value-neutral once MM\'s idealized assumptions are relaxed.',
    source: {
      externalId: 'src:black-dividend-puzzle-1976',
      name: 'Black F. The Dividend Puzzle. The Journal of Portfolio Management 1976;2(2):5–8.',
      url: 'https://doi.org/10.3905/jpm.1976.408558',
      publishedAt: '1976-01-01',
      methodologyType: 'opinion',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1990-10-16',
    datePrecision: 'DAY',
    reason:
      'The Royal Swedish Academy of Sciences awarded the 1990 Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel (announced 16 October 1990) to Merton Miller "for pioneering work in the theory of financial economics." Its press release explicitly ratifies this paper\'s central result — "MM\'s second invariance theorem, i.e., that dividend policy does not affect the market value of the firm in equilibrium" — and frames the entire subsequent literature (including the dividend-puzzle debate) as studying "the consequences of various deviations from the conditions on which the MM theorems were based." The prize marks institutional/field consensus that the MM valuation framework is the settled, foundational benchmark of the field, correct under its stated assumptions.',
    source: {
      externalId: 'src:nobel-1990-miller-mm-theorem',
      name: 'The Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel 1990 — Press release (Merton H. Miller), Royal Swedish Academy of Sciences.',
      url: 'https://www.nobelprize.org/prizes/economic-sciences/1990/press-release/',
      publishedAt: '1990-10-16',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
