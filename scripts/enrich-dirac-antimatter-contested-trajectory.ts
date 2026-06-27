// Enrich: insert the missing CONTESTED phase into the Dirac antimatter-prediction trajectory.
//
// The seed claim records Dirac's 1928 relativistic electron equation as a clean
// RECORDED (1928-01-02, "The Quantum Theory of the Electron") -> SETTLED (1932-08-02,
// Anderson's positron) arc. That arc skips the genuine, several-year CONTESTED phase
// over what the negative-energy solutions actually MEANT — i.e. over whether they
// "implied the existence of antimatter" at all:
//
//   - Dirac himself first denied a new particle: in "A Theory of Electrons and Protons"
//     (Proc. Roy. Soc. A 126, 360, 1930) he identified the negative-energy "holes" with
//     the already-known proton, to avoid postulating an unobserved particle.
//   - J. Robert Oppenheimer formally refuted that identification in "On the Theory of
//     Electrons and Protons" (Phys. Rev. 35, 562-573, received 14 Feb 1930): if the holes
//     were protons, ordinary hydrogen would self-annihilate in ~1e-10 s, and the hole had
//     to carry the electron's mass, not the proton's.
//   - Hermann Weyl independently showed (1931) the hole's mass must equal the electron's,
//     killing the proton interpretation.
//   - Only then did Dirac reinterpret the holes as a new "anti-electron" ("Quantised
//     Singularities in the Electromagnetic Field," Proc. Roy. Soc. A 133, 60, 1931).
//   - The dispute was resolved empirically by Anderson's 1932 positron (the existing
//     RECORDED->SETTLED row).
//
// This is a named, dated dispute artifact in the expert literature — the same bar applied
// to the prion/virino and Pasteur/Liebig enrichments — NOT the diffuse establishment
// skepticism that disqualifies cases like Lister antisepsis or the H. pylori reception.
// The transition is sourced to Oppenheimer's 1930 refutation paper.
//
// Verified 2026-06-27 against:
//   - J. R. Oppenheimer, "On the Theory of Electrons and Protons," Phys. Rev. 35, 562-573
//     (1930); received 14 Feb 1930, issue dated 1 Mar 1930; DOI 10.1103/PhysRev.35.562.
//     (https://link.aps.org/doi/10.1103/PhysRev.35.562, ADS 1930PhRv...35..562O)
//   - "Positron" / "Antiparticle", en.wikipedia.org: Dirac's 1930 proton interpretation,
//     Oppenheimer's and Weyl's 1930-31 refutations, and Dirac's 1931 anti-electron paper.
//
// A month-precision RECORDED->CONTESTED transition (1930-03, Oppenheimer's published
// refutation) is inserted in the house style established by the prion and fermentation
// trajectories: a CONTESTED step added between the existing RECORDED and SETTLED rows; the
// existing RECORDED->SETTLED row is left untouched. Fabricating intermediate steps from
// model memory is the USPTO Pipeline 5 failure mode and is deliberately avoided — this
// transition rests on the verified source above.
//
// Idempotent: skips the claim if it already has a CONTESTED transition.
//
// Run:     npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-dirac-antimatter-contested-trajectory.ts
// Dry-run: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-dirac-antimatter-contested-trajectory.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

// Seed claim: "In a paper published on 2 January 1928, Paul Dirac formulated a relativistic
// wave equation for the electron whose negative-energy solutions implied the existence of
// antimatter." (RECORDED 1928-01-02 -> SETTLED 1932-08-02)
const DIRAC_CLAIM_ID = 'cmqhrs5h001c28ozh3wnltnts'

const OPPENHEIMER_SOURCE = {
  externalId: 'doi:10.1103/PhysRev.35.562',
  name: 'Oppenheimer JR. On the Theory of Electrons and Protons. Physical Review 35:562-573, 1930 (received 14 Feb 1930). DOI 10.1103/PhysRev.35.562. (Refutes Dirac\'s identification of the negative-energy "holes" with the proton: hydrogen would self-annihilate and the hole must carry the electron\'s mass, forcing the later anti-electron interpretation.)',
  url: 'https://link.aps.org/doi/10.1103/PhysRev.35.562',
  publishedAt: new Date('1930-03-01'),
  methodologyType: 'primary' as const,
}

const CONTESTED_REASON =
  "What Dirac's 1928 negative-energy solutions physically meant was actively contested in the " +
  "expert literature for several years. Dirac himself initially rejected a new particle: in 'A " +
  "Theory of Electrons and Protons' (Proc. Roy. Soc. A 126, 360, 1930) he identified the " +
  "negative-energy 'holes' with the already-known proton to avoid postulating an unobserved " +
  "particle. J. Robert Oppenheimer formally refuted this in 'On the Theory of Electrons and " +
  "Protons' (Phys. Rev. 35, 562, received 14 Feb 1930), showing that if the holes were protons " +
  "ordinary hydrogen would self-annihilate almost instantly and that the hole must carry the " +
  "electron's mass; Hermann Weyl reached the same mass conclusion in 1931. Only after these " +
  "refutations did Dirac reinterpret the holes as a new 'anti-electron' ('Quantised Singularities " +
  "in the Electromagnetic Field', Proc. Roy. Soc. A 133, 60, 1931). The question of whether the " +
  "equation implied a genuinely new antimatter particle thus remained open and disputed until " +
  "Anderson's 1932 cloud-chamber detection of the positron settled it empirically."

async function main() {
  console.log(`\nEnrich Dirac antimatter CONTESTED phase${DRY_RUN ? ' [DRY-RUN]' : ''}\n`)

  const claim = await prisma.claim.findUnique({ where: { id: DIRAC_CLAIM_ID } })
  if (!claim) {
    console.log(`  ABORT: claim ${DIRAC_CLAIM_ID} not found`)
    return
  }

  const existing = await prisma.claimStatusHistory.findMany({ where: { claimId: DIRAC_CLAIM_ID } })
  if (existing.some((t) => t.toAxis === 'CONTESTED')) {
    console.log(`  SKIP ${DIRAC_CLAIM_ID}: already has a CONTESTED transition`)
    return
  }

  console.log(`  ENRICH ${DIRAC_CLAIM_ID}: ${claim.text.slice(0, 70)}...`)
  console.log(`     + RECORDED -> CONTESTED @ 1930-03 (MONTH) [EXPERT_LITERATURE] src=${OPPENHEIMER_SOURCE.url}`)

  if (DRY_RUN) {
    console.log('\nDone. [DRY-RUN] would enrich 1 claim.\n')
    return
  }

  await prisma.$transaction(async (tx) => {
    const source = await tx.source.upsert({
      where: { externalId: OPPENHEIMER_SOURCE.externalId },
      update: {},
      create: {
        name: OPPENHEIMER_SOURCE.name,
        url: OPPENHEIMER_SOURCE.url,
        publishedAt: OPPENHEIMER_SOURCE.publishedAt,
        methodologyType: OPPENHEIMER_SOURCE.methodologyType,
        externalId: OPPENHEIMER_SOURCE.externalId,
        ingestedBy: 'enrich:dirac-antimatter-contested-trajectory',
        humanReviewed: false,
        autoApproved: false,
      },
    })

    await tx.claimStatusHistory.create({
      data: {
        claimId: DIRAC_CLAIM_ID,
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: new Date('1930-03-01'),
        datePrecision: 'MONTH',
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
