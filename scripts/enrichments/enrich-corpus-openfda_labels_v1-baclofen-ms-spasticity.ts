// Enrichment: epistemic arc for the FDA "Baclofen (BACLOFEN)" prescription
// drug label claim.
//
// Claim: cmpiykkig913uplo7tnfr6kux (openfda_labels_v1)
//   "BACLOFEN (BACLOFEN): INDICATIONS & USAGE Baclofen tablets, USP are useful
//    for the alleviation of signs and symptoms of spasticity resulting from
//    multiple sclerosis, particularly for the relief of flexor spasms and
//    concomitant pain, clonus, and muscular rigidity ... may also be of some
//    value in patients with spinal cord injuries and other spinal cord
//    diseases ..."
//
// The 2026 label filing is only when *this* package emerged. Oral baclofen
// itself has a genuine, dateable, externally verifiable multi-step epistemic
// arc, anchored on the multiple-sclerosis spasticity indication carried on this
// label — the indication whose evidentiary milestones (a pivotal controlled
// trial, a national first-line practice guideline) and closing safety signal are
// cleanly dated and citable to stable sources.
//
// Arc (extends the existing fromAxis=null -> OPEN entry; do not duplicate it):
//   OPEN     -> RECORDED  (1978-11)     Feldman et al.'s double-blind crossover
//                         and three-year study in Neurology established
//                         baclofen's efficacy at reducing spasticity in multiple
//                         sclerosis, providing the first high-quality published
//                         controlled clinical evidence for the MS-spasticity
//                         indication carried on this label. Ratified by
//                         EXPERT_LITERATURE. (This reinforced the pivotal
//                         Sachais et al. multicenter controlled trial that
//                         underpinned the 1977 FDA approval of Lioresal.)
//   RECORDED -> SETTLED   (2014-10-08)  The UK National Institute for Health and
//                         Care Excellence guideline CG186 ("Multiple sclerosis in
//                         adults: management") recommended baclofen (or
//                         gabapentin) as first-line pharmacological treatment for
//                         spasticity in MS, codifying baclofen's standard-of-care
//                         status in a national evidence-based guideline. Ratified
//                         by INSTITUTIONAL.
//   SETTLED  -> CONTESTED (2019-11-26)  Muanda et al.'s population-based cohort
//                         study in JAMA associated baclofen use with a markedly
//                         increased risk of hospitalization with encephalopathy
//                         in patients with chronic kidney disease, a serious
//                         post-market safety signal driven by impaired renal
//                         clearance of the drug. The finding contests baclofen's
//                         settled benefit-risk standing in the substantial CKD
//                         subpopulation prescribed it for spasticity. Ratified by
//                         EXPERT_LITERATURE.
//
// URLs are anchored on stable publisher DOIs (Neurology, JAMA) and a stable NICE
// guidance URL. Live web verification was unavailable in this session
// (WebSearch/WebFetch not permitted), so per AGENTS.md sources are limited to
// URLs whose form is structurally reliable — legacy Neurology and modern AMA
// DOIs on doi.org, and the canonical NICE guidance path — and no press-release
// or Federal Register document slug was invented.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-baclofen-ms-spasticity.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiykkig913uplo7tnfr6kux'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1978-11-01',
    datePrecision: 'MONTH',
    reason:
      'Feldman and colleagues published a double-blind crossover and three-year study in Neurology demonstrating that baclofen significantly reduced spasticity, flexor spasms, and associated signs in patients with multiple sclerosis. This was among the first high-quality published controlled clinical evidence supporting the multiple-sclerosis spasticity indication carried on this label, recording the efficacy claim into the peer-reviewed record and reinforcing the pivotal multicenter controlled trial that underpinned the 1977 FDA approval of oral baclofen (Lioresal).',
    source: {
      externalId: 'src:baclofen-feldman-1978-neurology-ms-spasticity-rct',
      name: 'Feldman RG, Kelly-Hayes M, Conomy JP, Foley JM. "Baclofen for spasticity in multiple sclerosis: Double-blind crossover and three-year study." Neurology. 1978;28(11):1094-1098. doi:10.1212/WNL.28.11.1094.',
      url: 'https://doi.org/10.1212/WNL.28.11.1094',
      publishedAt: '1978-11-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2014-10-08',
    datePrecision: 'DAY',
    reason:
      'The UK National Institute for Health and Care Excellence issued clinical guideline CG186, "Multiple sclerosis in adults: management," recommending baclofen (or gabapentin) as a first-line pharmacological treatment for spasticity in people with multiple sclerosis. The guideline codified baclofen as a standard-of-care agent for MS spasticity in a national evidence-based recommendation, moving the recorded efficacy claim into a settled state ratified by a major health-technology institution.',
    source: {
      externalId: 'src:baclofen-nice-cg186-2014-ms-management',
      name: 'National Institute for Health and Care Excellence. "Multiple sclerosis in adults: management." NICE guideline CG186. Published 8 October 2014.',
      url: 'https://www.nice.org.uk/guidance/cg186',
      publishedAt: '2014-10-08',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2019-11-26',
    datePrecision: 'DAY',
    reason:
      'Muanda and colleagues published a population-based cohort study in JAMA associating baclofen use with a substantially increased risk of hospitalization with encephalopathy in older adults with chronic kidney disease, a serious post-market safety signal attributed to reduced renal clearance and accumulation of the drug. The finding contests baclofen\'s settled benefit-risk standing in the large CKD subpopulation who may receive it for spasticity, prompting calls for dose caution and renal-function-based prescribing.',
    source: {
      externalId: 'src:baclofen-muanda-2019-jama-ckd-encephalopathy',
      name: 'Muanda FT, Weir MA, Ahmadi F, et al. "Association of Baclofen With Encephalopathy in Patients With Chronic Kidney Disease." JAMA. 2019;322(20):1987-1995. doi:10.1001/jama.2019.17725.',
      url: 'https://doi.org/10.1001/jama.2019.17725',
      publishedAt: '2019-11-26',
      methodologyType: 'primary',
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
        ingestedBy: 'enrich-openfda_labels_v1',
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const occurredAt = new Date(t.occurredAt)
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${slug} (${t.fromAxis} -> ${t.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
