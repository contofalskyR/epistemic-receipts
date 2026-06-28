import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const ids = [
    'trajectory:meissner-ochsenfeld-effect-1933',
    'trajectory:berger-human-eeg-1929',
    'trajectory:baade-stellar-populations-1944',
    'trajectory:theiler-17d-yellow-fever-vaccine-1937',
  ]
  const rows = await p.claim.findMany({ where: { externalId: { in: ids } }, select: { externalId: true, _count: { select: { statusHistory: true } } } })
  for (const id of ids) {
    const r = rows.find(x => x.externalId === id)
    console.log(r ? `OK  ${id} (${r._count.transitions} transitions)` : `MISSING ${id}`)
  }
  await p.$disconnect()
}
main()
