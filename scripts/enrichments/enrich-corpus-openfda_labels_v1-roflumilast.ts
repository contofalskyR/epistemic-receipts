// Enrichment: epistemic arc for the FDA roflumilast (Daliresp) COPD label claim.
//
// Claim: cmpiyiex58yj6plo7pfcv2j1y (openfda_labels_v1)
//   ROFLUMILAST — indicated to reduce the risk of COPD exacerbations in severe
//   COPD associated with chronic bronchitis and a history of exacerbations.
//
// Arc:
//   OPEN     -> RECORDED  (2009-08-29) Pivotal Phase III exacerbation trials
//                          (M2-124 / M2-125), Calverley et al., The Lancet.
//   RECORDED -> SETTLED   (2011-02-28) FDA approval of Daliresp (NDA 022522),
//                          establishing the exacerbation-reduction indication.
//   SETTLED  -> CONTESTED (2011-02-28) Post-approval safety signal: the approved
//                          label carries Warnings for psychiatric events including
//                          suicidality and for weight decrease, keeping roflumilast
//                          a narrowly-positioned second-line add-on agent.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-roflumilast.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyiex58yj6plo7pfcv2j1y'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2009-08-29',
    datePrecision: 'DAY',
    reason:
      'Calverley et al. published the two pivotal Phase III trials (M2-124 and M2-125) in The Lancet, randomising patients with severe COPD, chronic bronchitis, and a history of exacerbations to roflumilast 500 mcg or placebo. Roflumilast improved pre-bronchodilator FEV1 and reduced the rate of moderate-to-severe exacerbations versus placebo, providing the first published clinical evidence for the exacerbation-reduction indication.',
    source: {
      externalId: 'src:roflumilast-calverley-lancet-2009',
      name: 'Calverley PMA, Rabe KF, Goehring U-M, et al. Roflumilast in symptomatic chronic obstructive pulmonary disease: two randomised clinical trials. The Lancet 2009;374(9691):685–694.',
      url: 'https://doi.org/10.1016/S0140-6736(09)61255-1',
      publishedAt: '2009-08-29',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-02-28',
    datePrecision: 'DAY',
    reason:
      'The FDA approved Daliresp (roflumilast) under NDA 022522 as a treatment to reduce the risk of COPD exacerbations in patients with severe COPD associated with chronic bronchitis and a history of exacerbations. Regulatory approval ratified the exacerbation-reduction indication and made the drug commercially available in the United States, settling the claim institutionally.',
    source: {
      externalId: 'src:roflumilast-fda-approval-2011',
      name: 'FDA Drugs@FDA — Daliresp (roflumilast) tablets, NDA 022522, approved 2011-02-28.',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=022522',
      publishedAt: '2011-02-28',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-02-28',
    datePrecision: 'DAY',
    reason:
      'The approved prescribing information carries Warnings and Precautions for psychiatric events including suicidality (insomnia, anxiety, depression, and reports of suicidal ideation and behavior) and for weight decrease, reflecting safety signals raised during FDA review and post-approval surveillance. These tolerability and neuropsychiatric concerns, together with the drug being a non-bronchodilator with no immediate symptomatic benefit, have kept roflumilast a narrowly-positioned second-line add-on rather than a first-line COPD therapy.',
    source: {
      externalId: 'src:roflumilast-fda-psychiatric-warning',
      name: 'FDA Prescribing Information — Daliresp (roflumilast), Warnings and Precautions 5.1 (Psychiatric Events Including Suicidality) and 5.2 (Weight Decrease), NDA 022522.',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=022522',
      publishedAt: '2011-02-28',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const occurredAt = new Date(t.occurredAt)
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
    })

    console.log(`upserted ${slug} (${t.fromAxis} -> ${t.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
