// Enrich: epistemic arc for the leuprolide-acetate advanced-prostate-cancer
// palliative-treatment indication claim.
//
// Claim: cmpiyc3uk8rb0plo7ew58wdox (openfda_labels_v1)
//   "Leuprolide Acetate ... indicated in the palliative treatment of advanced
//    prostatic cancer."
//
// Arc (chronologically monotonic):
//   OPEN     -> RECORDED   1984-11-15  Leuprolide Study Group RCT vs DES (NEJM)
//   RECORDED -> SETTLED    1985-04-09  FDA approval of Lupron; GnRH-agonist ADT
//                                       becomes standard androgen-deprivation therapy
//   SETTLED  -> CONTESTED  2010-10-20  FDA Drug Safety Communication: GnRH-agonist
//                                       labels must add diabetes / cardiovascular warnings
//
// The pre-existing fromAxis=null status-history row is left untouched.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-leuprolide-advanced-prostate-cancer.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-leuprolide-advanced-prostate-cancer.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyc3uk8rb0plo7ew58wdox'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
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
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1984-11-15',
    datePrecision: 'DAY',
    reason:
      'The Leuprolide Study Group randomized trial (N Engl J Med 1984;311:1281-6) compared the GnRH agonist leuprolide acetate with diethylstilbestrol (DES) in 199 men with metastatic prostate cancer and found equivalent objective response and survival but markedly fewer cardiovascular and gynecomastia adverse events. This was the first published multicenter Phase III evidence that leuprolide achieves medical castration for advanced prostatic cancer, establishing the clinical basis later written into the label indication.',
    source: {
      externalId: 'src:leuprolide-study-group-nejm-1984',
      name: 'The Leuprolide Study Group. Leuprolide versus diethylstilbestrol for metastatic prostate cancer. N Engl J Med 1984;311(20):1281-1286.',
      url: 'https://doi.org/10.1056/NEJM198411153112004',
      publishedAt: '1984-11-15',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1985-04-09',
    datePrecision: 'DAY',
    reason:
      'On 9 April 1985 the FDA approved leuprolide acetate (Lupron, NDA 019010) for the palliative treatment of advanced prostate cancer, the first GnRH-agonist alternative to orchiectomy and estrogen therapy. Regulatory approval and rapid uptake established GnRH-agonist androgen-deprivation therapy as the standard reversible medical-castration option, settling the indication as standard of care for metastatic disease.',
    source: {
      externalId: 'src:leuprolide-fda-approval-1985',
      name: 'Drugs@FDA: Leuprolide Acetate (Lupron), NDA 019010 — approval history and approved labeling.',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=019010',
      publishedAt: '1985-04-09',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2010-10-20',
    datePrecision: 'DAY',
    reason:
      'On 20 October 2010 the FDA issued a Drug Safety Communication notifying manufacturers of GnRH agonists — including leuprolide — to add new Warnings and Precautions to the labeling regarding an increased risk of diabetes and certain cardiovascular events (myocardial infarction, sudden cardiac death, stroke) in men treated for prostate cancer. The class-wide safety action reopened the risk-benefit calculus of long-term androgen-deprivation therapy, contesting the previously settled reading of the indication.',
    source: {
      externalId: 'src:fda-gnrh-agonist-safety-communication-2010',
      name: 'FDA Drug Safety Communication: Update to Ongoing Safety Review of GnRH Agonists and Notification to Manufacturers of GnRH Agonists to Add New Safety Information to Labeling Regarding Increased Risk of Diabetes and Certain Cardiovascular Diseases (Oct 20, 2010).',
      url: 'https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/gonadotropin-releasing-hormone-gnrh-agonists',
      publishedAt: '2010-10-20',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source ${t.source.externalId}`)
      console.log(`[dry-run] history ${historyId}: ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${t.community})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich_openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`✓ ${historyId}: ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
