import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for MADIT-II (Moss et al., NEJM 2002),
// "Prophylactic Implantation of a Defibrillator in Patients with Myocardial
// Infarction and Reduced Ejection Fraction."
// Claim id cmplycwpo049fsaihbwzjod8d / OpenAlex W2012574332 / DOI 10.1056/nejmoa013474.
//
// Baseline row (fromAxis=null -> RECORDED at 2002-03-21 publication) already exists; not duplicated here.
//
// Post-publication arc: the finding that a prophylactic implantable defibrillator improves
// survival in post-MI patients with LVEF <=0.30 was vindicated, never contested for the
// ischemic population. It was adopted as a Class I recommendation in the ACC/AHA/HRS 2008
// Guidelines for Device-Based Therapy of Cardiac Rhythm Abnormalities (Circulation
// 2008;117:e350-e408, 27 May 2008), which cite MADIT-II directly. That institutional
// guideline adoption is the settling event.
//   RECORDED -> SETTLED at 2008-05-27, community INSTITUTIONAL.

const CLAIM_ID = 'cmplycwpo049fsaihbwzjod8d'

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (ACC/AHA/HRS 2008 device-therapy guideline) ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:accahahrs-2008-device-therapy-guidelines' },
    create: {
      externalId: 'src:accahahrs-2008-device-therapy-guidelines',
      name: 'ACC/AHA/HRS 2008 Guidelines for Device-Based Therapy of Cardiac Rhythm Abnormalities (Circulation 2008;117:e350-e408)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/18483207/',
      publishedAt: new Date('2008-05-27'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1',
    },
    update: {
      name: 'ACC/AHA/HRS 2008 Guidelines for Device-Based Therapy of Cardiac Rhythm Abnormalities (Circulation 2008;117:e350-e408)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/18483207/',
      publishedAt: new Date('2008-05-27'),
    },
  })

  const occurredAt = new Date('2008-05-27')
  const slug = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'The MADIT-II finding — that a prophylactic implantable cardioverter-defibrillator improves survival in patients with a prior myocardial infarction and LVEF <=0.30 — was adopted as clinical policy in the ACC/AHA/HRS 2008 Guidelines for Device-Based Therapy of Cardiac Rhythm Abnormalities, which cite MADIT-II directly as the evidence basis for a Class I primary-prevention ICD recommendation. This institutional field-consensus shift settled the finding for the ischemic population; it was vindicated, not overturned.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'The MADIT-II finding — that a prophylactic implantable cardioverter-defibrillator improves survival in patients with a prior myocardial infarction and LVEF <=0.30 — was adopted as clinical policy in the ACC/AHA/HRS 2008 Guidelines for Device-Based Therapy of Cardiac Rhythm Abnormalities, which cite MADIT-II directly as the evidence basis for a Class I primary-prevention ICD recommendation. This institutional field-consensus shift settled the finding for the ischemic population; it was vindicated, not overturned.',
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({
    where: { claimId: CLAIM_ID, sourceId: source.id },
  })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: RECORDED -> SETTLED (ACC/AHA/HRS 2008 device-therapy guideline) upserted`)

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
