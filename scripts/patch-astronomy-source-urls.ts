// One-time patch: fix 6 broken source URLs from the solar-system bucket.
// Enceladus/Mimas/Charon had wrong /solar-system/moons/ path (404).
// Pallas/Juno/Hygiea had no NASA Science pages (404); replaced with JPL SBDB.
// Run: cd /path && npx dotenv -e .env.local -- npx tsx scripts/patch-astronomy-source-urls.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FIXES = [
  {
    externalId: 'solar_body_source_enceladus',
    url: 'https://science.nasa.gov/saturn/moons/enceladus/',
  },
  {
    externalId: 'solar_body_source_mimas',
    url: 'https://science.nasa.gov/saturn/moons/mimas/',
  },
  {
    externalId: 'solar_body_source_charon',
    url: 'https://science.nasa.gov/dwarf-planets/pluto/moons/charon/',
  },
  {
    externalId: 'solar_body_source_pallas',
    url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2%20pallas',
    name: 'JPL Small-Body Database: 2 Pallas',
  },
  {
    externalId: 'solar_body_source_juno',
    url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=3%20juno',
    name: 'JPL Small-Body Database: 3 Juno',
  },
  {
    externalId: 'solar_body_source_hygiea',
    url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=10%20hygiea',
    name: 'JPL Small-Body Database: 10 Hygiea',
  },
]

async function main() {
  let patched = 0
  let missing = 0

  for (const fix of FIXES) {
    const existing = await prisma.source.findUnique({ where: { externalId: fix.externalId } })
    if (!existing) {
      console.log(`  NOT FOUND: ${fix.externalId}`)
      missing++
      continue
    }

    const updateData: { url: string; name?: string } = { url: fix.url }
    if (fix.name) updateData.name = fix.name

    await prisma.source.update({ where: { externalId: fix.externalId }, data: updateData })
    console.log(`  Patched: ${fix.externalId} → ${fix.url}`)
    patched++
  }

  console.log(`\nDone. Patched: ${patched}, Not found: ${missing}`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
