// Epistemic receipt enrichment: W. Brian Arthur (1989),
// "Competing Technologies, Increasing Returns, and Lock-In by Historical Events,"
// The Economic Journal 99(394): 116-131. DOI 10.2307/2234208. OpenAlex W2129261459.
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 1989-03) already exists.
// This script adds the post-publication arc:
//   RECORDED -> CONTESTED (1995-04) — Liebowitz & Margolis directly dispute the
//   strong path-dependence/lock-in thesis, arguing that demonstrable, uncorrectable
//   inefficient lock-in ("third-degree path dependence") is essentially unestablished
//   and that market processes tend to correct it. This is a specific, dated,
//   citable methodological critique of Arthur's central claim.
//
// No retraction, failed replication, or settling meta-analysis exists; the
// path-dependence debate remains genuinely open, so the claim rests at CONTESTED.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-arthur-competing-technologies-lockin-1989.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-arthur-competing-technologies-lockin-1989.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplzrsii01dpsa862hctnive'

async function main() {
  if (DRY_RUN) {
    console.log('[dry-run] would upsert 1 source and 1 claimStatusHistory transition for', CLAIM_ID)
    return
  }

  // ── Source: Liebowitz & Margolis (1995), "Path Dependence, Lock-In, and History" ──
  await prisma.source.upsert({
    where: { externalId: 'src:liebowitz-margolis-path-dependence-1995' },
    create: {
      externalId: 'src:liebowitz-margolis-path-dependence-1995',
      name: 'Liebowitz & Margolis (1995), "Path Dependence, Lock-In, and History," Journal of Law, Economics, & Organization 11(1): 205-226',
      url: 'https://doi.org/10.1093/oxfordjournals.jleo.a036867',
      publishedAt: new Date('1995-04-01'),
      methodologyType: 'opinion',
    },
    update: {
      name: 'Liebowitz & Margolis (1995), "Path Dependence, Lock-In, and History," Journal of Law, Economics, & Organization 11(1): 205-226',
      url: 'https://doi.org/10.1093/oxfordjournals.jleo.a036867',
      publishedAt: new Date('1995-04-01'),
      methodologyType: 'opinion',
    },
  })

  // ── Transition: RECORDED -> CONTESTED (1995-04) ──
  const occurredAt = new Date('1995-04-01')
  const slug = `${CLAIM_ID}-CONTESTED-${occurredAt.toISOString().slice(0, 10)}`

  const contested = {
    claimId: CLAIM_ID,
    fromAxis: 'RECORDED' as const,
    toAxis: 'CONTESTED' as const,
    community: 'EXPERT_LITERATURE' as const,
    occurredAt,
    datePrecision: 'MONTH' as const,
    reason:
      'Liebowitz and Margolis directly contested Arthur\'s central claim that economies can lock into inefficient technological paths that are hard to escape via markets or policy. Distinguishing "third-degree" (remediable-but-uncorrected, i.e., inefficient) path dependence, they argued it is essentially undemonstrated and that competitive market processes tend to correct inefficient lock-in, making the strong lock-in thesis a live methodological dispute rather than settled economics.',
    sourceExternalId: 'src:liebowitz-margolis-path-dependence-1995',
  }

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: { id: slug, ...contested },
    update: contested,
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
