import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Griffith, D.E. et al. (2007), "An Official ATS/IDSA Statement: Diagnosis,
//   Treatment, and Prevention of Nontuberculous Mycobacterial Diseases,"
//   Am J Respir Crit Care Med 175(4): 367-416.
//   OpenAlex: W2142447693 (2007-02-15) · DOI: 10.1164/rccm.200604-571st
//
// Baseline row (fromAxis=null -> RECORDED at 2007-02-01) already exists; NOT duplicated here.
//
// Post-publication arc added:
//   RECORDED -> SETTLED (2020-08-14): The 2007 ATS/IDSA statement was itself the
//     field-consensus guideline establishing diagnostic criteria (clinical,
//     radiographic, and microbiologic) for NTM lung disease. It was superseded by
//     the official ATS/ERS/ESCMID/IDSA Clinical Practice Guideline (Daley CL,
//     Iaccarino JM, Lange C, et al., "Treatment of Nontuberculous Mycobacterial
//     Pulmonary Disease," Clin Infect Dis 2020;71(4):e1-e36,
//     DOI 10.1093/cid/ciaa241; PMID 32628747). The 2020 guideline — a formal
//     GRADE-based consensus of four professional societies — carried the 2007
//     diagnostic criteria forward substantially intact while updating treatment
//     recommendations. This constitutes an institutional field-consensus settling:
//     the 2007 diagnostic framework became durable, cross-society consensus.
//   There was no prior contest (no retraction, correction, or dated methodological
//   rebuttal of the statement exists), so the single transition goes
//   RECORDED -> SETTLED directly.

const CLAIM_ID = 'cmply6v4g01dfsaih7t9l3w7v'

async function main() {
  // ── RECORDED -> SETTLED: 2020 ATS/ERS/ESCMID/IDSA Clinical Practice Guideline ──
  const daley2020 = await prisma.source.upsert({
    where: { externalId: 'src:daley-2020-ats-ers-escmid-idsa-ntm-guideline' },
    create: {
      externalId: 'src:daley-2020-ats-ers-escmid-idsa-ntm-guideline',
      name: 'Daley, C.L., Iaccarino, J.M., Lange, C., Cambau, E., Wallace, R.J., Andrejak, C., et al. (2020). "Treatment of Nontuberculous Mycobacterial Pulmonary Disease: An Official ATS/ERS/ESCMID/IDSA Clinical Practice Guideline." Clinical Infectious Diseases 71(4): e1-e36.',
      url: 'https://doi.org/10.1093/cid/ciaa241',
      publishedAt: new Date('2020-08-14'),
      methodologyType: 'review',
      ingestedBy: 'enrich:openalex_v1-griffith-2007-ats-idsa-ntm-statement',
    },
    update: {
      name: 'Daley, C.L., Iaccarino, J.M., Lange, C., Cambau, E., Wallace, R.J., Andrejak, C., et al. (2020). "Treatment of Nontuberculous Mycobacterial Pulmonary Disease: An Official ATS/ERS/ESCMID/IDSA Clinical Practice Guideline." Clinical Infectious Diseases 71(4): e1-e36.',
      url: 'https://doi.org/10.1093/cid/ciaa241',
      publishedAt: new Date('2020-08-14'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2020-08-14`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2020-08-14'),
      datePrecision: 'DAY',
      reason: 'The 2007 ATS/IDSA statement established the diagnostic criteria (clinical, radiographic, microbiologic) for nontuberculous mycobacterial lung disease. It was formally superseded by the 2020 ATS/ERS/ESCMID/IDSA Clinical Practice Guideline (Daley et al., Clin Infect Dis 71(4):e1-e36), a GRADE-based consensus of four professional societies that carried the 2007 diagnostic framework forward substantially intact while updating treatment recommendations. This institutional cross-society reaffirmation settles the diagnostic criteria as durable field consensus.',
      sourceId: daley2020.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2020-08-14'),
      datePrecision: 'DAY',
      reason: 'The 2007 ATS/IDSA statement established the diagnostic criteria (clinical, radiographic, microbiologic) for nontuberculous mycobacterial lung disease. It was formally superseded by the 2020 ATS/ERS/ESCMID/IDSA Clinical Practice Guideline (Daley et al., Clin Infect Dis 71(4):e1-e36), a GRADE-based consensus of four professional societies that carried the 2007 diagnostic framework forward substantially intact while updating treatment recommendations. This institutional cross-society reaffirmation settles the diagnostic criteria as durable field consensus.',
      sourceId: daley2020.id,
    },
  })

  const edge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: daley2020.id } })
  if (!edge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: daley2020.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via 2020 ATS/ERS/ESCMID/IDSA NTM clinical practice guideline)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
