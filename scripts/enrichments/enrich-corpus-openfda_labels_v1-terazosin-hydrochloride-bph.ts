// Enrichment: epistemic arc for the terazosin (TERAZOSIN HYDROCHLORIDE) BPH
// indication claim (openfda_labels_v1).
//
// Claim id: cmpiye99q8tvoplo70btubrh4
// Claim: terazosin capsules are indicated for symptomatic benign prostatic
// hyperplasia (BPH), ~70% response, long-term effect on surgery/obstruction
// "yet to be determined."
//
// Arc (chronological, epistemically coherent):
//   OPEN     -> RECORDED  (1996) definitive multicenter RCT records efficacy
//   RECORDED -> SETTLED   (2003) long-term role of alpha-blocker therapy settled
//   SETTLED  -> CONTESTED (2005) post-market class safety signal (IFIS)
//
// The claim's existing first ClaimStatusHistory row (fromAxis=null) is NOT
// duplicated here. This script only appends the transitions above.
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on a
// deterministic slug id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-terazosin-hydrochloride-bph.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-terazosin-hydrochloride-bph.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiye99q8tvoplo70btubrh4'

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
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: definitive published clinical evidence (1996) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1996-08-22',
    datePrecision: 'DAY',
    reason:
      'The Veterans Affairs Cooperative Studies Benign Prostatic Hyperplasia Study Group (Lepor et al., NEJM 1996) reported a double-blind, placebo-controlled, multicenter randomized trial of terazosin, finasteride, or both in 1,229 men. Terazosin produced significant improvement in symptom scores and peak urinary flow versus placebo, while finasteride monotherapy was no better than placebo over one year. This landmark trial recorded terazosin\'s efficacy for symptomatic BPH in the peer-reviewed literature.',
    source: {
      externalId: 'src:terazosin-va-cooperative-nejm-1996',
      name: 'Lepor H, Williford WO, Barry MJ, et al. The efficacy of terazosin, finasteride, or both in benign prostatic hyperplasia. Veterans Affairs Cooperative Studies BPH Study Group. N Engl J Med. 1996;335(8):533-539.',
      url: 'https://doi.org/10.1056/NEJM199608223350801',
      publishedAt: '1996-08-22',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: long-term role of alpha-blocker therapy settled (2003) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2003-12-18',
    datePrecision: 'DAY',
    reason:
      'The MTOPS trial (McConnell et al., NEJM 2003) followed 3,047 men for a mean of 4.5 years and showed that long-term alpha-blocker therapy (doxazosin, the same non-uroselective first-generation class as terazosin) durably reduced the risk of clinical progression of BPH, though 5-alpha-reductase inhibition was needed to reduce acute urinary retention and the need for surgery. This settled the long-term role of alpha-blocker pharmacotherapy that the terazosin label had explicitly left "yet to be determined," cementing alpha-blockers as standard first-line symptomatic therapy for BPH.',
    source: {
      externalId: 'src:mtops-bph-nejm-2003',
      name: 'McConnell JD, Roehrborn CG, Bautista OM, et al. The long-term effect of doxazosin, finasteride, and combination therapy on the clinical progression of benign prostatic hyperplasia (MTOPS). N Engl J Med. 2003;349(25):2387-2398.',
      url: 'https://doi.org/10.1056/NEJMoa030656',
      publishedAt: '2003-12-18',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: post-market class safety signal (IFIS, 2005) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2005-04-01',
    datePrecision: 'MONTH',
    reason:
      'Post-market pharmacovigilance identified intraoperative floppy iris syndrome (IFIS) as a safety signal associated with systemic alpha-1 adrenergic antagonists (Chang & Campbell, J Cataract Refract Surg 2005). Initially linked to tamsulosin, IFIS was subsequently recognized as a class effect implicating other alpha-blockers including terazosin, and prompted FDA-directed labeling advising cataract surgeons of prior or current alpha-blocker use. This contested the otherwise benign safety profile of the drug class, complicating its risk-benefit in patients facing cataract surgery.',
    source: {
      externalId: 'src:ifis-alpha-blocker-jcrs-2005',
      name: 'Chang DF, Campbell JR. Intraoperative floppy iris syndrome associated with tamsulosin. J Cataract Refract Surg. 2005;31(4):664-673.',
      url: 'https://doi.org/10.1016/j.jcrs.2005.02.027',
      publishedAt: '2005-04-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  // Guard: ensure the claim exists; do NOT create it.
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — refusing to enrich a nonexistent claim.`)
  }

  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt}`)
      console.log(`          source: ${t.source.externalId} (${t.source.url})`)
      console.log(`          history id: ${historyId}`)
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
        ingestedBy: 'enrich-openfda_labels_v1',
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
      where: { id: historyId },
      create: {
        id: historyId,
        claimId: CLAIM_ID,
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

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${historyId})`)
  }

  console.log(DRY_RUN ? 'dry-run complete' : 'enrichment complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
