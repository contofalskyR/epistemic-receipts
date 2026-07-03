// Enrichment: epistemic arc for the FDA penicillin V potassium label
// (Indications & Usage) claim.
//
// Attaches ClaimStatusHistory rows to the EXISTING claim
// cmpiycfj98rooplo7vqmyjoj3 (ingestedBy openfda_labels_v1). Does NOT create a
// new Claim. Idempotent: upserts on deterministic ids.
//
// Arc:
//   OPEN     -> RECORDED  AHA scientific statement (Circulation, 2009) — the
//                         modern clinical-trial evidence base for oral penicillin V
//                         in group A streptococcal (GAS) pharyngitis and rheumatic
//                         fever prevention, consolidated and recorded in the
//                         peer-reviewed literature.
//   RECORDED -> SETTLED   IDSA clinical practice guideline (Clin Infect Dis, 2012)
//                         — penicillin V endorsed as first-line therapy for GAS
//                         pharyngitis, establishing settled standard-of-care status.
//
// No SETTLED -> CONTESTED/REVERSED transition is included: penicillin V has no
// FDA black-box warning, no market withdrawal, and group A Streptococcus remains
// universally penicillin-susceptible, so the indication has not been reversed or
// contested. Fabricating a reversal would violate the pipeline's verifiability
// principle (curated facts must trace to a fetchable, verifiable source).
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-penicillin-v-potassium.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-penicillin-v-potassium.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiycfj98rooplo7vqmyjoj3'

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
    occurredAt: '2009-03-24',
    datePrecision: 'DAY',
    reason:
      'Phenoxymethylpenicillin (penicillin V) was introduced in the mid-1950s as the acid-stable oral penicillin, and decades of clinical use established its efficacy against group A streptococcal (GAS) pharyngitis. The 2009 American Heart Association scientific statement (Gerber et al., Circulation) consolidated this trial evidence, recording oral penicillin V as a recommended, evidence-based therapy for streptococcal pharyngitis and for preventing acute rheumatic fever. This marks the point at which the labeled indication rested on a formally recorded, peer-reviewed evidence base rather than legacy regulatory approval alone.',
    source: {
      externalId: 'src:penv-aha-circ-2009',
      name: 'Gerber MA, Baltimore RS, Eaton CB, et al. Prevention of Rheumatic Fever and Diagnosis and Treatment of Acute Streptococcal Pharyngitis: A Scientific Statement From the American Heart Association. Circulation. 2009;119(11):1541-1551.',
      url: 'https://doi.org/10.1161/CIRCULATIONAHA.109.191959',
      publishedAt: '2009-03-24',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-09-09',
    datePrecision: 'DAY',
    reason:
      'The Infectious Diseases Society of America 2012 clinical practice guideline (Shulman et al., Clinical Infectious Diseases) recommends penicillin V (or penicillin G) as the first-line antibiotic for group A streptococcal pharyngitis, citing its narrow spectrum, low cost, safety, and the continued absence of penicillin-resistant GAS. Inclusion as the preferred agent in a major infectious-disease society guideline established penicillin V use as settled standard of care, consolidating the accumulated trial evidence into a formal institutional recommendation.',
    source: {
      externalId: 'src:penv-idsa-cid-2012',
      name: 'Shulman ST, Bisno AL, Clegg HW, et al. Clinical Practice Guideline for the Diagnosis and Management of Group A Streptococcal Pharyngitis: 2012 Update by the Infectious Diseases Society of America. Clin Infect Dis. 2012;55(10):e86-e102.',
      url: 'https://doi.org/10.1093/cid/cis629',
      publishedAt: '2012-09-09',
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
        ingestedBy: 'enrich:openfda_labels_v1-penicillin-v-potassium',
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
