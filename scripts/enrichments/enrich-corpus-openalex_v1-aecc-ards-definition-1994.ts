// Enrichment: epistemic trajectory for the American-European Consensus
// Conference (AECC) on ARDS — Bernard GR, Artigas A, Brigham KL, et al.,
// "The American-European Consensus Conference on ARDS. Definitions, mechanisms,
// relevant outcomes, and clinical trial coordination." Am J Respir Crit Care
// Med. 1994;149(3 Pt 1):818-824. DOI 10.1164/ajrccm.149.3.7509706.
// OpenAlex W2161328469. PMID 7509706.
//
// The claim laments the "lack of uniform definitions for ARDS"; the paper's
// core contribution was to supply one — the AECC definition of ALI/ARDS
// (acute onset, bilateral infiltrates, PAWP < 18 mmHg / no left-atrial
// hypertension, and PaO2/FiO2 <= 300 for ALI / <= 200 for ARDS). That
// definition became the operative standard for a generation of trials.
//
// The claim already carries its baseline null -> RECORDED first entry
// (publication, 1994-03-01). This script adds the downstream arc only:
//
//   RECORDED -> CONTESTED (2004-09-21): Esteban A, Fernandez-Segoviano P,
//     Frutos-Vivar F, et al., "Comparison of Clinical Criteria for the Acute
//     Respiratory Distress Syndrome with Autopsy Findings." Ann Intern Med.
//     2004;141(6):440-445. DOI 10.7326/0003-4819-141-6-200409210-00009. This
//     validation study compared the AECC clinical criteria against diffuse
//     alveolar damage at autopsy and found only limited accuracy (sensitivity
//     ~75%, specificity ~84%), one of a series of studies documenting the
//     AECC definition's poor reliability and its dependence on ventilator
//     settings — a specific, dated challenge to the definition's validity.
//
//   CONTESTED -> REVERSED (2012-06-20): ARDS Definition Task Force,
//     "Acute Respiratory Distress Syndrome: The Berlin Definition."
//     JAMA. 2012;307(23):2526-2533. DOI 10.1001/jama.2012.5669. Convened by
//     the European Society of Intensive Care Medicine (endorsed by ATS and
//     SCCM), the Task Force explicitly superseded the AECC definition: it
//     eliminated the term "acute lung injury (ALI)", removed the PAWP and
//     "acute onset" criteria, and replaced the AECC framework with mild /
//     moderate / severe categories stratified by PaO2/FiO2 on defined PEEP.
//     This retired the AECC criteria as the field's operative definition.
//
// Community: EXPERT_LITERATURE for both transitions (peer-reviewed critical
// appraisal and a consensus definition published in the specialty/general
// medical literature).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-aecc-ards-definition-1994.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-aecc-ards-definition-1994.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply83gu01yxsaihifb4elaj'

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

// Do NOT duplicate the existing null -> RECORDED (publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-09-21',
    datePrecision: 'DAY',
    reason:
      'On 21 September 2004 Esteban et al. published in Annals of Internal Medicine an autopsy-validation study comparing the AECC clinical criteria for ALI/ARDS against diffuse alveolar damage found at autopsy, reporting only limited diagnostic accuracy (sensitivity ~75%, specificity ~84%). Together with concurrent reports that the AECC PaO2/FiO2 threshold varied with ventilator settings and that inter-observer agreement on the criteria was poor, this established a dated, citable challenge to the reliability and validity of the AECC definition rather than mere background critique.',
    source: {
      externalId: 'src:esteban-2004-aecc-autopsy-validation',
      name:
        'Esteban A, Fernandez-Segoviano P, Frutos-Vivar F, et al. "Comparison of Clinical Criteria for the Acute Respiratory Distress Syndrome with Autopsy Findings." Ann Intern Med. 2004;141(6):440-445. PMID 15381517.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/15381517/',
      publishedAt: '2004-09-21',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2012-06-20',
    datePrecision: 'DAY',
    reason:
      'On 20 June 2012 the ARDS Definition Task Force published "Acute Respiratory Distress Syndrome: The Berlin Definition" in JAMA, explicitly superseding the AECC definition. The Berlin Definition eliminated the AECC term "acute lung injury (ALI)", dropped the pulmonary-artery-wedge-pressure and "acute onset" criteria, and replaced the AECC framework with mild/moderate/severe categories stratified by PaO2/FiO2 measured on a defined minimum PEEP. This retired the AECC criteria as the field\'s operative definition of ARDS, reversing the specific definitional apparatus the 1994 paper proposed.',
    source: {
      externalId: 'src:ards-task-force-2012-berlin-definition',
      name:
        'ARDS Definition Task Force. "Acute Respiratory Distress Syndrome: The Berlin Definition." JAMA. 2012;307(23):2526-2533. PMID 22797452.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/22797452/',
      publishedAt: '2012-06-20',
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
