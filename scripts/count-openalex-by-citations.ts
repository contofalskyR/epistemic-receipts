import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const THRESHOLDS = [100_000, 50_000, 25_000, 10_000, 5_000, 2_500, 1_000, 500, 0]

async function main() {
  const candidates = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: 'openalex_v1', statusHistory: { some: {} } },
    select: { metadata: true, statusHistory: { select: { id: true } } },
  })
  const singleStep = candidates.filter(c => c.statusHistory.length === 1)
  const counts = singleStep.map(c => {
    const m = c.metadata as Record<string, unknown> | null
    return typeof m?.cited_by_count === 'number' ? m.cited_by_count : 0
  })
  const total = counts.length
  console.log(`\nTotal promotable: ${total.toLocaleString()}\n`)
  for (const t of THRESHOLDS) {
    const n = counts.filter(x => x >= t).length
    console.log(`  ≥${String(t).padEnd(7)} → ${String(n).padStart(8)}  (${((n/total)*100).toFixed(1)}%)`)
  }
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
