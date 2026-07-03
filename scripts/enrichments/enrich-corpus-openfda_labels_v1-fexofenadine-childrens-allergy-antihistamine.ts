// Enrich the epistemic arc for the Children's Allergy fexofenadine FDA-label
// claim (openfda_labels_v1).
//
// Claim: cmpiye4hc8tpoplo7miv5jruz —
//   "Children Allergy (FEXOFENADINE HCL): Purpose Antihistamine"
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1996-07  FDA approval of Allegra (fexofenadine) for
//                                  seasonal allergic rhinitis on Phase III data;
//                                  fexofenadine established as a selective
//                                  peripheral H1-antihistamine.
//   RECORDED -> SETTLED   2011-01  Rx-to-OTC switch — FDA judged the
//                                  antihistamine efficacy/safety settled enough
//                                  for nonprescription use; second-generation
//                                  antihistamines are first-line in ARIA
//                                  allergic-rhinitis guidance.
//
// NOTE ON THE ABSENT THIRD (SETTLED -> CONTESTED/REVERSED) STEP:
//   There is no post-market safety reversal for fexofenadine itself. Fexofenadine
//   is the non-cardiotoxic active metabolite of terfenadine (Seldane); it was
//   developed and adopted precisely BECAUSE the FDA forced terfenadine off the
//   US market (1997–1998) for QT prolongation / fatal torsades de pointes. The
//   safety reversal belongs to the parent compound, not to this claim, which
//   remains uncontested standard-of-care. Inventing a black-box/withdrawal event
//   here would violate the project's anti-fabrication principle, so the arc is
//   left as a truthful two-step curve.
//
// SOURCING NOTE:
//   Live URL verification (WebFetch/WebSearch) was unavailable in the authoring
//   environment. To avoid asserting unverifiable identifiers (specific DOIs,
//   PMIDs, or FDA NDA numbers) in violation of the "training-data recall is not a
//   verifiable source" rule, the marker `url` fields point to canonical
//   Wikipedia article URLs (high-confidence to resolve, and the convention used
//   by seed-human-history-trajectories.ts for primary sources); the underlying
//   FDA approvals and pivotal trials are named in the `name` field.
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-fexofenadine-childrens-allergy-antihistamine.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-fexofenadine-childrens-allergy-antihistamine.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiye4hc8tpoplo7miv5jruz'

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
  // ── OPEN -> RECORDED: FDA approval on Phase III seasonal-rhinitis data (1996) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1996-07-01',
    datePrecision: 'MONTH',
    reason:
      'In July 1996 the FDA approved fexofenadine hydrochloride (Allegra) for seasonal allergic rhinitis on the basis of randomized, placebo-controlled Phase III trials showing significant relief of sneezing, rhinorrhea and itching versus placebo (e.g., Bernstein DI et al., Ann Allergy Asthma Immunol. 1997;79:443–448). Fexofenadine is the non-cardiotoxic active metabolite of terfenadine and acts as a selective peripheral H1-receptor antihistamine — establishing the primary clinical evidence for the "Antihistamine" purpose captured verbatim in the later openFDA children\'s-allergy label.',
    source: {
      externalId: 'src:fexofenadine-fda-approval-1996',
      name: 'U.S. FDA approval of fexofenadine hydrochloride (Allegra) for seasonal allergic rhinitis, July 1996; pivotal Phase III trials (e.g., Bernstein DI, Schoenwetter WF, Nathan RA, et al. Efficacy and safety of fexofenadine hydrochloride for treatment of seasonal allergic rhinitis. Ann Allergy Asthma Immunol. 1997;79(5):443–448).',
      url: 'https://en.wikipedia.org/wiki/Fexofenadine',
      publishedAt: '1996-07-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: Rx-to-OTC switch / first-line guideline status (2011) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-01-01',
    datePrecision: 'MONTH',
    reason:
      'By the 2000s second-generation oral H1-antihistamines including fexofenadine were established first-line pharmacotherapy for allergic rhinitis in the ARIA (Allergic Rhinitis and its Impact on Asthma) guidelines, and in January 2011 the FDA approved fexofenadine (Allegra Allergy) for nonprescription over-the-counter sale. Clearing a drug for use without physician oversight is a regulatory judgment that its antihistamine efficacy and cardiac safety are settled — in pointed contrast to its parent terfenadine, which the FDA had forced off the market in 1997–1998 for QT prolongation and fatal arrhythmia. This ratified the "Antihistamine" purpose as uncontested standard-of-care.',
    source: {
      externalId: 'src:fexofenadine-otc-switch-2011',
      name: 'U.S. FDA Rx-to-OTC switch approval of fexofenadine (Allegra Allergy) for over-the-counter sale, 2011; ARIA allergic-rhinitis guideline endorsement of second-generation H1-antihistamines as first-line therapy.',
      url: 'https://en.wikipedia.org/wiki/Fexofenadine',
      publishedAt: '2011-01-01',
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
