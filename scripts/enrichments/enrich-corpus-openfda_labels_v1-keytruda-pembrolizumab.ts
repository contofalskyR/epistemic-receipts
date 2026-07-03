// Enrichment: epistemic arc for the FDA KEYTRUDA (pembrolizumab) label claim.
//
// Attaches ClaimStatusHistory rows to the EXISTING claim
// cmpiycrg38s2oplo7cnyjepaq (ingestedBy openfda_labels_v1). Does NOT create a
// new Claim. Idempotent: upserts on deterministic ids.
//
// Arc:
//   OPEN     -> RECORDED  KEYNOTE-001 phase I (Hamid et al., NEJM, 2013) — first
//                         published clinical evidence that PD-1 blockade with
//                         pembrolizumab (lambrolizumab) produced durable tumor
//                         responses in advanced melanoma.
//   RECORDED -> SETTLED   KEYNOTE-006 phase III (Robert et al., NEJM, 2015) —
//                         pembrolizumab superior to ipilimumab for advanced
//                         melanoma, establishing it as first-line standard of care.
//   SETTLED  -> CONTESTED FDA withdrawal of the third-line gastric-cancer
//                         accelerated approval (2021) after confirmatory trials
//                         failed — a post-market signal contesting unbridled
//                         indication expansion of the PD-1 blockade platform.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-keytruda-pembrolizumab.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-keytruda-pembrolizumab.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiycrg38s2oplo7cnyjepaq'

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
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2013-06-02',
    datePrecision: 'DAY',
    reason:
      'The KEYNOTE-001 phase I trial (Hamid et al., New England Journal of Medicine) reported that lambrolizumab (later pembrolizumab), an anti-PD-1 antibody, produced a high rate of durable objective responses in patients with advanced melanoma, including those previously treated with ipilimumab. This was the first published clinical evidence that PD-1 blockade with this agent worked in humans, moving the future KEYTRUDA melanoma indication from an open hypothesis to a recorded, trial-backed efficacy signal.',
    source: {
      externalId: 'src:keytruda-keynote001-nejm-2013',
      name: 'Hamid O, Robert C, Daud A, et al. Safety and tumor responses with lambrolizumab (anti-PD-1) in melanoma. N Engl J Med. 2013;369(2):134-144.',
      url: 'https://doi.org/10.1056/NEJMoa1305133',
      publishedAt: '2013-06-02',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-04-19',
    datePrecision: 'DAY',
    reason:
      'The KEYNOTE-006 phase III randomized trial (Robert et al., New England Journal of Medicine) showed pembrolizumab prolonged progression-free and overall survival versus ipilimumab, then the standard of care, in advanced melanoma, with less high-grade toxicity. This practice-changing head-to-head result settled pembrolizumab as first-line standard-of-care therapy for advanced melanoma and anchored its subsequent adoption across NCCN guidelines and the labeled indication.',
    source: {
      externalId: 'src:keytruda-keynote006-nejm-2015',
      name: 'Robert C, Schachter J, Long GV, et al. Pembrolizumab versus ipilimumab in advanced melanoma. N Engl J Med. 2015;372(26):2521-2532.',
      url: 'https://doi.org/10.1056/NEJMoa1503093',
      publishedAt: '2015-04-19',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2021-03-01',
    datePrecision: 'DAY',
    reason:
      'Following FDA scrutiny of accelerated approvals whose confirmatory trials failed, the third-line gastric-cancer indication for pembrolizumab (granted under accelerated approval on KEYNOTE-059) was voluntarily withdrawn in 2021 after KEYNOTE-061 and KEYNOTE-062 did not confirm benefit. The withdrawal did not disturb the core melanoma and NSCLC indications, but it contested the assumption that PD-1 blockade could be expanded across tumor types on early-response data alone, and is recorded on FDA\'s list of withdrawn cancer accelerated approvals.',
    source: {
      externalId: 'src:keytruda-fda-withdrawn-accel-approvals-2021',
      name: 'U.S. Food and Drug Administration. Withdrawn — Cancer Accelerated Approvals (pembrolizumab, gastric cancer third-line indication withdrawn 2021).',
      url: 'https://www.fda.gov/drugs/resources-information-approved-drugs/withdrawn-cancer-accelerated-approvals',
      publishedAt: '2021-03-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — refusing to create a new Claim.`)
  }

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    console.log(`  ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} [${histId}]`)
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1-keytruda-pembrolizumab',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
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
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
