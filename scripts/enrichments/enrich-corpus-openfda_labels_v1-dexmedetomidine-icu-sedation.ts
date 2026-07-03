// Enrichment: epistemic arc for the FDA dexmedetomidine (Precedex) ICU-sedation
// label claim.
//
// Attaches ClaimStatusHistory rows to the EXISTING claim
// cmpiyc53z8rcoplo75sili700 (ingestedBy openfda_labels_v1). Does NOT create a
// new Claim. Idempotent: upserts on deterministic ids.
//
// Arc:
//   OPEN     -> RECORDED  MENDS RCT (JAMA, 2007) — pivotal trial evidence that
//                         dexmedetomidine sedation reduces ICU brain dysfunction
//                         vs benzodiazepines.
//   RECORDED -> SETTLED   SCCM PADIS clinical practice guidelines (Crit Care Med,
//                         2018) — dexmedetomidine recommended over benzodiazepines
//                         for sedation of ventilated adults (standard of care).
//   SETTLED  -> CONTESTED SPICE III (NEJM, 2019) — early dexmedetomidine sedation
//                         gave no mortality benefit and more bradycardia/hypotension,
//                         a post-market safety/efficacy signal contesting broad use.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-dexmedetomidine-icu-sedation.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-dexmedetomidine-icu-sedation.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyc53z8rcoplo75sili700'

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
    occurredAt: '2007-12-12',
    datePrecision: 'DAY',
    reason:
      'The MENDS double-blind randomized controlled trial (Pandharipande et al., JAMA) compared dexmedetomidine with lorazepam for sedation of mechanically ventilated ICU patients and found dexmedetomidine produced more days alive without delirium or coma. This was the pivotal published clinical evidence that the alpha-2 agonist ICU-sedation indication rested on outcomes, not just sedation depth, moving the labeled use from a bare approval to a recorded, trial-backed efficacy claim.',
    source: {
      externalId: 'src:dex-mends-jama-2007',
      name: 'Pandharipande PP, Pun BT, Herr DL, et al. Effect of sedation with dexmedetomidine vs lorazepam on acute brain dysfunction in mechanically ventilated patients: the MENDS randomized controlled trial. JAMA. 2007;298(22):2644-2653.',
      url: 'https://doi.org/10.1001/jama.298.22.2644',
      publishedAt: '2007-12-12',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2018-09-01',
    datePrecision: 'MONTH',
    reason:
      'The Society of Critical Care Medicine PADIS clinical practice guidelines (Devlin et al., Critical Care Medicine, 2018) suggested using dexmedetomidine or propofol over benzodiazepines for sedation of critically ill, mechanically ventilated adults. Inclusion in a major society guideline as a preferred agent marked dexmedetomidine ICU sedation as settled standard-of-care practice, consolidating the SEDCOM (JAMA 2009) and MENDS trial evidence into a formal institutional recommendation.',
    source: {
      externalId: 'src:dex-padis-ccm-2018',
      name: 'Devlin JW, Skrobik Y, Gelinas C, et al. Clinical Practice Guidelines for the Prevention and Management of Pain, Agitation/Sedation, Delirium, Immobility, and Sleep Disruption in Adult Patients in the ICU. Crit Care Med. 2018;46(9):e825-e873.',
      url: 'https://doi.org/10.1097/CCM.0000000000003299',
      publishedAt: '2018-09-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2019-05-19',
    datePrecision: 'DAY',
    reason:
      'The SPICE III trial (Shehabi et al., New England Journal of Medicine, 2019) randomized over 4,000 critically ill ventilated adults to early dexmedetomidine-based sedation and found no 90-day mortality benefit versus usual care, while dexmedetomidine patients had significantly more bradycardia and hypotension. The result contested the assumption that early, broad dexmedetomidine sedation improves outcomes, sharpening scrutiny of its cardiovascular safety signal without withdrawing the approved indication.',
    source: {
      externalId: 'src:dex-spice3-nejm-2019',
      name: 'Shehabi Y, Howe BD, Bellomo R, et al. Early Sedation with Dexmedetomidine in Critically Ill Patients. N Engl J Med. 2019;380(26):2506-2517.',
      url: 'https://doi.org/10.1056/NEJMoa1904710',
      publishedAt: '2019-05-19',
      methodologyType: 'primary',
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
        ingestedBy: 'enrich:openfda_labels_v1-dexmedetomidine',
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
