import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Steele, C. M. & Aronson, J. (1995), "Stereotype threat and the intellectual
//   test performance of African Americans," Journal of Personality and Social
//   Psychology 69(5): 797-811.
//   DOI: 10.1037/0022-3514.69.5.797 · OpenAlex: W4293105157
//
// Baseline row (fromAxis=null -> RECORDED at 1995-11-01) already exists; NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2004-04): Stricker & Ward's large-sample study for
//   Educational Testing Service ("Stereotype Threat, Inquiring About Test
//   Takers' Ethnicity and Gender, and Standardized Test Performance," Journal
//   of Applied Social Psychology 34(4): 665-693, DOI
//   10.1111/j.1559-1816.2004.tb02564.x) failed to replicate the predicted
//   stereotype-threat effect on the operational standardized-test performance
//   of Black and female test takers, opening a sustained methodological
//   dispute. That contest was reinforced by later meta-analytic evidence
//   (Shewach, Sackett & Quint 2019, J. Applied Psychology 104(12): 1514-1534,
//   DOI 10.1037/apl0000420) showing the effect largely disappears in settings
//   resembling real testing conditions. The finding still has laboratory
//   support and defenders, so the terminal state is CONTESTED, not
//   SETTLED or REVERSED.

const CLAIM_ID = 'cmpm1avaf05p7sadnvinwadfm'

async function main() {
  // ── RECORDED -> CONTESTED: Stricker & Ward (2004) non-replication ──
  const stricker = await prisma.source.upsert({
    where: { externalId: 'src:stricker-ward-2004-stereotype-threat-nonreplication' },
    create: {
      externalId: 'src:stricker-ward-2004-stereotype-threat-nonreplication',
      name: 'Stricker, L. J. & Ward, W. C. (2004). "Stereotype Threat, Inquiring About Test Takers\' Ethnicity and Gender, and Standardized Test Performance." Journal of Applied Social Psychology 34(4): 665-693.',
      url: 'https://doi.org/10.1111/j.1559-1816.2004.tb02564.x',
      publishedAt: new Date('2004-04-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1-steele-aronson-1995-stereotype-threat',
    },
    update: {
      name: 'Stricker, L. J. & Ward, W. C. (2004). "Stereotype Threat, Inquiring About Test Takers\' Ethnicity and Gender, and Standardized Test Performance." Journal of Applied Social Psychology 34(4): 665-693.',
      url: 'https://doi.org/10.1111/j.1559-1816.2004.tb02564.x',
      publishedAt: new Date('2004-04-01'),
    },
  })

  const histId = `${CLAIM_ID}-CONTESTED-2004-04-01`
  const reason =
    'A large-sample field study conducted for Educational Testing Service (Stricker & Ward 2004) tested Steele & Aronson\'s prediction under near-operational conditions and failed to find the expected stereotype-threat effect on the standardized-test performance of Black and female examinees, launching a sustained methodological dispute over the effect\'s robustness and generalizability. The contestation was later reinforced by meta-analytic evidence (Shewach, Sackett & Quint 2019) that the effect largely vanishes in settings with features typical of real testing. Because the finding retains laboratory support and active defenders, it entered scholarly contestation rather than being settled or overturned.'
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2004-04-01'),
      datePrecision: 'MONTH',
      reason,
      sourceId: stricker.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2004-04-01'),
      datePrecision: 'MONTH',
      reason,
      sourceId: stricker.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: stricker.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: stricker.id, type: 'AGAINST' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> CONTESTED via Stricker & Ward 2004)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
