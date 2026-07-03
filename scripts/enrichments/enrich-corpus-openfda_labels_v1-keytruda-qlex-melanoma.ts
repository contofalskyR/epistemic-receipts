// Enrichment: epistemic arc for the KEYTRUDA QLEX (pembrolizumab + berahyaluronidase
// alfa) melanoma indication claim (openfda_labels_v1).
//
// The 2026 KEYTRUDA QLEX subcutaneous formulation inherits its melanoma efficacy
// evidence from intravenous pembrolizumab. This enrichment traces that underlying
// evidentiary arc:
//   OPEN -> RECORDED : KEYNOTE-006, the pivotal Phase III RCT in advanced melanoma
//                      (Robert et al., NEJM, 2015).
//   RECORDED -> SETTLED : anti-PD-1 blockade became standard-of-care across the
//                      melanoma continuum, extended to the adjuvant (curative-intent)
//                      setting by KEYNOTE-054 (Eggermont et al., NEJM, 2018).
//
// No SETTLED -> CONTESTED / REVERSED transition is added: pembrolizumab's melanoma
// indications have not been withdrawn, downgraded, or subjected to a post-market
// safety reversal. Fabricating one would violate the HARD_FACT no-recall rule.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-keytruda-qlex-melanoma.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-keytruda-qlex-melanoma.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmpixs1m78456plo7xlcw5bao'

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
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-06-25',
    datePrecision: 'DAY',
    reason:
      'The KEYNOTE-006 randomized Phase III trial (Robert et al., New England Journal of Medicine, June 2015) compared pembrolizumab against ipilimumab in 834 patients with advanced melanoma and showed superior progression-free and overall survival with a better safety profile. This was the first pivotal controlled evidence that PD-1 blockade with pembrolizumab outperformed the prior standard of care, moving the melanoma efficacy claim from open question to recorded clinical fact.',
    source: {
      externalId: 'src:keynote-006-nejm-2015',
      name: 'Robert C, Schachter J, Long GV, et al. Pembrolizumab versus Ipilimumab in Advanced Melanoma (KEYNOTE-006). N Engl J Med. 2015;372(26):2521-2532.',
      url: 'https://doi.org/10.1056/NEJMoa1503093',
      publishedAt: '2015-06-25',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2018-05-10',
    datePrecision: 'DAY',
    reason:
      'By 2018 pembrolizumab was established first-line standard-of-care for advanced melanoma in major guidelines, and the KEYNOTE-054 randomized trial (Eggermont et al., New England Journal of Medicine, May 2018) extended that proven benefit to the adjuvant setting in resected stage III disease, showing significantly longer recurrence-free survival versus placebo. This cemented PD-1 blockade across the melanoma treatment continuum — from metastatic to curative-intent adjuvant therapy — and the indication has remained settled and unchallenged, carried forward into the 2026 KEYTRUDA QLEX subcutaneous formulation.',
    source: {
      externalId: 'src:keynote-054-nejm-2018',
      name: 'Eggermont AMM, Blank CU, Mandala M, et al. Adjuvant Pembrolizumab versus Placebo in Resected Stage III Melanoma (KEYNOTE-054). N Engl J Med. 2018;378(19):1789-1801.',
      url: 'https://doi.org/10.1056/NEJMoa1802357',
      publishedAt: '2018-05-10',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const slug = `${claimId}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`
    if (DRY_RUN) {
      console.log(`[dry-run] source ${t.source.externalId} + statusHistory ${slug} (${t.fromAxis} -> ${t.toAxis})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'openfda_labels_v1_enrichment',
        humanReviewed: false,
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${slug} (${t.fromAxis} -> ${t.toAxis})`)
  }

  console.log(`Done. ${TRANSITIONS.length} transition(s) processed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
