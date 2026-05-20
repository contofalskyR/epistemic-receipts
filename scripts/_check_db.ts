import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const rows = await prisma.$queryRawUnsafe(`SELECT "ingestedBy", COUNT(*) as cnt FROM "Claim" WHERE "ingestedBy" IN ('poland_legislation_v1','pl_sejm_v1','pl_ustawa_v1','jp_law_v1','jp_kokkai_v1','japan_legislation_v1','argentina_legislation_v1','mexico_legislation_v1','brazil_legislation_v1','south_africa_legislation_v1','france_legislation_v1') GROUP BY "ingestedBy" ORDER BY cnt DESC`) as Array<{ingestedBy:string;cnt:bigint}>
  rows.forEach(r => console.log(`${r.ingestedBy}: ${r.cnt}`))
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
