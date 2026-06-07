/**
 * link-sanctions-economic.ts
 *
 * Builds ECONOMIC_IMPACT ClaimRelation rows from OFAC SDN entries
 * (ofac_sdn_v1) to WorldBank economic indicators (worldbank_v1) for the
 * same country.
 *
 *   from = OFAC SDN claim     (the sanction)
 *   to   = worldbank claim    (economic indicator for the same country)
 *   relationType = ECONOMIC_IMPACT
 *
 * Country resolution: OFAC SDN claims carry metadata.alpha3 (ISO3) when
 * populated; WorldBank claims carry metadata.countryIso3 directly.
 *
 * Time-window note: OFAC SDN entries have no per-record designation date in
 * the bulk XML feed we ingest (claimEmergedAt is NULL). The major OFAC
 * country programs in our slice (Iran, Russia, DPRK, Venezuela, Iraq, Myanmar,
 * Cuba, Nicaragua, Belarus, Somalia, CAR) have all been in continuous force
 * for at least the last decade. We treat the OFAC list as "currently in force"
 * and restrict WorldBank claims to the modern-sanctions era (year >= 2014).
 * The relation's `year` field carries the WorldBank year on each row.
 *
 * Indicator filter: only economic indicator codes are linked
 * (NY.GDP*, FP.CPI*, GC.DOD*, SL.UEM*, NY.GDP.DEFL*). Population and
 * health indicators are skipped to keep the relation editorially honest
 * (ECONOMIC_IMPACT, not POPULATION_IMPACT).
 *
 * Volume control: a sanctioned country can have thousands of OFAC SDN
 * entries (Iran ~3,525, Russia ~970). Linking every OFAC entry to every
 * WB economic claim would create millions of edges. We cap each country
 * pair at MAX_OFAC_PER_COUNTRY (default 10) representative OFAC entries,
 * sorted deterministically by OFAC uid ascending so re-runs are stable.
 * Each capped OFAC slice is then linked to every economic WB claim for
 * the same country in [SINCE_YEAR, ∞).
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-sanctions-economic.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-sanctions-economic.ts
 *
 * Flags:
 *   --dry-run             Don't write ClaimRelation rows
 *   --per-country N       Cap OFAC entries per country (default 10)
 *   --since-year YYYY     Earliest WB year to consider (default 2014)
 */

import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

interface Args { dryRun: boolean; perCountry: number; sinceYear: number }

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const a: Args = { dryRun: false, perCountry: 10, sinceYear: 2014 }
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i]
    if (v === '--dry-run') a.dryRun = true
    else if (v === '--per-country' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10); if (!isNaN(n) && n > 0) a.perCountry = n
    } else if (v === '--since-year' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10); if (!isNaN(n) && n > 0) a.sinceYear = n
    }
  }
  return a
}

function readAlpha3(meta: Prisma.JsonValue | null): string | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const v = (meta as { alpha3?: unknown }).alpha3
  return typeof v === 'string' ? v : null
}

function readUid(meta: Prisma.JsonValue | null): number | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const v = (meta as { uid?: unknown }).uid
  return typeof v === 'number' ? v : null
}

function isEconomicIndicator(code: string): boolean {
  return (
    code.startsWith('NY.GDP') ||
    code.startsWith('FP.CPI') ||
    code.startsWith('GC.DOD') ||
    code.startsWith('SL.UEM') ||
    code === 'NY.GDP.DEFL.KD.ZG'
  )
}

async function main() {
  const args = parseArgs()
  const isLive = !args.dryRun && !!process.env.ALLOW_EDITS

  console.log(`\nlink-sanctions-economic.ts — ${isLive ? 'LIVE' : 'DRY RUN'}`)
  console.log(`  Per-country cap : ${args.perCountry}`)
  console.log(`  WB since year   : ${args.sinceYear}\n`)

  // ── Step 1: Load OFAC SDN claims, bucket by alpha3 ─────────────────────────
  const ofacClaims = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: 'ofac_sdn_v1' },
    select: { id: true, externalId: true, metadata: true },
  })
  console.log(`  OFAC SDN claims checked     : ${ofacClaims.length}`)

  const ofacByAlpha3 = new Map<string, Array<{ id: string; externalId: string | null; uid: number | null }>>()
  let ofacWithCountry = 0
  for (const c of ofacClaims) {
    const a3 = readAlpha3(c.metadata)
    if (!a3) continue
    ofacWithCountry++
    const bucket = ofacByAlpha3.get(a3) ?? []
    bucket.push({ id: c.id, externalId: c.externalId, uid: readUid(c.metadata) })
    ofacByAlpha3.set(a3, bucket)
  }
  for (const bucket of ofacByAlpha3.values()) {
    bucket.sort((a, b) => {
      if (a.uid === null && b.uid === null) return 0
      if (a.uid === null) return 1
      if (b.uid === null) return -1
      return a.uid - b.uid
    })
  }
  console.log(`  OFAC with alpha3            : ${ofacWithCountry} across ${ofacByAlpha3.size} countries`)

  // ── Step 2: Load WB economic claims, filter to sanctioned countries + year ─
  const wbRows = await prisma.$queryRaw<
    Array<{ id: string; iso3: string; year: number; code: string }>
  >`
    SELECT id,
           metadata->>'countryIso3'   AS iso3,
           (metadata->>'year')::int   AS year,
           metadata->>'indicatorCode' AS code
    FROM "Claim"
    WHERE "ingestedBy" = 'worldbank_v1'
      AND deleted = false
      AND metadata->>'countryIso3' IS NOT NULL
      AND metadata->>'year' IS NOT NULL
      AND metadata->>'indicatorCode' IS NOT NULL
  `
  console.log(`  WorldBank claims checked    : ${wbRows.length}`)

  const sanctionedCountries = new Set(ofacByAlpha3.keys())
  const wbEcon = wbRows.filter(
    (r) =>
      sanctionedCountries.has(r.iso3) &&
      r.year >= args.sinceYear &&
      isEconomicIndicator(r.code)
  )
  console.log(`  WB economic-indicator claims in sanctioned countries (year ≥ ${args.sinceYear}): ${wbEcon.length}`)

  // ── Step 3: Build pairs ────────────────────────────────────────────────────
  type Pair = {
    fromClaimId: string
    toClaimId: string
    alpha3: string
    ofacExternalId: string | null
    indicatorCode: string
    indicatorYear: number
  }

  const pairs: Pair[] = []
  const byCountryStats: Record<string, { ofacSlice: number; wbEcon: number; pairs: number }> = {}

  for (const [alpha3, ofacBucket] of ofacByAlpha3.entries()) {
    const ofacSlice = ofacBucket.slice(0, args.perCountry)
    const wbForCountry = wbEcon.filter((r) => r.iso3 === alpha3)
    if (wbForCountry.length === 0) continue
    byCountryStats[alpha3] = {
      ofacSlice: ofacSlice.length,
      wbEcon: wbForCountry.length,
      pairs: ofacSlice.length * wbForCountry.length,
    }
    for (const wb of wbForCountry) {
      for (const of of ofacSlice) {
        pairs.push({
          fromClaimId: of.id,
          toClaimId: wb.id,
          alpha3,
          ofacExternalId: of.externalId,
          indicatorCode: wb.code,
          indicatorYear: wb.year,
        })
      }
    }
  }

  console.log(`\n  Candidate ECONOMIC_IMPACT pairs: ${pairs.length}`)
  console.log(`  Countries matched              : ${Object.keys(byCountryStats).length}`)
  for (const [a3, s] of Object.entries(byCountryStats).sort((a, b) => b[1].pairs - a[1].pairs)) {
    console.log(`    ${a3}: ${s.ofacSlice} OFAC × ${s.wbEcon} WB-econ = ${s.pairs} pairs`)
  }

  if (!isLive) {
    console.log('\n  Sample first 5 candidate pairs:')
    for (const p of pairs.slice(0, 5)) {
      console.log(`    [${p.alpha3}] ${p.ofacExternalId} → ${p.indicatorCode} ${p.indicatorYear}`)
    }
    console.log('\n  Dry-run / ALLOW_EDITS not set — no writes.')
    console.log('\n=== Summary ===')
    console.log(`  OFAC claims checked        : ${ofacClaims.length}`)
    console.log(`  WorldBank claims checked   : ${wbRows.length}`)
    console.log(`  Candidate relations        : ${pairs.length}`)
    console.log(`  Would insert (dry run)     : ${pairs.length} (existing skipped at write time)`)
    await prisma.$disconnect()
    return
  }

  // ── Step 4: Batched inserts with createMany skipDuplicates ────────────────
  const BATCH = 500
  let inserted = 0
  for (let i = 0; i < pairs.length; i += BATCH) {
    const slice = pairs.slice(i, i + BATCH)
    const rows = slice.map((p) => ({
      fromClaimId: p.fromClaimId,
      toClaimId: p.toClaimId,
      relationType: 'ECONOMIC_IMPACT',
      year: p.indicatorYear,
      followUpContext: {
        note: 'Country under OFAC sanction during this economic period',
        country: p.alpha3,
        indicatorCode: p.indicatorCode,
        indicatorYear: p.indicatorYear,
        heuristic: 'country_match_ofac_in_force',
        since_year: args.sinceYear,
        per_country_cap: args.perCountry,
        pipeline_from: 'ofac_sdn_v1',
        pipeline_to: 'worldbank_v1',
      },
    }))
    const res = await prisma.$transaction(
      async (tx) => tx.claimRelation.createMany({ data: rows, skipDuplicates: true }),
      { timeout: 30000 }
    )
    inserted += res.count
    if ((i / BATCH) % 10 === 0) {
      console.log(`  Batch ${Math.floor(i / BATCH) + 1}: inserted ${res.count} (cumulative ${inserted})`)
    }
  }

  const skipped = pairs.length - inserted
  console.log('\n=== Summary ===')
  console.log(`  OFAC claims checked        : ${ofacClaims.length}`)
  console.log(`  WorldBank claims checked   : ${wbRows.length}`)
  console.log(`  Candidate relations        : ${pairs.length}`)
  console.log(`  New relations created      : ${inserted}`)
  console.log(`  Skipped (already existed)  : ${skipped}`)

  const dbCount = await prisma.claimRelation.count({
    where: { relationType: 'ECONOMIC_IMPACT' },
  })
  console.log(`  DB count (ECONOMIC_IMPACT) : ${dbCount}`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
