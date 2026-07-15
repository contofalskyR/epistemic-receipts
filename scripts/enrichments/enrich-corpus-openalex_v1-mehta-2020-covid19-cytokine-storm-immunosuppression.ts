// Enrichment: post-publication epistemic trajectory for
//   Mehta P, et al. "COVID-19: consider cytokine storm syndromes and immunosuppression."
//   The Lancet 2020;395(10229):1033–1034. DOI 10.1016/S0140-6736(20)30628-0
//   OpenAlex W3012421327 · Claim cmq2w4hud00b3sa8hvgrensvx
//
// The baseline row (fromAxis=null -> RECORDED @ 2020-03-01) already exists and is
// NOT recreated here. This script adds the two verified post-publication transitions:
//
//   1. RECORDED -> CONTESTED @ 2020-06-30
//      Sinha, Matthay & Calfee, "Is a 'Cytokine Storm' Relevant to COVID-19?"
//      (JAMA Internal Medicine) directly challenged the cytokine-storm framing that
//      motivated the correspondence, arguing measured cytokine levels in COVID-19 were
//      well below those of classic cytokine-release/ARDS states.
//
//   2. CONTESTED -> SETTLED @ 2020-09-02
//      WHO "Corticosteroids for COVID-19: living guidance" recommended systemic
//      corticosteroids (immunosuppression) for severe/critical COVID-19 — vindicating
//      the therapeutic recommendation to consider immunosuppression, and resolving it
//      into clinical consensus even as the "storm" label debate continued.
//
// Idempotent: upserts sources on externalId, transitions on the slug id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mehta-2020-covid19-cytokine-storm-immunosuppression.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w4hud00b3sa8hvgrensvx'

interface TransitionDef {
  fromAxis: string | null
  toAxis: string
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

const TRANSITIONS: TransitionDef[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2020-06-30',
    datePrecision: 'DAY',
    reason:
      'Sinha, Matthay & Calfee published "Is a \'Cytokine Storm\' Relevant to COVID-19?" in JAMA Internal Medicine, directly challenging the mechanistic premise of the Mehta correspondence. They argued that circulating cytokine (notably IL-6) levels in severe COVID-19 were substantially lower than in classic cytokine-release syndromes and ARDS, cautioning that the "cytokine storm" label could drive inappropriately broad immunosuppression. This is a specific, dated methodological critique of the finding.',
    source: {
      externalId: 'src:sinha-cytokine-storm-covid19-2020',
      name: 'Sinha P, Matthay MA, Calfee CS. Is a "Cytokine Storm" Relevant to COVID-19? JAMA Internal Medicine 2020;180(9):1152–1154.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/32602883/',
      publishedAt: '2020-06-30',
      methodologyType: 'opinion',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-09-02',
    datePrecision: 'DAY',
    reason:
      'WHO issued "Corticosteroids for COVID-19: living guidance," recommending systemic corticosteroids for patients with severe and critical COVID-19 (a strong recommendation grounded in a prospective meta-analysis of seven RCTs and the RECOVERY dexamethasone trial). This institutional guideline vindicated the correspondence\'s core recommendation — to consider immunosuppression for the hyperinflammatory subset — settling it into standard care even as debate over the precise "cytokine storm" label persisted.',
    source: {
      externalId: 'src:who-corticosteroids-covid19-living-guidance-2020',
      name: 'World Health Organization. Corticosteroids for COVID-19: living guidance, 2 September 2020.',
      url: 'https://www.who.int/news-room/feature-stories/detail/who-updates-clinical-care-guidance-with-corticosteroid-recommendations',
      publishedAt: '2020-09-02',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openalex_v1',
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

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

    console.log(`upserted ${slug} (${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
