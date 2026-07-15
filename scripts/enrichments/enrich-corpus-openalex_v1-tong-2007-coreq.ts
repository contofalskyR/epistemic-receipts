// Epistemic-receipt enrichment for the COREQ paper (corpus: openalex_v1).
//
// Claim: Tong A, Sainsbury P, Craig J. "Consolidated criteria for reporting
// qualitative research (COREQ): a 32-item checklist for interviews and focus
// groups." Int J Qual Health Care. 2007;19(6):349–357.
// DOI: 10.1093/intqhc/mzm042 · OpenAlex: W2138664283
// Claim id: cmplyno48005nsaqkuf6sg7t6
//
// Baseline row (null -> RECORDED @ 2007-09-15) already exists; do NOT duplicate.
//
// Post-publication event added here:
//   RECORDED -> CONTESTED (2020-02, EXPERT_LITERATURE)
//     Buus & Perron (2020) published a peer-reviewed replication of COREQ's own
//     development method in the International Journal of Nursing Studies and
//     concluded the report of the instrument's development was "fundamentally
//     flawed" — a specific, dated, citable methodological challenge to the
//     checklist's evidentiary basis. (No retraction or expression of concern
//     exists; COREQ remains widely used and EQUATOR-listed, so this is a live
//     contest, not a reversal.)
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-tong-2007-coreq.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplyno48005nsaqkuf6sg7t6'

async function main() {
  // ── RECORDED -> CONTESTED : Buus & Perron 2020 replication/critique ──
  const occurredAt = new Date('2020-02-01')
  const toAxis = 'CONTESTED'
  const slug = `${CLAIM_ID}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.source.upsert({
    where: { externalId: 'src:buus-perron-coreq-critique-2020' },
    create: {
      externalId: 'src:buus-perron-coreq-critique-2020',
      name: 'Buus N, Perron A. The quality of quality criteria: Replicating the development of the Consolidated Criteria for Reporting Qualitative Research (COREQ). International Journal of Nursing Studies 2020;102:103452.',
      url: 'https://doi.org/10.1016/j.ijnurstu.2019.103452',
      publishedAt: new Date('2020-02-01'),
      methodologyType: 'primary',
    },
    update: {
      name: 'Buus N, Perron A. The quality of quality criteria: Replicating the development of the Consolidated Criteria for Reporting Qualitative Research (COREQ). International Journal of Nursing Studies 2020;102:103452.',
      url: 'https://doi.org/10.1016/j.ijnurstu.2019.103452',
      publishedAt: new Date('2020-02-01'),
      methodologyType: 'primary',
    },
  })

  const source = await prisma.source.findUnique({
    where: { externalId: 'src:buus-perron-coreq-critique-2020' },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      reason:
        'Buus and Perron (Int J Nurs Stud 2020;102:103452) retraced and replicated the stepped development method COREQ reported for itself and concluded that "the report of the instrument development was fundamentally flawed," arguing the checklist lacks guidance on what a negative item response means and can a priori judge conceptually congruent, high-quality qualitative research as poor. This peer-reviewed replication is a specific, dated methodological contest of the finding\'s evidentiary basis, moving it from RECORDED to CONTESTED within the expert literature.',
      sourceId: source?.id ?? null,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      reason:
        'Buus and Perron (Int J Nurs Stud 2020;102:103452) retraced and replicated the stepped development method COREQ reported for itself and concluded that "the report of the instrument development was fundamentally flawed," arguing the checklist lacks guidance on what a negative item response means and can a priori judge conceptually congruent, high-quality qualitative research as poor. This peer-reviewed replication is a specific, dated methodological contest of the finding\'s evidentiary basis, moving it from RECORDED to CONTESTED within the expert literature.',
      sourceId: source?.id ?? null,
    },
  })

  console.log(`Upserted transition ${slug} (RECORDED -> CONTESTED)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
