// Enrichment: epistemic trajectory for the National Cholesterol Education
// Program (NCEP) Expert Panel, "Summary of the Second Report ... (Adult
// Treatment Panel II)," JAMA 269(23): 3015–3023 (June 16, 1993).
// DOI 10.1001/jama.1993.03500230097036. OpenAlex W2118310760.
//
// The ATP II report's core recommendation is that low-density lipoprotein (LDL)
// cholesterol is the PRIMARY TARGET of cholesterol-lowering therapy, with
// treatment intensity keyed to LDL numeric goals stratified by risk. This
// "treat-to-LDL-target" framework, inherited from ATP I (1988), was the
// operative U.S. standard for a decade.
//
// Post-publication research state:
//   - No retraction, expression of concern, or erratum exists. Crossref returns
//     an empty `update-to` for the DOI. (Publisher pages return HTTP 403 to
//     automated clients — paywall/bot-blocking — but the DOI resolves and the
//     Crossref works record confirms title, journal, and 1993-06-16 issue date.)
//   - The finding was not overturned as wrong. It was first REAFFIRMED and
//     strengthened by the successor NCEP guideline (ATP III, 2001), then the
//     defining treat-to-LDL-target METHOD was CONTESTED when the 2013 ACC/AHA
//     cholesterol guideline abandoned titration to specific LDL goals in favor
//     of fixed-intensity statin therapy by ASCVD risk group.
//
// The claim already carries its baseline first entry (null -> RECORDED at the
// 1993 publication). This script adds the downstream arc:
//
//   RECORDED -> SETTLED (2001-05-16): "Executive Summary of the Third Report of
//     the NCEP Expert Panel ... (Adult Treatment Panel III)" (JAMA 285(19):
//     2486–2497). The same NCEP program, through a new expert panel, reaffirmed
//     LDL as the primary target of therapy and made LDL goals more aggressive.
//     An institutional consensus reaffirmation of the ATP II core claim.
//
//   SETTLED -> CONTESTED (2013-11): Stone et al., "2013 ACC/AHA Guideline on the
//     Treatment of Blood Cholesterol to Reduce Atherosclerotic Cardiovascular
//     Risk in Adults" (released online Nov 2013; print Circulation 2014;129(25
//     Suppl 2):S1–S45). This guideline departed from the ATP treat-to-LDL-target
//     paradigm, no longer recommending titration to specific LDL numeric goals
//     and instead prescribing fixed-intensity statins by risk group — a
//     documented, controversial contest of the method that had defined ATP I/II/
//     III. (LDL itself remained central to therapy, so CONTESTED, not REVERSED.)
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ncep-atp-ii-1993-cholesterol.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ncep-atp-ii-1993-cholesterol.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply45hk001fsaihv2bubp4y'

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

// Do NOT duplicate the existing null -> RECORDED (1993 publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2001-05-16',
    datePrecision: 'DAY',
    reason:
      'The "Executive Summary of the Third Report of the National Cholesterol Education Program (NCEP) Expert Panel on Detection, Evaluation, and Treatment of High Blood Cholesterol in Adults (Adult Treatment Panel III)" (JAMA 285(19): 2486–2497, May 16, 2001) is the successor NCEP guideline. Produced by the same national program through a new expert panel, it explicitly reaffirmed LDL cholesterol as the primary target of cholesterol-lowering therapy — the central ATP II claim — and made LDL treatment goals more aggressive (e.g., an optional LDL goal <100 mg/dL for high-risk patients). This is a dated, authoritative institutional reaffirmation that settled the ATP II core recommendation as the operative U.S. standard.',
    source: {
      externalId: 'src:jama-ncep-atp-iii-2001-executive-summary',
      name:
        'Expert Panel on Detection, Evaluation, and Treatment of High Blood Cholesterol in Adults, "Executive Summary of the Third Report of the National Cholesterol Education Program (NCEP) Expert Panel (Adult Treatment Panel III)," JAMA 285(19): 2486–2497 (May 16, 2001). DOI 10.1001/jama.285.19.2486.',
      url: 'https://doi.org/10.1001/jama.285.19.2486',
      publishedAt: '2001-05-16',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2013-11-01',
    datePrecision: 'MONTH',
    reason:
      'Stone et al., "2013 ACC/AHA Guideline on the Treatment of Blood Cholesterol to Reduce Atherosclerotic Cardiovascular Risk in Adults" (released online November 2013; print Circulation 2014;129(25 Suppl 2):S1–S45), broke from the treat-to-LDL-target paradigm that had defined the NCEP ATP reports. It no longer recommended titrating therapy to specific LDL cholesterol numeric goals, instead prescribing fixed-intensity statin therapy by ASCVD risk group. This was a widely debated, dated institutional departure that directly contested the ATP II/III method; LDL remained central to therapy (statins lower LDL and later guidelines partly reintroduced LDL thresholds), so the finding is CONTESTED rather than REVERSED.',
    source: {
      externalId: 'src:circulation-acc-aha-2013-blood-cholesterol-guideline',
      name:
        'N.J. Stone et al., "2013 ACC/AHA Guideline on the Treatment of Blood Cholesterol to Reduce Atherosclerotic Cardiovascular Risk in Adults: A Report of the American College of Cardiology/American Heart Association Task Force on Practice Guidelines," Circulation 2014;129(25 Suppl 2):S1–S45 (released online Nov 2013). DOI 10.1161/01.cir.0000437738.63853.7a.',
      url: 'https://doi.org/10.1161/01.cir.0000437738.63853.7a',
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
