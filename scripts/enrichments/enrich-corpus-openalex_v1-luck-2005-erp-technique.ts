// Enrichment: post-publication epistemic trajectory for Luck SJ,
// "An Introduction to the Event-Related Potential Technique," MIT Press, 2005.
// OpenAlex W1536620489. DOI: not available. Claim id: cmpm10w5q012dsadnxd21imhq.
//
// Baseline row (fromAxis=null -> RECORDED at 2005-08-12, the book's publication) already
// exists; NOT duplicated here.
//
// Added arc:
//   RECORDED -> SETTLED (2014-01): The Society for Psychophysiological Research (SPR)
//   committee report — Keil A, Debener S, Gratton G, Junghöfer M, Kappenman ES, Luck SJ,
//   Luu P, Miller GA, Yee CM, "Committee report: Publication guidelines and recommendations
//   for studies using electroencephalography and magnetoencephalography," Psychophysiology
//   2014;51(1):1-21, PMID 24147581, DOI 10.1111/psyp.12147 — codified ERP/EEG methodology
//   into formal, field-wide publication and reporting standards. This institutional consensus
//   statement, co-authored by Luck himself (the book's author), represents the field's
//   adoption of the ERP technique as an established, standardized method for observing
//   cognition-linked brain activity, settling the claim in the expert/institutional record.
//
// No retraction or expression of concern exists (isRetracted=false; a methods textbook, not
// an empirical finding, so no failed-replication surface). No CONTESTED step: the technique
// was institutionalized, not challenged, on the record. A second edition of the book (MIT
// Press, 2014, ISBN 9780262525855) independently corroborates its durable field-standard
// status but is not used as the adjudicating source (same author/work).
//
// Idempotent: upserts on externalId / id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-luck-2005-erp-technique.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-luck-2005-erp-technique.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm10w5q012dsadnxd21imhq'

async function main() {
  // ── RECORDED -> SETTLED : SPR committee report codifies ERP/EEG methodology (2014) ──
  const sourceExternalId = 'src:spr-eeg-meg-publication-guidelines-keil-2014'
  const sourceData = {
    name: 'Keil A, Debener S, Gratton G, Jungh\u00f6fer M, Kappenman ES, Luck SJ, Luu P, Miller GA, Yee CM. Committee report: Publication guidelines and recommendations for studies using electroencephalography and magnetoencephalography. Psychophysiology 2014;51(1):1-21. PMID 24147581; DOI 10.1111/psyp.12147.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24147581/',
    publishedAt: new Date('2014-01-01'),
    methodologyType: 'derivative' as const,
  }

  const occurredAt = new Date('2014-01-01')
  const historyId = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  const historyData = {
    claimId: CLAIM_ID,
    fromAxis: 'RECORDED' as const,
    toAxis: 'SETTLED' as const,
    community: 'INSTITUTIONAL' as const,
    occurredAt,
    datePrecision: 'MONTH' as const,
    reason:
      'The Society for Psychophysiological Research committee report (Keil et al., Psychophysiology 51:1-21, 2014) established formal, field-wide guidelines and a reporting checklist for EEG/MEG and event-related potential studies, institutionalizing the ERP technique as a standardized method for measuring cognition-linked brain activity. Co-authored by Luck himself, this consensus statement reflects the field\u2019s settled adoption of the practices his 2005 book set out. The book is neither retracted nor contested, and reached a second edition (MIT Press, 2014).',
  }

  if (DRY_RUN) {
    console.log('[dry-run] would upsert source:', sourceExternalId)
    console.log('[dry-run] would upsert claimStatusHistory:', historyId)
    console.log(JSON.stringify({ source: sourceData, history: historyData }, null, 2))
    await prisma.$disconnect()
    return
  }

  await prisma.source.upsert({
    where: { externalId: sourceExternalId },
    create: { externalId: sourceExternalId, ...sourceData },
    update: sourceData,
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: historyId },
    create: { id: historyId, ...historyData },
    update: historyData,
  })

  console.log('Upserted source + claimStatusHistory:', historyId)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
