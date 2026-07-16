// Epistemic receipt enrichment: IPCC (2012), Special Report on
// "Managing the Risks of Extreme Events and Disasters to Advance Climate Change
// Adaptation" (IPCC-SREX). Cambridge University Press. DOI 10.1017/CBO9781139177245.
// OpenAlex W2120012334.
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 2012-05-28) already exists.
// This script adds the post-publication arc:
//   RECORDED -> SETTLED (2022-02-28) — SREX advanced the framing that disaster risk
//   emerges from the interaction of physical hazard changes with exposure and
//   vulnerability. IPCC AR6 Working Group II, "Climate Change 2022: Impacts,
//   Adaptation and Vulnerability" (released 2022-02-28, SPM approved 2022-02-27),
//   adopted this risk concept as the central organizing framework of the flagship
//   assessment, moving the framing from a special-report proposal to expert-community
//   consensus. Community: EXPERT_LITERATURE.
//
// No retraction, expression of concern, or failed replication exists; the risk
// framing was reaffirmed and extended rather than contested, so the arc is a direct
// RECORDED -> SETTLED with no intervening CONTESTED step.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ipcc-srex-extreme-events-2012.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ipcc-srex-extreme-events-2012.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w4xcm00klsa8hgaxrv7u2'

async function main() {
  if (DRY_RUN) {
    console.log('[dry-run] would upsert 1 source and 1 claimStatusHistory transition for', CLAIM_ID)
    return
  }

  // ── Source: IPCC AR6 Working Group II (2022) ──
  await prisma.source.upsert({
    where: { externalId: 'src:ipcc-ar6-wg2-2022' },
    create: {
      externalId: 'src:ipcc-ar6-wg2-2022',
      name: 'IPCC (2022), "Climate Change 2022: Impacts, Adaptation and Vulnerability," Contribution of Working Group II to the Sixth Assessment Report, Cambridge University Press',
      url: 'https://www.ipcc.ch/report/ar6/wg2/',
      publishedAt: new Date('2022-02-28'),
      methodologyType: 'review',
    },
    update: {
      name: 'IPCC (2022), "Climate Change 2022: Impacts, Adaptation and Vulnerability," Contribution of Working Group II to the Sixth Assessment Report, Cambridge University Press',
      url: 'https://www.ipcc.ch/report/ar6/wg2/',
      publishedAt: new Date('2022-02-28'),
      methodologyType: 'review',
    },
  })

  // ── Transition: RECORDED -> SETTLED (2022-02-28) ──
  const occurredAt = new Date('2022-02-28')
  const slug = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  const settled = {
    claimId: CLAIM_ID,
    fromAxis: 'RECORDED' as const,
    toAxis: 'SETTLED' as const,
    community: 'EXPERT_LITERATURE' as const,
    occurredAt,
    datePrecision: 'DAY' as const,
    reason:
      'SREX advanced the framing that disaster risk is driven not only by changes in the frequency and severity of physical extremes but also by the spatially diverse and temporally dynamic patterns of exposure and vulnerability. IPCC AR6 Working Group II (2022) adopted this hazard-exposure-vulnerability risk concept as the central organizing framework of the flagship assessment, elevating the SREX proposal to expert-community consensus. The framing was reaffirmed and extended rather than contested.',
    sourceExternalId: 'src:ipcc-ar6-wg2-2022',
  }

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: { id: slug, ...settled },
    update: settled,
  })

  console.log('Upserted transition:', slug)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
