// Enrich the epistemic arc for the Leader carboxymethylcellulose 0.5% lubricant
// eye drops FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiy5qsf8kh6plo7lwutt1wg — "Leader Sterile Lubricant Eye Drops
// Carboxymethylcellulose Sodium 0.5%" indicated for temporary relief of burning,
// irritation, and dryness of the eye, and for use as an ocular lubricant.
//
// This is an OTC-monograph artificial tear, so there is no Phase III approval
// trial and no black-box withdrawal. The genuine, verifiable epistemic arc runs
// through the clinical establishment of carboxymethylcellulose (carmellose) as a
// tear substitute, its ratification as first-line dry-eye therapy, and the 2023
// contaminated-artificial-tears safety signal:
//
//   OPEN     -> RECORDED  1992  first clinical evaluation of unpreserved
//                               carboxymethylcellulose artificial tears in
//                               keratoconjunctivitis sicca (Grene et al., Cornea)
//   RECORDED -> SETTLED   2017  TFOS DEWS II Management & Therapy Report lists
//                               ocular lubricants / artificial tears as Step 1
//                               first-line dry-eye therapy — guideline ratification
//   SETTLED  -> CONTESTED 2023  multistate Pseudomonas aeruginosa (VIM-GES-CRPA)
//                               outbreak traced to contaminated carboxymethyl-
//                               cellulose artificial tears (EzriCare / Delsam);
//                               FDA warned consumers — post-market safety signal
//
// The 2023 signal is a manufacturing-contamination safety signal against the
// carboxymethylcellulose artificial-tears product class, not a withdrawal of the
// OTC monograph; the terminal state is CONTESTED, not REVERSED.
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-carboxymethylcellulose-lubricant-eye-drops.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-carboxymethylcellulose-lubricant-eye-drops.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy5qsf8kh6plo7lwutt1wg'

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
  // ── OPEN -> RECORDED: first clinical evaluation of CMC artificial tears (1992) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1992-01-01',
    datePrecision: 'YEAR',
    reason:
      'Unpreserved carboxymethylcellulose (carmellose) artificial tears were first evaluated clinically in patients with keratoconjunctivitis sicca by Grene and colleagues (Cornea, 1992), establishing the demulcent as a tear substitute that relieves ocular dryness and irritation. This primary clinical evidence is the therapeutic basis for the temporary-relief-of-dryness and ocular-lubricant indications later captured on the OTC label. It moved carboxymethylcellulose from a candidate polymer to a documented lubricant for dry-eye symptoms.',
    source: {
      externalId: 'src:cmc-artificial-tears-clinical-establishment',
      name: 'Grene RB, et al. Unpreserved carboxymethylcellulose artificial tears evaluated in patients with keratoconjunctivitis sicca. Cornea. 1992;11(4):294–301. (First clinical evaluation of CMC / carmellose artificial tears in dry eye.)',
      url: 'https://en.wikipedia.org/wiki/Artificial_tears',
      publishedAt: '1992-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: TFOS DEWS II first-line ratification (2017) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2017-07-01',
    datePrecision: 'MONTH',
    reason:
      'The TFOS DEWS II Management and Therapy Report (The Ocular Surface, 2017), the international consensus guideline for dry eye disease, placed ocular lubricants / artificial tears — carboxymethylcellulose among the principal demulcents — as Step 1, first-line therapy for dry-eye symptoms. This institutional guideline ratified the label indication (temporary relief of dryness and irritation) as standard of care worldwide. Guideline inclusion settled the therapeutic role well beyond the original clinical literature.',
    source: {
      externalId: 'src:tfos-dews-ii-management-therapy-2017',
      name: 'Jones L, et al. TFOS DEWS II Management and Therapy Report. The Ocular Surface. 2017;15(3):575–628. (Artificial tears / ocular lubricants as Step 1 first-line dry-eye therapy.)',
      url: 'https://doi.org/10.1016/j.jtos.2017.05.006',
      publishedAt: '2017-07-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: 2023 contaminated artificial-tears outbreak (FDA warning) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2023-02-02',
    datePrecision: 'DAY',
    reason:
      'In February 2023 the FDA warned consumers not to purchase or use EzriCare and Delsam Pharma Artificial Tears — carboxymethylcellulose-based lubricant eye drops — after they were linked to a multistate outbreak of extensively drug-resistant Pseudomonas aeruginosa (VIM-GES-CRPA) causing eye infections, vision loss, enucleations, and deaths. This post-market safety signal contested the presumed safety of carboxymethylcellulose artificial tears as a product class, prompting recalls and heightened sterility scrutiny. It is a contamination signal against affected products, not a withdrawal of the OTC monograph, so the indication remains available while the safety of the class is contested.',
    source: {
      externalId: 'src:fda-ezricare-artificial-tears-warning-2023',
      name: 'FDA. FDA warns consumers not to purchase or use EzriCare Artificial Tears due to potential contamination. U.S. Food and Drug Administration, 2 February 2023.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-warns-consumers-not-purchase-or-use-ezricare-artificial-tears-due-potential-contamination',
      publishedAt: '2023-02-02',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${historyId})`)
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda-labels',
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
  }

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Done — ${TRANSITIONS.length} transitions processed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
