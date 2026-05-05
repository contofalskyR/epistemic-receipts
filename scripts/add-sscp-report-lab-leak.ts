// Add SSCP Final Report (Dec 2024) as a source on the lab leak parent claim.
// Run: npx tsx scripts/add-sscp-report-lab-leak.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const REVIEW = {
  ingestedBy:       'manual',
  humanReviewed:    true,
  reviewConfidence: 'HIGH' as const,
  reviewedBy:       'robert',
  reviewedAt:       new Date(),
}

async function main() {
  const parent = await prisma.claim.findFirstOrThrow({
    where: { text: { contains: 'SARS-CoV-2 originated from a laboratory' } },
  })
  console.log(`Found parent claim: ${parent.id}`)

  const sscp = await prisma.source.create({ data: {
    name:            'House Select Subcommittee on the Coronavirus Pandemic — Final Report (Dec 2024)',
    url:             'https://oversight.house.gov/wp-content/uploads/2024/12/12.04.2024-SSCP-FINAL-REPORT.pdf',
    publishedAt:     new Date('2024-12-04'),
    methodologyType: 'primary',
    ...REVIEW,
  }})
  console.log(`Created source: ${sscp.id}`)

  const e = await prisma.edge.create({
    data: {
      sourceId:      sscp.id,
      claimId:       parent.id,
      type:          'FOR',
      evidenceType:  'EVIDENTIARY',
      ...REVIEW,
    },
  })

  await prisma.edgeRevision.create({
    data: {
      edgeId:     e.id,
      priorScore: null,
      newScore:   70,
      reason:     'Republican-led House investigation; reviewed classified intelligence and interviewed 30+ witnesses. ' +
                  'Concluded SARS-CoV-2 "most likely" originated from a research-related incident at the WIV. ' +
                  'First congressional body to issue a formal final report on COVID-19 origins. ' +
                  'Partisan composition (Republican majority) is a signal to weight; conclusion nonetheless aligns with DOE/FBI tier.',
    },
  })

  console.log(`Created edge: ${e.id} (FOR, score 70)`)
  console.log('Done.')
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
