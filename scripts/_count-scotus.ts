import { PrismaClient } from '@prisma/client'

async function main() {
  const p = new PrismaClient()
  const total = await p.claim.count({ where: { ingestedBy: 'courtlistener_scotus_v1', deleted: false } })
  const post2000 = await p.claim.count({
    where: {
      ingestedBy: 'courtlistener_scotus_v1',
      deleted: false,
      claimEmergedAt: { gte: new Date('2000-01-01T00:00:00Z') },
    },
  })
  console.log(JSON.stringify({ totalScotus: total, post2000 }))
  await p.$disconnect()
}
main()
