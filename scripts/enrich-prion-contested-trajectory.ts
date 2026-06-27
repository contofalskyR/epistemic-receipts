// Enrich: insert the missing CONTESTED phase into the prion-hypothesis trajectory.
//
// Two near-duplicate seed claims record Prusiner's 1982 prion proposal as a clean
// RECORDED (1982-04-09, Science) -> SETTLED (1997-10-06, Nobel Prize) arc. That arc
// skips the genuine, decade-long CONTESTED phase that the historical record (and the
// claims' own reason text) describes: the protein-only model had a formally-articulated
// rival, the "virino" hypothesis (an agent carrying its own small nucleic-acid genome
// shielded by host protein), advanced principally by the Edinburgh Neuropathogenesis
// Unit. The canonical, dateable, citable statement of that rival is:
//
//   Dickinson AG, Outram GW. "Genetic aspects of unconventional virus infections:
//   the basis of the virino hypothesis." Ciba Found Symp. 1988;135:63-83. PMID 3044709.
//
// Verified against PubMed (https://pubmed.ncbi.nlm.nih.gov/3044709/) on 2026-06-24.
// This is a real RECORDED->CONTESTED transition with a verifiable source and a specific
// (year-precision) date, inserted in the house style established by the EPR and
// 2,4-DNP trajectories (a CONTESTED step added between the existing RECORDED and SETTLED
// rows; the existing RECORDED->SETTLED row is left untouched, matching the EPR pattern).
//
// No other low-transition trajectory was enriched: the ~5,700 openalex retraction arcs
// hold only publication+retraction dates (no Expression-of-Concern data) and most are
// direct retractions, and the remaining curated seed arcs are genuine 2-step arcs whose
// "contestation" was diffuse establishment skepticism rather than a single dated dispute
// artifact. Fabricating intermediate steps from model memory is the USPTO Pipeline 5
// failure mode and is deliberately avoided here.
//
// Idempotent: skips any claim that already has a CONTESTED transition.
//
// Run:     npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-prion-contested-trajectory.ts
// Dry-run: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-prion-contested-trajectory.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

// The two near-duplicate prion seed claims (both RECORDED 1982-04-09 -> SETTLED 1997-10-06).
const PRION_CLAIM_IDS = [
  'cmqkx6skn01lfsatb82535yzg',
  'cmqmkqzix02rvsaasfef5z2za',
]

const VIRINO_SOURCE = {
  externalId: 'pubmed:3044709',
  name: 'Dickinson AG, Outram GW. Genetic aspects of unconventional virus infections: the basis of the virino hypothesis. Ciba Found Symp. 1988;135:63-83. PMID 3044709.',
  url: 'https://pubmed.ncbi.nlm.nih.gov/3044709/',
  publishedAt: new Date('1988-01-01'),
  methodologyType: 'primary' as const,
}

const CONTESTED_REASON =
  "Prusiner's protein-only model was met with sustained skepticism from its 1982 publication onward, " +
  "because it contradicted the central dogma that a transmissible agent must carry a nucleic-acid genome. " +
  "The principal rival was formalised by A. G. Dickinson and G. W. Outram of the Edinburgh Neuropathogenesis " +
  "Unit as the 'virino hypothesis' (Ciba Foundation Symposium 135, 1988): the scrapie agent carries its own " +
  "small, agent-specific nucleic-acid genome shielded by host protein, with strain differences encoded by that " +
  "genome rather than by protein conformation alone. For roughly a decade the TSE field divided into protein-only " +
  "(San Francisco) and virino/nucleic-acid (Edinburgh) camps, leaving the very nature of the infectious agent " +
  "actively contested in the expert literature."

async function main() {
  console.log(`\nEnrich prion CONTESTED phase${DRY_RUN ? ' [DRY-RUN]' : ''}\n`)

  let enriched = 0

  for (const claimId of PRION_CLAIM_IDS) {
    const claim = await prisma.claim.findUnique({ where: { id: claimId } })
    if (!claim) {
      console.log(`  SKIP ${claimId}: claim not found`)
      continue
    }

    const existing = await prisma.claimStatusHistory.findMany({ where: { claimId } })
    if (existing.some((t) => t.toAxis === 'CONTESTED')) {
      console.log(`  SKIP ${claimId}: already has a CONTESTED transition`)
      continue
    }

    console.log(`  ENRICH ${claimId}: ${claim.text.slice(0, 70)}...`)
    console.log(`     + RECORDED -> CONTESTED @ 1988 (YEAR) [EXPERT_LITERATURE] src=${VIRINO_SOURCE.url}`)

    if (DRY_RUN) {
      enriched++
      continue
    }

    await prisma.$transaction(async (tx) => {
      const source = await tx.source.upsert({
        where: { externalId: VIRINO_SOURCE.externalId },
        update: {},
        create: {
          name: VIRINO_SOURCE.name,
          url: VIRINO_SOURCE.url,
          publishedAt: VIRINO_SOURCE.publishedAt,
          methodologyType: VIRINO_SOURCE.methodologyType,
          externalId: VIRINO_SOURCE.externalId,
          ingestedBy: 'enrich:prion-contested-trajectory',
          humanReviewed: false,
          autoApproved: false,
        },
      })

      await tx.claimStatusHistory.create({
        data: {
          claimId,
          fromAxis: 'RECORDED',
          toAxis: 'CONTESTED',
          community: 'EXPERT_LITERATURE',
          occurredAt: new Date('1988-01-01'),
          datePrecision: 'YEAR',
          reason: CONTESTED_REASON,
          sourceId: source.id,
        },
      })
    })

    enriched++
  }

  console.log(`\nDone. Enriched ${enriched} claim(s).\n`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
