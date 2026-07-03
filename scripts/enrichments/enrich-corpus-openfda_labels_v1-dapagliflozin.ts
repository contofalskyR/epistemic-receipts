// Enrichment: epistemic arc for the dapagliflozin FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiymu0o93vuplo7q58aigrk — INDICATIONS AND USAGE for dapagliflozin
// (reduce risk of heart-failure hospitalization in adults with T2DM + CV risk;
// adjunct to diet/exercise for glycemic control in T2DM).
//
// Adds ClaimStatusHistory rows tracing the real epistemic trajectory of the
// underlying scientific claim (dapagliflozin, an SGLT2 inhibitor, is safe and
// effective for glycemic control and cardiovascular/heart-failure benefit),
// independent of the 2026 label-ingestion date:
//   1. OPEN -> RECORDED  (2010) first published Phase III RCT of dapagliflozin
//      add-on to metformin for glycemic control (Bailey et al., Lancet).
//   2. RECORDED -> SETTLED (2022) codified as a Class 1 standard-of-care therapy
//      in the AHA/ACC/HFSA Heart Failure Guideline, reflecting the pivotal
//      DECLARE-TIMI 58 / DAPA-HF outcomes that underpin the label's HF-
//      hospitalization indication.
//   3. SETTLED -> CONTESTED (2018) FDA class-wide safety communication warning
//      of rare Fournier's gangrene (necrotizing fasciitis of the perineum) with
//      SGLT2 inhibitors — a post-market safety signal that qualified, but did
//      not reverse, the settled benefit (no withdrawal; drug remains standard
//      of care with an added warning).
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-dapagliflozin.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-dapagliflozin.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiymu0o93vuplo7q58aigrk'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus | null
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
  // 1. First published clinical evidence — Phase III dapagliflozin RCT.
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2010-06-26',
    datePrecision: 'DAY',
    reason:
      'Bailey and colleagues published the pivotal Phase III randomized, double-blind, placebo-controlled trial of dapagliflozin as add-on therapy in patients with type 2 diabetes inadequately controlled on metformin in The Lancet, showing dose-dependent, statistically significant reductions in HbA1c versus placebo. This established, in the peer-reviewed literature, the glycemic efficacy of the SGLT2-inhibitor mechanism later reflected in the FDA label. It marked the point at which dapagliflozin moved from investigational hypothesis to recorded clinical evidence.',
    source: {
      externalId: 'src:dapagliflozin-bailey-lancet-2010',
      name: 'Bailey CJ, Gross JL, Pieters A, Bastien A, List JF. Effect of dapagliflozin in patients with type 2 diabetes who have inadequate glycaemic control with metformin: a randomised, double-blind, placebo-controlled trial. Lancet. 2010;375(9733):2223–2233. PMID: 20609968.',
      url: 'https://doi.org/10.1016/S0140-6736(10)60407-2',
      publishedAt: '2010-06-26',
      methodologyType: 'primary',
    },
  },
  // 2. Standard-of-care / major guideline codification.
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2022-04-01',
    datePrecision: 'MONTH',
    reason:
      'The 2022 AHA/ACC/HFSA Heart Failure Guideline assigned SGLT2 inhibitors, including dapagliflozin, a Class 1 (strong) recommendation, codifying the outcomes of the DECLARE-TIMI 58 and DAPA-HF trials that demonstrated reduced heart-failure hospitalization. This flagship guideline settles, at the institutional level, the cardiovascular/heart-failure benefit that grounds the label\'s HF-hospitalization indication. Dapagliflozin holds analogous standard-of-care status in ADA diabetes guidance and the WHO context for SGLT2-inhibitor therapy.',
    source: {
      externalId: 'src:dapagliflozin-aha-acc-hfsa-hf-guideline-2022',
      name: 'Heidenreich PA, Bozkurt B, Aguilar D, et al. 2022 AHA/ACC/HFSA Guideline for the Management of Heart Failure. Circulation. 2022;145(18):e895–e1032.',
      url: 'https://doi.org/10.1161/CIR.0000000000001063',
      publishedAt: '2022-04-01',
      methodologyType: 'derivative',
    },
  },
  // 3. Post-market safety signal — class-wide FDA warning (contests, does not reverse).
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2018-08-29',
    datePrecision: 'DAY',
    reason:
      'The FDA issued a class-wide Drug Safety Communication warning that SGLT2 inhibitors, including dapagliflozin, can cause a rare but serious and potentially life-threatening infection of the genital area (Fournier\'s gangrene / necrotizing fasciitis of the perineum), requiring a labeling update. This post-market safety signal contests the settled benefit-risk profile without reversing it: the drug was not withdrawn and remains standard of care with an added warning. It followed earlier SGLT2-class safety communications on diabetic ketoacidosis and urinary-tract infections.',
    source: {
      externalId: 'src:dapagliflozin-fda-fournier-gangrene-2018',
      name: 'U.S. Food and Drug Administration. FDA warns about rare occurrences of a serious infection of the genital area with SGLT2 inhibitors for diabetes. Drug Safety Communication, August 29, 2018.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-warns-about-rare-occurrences-serious-infection-genital-area-sglt2-inhibitors-diabetes',
      publishedAt: '2018-08-29',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — refusing to create a new Claim.`)

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${histId} — ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.source.url})`)
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
        ingestedBy: 'enrich:openfda_labels_v1-dapagliflozin',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${histId} — ${tr.fromAxis} -> ${tr.toAxis}`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
