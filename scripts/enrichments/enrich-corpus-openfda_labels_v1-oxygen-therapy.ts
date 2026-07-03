// Enrichment: epistemic arc for the medical-oxygen FDA label claim.
//
// Claim cmpiy96t98nw6plo7sediopnd — "Oxygen (OXYGEN): (no purpose or
// indication on label)". The label itself carries no indication (medical
// oxygen is a USP gas), but the underlying therapy has a well-dated
// epistemic arc:
//   1. OPEN  -> RECORDED  Nocturnal Oxygen Therapy Trial (NOTT), 1980 —
//        first RCT showing long-term oxygen reduces mortality in hypoxemic COPD.
//   2. RECORDED -> SETTLED  BTS guideline for oxygen use in adults, 2017 —
//        oxygen fixed as standard-of-care with defined target saturations.
//   3. SETTLED -> CONTESTED  IOTA meta-analysis, Lancet 2018 — liberal
//        oxygen in acutely ill adults raises mortality; "more is safer" refuted.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-oxygen-therapy.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-oxygen-therapy.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy96t98nw6plo7sediopnd'

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
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1980-09-01',
    datePrecision: 'MONTH',
    reason:
      'The Nocturnal Oxygen Therapy Trial (NOTT), the first large randomized controlled trial of long-term oxygen in hypoxemic chronic obstructive lung disease, reported that continuous oxygen therapy roughly halved mortality relative to nocturnal-only oxygen. This moved oxygen from an intuitively-used gas to a therapy with recorded, trial-grade evidence of a survival benefit in a defined population.',
    source: {
      externalId: 'src:oxygen-nott-1980',
      name: 'Nocturnal Oxygen Therapy Trial Group. Continuous or nocturnal oxygen therapy in hypoxemic chronic obstructive lung disease: a clinical trial. Ann Intern Med. 1980;93(3):391–398.',
      url: 'https://doi.org/10.7326/0003-4819-93-3-391',
      publishedAt: '1980-09-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2017-06-01',
    datePrecision: 'MONTH',
    reason:
      'The British Thoracic Society guideline for oxygen use in adults in healthcare and emergency settings codified oxygen as a drug requiring prescription and target oxygen-saturation ranges rather than routine liberal delivery. Its publication marked institutional settlement of oxygen therapy as standard of care with defined dosing, adopted across emergency and inpatient practice.',
    source: {
      externalId: 'src:oxygen-bts-guideline-2017',
      name: "O'Driscoll BR, Howard LS, Earis J, Mak V; BTS Emergency Oxygen Guideline Group. BTS guideline for oxygen use in adults in healthcare and emergency settings. Thorax. 2017;72(Suppl 1):ii1–ii90.",
      url: 'https://doi.org/10.1136/thoraxjnl-2016-209729',
      publishedAt: '2017-06-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2018-04-28',
    datePrecision: 'DAY',
    reason:
      'The IOTA systematic review and meta-analysis pooled 25 randomized trials (~16,000 acutely ill adults) and found that liberal supplemental oxygen increased in-hospital and 30-day mortality compared with conservative targets. The finding contested the long-standing assumption that more oxygen is safer, prompting a BMJ Rapid Recommendation to lower upper saturation targets and reopening the therapeutic window as an actively debated question.',
    source: {
      externalId: 'src:oxygen-iota-2018',
      name: 'Chu DK, Kim LHY, Young PJ, et al. Mortality and morbidity in acutely ill adults treated with liberal versus conservative oxygen therapy (IOTA): a systematic review and meta-analysis. Lancet. 2018;391(10131):1693–1705.',
      url: 'https://doi.org/10.1016/S0140-6736(18)30479-3',
      publishedAt: '2018-04-28',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`
    if (DRY_RUN) {
      console.log(`[dry-run] would upsert source ${t.source.externalId} + history ${slug}`)
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
        ingestedBy: 'openfda_labels_v1_enrichment',
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
      where: { id: slug },
      create: {
        id: slug,
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

    console.log(`upserted ${slug} (source ${source.id})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
