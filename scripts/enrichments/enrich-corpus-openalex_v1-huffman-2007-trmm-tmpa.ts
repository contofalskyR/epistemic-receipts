// Enrichment: post-publication epistemic trajectory for Huffman et al. 2007,
// "The TRMM Multisatellite Precipitation Analysis (TMPA): Quasi-Global,
// Multiyear, Combined-Sensor Precipitation Estimates at Fine Scales,"
// Journal of Hydrometeorology 2007;8(1):38–55, DOI 10.1175/jhm560.1.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 2007-02-01 publication date) already exists — do NOT duplicate it.
//
// Post-publication event (verified):
//   TMPA (the TRMM 3B42/3B43 product line described by this paper) was
//   institutionally retired by NASA. Production ceased on 2019-12-31 and the
//   product was formally superseded by the GPM-era Integrated Multi-satellitE
//   Retrievals for GPM (IMERG), which reprocessed the entire TRMM-era record
//   (2000–present) under a unified algorithm and became the recommended
//   multi-satellite precipitation dataset. This is an institutional
//   supersession/retirement by the issuing body — the TMPA merging approach
//   was carried forward and improved in IMERG, NOT scientifically refuted.
//   RECORDED -> REVERSED. Community: INSTITUTIONAL.
//
// Sources verified 2026-07-15:
//   NASA GPM "TMPA-to-IMERG Transition" (2 Oct 2020) -> HTTP 200
//   IMERG successor chapter DOI 10.1007/978-3-030-24568-9_19 -> HTTP 200
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-huffman-2007-trmm-tmpa.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-huffman-2007-trmm-tmpa.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w4zj900lxsa8h4co16rav'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2019-12-31',
    datePrecision: 'DAY',
    reason:
      'NASA institutionally retired the TMPA product line (TRMM 3B42/3B43) described by this paper: production ceased on 31 December 2019 and TMPA was formally superseded by the GPM-era Integrated Multi-satellitE Retrievals for GPM (IMERG), documented in NASA\'s "TMPA-to-IMERG Transition" guidance. IMERG reprocessed the full TRMM-era record (2000–present) under a single unified algorithm and became NASA\'s recommended multi-satellite precipitation dataset, so the specific 2007 TMPA product is no longer produced or recommended. This is an institutional supersession/retirement by the issuing agency — the calibration-based multi-satellite merging approach was carried forward and improved in IMERG, not a scientific refutation of the underlying method.',
    source: {
      externalId: 'src:nasa-tmpa-to-imerg-transition-2020',
      name: 'NASA Global Precipitation Measurement Mission, "TMPA-to-IMERG Transition" (2 October 2020). Documents the discontinuation of TMPA (TRMM 3B42/3B43, production ended 31 December 2019) and its replacement by GPM IMERG.',
      url: 'https://gpm.nasa.gov/sites/default/files/2020-10/TMPA-to-IMERG_transition_201002.pdf',
      publishedAt: '2020-10-02',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} — ${TRANSITIONS.length} post-publication transition(s)${DRY_RUN ? ' (dry-run)' : ''}`)

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry-run] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.datePrecision}) | ${slug}`)
      console.log(`            source: ${tr.source.externalId} -> ${tr.source.url}`)
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
        ingestedBy: 'enrich:openalex_v1',
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
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'AGAINST' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
