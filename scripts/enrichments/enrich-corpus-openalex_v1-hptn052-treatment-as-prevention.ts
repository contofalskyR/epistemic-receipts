import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for HPTN 052 (Cohen et al., NEJM 2011),
// "Prevention of HIV-1 Infection with Early Antiretroviral Therapy."
// Claim id cmplybmqt03nrsaihbhlamfwt / OpenAlex W2152505869 / DOI 10.1056/nejmoa1105243.
//
// Baseline row (fromAxis=null -> RECORDED at 2011-07-18 publication) already exists; not duplicated here.
//
// Post-publication arc: the "treatment as prevention" (TasP) finding was vindicated, never
// contested. On 1 September 2015 the WHO issued its "Guideline on when to start antiretroviral
// therapy and on pre-exposure prophylaxis for HIV," recommending ART for everyone living with
// HIV at any CD4 count — a global field-consensus shift resting directly on HPTN 052 (with the
// START and TEMPRANO trials). That institutional adoption is the settling event.
//   RECORDED -> SETTLED at 2015-09-01, community INSTITUTIONAL.

const CLAIM_ID = 'cmplybmqt03nrsaihbhlamfwt'

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (WHO 2015 "treat all" guideline) ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:who-art-prep-guideline-2015' },
    create: {
      externalId: 'src:who-art-prep-guideline-2015',
      name: 'WHO — Guideline on when to start antiretroviral therapy and on pre-exposure prophylaxis for HIV (2015)',
      url: 'https://www.who.int/publications/i/item/9789241509565',
      publishedAt: new Date('2015-09-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1',
    },
    update: {
      name: 'WHO — Guideline on when to start antiretroviral therapy and on pre-exposure prophylaxis for HIV (2015)',
      url: 'https://www.who.int/publications/i/item/9789241509565',
      publishedAt: new Date('2015-09-01'),
    },
  })

  const occurredAt = new Date('2015-09-01')
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
        'The HPTN 052 "treatment as prevention" finding was adopted as global clinical policy when the WHO issued its 1 September 2015 guideline recommending antiretroviral therapy for everyone living with HIV at any CD4 count. The guideline rests directly on HPTN 052 (with the START and TEMPRANO trials), reflecting an institutional field-consensus shift rather than a contest. The finding was vindicated, not overturned.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'The HPTN 052 "treatment as prevention" finding was adopted as global clinical policy when the WHO issued its 1 September 2015 guideline recommending antiretroviral therapy for everyone living with HIV at any CD4 count. The guideline rests directly on HPTN 052 (with the START and TEMPRANO trials), reflecting an institutional field-consensus shift rather than a contest. The finding was vindicated, not overturned.',
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({
    where: { claimId: CLAIM_ID, sourceId: source.id },
  })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: RECORDED -> SETTLED (WHO 2015 guideline) upserted`)

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
