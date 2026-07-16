// Enrichment: post-publication epistemic trajectory for the EORTC-NCIC 5-year
// analysis of radiotherapy + temozolomide in glioblastoma (Stupp et al.,
// Lancet Oncology 2009).
//
// Claim: cmply5wai00wfsaihwjs08lfw
// DOI:   https://doi.org/10.1016/s1470-2045(09)70025-7  (OpenAlex W2158681922)
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 2009-03-10 online publication date) already exists and is NOT duplicated here.
//
// One verified follow-up transition:
//   RECORDED -> SETTLED (2013-04-30, EXPERT_LITERATURE)
//     The Cochrane systematic review "Temozolomide for high grade glioma"
//     (Hart MG, Garside R, Rogers G, Stein K, Grant R; Cochrane Database of
//     Systematic Reviews, 30 Apr 2013; PMID 23633341;
//     DOI 10.1002/14651858.CD007415.pub2) pooled the randomised evidence —
//     with the EORTC-NCIC trial (this paper and its long-term follow-up) as the
//     pivotal study — and concluded that adding temozolomide to radiotherapy
//     improves overall and progression-free survival in newly diagnosed
//     high-grade glioma. The finding was never contested; the review vindicates
//     it, settling the "Stupp regimen" as the evidence-based standard.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-stupp-eortc-ncic-temozolomide-glioblastoma-5yr-2009.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply5wai00wfsaihwjs08lfw'

async function main() {
  // ── RECORDED -> SETTLED : Cochrane systematic review (2013-04-30) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:cochrane-hart-temozolomide-high-grade-glioma-2013' },
    create: {
      externalId: 'src:cochrane-hart-temozolomide-high-grade-glioma-2013',
      name: 'Hart MG, Garside R, Rogers G, Stein K, Grant R. "Temozolomide for high grade glioma." Cochrane Database of Systematic Reviews 2013, Issue 4, CD007415. PMID 23633341.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/23633341/',
      publishedAt: new Date('2013-04-30'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1',
    },
    update: {
      name: 'Hart MG, Garside R, Rogers G, Stein K, Grant R. "Temozolomide for high grade glioma." Cochrane Database of Systematic Reviews 2013, Issue 4, CD007415. PMID 23633341.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/23633341/',
      publishedAt: new Date('2013-04-30'),
    },
  })

  const occurredAt = new Date('2013-04-30')
  const histId = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'The Cochrane systematic review "Temozolomide for high grade glioma" (Hart et al., 30 Apr 2013) pooled the randomised trial evidence — with the EORTC-NCIC trial reported here as the pivotal study — and concluded that adding temozolomide to radiotherapy improves overall and progression-free survival in newly diagnosed high-grade glioma. The finding was never contested; the review adjudicates and vindicates it, settling the concomitant-plus-adjuvant temozolomide ("Stupp") regimen as the evidence-based standard of care.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'The Cochrane systematic review "Temozolomide for high grade glioma" (Hart et al., 30 Apr 2013) pooled the randomised trial evidence — with the EORTC-NCIC trial reported here as the pivotal study — and concluded that adding temozolomide to radiotherapy improves overall and progression-free survival in newly diagnosed high-grade glioma. The finding was never contested; the review adjudicates and vindicates it, settling the concomitant-plus-adjuvant temozolomide ("Stupp") regimen as the evidence-based standard of care.',
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
  }

  console.log(`  ✓ ${histId} (RECORDED -> SETTLED, Cochrane 2013)`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
