// Enrichment: epistemic trajectory for the FDA drug-label claim
//   "Amiodarone Hydrochloride Tablets is indicated for ... documented,
//    life-threatening recurrent ventricular fibrillation and life-threatening
//    recurrent hemodynamically unstable [ventricular] tachycardia in adults who
//    have not responded to adequate doses of other available antiarrhythmics or
//    when alternative agents cannot be tolerated."
// Claim id: cmpiygbyw8w8oplo7edr8zt65  (ingestedBy openfda_labels_v1)
//
// The claim carries its label-ingestion first entry (fromAxis=null -> <first>)
// already; this script does NOT duplicate it. It adds the downstream epistemic
// arc of amiodarone as a life-threatening-arrhythmia antiarrhythmic:
//
//   1. OPEN -> RECORDED (1976-11): first large published clinical series
//      demonstrating amiodarone's antiarrhythmic efficacy (Rosenbaum MB et al.,
//      Am J Cardiol 1976). Community: EXPERT_LITERATURE.
//   2. RECORDED -> SETTLED (1985-12-24): FDA approves Cordarone (amiodarone HCl)
//      tablets for exactly this refractory, life-threatening ventricular
//      arrhythmia indication — regulatory settling / standard of care for the
//      refractory case. Community: INSTITUTIONAL.
//   3. SETTLED -> CONTESTED (2015-03-24): FDA Drug Safety Communication warns of
//      serious symptomatic bradycardia when amiodarone is co-administered with
//      sofosbuvir-containing hepatitis C regimens (cases incl. one death and
//      pacemaker placements), layered on amiodarone's longstanding boxed
//      warnings for pulmonary toxicity, hepatotoxicity and proarrhythmia —
//      constraining use to genuinely refractory cases. Community: INSTITUTIONAL.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-amiodarone-hydrochloride-tablets.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-amiodarone-hydrochloride-tablets.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiygbyw8w8oplo7edr8zt65'

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

// Do NOT duplicate the existing null -> <first> (label-ingestion) entry.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1976-11-01',
    datePrecision: 'MONTH',
    reason:
      'Rosenbaum MB, Chiale PA, Halpern MS, and colleagues of the Buenos Aires group published the first large clinical series establishing amiodarone as an effective antiarrhythmic agent, reporting durable suppression of refractory ventricular and supraventricular tachyarrhythmias in patients who had failed conventional agents. The paper moved amiodarone from an investigational coronary vasodilator to a documented antiarrhythmic, opening the clinical record for its use in life-threatening arrhythmia. It became the founding citation for amiodarone antiarrhythmic therapy.',
    source: {
      externalId: 'src:rosenbaum-amiodarone-antiarrhythmic-1976',
      name:
        'Rosenbaum MB, Chiale PA, Halpern MS, Nau GJ, Przybylski J, Levi RJ, Lázzari JO, Elizari MV. Clinical efficacy of amiodarone as an antiarrhythmic agent. American Journal of Cardiology. 1976 Nov;38(7):934–944.',
      url: 'https://doi.org/10.1016/0002-9149(76)90807-9',
      publishedAt: '1976-11-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1985-12-24',
    datePrecision: 'DAY',
    reason:
      'On 24 December 1985 the U.S. FDA approved Cordarone (amiodarone hydrochloride) tablets (NDA 018972) for documented, life-threatening recurrent ventricular fibrillation and hemodynamically unstable ventricular tachycardia refractory to other antiarrhythmics — the exact indication carried in this label claim. Regulatory approval settled amiodarone as the accepted standard of care for the otherwise-untreatable refractory ventricular arrhythmia, a status later reaffirmed in ACC/AHA/HRS ventricular-arrhythmia guidelines. Its terminal successful state for this indication is the approved, marketed drug.',
    source: {
      externalId: 'src:fda-cordarone-approval-1985',
      name:
        'Drugs@FDA: Cordarone (amiodarone hydrochloride) tablets, NDA 018972 — original FDA approval 24 December 1985 for life-threatening recurrent ventricular arrhythmias.',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=018972',
      publishedAt: '1985-12-24',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2015-03-24',
    datePrecision: 'DAY',
    reason:
      'On 24 March 2015 the FDA issued a Drug Safety Communication warning of serious, sometimes fatal, symptomatic bradycardia when amiodarone is co-administered with hepatitis C direct-acting antiviral regimens containing sofosbuvir (Harvoni or Sovaldi with another DAA); reported cases included one death and several requiring pacemaker placement. Layered on amiodarone\'s longstanding boxed warnings for potentially fatal pulmonary toxicity, hepatotoxicity and proarrhythmia, the post-market signal reinforced that the drug is a last-resort agent whose benefit must be weighed against its hazards. The indication itself remains approved but its risk profile is actively contested at the margins of use.',
    source: {
      externalId: 'src:fda-dsc-amiodarone-sofosbuvir-bradycardia-2015',
      name:
        'FDA Drug Safety Communication: FDA warns of serious slowing of the heart rate when the antiarrhythmic drug amiodarone is used with hepatitis C treatments containing sofosbuvir (Harvoni) or Sovaldi in combination with another Direct Acting Antiviral drug. 24 March 2015.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-warns-serious-slowing-heart-rate-when-antiarrhythmic-drug',
      publishedAt: '2015-03-24',
      methodologyType: 'primary',
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
    throw new Error(
      `Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`,
    )
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
        ingestedBy: 'enrich:openfda_labels_v1',
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
