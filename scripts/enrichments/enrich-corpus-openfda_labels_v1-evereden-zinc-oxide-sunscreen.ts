// Enrichment: epistemic arc for the FDA-label claim
// "Evereden Kids Mineral Sunscreen SPF 30 (ZINC OXIDE): PURPOSE: Sunscreen"
// (claim cmpiygnm58wkiplo7gksfytr1).
//
// The OTC drug label was published 2026-07-01, but the underlying fact — that
// zinc oxide is a safe, effective, photostable broad-spectrum (UVA/UVB)
// sunscreen active ingredient — has a multi-decade epistemic arc that predates
// this particular product label:
//   1. OPEN     -> RECORDED : microfine zinc oxide characterized as a photostable
//                             broad-spectrum UVA/UVB sunblock (Mitchnick et al.,
//                             J Am Acad Dermatol, 1999)
//   2. RECORDED -> SETTLED  : FDA proposes zinc oxide (and titanium dioxide) as the
//                             only two GRASE Category I sunscreen actives (2019)
//   3. SETTLED  -> CONTESTED: post-market photostability/ecotoxicity safety signal —
//                             zinc-oxide sunscreen degrades and gains aquatic
//                             toxicity under UV (Ginzburg et al., 2021)
//
// Does NOT create a new Claim — enriches the existing openfda_labels_v1 claim.
// The existing null->first ClaimStatusHistory entry is left untouched.
//
// Idempotent: upserts source + claimStatusHistory on stable ids.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-evereden-zinc-oxide-sunscreen.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-evereden-zinc-oxide-sunscreen.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiygnm58wkiplo7gksfytr1'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
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
  // ── OPEN -> RECORDED : microfine zinc oxide characterized as broad-spectrum sunblock ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1999-01-01',
    datePrecision: 'MONTH',
    reason:
      'Mitchnick, Fairhurst and Pinnell characterized microfine zinc oxide (Z-Cote) as a photostable inorganic sunscreen providing protection across both the UVB and UVA (including UVA-I) wavebands, publishing the transmission/attenuation data in the Journal of the American Academy of Dermatology (January 1999). The paper placed zinc oxide in the peer-reviewed record as a broad-spectrum, cosmetically acceptable physical sunblock agent — the scientific basis for later mineral SPF products such as this one. This established the recorded clinical/photobiological evidence for zinc oxide as a sunscreen active.',
    source: {
      externalId: 'src:mitchnick-zinc-oxide-sunblock-jaad-1999',
      name: 'Mitchnick MA, Fairhurst D, Pinnell SR. Microfine zinc oxide (Z-Cote) as a photostable UVA/UVB sunblock agent. J Am Acad Dermatol. 1999;40(1):85-90.',
      url: 'https://doi.org/10.1016/S0190-9622(99)70532-3',
      publishedAt: '1999-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED : FDA proposes zinc oxide as GRASE (one of only two) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2019-02-21',
    datePrecision: 'DAY',
    reason:
      'On February 21, 2019 the FDA announced a proposed rule for over-the-counter sunscreens in which, of the 16 marketed active ingredients reviewed, only two — zinc oxide and titanium dioxide — had sufficient safety data for the agency to propose them as generally recognized as safe and effective (GRASE, Category I). By singling out zinc oxide as one of the two mineral filters the FDA regarded as settled-safe, the agency cemented zinc-oxide sunscreens as the regulatory gold standard for OTC broad-spectrum sun protection. This institutional determination moved the recorded evidence to settled standard-of-care status.',
    source: {
      externalId: 'src:fda-sunscreen-grase-proposed-rule-2019',
      name: 'U.S. Food and Drug Administration. FDA advances new proposed regulation to make sure that sunscreens are safe and effective (Feb 21, 2019).',
      url: 'https://www.fda.gov/news-events/press-announcements/fda-advances-new-proposed-regulation-make-sure-sunscreens-are-safe-and-effective',
      publishedAt: '2019-02-21',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED : post-market photostability / ecotoxicity signal ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2021-01-01',
    datePrecision: 'YEAR',
    reason:
      'In 2021 Ginzburg and colleagues reported in Photochemical & Photobiological Sciences that sunscreen formulations containing zinc oxide nanoparticles lost photoprotective efficacy and generated degradation products that became measurably toxic to aquatic model organisms (zebrafish embryos) after roughly two hours of UV exposure. The finding raised a post-market safety and stability signal specific to the zinc-oxide active — the very ingredient the FDA had treated as settled-safe — contesting the assumption that mineral sunscreens are photochemically inert. It did not withdraw zinc oxide, but reopened debate over nanoparticle formulation safety and environmental impact.',
    source: {
      externalId: 'src:ginzburg-zinc-oxide-uv-toxicity-2021',
      name: 'Ginzburg AL, Blackburn RS, Santillan C, Truong L, Tanguay RL, Hutchison JE. Zinc oxide-induced changes to sunscreen ingredient efficacy and toxicity under UV irradiation. Photochem Photobiol Sci. 2021;20(10):1273-1285.',
      url: 'https://doi.org/10.1007/s43630-021-00101-2',
      publishedAt: '2021-01-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions${DRY_RUN ? ' [DRY RUN]' : ''}...`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    console.error(`  ✗ Claim ${CLAIM_ID} not found — aborting.`)
    await prisma.$disconnect()
    process.exit(1)
  }

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${slug} (${tr.fromAxis} -> ${tr.toAxis}) src=${tr.source.externalId}`)
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
        ingestedBy: 'enrich:openfda_labels_v1-evereden-zinc-oxide-sunscreen',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
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
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId: CLAIM_ID, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`\nDone. ${TRANSITIONS.length} transitions enriched for ${CLAIM_ID}.`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
