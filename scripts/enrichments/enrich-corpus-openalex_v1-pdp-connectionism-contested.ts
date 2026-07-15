// Enrichment: post-publication epistemic trajectory for the 1986 PDP volumes
// (Rumelhart, McClelland & the PDP Research Group, "Parallel Distributed Processing").
//
// Claim: cmplxl1ue007vsa7fjs3mob5l  (OpenAlex W4300402905, DOI 10.7551/mitpress/5236.001.0001)
// Baseline RECORDED row (fromAxis=null -> RECORDED @ 1986) already exists — NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (1988-03) — Fodor & Pylyshyn, "Connectionism and cognitive
//   architecture: A critical analysis," Cognition 28(1-2). The canonical theoretical
//   challenge to the connectionist theory of cognition (the systematicity argument),
//   which opened a debate in philosophy of mind that remains unresolved. No SETTLED
//   transition is added: the systematicity contest is still live.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-pdp-connectionism-contested.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxl1ue007vsa7fjs3mob5l'

async function main() {
  // ── RECORDED -> CONTESTED : Fodor & Pylyshyn 1988 critique ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:fodor-pylyshyn-connectionism-1988' },
    create: {
      externalId: 'src:fodor-pylyshyn-connectionism-1988',
      name: 'Fodor & Pylyshyn (1988), "Connectionism and cognitive architecture: A critical analysis," Cognition 28(1-2):3-71',
      url: 'https://doi.org/10.1016/0010-0277(88)90031-5',
      publishedAt: new Date('1988-03-01'),
      methodologyType: 'opinion',
    },
    update: {
      name: 'Fodor & Pylyshyn (1988), "Connectionism and cognitive architecture: A critical analysis," Cognition 28(1-2):3-71',
      url: 'https://doi.org/10.1016/0010-0277(88)90031-5',
      publishedAt: new Date('1988-03-01'),
      methodologyType: 'opinion',
    },
  })

  const occurredAt = new Date('1988-03-01')
  const histId = `${CLAIM_ID}-CONTESTED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      reason:
        'Jerry Fodor and Zenon Pylyshyn published the foundational theoretical critique of the PDP volumes\' connectionist theory of cognition in Cognition (March 1988). Their systematicity argument contends that connectionist networks cannot explain the systematic, compositional structure of thought without merely implementing a classical symbolic architecture. The paper opened a debate in cognitive science and philosophy of mind that put the connectionist claim into sustained dispute rather than settling it.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      reason:
        'Jerry Fodor and Zenon Pylyshyn published the foundational theoretical critique of the PDP volumes\' connectionist theory of cognition in Cognition (March 1988). Their systematicity argument contends that connectionist networks cannot explain the systematic, compositional structure of thought without merely implementing a classical symbolic architecture. The paper opened a debate in cognitive science and philosophy of mind that put the connectionist claim into sustained dispute rather than settling it.',
      sourceId: source.id,
    },
  })

  console.log(`✓ enriched ${CLAIM_ID}: RECORDED -> CONTESTED (${histId})`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
