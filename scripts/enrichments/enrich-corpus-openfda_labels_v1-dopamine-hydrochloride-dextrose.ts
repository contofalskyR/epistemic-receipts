// Enrichment: epistemic arc for the Dopamine Hydrochloride in Dextrose FDA-label claim
// (openfda_labels_v1, claim cmpixryuw841cplo7517flnwf).
//
// Adds ClaimStatusHistory rows for dopamine's clinical trajectory as a
// catecholamine vasopressor/inotrope for shock:
//   OPEN     -> RECORDED   MacCannell et al. first clinical trial in hypotension/shock (NEJM, 1966)
//   RECORDED -> SETTLED    Surviving Sepsis Campaign lists dopamine as first-line vasopressor (2008)
//   SETTLED  -> CONTESTED  SOAP II RCT: dopamine vs norepinephrine, excess arrhythmia/mortality (NEJM, 2010)
//
// Idempotent: upserts Sources on externalId and ClaimStatusHistory rows on a
// deterministic `${claimId}-${toAxis}-${occurredAt}` slug id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-dopamine-hydrochloride-dextrose.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-dopamine-hydrochloride-dextrose.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpixryuw841cplo7517flnwf'

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
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: first clinical trial of dopamine in hypotension/shock ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1966-12-15',
    datePrecision: 'DAY',
    reason:
      'MacCannell, McNay, Meyer and Goldberg reported the first systematic clinical study of dopamine infusion in patients with hypotension and shock in The New England Journal of Medicine in December 1966, showing dose-dependent increases in cardiac output, blood pressure and urine flow. This established the primary human evidence that dopamine improves hemodynamic status in shock, the effect underpinning the labeled indication. The study translated Goldberg\'s pharmacologic characterization of dopamine\'s dopaminergic and beta-adrenergic actions into a documented therapeutic use.',
    source: {
      externalId: 'src:maccannell-dopamine-hypotension-shock-nejm-1966',
      name: 'MacCannell KL, McNay JL, Meyer MB, Goldberg LI. Dopamine in the treatment of hypotension and shock. N Engl J Med 1966;275(24):1389–1398.',
      url: 'https://doi.org/10.1056/NEJM196612152752505',
      publishedAt: '1966-12-15',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: guideline first-line vasopressor status ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2008-01-01',
    datePrecision: 'MONTH',
    reason:
      'The 2008 Surviving Sepsis Campaign international guidelines (Crit Care Med, Jan 2008) codified dopamine — alongside norepinephrine — as a first-choice vasopressor for restoring blood pressure in septic and other distributive shock, reflecting decades of standard ICU use. Dopamine is likewise carried on the WHO Model List of Essential Medicines. By this point dopamine\'s role in improving hemodynamic status in shock was settled clinical practice rather than an open research question.',
    source: {
      externalId: 'src:surviving-sepsis-campaign-guidelines-2008',
      name: 'Dellinger RP, Levy MM, Carlet JM, et al. Surviving Sepsis Campaign: international guidelines for management of severe sepsis and septic shock: 2008. Crit Care Med 2008;36(1):296–327.',
      url: 'https://doi.org/10.1097/01.CCM.0000298158.12101.41',
      publishedAt: '2008-01-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: SOAP II — excess arrhythmia and mortality signal ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2010-03-04',
    datePrecision: 'DAY',
    reason:
      'The SOAP II randomized controlled trial (De Backer et al., NEJM, March 2010) compared dopamine and norepinephrine as first-line vasopressors in shock and found dopamine caused significantly more arrhythmic events and higher 28-day mortality in the cardiogenic-shock subgroup. On this evidence subsequent Surviving Sepsis Campaign guidelines (2012 onward) recommended norepinephrine over dopamine as the first-line agent, demoting dopamine to a reserve option. The trial did not withdraw dopamine\'s indication but contested its standing as a preferred vasopressor for improving hemodynamic status in shock.',
    source: {
      externalId: 'src:soap-ii-dopamine-vs-norepinephrine-nejm-2010',
      name: 'De Backer D, Biston P, Devriendt J, et al. Comparison of dopamine and norepinephrine in the treatment of shock. N Engl J Med 2010;362(9):779–789.',
      url: 'https://doi.org/10.1056/NEJMoa0907118',
      publishedAt: '2010-03-04',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(
        `[dry-run] ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${t.datePrecision})  src=${t.source.externalId}  id=${slug}`,
      )
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
        ingestedBy: 'enrich-openfda_labels_v1',
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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

    console.log(`upserted ${slug}  (${t.fromAxis ?? 'null'} -> ${t.toAxis})`)
  }

  console.log(DRY_RUN ? 'dry-run complete' : 'enrichment complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
