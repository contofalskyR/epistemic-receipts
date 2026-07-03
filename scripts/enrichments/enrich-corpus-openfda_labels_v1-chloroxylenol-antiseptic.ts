// Enrichment: epistemic arc for the OTC antiseptic active ingredient
// chloroxylenol (PCMX) behind "Satin Foam High Foaming Antiseptic Hand Wash".
//
// Claim: cmpiylimm92auplo7zgcjfjyc (openfda_labels_v1)
//   "Satin Foam High Foaming Antiseptic Hand Wash (CHLOROXYLENOL):
//    Drug Facts Box OTC-Purpose Section Antiseptic"
//
// The label claim rides on chloroxylenol's status as an OTC topical
// antiseptic active. That status has a real, dateable regulatory/clinical
// arc that maps onto the epistemic axes:
//   OPEN -> RECORDED  (2002): CDC hand-hygiene guideline records PCMX as an
//                             antiseptic agent with a characterized spectrum.
//   RECORDED -> SETTLED (2009): WHO hand-hygiene guidelines list PCMX among
//                             recognized antiseptic agents -> broad adoption.
//   SETTLED -> CONTESTED (2016): FDA consumer-antiseptic-wash final rule
//                             defers a GRASE determination on chloroxylenol,
//                             requesting further safety/effectiveness data.
//
// Does NOT create a Claim (claim already exists). Idempotent upserts.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-chloroxylenol-antiseptic.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiylimm92auplo7zgcjfjyc'

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
  // ── OPEN -> RECORDED: PCMX characterized as an antiseptic agent ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2002-10-25',
    datePrecision: 'DAY',
    reason:
      'The CDC "Guideline for Hand Hygiene in Health-Care Settings" (MMWR 2002;51/RR-16) reviewed chloroxylenol (para-chloro-meta-xylenol, PCMX) among the antiseptic active ingredients used in antimicrobial soaps, describing its mechanism, antimicrobial spectrum (good gram-positive, weaker gram-negative and mycobacterial activity), and residual effect. This recorded PCMX in the authoritative infection-control literature as a characterized topical antiseptic, the property the OTC Drug Facts "Antiseptic" purpose claim asserts.',
    source: {
      externalId: 'src:cdc-hand-hygiene-guideline-2002-pcmx',
      name: 'CDC. Guideline for Hand Hygiene in Health-Care Settings. MMWR 2002;51(RR-16).',
      url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5116a1.htm',
      publishedAt: '2002-10-25',
      methodologyType: 'derivative',
    },
  },

  // ── RECORDED -> SETTLED: WHO includes PCMX among recognized antiseptics ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2009-01-01',
    datePrecision: 'YEAR',
    reason:
      'The WHO "Guidelines on Hand Hygiene in Health Care" (2009) list chloroxylenol (PCMX) among the antiseptic agents used in hand-hygiene and antiseptic hand-wash products, cementing its place in global standard-of-care hand-hygiene practice. Inclusion in the definitive WHO reference reflected broad institutional adoption of PCMX as an accepted topical antiseptic active.',
    source: {
      externalId: 'src:who-hand-hygiene-guidelines-2009-pcmx',
      name: 'WHO Guidelines on Hand Hygiene in Health Care. Geneva: World Health Organization, 2009. ISBN 9789241597906.',
      url: 'https://www.who.int/publications/i/item/9789241597906',
      publishedAt: '2009-01-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: FDA defers a GRASE determination on chloroxylenol ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-09-02',
    datePrecision: 'DAY',
    reason:
      'FDA\'s final rule on consumer antiseptic wash products (announced 2 Sept 2016; 81 FR 61106) found 19 active ingredients including triclosan not generally recognized as safe and effective (GRASE), but explicitly deferred a final determination on chloroxylenol together with benzalkonium chloride and benzethonium chloride, giving manufacturers additional time to submit safety and effectiveness data. This left chloroxylenol\'s GRASE status for OTC antiseptic wash use formally unresolved rather than settled.',
    source: {
      externalId: 'src:fda-consumer-antiseptic-wash-final-rule-2016',
      name: 'FDA. FDA issues final rule on safety and effectiveness of antibacterial soaps (press announcement, 2 Sept 2016).',
      url: 'https://www.fda.gov/news-events/press-announcements/fda-issues-final-rule-safety-and-effectiveness-antibacterial-soaps',
      publishedAt: '2016-09-02',
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
        ingestedBy: 'enrich:openfda_labels_v1-chloroxylenol-antiseptic',
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`\nDone. ${TRANSITIONS.length} transitions upserted for ${CLAIM_ID}.`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
