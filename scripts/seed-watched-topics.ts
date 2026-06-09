// Seed initial WatchedTopic rows for the weekly topic-watch Telegram digest.
// Idempotent: upserts by unique `keyword`.
// Run: npx tsx scripts/seed-watched-topics.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TOPICS: Array<{ keyword: string; label: string }> = [
  { keyword: 'neuroscience', label: 'Neuroscience' },
  { keyword: 'climate change', label: 'Climate Change' },
  { keyword: 'COVID vaccine', label: 'COVID / Vaccines' },
  { keyword: 'STOCK Act', label: 'Congressional Trading' },
  { keyword: 'retraction', label: 'Retractions' },
  { keyword: 'SCOTUS', label: 'Supreme Court' },
  { keyword: 'drug approval', label: 'Drug Approvals' },
  { keyword: 'Ukraine', label: 'Ukraine' },
  { keyword: 'China', label: 'China Policy' },
  { keyword: 'artificial intelligence', label: 'AI / Machine Learning' },
]

async function main() {
  let created = 0
  let updated = 0

  for (const t of TOPICS) {
    const existing = await prisma.watchedTopic.findUnique({ where: { keyword: t.keyword } })
    if (existing) {
      if (existing.label !== t.label) {
        await prisma.watchedTopic.update({ where: { keyword: t.keyword }, data: { label: t.label } })
        updated++
      }
    } else {
      await prisma.watchedTopic.create({ data: { keyword: t.keyword, label: t.label } })
      created++
    }
  }

  const total = await prisma.watchedTopic.count()
  console.log(`Seeded WatchedTopic: ${created} created, ${updated} re-labeled. Total in DB: ${total}.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
