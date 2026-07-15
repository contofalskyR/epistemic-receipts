import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Lifshitz & Slyozov (1961), "The kinetics of precipitation from supersaturated
//   solid solutions," J. Phys. Chem. Solids 19, 35–50 — the LSW theory of Ostwald
//   ripening / the t^(1/3) diffusion-controlled coarsening law.
//   DOI: 10.1016/0022-3697(61)90054-3 | OpenAlex: W2022308914
//
// The baseline row (fromAxis=null -> RECORDED @ 1961-04-01) already exists; do NOT
// duplicate it. This script adds the post-publication arc:
//   RECORDED -> CONTESTED  (Ardell 1972, finite-volume-fraction critique)
//   CONTESTED -> SETTLED   (Voorhees 1985 canonical review, framework vindicated)

const claimId = 'cmq2w4s5e00hfsa8h98sxw0yj'

type Transition = {
  fromAxis: string | null
  toAxis: string
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string // YYYY-MM-DD
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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1972-01-01',
    datePrecision: 'MONTH',
    reason:
      "Lifshitz and Slyozov's theory predicted that the asymptotic coarsening rate constant is independent of precipitate volume fraction and that particle sizes follow a single universal distribution — results derived strictly in the zero-volume-fraction (mean-field) limit. Ardell's 1972 analysis in Acta Metallurgica showed that at finite volume fraction the coarsening rate rises with volume fraction and the size distributions broaden beyond the LSW form, opening a sustained contest over the quantitative predictions of the theory.",
    source: {
      externalId: 'src:ardell-volume-fraction-coarsening-1972',
      name: 'Ardell, A. J. (1972), "The effect of volume fraction on particle coarsening: theoretical considerations," Acta Metallurgica 20(1), 61–71',
      url: 'https://doi.org/10.1016/0001-6160(72)90114-9',
      publishedAt: '1972-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1985-01-01',
    datePrecision: 'MONTH',
    reason:
      'Voorhees\' 1985 review "The theory of Ostwald ripening" (Journal of Statistical Physics) consolidated two decades of theory and experiment, establishing that the Lifshitz–Slyozov t^(1/3) asymptotic coarsening law is the correct universal scaling for diffusion-controlled ripening and that the finite-volume-fraction corrections (MLSW, LSEM, and related theories) refine rather than overturn it. The LSW framework thereby settled as the foundational theory of Ostwald ripening.',
    source: {
      externalId: 'src:voorhees-theory-ostwald-ripening-1985',
      name: 'Voorhees, P. W. (1985), "The theory of Ostwald ripening," Journal of Statistical Physics 38(1–2), 231–252',
      url: 'https://doi.org/10.1007/BF01017860',
      publishedAt: '1985-01-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of transitions) {
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-corpus-openalex_v1',
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const occurredAt = new Date(t.occurredAt)
    const slug = `${claimId}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt,
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt,
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${slug})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
