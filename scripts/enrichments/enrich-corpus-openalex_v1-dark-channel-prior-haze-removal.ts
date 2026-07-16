// Enrichment: post-publication epistemic trajectory for He, Sun & Tang (2010/2011),
// "Single Image Haze Removal Using Dark Channel Prior,"
// IEEE Transactions on Pattern Analysis and Machine Intelligence 33(12):2341–2353,
// DOI 10.1109/tpami.2010.168. OpenAlex W2128254161.
// Claim id: cmq2w58yy00rlsa8hqb76zygu.
//
// Baseline row (fromAxis=null -> RECORDED at 2010-09-15) already exists; NOT duplicated here.
//
// Added arc:
//   RECORDED -> SETTLED (2019-01): The RESIDE benchmark (Li, Ren, Fu, Tao, Feng,
//   Zeng & Wang, "Benchmarking Single-Image Dehazing and Beyond," IEEE Trans. Image
//   Processing 28(1):492–505, 2019) — the field's principal large-scale systematic
//   benchmark for single-image dehazing — adopts the dark channel prior (DCP) as the
//   canonical prior-based reference method against which all subsequent (including
//   learning-based) methods are evaluated. A dated, heavily-cited (2,000+) systematic
//   evaluation in expert literature that establishes DCP as an accepted, standard
//   dehazing technique. The method is neither retracted nor overturned; its status as
//   a valid, foundational single-image dehazing prior is settled.
//
// No retraction, expression of concern, or dated failed replication was found for this
// paper (Retraction Watch / publisher / OpenAlex all clean; isRetracted=false).
//
// Idempotent: upserts on externalId / id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-dark-channel-prior-haze-removal.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-dark-channel-prior-haze-removal.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w58yy00rlsa8hqb76zygu'

async function main() {
  // ── RECORDED -> SETTLED : RESIDE benchmark adopts DCP as canonical baseline (2019) ──
  const sourceExternalId = 'src:reside-benchmark-dehazing-2019'
  const sourceData = {
    name: 'Li B, Ren W, Fu D, Tao D, Feng D, Zeng W, Wang Z. Benchmarking Single-Image Dehazing and Beyond. IEEE Transactions on Image Processing 2019;28(1):492–505.',
    url: 'https://doi.org/10.1109/TIP.2018.2867951',
    publishedAt: new Date('2019-01-01'),
    methodologyType: 'derivative',
  }

  const occurredAt = new Date('2019-01-01')
  const historyId = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  const historyData = {
    claimId: CLAIM_ID,
    fromAxis: 'RECORDED' as const,
    toAxis: 'SETTLED' as const,
    community: 'EXPERT_LITERATURE' as const,
    occurredAt,
    datePrecision: 'MONTH' as const,
    reason:
      'The RESIDE benchmark — the field\'s principal large-scale systematic evaluation of single-image dehazing — adopts the dark channel prior (DCP) as the canonical prior-based reference method against which subsequent hand-crafted and learning-based methods are compared. This heavily-cited (2,000+) dated benchmark establishes DCP as an accepted, standard, foundational dehazing technique in expert literature. The method is neither retracted nor overturned; its validity as a working single-image dehazing prior is settled.',
  }

  if (DRY_RUN) {
    console.log('[dry-run] would upsert source:', sourceExternalId)
    console.log('[dry-run] would upsert claimStatusHistory:', historyId)
    console.log(JSON.stringify({ source: sourceData, history: historyData }, null, 2))
    await prisma.$disconnect()
    return
  }

  await prisma.source.upsert({
    where: { externalId: sourceExternalId },
    create: { externalId: sourceExternalId, ...sourceData },
    update: sourceData,
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: historyId },
    create: { id: historyId, ...historyData },
    update: historyData,
  })

  console.log('Upserted source + claimStatusHistory:', historyId)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
