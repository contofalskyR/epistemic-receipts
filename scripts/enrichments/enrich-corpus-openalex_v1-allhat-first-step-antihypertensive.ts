// Epistemic enrichment: post-publication trajectory for the ALLHAT first-step
// antihypertensive therapy claim (ALLHAT Officers and Coordinators, JAMA 2002).
//
// Claim: cmply712801gfsaihc1gqr4at
//   "Major outcomes in high-risk hypertensive patients randomized to angiotensin-
//    converting enzyme inhibitor or calcium channel blocker vs diuretic: The
//    Antihypertensive and Lipid-Lowering Treatment to Prevent Heart Attack Trial
//    (ALLHAT)." JAMA. 2002 Dec 18;288(23):2981–97. DOI 10.1001/jama.288.23.2981.
//    OpenAlex W2562329777.
//
// The baseline RECORDED row (fromAxis=null -> RECORDED at 2002-12-18) already exists;
// this script does NOT duplicate it. It adds the single verified post-publication
// transition.
//
// Arc: RECORDED -> SETTLED (INSTITUTIONAL).
//   ALLHAT's open question — whether a CCB or ACE inhibitor is superior to a diuretic
//   as first-step therapy — was adjudicated by its finding that the thiazide-type
//   diuretic chlorthalidone was unsurpassed in preventing cardiovascular events. Within
//   ~5 months this was codified into US national clinical guidelines: the Seventh Report
//   of the Joint National Committee (JNC 7), JAMA 2003 May 21;289(19):2560–72, recommended
//   thiazide-type diuretics as initial drug therapy for most patients with uncomplicated
//   hypertension, explicitly grounded in the ALLHAT results. This is an INSTITUTIONAL
//   consensus adoption, not a mere literature echo.
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-allhat-first-step-antihypertensive.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-allhat-first-step-antihypertensive.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply712801gfsaihc1gqr4at'

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
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2003-05-21',
    datePrecision: 'DAY',
    reason:
      'ALLHAT asked whether a calcium channel blocker or an ACE inhibitor lowers cardiovascular event incidence better than a diuretic as first-step therapy, and found the thiazide-type diuretic chlorthalidone was at least as good and superior in preventing some outcomes (e.g., heart failure). Five months later the Seventh Report of the Joint National Committee (JNC 7), the US national hypertension guideline, adjudicated the question institutionally: it recommended that thiazide-type diuretics "be used in drug treatment for most patients with uncomplicated hypertension," a recommendation grounded directly in the ALLHAT results. This codification into a national clinical guideline settles the finding within the institutional community.',
    source: {
      externalId: 'src:jnc7-2003-hypertension-guideline',
      name: 'Chobanian AV, Bakris GL, Black HR, Cushman WC, Green LA, Izzo JL Jr, et al. The Seventh Report of the Joint National Committee on Prevention, Detection, Evaluation, and Treatment of High Blood Pressure: the JNC 7 report. JAMA. 2003 May 21;289(19):2560–72. PMID 12748199.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/12748199/',
      publishedAt: '2003-05-21',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — refusing to enrich a non-existent claim.`)
  }

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry-run] source ${tr.source.externalId}`)
      console.log(`  [dry-run] claimStatusHistory ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
