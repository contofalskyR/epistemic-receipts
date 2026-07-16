// Enrichment: post-publication epistemic trajectory for David J. Teece's
// "Profiting from technological innovation: Implications for integration,
// collaboration, licensing and public policy" (the PFI framework).
//
// Claim:    cmplyocjj00hhsaqkoviihp66
// DOI:      10.1016/0048-7333(93)90063-n  (Research Policy 22(2):112–113, 1993;
//           OpenAlex clusters this with the original 1986 Research Policy 15(6):285–305)
// OpenAlex: W2142257426
//
// The baseline row (fromAxis=null -> RECORDED at 1993-04-01) already exists; do
// NOT duplicate it. This script adds the one verified downstream transition.
//
// Arc:
//   RECORDED -> SETTLED (2006-10, EXPERT_LITERATURE)
//     Twenty years after publication, Research Policy — the journal that first
//     published the PFI framework — devoted a 20th-anniversary special issue
//     (vol. 35, issue 8, Oct 2006) to reassessing it. The issue, introduced by
//     Chesbrough, Birkinshaw & Teubal (DOI 10.1016/j.respol.2006.09.001) and
//     containing reflective contributions from the field's leading scholars —
//     Richard Nelson (10.1016/j.respol.2006.09.007), Sidney Winter
//     (10.1016/j.respol.2006.09.010), Gary Pisano (10.1016/j.respol.2006.09.008),
//     McGahan & Silverman (10.1016/j.respol.2006.09.006), and Teece himself
//     (10.1016/j.respol.2006.09.009) — affirmed the framework's appropriability /
//     complementary-assets logic as a durable, foundational pillar of innovation,
//     strategy, and technology-management scholarship. A same-journal anniversary
//     symposium convened by the field's leading authorities marks field consensus,
//     not contest, and settles the framework as canonical.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-teece-profiting-technological-innovation-1993.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-teece-profiting-technological-innovation-1993.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyocjj00hhsaqkoviihp66'

interface Transition {
  fromAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED'
  toAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED'
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2006-10-01',
    datePrecision: 'MONTH',
    reason:
      'Twenty years on, Research Policy — the journal that published the framework — devoted a 20th-anniversary special issue (vol. 35, issue 8, October 2006) to reassessing Teece\'s "Profiting from Innovation" (PFI). The symposium, introduced by Chesbrough, Birkinshaw & Teubal and containing reflective contributions from the field\'s leading scholars (Nelson, Winter, Pisano, McGahan & Silverman, and Teece himself), affirmed the framework\'s appropriability and complementary-assets logic as a durable, foundational pillar of innovation and strategy scholarship. A same-journal anniversary symposium convened by the field\'s foremost authorities marks field consensus and settles the framework as canonical.',
    source: {
      externalId: 'src:teece-pfi-research-policy-20th-anniversary-special-issue-2006',
      name: 'Chesbrough H, Birkinshaw J, Teubal M. Introduction to the Research Policy 20th anniversary special issue of the publication of "Profiting from Innovation" by David J. Teece. Research Policy 2006;35(8):1091–1099.',
      url: 'https://doi.org/10.1016/j.respol.2006.09.001',
      publishedAt: '2006-10-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry] ${slug}  ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.community})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich-corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        reason: tr.reason,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        reason: tr.reason,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`  ✓ ${slug}  ${tr.fromAxis} -> ${tr.toAxis} (${tr.community})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
