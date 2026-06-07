/**
 * link-vdem-sipri.ts
 *
 * Builds MILITARY_CONTEXT ClaimRelation rows from SIPRI military-expenditure
 * country-year claims (sipri_milex_v1) to V-Dem democracy-indicator claims
 * (vdem_v1) for the same country and same year.
 *
 *   from = sipri_milex_v1 claim   (the milex row)
 *   to   = vdem_v1 claim          (the democracy snapshot)
 *   relationType = MILITARY_CONTEXT
 *
 * Match key:
 *   - SIPRI stores country *name* in metadata.country → resolve to alpha-2 via
 *     SIPRI_NAME_ALIASES + lib/countryCodeMap → then to alpha-3 via
 *     ALPHA2_TO_ALPHA3.
 *   - V-Dem stores alpha-3 in metadata.countryCode (V-Dem country_text_id).
 *   - Linker joins on (alpha-3, exact year).
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-vdem-sipri.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-vdem-sipri.ts
 */

import { PrismaClient } from '@prisma/client'
import { COUNTRY_NAME_TO_CODE } from '../lib/countryCodeMap'

const prisma = new PrismaClient()
const ALLOW_EDITS = process.env.ALLOW_EDITS === 'true'
const DRY_RUN = !ALLOW_EDITS || process.argv.includes('--dry-run')

const RELATION_TYPE = 'MILITARY_CONTEXT'
const INSERT_BATCH = 200

// Same SIPRI name → alpha-2 alias table that link-ucdp-sipri.ts uses.
const SIPRI_NAME_ALIASES: Record<string, string> = {
  'United States of America': 'US',
  'Russia': 'RU',
  'USSR': 'RU',
  'Türkiye': 'TR',
  'Turkiye': 'TR',
  'Korea, South': 'KR',
  'Czechia': 'CZ',
  'Czechoslovakia': 'CZ',
  'Viet Nam': 'VN',
  'North Macedonia': 'MK',
  'Eswatini': 'SZ',
  "Cote d'Ivoire": 'CI',
  "Côte d'Ivoire": 'CI',
  'Cape Verde': 'CV',
  'Congo, DR': 'CD',
  'Congo, Republic': 'CG',
  'German Democratic Republic': 'DE',
  'Gambia, The': 'GM',
  'Kyrgyz Republic': 'KG',
  'Yemen, North': 'YE',
  'Timor Leste': 'TL',
  'Laos': 'LA',
  'Belarus': 'BY',
  'Angola': 'AO', 'Bahrain': 'BH', 'Belize': 'BZ', 'Benin': 'BJ',
  'Botswana': 'BW', 'Burkina Faso': 'BF', 'Burundi': 'BI', 'Cameroon': 'CM',
  'Central African Republic': 'CF', 'Chad': 'TD', 'Djibouti': 'DJ',
  'Dominican Republic': 'DO', 'El Salvador': 'SV', 'Equatorial Guinea': 'GQ',
  'Fiji': 'FJ', 'Gabon': 'GA', 'Guinea': 'GN', 'Guinea-Bissau': 'GW',
  'Guyana': 'GY', 'Haiti': 'HT', 'Honduras': 'HN', 'Kosovo': 'XK',
  'Kuwait': 'KW', 'Lesotho': 'LS', 'Liberia': 'LR', 'Libya': 'LY',
  'Madagascar': 'MG', 'Malawi': 'MW', 'Mali': 'ML', 'Mauritania': 'MR',
  'Mauritius': 'MU', 'Moldova': 'MD', 'Mongolia': 'MN', 'Montenegro': 'ME',
  'Mozambique': 'MZ', 'Namibia': 'NA', 'Nepal': 'NP', 'Nicaragua': 'NI',
  'Niger': 'NE', 'Oman': 'OM', 'Papua New Guinea': 'PG', 'Qatar': 'QA',
  'Rwanda': 'RW', 'Serbia': 'RS', 'Seychelles': 'SC', 'Sierra Leone': 'SL',
  'Somalia': 'SO', 'South Sudan': 'SS', 'Sudan': 'SD', 'Syria': 'SY',
  'Tajikistan': 'TJ', 'Togo': 'TG', 'Turkmenistan': 'TM', 'Uzbekistan': 'UZ',
  'Yemen': 'YE', 'Zambia': 'ZM', 'Zimbabwe': 'ZW',
}

// alpha-2 → alpha-3 for everything SIPRI may produce.
const ALPHA2_TO_ALPHA3: Record<string, string> = {
  AF: 'AFG', AL: 'ALB', DZ: 'DZA', AD: 'AND', AO: 'AGO', AG: 'ATG', AR: 'ARG',
  AM: 'ARM', AU: 'AUS', AT: 'AUT', AZ: 'AZE', BS: 'BHS', BH: 'BHR', BD: 'BGD',
  BB: 'BRB', BY: 'BLR', BE: 'BEL', BZ: 'BLZ', BJ: 'BEN', BT: 'BTN', BO: 'BOL',
  BA: 'BIH', BW: 'BWA', BR: 'BRA', BN: 'BRN', BG: 'BGR', BF: 'BFA', BI: 'BDI',
  CV: 'CPV', KH: 'KHM', CM: 'CMR', CA: 'CAN', CF: 'CAF', TD: 'TCD', CL: 'CHL',
  CN: 'CHN', CO: 'COL', KM: 'COM', CG: 'COG', CD: 'COD', CR: 'CRI', CI: 'CIV',
  HR: 'HRV', CU: 'CUB', CY: 'CYP', CZ: 'CZE', DK: 'DNK', DJ: 'DJI', DM: 'DMA',
  DO: 'DOM', EC: 'ECU', EG: 'EGY', SV: 'SLV', GQ: 'GNQ', ER: 'ERI', EE: 'EST',
  SZ: 'SWZ', ET: 'ETH', FJ: 'FJI', FI: 'FIN', FR: 'FRA', GA: 'GAB', GM: 'GMB',
  GE: 'GEO', DE: 'DEU', GH: 'GHA', GR: 'GRC', GD: 'GRD', GT: 'GTM', GN: 'GIN',
  GW: 'GNB', GY: 'GUY', HT: 'HTI', HN: 'HND', HU: 'HUN', IS: 'ISL', IN: 'IND',
  ID: 'IDN', IR: 'IRN', IQ: 'IRQ', IE: 'IRL', IL: 'ISR', IT: 'ITA', JM: 'JAM',
  JP: 'JPN', JO: 'JOR', KZ: 'KAZ', KE: 'KEN', KI: 'KIR', KP: 'PRK', KR: 'KOR',
  KW: 'KWT', KG: 'KGZ', LA: 'LAO', LV: 'LVA', LB: 'LBN', LS: 'LSO', LR: 'LBR',
  LY: 'LBY', LI: 'LIE', LT: 'LTU', LU: 'LUX', MG: 'MDG', MW: 'MWI', MY: 'MYS',
  MV: 'MDV', ML: 'MLI', MT: 'MLT', MH: 'MHL', MR: 'MRT', MU: 'MUS', MX: 'MEX',
  FM: 'FSM', MD: 'MDA', MC: 'MCO', MN: 'MNG', ME: 'MNE', MA: 'MAR', MZ: 'MOZ',
  MM: 'MMR', NA: 'NAM', NR: 'NRU', NP: 'NPL', NL: 'NLD', NZ: 'NZL', NI: 'NIC',
  NE: 'NER', NG: 'NGA', MK: 'MKD', NO: 'NOR', OM: 'OMN', PK: 'PAK', PW: 'PLW',
  PS: 'PSE', PA: 'PAN', PG: 'PNG', PY: 'PRY', PE: 'PER', PH: 'PHL', PL: 'POL',
  PT: 'PRT', QA: 'QAT', RO: 'ROU', RU: 'RUS', RW: 'RWA', KN: 'KNA', LC: 'LCA',
  VC: 'VCT', WS: 'WSM', SM: 'SMR', ST: 'STP', SA: 'SAU', SN: 'SEN', RS: 'SRB',
  SC: 'SYC', SL: 'SLE', SG: 'SGP', SK: 'SVK', SI: 'SVN', SB: 'SLB', SO: 'SOM',
  ZA: 'ZAF', SS: 'SSD', ES: 'ESP', LK: 'LKA', SD: 'SDN', SR: 'SUR', SE: 'SWE',
  CH: 'CHE', SY: 'SYR', TW: 'TWN', TJ: 'TJK', TZ: 'TZA', TH: 'THA', TL: 'TLS',
  TG: 'TGO', TO: 'TON', TT: 'TTO', TN: 'TUN', TR: 'TUR', TM: 'TKM', TV: 'TUV',
  UG: 'UGA', UA: 'UKR', AE: 'ARE', GB: 'GBR', US: 'USA', UY: 'URY', UZ: 'UZB',
  VU: 'VUT', VA: 'VAT', VE: 'VEN', VN: 'VNM', YE: 'YEM', ZM: 'ZMB', ZW: 'ZWE',
  XK: 'XKX', // Kosovo (user-assigned)
}

function sipriCountryToAlpha3(name: string): string | null {
  let a2 = SIPRI_NAME_ALIASES[name] ?? COUNTRY_NAME_TO_CODE[name] ?? null
  if (!a2) {
    const cleaned = name.replace(/\s*\([^)]*\)\s*$/, '').trim()
    if (cleaned !== name) {
      a2 = SIPRI_NAME_ALIASES[cleaned] ?? COUNTRY_NAME_TO_CODE[cleaned] ?? null
    }
  }
  if (!a2) return null
  return ALPHA2_TO_ALPHA3[a2] ?? null
}

async function main() {
  console.log(`\nlink-vdem-sipri.ts — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`)

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

  // ── Step 2: Load SIPRI milex claims ──
  console.log('\n=== Step 2: Load SIPRI military-expenditure claims ===')
  const sipriRows = await prisma.$queryRaw<
    Array<{ id: string; country: string; year: number }>
  >`
    SELECT id,
           metadata->>'country' AS country,
           (metadata->>'year')::int AS year
    FROM "Claim"
    WHERE "ingestedBy" = 'sipri_milex_v1'
      AND deleted = false
      AND metadata->>'country' IS NOT NULL
      AND metadata->>'year' IS NOT NULL
  `
  console.log(`  SIPRI claims with (country, year): ${sipriRows.length}`)

  // ── Step 3: Resolve SIPRI country → alpha-3 + build candidate pairs ──
  console.log('\n=== Step 3: Build candidate pairs (exact-year join) ===')
  type Pair = {
    fromClaimId: string
    toClaimId: string
    alpha3: string
    sipriCountry: string
    year: number
  }
  const seen = new Set<string>()
  const pairs: Pair[] = []
  const countriesCovered = new Set<string>()
  const unknownNames = new Map<string, number>()
  let unmatchedYear = 0

  for (const s of sipriRows) {
    const a3 = sipriCountryToAlpha3(s.country)
    if (!a3) {
      unknownNames.set(s.country, (unknownNames.get(s.country) ?? 0) + 1)
      continue
    }
    const byYear = vdemIndex.get(a3)
    if (!byYear) { unmatchedYear++; continue }
    const vdemId = byYear.get(s.year)
    if (!vdemId) { unmatchedYear++; continue }
    const key = `${s.id}|${vdemId}`
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push({
      fromClaimId: s.id,
      toClaimId: vdemId,
      alpha3: a3,
      sipriCountry: s.country,
      year: s.year,
    })
    countriesCovered.add(a3)
  }
  if (unknownNames.size > 0) {
    const top = [...unknownNames.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([n, k]) => `${n}(${k})`)
      .join(', ')
    console.log(`  SIPRI names not mapped to alpha-3 (top 10): ${top}`)
  }
  console.log(`  SIPRI rows with no V-Dem (alpha3, year) match: ${unmatchedYear}`)
  console.log(`  Candidate pairs: ${pairs.length}`)
  console.log(`  Countries covered: ${countriesCovered.size}`)

  // ── Step 4: Insert MILITARY_CONTEXT relations ──
  console.log(`\n=== Step 4: Persist MILITARY_CONTEXT relations (batch=${INSERT_BATCH}) ===`)
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
      year: p.year,
      followUpContext: {
        alpha3: p.alpha3,
        sipriCountryName: p.sipriCountry,
        year: p.year,
        heuristic: 'country_iso_year_exact',
        confidence: 'medium',
        pipeline_from: 'sipri_milex_v1',
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
