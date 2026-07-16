// Enrichment: post-publication epistemic trajectory for the 2013 AHA/ASA
// "Guidelines for the Early Management of Patients With Acute Ischemic Stroke"
// (Jauch EC et al., Stroke 2013;44:870-947; DOI 10.1161/str.0b013e318284056a;
// OpenAlex W2171165037).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the 2013
// publication date) already exists — this script does NOT duplicate it.
//
// Arc (institutional guideline lifecycle, all AHA/ASA):
//   RECORDED -> CONTESTED  (2015-10) — 2015 Focused Update Regarding
//        Endovascular Treatment revised the 2013 endovascular recommendations
//        after MR CLEAN/ESCAPE/EXTEND-IA/SWIFT PRIME/REVASCAT overturned the
//        2013 guideline's weak stance on mechanical thrombectomy.
//   CONTESTED -> ABANDONED (2018-03) — 2018 Guidelines fully superseded and
//        replaced the 2013 guidelines.
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-jauch-2013-acute-ischemic-stroke-guidelines.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmpm0tu9d0j3vsa86553c1wlz'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
}

const transitions: Transition[] = [
  {
    source: {
      externalId: 'src:aha-asa-2015-focused-update-endovascular',
      name: '2015 AHA/ASA Focused Update of the 2013 Guidelines for the Early Management of Patients With Acute Ischemic Stroke Regarding Endovascular Treatment (Powers WJ et al., Stroke 2015;46:3020-3035)',
      url: 'https://doi.org/10.1161/STR.0000000000000074',
      publishedAt: '2015-10-01',
      methodologyType: 'derivative',
    },
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2015-10-01',
    datePrecision: 'MONTH',
    reason:
      "The same AHA/ASA writing body issued a formal Focused Update revising the 2013 guideline's endovascular-treatment recommendations. Positive thrombectomy trials published in 2014-2015 (MR CLEAN, ESCAPE, EXTEND-IA, SWIFT PRIME, REVASCAT) overturned the 2013 guideline's weak stance on mechanical thrombectomy, upgrading stent-retriever thrombectomy to a Class I recommendation. Parts of the 2013 guidance were thereby superseded within two years.",
  },
  {
    source: {
      externalId: 'src:aha-asa-2018-aishcstroke-guidelines',
      name: '2018 Guidelines for the Early Management of Patients With Acute Ischemic Stroke: A Guideline for Healthcare Professionals From the AHA/ASA (Powers WJ et al., Stroke 2018;49:e46-e110)',
      url: 'https://doi.org/10.1161/STR.0000000000000158',
      publishedAt: '2018-03-01',
      methodologyType: 'derivative',
    },
    fromAxis: 'CONTESTED',
    toAxis: 'ABANDONED',
    community: 'INSTITUTIONAL',
    occurredAt: '2018-03-01',
    datePrecision: 'MONTH',
    reason:
      "The AHA/ASA published a comprehensive replacement guideline that fully superseded and retired the 2013 guidelines (and the 2015 focused update) as the operative standard of care for acute ischemic stroke. The 2013 document ceased to be the governing institutional guidance, marking its formal retirement rather than a wholesale reversal of its content.",
  },
]

async function main() {
  for (const tr of transitions) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-jauch-2013-acute-ischemic-stroke-guidelines',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
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

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('Done: 2 transitions upserted for claim', claimId)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
