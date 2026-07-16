// Enrichment: post-publication epistemic trajectory for Sauer R, Becker H, Hohenberger W,
// Rödel C, et al. (German Rectal Cancer Study Group), "Preoperative versus Postoperative
// Chemoradiotherapy for Rectal Cancer," N Engl J Med 2004;351:1731-1740,
// DOI 10.1056/NEJMoa040694. OpenAlex W2125452425. Trial: CAO/ARO/AIO-94.
// Claim id: cmplyfoqd05klsaihi8pjcu64.
//
// Baseline row (fromAxis=null -> RECORDED at 2004-10-20) already exists; NOT duplicated here.
//
// Added arc:
//   RECORDED -> SETTLED (2012-06-01): The long-term (median 11-year) follow-up of the
//   same randomized phase III trial — Sauer R, Liersch T, Merkel S, Fietkau R, Hohenberger W,
//   Hess C, ... Rödel C, "Preoperative Versus Postoperative Chemoradiotherapy for Locally
//   Advanced Rectal Cancer: Results of the German CAO/ARO/AIO-94 Randomized Phase III Trial
//   After a Median Follow-Up of 11 Years," J Clin Oncol 2012;30(16):1926-1933,
//   DOI 10.1200/JCO.2011.40.1836 — confirmed the original finding: preoperative
//   chemoradiotherapy produced a durable, significant reduction in local recurrence
//   (10-year cumulative incidence 7.1% vs 10.1%, p=0.048) versus postoperative therapy,
//   with no difference in overall survival. This dated, peer-reviewed long-term analysis
//   of the trial's own cohort vindicated the finding as established standard-of-care in
//   expert literature.
//
// No retraction, expression of concern, or dated failed replication was found
// (Retraction Watch / NEJM / PubMed all clean; isRetracted=false). No CONTESTED step:
// the finding was corroborated, not challenged, on the record.
//
// Idempotent: upserts on externalId / id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-sauer-2004-preop-rectal-chemoradiotherapy.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-sauer-2004-preop-rectal-chemoradiotherapy.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyfoqd05klsaihi8pjcu64'

async function main() {
  // ── RECORDED -> SETTLED : 11-year follow-up of the CAO/ARO/AIO-94 trial vindicates finding (2012) ──
  const sourceExternalId = 'src:sauer-cao-aro-aio94-11yr-jco-2012'
  const sourceData = {
    name: 'Sauer R, Liersch T, Merkel S, Fietkau R, Hohenberger W, Hess C, Becker H, Raab HR, Villanueva MT, Witzigmann H, Wittekind C, Beissbarth T, R\u00f6del C. Preoperative Versus Postoperative Chemoradiotherapy for Locally Advanced Rectal Cancer: Results of the German CAO/ARO/AIO-94 Randomized Phase III Trial After a Median Follow-Up of 11 Years. J Clin Oncol 2012;30(16):1926-1933.',
    url: 'https://doi.org/10.1200/JCO.2011.40.1836',
    publishedAt: new Date('2012-06-01'),
    methodologyType: 'primary' as const,
  }

  const occurredAt = new Date('2012-06-01')
  const historyId = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  const historyData = {
    claimId: CLAIM_ID,
    fromAxis: 'RECORDED' as const,
    toAxis: 'SETTLED' as const,
    community: 'EXPERT_LITERATURE' as const,
    occurredAt,
    datePrecision: 'DAY' as const,
    reason:
      'The long-term (median 11-year) follow-up of the same CAO/ARO/AIO-94 randomized phase III trial (Sauer et al., J Clin Oncol 30:1926-1933, 2012) confirmed the original 2004 finding: preoperative chemoradiotherapy produced a durable, significant reduction in local recurrence (10-year cumulative incidence 7.1% vs 10.1%, p=0.048) compared with postoperative chemoradiotherapy, with no difference in overall survival. This dated, peer-reviewed long-term analysis vindicated the finding, which had become established standard-of-care; the paper is neither retracted nor overturned.',
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
