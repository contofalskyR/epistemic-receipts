// Enrichment: post-publication epistemic trajectory for the JNC 8 hypertension
// guideline (James PA, Oparil S, Carter BL, et al., "2014 Evidence-Based
// Guideline for the Management of High Blood Pressure in Adults: Report From the
// Panel Members Appointed to the Eighth Joint National Committee (JNC 8),"
// JAMA 2014;311(5):507–520, DOI 10.1001/jama.2013.284427; published online
// 2013-12-18).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 2013-12-18 publication date) already exists — do NOT duplicate it.
//
// Post-publication arc (all sources verified via Crossref):
//   1. RECORDED -> CONTESTED (2014-04-01): Five of the JNC 8 panel members
//      published a formal dissent — "Evidence Supporting a Systolic Blood
//      Pressure Goal of Less Than 150 mm Hg in Patients Aged 60 Years or Older:
//      The Minority View" (Wright JT Jr, Fine LJ, Lackland DT, Ogedegbe G,
//      Dennison Himmelfarb CR, Annals of Internal Medicine 2014;160(7):499–503,
//      DOI 10.7326/M13-2981). The dissenters argued the evidence did NOT support
//      the panel's own relaxation of the systolic goal to <150 mmHg for adults
//      aged >=60, contending <140 remained appropriate. A published intra-panel
//      dispute over the guideline's central recommendation. Community:
//      EXPERT_LITERATURE.
//   2. CONTESTED -> REVERSED (2017-11-13): The 2017 ACC/AHA/... Guideline for
//      the Prevention, Detection, Evaluation, and Management of High Blood
//      Pressure in Adults (Whelton PK, Carey RM, Aronow WS, et al., Hypertension
//      2018;71:e13–e115, DOI 10.1161/HYP.0000000000000065; simultaneously
//      J Am Coll Cardiol) superseded the JNC 8 framework: it redefined
//      hypertension at >=130/80 mmHg and set a treatment goal of <130/80 for
//      most adults, including those >=65, overturning JNC 8's relaxed
//      systolic goal of <150 for adults >=60. Institutional supersession by the
//      succeeding US guideline. Community: INSTITUTIONAL.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-jnc8-2014-hypertension-guideline.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-jnc8-2014-hypertension-guideline.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply4dfi0059saihrrj496dj'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2014-04-01',
    datePrecision: 'MONTH',
    reason:
      'Five of the JNC 8 panel members published a formal dissent from the panel\'s own central recommendation — "Evidence Supporting a Systolic Blood Pressure Goal of Less Than 150 mm Hg in Patients Aged 60 Years or Older: The Minority View" (Wright JT Jr, Fine LJ, Lackland DT, Ogedegbe G, Dennison Himmelfarb CR, Annals of Internal Medicine 2014;160(7):499–503). The dissenters argued the evidence did not justify relaxing the systolic goal to <150 mmHg for adults aged 60 and older and that a <140 mmHg goal remained appropriate for most such patients. A published intra-panel dispute over the guideline\'s headline threshold placed the finding in contest.',
    source: {
      externalId: 'src:jnc8-minority-view-wright-2014',
      name: 'Wright JT Jr, Fine LJ, Lackland DT, Ogedegbe G, Dennison Himmelfarb CR. Evidence Supporting a Systolic Blood Pressure Goal of Less Than 150 mm Hg in Patients Aged 60 Years or Older: The Minority View. Annals of Internal Medicine 2014;160(7):499–503.',
      url: 'https://doi.org/10.7326/M13-2981',
      publishedAt: '2014-04-01',
      methodologyType: 'opinion',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2017-11-13',
    datePrecision: 'DAY',
    reason:
      'The 2017 ACC/AHA/AAPA/ABC/ACPM/AGS/APhA/ASH/ASPC/NMA/PCNA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults (Whelton PK, Carey RM, Aronow WS, et al., Hypertension 2018;71:e13–e115; released 2017-11-13, simultaneously published in J Am Coll Cardiol) superseded the JNC 8 framework in US practice. It redefined hypertension as >=130/80 mmHg and set a treatment goal of <130/80 for most adults, including those aged 65 and older — directly overturning JNC 8\'s relaxed systolic goal of <150 mmHg for adults aged 60 and older. Institutional supersession by the succeeding national guideline, not a retraction of an underlying study.',
    source: {
      externalId: 'src:acc-aha-2017-hypertension-guideline',
      name: 'Whelton PK, Carey RM, Aronow WS, et al. 2017 ACC/AHA/AAPA/ABC/ACPM/AGS/APhA/ASH/ASPC/NMA/PCNA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults. Hypertension 2018;71:e13–e115.',
      url: 'https://doi.org/10.1161/HYP.0000000000000065',
      publishedAt: '2017-11-13',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} — ${TRANSITIONS.length} post-publication transition(s)${DRY_RUN ? ' (dry-run)' : ''}`)

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry-run] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.datePrecision}) | ${slug}`)
      console.log(`            source: ${tr.source.externalId} -> ${tr.source.url}`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'AGAINST' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
