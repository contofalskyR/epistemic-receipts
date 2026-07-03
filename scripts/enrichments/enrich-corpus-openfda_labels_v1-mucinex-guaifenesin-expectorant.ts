// Enrichment: epistemic arc for the Mucinex (GUAIFENESIN) OTC drug-label claim
// (claim id cmpiyc2jz8r9cplo7whi1gzse — "Purpose Expectorant").
//
// Guaifenesin is the single active ingredient the FDA recognizes as generally
// recognized as safe and effective (GRASE) for the OTC "expectorant" purpose. Its
// trajectory is a genuine, dateable, multi-step arc — but note it is an EFFICACY
// arc, not a safety arc: guaifenesin has no black-box warning, no post-market
// safety signal, and no market withdrawal. The contestation at the end of the arc
// is about whether the ingredient actually works, not whether it is safe.
//   OPEN -> RECORDED    : early controlled clinical study of the expectorant effect (Hirsch et al., 1973)
//   RECORDED -> SETTLED : FDA OTC monograph (21 CFR Part 341) recognizes guaifenesin as the sole GRASE expectorant (1994)
//   SETTLED -> CONTESTED : Cochrane systematic review finds no good evidence for OTC expectorants (2014)
//
// Idempotent: upserts Source on externalId and ClaimStatusHistory on a deterministic
// id. Does NOT create a new Claim and does NOT duplicate the existing fromAxis=null
// status row.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-mucinex-guaifenesin-expectorant.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyc2jz8r9cplo7whi1gzse'

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
  // 1) OPEN -> RECORDED : early controlled clinical study of guaifenesin's expectorant effect
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1973-01-01',
    datePrecision: 'MONTH',
    reason:
      'Hirsch, Viernes, and Kory published a controlled in-vitro and in-vivo study of the expectorant effect of glyceryl guaiacolate (guaifenesin) in patients with chronic bronchitis, one of the early clinical efforts to record a measurable mucociliary/sputum effect for the compound. This moved the "guaifenesin is an expectorant" proposition out of unstructured clinical lore and into the peer-reviewed literature, establishing the primary evidentiary basis later invoked for the ingredient\'s OTC labeling. The study reported changes in sputum properties consistent with an expectorant action.',
    source: {
      externalId: 'src:hirsch-1973-guaifenesin-expectorant-chest',
      name: 'Hirsch SR, Viernes PF, Kory RC. The expectorant effect of glyceryl guaiacolate in patients with chronic bronchitis: a controlled in vitro and in vivo study. Chest. 1973;63(1):9-14.',
      url: 'https://doi.org/10.1378/chest.63.1.9',
      publishedAt: '1973-01-01',
      methodologyType: 'primary',
    },
  },

  // 2) RECORDED -> SETTLED : FDA OTC monograph recognizes guaifenesin as the sole GRASE expectorant
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-08-23',
    datePrecision: 'DAY',
    reason:
      'FDA published the final over-the-counter monograph for cold, cough, allergy, bronchodilator, and antiasthmatic drug products, codified at 21 CFR Part 341, in which guaifenesin (21 CFR 341.78) is the only active ingredient recognized as generally recognized as safe and effective (GRASE) for the "expectorant" purpose. This institutional recognition is precisely what lets a product such as Mucinex market guaifenesin under a bare "Purpose: Expectorant" label without a product-specific new drug application, settling guaifenesin as the federal standard-of-care OTC expectorant. No other single ingredient shares that monograph status.',
    source: {
      externalId: 'src:fda-otc-monograph-341-expectorant-guaifenesin',
      name: 'FDA OTC Monograph — Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic Drug Products for Over-the-Counter Human Use (21 CFR Part 341; guaifenesin expectorant at 21 CFR 341.78)',
      url: 'https://www.ecfr.gov/current/title-21/part-341',
      publishedAt: '1994-08-23',
      methodologyType: 'primary',
    },
  },

  // 3) SETTLED -> CONTESTED : Cochrane systematic review finds no good evidence for OTC expectorants
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2014-11-24',
    datePrecision: 'DAY',
    reason:
      'The updated Cochrane systematic review of over-the-counter medications for acute cough (Smith, Schroeder, Fahey) concluded there is no good evidence for or against the effectiveness of OTC cough medicines, with the two guaifenesin expectorant trials it identified giving conflicting results. This contested the efficacy basis of guaifenesin\'s monograph "expectorant" purpose from within the expert literature, even as the ingredient\'s safety remained uncontested and it stayed on the market. The challenge is to whether guaifenesin demonstrably works, not to whether it is safe — no black-box warning, safety communication, or withdrawal has been issued.',
    source: {
      externalId: 'src:cochrane-cd001831-otc-cough-2014',
      name: 'Smith SM, Schroeder K, Fahey T. Over-the-counter (OTC) medications for acute cough in children and adults in community settings. Cochrane Database Syst Rev. 2014;(11):CD001831.',
      url: 'https://doi.org/10.1002/14651858.CD001831.pub5',
      publishedAt: '2014-11-24',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} guaifenesin-expectorant-arc transitions...`)

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
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const id = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id },
      create: {
        id,
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${id})`)
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
