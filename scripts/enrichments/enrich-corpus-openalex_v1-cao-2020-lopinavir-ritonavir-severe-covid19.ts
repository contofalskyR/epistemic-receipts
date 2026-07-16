// Enrichment: post-publication epistemic trajectory for Cao et al. 2020,
// "A Trial of Lopinavir–Ritonavir in Adults Hospitalized with Severe Covid-19"
// (N Engl J Med 2020;382:1787-1799).
//
// Claim:    cmply55gk00j3saihio1ibhiu
// DOI:      10.1056/nejmoa2001282  (Crossref confirms identity; created 2020-03-18)
// OpenAlex: W3012379316
//
// The baseline row (fromAxis=null -> RECORDED at 2020-03-18) already exists; do
// NOT duplicate it. This script adds the one verified downstream transition.
//
// Arc:
//   RECORDED -> SETTLED (2020-10-05, EXPERT_LITERATURE)
//     Cao's trial (199 patients) found that lopinavir-ritonavir produced no
//     benefit over standard care for time to clinical improvement, mortality,
//     or viral load in severe Covid-19 — a null finding, but from a single,
//     comparatively small trial. That finding was definitively vindicated by the
//     RECOVERY platform trial (Horby et al., Lancet 2020;396:1345-1352,
//     DOI 10.1016/S0140-6736(20)32013-4), which randomized 1,616 patients to
//     lopinavir-ritonavir vs 3,424 to usual care and found no difference in
//     28-day mortality (23% vs 22%), hospital discharge, or progression to
//     ventilation. The WHO SOLIDARITY interim results (NEJM 2021;384:497-511,
//     DOI 10.1056/NEJMoa2023184) reinforced this, reporting little or no effect
//     of lopinavir on mortality. The null result therefore moved from a single
//     record to settled expert-literature consensus that lopinavir-ritonavir is
//     ineffective for Covid-19.
//
// No retraction or expression of concern exists (Retraction Watch / PubMed
// negative; Crossref is-retracted flag false). The finding was confirmed rather
// than contested, so no CONTESTED or REVERSED node is added.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cao-2020-lopinavir-ritonavir-severe-covid19.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cao-2020-lopinavir-ritonavir-severe-covid19.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply55gk00j3saihio1ibhiu'

interface Transition {
  fromAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED'
  toAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED'
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
    occurredAt: '2020-10-05',
    datePrecision: 'DAY',
    reason:
      'Cao et al. (199 patients) found no benefit of lopinavir-ritonavir over standard care in severe Covid-19 — a null result from a single, comparatively small trial. The RECOVERY platform trial vindicated it definitively: 1,616 patients randomized to lopinavir-ritonavir vs 3,424 to usual care showed no difference in 28-day mortality (23% vs 22%), time to discharge, or progression to mechanical ventilation. Reinforced by the WHO SOLIDARITY interim results (NEJM 2021, DOI 10.1056/NEJMoa2023184), which reported little or no effect of lopinavir on mortality. The finding that lopinavir-ritonavir is ineffective for Covid-19 thus became settled expert-literature consensus.',
    source: {
      externalId: 'src:recovery-lopinavir-ritonavir-covid19-2020',
      name: 'RECOVERY Collaborative Group (Horby PW, et al.). Lopinavir–ritonavir in patients admitted to hospital with COVID-19 (RECOVERY): a randomised, controlled, open-label, platform trial. Lancet. 2020;396(10259):1345-1352. DOI 10.1016/S0140-6736(20)32013-4.',
      url: 'https://doi.org/10.1016/S0140-6736(20)32013-4',
      publishedAt: '2020-10-05',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry] ${slug}  ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.community})`)
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
        ingestedBy: 'enrich-corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
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
        reason: tr.reason,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        reason: tr.reason,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`  ✓ ${slug}  ${tr.fromAxis} -> ${tr.toAxis} (${tr.community})`)
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
