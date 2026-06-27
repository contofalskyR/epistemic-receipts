// Enrich: insert the missing CONTESTED phase into the Pasteur lactic-fermentation trajectory.
//
// The seed claim records Pasteur's 1857 "Mémoire sur la fermentation appelée lactique"
// as a clean RECORDED (1857-11-30, the memoir) -> SETTLED (1900) arc. That arc skips the
// genuine, decades-long CONTESTED phase that the historical record describes: Pasteur's
// biological ("vitalist") theory of fermentation had a formally-articulated, published
// rival — Justus von Liebig's chemical/mechanical theory, which held that fermentation
// is a form of molecular decomposition, not the work of living cells. Liebig defended
// this against Pasteur's public challenge and set out his critical observations in print
// in 1870 (the artifact to which Pasteur replied in his "Reply to the Critical
// Observations of Liebig, Published in 1870").
//
// This is a named, dated dispute artifact — the same bar applied to the prion/virino
// enrichment (enrich-prion-contested-trajectory.ts), NOT the diffuse establishment
// skepticism that disqualifies cases like Lister antisepsis or the H. pylori reception.
// The rivalry was only resolved after Pasteur's death, by Eduard Buchner's 1897
// demonstration of cell-free ("zymase") fermentation, which reconciled the two camps.
//
// Verified 2026-06-26 against:
//   - "Liebig–Pasteur dispute", en.wikipedia.org (named dispute; Liebig's 1869 public
//     response and 1870 published critical observations).
//   - Manchester KL. "Louis Pasteur, fermentation, and a rival." South African Journal
//     of Science 103(9-10), 2007 — peer-reviewed history-of-science account of Liebig as
//     Pasteur's rival (chemical/decomposition theory) and the resolution via Buchner 1897.
//
// A year-precision RECORDED->CONTESTED transition (1870, Liebig's published critique) is
// inserted in the house style established by the prion and EPR trajectories: a CONTESTED
// step added between the existing RECORDED and SETTLED rows; the existing RECORDED->SETTLED
// row is left untouched. Fabricating intermediate steps from model memory is the USPTO
// Pipeline 5 failure mode and is deliberately avoided — this transition rests on the
// verified sources above.
//
// Idempotent: skips the claim if it already has a CONTESTED transition.
//
// Run:     npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-fermentation-contested-trajectory.ts
// Dry-run: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-fermentation-contested-trajectory.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const FERMENTATION_CLAIM_ID = 'cmqiy402x02vksapezd1zs49r'

// Marker source for the contestation: a peer-reviewed history-of-science account that
// documents Liebig's rival chemical theory and the dispute (verified by fetch 2026-06-26).
const LIEBIG_DISPUTE_SOURCE = {
  externalId: 'sajs:pasteur-fermentation-rival-2007',
  name: 'Manchester KL. Louis Pasteur, fermentation, and a rival. South African Journal of Science 103(9-10):377-380, 2007. (Documents Justus von Liebig\'s chemical/decomposition theory of fermentation as the published rival to Pasteur\'s biological theory, and the resolution via Buchner\'s 1897 cell-free fermentation.)',
  url: 'https://scielo.org.za/scielo.php?script=sci_arttext&pid=S0038-23532007000500008',
  publishedAt: new Date('2007-01-01'),
  methodologyType: 'derivative' as const,
}

const CONTESTED_REASON =
  "Pasteur's biological theory — that fermentation is the work of living microorganisms — " +
  "faced a formally-articulated published rival in Justus von Liebig's chemical (mechanical) " +
  "theory, which held that fermentation is a form of molecular decomposition initiated by " +
  "unstable albuminous matter rather than by the growth and multiplication of cells. Liebig " +
  "responded publicly to Pasteur's challenge in 1869 and set out his critical observations in " +
  "print in 1870 (the text to which Pasteur published a formal 'Reply to the Critical " +
  "Observations of Liebig, Published in 1870'). For decades the nature of fermentation was " +
  "actively contested between the biological (Pasteur) and chemical (Liebig) camps; the dispute " +
  "was only reconciled after Pasteur's death by Eduard Buchner's 1897 demonstration of cell-free " +
  "('zymase') fermentation, which vindicated Pasteur's cellular agent while validating Liebig's " +
  "insight that a soluble chemical catalyst does the work."

async function main() {
  console.log(`\nEnrich fermentation CONTESTED phase${DRY_RUN ? ' [DRY-RUN]' : ''}\n`)

  const claim = await prisma.claim.findUnique({ where: { id: FERMENTATION_CLAIM_ID } })
  if (!claim) {
    console.log(`  ABORT: claim ${FERMENTATION_CLAIM_ID} not found`)
    return
  }

  const existing = await prisma.claimStatusHistory.findMany({ where: { claimId: FERMENTATION_CLAIM_ID } })
  if (existing.some((t) => t.toAxis === 'CONTESTED')) {
    console.log(`  SKIP ${FERMENTATION_CLAIM_ID}: already has a CONTESTED transition`)
    return
  }

  console.log(`  ENRICH ${FERMENTATION_CLAIM_ID}: ${claim.text.slice(0, 70)}...`)
  console.log(`     + RECORDED -> CONTESTED @ 1870 (YEAR) [EXPERT_LITERATURE] src=${LIEBIG_DISPUTE_SOURCE.url}`)

  if (DRY_RUN) {
    console.log('\nDone. [DRY-RUN] would enrich 1 claim.\n')
    return
  }

  await prisma.$transaction(async (tx) => {
    const source = await tx.source.upsert({
      where: { externalId: LIEBIG_DISPUTE_SOURCE.externalId },
      update: {},
      create: {
        name: LIEBIG_DISPUTE_SOURCE.name,
        url: LIEBIG_DISPUTE_SOURCE.url,
        publishedAt: LIEBIG_DISPUTE_SOURCE.publishedAt,
        methodologyType: LIEBIG_DISPUTE_SOURCE.methodologyType,
        externalId: LIEBIG_DISPUTE_SOURCE.externalId,
        ingestedBy: 'enrich:fermentation-contested-trajectory',
        humanReviewed: false,
        autoApproved: false,
      },
    })

    await tx.claimStatusHistory.create({
      data: {
        claimId: FERMENTATION_CLAIM_ID,
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: new Date('1870-01-01'),
        datePrecision: 'YEAR',
        reason: CONTESTED_REASON,
        sourceId: source.id,
      },
    })
  })

  console.log(`\nDone. Enriched 1 claim.\n`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
