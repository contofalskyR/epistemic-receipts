import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const votes = await p.legislativeVote.findMany({
    where: { yesCount: { not: null }, noCount: { not: null } },
    include: { source: { select: { externalId: true, url: true, name: true, ingestedBy: true } } },
  })

  const scored = votes.map(v => {
    const yes = v.yesCount ?? 0
    const no = v.noCount ?? 0
    const total = yes + no
    const contested = total > 0 ? (no / total) : 0
    return { ...v, contested, total }
  }).filter(v => v.total > 10)
   .sort((a, b) => b.contested - a.contested)

  console.log('\n=== TOP CONTESTED BILLS ===')
  for (const v of scored.slice(0, 20)) {
    const pct = Math.round(v.contested * 100)
    console.log(`${pct}% NAY | ${v.yesCount}-${v.noCount} | ${v.chamber} | ${v.source?.ingestedBy} | ${v.source?.name ?? v.source?.externalId}`)
  }

  console.log('\n=== MOST UNANIMOUS ===')
  const unanimous = [...scored].sort((a, b) => a.contested - b.contested).slice(0, 10)
  for (const v of unanimous) {
    const pct = Math.round(v.contested * 100)
    console.log(`${pct}% NAY | ${v.yesCount}-${v.noCount} | ${v.source?.ingestedBy} | ${v.source?.name ?? v.source?.externalId}`)
  }

  console.log('\n=== BY COUNTRY (avg contestedness) ===')
  const byCountry: Record<string, number[]> = {}
  for (const v of scored) {
    const tag = v.source?.ingestedBy ?? 'unknown'
    byCountry[tag] = byCountry[tag] ?? []
    byCountry[tag].push(v.contested)
  }
  for (const [tag, vals] of Object.entries(byCountry)) {
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    console.log(`${tag}: ${vals.length} bills, avg ${Math.round(avg * 100)}% NAY`)
  }

  console.log('\nTotal LV rows:', votes.length)
}

main().catch(console.error).finally(() => p.$disconnect())
