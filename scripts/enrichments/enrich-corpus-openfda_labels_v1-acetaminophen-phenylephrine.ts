// Enrichment: epistemic arc for the ACETAMINOPHEN / PHENYLEPHRINE HCL OTC
// combination-product claim (openfda_labels_v1).
//
// Claim: cmpiyna1d94guplo7lqy5sjse — "Nasal Decongestant PE and Pain Relief
// Maximum Strength (ACETAMINOPHEN, PHENYLEPHRINE HCL): Purpose Pain
// reliever/fever reducer  Nasal decongestant"
//
// The acetaminophen "pain reliever / fever reducer" purpose is uncontested
// throughout. The genuine epistemic trajectory attaches to the *nasal
// decongestant* purpose — i.e., the claim that oral PHENYLEPHRINE HCL is an
// effective decongestant at OTC monograph doses. That claim rose to settled
// standard-of-care status and was then reversed by the FDA:
//   1. OPEN -> RECORDED (1976)  FDA OTC Drug Review recognized phenylephrine
//      HCl as a Category I (generally recognized as safe and effective) oral
//      nasal decongestant, codified at 21 CFR 341.20.
//   2. RECORDED -> SETTLED (2006)  The Combat Methamphetamine Epidemic Act
//      (Title VII of the USA PATRIOT Improvement and Reauthorization Act of
//      2005) moved pseudoephedrine behind the counter, making oral
//      phenylephrine the ubiquitous OTC oral decongestant — the market
//      standard embodied by exactly this kind of "PE" combination product.
//   3. SETTLED -> CONTESTED (2007)  Hatton, Hendeles et al. published a
//      systematic review and meta-analysis concluding 10 mg oral
//      phenylephrine is no better than placebo, filing a companion citizen
//      petition to the FDA.
//   4. CONTESTED -> REVERSED (2024)  After a unanimous 2023 advisory-committee
//      vote, the FDA issued a proposed order to remove oral phenylephrine from
//      the OTC monograph as not effective.
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-acetaminophen-phenylephrine.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-acetaminophen-phenylephrine.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyna1d94guplo7lqy5sjse'

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
  // 1. Regulatory recognition — phenylephrine HCl recorded as Category I.
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1976-09-09',
    datePrecision: 'YEAR',
    reason:
      'The FDA OTC Drug Review advisory panel on cold, cough, allergy, bronchodilator, and antiasthmatic products recognized phenylephrine hydrochloride as a Category I (generally recognized as safe and effective) oral nasal decongestant, a status carried into the codified monograph at 21 CFR 341.20(b). This regulatory recording — resting largely on older, small studies rather than modern RCTs — is what allowed acetaminophen/phenylephrine "PE" combination products to be marketed with the "nasal decongestant" purpose. The acetaminophen "pain reliever/fever reducer" purpose was independently and durably recognized under the internal-analgesic monograph.',
    source: {
      externalId: 'src:phenylephrine-otc-monograph-21cfr341',
      name: '21 CFR Part 341 — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use (phenylephrine HCl listed as an approved nasal decongestant active ingredient, 21 CFR 341.20).',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1976-09-09',
      methodologyType: 'primary',
    },
  },
  // 2. Broad adoption as the de facto standard OTC oral decongestant.
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'MARKET',
    occurredAt: '2006-03-09',
    datePrecision: 'DAY',
    reason:
      'The Combat Methamphetamine Epidemic Act of 2005, enacted as Title VII of the USA PATRIOT Improvement and Reauthorization Act (Pub. L. 109-177, signed March 9, 2006), moved pseudoephedrine behind the pharmacy counter with sales logs and quantity limits. Manufacturers reformulated their leading OTC cold products around oral phenylephrine, which rapidly became the ubiquitous non-prescription oral decongestant — the market standard embodied by exactly this "Nasal Decongestant PE" combination. The decongestant claim was thereby settled in practice as accepted standard-of-care OTC therapy.',
    source: {
      externalId: 'src:phenylephrine-cmea-hr3199-109th',
      name: 'USA PATRIOT Improvement and Reauthorization Act of 2005 (H.R. 3199, Pub. L. 109-177), Title VII — Combat Methamphetamine Epidemic Act of 2005.',
      url: 'https://www.congress.gov/bill/109th-congress/house-bill/3199',
      publishedAt: '2006-03-09',
      methodologyType: 'primary',
    },
  },
  // 3. Peer-reviewed challenge to efficacy + citizen petition.
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2007-03-01',
    datePrecision: 'MONTH',
    reason:
      'Hatton, Hendeles and colleagues published a systematic review and meta-analysis in the Annals of Pharmacotherapy concluding that oral phenylephrine at the approved 10 mg dose was no more effective than placebo as a nasal decongestant, and filed a companion citizen petition urging the FDA to re-examine its Category I status. This peer-reviewed challenge contested the settled decongestant claim on efficacy grounds while leaving the acetaminophen analgesic/antipyretic purpose untouched. It reframed a widely marketed "standard" ingredient as an open scientific question.',
    source: {
      externalId: 'src:phenylephrine-hatton-annpharmacother-2007',
      name: 'Hatton RC, Winterstein AG, McKelvey RP, Shuster J, Hendeles L. Efficacy and safety of oral phenylephrine: systematic review and meta-analysis. Ann Pharmacother. 2007;41(3):381–390.',
      url: 'https://doi.org/10.1345/aph.1H679',
      publishedAt: '2007-03-01',
      methodologyType: 'derivative',
    },
  },
  // 4. FDA proposed order to remove oral phenylephrine — the reversal.
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2024-11-07',
    datePrecision: 'DAY',
    reason:
      'Following a unanimous September 2023 vote of the FDA Nonprescription Drugs Advisory Committee that oral phenylephrine is not effective as a nasal decongestant at approved doses, the FDA issued a proposed order to remove oral phenylephrine as an active ingredient from the OTC monograph. This institutional action reverses the long-settled decongestant claim for the phenylephrine component of the product; if finalized, "PE" oral products would need reformulation. The acetaminophen "pain reliever/fever reducer" purpose is unaffected — only the nasal-decongestant efficacy claim was reversed.',
    source: {
      externalId: 'src:phenylephrine-fda-proposed-order-2024',
      name: 'U.S. Food and Drug Administration. FDA Proposes Ending Use of Oral Phenylephrine as OTC Monograph Nasal Decongestant Active Ingredient Because It Is Not Effective. FDA news announcement, November 7, 2024.',
      url: 'https://www.fda.gov/news-events/press-announcements/fda-proposes-ending-use-oral-phenylephrine-otc-monograph-nasal-decongestant-active-ingredient',
      publishedAt: '2024-11-07',
      methodologyType: 'primary',
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
        ingestedBy: 'enrich:openfda_labels_v1-acetaminophen-phenylephrine',
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
