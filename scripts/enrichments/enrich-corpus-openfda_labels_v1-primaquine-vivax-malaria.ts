// Enrichment: epistemic arc for Primaquine Phosphate (PRIMAQUINE PHOSPHATE),
//   radical cure of vivax malaria — claim id cmpixy60g8bzcplo75qu0tnu0 (openfda_labels_v1)
//
// Primaquine is an 8-aminoquinoline and the first agent proven to eradicate the
// dormant liver-stage hypnozoites of Plasmodium vivax, giving a "radical cure"
// (prevention of relapse). Its epistemic arc:
//   OPEN   -> RECORDED : The Stateville Penitentiary curative-treatment trials
//                        (Alving et al., early 1950s) provided the first
//                        controlled clinical evidence that primaquine prevents
//                        relapse of vivax malaria — the primary evidence behind
//                        the radical-cure indication.
//   RECORDED -> SETTLED: WHO codified the primaquine radical-cure regimen for
//                        P. vivax in its treatment guidelines, making it the
//                        global standard of care.
//   SETTLED -> CONTESTED: The discovery that G6PD-deficient patients suffer
//                        acute hemolytic anemia on primaquine (Carson et al.,
//                        Science 1956) is the foundational post-market safety
//                        signal — now reflected in the FDA label's G6PD warning
//                        and contraindication — that keeps unscreened routine use
//                        in a contested state.
//
// Does NOT create a Claim — only Source + ClaimStatusHistory rows for the
// existing claim. Idempotent (upserts). The existing null->first row is left
// untouched.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-primaquine-vivax-malaria.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpixy60g8bzcplo75qu0tnu0'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
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
  // ── OPEN -> RECORDED : Stateville curative-treatment trials ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1953-01-01',
    datePrecision: 'YEAR',
    reason:
      'The University of Chicago malaria research program at Stateville Penitentiary conducted the pivotal curative-treatment studies of primaquine in Korean War–era vivax malaria (Alving et al., Am J Trop Med Hyg, 1953), establishing that an 8-aminoquinoline could reliably clear the relapse-causing liver stages of Plasmodium vivax. These controlled human trials were the first published clinical evidence that primaquine produces a radical cure — preventing relapse rather than merely suppressing blood-stage parasitemia. This body of evidence is the primary clinical basis for the anti-relapse indication carried on the modern FDA label.',
    source: {
      externalId: 'src:ajtmh-1953-alving-korean-vivax-primaquine',
      name: 'Alving AS, Hankey DD, Coatney GR, et al. "Korean vivax malaria. II. Curative treatment with pamaquine and primaquine." Am J Trop Med Hyg. 1953;2(6):970–976.',
      url: 'https://doi.org/10.4269/ajtmh.1953.2.970',
      publishedAt: '1953-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED : WHO malaria guidelines codify radical cure ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2015-08-31',
    datePrecision: 'MONTH',
    reason:
      'The World Health Organization codified a primaquine course as the standard radical-cure regimen for Plasmodium vivax and P. ovale in its Guidelines for the Treatment of Malaria (3rd edition, 2015), recommending it alongside blood-stage schizonticidal therapy to prevent relapse. Primaquine is also listed on the WHO Model List of Essential Medicines. This guideline inclusion moved the anti-relapse use of primaquine from documented clinical evidence to globally accepted standard of care, ratified by an institutional body synthesizing the full weight of the evidence.',
    source: {
      externalId: 'src:who-2015-guidelines-treatment-malaria-primaquine-radical-cure',
      name: 'World Health Organization. "Guidelines for the treatment of malaria," 3rd edition (2015) — primaquine radical cure for P. vivax/P. ovale.',
      url: 'https://www.who.int/publications/i/item/9789241549127',
      publishedAt: '2015-08-31',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED : G6PD-deficiency hemolysis safety signal ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1956-09-14',
    datePrecision: 'DAY',
    reason:
      'Carson, Flanagan, Ickes and Alving (Science, 14 September 1956) identified glucose-6-phosphate dehydrogenase (G6PD) deficiency as the cause of the acute hemolytic anemia seen in "primaquine-sensitive" patients, a safety signal that emerged directly from primaquine administration. Because a substantial fraction of the malaria-endemic population is G6PD-deficient, this finding requires G6PD testing before treatment and is reflected in the FDA label\'s contraindication and warning against use in G6PD-deficient individuals. The hemolytic risk keeps routine unscreened radical-cure use in a contested state, gating administration on pre-treatment enzyme testing.',
    source: {
      externalId: 'src:science-1956-carson-g6pd-primaquine-sensitive-erythrocytes',
      name: 'Carson PE, Flanagan CL, Ickes CE, Alving AS. "Enzymatic deficiency in primaquine-sensitive erythrocytes." Science. 1956;124(3220):484–485.',
      url: 'https://doi.org/10.1126/science.124.3220.484',
      publishedAt: '1956-09-14',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1-primaquine-vivax-malaria',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
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
    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`Enriched claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
