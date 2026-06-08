// Report pipelines (ingestedBy values) with NULL epistemicAxis claim counts.
// Read-only.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.claim.groupBy({
    by: ['ingestedBy'],
    where: { epistemicAxis: null },
    _count: { _all: true },
    orderBy: { _count: { ingestedBy: 'desc' } },
  })

  const total = rows.reduce((s, r) => s + r._count._all, 0)
  console.log(`Total claims with NULL epistemicAxis: ${total}`)
  console.log(`Distinct ingestedBy values: ${rows.length}\n`)

  console.log('ingestedBy\tnull_count')
  for (const r of rows) {
    console.log(`${r.ingestedBy ?? '<null>'}\t${r._count._all}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
