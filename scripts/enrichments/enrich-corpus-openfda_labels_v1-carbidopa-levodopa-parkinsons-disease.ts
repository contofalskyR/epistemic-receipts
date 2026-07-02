// Enrich: epistemic arc for the carbidopa/levodopa Parkinson's-disease
// indication claim.
//
// Claim: cmpiybrfv8qw6plo727fodpsm (openfda_labels_v1)
//   "Carbidopa and levodopa tablets ... indicated in the treatment of
//    Parkinson's disease ... Carbidopa allows patients ... to use much lower
//    doses of levodopa."
//
// Arc (chronologically monotonic):
//   OPEN     -> RECORDED   1972-01-06  Papavasiliou & Cotzias NEJM: peripheral
//                                       decarboxylase inhibitor (carbidopa/MK-486)
//                                       potentiates levodopa, cuts required dose
//   RECORDED -> SETTLED    2002-01-08  AAN evidence-based practice parameter:
//                                       levodopa is established, effective initial
//                                       symptomatic therapy for Parkinson's disease
//   SETTLED  -> CONTESTED  2004-12-09  ELLDOPA (Parkinson Study Group, NEJM):
//                                       clinical vs. imaging discordance reopens the
//                                       long-term levodopa risk-benefit debate
//
// The pre-existing fromAxis=null status-history row is left untouched.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-carbidopa-levodopa-parkinsons-disease.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-carbidopa-levodopa-parkinsons-disease.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiybrfv8qw6plo727fodpsm'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
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
    occurredAt: '1972-01-06',
    datePrecision: 'DAY',
    reason:
      'Papavasiliou, Cotzias and colleagues (N Engl J Med 1972;286:8-14) reported that adding the peripheral aromatic-L-amino-acid decarboxylase inhibitor carbidopa (MK-486) to levodopa potentiated its central antiparkinsonian effect while sharply reducing the levodopa dose required and the peripheral side effects. This was the first published clinical evidence for the specific carbidopa-plus-levodopa combination, directly establishing the "carbidopa allows patients to use much lower doses of levodopa" mechanism later written into the label indication.',
    source: {
      externalId: 'src:papavasiliou-cotzias-carbidopa-levodopa-nejm-1972',
      name: 'Papavasiliou PS, Cotzias GC, Düby SE, Steck AJ, Fehling C, Bell MA. Levodopa in Parkinsonism: potentiation of central effects with a peripheral inhibitor. N Engl J Med 1972;286(1):8-14.',
      url: 'https://doi.org/10.1056/NEJM197201062860103',
      publishedAt: '1972-01-06',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-01-08',
    datePrecision: 'DAY',
    reason:
      'The American Academy of Neurology evidence-based practice parameter on initiation of treatment for Parkinson\'s disease (Miyasaki et al., Neurology 2002;58:11-17) concluded that levodopa is effective, and remains the most effective agent, for the symptomatic treatment of Parkinson\'s disease. Codifying carbidopa/levodopa as first-line standard-of-care symptomatic therapy in a major professional-society guideline settled the indication clinically.',
    source: {
      externalId: 'src:aan-practice-parameter-pd-initiation-2002',
      name: 'Miyasaki JM, Martin W, Suchowersky O, Weiner WJ, Lang AE. Practice parameter: initiation of treatment for Parkinson\'s disease: an evidence-based review. Neurology 2002;58(1):11-17.',
      url: 'https://doi.org/10.1212/WNL.58.1.11',
      publishedAt: '2002-01-08',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-12-09',
    datePrecision: 'DAY',
    reason:
      'The ELLDOPA trial (Parkinson Study Group; Fahn et al., N Engl J Med 2004;351:2498-2508) found that levodopa either slowed the clinical progression of Parkinson\'s disease or had a prolonged pharmacologic effect, yet the neuroimaging (beta-CIT SPECT) results suggested the opposite, raising the possibility that levodopa accelerates loss of dopaminergic terminals. The clinical–imaging discordance, together with the observed dose-dependent dyskinesias, reopened the long-standing debate over whether early or high-dose levodopa is harmful, contesting the previously settled reading of the indication.',
    source: {
      externalId: 'src:elldopa-parkinson-study-group-nejm-2004',
      name: 'Fahn S, Oakes D, Shoulson I, et al. (Parkinson Study Group). Levodopa and the progression of Parkinson\'s disease. N Engl J Med 2004;351(24):2498-2508.',
      url: 'https://doi.org/10.1056/NEJMoa033447',
      publishedAt: '2004-12-09',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source ${t.source.externalId}`)
      console.log(`[dry-run] history ${historyId}: ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${t.community})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich_openfda_labels_v1',
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

    console.log(`✓ ${historyId}: ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
