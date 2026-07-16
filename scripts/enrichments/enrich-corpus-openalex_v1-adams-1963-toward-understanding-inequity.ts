// Epistemic-receipt enrichment: post-publication trajectory for
// Adams, J. S. (1963), "Towards an understanding of inequity."
// The Journal of Abnormal and Social Psychology 67(5):422–436.
// DOI: 10.1037/h0040968. OpenAlex: W2163741736.
// Claim id: cmpm1834904edsadnz9w3g156.
//
// This is the founding statement of equity theory — a special case of
// Festinger's cognitive dissonance applied to wage/exchange inequity.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 1963-11) already exists and is NOT duplicated here.
//
// Post-publication events added:
//   RECORDED -> CONTESTED (1987-04, EXPERT_LITERATURE)
//     Huseman, Hatfield & Miles, "A New Perspective on Equity Theory: The
//     Equity Sensitivity Construct" (Academy of Management Review 12(2):
//     222–234) — the canonical, highly cited critique arguing that equity
//     theory's assumption of a uniform response to inequity is wrong:
//     individuals differ systematically ("benevolents," "equity sensitives,"
//     "entitleds"), so the theory's core predictions fail without an
//     individual-difference moderator. This opened a sustained dispute over
//     the generality of Adams' predictions.
//   CONTESTED -> SETTLED (2001-06, EXPERT_LITERATURE)
//     Colquitt, Conlon, Wesson, Porter & Ng, "Justice at the Millennium: A
//     Meta-Analytic Review of 25 Years of Organizational Justice Research"
//     (Journal of Applied Psychology 86(3):425–445) — the definitive
//     meta-analysis (k > 180) that established distributive justice, the
//     construct Adams' equity theory founded and operationalizes, as a
//     distinct and robust predictor of job satisfaction, outcome
//     satisfaction, and other work outcomes. It vindicated the empirical core
//     of equity/inequity perception as a settled construct within
//     organizational justice, now standard textbook consensus.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-adams-1963-toward-understanding-inequity.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm1834904edsadnz9w3g156'

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
    occurredAt: '1987-04-01',
    datePrecision: 'MONTH',
    reason:
      'Huseman, Hatfield & Miles, "A New Perspective on Equity Theory: The Equity Sensitivity Construct" (Academy of Management Review 12(2):222–234), is the canonical critique of Adams\' equity theory. It argued that the theory\'s assumption of a uniform reaction to inequity is empirically wrong — individuals differ systematically in their preferences for equity (labeled "benevolents," "equity sensitives," and "entitleds") — so the theory\'s central predictions do not hold without an individual-difference moderator. The paper anchored a sustained dispute over the generality of Adams\' inequity predictions.',
    source: {
      externalId: 'src:huseman-equity-sensitivity-1987',
      name: 'Huseman RC, Hatfield JD, Miles EW. A New Perspective on Equity Theory: The Equity Sensitivity Construct. Academy of Management Review 1987;12(2):222–234.',
      url: 'https://doi.org/10.2307/258531',
      publishedAt: '1987-04-01',
      methodologyType: 'opinion',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2001-06-01',
    datePrecision: 'MONTH',
    reason:
      'Colquitt, Conlon, Wesson, Porter & Ng, "Justice at the Millennium: A Meta-Analytic Review of 25 Years of Organizational Justice Research" (Journal of Applied Psychology 86(3):425–445), meta-analyzed the justice literature that grew out of Adams\' equity theory. It established distributive justice — the perception-of-inequity construct Adams founded — as a distinct, reliably measured dimension that robustly predicts job satisfaction, outcome satisfaction, and related work outcomes. The meta-analysis settled the empirical core of equity/inequity perception as a durable construct, now standard organizational-behavior textbook consensus.',
    source: {
      externalId: 'src:colquitt-justice-millennium-2001',
      name: 'Colquitt JA, Conlon DE, Wesson MJ, Porter COLH, Ng KY. Justice at the Millennium: A Meta-Analytic Review of 25 Years of Organizational Justice Research. Journal of Applied Psychology 2001;86(3):425–445.',
      url: 'https://doi.org/10.1037/0021-9010.86.3.425',
      publishedAt: '2001-06-01',
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
