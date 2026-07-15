// Enrichment: post-publication epistemic trajectory for the PRISMA 2009 statement.
//
// Claim: cmpmc56df562rsafwrz2c48as
//   Moher D, Liberati A, Tetzlaff J, Altman DG (PRISMA Group).
//   "Preferred reporting items for systematic reviews and meta-analyses:
//    the PRISMA statement." BMJ 2009;339:b2535.  (DOI 10.1136/bmj.b2535)
//   OpenAlex W2156098321. Published 2009-07-21.
//
// Baseline row (fromAxis=null -> RECORDED at 2009-07-21) already exists; do NOT duplicate it.
//
// Post-publication event added here:
//   RECORDED -> ABANDONED (2021-03-29, EXPERT_LITERATURE)
//   The PRISMA authoring group published the PRISMA 2020 statement
//   (BMJ 2021;372:n71, 29 March 2021), which explicitly "replaces the 2009
//   statement" and states the PRISMA 2009 statement "should no longer be used."
//   The 2009 checklist/flow-diagram artifact described by this claim was formally
//   superseded and retired — not overturned as erroneous, but retired in favour of
//   the updated 27-item PRISMA 2020 guideline. That retirement is ABANDONED, not
//   REVERSED (the reporting approach was carried forward, not shown wrong).
//
// Verified sources:
//   - PRISMA 2020 statement (adjudicating document): https://doi.org/10.1136/bmj.n71  (HTTP 200)
//   - PRISMA official history page (corroboration):   https://www.prisma-statement.org/history-and-development  (HTTP 200)
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-prisma-2009-statement.ts
// Idempotent: upserts on source.externalId and claimStatusHistory.id.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpmc56df562rsafwrz2c48as'

async function main() {
  // ── RECORDED -> ABANDONED: PRISMA 2020 supersedes and retires PRISMA 2009 ──
  const occurredAt = '2021-03-29'

  const source = await prisma.source.upsert({
    where: { externalId: 'src:prisma-2020-supersedes-2009' },
    create: {
      externalId: 'src:prisma-2020-supersedes-2009',
      name: 'Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. BMJ 2021;372:n71. doi:10.1136/bmj.n71 — "The PRISMA 2020 statement replaces the 2009 statement … which should no longer be used."',
      url: 'https://doi.org/10.1136/bmj.n71',
      publishedAt: new Date('2021-03-29'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:corpus-openalex_v1',
    },
    update: {
      name: 'Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. BMJ 2021;372:n71. doi:10.1136/bmj.n71 — "The PRISMA 2020 statement replaces the 2009 statement … which should no longer be used."',
      url: 'https://doi.org/10.1136/bmj.n71',
      publishedAt: new Date('2021-03-29'),
    },
  })

  const histId = `${CLAIM_ID}-ABANDONED-${occurredAt}` // cmpmc56df562rsafwrz2c48as-ABANDONED-2021-03-29
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'ABANDONED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date(occurredAt),
      datePrecision: 'DAY',
      reason:
        'On 29 March 2021 the PRISMA authoring group published the PRISMA 2020 statement (BMJ 2021;372:n71), which explicitly "replaces the 2009 statement" and directs that the PRISMA 2009 statement "should no longer be used." The 2009 reporting checklist and flow diagram described by this claim were formally superseded and retired in favour of the updated 27-item PRISMA 2020 guideline — a retirement driven by a decade of methodological advances, not a finding that the original approach was wrong.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'ABANDONED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date(occurredAt),
      datePrecision: 'DAY',
      reason:
        'On 29 March 2021 the PRISMA authoring group published the PRISMA 2020 statement (BMJ 2021;372:n71), which explicitly "replaces the 2009 statement" and directs that the PRISMA 2009 statement "should no longer be used." The 2009 reporting checklist and flow diagram described by this claim were formally superseded and retired in favour of the updated 27-item PRISMA 2020 guideline — a retirement driven by a decade of methodological advances, not a finding that the original approach was wrong.',
      sourceId: source.id,
    },
  })

  console.log(`  ✓ ${CLAIM_ID}: RECORDED -> ABANDONED (${occurredAt})`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
