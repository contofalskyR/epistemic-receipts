import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Claim: UK Prospective Diabetes Study Group (1998), "Tight blood pressure
// control and risk of macrovascular and microvascular complications in type 2
// diabetes (UKPDS 38)", BMJ 317(7160):703-713.
// DOI 10.1136/bmj.317.7160.703 | OpenAlex W3198570063
// Baseline row (fromAxis=null -> RECORDED @ 1998-09-12) already exists; do NOT duplicate.
const claimId = 'cmply99nq02j3saihr8ntwe9d'

type Transition = {
  fromAxis: 'RECORDED' | 'CONTESTED'
  toAxis: 'CONTESTED' | 'SETTLED'
  community: 'EXPERT_LITERATURE'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const transitions: Transition[] = [
  {
    // Post-trial monitoring found the blood-pressure benefit was NOT durable.
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2008-10-09',
    datePrecision: 'DAY',
    reason:
      'Holman, Paul, Bethel, Neil & Matthews (2008), "Long-Term Follow-up after Tight Control of Blood Pressure in Type 2 Diabetes" (N Engl J Med 359(15):1565-1576), reported the 10-year post-trial monitoring of the UKPDS 38 cohort. Within two years of the trial ending the between-group blood-pressure difference had disappeared, and the earlier reductions in clinical endpoints also diminished and lost statistical significance. Unlike tight glucose control, tight blood-pressure control produced no sustained "legacy effect"—benefit required ongoing control. This directly challenged the durability implied by UKPDS 38, moving the finding from RECORDED to CONTESTED.',
    source: {
      externalId: 'src:holman-2008-ukpds-bp-legacy',
      name: 'Holman RR, Paul SK, Bethel MA, Neil HAW, Matthews DR (2008), "Long-Term Follow-up after Tight Control of Blood Pressure in Type 2 Diabetes", N Engl J Med 359(15):1565-1576',
      url: 'https://pubmed.ncbi.nlm.nih.gov/18784091/',
      publishedAt: '2008-10-09',
      methodologyType: 'primary',
    },
  },
  {
    // Large adjudicating meta-analysis vindicating the core BP-lowering benefit.
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-02-10',
    datePrecision: 'DAY',
    reason:
      'Emdin, Rahimi, Neal, Callender, Perkovic & Patel (2015), "Blood Pressure Lowering in Type 2 Diabetes: A Systematic Review and Meta-analysis" (JAMA 313(6):603-615), pooled 40 randomised trials with 100,354 participants and found that each 10 mm Hg reduction in systolic blood pressure was associated with significantly lower all-cause mortality, cardiovascular events, coronary heart disease, stroke, albuminuria and retinopathy in type 2 diabetes. This large evidence synthesis adjudicated the contested question in favour of UKPDS 38\'s core thesis—that lowering blood pressure prevents macrovascular and microvascular complications—while clarifying diminishing returns below ~140 mm Hg. It moves the finding from CONTESTED to SETTLED in the expert literature.',
    source: {
      externalId: 'src:emdin-2015-bp-t2dm-meta-analysis',
      name: 'Emdin CA, Rahimi K, Neal B, Callender T, Perkovic V, Patel A (2015), "Blood Pressure Lowering in Type 2 Diabetes: A Systematic Review and Meta-analysis", JAMA 313(6):603-615',
      url: 'https://pubmed.ncbi.nlm.nih.gov/25668264/',
      publishedAt: '2015-02-10',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of transitions) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1-ukpds38-tight-bp-control-1998',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
  }

  console.log('Done: 2 transitions upserted for UKPDS 38 (tight BP control, 1998).')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
