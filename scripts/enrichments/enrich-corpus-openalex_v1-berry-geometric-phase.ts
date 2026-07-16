import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for Berry (1984), "Quantal phase factors
// accompanying adiabatic changes" (Proc. R. Soc. Lond. A 392, 45).
// Claim id is the EXISTING claim; the baseline fromAxis=null -> RECORDED row
// at the 1984-03-08 publication date already exists and is NOT duplicated here.
//
// Arc: Berry's paper was a THEORETICAL PREDICTION — an adiabatically transported
// eigenstate acquires a measurable, gauge-invariant geometric phase gamma(C).
// It was never retracted or seriously contested; instead it was vindicated by
// direct experiment. Tomita & Chiao (1986) made the first direct observation of
// the geometric (Berry) phase, using the rotation of light polarization in a
// helically wound optical fiber, quantitatively matching Berry's formula. This
// is the RECORDED -> SETTLED (vindicated) transition.

const claimId = 'cmq2w4n9r00efsa8heugtv8je'

type Transition = {
  fromAxis: string
  toAxis: string
  community: string
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
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1986-08-25',
    datePrecision: 'DAY',
    reason:
      "Tomita & Chiao (Phys. Rev. Lett. 57, 937) reported the first direct experimental observation of Berry's geometric phase, measuring the predicted rotation of the plane of polarization of light passing through a helically wound single-mode optical fiber. The measured phase tracked the solid angle subtended by the path in momentum space, quantitatively confirming Berry's adiabatic-phase formula. The experimental vindication of a purely theoretical prediction moved the finding from RECORDED to SETTLED within the physics literature.",
    source: {
      externalId: 'src:prl-tomita-chiao-1986-berry-phase',
      name: "Tomita & Chiao (1986), Observation of Berry's Topological Phase by Use of an Optical Fiber, Phys. Rev. Lett. 57, 937",
      url: 'https://doi.org/10.1103/PhysRevLett.57.937',
      publishedAt: '1986-08-25',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (let i = 0; i < transitions.length; i++) {
    const tr = transitions[i]

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1-berry-geometric-phase',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
