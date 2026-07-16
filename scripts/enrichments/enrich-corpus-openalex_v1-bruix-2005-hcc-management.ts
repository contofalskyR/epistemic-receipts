// Enrichment: epistemic trajectory for the 2005 AASLD Practice Guideline
// "Management of Hepatocellular Carcinoma" (Bruix J, Sherman M; Hepatology 2005;42:1208-1236).
// Claim: cmplyavxk03axsaihjmkimq9u  ·  DOI 10.1002/hep.20933  ·  OpenAlex W2163486683
//
// Baseline RECORDED row (fromAxis=null -> RECORDED @ 2005-10-26) already exists; not duplicated here.
//
// Post-publication adjudicating event:
//   RECORDED -> SETTLED @ 2011-03 — AASLD issued a formal PRACTICE-GUIDELINE UPDATE
//   ("Management of hepatocellular carcinoma: an update", Bruix & Sherman, Hepatology
//   2011;53:1020-1022; DOI 10.1002/hep.24199; PMID 21374666). The association reaffirmed and
//   refined the 2005 framework — the BCLC staging system, HCC surveillance strategy, and the
//   curative-vs-palliative treatment-allocation algorithm — institutionalizing the 2005
//   recommendations as the standard-of-care approach rather than overturning them.
//   Community: INSTITUTIONAL (a professional-society clinical guideline).
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bruix-2005-hcc-management.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmplyavxk03axsaihjmkimq9u'

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
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-03-01',
    datePrecision: 'MONTH',
    reason:
      'In March 2011 the AASLD published a formal update to the 2005 practice guideline (Bruix & Sherman, "Management of hepatocellular carcinoma: an update," Hepatology 2011;53:1020-1022). The update reaffirmed and refined — rather than overturned — the 2005 framework, retaining the BCLC staging system, the ultrasound-based surveillance strategy, and the curative-vs-palliative treatment-allocation algorithm as the association-endorsed standard of care. This institutional re-issuance settled the 2005 recommendations as consensus HCC management doctrine.',
    source: {
      externalId: 'src:aasld-hcc-guideline-update-2011',
      name: 'Bruix J, Sherman M. Management of hepatocellular carcinoma: an update. AASLD Practice Guideline. Hepatology 2011;53(3):1020-1022. PMID 21374666; DOI 10.1002/hep.24199.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/21374666/',
      publishedAt: '2011-03-01',
      methodologyType: 'derivative',
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
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
      },
    })

    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
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
