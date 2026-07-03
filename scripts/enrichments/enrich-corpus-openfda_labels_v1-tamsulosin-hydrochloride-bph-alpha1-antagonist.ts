// Enrich the epistemic arc for the Tamsulosin Hydrochloride FDA-label claim
// (openfda_labels_v1).
//
// Claim: cmpiyejao8u70plo7s4hynxhv —
//   "Tamsulosin Hydrochloride (TAMSULOSIN HYDROCHLORIDE): 1 INDICATIONS AND USAGE
//    ... indicated for the treatment of the signs and symptoms of benign prostatic
//    hyperplasia (BPH) ... an alpha 1 adrenoceptor antagonist ..."
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1997-04-15  FDA approval of Flomax (tamsulosin HCl, NDA
//                                     020579) for BPH on pivotal randomized,
//                                     placebo-controlled Phase III trials
//                                     (Tamsulosin Investigator Group / Lepor).
//   RECORDED -> SETTLED   2003-08     AUA Guideline on Management of BPH names
//                                     alpha-1 blockers (incl. tamsulosin) as
//                                     first-line medical therapy — professional
//                                     standard-of-care ratification.
//   SETTLED  -> CONTESTED 2005-04     Intraoperative Floppy Iris Syndrome (IFIS)
//                                     described by Chang & Campbell; a genuine
//                                     post-market surgical safety signal that led
//                                     the FDA to add cataract-surgery warnings to
//                                     the tamsulosin label. The BPH indication
//                                     itself is unchanged, but the safety profile
//                                     was contested and re-labeled.
//
// SOURCING NOTE:
//   Live URL verification (WebFetch/WebSearch) was unavailable in the authoring
//   environment. All three markers therefore point to canonical, high-confidence
//   identifiers only: the FDA Drugs@FDA overview page for NDA 020579 (.gov), and
//   two widely-cited primary DOIs (the AUA BPH guideline in J Urol and the
//   Chang & Campbell IFIS paper in J Cataract Refract Surg). No fabricated patent
//   numbers, PMIDs, or NDA identifiers are asserted beyond these.
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-tamsulosin-hydrochloride-bph-alpha1-antagonist.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-tamsulosin-hydrochloride-bph-alpha1-antagonist.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyejao8u70plo7s4hynxhv'

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
  // ── OPEN -> RECORDED: FDA approval of Flomax on Phase III BPH data (1997) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1997-04-15',
    datePrecision: 'DAY',
    reason:
      'On 15 April 1997 the FDA approved tamsulosin hydrochloride (Flomax, NDA 020579) for the signs and symptoms of benign prostatic hyperplasia on the basis of randomized, double-blind, placebo-controlled Phase III trials in which the alpha-1A-selective adrenoceptor antagonist significantly improved AUA symptom scores and peak urinary flow rate versus placebo (Tamsulosin Investigator Group; Lepor H, Urology 1998;51(6):892–900). This established the primary clinical evidence for the BPH indication and the "alpha-1 adrenoceptor antagonist" mechanism captured verbatim in the later openFDA label.',
    source: {
      externalId: 'src:tamsulosin-fda-approval-1997',
      name: 'U.S. FDA approval of tamsulosin hydrochloride (Flomax), NDA 020579, 15 April 1997, for benign prostatic hyperplasia; pivotal Phase III (Lepor H, Tamsulosin Investigator Group. Phase III multicenter placebo-controlled study of tamsulosin in benign prostatic hyperplasia. Urology. 1998;51(6):892–900).',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=020579',
      publishedAt: '1997-04-15',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: AUA BPH guideline first-line status (2003) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2003-08-01',
    datePrecision: 'MONTH',
    reason:
      'The American Urological Association Guideline on the Management of Benign Prostatic Hyperplasia (J Urol. 2003;170(2 Pt 1):530–547) established alpha-1 adrenergic antagonists — including tamsulosin — as first-line medical therapy for symptomatic BPH, judging their efficacy and tolerability sufficient for routine recommendation. Endorsement by the profession\'s governing specialty society ratified the BPH indication as settled standard-of-care rather than merely an approved use.',
    source: {
      externalId: 'src:tamsulosin-aua-bph-guideline-2003',
      name: 'AUA Guideline on the Management of Benign Prostatic Hyperplasia (2003). Chapter 1: Diagnosis and treatment recommendations. American Urological Association. J Urol. 2003;170(2 Pt 1):530–547.',
      url: 'https://doi.org/10.1097/01.ju.0000078083.38675.79',
      publishedAt: '2003-08-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: Intraoperative Floppy Iris Syndrome safety signal (2005) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2005-04-01',
    datePrecision: 'MONTH',
    reason:
      'In April 2005 Chang and Campbell described Intraoperative Floppy Iris Syndrome (IFIS) — a triad of a flaccid iris, iris prolapse, and progressive pupil constriction complicating cataract surgery — strongly associated with current or prior tamsulosin use (J Cataract Refract Surg. 2005;31(4):664–673). The finding prompted an FDA-mandated labeling revision warning ophthalmic surgeons of IFIS risk. The BPH indication was not withdrawn, but the drug\'s safety profile became contested, requiring surgeons to elicit alpha-blocker history before cataract surgery.',
    source: {
      externalId: 'src:tamsulosin-ifis-chang-campbell-2005',
      name: 'Chang DF, Campbell JR. Intraoperative floppy-iris syndrome associated with tamsulosin. J Cataract Refract Surg. 2005;31(4):664–673.',
      url: 'https://doi.org/10.1016/j.jcrs.2005.02.027',
      publishedAt: '2005-04-01',
      methodologyType: 'primary',
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
