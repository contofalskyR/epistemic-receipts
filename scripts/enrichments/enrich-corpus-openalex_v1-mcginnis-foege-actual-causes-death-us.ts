// Enrichment: post-publication epistemic trajectory for
// McGinnis & Foege (1993), "Actual Causes of Death in the United States,"
// JAMA 270(18):2207-2212. DOI 10.1001/jama.1993.03510180077038.
// OpenAlex W2098667370. Claim id cmpm09v5b09tjsa86m1u7hi8r.
//
// The baseline ClaimStatusHistory row (null -> RECORDED at 1993-11-10) already
// exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (EXPERT_LITERATURE, 2004-03-10, DAY precision)
//     Mokdad, Marks, Stroup & Gerberding (2004),
//     "Actual Causes of Death in the United States, 2000," JAMA 291(10):1238-1245.
//     DOI 10.1001/jama.291.10.1238.
//     The CDC leadership re-ran McGinnis & Foege's exact "actual causes of death"
//     methodology for the year 2000, adopting the framework as the standard tool
//     for quantifying nongenetic/behavioral contributors to U.S. mortality and
//     reaffirming its central finding that tobacco is the leading actual cause of
//     death (435,000 deaths), followed by poor diet/physical inactivity. Because
//     this authoritative update vindicated and institutionalized the original
//     framework and there was no prior formal contest of the McGinnis-Foege claim
//     itself, the transition goes RECORDED -> SETTLED directly. (The 2005
//     correction and the Flegal obesity dispute concern Mokdad's own
//     diet/inactivity estimate, not the McGinnis-Foege framework, and so are not
//     modeled as a contest on this claim.)
//
// Idempotent: upserts on source.externalId and a deterministic history id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mcginnis-foege-actual-causes-death-us.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm09v5b09tjsa86m1u7hi8r'

async function main() {
  // --- Source: Mokdad et al. 2004 update re-running the same methodology ---
  const src = await prisma.source.upsert({
    where: { externalId: 'src:mokdad-2004-actual-causes-death-2000' },
    create: {
      externalId: 'src:mokdad-2004-actual-causes-death-2000',
      name: 'Mokdad, Marks, Stroup & Gerberding (2004), Actual Causes of Death in the United States, 2000, JAMA 291(10):1238-1245',
      url: 'https://doi.org/10.1001/jama.291.10.1238',
      publishedAt: new Date('2004-03-10'),
      methodologyType: 'derivative',
      ingestedBy: 'enrichment',
    },
    update: {
      name: 'Mokdad, Marks, Stroup & Gerberding (2004), Actual Causes of Death in the United States, 2000, JAMA 291(10):1238-1245',
      url: 'https://doi.org/10.1001/jama.291.10.1238',
      publishedAt: new Date('2004-03-10'),
      methodologyType: 'derivative',
    },
  })

  // --- Transition: RECORDED -> SETTLED ---
  const occurredAt = new Date('2004-03-10')
  const settledId = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        "Mokdad, Marks, Stroup & Gerberding (2004, JAMA 291(10):1238-1245) re-ran McGinnis & Foege's exact 'actual causes of death' methodology for the year 2000, adopting the framework as the standard tool for quantifying nongenetic/behavioral contributors to U.S. mortality and reaffirming its central finding that tobacco is the leading actual cause of death (435,000). This authoritative CDC-led update vindicated and institutionalized the original framework; with no prior formal contest of the McGinnis-Foege claim itself, the finding settles.",
      sourceId: src.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        "Mokdad, Marks, Stroup & Gerberding (2004, JAMA 291(10):1238-1245) re-ran McGinnis & Foege's exact 'actual causes of death' methodology for the year 2000, adopting the framework as the standard tool for quantifying nongenetic/behavioral contributors to U.S. mortality and reaffirming its central finding that tobacco is the leading actual cause of death (435,000). This authoritative CDC-led update vindicated and institutionalized the original framework; with no prior formal contest of the McGinnis-Foege claim itself, the finding settles.",
      sourceId: src.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: RECORDED -> SETTLED (Mokdad et al. 2004 update)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
