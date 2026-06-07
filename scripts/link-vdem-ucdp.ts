/**
 * link-vdem-ucdp.ts
 *
 * Builds CONFLICT_CONTEXT ClaimRelation rows from UCDP/PRIO armed-conflict
 * dyad-year claims (ucdp_v1) to V-Dem democracy-indicator claims (vdem_v1)
 * for the same country in the same year (±1).
 *
 *   from = ucdp_v1 claim   (the conflict-dyad-year)
 *   to   = vdem_v1 claim   (the democracy snapshot)
 *   relationType = CONFLICT_CONTEXT
 *
 * Match key:
 *   - UCDP stores ISO alpha-2 in metadata.country (via GWNO→ISO2 map in the
 *     ingester).
 *   - V-Dem stores ISO alpha-3 in metadata.countryCode (V-Dem country_text_id).
 *   - Linker converts the V-Dem alpha-3 to alpha-2 via the inline ALPHA3_TO_ALPHA2
 *     map below, then joins on (alpha-2, year) with a ±1 window.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-vdem-ucdp.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-vdem-ucdp.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ALLOW_EDITS = process.env.ALLOW_EDITS === 'true'
const DRY_RUN = !ALLOW_EDITS || process.argv.includes('--dry-run')

const RELATION_TYPE = 'CONFLICT_CONTEXT'
const INSERT_BATCH = 200
const YEAR_WINDOW = 1

// ISO 3166-1 alpha-3 → alpha-2. Comprehensive enough to cover every country
// that appears in either vdem_v1 or ucdp_v1 (V-Dem has ~180 countries, UCDP
// covers roughly the same set). Historical / non-ISO V-Dem codes (e.g. "ZZB"
// for Zanzibar, "PSG" for Palestine Gaza) simply won't match UCDP rows.
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  AFG: 'AF', ALB: 'AL', DZA: 'DZ', AND: 'AD', AGO: 'AO', ATG: 'AG', ARG: 'AR',
  ARM: 'AM', AUS: 'AU', AUT: 'AT', AZE: 'AZ', BHS: 'BS', BHR: 'BH', BGD: 'BD',
  BRB: 'BB', BLR: 'BY', BEL: 'BE', BLZ: 'BZ', BEN: 'BJ', BTN: 'BT', BOL: 'BO',
  BIH: 'BA', BWA: 'BW', BRA: 'BR', BRN: 'BN', BGR: 'BG', BFA: 'BF', BDI: 'BI',
  CPV: 'CV', KHM: 'KH', CMR: 'CM', CAN: 'CA', CAF: 'CF', TCD: 'TD', CHL: 'CL',
  CHN: 'CN', COL: 'CO', COM: 'KM', COG: 'CG', COD: 'CD', CRI: 'CR', CIV: 'CI',
  HRV: 'HR', CUB: 'CU', CYP: 'CY', CZE: 'CZ', DNK: 'DK', DJI: 'DJ', DMA: 'DM',
  DOM: 'DO', ECU: 'EC', EGY: 'EG', SLV: 'SV', GNQ: 'GQ', ERI: 'ER', EST: 'EE',
  SWZ: 'SZ', ETH: 'ET', FJI: 'FJ', FIN: 'FI', FRA: 'FR', GAB: 'GA', GMB: 'GM',
  GEO: 'GE', DEU: 'DE', GHA: 'GH', GRC: 'GR', GRD: 'GD', GTM: 'GT', GIN: 'GN',
  GNB: 'GW', GUY: 'GY', HTI: 'HT', HND: 'HN', HUN: 'HU', ISL: 'IS', IND: 'IN',
  IDN: 'ID', IRN: 'IR', IRQ: 'IQ', IRL: 'IE', ISR: 'IL', ITA: 'IT', JAM: 'JM',
  JPN: 'JP', JOR: 'JO', KAZ: 'KZ', KEN: 'KE', KIR: 'KI', PRK: 'KP', KOR: 'KR',
  KWT: 'KW', KGZ: 'KG', LAO: 'LA', LVA: 'LV', LBN: 'LB', LSO: 'LS', LBR: 'LR',
  LBY: 'LY', LIE: 'LI', LTU: 'LT', LUX: 'LU', MDG: 'MG', MWI: 'MW', MYS: 'MY',
  MDV: 'MV', MLI: 'ML', MLT: 'MT', MHL: 'MH', MRT: 'MR', MUS: 'MU', MEX: 'MX',
  FSM: 'FM', MDA: 'MD', MCO: 'MC', MNG: 'MN', MNE: 'ME', MAR: 'MA', MOZ: 'MZ',
  MMR: 'MM', NAM: 'NA', NRU: 'NR', NPL: 'NP', NLD: 'NL', NZL: 'NZ', NIC: 'NI',
  NER: 'NE', NGA: 'NG', MKD: 'MK', NOR: 'NO', OMN: 'OM', PAK: 'PK', PLW: 'PW',
  PSE: 'PS', PAN: 'PA', PNG: 'PG', PRY: 'PY', PER: 'PE', PHL: 'PH', POL: 'PL',
  PRT: 'PT', QAT: 'QA', ROU: 'RO', RUS: 'RU', RWA: 'RW', KNA: 'KN', LCA: 'LC',
  VCT: 'VC', WSM: 'WS', SMR: 'SM', STP: 'ST', SAU: 'SA', SEN: 'SN', SRB: 'RS',
  SYC: 'SC', SLE: 'SL', SGP: 'SG', SVK: 'SK', SVN: 'SI', SLB: 'SB', SOM: 'SO',
  ZAF: 'ZA', SSD: 'SS', ESP: 'ES', LKA: 'LK', SDN: 'SD', SUR: 'SR', SWE: 'SE',
  CHE: 'CH', SYR: 'SY', TWN: 'TW', TJK: 'TJ', TZA: 'TZ', THA: 'TH', TLS: 'TL',
  TGO: 'TG', TON: 'TO', TTO: 'TT', TUN: 'TN', TUR: 'TR', TKM: 'TM', TUV: 'TV',
  UGA: 'UG', UKR: 'UA', ARE: 'AE', GBR: 'GB', USA: 'US', URY: 'UY', UZB: 'UZ',
  VUT: 'VU', VAT: 'VA', VEN: 'VE', VNM: 'VN', YEM: 'YE', ZMB: 'ZM', ZWE: 'ZW',
  // Historical / V-Dem codes mapped to their successor state (best-effort)
  YUG: 'RS', // Yugoslavia → Serbia
  SCG: 'RS', // Serbia & Montenegro → Serbia
  TLS_LEGACY: 'TL',
}

async function main() {
  console.log(`\nlink-vdem-ucdp.ts — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`)

  // ── Step 1: Load V-Dem claims, indexed by alpha-2 → year → claimId ──
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
  const unmappedAlpha3 = new Map<string, number>()
  for (const r of vdemRows) {
    const a2 = ALPHA3_TO_ALPHA2[r.alpha3]
    if (!a2) {
      unmappedAlpha3.set(r.alpha3, (unmappedAlpha3.get(r.alpha3) ?? 0) + 1)
      continue
    }
    let byYear = vdemIndex.get(a2)
    if (!byYear) {
      byYear = new Map()
      vdemIndex.set(a2, byYear)
    }
    byYear.set(r.year, r.id)
  }
  console.log(`  V-Dem countries indexed (alpha-2): ${vdemIndex.size}`)
  if (unmappedAlpha3.size > 0) {
    const top = [...unmappedAlpha3.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([c, n]) => `${c}(${n})`)
      .join(', ')
    console.log(`  V-Dem alpha-3 codes without alpha-2 mapping (top 10): ${top}`)
  }

  // ── Step 2: Load UCDP conflict-year claims ──
  console.log('\n=== Step 2: Load UCDP conflict-year claims ===')
  const ucdpRows = await prisma.$queryRaw<
    Array<{ id: string; alpha2: string; year: number }>
  >`
    SELECT id,
           metadata->>'country' AS alpha2,
           (metadata->>'year')::int AS year
    FROM "Claim"
    WHERE "ingestedBy" = 'ucdp_v1'
      AND deleted = false
      AND metadata->>'country' IS NOT NULL
      AND metadata->>'year' IS NOT NULL
  `
  console.log(`  UCDP claims with (country, year): ${ucdpRows.length}`)

  // ── Step 3: Build candidate pairs (UCDP → V-Dem, ±1 year window) ──
  console.log('\n=== Step 3: Build candidate pairs (±1 year window) ===')
  type Pair = {
    fromClaimId: string
    toClaimId: string
    alpha2: string
    ucdpYear: number
    vdemYear: number
    yearOffset: number
  }
  const seen = new Set<string>()
  const pairs: Pair[] = []
  const countriesCovered = new Set<string>()
  let ucdpNoMatch = 0
  let ucdpMatched = 0

  for (const u of ucdpRows) {
    const byYear = vdemIndex.get(u.alpha2)
    if (!byYear) { ucdpNoMatch++; continue }
    let anyMatch = false
    for (let dy = -YEAR_WINDOW; dy <= YEAR_WINDOW; dy++) {
      const vdemId = byYear.get(u.year + dy)
      if (!vdemId) continue
      const key = `${u.id}|${vdemId}`
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push({
        fromClaimId: u.id,
        toClaimId: vdemId,
        alpha2: u.alpha2,
        ucdpYear: u.year,
        vdemYear: u.year + dy,
        yearOffset: dy,
      })
      countriesCovered.add(u.alpha2)
      anyMatch = true
    }
    if (anyMatch) ucdpMatched++
    else ucdpNoMatch++
  }
  console.log(`  UCDP claims with ≥1 V-Dem match: ${ucdpMatched}`)
  console.log(`  UCDP claims with no V-Dem match: ${ucdpNoMatch}`)
  console.log(`  Candidate pairs: ${pairs.length}`)
  console.log(`  Countries covered: ${countriesCovered.size}`)

  // ── Step 4: Insert CONFLICT_CONTEXT relations ──
  console.log(`\n=== Step 4: Persist CONFLICT_CONTEXT relations (batch=${INSERT_BATCH}) ===`)
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
        alpha2: p.alpha2,
        ucdpYear: p.ucdpYear,
        vdemYear: p.vdemYear,
        yearOffset: p.yearOffset,
        heuristic: 'country_year_window',
        window: `±${YEAR_WINDOW}`,
        confidence: 'medium',
        pipeline_from: 'ucdp_v1',
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
