// Enrichment: post-publication trajectory for Cavanna & Trimble (2006),
// "The precuneus: a review of its functional anatomy and behavioural correlates", Brain 129:564-583.
// Claim: cmpm5ozjm27t1sadn5yscc1b0 (openalex_v1, W2111613011)
//
// Baseline ClaimStatusHistory row (null -> RECORDED at 2006-01-06) already exists.
// This script adds the single verified post-publication adjudication:
//   RECORDED -> SETTLED (2014-01-15) — Utevsky, Smith & Huettel empirically confirmed
//   the precuneus as a functional CORE of the default-mode network, vindicating
//   Cavanna & Trimble's central proposal that this "traditionally neglected" region
//   is a hub for highly integrated cognitive functions.
//
// Not retracted (Retraction Watch / Crossref checked 2026-07-16; a 2016 Correction
// to Utevsky is a minor errata, not a retraction and not relevant here).
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-precuneus-functional-anatomy.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm5ozjm27t1sadn5yscc1b0'

async function main() {
  // ── RECORDED -> SETTLED: 2014 study confirms the precuneus as a functional core of the DMN ──
  await prisma.source.upsert({
    where: { externalId: 'src:utevsky-precuneus-dmn-core-2014' },
    create: {
      externalId: 'src:utevsky-precuneus-dmn-core-2014',
      name: 'Utevsky, Smith & Huettel (2014), "Precuneus Is a Functional Core of the Default-Mode Network", The Journal of Neuroscience 34(3):932-940 (PMID 24431451)',
      url: 'https://doi.org/10.1523/jneurosci.4227-13.2014',
      publishedAt: new Date('2014-01-15'),
      methodologyType: 'primary',
    },
    update: {
      name: 'Utevsky, Smith & Huettel (2014), "Precuneus Is a Functional Core of the Default-Mode Network", The Journal of Neuroscience 34(3):932-940 (PMID 24431451)',
      url: 'https://doi.org/10.1523/jneurosci.4227-13.2014',
      publishedAt: new Date('2014-01-15'),
      methodologyType: 'primary',
    },
  })

  const occurredAt = new Date('2014-01-15')
  const slug = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'Cavanna & Trimble proposed that the precuneus \u2014 a "traditionally neglected" posteromedial parietal region \u2014 is a central node for highly integrated cognition. Using independent component analysis of task and resting-state fMRI, Utevsky, Smith & Huettel (J Neurosci, 2014) demonstrated that the precuneus is a functional core of the default-mode network, with distinct functional roles across DMN subsystems, empirically confirming the region\u2019s hub status. This adjudicates the original review\u2019s claim as settled consensus rather than overturning it.',
      sourceExternalId: 'src:utevsky-precuneus-dmn-core-2014',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'Cavanna & Trimble proposed that the precuneus \u2014 a "traditionally neglected" posteromedial parietal region \u2014 is a central node for highly integrated cognition. Using independent component analysis of task and resting-state fMRI, Utevsky, Smith & Huettel (J Neurosci, 2014) demonstrated that the precuneus is a functional core of the default-mode network, with distinct functional roles across DMN subsystems, empirically confirming the region\u2019s hub status. This adjudicates the original review\u2019s claim as settled consensus rather than overturning it.',
      sourceExternalId: 'src:utevsky-precuneus-dmn-core-2014',
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED, 2014-01-15)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
