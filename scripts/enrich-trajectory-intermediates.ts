// Enrich existing settling curves with a documented, missing intermediate
// CONTESTED phase.
//
// Each of these four curated trajectories was seeded as a clean two-step arc
// (SETTLED → REVERSED) that elides a well-documented intermediate period in
// which the prior consensus was openly contested before it was finally
// reversed. Each intermediate transition below traces to a single, canonical
// primary source verified against its publisher/court-reporter URL (per
// AGENTS.md: "the curated list itself becomes the verification surface").
//
// The script also repairs chain consistency: the downstream REVERSED
// transition's fromAxis is moved from SETTLED to CONTESTED so the arc reads
// SETTLED → CONTESTED → REVERSED rather than leaving two transitions both
// claiming a SETTLED origin.
//
// Idempotent: upserts the Source by externalId and the new ClaimStatusHistory
// row by a deterministic id; the downstream fromAxis update is a no-op on
// reruns.
//
// Run:     npx tsx scripts/enrich-trajectory-intermediates.ts
// Dry-run: npx tsx scripts/enrich-trajectory-intermediates.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

type FactStatus = 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'

interface Enrichment {
  claimId: string
  slug: string
  // the new intermediate transition
  fromAxis: FactStatus
  toAxis: FactStatus
  occurredAt: string
  community: RatifyingCommunity
  reason: string
  source: { externalId: string; name: string; url: string; publishedAt: string }
}

const ENRICHMENTS: Enrichment[] = [
  // ── Peptic ulcer: stress/acid consensus contested by H. pylori hypothesis ──
  {
    claimId: 'cmq7e9wfj0008sa8hnol1bkx7',
    slug: 'stress-acid-ulcers',
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    occurredAt: '1984-06-16',
    community: 'EXPERT_LITERATURE',
    reason:
      'Barry Marshall and Robin Warren publish "Unidentified curved bacilli in the stomach of patients with gastritis and peptic ulceration" in The Lancet, proposing that a bacterium (later Helicobacter pylori), not stress and acid, underlies peptic ulcer disease. The bacterial hypothesis is widely doubted and the stress/acid model openly contested for the next decade until the 1994 NIH consensus.',
    source: {
      externalId: 'src:marshall-warren-lancet-1984',
      name: 'Marshall BJ, Warren JR. Unidentified curved bacilli in the stomach of patients with gastritis and peptic ulceration. Lancet 1984;323(8390):1311–1315.',
      url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(84)91816-6/fulltext',
      publishedAt: '1984-06-16',
    },
  },

  // ── Plessy → Brown: "separate but equal" contested by Sweatt v. Painter ──
  {
    claimId: 'cmq7jlox70000sa7ebs5sx088',
    slug: 'plessy-brown',
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    occurredAt: '1950-06-05',
    community: 'JUDICIAL',
    reason:
      'Sweatt v. Painter (decided the same day as McLaurin v. Oklahoma) holds that a separate state law school for Black students is inherently unequal, ordering Heman Sweatt admitted to the University of Texas. The decision begins the Supreme Court\'s judicial erosion of the Plessy "separate but equal" doctrine that underpins school segregation, four years before Brown overturns it outright.',
    source: {
      externalId: 'src:sweatt-v-painter-1950',
      name: 'Sweatt v. Painter, 339 U.S. 629 (1950).',
      url: 'https://supreme.justia.com/cases/federal/us/339/629/',
      publishedAt: '1950-06-05',
    },
  },

  // ── Roe → Dobbs: abortion right reaffirmed-but-contested by Casey ──
  {
    claimId: 'cmq7jlpgl000esa7e26m6huqj',
    slug: 'roe-dobbs',
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    occurredAt: '1992-06-29',
    community: 'JUDICIAL',
    reason:
      'Planned Parenthood v. Casey reaffirms the central holding of Roe but discards its trimester framework and replaces strict scrutiny with the more permissive "undue burden" standard. The fractured plurality, decided over a vigorous four-Justice call to overrule Roe entirely, marks the constitutional abortion right as openly contested rather than settled — a status it holds until Dobbs reverses it in 2022.',
    source: {
      externalId: 'src:planned-parenthood-v-casey-1992',
      name: 'Planned Parenthood of Southeastern Pa. v. Casey, 505 U.S. 833 (1992).',
      url: 'https://supreme.justia.com/cases/federal/us/505/833/',
      publishedAt: '1992-06-29',
    },
  },

  // ── Bowers → Lawrence: sodomy-law validity contested by Romer v. Evans ──
  {
    claimId: 'cmq7jlp5o0006sa7eelhfxzt3',
    slug: 'bowers-lawrence',
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    occurredAt: '1996-05-20',
    community: 'JUDICIAL',
    reason:
      'Romer v. Evans strikes down Colorado\'s Amendment 2 on equal-protection grounds, the Court\'s first ruling that a law targeting gay people lacks a legitimate state interest. Read against Bowers v. Hardwick — as Justice Scalia\'s dissent expressly notes — Romer destabilizes the constitutional footing for criminalizing same-sex conduct, contesting Bowers seven years before Lawrence overrules it.',
    source: {
      externalId: 'src:romer-v-evans-1996',
      name: 'Romer v. Evans, 517 U.S. 620 (1996).',
      url: 'https://supreme.justia.com/cases/federal/us/517/620/',
      publishedAt: '1996-05-20',
    },
  },
]

async function main() {
  let enriched = 0
  const details: string[] = []

  for (const e of ENRICHMENTS) {
    const claim = await prisma.claim.findUnique({ where: { id: e.claimId } })
    if (!claim) {
      console.warn(`SKIP ${e.slug}: claim ${e.claimId} not found`)
      continue
    }

    const history = await prisma.claimStatusHistory.findMany({
      where: { claimId: e.claimId },
      orderBy: { occurredAt: 'asc' },
    })

    // The downstream transition is the one whose origin we are reinterpreting:
    // it currently leaves `fromAxis` (SETTLED) and must now leave CONTESTED.
    const downstream = history.find(
      (h) => h.fromAxis === e.fromAxis && new Date(h.occurredAt) > new Date(e.occurredAt),
    )
    if (!downstream) {
      console.warn(`SKIP ${e.slug}: no downstream ${e.fromAxis} transition after ${e.occurredAt}`)
      continue
    }

    const cshId = `trajectory:${e.slug}:contested-${e.occurredAt.slice(0, 4)}`

    console.log(`\n${e.slug}`)
    console.log(`  + ${e.fromAxis}→${e.toAxis} @${e.occurredAt}  (${e.source.name})`)
    console.log(`  ~ downstream ${downstream.id}: fromAxis ${downstream.fromAxis}→${e.toAxis}`)

    if (DRY_RUN) {
      details.push(`${e.claimId}: added ${e.fromAxis}→${e.toAxis} transition (${e.slug})`)
      enriched++
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
          methodologyType: 'primary',
          ingestedBy: 'enrich:trajectory-intermediates',
          humanReviewed: false,
          autoApproved: true,
        },
      })

      await tx.claimStatusHistory.upsert({
        where: { id: cshId },
        update: {},
        create: {
          id: cshId,
          claimId: e.claimId,
          fromAxis: e.fromAxis,
          toAxis: e.toAxis,
          community: e.community,
          occurredAt: new Date(e.occurredAt),
          datePrecision: 'DAY',
          reason: e.reason,
          sourceId: source.id,
        },
      })

      // Repair chain consistency: downstream transition now leaves CONTESTED.
      if (downstream.fromAxis !== e.toAxis) {
        await tx.claimStatusHistory.update({
          where: { id: downstream.id },
          data: { fromAxis: e.toAxis },
        })
      }
    })

    details.push(`${e.claimId}: added ${e.fromAxis}→${e.toAxis} transition (${e.slug})`)
    enriched++
  }

  console.log(`\nENRICHED:${enriched}`)
  console.log(`DETAILS:${details.join(' | ')}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
