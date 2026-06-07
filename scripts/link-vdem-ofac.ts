/**
 * link-vdem-ofac.ts
 *
 * Builds SANCTION_CONTEXT ClaimRelation rows from OFAC SDN sanction claims
 * (ofac_sdn_v1) to V-Dem democracy-indicator claims (vdem_v1) for the same
 * country in a window around the inferred sanction year.
 *
 *   from = ofac_sdn_v1 claim   (the sanctions designation)
 *   to   = vdem_v1 claim       (the democracy snapshot for that country-year)
 *   relationType = SANCTION_CONTEXT
 *
 * Sanction year T is inferred from the OFAC entry's `programs` list using
 * PROGRAM_YEAR (Executive Order signing dates / program-inception years).
 * Mirrors the logic in enrich-sanctions-economic-trajectory.ts.
 *
 * Window: V-Dem year ∈ [T-2, T+5].
 *
 * Both sides carry alpha-3 codes:
 *   - OFAC SDN: metadata.alpha3
 *   - V-Dem:    metadata.countryCode (V-Dem country_text_id, alpha-3 in practice)
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-vdem-ofac.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-vdem-ofac.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ALLOW_EDITS = process.env.ALLOW_EDITS === 'true'
const DRY_RUN = !ALLOW_EDITS || process.argv.includes('--dry-run')

const RELATION_TYPE = 'SANCTION_CONTEXT'
const INSERT_BATCH = 200
const PRE_OFFSET = -2
const POST_OFFSET = 5

// OFAC program / EO tag → year of inception. Same map as
// enrich-sanctions-economic-trajectory.ts (kept inline so the linker has
// no cross-script import dependency).
const PROGRAM_YEAR: Record<string, number> = {
  // Iran
  IRAN: 1995,
  'IRAN-EO13059': 1997,
  IFSR: 2010,
  'IRAN-TRA': 2012,
  IRGC: 2007,
  'IRAN-EO13902': 2020,
  'IRAN-EO13846': 2018,
  'IRAN-HR': 2010,
  'IRAN-EO13876': 2019,
  'IRAN-EO13871': 2019,
  'IRAN-CON': 2017,
  // Russia / Ukraine-related
  RUSSIA: 2014,
  'RUSSIA-EO14024': 2021,
  'CAATSA - RUSSIA': 2017,
  'UKRAINE-EO13660': 2014,
  'UKRAINE-EO13661': 2014,
  'UKRAINE-EO13662': 2014,
  'UKRAINE-EO13685': 2014,
  // Cuba
  CUBA: 1962,
  'CUBA-EO14404': 2025,
  // North Korea
  DPRK: 2008,
  DPRK2: 2010,
  DPRK3: 2017,
  DPRK4: 2017,
  'DPRK-EO13382': 2005,
  // Venezuela
  VENEZUELA: 2015,
  'VENEZUELA-EO13850': 2018,
  'VENEZUELA-EO13884': 2019,
  // Syria
  SYRIA: 2004,
  'SYRIA-EO13894': 2019,
  // Iraq
  IRAQ: 2003,
  IRAQ2: 2003,
  IRAQ3: 2004,
  'IRAQ-EO13303': 2003,
  // Belarus
  BELARUS: 2006,
  'BELARUS-EO14038': 2021,
  // Myanmar / Burma
  MYANMAR: 1997,
  'BURMA-EO14014': 2021,
  // Other country-specific
  SUDAN: 1997,
  ZIMBABWE: 2003,
  LIBYA: 2011,
  SOMALIA: 2010,
  MALI: 2019,
  NICARAGUA: 2018,
  CAR: 2014,
  DRC: 2006,
  'SOUTH-SUDAN': 2014,
  ETHIOPIA: 2021,
  HAITI: 2024,
  BURUNDI: 2015,
  YEMEN: 2012,
  AFGHANISTAN: 2002,
  // Thematic
  SDGT: 2001,
  SDNT: 1995,
  SDNTK: 1999,
  NPWMD: 2005,
  GLOMAG: 2017,
  'ILLICIT-DRUGS-EO14059': 2021,
  CYBER2: 2015,
  BALKANS: 2001,
  'ELECTION-EO13848': 2018,
  'PAARSSR-EO13894': 2019,
  TCO: 2011,
  'CHINA-MILITARY': 2020,
  CMIC: 2020,
}

function sanctionYearFor(programs: string[]): { year: number; program: string } | null {
  let best: { year: number; program: string } | null = null
  for (const p of programs) {
    const y = PROGRAM_YEAR[p.toUpperCase()] ?? PROGRAM_YEAR[p]
    if (y == null) continue
    if (!best || y < best.year) best = { year: y, program: p }
  }
  return best
}

async function main() {
  console.log(`\nlink-vdem-ofac.ts — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`)

  // ── Step 1: Load V-Dem claims, indexed by alpha-3 → year → claimId ──
  console.log('=== Step 1: Load V-Dem democracy-indicator claims ===')
  const vdemRows = await prisma.$queryRaw<
    Array<{ id: string; alpha3: string; year: number }>
  >`
    SELECT id,
           metadata->>'countryCode' AS alpha3,
           (metadata->>'year')::int AS year
    FROM "Claim"
    WHERE "ingestedBy" = 'vdem_v1'
      AND deleted = false
      AND metadata->>'countryCode' IS NOT NULL
      AND metadata->>'year' IS NOT NULL
  `
  console.log(`  V-Dem claims with (country, year): ${vdemRows.length}`)

  const vdemIndex = new Map<string, Map<number, string>>()
  for (const r of vdemRows) {
    let byYear = vdemIndex.get(r.alpha3)
    if (!byYear) {
      byYear = new Map()
      vdemIndex.set(r.alpha3, byYear)
    }
    byYear.set(r.year, r.id)
  }
  console.log(`  V-Dem countries indexed: ${vdemIndex.size}`)

  // ── Step 2: Load OFAC SDN claims with mappable alpha3 + program ──
  console.log('\n=== Step 2: Load OFAC SDN sanction claims ===')
  const ofacRows = await prisma.$queryRaw<
    Array<{ id: string; alpha3: string; programs: string[] }>
  >`
    SELECT id,
           metadata->>'alpha3' AS alpha3,
           (SELECT array_agg(p) FROM jsonb_array_elements_text(metadata->'programs') AS p) AS programs
    FROM "Claim"
    WHERE "ingestedBy" = 'ofac_sdn_v1'
      AND deleted = false
      AND metadata->>'alpha3' IS NOT NULL
      AND jsonb_array_length(metadata->'programs') > 0
  `
  console.log(`  OFAC SDN claims with alpha3 + programs: ${ofacRows.length}`)

  type OfacEntry = { id: string; alpha3: string; year: number; program: string }
  const ofac: OfacEntry[] = []
  let skipNoProgYear = 0
  for (const r of ofacRows) {
    const sy = sanctionYearFor(r.programs ?? [])
    if (!sy) { skipNoProgYear++; continue }
    ofac.push({ id: r.id, alpha3: r.alpha3, year: sy.year, program: sy.program })
  }
  console.log(`  Resolved (alpha3, sanctionYear): ${ofac.length}`)
  console.log(`  Skipped — no mappable program year: ${skipNoProgYear}`)

  // ── Step 3: Build candidate pairs ──
  console.log('\n=== Step 3: Build candidate pairs ===')
  type Pair = {
    fromClaimId: string
    toClaimId: string
    alpha3: string
    sanctionYear: number
    sanctionProgram: string
    vdemYear: number
    yearOffset: number
  }
  const seen = new Set<string>()
  const pairs: Pair[] = []
  const countriesCovered = new Set<string>()

  for (const e of ofac) {
    const byYear = vdemIndex.get(e.alpha3)
    if (!byYear) continue
    for (let dy = PRE_OFFSET; dy <= POST_OFFSET; dy++) {
      const vdemId = byYear.get(e.year + dy)
      if (!vdemId) continue
      const key = `${e.id}|${vdemId}`
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push({
        fromClaimId: e.id,
        toClaimId: vdemId,
        alpha3: e.alpha3,
        sanctionYear: e.year,
        sanctionProgram: e.program,
        vdemYear: e.year + dy,
        yearOffset: dy,
      })
      countriesCovered.add(e.alpha3)
    }
  }
  console.log(`  Candidate pairs: ${pairs.length}`)
  console.log(`  Countries covered (have V-Dem match): ${countriesCovered.size}`)

  // ── Step 4: Insert SANCTION_CONTEXT relations ──
  console.log(`\n=== Step 4: Persist SANCTION_CONTEXT relations (batch=${INSERT_BATCH}) ===`)
  if (DRY_RUN) {
    console.log(`  DRY RUN — would insert up to ${pairs.length} ClaimRelation rows`)
    await prisma.$disconnect()
    return
  }

  let inserted = 0
  for (let i = 0; i < pairs.length; i += INSERT_BATCH) {
    const slice = pairs.slice(i, i + INSERT_BATCH)
    const rows = slice.map(p => ({
      fromClaimId: p.fromClaimId,
      toClaimId: p.toClaimId,
      relationType: RELATION_TYPE,
      year: p.vdemYear,
      followUpContext: {
        alpha3: p.alpha3,
        sanctionYear: p.sanctionYear,
        sanctionProgram: p.sanctionProgram,
        sanctionYearSource: 'program_inception',
        vdemYear: p.vdemYear,
        yearOffsetFromSanction: p.yearOffset,
        window: `[T${PRE_OFFSET}, T+${POST_OFFSET}]`,
        heuristic: 'country_year_window',
        confidence: 'medium',
        pipeline_from: 'ofac_sdn_v1',
        pipeline_to: 'vdem_v1',
      },
    }))
    const res = await prisma.$transaction(
      async tx => tx.claimRelation.createMany({ data: rows, skipDuplicates: true }),
      { timeout: 30000 },
    )
    inserted += res.count
    if ((i / INSERT_BATCH) % 25 === 0) {
      console.log(`  Batch ${i / INSERT_BATCH + 1}: +${res.count} (cumulative ${inserted})`)
    }
  }

  const total = await prisma.claimRelation.count({
    where: { relationType: RELATION_TYPE },
  })
  console.log(
    `\n  Inserted ${inserted} of ${pairs.length} candidates (skipped existing).` +
      `\n  Total ${RELATION_TYPE} relations in DB after run: ${total}`,
  )

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
