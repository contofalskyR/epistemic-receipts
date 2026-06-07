import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const topics = await p.topic.findMany({
    where: { slug: { startsWith: 'nara-rg-' } },
    select: { slug: true, name: true, id: true },
  })

  console.log('\nNARA topics in DB:')
  for (const t of topics) {
    const claims = await p.claim.count({
      where: {
        topics: { some: { topicId: t.id } },
        ingestedBy: 'nara_catalog_v1',
      },
    })
    console.log(`  ${t.slug}: ${claims} claims`)
  }

  const total = await p.source.count({ where: { ingestedBy: 'nara_catalog_v1' } })
  console.log(`\nTotal NARA sources in DB: ${total}`)
  await p.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
