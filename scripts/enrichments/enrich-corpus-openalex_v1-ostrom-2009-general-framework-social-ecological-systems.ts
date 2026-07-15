import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Claim: Elinor Ostrom (2009), "A General Framework for Analyzing Sustainability
// of Social-Ecological Systems," Science 325(5939):419-422.
// DOI 10.1126/science.1172133 | OpenAlex W2034994370
//
// Post-publication trajectory:
//   Baseline RECORDED (2009-07-23) already exists — do NOT duplicate.
//
//   RECORDED -> SETTLED (2018): The SES framework was not retracted or
//   overturned (a conceptual framework, not a testable empirical finding).
//   Instead it consolidated into the standard organizing framework for
//   social-ecological systems research. Partelow (2018), an independent
//   systematic review in Ecology and Society ("A review of the social-
//   ecological systems framework: applications, methods, modifications, and
//   challenges"), documents its wide adoption across hundreds of applications
//   and its status as an established analytical tool of the field. This is a
//   field-consensus / EXPERT_LITERATURE adjudication.
//   Crossref gives only year-level precision for this review, so datePrecision
//   is YEAR (occurredAt pinned to 2018-01-01).

const CLAIM_ID = 'cmpm09mr609pjsa86qx6a9gnk'

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (Partelow 2018 systematic review) ---
  const settledSource = await prisma.source.upsert({
    where: { externalId: 'src:partelow-2018-ses-framework-review' },
    create: {
      name:
        'Partelow, S. (2018). A review of the social-ecological systems framework: ' +
        'applications, methods, modifications, and challenges. Ecology and Society 23(4):36.',
      url: 'https://doi.org/10.5751/ES-10594-230436',
      publishedAt: new Date('2018-01-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-ostrom-2009-ses',
      humanReviewed: false,
      autoApproved: true,
    },
    update: {},
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-SETTLED-2018-01-01` },
    create: {
      id: `${CLAIM_ID}-SETTLED-2018-01-01`,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      reason:
        'Ostrom\'s SES framework consolidated into the field\'s standard tool for ' +
        'analyzing social-ecological systems rather than being contested or overturned. ' +
        'Partelow\'s 2018 independent systematic review in Ecology and Society documents ' +
        'its widespread adoption across hundreds of applications and its establishment as ' +
        'the dominant organizing framework, adjudicating field consensus.',
      occurredAt: new Date('2018-01-01'),
      datePrecision: 'YEAR',
      sourceId: settledSource.id,
    },
    update: {},
  })

  console.log('Ostrom 2009 SES framework: RECORDED -> SETTLED transition upserted.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
