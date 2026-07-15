// Enrichment: post-publication epistemic arc for the PRISMA 2009 Statement.
//
// Claim: cmplztvcu02ddsa86i71p33a6 (openalex_v1, W2005501262)
//   "Preferred Reporting Items for Systematic Reviews and Meta-Analyses:
//    The PRISMA Statement" — Moher, Liberati, Tetzlaff, Altman et al.,
//    Annals of Internal Medicine, 2009-08-18. DOI 10.7326/0003-4819-151-4-200908180-00135.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 2009-08-18) already
// exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15):
//   - No retraction and no expression of concern (Crossref update-to: none; PubMed 19621072).
//   - No dated failed replication or methodological critique paper overturning the statement.
//   - The reporting-guideline paradigm the 2009 statement introduced was so thoroughly
//     adopted that the same expert body (the PRISMA Group) issued a formal, updated
//     consensus — the PRISMA 2020 statement (Page et al., BMJ 2021;372:n71, 2021-03-29,
//     DOI 10.1136/bmj.n71, PubMed 33782057). PRISMA 2020 explicitly "updates" rather than
//     refutes the 2009 guideline, affirming its foundational reporting framework as the
//     durable field standard while modernizing the checklist. This is a vindication /
//     settling event ratified by the expert literature — RECORDED -> SETTLED.
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-prisma-2009-statement.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplztvcu02ddsa86i71p33a6'

async function main() {
  // ── RECORDED -> SETTLED: PRISMA 2020 statement reaffirms + updates the standard ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:prisma-2020-statement-bmj-n71' },
    create: {
      externalId: 'src:prisma-2020-statement-bmj-n71',
      name: 'Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. BMJ 2021;372:n71. DOI 10.1136/bmj.n71.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/33782057/',
      publishedAt: new Date('2021-03-29'),
      methodologyType: 'primary',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. BMJ 2021;372:n71. DOI 10.1136/bmj.n71.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/33782057/',
      publishedAt: new Date('2021-03-29'),
      methodologyType: 'primary',
    },
  })

  const slug = `${CLAIM_ID}-SETTLED-2021-03-29`
  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2021-03-29'),
      datePrecision: 'DAY',
      sourceId: source.id,
      reason:
        'The PRISMA Group issued the PRISMA 2020 statement (BMJ 2021;372:n71, 2021-03-29), a formal updated consensus that explicitly updates — rather than refutes — the 2009 statement. By reaffirming the 2009 reporting-guideline framework as the durable standard for systematic reviews while modernizing its checklist, the expert literature ratified the original finding: RECORDED -> SETTLED.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2021-03-29'),
      datePrecision: 'DAY',
      sourceId: source.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED @ 2021-03-29)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
