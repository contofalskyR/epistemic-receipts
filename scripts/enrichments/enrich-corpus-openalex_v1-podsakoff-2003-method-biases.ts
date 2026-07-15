// Enrichment: post-publication epistemic trajectory for the Podsakoff, MacKenzie,
// Lee & Podsakoff (2003) "Common Method Biases in Behavioral Research" claim.
//
// Claim: cmplxkn2c000dsa7frq8readn (openalex_v1 corpus; DOI 10.1037/0021-9010.88.5.879,
// Journal of Applied Psychology 88(5):879-903). OpenAlex W2106096361.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at 2003-01-01) already
// exists and is NOT recreated here. This script adds the two verified post-publication
// transitions:
//   1. RECORDED  -> CONTESTED  (Spector 2006 "Truth or Urban Legend?" critique)
//   2. CONTESTED -> SETTLED    (Podsakoff et al. 2024 Annual Review adjudication)
//
// Idempotent: upserts on Source.externalId and on the deterministic ClaimStatusHistory id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-podsakoff-2003-method-biases.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxkn2c000dsa7frq8readn'

async function main() {
  // ── Transition 1: RECORDED -> CONTESTED ──────────────────────────────────────
  // Spector (2006) directly challenged the premise of the 2003 paper, arguing that the
  // claim that common method variance automatically inflates observed correlations is a
  // distortion that has reached the status of an "urban legend," and calling for the term
  // to be abandoned. This is the canonical dated methodological contest of the finding.
  const spectorSource = await prisma.source.upsert({
    where: { externalId: 'src:spector-2006-method-variance-urban-legend' },
    create: {
      externalId: 'src:spector-2006-method-variance-urban-legend',
      name: 'Spector PE. Method Variance in Organizational Research: Truth or Urban Legend? Organizational Research Methods 2006;9(2):221-232.',
      url: 'https://doi.org/10.1177/1094428105284955',
      publishedAt: new Date('2006-04-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
    update: {
      name: 'Spector PE. Method Variance in Organizational Research: Truth or Urban Legend? Organizational Research Methods 2006;9(2):221-232.',
      url: 'https://doi.org/10.1177/1094428105284955',
      publishedAt: new Date('2006-04-01'),
      methodologyType: 'derivative',
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-CONTESTED-2006-04-01` },
    create: {
      id: `${CLAIM_ID}-CONTESTED-2006-04-01`,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      reason:
        'Spector (2006), "Method Variance in Organizational Research: Truth or Urban Legend?", contested the core premise underlying the 2003 remedies literature. He argued that the claim that shared method automatically produces systematic variance inflating correlations is an oversimplification that has become an "urban legend," and reviewed empirical evidence casting doubt on the effect, proposing the term "common method variance" be abandoned. This is the canonical dated challenge to the finding.',
      occurredAt: new Date('2006-04-01'),
      datePrecision: 'MONTH',
      sourceId: spectorSource.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      sourceId: spectorSource.id,
      occurredAt: new Date('2006-04-01'),
      datePrecision: 'MONTH',
    },
  })

  // ── Transition 2: CONTESTED -> SETTLED ───────────────────────────────────────
  // The 2024 Annual Review comprehensive review (led by two of the original 2003 authors,
  // plus Williams, Huang & Yang) re-adjudicates the two-decade debate: its very title —
  // "It's Bad, It's Complex, It's Widespread, and It's Not Easy to Fix" — reaffirms that
  // common method bias is a real, consequential, and pervasive threat, directly answering
  // the urban-legend critique while conceding remedies are harder than once thought.
  const review2024Source = await prisma.source.upsert({
    where: { externalId: 'src:podsakoff-2024-cmb-annual-review' },
    create: {
      externalId: 'src:podsakoff-2024-cmb-annual-review',
      name: "Podsakoff PM, Podsakoff NP, Williams LJ, Huang C, Yang J. Common Method Bias: It's Bad, It's Complex, It's Widespread, and It's Not Easy to Fix. Annual Review of Organizational Psychology and Organizational Behavior 2024;11:17-61.",
      url: 'https://doi.org/10.1146/annurev-orgpsych-110721-040030',
      publishedAt: new Date('2024-01-22'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
    update: {
      name: "Podsakoff PM, Podsakoff NP, Williams LJ, Huang C, Yang J. Common Method Bias: It's Bad, It's Complex, It's Widespread, and It's Not Easy to Fix. Annual Review of Organizational Psychology and Organizational Behavior 2024;11:17-61.",
      url: 'https://doi.org/10.1146/annurev-orgpsych-110721-040030',
      publishedAt: new Date('2024-01-22'),
      methodologyType: 'derivative',
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-SETTLED-2024-01-22` },
    create: {
      id: `${CLAIM_ID}-SETTLED-2024-01-22`,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      reason:
        'The 2024 Annual Review of Organizational Psychology and Organizational Behavior review by Podsakoff, Podsakoff, Williams, Huang & Yang adjudicates the two-decade debate opened by Spector (2006). Surveying the accumulated evidence, it concludes that common method bias is real, consequential ("bad"), and "widespread" — answering the urban-legend critique — while conceding it is "complex" and "not easy to fix." The expert literature thus settles on the reality of the phenomenon the 2003 article named, even as remedy efficacy remains an active question.',
      occurredAt: new Date('2024-01-22'),
      datePrecision: 'DAY',
      sourceId: review2024Source.id,
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      sourceId: review2024Source.id,
      occurredAt: new Date('2024-01-22'),
      datePrecision: 'DAY',
    },
  })

  console.log('Enriched claim', CLAIM_ID, 'with RECORDED->CONTESTED (2006) and CONTESTED->SETTLED (2024).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
