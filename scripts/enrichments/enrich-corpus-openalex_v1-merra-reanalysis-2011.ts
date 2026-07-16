// Epistemic-receipt enrichment: post-publication trajectory for
// Rienecker et al. (2011), "MERRA: NASA's Modern-Era Retrospective Analysis
// for Research and Applications", Journal of Climate 24(14):3624–3648.
// DOI: 10.1175/JCLI-D-11-00015.1 · OpenAlex: W2051416171.
// Claim id: cmq2w5o3w010lsa8heq5hj0ox.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2011-04-08) already exists and is NOT duplicated here.
//
// No retraction or expression of concern exists (Crossref update-to/updated-by
// both "none"). The post-publication arc is a dataset supersession: the reanalysis
// this paper describes was terminated and replaced by a corrected successor,
// MERRA-2, undertaken specifically to address MERRA's documented water-cycle
// deficiencies — the exact achievement this claim asserts ("significant
// improvements in precipitation and water cycle").
//
// Post-publication events added:
//   RECORDED -> CONTESTED (2016-02-29, INSTITUTIONAL)
//     NASA GMAO completed/terminated MERRA production and moved to MERRA-2, a new
//     version undertaken because MERRA exhibited known deficiencies (spurious
//     trends/discontinuities in the water cycle tied to observing-system changes;
//     no aerosol assimilation), putting MERRA's standing as the current standard
//     in question.
//   CONTESTED -> REVERSED (2017-07, EXPERT_LITERATURE)
//     The peer-reviewed MERRA-2 paper (Gelaro et al. 2017) formally superseded
//     MERRA as the GMAO reanalysis product, documenting MERRA's spurious
//     water-cycle trends and adding aerosol assimilation. MERRA-2 became the
//     reanalysis cited going forward.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-merra-reanalysis-2011.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w5o3w010lsa8heq5hj0ox'

type FactStatus =
  | 'OPEN'
  | 'RECORDED'
  | 'SETTLED'
  | 'CONTESTED'
  | 'REVERSED'
  | 'ABANDONED'
  | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE'
  | 'INSTITUTIONAL'
  | 'JUDICIAL'
  | 'PUBLIC'
  | 'MARKET'
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
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-02-29',
    datePrecision: 'DAY',
    reason:
      'NASA\'s Global Modeling and Assimilation Office completed MERRA reanalysis production on 29 February 2016 and transitioned to MERRA-2. Per GMAO\'s own product page, MERRA-2 was undertaken to incorporate advances that MERRA lacked — notably to correct spurious trends and discontinuities in the water cycle associated with changes in the satellite observing system, and to add assimilation of aerosols. This institutional decision to freeze and replace MERRA directly qualified the paper\'s headline claim of "significant improvements in precipitation and water cycle."',
    source: {
      externalId: 'src:gmao-merra-production-ended-2016',
      name: 'NASA GMAO. Modern-Era Retrospective analysis for Research and Applications (MERRA): production completed 29 February 2016; superseded by MERRA-2.',
      url: 'https://gmao.gsfc.nasa.gov/reanalysis/MERRA/',
      publishedAt: '2016-02-29',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2017-07-01',
    datePrecision: 'MONTH',
    reason:
      'The peer-reviewed MERRA-2 paper (Gelaro et al., "The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2)", J. Climate 30(14):5419–5454) formally superseded MERRA as GMAO\'s reanalysis standard. It documents the deficiencies of MERRA that motivated the replacement — including spurious jumps and trends in the represented water cycle — and introduces aerosol assimilation and updated model physics. From this point the community cited MERRA-2 in place of MERRA as the current reanalysis product.',
    source: {
      externalId: 'src:gelaro-merra2-2017',
      name: 'Gelaro R, McCarty W, Suárez MJ, et al. The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2). Journal of Climate 2017;30(14):5419–5454.',
      url: 'https://doi.org/10.1175/jcli-d-16-0758.1',
      publishedAt: '2017-07-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
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

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
