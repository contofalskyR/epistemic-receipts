import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Pearson, T.A., Mensah, G.A., Alexander, R.W., et al. (2003),
//   "Markers of Inflammation and Cardiovascular Disease: Application to Clinical
//    and Public Health Practice: A Statement for Healthcare Professionals From
//    the Centers for Disease Control and Prevention and the American Heart
//    Association," Circulation 107(3): 499-511.
//   DOI: 10.1161/01.CIR.0000052939.59093.45 · OpenAlex: W2163092745
//
// Baseline row (fromAxis=null -> RECORDED at 2003-01-28) already exists; do NOT
// duplicate it. The claim reports the AHA/CDC statement's cautious 2003 posture:
// inflammatory markers (notably hs-CRP) were "not yet considered applicable for
// routine risk assessment" owing to measurement-standardization and epidemiologic
// gaps. This is not a retractable empirical finding but a consensus posture, so
// there is no retraction, failed replication, or meta-analysis to record.
//
// The post-publication arc is a FIELD-CONSENSUS SHIFT: over the following decade
// hs-CRP moved from "not yet applicable" to a guideline-endorsed risk-assessment
// tool.
//
//   RECORDED -> SETTLED  (2010 ACCF/AHA Guideline for Assessment of
//     Cardiovascular Risk in Asymptomatic Adults, Greenland P et al.,
//     Circulation 2010;122(25):e584-636, Epub 2010-11-15. This guideline formally
//     incorporated high-sensitivity CRP into the cardiovascular risk-assessment
//     framework, giving hs-CRP measurement a Class IIa recommendation for
//     selected intermediate-risk asymptomatic adults — the institutional adoption
//     that the 2003 statement said had "not yet" occurred.)
//
// The adjudication is a national clinical guideline from the ACCF/AHA Task Force
// on Practice Guidelines, hence community INSTITUTIONAL.

const CLAIM_ID = 'cmplydk9f04krsaihdruw676c'

async function main() {
  // ── RECORDED -> SETTLED: 2010 ACCF/AHA asymptomatic-risk guideline ──
  const guideline = await prisma.source.upsert({
    where: { externalId: 'src:accf-aha-2010-asymptomatic-cv-risk-guideline' },
    create: {
      externalId: 'src:accf-aha-2010-asymptomatic-cv-risk-guideline',
      name: 'Greenland P, Alpert JS, Beller GA, et al. (2010). 2010 ACCF/AHA Guideline for Assessment of Cardiovascular Risk in Asymptomatic Adults: A Report of the ACCF/AHA Task Force on Practice Guidelines. Circulation 122(25):e584-e636. Epub 2010-11-15. DOI: 10.1161/CIR.0b013e3182051b4c. PMID: 21098428. Gave hs-CRP measurement a Class IIa recommendation for cardiovascular risk assessment in selected asymptomatic adults.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/21098428/',
      publishedAt: new Date('2010-11-15'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-pearson-2003-inflammatory-markers-cvd',
    },
    update: {
      name: 'Greenland P, Alpert JS, Beller GA, et al. (2010). 2010 ACCF/AHA Guideline for Assessment of Cardiovascular Risk in Asymptomatic Adults: A Report of the ACCF/AHA Task Force on Practice Guidelines. Circulation 122(25):e584-e636. Epub 2010-11-15. DOI: 10.1161/CIR.0b013e3182051b4c. PMID: 21098428. Gave hs-CRP measurement a Class IIa recommendation for cardiovascular risk assessment in selected asymptomatic adults.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/21098428/',
      publishedAt: new Date('2010-11-15'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2010-11-15`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2010-11-15'),
      datePrecision: 'DAY',
      reason: 'The 2003 CDC/AHA statement held that inflammatory markers were "not yet considered applicable for routine risk assessment." The 2010 ACCF/AHA Guideline for Assessment of Cardiovascular Risk in Asymptomatic Adults resolved that posture institutionally by formally incorporating high-sensitivity CRP into the risk-assessment framework, assigning hs-CRP a Class IIa recommendation for selected intermediate-risk asymptomatic adults. This national guideline adoption marks the field-consensus shift from "not yet" to an endorsed clinical role.',
      sourceId: guideline.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2010-11-15'),
      datePrecision: 'DAY',
      sourceId: guideline.id,
    },
  })

  const gEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: guideline.id } })
  if (!gEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: guideline.id, type: 'SUPPORTS' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via 2010 ACCF/AHA asymptomatic-risk guideline incorporating hs-CRP)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
