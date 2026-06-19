import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const ids = [
    'trajectory:liu-bei-shu-han-founding-221',
    'trajectory:sun-quan-wu-founding-229',
    'trajectory:orchid-pavilion-lantingji-xu-353',
    'trajectory:gwanggaeto-stele-414',
  ]
  const rows = await p.factTrajectory.findMany({ where: { externalId: { in: ids } }, select: { externalId: true, _count: { select: { transitions: true } } } })
  console.log('FOUND:', rows.length)
  console.log(JSON.stringify(rows, null, 2))
  await p.$disconnect()
}
main()
