import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Sperling RA, Aisen PS, Beckett LA, et al. (2011),
//   "Toward defining the preclinical stages of Alzheimer's disease: Recommendations
//    from the National Institute on Aging-Alzheimer's Association workgroups on
//    diagnostic guidelines for Alzheimer's disease,"
//   Alzheimer's & Dementia 7(3):280–292.
//   DOI: 10.1016/j.jalz.2011.03.003 · PMID 21514248 · OpenAlex W2129497119
//
// This is the NIA-AA workgroup paper that defined the "preclinical" stages of AD —
// the thesis that AD pathophysiology begins many years before dementia and that this
// biomarker-detectable phase is a research/therapeutic target.
// The baseline ClaimStatusHistory row (null -> RECORDED at 2011-04-22) already exists;
// this script adds only the post-publication arc.
//
// Verified adjudicating event (one transition):
//   RECORDED -> SETTLED (2018-04) — Jack CR Jr, Bennett DA, Blennow K, et al.,
//   "NIA-AA Research Framework: Toward a biological definition of Alzheimer's disease"
//   (Alzheimer's & Dementia 14(4):535–562, 2018; PMID 29653606). The same convening
//   institutions (NIA and the Alzheimer's Association) issued a consensus research
//   framework that operationalized the 2011 proposal: AD is defined biologically by
//   in-vivo biomarkers (the A/T/N classification), with a continuum that begins in a
//   preclinical, asymptomatic stage. This adopted and formalized the core thesis of
//   Sperling et al. (2011) as the canonical research standard for the field.
//   Community: EXPERT_LITERATURE.
//
// No retraction, expression of concern, or dated failed replication of the
// preclinical-phase concept exists; no contest step is invented.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-sperling-2011-preclinical-alzheimers-disease.ts

const claimId = 'cmpm1y6j10gkdsadnpr47nkys'

interface Arc {
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

const ARCS: Arc[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2018-04',
    datePrecision: 'MONTH',
    reason:
      'Jack CR Jr, Bennett DA, Blennow K, et al., "NIA-AA Research Framework: Toward a biological definition of Alzheimer\'s disease" (Alzheimer\'s & Dementia 14(4):535–562, 2018) — issued by the same convening bodies (NIA and the Alzheimer\'s Association) — adjudicated the 2011 proposal by adopting it as the field\'s canonical research standard. The framework defines AD biologically via in-vivo biomarkers (the A/T/N system) along a continuum that begins in a preclinical, asymptomatic stage, formalizing and operationalizing Sperling et al. (2011)\'s central thesis that AD pathophysiology precedes dementia by years and constitutes a distinct, detectable preclinical phase. The core finding was thereby settled as expert consensus rather than overturned.',
    source: {
      externalId: 'src:jack-2018-niaaa-research-framework',
      name: 'Jack CR Jr, Bennett DA, Blennow K, Carrillo MC, Dunn B, Haeberlein SB, Holtzman DM, Jagust W, Jessen F, Karlawish J, Liu E, Molinuevo JL, Montine T, Phelps C, Rankin KP, Rowe CC, Scheltens P, Siemers E, Snyder HM, Sperling R. NIA-AA Research Framework: Toward a biological definition of Alzheimer\'s disease. Alzheimer\'s & Dementia 2018;14(4):535–562. PMID 29653606.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/29653606/',
      publishedAt: '2018-04-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: claimId } })
  if (!claim) throw new Error(`Claim ${claimId} not found — aborting.`)

  for (const arc of ARCS) {
    const source = await prisma.source.upsert({
      where: { externalId: arc.source.externalId },
      create: {
        externalId: arc.source.externalId,
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
      },
    })

    const histId = `${claimId}-${arc.toAxis}-${arc.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: claim.id,
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        reason: arc.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: arc.fromAxis,
        toAxis: arc.toAxis,
        community: arc.community,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        reason: arc.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: claim.id, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: claim.id, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`Upserted ${arc.fromAxis} -> ${arc.toAxis} @ ${arc.occurredAt} (${histId})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
