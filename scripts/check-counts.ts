import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const tags = process.argv.slice(2)
  if (tags.length === 0) {
    console.error('Usage: tsx check-counts.ts <tag1> [tag2] ...')
    process.exit(1)
  }
  for (const t of tags) {
    const c = await prisma.claim.count({ where: { ingestedBy: t, deleted: false } })
    console.log(`${t}: ${c}`)
  }
  await prisma.$disconnect()
}
main()
