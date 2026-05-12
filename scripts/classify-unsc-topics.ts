// Classify UNSC resolutions into peacekeeping / sanctions sub-topics
// based on metadata.subjects populated during Pipeline 7 ingestion.
// Idempotent: skips ClaimTopic rows that already exist.
// Run: npx tsx scripts/classify-unsc-topics.ts --dry-run
//      npx tsx scripts/classify-unsc-topics.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PK_KEYWORDS  = ['PEACEKEEPING', 'PEACE OPERATION', 'PEACE-KEEPING', 'PEACE FORCE']
const SAN_KEYWORDS = ['SANCTION', 'EMBARGO', 'ASSET FREEZE', 'TRAVEL BAN', 'ARMS EMBARGO']

const TOPIC_IDS = {
  peacekeeping: 'cmp2yedza0005xncz1mjatp44',
  sanctions:    'cmp2yee0h0007xnczk5gnkk4w',
}

function matchesAny(subjects: string[], keywords: string[]): boolean {
  const joined = subjects.join('|').toUpperCase()
  return keywords.some(k => joined.includes(k))
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const mode   = dryRun ? 'DRY RUN' : 'FULL'
  console.log(`classify-unsc-topics [${mode}]`)

  const claims = await prisma.claim.findMany({
    where: { ingestedBy: 'un_sc_resolutions_v1', deleted: false },
    select: { id: true, metadata: true },
  })

  console.log(`Loaded ${claims.length} UNSC claims`)

  // Existing ClaimTopic rows — skip on conflict
  const existing = await prisma.claimTopic.findMany({
    where: {
      topicId: { in: Object.values(TOPIC_IDS) },
      claim: { ingestedBy: 'un_sc_resolutions_v1' },
    },
    select: { claimId: true, topicId: true },
  })
  const existingSet = new Set(existing.map(r => `${r.claimId}:${r.topicId}`))
  console.log(`Already tagged: ${existingSet.size} rows`)

  const toCreate: { claimId: string; topicId: string }[] = []

  for (const claim of claims) {
    const subjects = ((claim.metadata as Record<string, unknown>)?.subjects as string[]) ?? []

    if (matchesAny(subjects, PK_KEYWORDS)) {
      const key = `${claim.id}:${TOPIC_IDS.peacekeeping}`
      if (!existingSet.has(key)) toCreate.push({ claimId: claim.id, topicId: TOPIC_IDS.peacekeeping })
    }

    if (matchesAny(subjects, SAN_KEYWORDS)) {
      const key = `${claim.id}:${TOPIC_IDS.sanctions}`
      if (!existingSet.has(key)) toCreate.push({ claimId: claim.id, topicId: TOPIC_IDS.sanctions })
    }
  }

  const pkCount  = toCreate.filter(r => r.topicId === TOPIC_IDS.peacekeeping).length
  const sanCount = toCreate.filter(r => r.topicId === TOPIC_IDS.sanctions).length
  console.log(`To tag — peacekeeping: ${pkCount}  sanctions: ${sanCount}  total: ${toCreate.length}`)

  if (dryRun) {
    console.log('Dry run — no writes.')
    await prisma.$disconnect()
    return
  }

  // Write in batches of 500
  const BATCH = 500
  let written = 0
  for (let i = 0; i < toCreate.length; i += BATCH) {
    const batch = toCreate.slice(i, i + BATCH)
    await prisma.claimTopic.createMany({ data: batch, skipDuplicates: true })
    written += batch.length
    process.stdout.write(`\r  written ${written}/${toCreate.length}`)
  }
  console.log('\nDone.')

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
