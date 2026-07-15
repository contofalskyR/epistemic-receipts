// Enrichment: epistemic trajectory for the NCEP Adult Treatment Panel III (ATP III)
// cholesterol guideline. "Executive Summary of the Third Report of the National
// Cholesterol Education Program (NCEP) Expert Panel on Detection, Evaluation, and
// Treatment of High Blood Cholesterol in Adults (Adult Treatment Panel III),"
// JAMA 285(19): 2486–2497 (2001-05-16). DOI 10.1001/jama.285.19.2486.
// OpenAlex W4238251256. PMID 11368702.
//
// ATP III's defining recommendation was risk-stratified LDL-cholesterol treatment
// GOALS — the "treat-to-target" paradigm (e.g. LDL <100 mg/dL for CHD-risk-equivalent
// patients), anchored to Framingham risk scoring. The claim's post-publication arc
// is an institutional one, driven by the same guideline-issuing bodies (NHLBI/ACC/AHA):
//
//   - No retraction, expression of concern, or erratum. Crossref returns no
//     `update-to`, no relations; the DOI is registered and resolves (Crossref 200;
//     doi.org returns 403 behind the JAMA paywall, not a broken link).
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 2001-05-16 publication). This script adds the two downstream institutional arcs:
//
//   RECORDED -> SETTLED (2004-07-13): Grundy et al., an official NHLBI/ACC/AHA-
//     coordinated update, reviewed five major statin trials, reaffirmed the ATP III
//     LDL-goal framework, and refined it (adding an optional aggressive LDL <70 mg/dL
//     target for very-high-risk patients). The framework was thereby endorsed and
//     entrenched as the operative standard of care. Community INSTITUTIONAL.
//
//   SETTLED -> REVERSED (2013-11): The 2013 ACC/AHA Guideline on the Treatment of
//     Blood Cholesterol (Stone et al.) abandoned the LDL treat-to-target paradigm
//     central to ATP III, replacing numeric LDL goals with fixed statin-intensity
//     tiers assigned by pooled-cohort ASCVD risk. This is a documented reversal of
//     ATP III's core recommendation by its own successor guideline. Community
//     INSTITUTIONAL.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ncep-atp-iii-2001-cholesterol.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ncep-atp-iii-2001-cholesterol.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplypinn012bsaqk0pso1mzq'

type FactStatus =
  | 'OPEN'
  | 'RECORDED'
  | 'SETTLED'
  | 'CONTESTED'
  | 'REVERSED'
  | 'ABANDONED'
  | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE'
  | 'INSTITUTIONAL'
  | 'JUDICIAL'
  | 'PUBLIC'
  | 'MARKET'
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
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// Do NOT duplicate the existing null -> RECORDED (2001-05-16 publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2004-07-13',
    datePrecision: 'DAY',
    reason:
      'Grundy et al., "Implications of Recent Clinical Trials for the National Cholesterol Education Program Adult Treatment Panel III Guidelines" (Circulation 110(2): 227–239, 13 July 2004), is an official NHLBI/ACC/AHA-coordinated update. It reviewed five major statin trials, explicitly reaffirmed the ATP III LDL-goal (treat-to-target) framework, and refined it by adding an optional aggressive LDL <70 mg/dL target for very-high-risk patients. This entrenches ATP III as the operative standard of care via institutional endorsement — a settling of the guideline framework, not a contest.',
    source: {
      externalId: 'src:circulation-grundy-2004-atp-iii-update',
      name:
        'S.M. Grundy et al., "Implications of Recent Clinical Trials for the National Cholesterol Education Program Adult Treatment Panel III Guidelines," Circulation 110(2): 227–239 (13 July 2004). DOI 10.1161/01.CIR.0000133317.49796.0E; PMID 15249516.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/15249516/',
      publishedAt: '2004-07-13',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2013-11',
    datePrecision: 'MONTH',
    reason:
      'The 2013 ACC/AHA Guideline on the Treatment of Blood Cholesterol (Stone et al., released November 2013; Circulation 129(25 suppl 2): S1–S45) abandoned the LDL treat-to-target paradigm that defined ATP III. It replaced risk-stratified numeric LDL goals with fixed high/moderate-intensity statin tiers assigned by pooled-cohort ASCVD risk, and stated the panel "found no evidence to support treatment to specific LDL-C targets." This is a documented reversal of ATP III\'s core recommendation by the same guideline-issuing bodies\' successor document.',
    source: {
      externalId: 'src:circulation-stone-2013-acc-aha-cholesterol',
      name:
        'N.J. Stone et al., "2013 ACC/AHA Guideline on the Treatment of Blood Cholesterol to Reduce Atherosclerotic Cardiovascular Risk in Adults," Circulation 129(25 suppl 2): S1–S45 (released November 2013). DOI 10.1161/01.cir.0000437738.63853.7a; PMID 24222016.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/24222016/',
      publishedAt: '2013-11-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${
      DRY_RUN ? ' (DRY RUN)' : ''
    }`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`)
  }

  for (const t of TRANSITIONS) {
    const s = t.source
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    console.log(
      `  ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${s.externalId})`,
    )
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: s.externalId },
      create: {
        externalId: s.externalId,
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
        ingestedBy: 'enrich:openalex_v1',
        autoApproved: true,
      },
      update: {
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
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

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
