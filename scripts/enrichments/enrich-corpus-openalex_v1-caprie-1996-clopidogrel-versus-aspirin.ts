import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   CAPRIE Steering Committee (1996). "A randomised, blinded, trial of
//   clopidogrel versus aspirin in patients at risk of ischaemic events (CAPRIE)."
//   The Lancet 348(9038): 1329-1339.
//   DOI: 10.1016/s0140-6736(96)09457-3 · OpenAlex: W311320695
//
// Baseline row (fromAxis=null -> RECORDED at 1996-11-01) already exists; NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (1997-11-17): CAPRIE was the single pivotal efficacy
//   trial supporting the U.S. FDA approval of clopidogrel bisulfate (Plavix,
//   NDA 020839, sponsor Sanofi Aventis), granted 17 November 1997 for the
//   reduction of atherothrombotic events in patients with recent MI, recent
//   stroke, or established peripheral arterial disease — exactly the population
//   and endpoint of CAPRIE. The regulatory approval is an institutional
//   adoption of the trial's finding, establishing clopidogrel as a first-line
//   antiplatelet agent. No retraction, expression of concern, or reversing
//   trial exists (verified against Crossref update metadata and openFDA).

const CLAIM_ID = 'cmply4giz006rsaihyhrh8h2t'

async function main() {
  // ── RECORDED -> SETTLED: FDA approval of clopidogrel (Plavix), CAPRIE pivotal ──
  const fda = await prisma.source.upsert({
    where: { externalId: 'src:fda-nda-020839-plavix-1997' },
    create: {
      externalId: 'src:fda-nda-020839-plavix-1997',
      name: 'U.S. FDA, Drugs@FDA — PLAVIX (clopidogrel bisulfate), NDA 020839, original approval 1997-11-17 (Sanofi Aventis).',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=020839',
      publishedAt: new Date('1997-11-17'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-caprie-1996-clopidogrel-versus-aspirin',
    },
    update: {
      name: 'U.S. FDA, Drugs@FDA — PLAVIX (clopidogrel bisulfate), NDA 020839, original approval 1997-11-17 (Sanofi Aventis).',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=020839',
      publishedAt: new Date('1997-11-17'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-1997-11-17`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('1997-11-17'),
      datePrecision: 'DAY',
      reason: 'CAPRIE was the single pivotal efficacy trial underpinning the U.S. FDA approval of clopidogrel bisulfate (Plavix, NDA 020839, Sanofi Aventis) on 17 November 1997, for reduction of atherothrombotic events in patients with recent MI, recent stroke, or established peripheral arterial disease — the exact CAPRIE population and endpoint. This regulatory adoption institutionalised the trial finding, establishing clopidogrel as a first-line antiplatelet alternative to aspirin. No retraction, expression of concern, or reversing trial was found.',
      sourceId: fda.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('1997-11-17'),
      datePrecision: 'DAY',
      reason: 'CAPRIE was the single pivotal efficacy trial underpinning the U.S. FDA approval of clopidogrel bisulfate (Plavix, NDA 020839, Sanofi Aventis) on 17 November 1997, for reduction of atherothrombotic events in patients with recent MI, recent stroke, or established peripheral arterial disease — the exact CAPRIE population and endpoint. This regulatory adoption institutionalised the trial finding, establishing clopidogrel as a first-line antiplatelet alternative to aspirin. No retraction, expression of concern, or reversing trial was found.',
      sourceId: fda.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: fda.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: fda.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via FDA approval of clopidogrel, NDA 020839, 1997-11-17)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
