// Enrichment: epistemic arc for capecitabine (CAPECITABINE), colorectal cancer
//   claim id cmpixy32f8buuplo73z5qu7ba (openfda_labels_v1)
//
// Capecitabine (Xeloda) is an oral fluoropyrimidine prodrug of 5-FU. Its
// colorectal epistemic arc:
//   OPEN   -> RECORDED : Pivotal phase III trials (2001, J Clin Oncol) showed
//                        oral capecitabine matched IV 5-FU/leucovorin response in
//                        metastatic colorectal cancer — the primary clinical
//                        evidence behind FDA colorectal approval (Apr 30, 2001).
//   RECORDED -> SETTLED: The X-ACT phase III adjuvant trial (Twelves et al.,
//                        NEJM 2005) established capecitabine as at least
//                        equivalent to bolus 5-FU/LV for stage III colon cancer,
//                        cementing standard-of-care/guideline status.
//   SETTLED -> CONTESTED: DPD-deficiency safety signal — EMA recommended DPD
//                        (DPYD) testing before fluoropyrimidine treatment
//                        (Apr 2020) to avoid severe/fatal toxicity, placing
//                        unscreened use in a contested state.
//
// Does NOT create a Claim — only Source + ClaimStatusHistory rows for the
// existing claim. Idempotent (upserts). The existing null->first row is left
// untouched.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-capecitabine-colorectal.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpixy32f8buuplo73z5qu7ba'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
  // ── OPEN -> RECORDED : pivotal phase III MCRC evidence ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2001-11-01',
    datePrecision: 'DAY',
    reason:
      'The pivotal phase III study by Van Cutsem et al. (J Clin Oncol, Nov 2001) randomized 602 patients with previously untreated metastatic colorectal cancer and showed that oral capecitabine produced a significantly higher objective response rate than the intravenous Mayo Clinic 5-FU/leucovorin regimen, with equivalent time to progression and overall survival and an improved safety profile. Together with the parallel North American trial (Hoff et al., same journal), this constituted the first published high-quality clinical evidence that an oral fluoropyrimidine could replace infusional 5-FU in colorectal cancer. This body of evidence supported the FDA colorectal approval of capecitabine on April 30, 2001.',
    source: {
      externalId: 'src:jco-2001-vancutsem-capecitabine-mcrc',
      name: 'Van Cutsem E, et al. "Oral capecitabine compared with intravenous fluorouracil plus leucovorin in patients with metastatic colorectal cancer: results of a large phase III study." J Clin Oncol. 2001;19(21):4097–4106.',
      url: 'https://doi.org/10.1200/JCO.2001.19.21.4097',
      publishedAt: '2001-11-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED : X-ACT adjuvant trial establishes standard of care ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2005-06-30',
    datePrecision: 'DAY',
    reason:
      'The X-ACT phase III trial (Twelves et al., N Engl J Med, June 30 2005) randomized 1,987 patients with resected stage III colon cancer and demonstrated that adjuvant oral capecitabine was at least equivalent to bolus 5-FU/leucovorin for disease-free survival, with a trend toward superiority and fewer serious adverse events. These results moved capecitabine from an active agent to an accepted standard-of-care adjuvant option, driving its incorporation into major oncology practice guidelines (NCCN, ESMO) and its FDA adjuvant colon-cancer approval in June 2005. The determination was settled by the weight of pivotal randomized evidence and expert consensus.',
    source: {
      externalId: 'src:nejm-2005-twelves-xact-capecitabine-adjuvant',
      name: 'Twelves C, et al. "Capecitabine as adjuvant treatment for stage III colon cancer." N Engl J Med. 2005;352(26):2696–2704 (X-ACT trial).',
      url: 'https://doi.org/10.1056/NEJMoa043116',
      publishedAt: '2005-06-30',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED : DPD-deficiency toxicity safety signal ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-04-30',
    datePrecision: 'DAY',
    reason:
      'On 30 April 2020 the European Medicines Agency recommended dihydropyrimidine dehydrogenase (DPD/DPYD) testing before starting fluoropyrimidine treatment, including capecitabine, because patients with partial or complete DPD deficiency are at high risk of severe and potentially fatal toxicity (neutropenia, mucositis, neurotoxicity, diarrhea). The recommendation followed accumulating pharmacovigilance evidence and added a contraindication in complete-deficiency patients, changing the risk framing of routine unscreened use. This placed the safe-administration profile of capecitabine in a contested state pending broader adoption of pre-treatment genotyping.',
    source: {
      externalId: 'src:ema-2020-dpd-testing-fluoropyrimidines',
      name: 'European Medicines Agency. "EMA recommendations on DPD testing prior to treatment with fluorouracil, capecitabine, tegafur and flucytosine" (30 April 2020).',
      url: 'https://www.ema.europa.eu/en/news/ema-recommendations-dpd-testing-prior-treatment-fluorouracil-capecitabine-tegafur-flucytosine',
      publishedAt: '2020-04-30',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1-capecitabine-colorectal',
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

  console.log(`Enriched claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
