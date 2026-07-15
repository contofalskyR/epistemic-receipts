// Epistemic-receipt enrichment for claim cmq2w40m8000xsa8hzfqjzj5f
// Kirkpatrick, Gelatt Jr. & Vecchi, "Optimization by Simulated Annealing",
// Science 220(4598):671–680, 13 May 1983. DOI 10.1126/science.220.4598.671.
//
// Baseline row (fromAxis=null -> RECORDED at 1983-05-13) already exists; do NOT
// duplicate it. This script adds the single post-publication adjudication event:
// the mathematical settling of the paper's central claim — that the
// statistical-mechanics ⇄ combinatorial-optimization analogy is a *provably
// valid* optimization framework, not merely a heuristic. Bruce Hajek's 1988
// convergence theorem (building on Geman & Geman 1984) gave the necessary and
// sufficient cooling-schedule condition under which simulated annealing
// converges in probability to the global optimum, vindicating the finding in
// the expert literature.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kirkpatrick-1983-simulated-annealing.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kirkpatrick-1983-simulated-annealing.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w40m8000xsa8hzfqjzj5f'

async function main() {
  // ── Transition: RECORDED -> SETTLED (Hajek 1988 convergence adjudication) ──
  const toAxis = 'SETTLED'
  const occurredAt = new Date('1988-05-01') // Math. Oper. Res. vol. 13 no. 2, May 1988
  const slug = `${CLAIM_ID}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`

  const sourceDef = {
    externalId: 'src:hajek-1988-cooling-schedules-optimal-annealing',
    name: 'Hajek B. Cooling Schedules for Optimal Annealing. Mathematics of Operations Research 1988;13(2):311–329.',
    url: 'https://doi.org/10.1287/moor.13.2.311',
    publishedAt: new Date('1988-05-01'),
    methodologyType: 'primary',
  }

  const reason =
    'Bruce Hajek\'s "Cooling Schedules for Optimal Annealing" (Mathematics of Operations Research, 1988) proved the necessary and sufficient condition on the cooling schedule for simulated annealing to converge in probability to the set of globally minimum-cost states: for a logarithmic schedule T(t)=c/log(1+t), convergence holds iff c is at least the depth of the deepest non-global local minimum. Building on Geman & Geman\'s 1984 convergence proof, this result mathematically settled that Kirkpatrick, Gelatt & Vecchi\'s statistical-mechanics-to-optimization analogy is a provably valid optimization framework rather than a mere heuristic, vindicating the 1983 paper\'s central claim within the expert literature.'

  if (DRY_RUN) {
    console.log('[dry-run] would upsert Source:', sourceDef.externalId)
    console.log('[dry-run] would upsert ClaimStatusHistory:', slug)
    console.log('[dry-run]   fromAxis=RECORDED toAxis=SETTLED community=EXPERT_LITERATURE occurredAt=1988-05 precision=MONTH')
    await prisma.$disconnect()
    return
  }

  // Source first, so the status row can reference it as its marker artifact.
  const source = await prisma.source.upsert({
    where: { externalId: sourceDef.externalId },
    create: {
      externalId: sourceDef.externalId,
      name: sourceDef.name,
      url: sourceDef.url,
      publishedAt: sourceDef.publishedAt,
      methodologyType: sourceDef.methodologyType,
      ingestedBy: 'enrich-corpus-openalex_v1',
    },
    update: {
      name: sourceDef.name,
      url: sourceDef.url,
      publishedAt: sourceDef.publishedAt,
      methodologyType: sourceDef.methodologyType,
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis, // 'SETTLED'
      community: 'EXPERT_LITERATURE',
      reason,
      occurredAt,
      datePrecision: 'MONTH',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis,
      community: 'EXPERT_LITERATURE',
      reason,
      occurredAt,
      datePrecision: 'MONTH',
      sourceId: source.id,
    },
  })

  console.log(`Upserted transition ${slug} (RECORDED -> SETTLED) with source ${source.id}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
