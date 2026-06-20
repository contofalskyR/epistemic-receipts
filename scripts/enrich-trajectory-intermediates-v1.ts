/**
 * enrich-trajectory-intermediates-v1
 *
 * Adds web-verified, primary-sourced INTERMEDIATE epistemic transitions to four
 * curated settling curves that previously had only two transition points. Each
 * inserted CONTESTED phase is documented by a citable dated artifact (verified
 * 2026-06-20). The script also repairs chain coherence: when an intermediate is
 * inserted, the subsequent transition's fromAxis is updated to match.
 *
 * Idempotent: re-running upserts the Source by externalId and skips the
 * ClaimStatusHistory insert if the intermediate transition already exists.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INGESTED_BY = 'enrich:trajectory-intermediates-v1'

type Enrichment = {
  claimId: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
  intermediate: {
    fromAxis: string
    toAxis: string
    community: string
    occurredAt: string
    datePrecision: string
    reason: string
  }
  // the existing transition that immediately FOLLOWS the inserted one; its
  // fromAxis must be rewritten so the chain stays coherent.
  nextTransition: { occurredAt: string; newFromAxis: string }
}

const ENRICHMENTS: Enrichment[] = [
  // 1) 2,4-dinitrophenol (DNP): RECORDED 1933 -> [CONTESTED 1935] -> REVERSED 1938
  {
    claimId: 'cmqj88k8p0018saxf72bg0gd7',
    source: {
      externalId: 'src:horner-dnp-cataracts-jama-1935',
      name: 'Horner WD, Jones RB, Boardman WW. "Cataracts Following the Use of Dinitrophenol: Preliminary Report of Three Cases." JAMA. 1935;105(2):108–110.',
      url: 'https://jamanetwork.com/journals/jama/article-abstract/1154148',
      publishedAt: '1935-07-13',
      methodologyType: 'primary',
    },
    intermediate: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: '1935-07-13',
      datePrecision: 'DAY',
      reason:
        'Horner, Jones, and Boardman published in JAMA the first reported association of dinitrophenol with cataract — a preliminary report of three cases of cataract developing in patients taking DNP for obesity, a complication never reported before the summer of 1935. The paper opened the 1935 DNP cataract outbreak (predominantly young women) and, together with earlier agranulocytosis and fatal-hyperthermia reports (e.g., Silver, JAMA, Oct 1934), shifted DNP from the accepted therapeutic of the 1933 Tainter–Stockton–Cutting framing to an actively contested agent in the medical literature — roughly three years before the drug was effectively driven from medical use under the 1938 Food, Drug, and Cosmetic Act.',
    },
    nextTransition: { occurredAt: '1938-01-01', newFromAxis: 'CONTESTED' },
  },

  // 2) Lovastatin / lipid hypothesis: RECORDED 1987 -> [CONTESTED 1990] -> SETTLED 1994
  {
    claimId: 'cmqj8rws4002hsay8k5zcp19k',
    source: {
      externalId: 'src:muldoon-cholesterol-mortality-bmj-1990',
      name: 'Muldoon MF, Manuck SB, Matthews KA. "Lowering cholesterol concentrations and mortality: a quantitative review of primary prevention trials." BMJ. 1990;301(6747):309–314.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/2144195/',
      publishedAt: '1990-08-11',
      methodologyType: 'derivative',
    },
    intermediate: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: '1990-08-11',
      datePrecision: 'DAY',
      reason:
        'Muldoon, Manuck, and Matthews published in the BMJ a meta-analysis of six primary-prevention cholesterol-lowering trials (24,847 men; ~119,000 person-years; 1,147 deaths) finding that although coronary-heart-disease mortality trended down with treatment, total/all-cause mortality was NOT reduced and there was a statistically significant excess of deaths from non-illness causes (accidents, suicide, violence; p=0.004). Coming after lovastatin had established that statins lower LDL (the 1987 RECORDED point) but before any trial showed a survival benefit, it crystallized the genuine contestation over whether lowering cholesterol actually improves survival — precisely the question the 1994 Scandinavian Simvastatin Survival Study (4S) would resolve in favor of mortality benefit.',
    },
    nextTransition: { occurredAt: '1994-11-19', newFromAxis: 'CONTESTED' },
  },

  // 3) Halsted radical mastectomy: SETTLED 1894 -> [CONTESTED 1977] -> REVERSED 2002
  {
    claimId: 'cmqjgvp6100bxsa2c343k55xx',
    source: {
      externalId: 'src:fisher-nsabp-b04-first-report-cancer-1977',
      name: 'Fisher B, Montague E, Redmond C, et al. "Comparison of radical mastectomy with alternative treatments for primary breast cancer. A first report of results from a prospective randomized clinical trial." Cancer. 1977;39(6 Suppl):2827–2839.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/326381/',
      publishedAt: '1977-06-01',
      methodologyType: 'primary',
    },
    intermediate: {
      fromAxis: 'SETTLED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: '1977-06-01',
      datePrecision: 'MONTH',
      reason:
        'Fisher and the NSABP published the first report of the randomized B-04 trial (1,665 patients; clinically node-negative women randomized to radical mastectomy vs. total mastectomy with irradiation vs. total mastectomy with delayed axillary dissection). At a mean of roughly three years there was no significant difference in treatment failure or survival between radical mastectomy and the less-extensive arms — the first randomized evidence that ever-wider en bloc resection conferred no survival benefit, directly contradicting the Halstedian contiguous-spread doctrine that had been settled standard of care since 1894. This opened the active contestation that the 25-year B-04 follow-up (NEJM 2002) would convert into outright reversal.',
    },
    nextTransition: { occurredAt: '2002-08-22', newFromAxis: 'CONTESTED' },
  },

  // 4) Propoxyphene / Darvon: SETTLED 1957 -> [CONTESTED 1978] -> REVERSED 2010
  {
    claimId: 'cmqknj3rz01de8oa5oz0i78pa',
    source: {
      externalId: 'src:public-citizen-propoxyphene-petition-1978',
      name: 'Public Citizen Health Research Group (Sidney M. Wolfe, Dir.). Petition to the U.S. Department of Health, Education and Welfare / FDA to ban propoxyphene (Darvon) as an "imminent hazard," November 1978.',
      url: 'https://www.citizen.org/article/petition-to-ban-all-propoxyphene-darvon-products/',
      publishedAt: '1978-11-01',
      methodologyType: 'primary',
    },
    intermediate: {
      fromAxis: 'SETTLED',
      toAxis: 'CONTESTED',
      community: 'PUBLIC',
      occurredAt: '1978-11-01',
      datePrecision: 'MONTH',
      reason:
        'In November 1978 Sidney Wolfe\'s Public Citizen Health Research Group formally petitioned HEW/FDA (then under Commissioner Donald Kennedy) to ban propoxyphene as an "imminent hazard," citing overdose deaths. It was the first time the drug\'s safety — treated as settled since its 1957 approval — was actively contested in the institutional/regulatory record, drawing an opposing campaign from manufacturer Eli Lilly and congressional and FDA attention in 1978–79. Public Citizen re-petitioned in 2006, and the contestation persisted through the UK co-proxamol withdrawal (2005) and the EMA recommendation (2009) before the FDA-requested U.S. market withdrawal of November 2010.',
    },
    nextTransition: { occurredAt: '2010-11-19', newFromAxis: 'CONTESTED' },
  },
]

async function main() {
  let enriched = 0
  for (const e of ENRICHMENTS) {
    const claim = await prisma.claim.findUnique({ where: { id: e.claimId } })
    if (!claim) {
      console.log(`SKIP ${e.claimId}: claim not found`)
      continue
    }

    // Idempotency guard: skip if the intermediate transition already exists.
    const existing = await prisma.claimStatusHistory.findFirst({
      where: {
        claimId: e.claimId,
        toAxis: e.intermediate.toAxis,
        occurredAt: new Date(e.intermediate.occurredAt),
      },
    })
    if (existing) {
      console.log(`SKIP ${e.claimId}: intermediate already present (${existing.id})`)
      continue
    }

    // Locate the following transition to repair its fromAxis.
    const next = await prisma.claimStatusHistory.findFirst({
      where: { claimId: e.claimId, occurredAt: new Date(e.nextTransition.occurredAt) },
    })
    if (!next) {
      console.log(`SKIP ${e.claimId}: expected following transition at ${e.nextTransition.occurredAt} not found`)
      continue
    }

    await prisma.$transaction(async (tx) => {
      const source = await tx.source.upsert({
        where: { externalId: e.source.externalId },
        update: {},
        create: {
          externalId: e.source.externalId,
          name: e.source.name,
          url: e.source.url,
          publishedAt: new Date(e.source.publishedAt),
          methodologyType: e.source.methodologyType,
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: false,
        },
      })

      const hist = await tx.claimStatusHistory.create({
        data: {
          claimId: e.claimId,
          fromAxis: e.intermediate.fromAxis,
          toAxis: e.intermediate.toAxis,
          community: e.intermediate.community as any,
          occurredAt: new Date(e.intermediate.occurredAt),
          datePrecision: e.intermediate.datePrecision,
          reason: e.intermediate.reason,
          sourceId: source.id,
        },
      })

      await tx.claimStatusHistory.update({
        where: { id: next.id },
        data: { fromAxis: e.nextTransition.newFromAxis },
      })

      console.log(
        `ENRICHED ${e.claimId}: ${e.intermediate.fromAxis}->${e.intermediate.toAxis} @ ${e.intermediate.occurredAt} ` +
          `(hist ${hist.id}, src ${source.id}); next ${next.id}.fromAxis -> ${e.nextTransition.newFromAxis}`,
      )
    })
    enriched++
  }
  console.log(`\nDONE. enriched=${enriched}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
