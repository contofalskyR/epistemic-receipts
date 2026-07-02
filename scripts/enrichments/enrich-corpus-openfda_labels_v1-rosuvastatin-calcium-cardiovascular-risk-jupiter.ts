// Enrich the epistemic arc for the Rosuvastatin Calcium FDA-label claim
// (openfda_labels_v1).
//
// Claim: cmpiydmc08t4cplo7npdixe4t — Rosuvastatin (Crestor) tablet indicated to
// reduce the risk of major adverse cardiovascular events in adults without
// established coronary heart disease who are at increased CV risk based on age,
// high-sensitivity C-reactive protein (hsCRP) >=2 mg/L, and at least one
// additional CV risk factor (the primary-prevention indication established by
// the JUPITER trial), plus adjunct-to-diet lipid-lowering uses.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  2008  JUPITER — first randomized outcomes trial showing
//                               rosuvastatin cuts major CV events in primary
//                               prevention selected by elevated hsCRP (NEJM)
//   RECORDED -> SETTLED   2011  ESC/EAS dyslipidaemia guidelines position statins
//                               as first-line CV-risk-reduction therapy — guideline
//                               ratification as standard of care
//   SETTLED  -> CONTESTED 2012  FDA statin class-labeling safety changes (new-onset
//                               diabetes / raised HbA1c and cognitive effects)
//                               contest unrestricted primary-prevention use
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-rosuvastatin-calcium-cardiovascular-risk-jupiter.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-rosuvastatin-calcium-cardiovascular-risk-jupiter.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiydmc08t4cplo7npdixe4t'

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
  // ── OPEN -> RECORDED: JUPITER randomized outcomes trial (2008) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2008-11-20',
    datePrecision: 'DAY',
    reason:
      'The JUPITER trial (Justification for the Use of Statins in Prevention: an Intervention Trial Evaluating Rosuvastatin) randomized 17,802 apparently healthy adults with LDL <130 mg/dL but hsCRP >=2 mg/L to rosuvastatin 20 mg or placebo. Reported by Ridker and colleagues at the AHA Scientific Sessions and published in the New England Journal of Medicine, it was stopped early after rosuvastatin cut the primary composite of major cardiovascular events by 44%. This was the first randomized outcomes evidence for exactly the hsCRP-selected primary-prevention population later written into the FDA label.',
    source: {
      externalId: 'src:jupiter-rosuvastatin-nejm-2008',
      name: 'Ridker PM, Danielson E, Fonseca FAH, et al. Rosuvastatin to Prevent Vascular Events in Men and Women with Elevated C-Reactive Protein (JUPITER). N Engl J Med. 2008;359(21):2195–2207.',
      url: 'https://doi.org/10.1056/NEJMoa0807646',
      publishedAt: '2008-11-20',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: ESC/EAS dyslipidaemia guidelines name statins first-line (2011) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-06-28',
    datePrecision: 'DAY',
    reason:
      'Following JUPITER and the broader statin-outcomes evidence base, the joint European Society of Cardiology / European Atherosclerosis Society "Guidelines for the management of dyslipidaemias" (Reiner et al.), published in the European Heart Journal, made statins the first-line pharmacotherapy for reducing cardiovascular risk, prescribed to target according to total CV risk. This guideline inclusion ratified rosuvastatin\'s drug class as standard of care for the risk-reduction and lipid-lowering indications enumerated in the label.',
    source: {
      externalId: 'src:esc-eas-dyslipidaemia-guidelines-2011',
      name: 'Reiner Z, Catapano AL, De Backer G, et al. ESC/EAS Guidelines for the management of dyslipidaemias. Eur Heart J. 2011;32(14):1769–1818.',
      url: 'https://doi.org/10.1093/eurheartj/ehr158',
      publishedAt: '2011-06-28',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: FDA statin class-labeling safety changes (2012) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-02-28',
    datePrecision: 'DAY',
    reason:
      'On 28 February 2012 the FDA announced important safety label changes across the statin class, adding warnings that statins can raise blood glucose and HbA1c (increased risk of new-onset diabetes) and can cause reversible cognitive effects such as memory loss and confusion. Because JUPITER itself had flagged excess incident diabetes on rosuvastatin, this class-wide regulatory action sharpened the benefit–risk debate over treating lower-risk primary-prevention patients — contesting unrestricted use without withdrawing the approved CV-risk-reduction indication.',
    source: {
      externalId: 'src:fda-statin-safety-labeling-2012',
      name: 'FDA Drug Safety Communication: Important safety label changes to cholesterol-lowering statin drugs (Feb 28, 2012).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-important-safety-label-changes-cholesterol-lowering-statin-drugs',
      publishedAt: '2012-02-28',
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
