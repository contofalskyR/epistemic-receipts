// Epistemic-receipt enrichment for Sims (1980), "Macroeconomics and Reality,"
// Econometrica 48(1):1–48. DOI 10.2307/1912017 · OpenAlex W2019459021.
//
// Claim: existing macroeconometric identification strategies are subject to
// serious objections; over-identifying restrictions are unlikely to hold, and an
// alternative non-standard (vector-autoregression) style of econometric work is
// proposed.
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 1980-01-01) already
// exists — do NOT duplicate it. This script adds the post-publication arc:
//
//   RECORDED -> SETTLED (2011-10-10, INSTITUTIONAL):
//     The Royal Swedish Academy of Sciences awarded the 2011 Sveriges Riksbank
//     Prize in Economic Sciences in Memory of Alfred Nobel to Thomas Sargent and
//     Christopher A. Sims "for their empirical research on cause and effect in the
//     macroeconomy." The prize citation credits Sims with developing the vector
//     autoregression (VAR) method — the "non-standard style" of econometric work
//     introduced in this paper — as the tool for analyzing how the economy responds
//     to policy and other shocks. The award marks institutional recognition that
//     the paper's critique of over-identification and its VAR alternative became
//     settled practice in empirical macroeconomics.
//
// Idempotent: upserts source on externalId and ClaimStatusHistory on slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-sims-macroeconomics-reality.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplzsczk01npsa86aq5z8g9w'

async function main() {
  // ── RECORDED -> SETTLED : 2011 Nobel Memorial Prize for the VAR method ──
  await prisma.source.upsert({
    where: { externalId: 'src:sims-nobel-economics-2011' },
    create: {
      externalId: 'src:sims-nobel-economics-2011',
      name: 'The Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel 2011 — Thomas J. Sargent and Christopher A. Sims, "for their empirical research on cause and effect in the macroeconomy" (press release, Royal Swedish Academy of Sciences).',
      url: 'https://www.nobelprize.org/prizes/economic-sciences/2011/press-release/',
      publishedAt: new Date('2011-10-10'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'The Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel 2011 — Thomas J. Sargent and Christopher A. Sims, "for their empirical research on cause and effect in the macroeconomy" (press release, Royal Swedish Academy of Sciences).',
      url: 'https://www.nobelprize.org/prizes/economic-sciences/2011/press-release/',
      publishedAt: new Date('2011-10-10'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2011-10-10`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2011-10-10'),
      datePrecision: 'DAY',
      reason:
        'The Royal Swedish Academy of Sciences awarded the 2011 Nobel Memorial Prize in Economic Sciences to Christopher A. Sims (with Thomas Sargent) for empirical research on cause and effect in the macroeconomy, crediting Sims with the vector-autoregression (VAR) method — the "non-standard style" of econometric work this 1980 paper introduced in response to its own critique of over-identifying restrictions. The award reflects institutional recognition that the paper\'s methodological program had become settled practice in empirical macroeconomics.',
      sourceExternalId: 'src:sims-nobel-economics-2011',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2011-10-10'),
      datePrecision: 'DAY',
      reason:
        'The Royal Swedish Academy of Sciences awarded the 2011 Nobel Memorial Prize in Economic Sciences to Christopher A. Sims (with Thomas Sargent) for empirical research on cause and effect in the macroeconomy, crediting Sims with the vector-autoregression (VAR) method — the "non-standard style" of econometric work this 1980 paper introduced in response to its own critique of over-identifying restrictions. The award reflects institutional recognition that the paper\'s methodological program had become settled practice in empirical macroeconomics.',
      sourceExternalId: 'src:sims-nobel-economics-2011',
    },
  })

  console.log('Enrichment complete: Sims (1980) RECORDED -> SETTLED (2011 Nobel).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
