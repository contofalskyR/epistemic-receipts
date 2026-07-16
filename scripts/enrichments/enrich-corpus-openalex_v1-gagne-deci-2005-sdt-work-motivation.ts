// Epistemic-receipt enrichment: Gagné & Deci (2005), "Self-determination theory
// and work motivation" (Journal of Organizational Behavior 26(4):331–362,
// DOI 10.1002/job.322, OpenAlex W2084389751).
//
// The paper proposed self-determination theory — with extrinsic motivation
// differentiated into autonomy-varying types — as a theory of work motivation.
// The baseline RECORDED row (fromAxis=null -> RECORDED at publication, 2005-04-14)
// already exists; this script adds only the post-publication adjudication.
//
// Adjudicating event: Deci, Olafsen & Ryan (2017), "Self-Determination Theory in
// Work Organizations: The State of a Science" (Annual Review of Organizational
// Psychology and Organizational Behavior 4:19–43, DOI
// 10.1146/annurev-orgpsych-032516-113108). A state-of-the-science review in the
// field's gold-standard consensus venue, stocktaking a dozen years of accumulated
// evidence and establishing SDT as an established science of work motivation —
// supporting RECORDED -> SETTLED. No dated retraction, expression of concern, or
// major methodological critique put the work-motivation claim into genuine contest,
// so no CONTESTED step is asserted.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-gagne-deci-2005-sdt-work-motivation.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-gagne-deci-2005-sdt-work-motivation.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm17wqq04bdsadnckei8lpd'

interface Transition {
  fromAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
  toAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
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

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2017-03-21',
    datePrecision: 'DAY',
    reason:
      'Deci, Olafsen & Ryan\'s "Self-Determination Theory in Work Organizations: The State of a Science" (Annual Review of Organizational Psychology and Organizational Behavior, 21 March 2017) is a field-consensus stocktaking review that adjudicates exactly the claim Gagné & Deci (2005) proposed — SDT, built on autonomy-differentiated extrinsic motivation, as a theory of work motivation. Published in Annual Reviews, the standard venue for declaring a research area established, it synthesizes a dozen years of accumulated workplace evidence (including meta-analytic support such as Van den Broeck et al., 2016) and treats autonomous vs. controlled work motivation and the basic-needs framework as an established science. This marks the transition from a newly recorded proposal to a settled theory in the expert literature.',
    source: {
      externalId: 'src:deci-olafsen-ryan-2017-sdt-work-state-of-science',
      name: 'Deci EL, Olafsen AH, Ryan RM. Self-Determination Theory in Work Organizations: The State of a Science. Annual Review of Organizational Psychology and Organizational Behavior 2017;4:19–43.',
      url: 'https://doi.org/10.1146/annurev-orgpsych-032516-113108',
      publishedAt: '2017-03-21',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
      console.log(`[dry-run]   source: ${tr.source.externalId} — ${tr.source.url}`)
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
        ingestedBy: 'enrich:openalex_v1-gagne-deci-2005',
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

    console.log(`upserted ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
