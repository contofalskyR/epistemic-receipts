/**
 * link-ucdp-sipri.ts
 *
 * Builds MILITARY_CONTEXT ClaimRelation rows from UCDP/PRIO armed-conflict
 * dyad-year claims (ucdp_v1) to SIPRI Military Expenditure country-year claims
 * (sipri_milex_v1) by matching country + year.
 *
 * Match key: SIPRI is country-year; UCDP is conflict-dyad-year with a location
 * country (via gwno_loc). For each UCDP claim, we look up the SIPRI claim for
 * the same country in the same year. Country matching uses ISO codes derived
 * from SIPRI's country name (lib/countryCodeMap.ts) on one side, and UCDP's
 * metadata.country (already ISO) on the other.
 *
 * Direction: fromClaim = UCDP conflict-year, toClaim = SIPRI milex (the milex
 * row is the "military context" surrounding the conflict).
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-ucdp-sipri.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-ucdp-sipri.ts
 */

import { PrismaClient } from '@prisma/client'
import { COUNTRY_NAME_TO_CODE } from '../lib/countryCodeMap'

const prisma = new PrismaClient()
const ALLOW_EDITS = process.env.ALLOW_EDITS === 'true'
const DRY_RUN = !ALLOW_EDITS || process.argv.includes('--dry-run')

// SIPRI country name → ISO. Built empirically from the active sipri_milex_v1
// set; lib/countryCodeMap.ts covers only a subset (legislative-pipeline countries).
const SIPRI_NAME_ALIASES: Record<string, string> = {
  // Variants the shared map doesn't carry
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
  'Cote d\'Ivoire': 'CI',
  'Côte d\'Ivoire': 'CI',
  'Cape Verde': 'CV',
  'Congo, DR': 'CD',
  'Congo, Republic': 'CG',
  'German Democratic Republic': 'DE',
  'Gambia, The': 'GM',
  'Kyrgyz Republic': 'KG',
  'Yemen, North': 'YE',
  'Timor Leste': 'TL',
  'Laos': 'LA',

  // SIPRI names that lib/countryCodeMap doesn't list at all
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

  // EU is not a country — exclude
}

function sipriCountryToIso(name: string): string | null {
  if (SIPRI_NAME_ALIASES[name]) return SIPRI_NAME_ALIASES[name]
  if (COUNTRY_NAME_TO_CODE[name]) return COUNTRY_NAME_TO_CODE[name]
  // Try trimming footnote markers like "(*)" or trailing parentheticals.
  const cleaned = name.replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (cleaned !== name) {
    if (SIPRI_NAME_ALIASES[cleaned]) return SIPRI_NAME_ALIASES[cleaned]
    if (COUNTRY_NAME_TO_CODE[cleaned]) return COUNTRY_NAME_TO_CODE[cleaned]
  }
  return null
}

interface SipriMeta { country?: string; year?: number }
interface UcdpMeta { country?: string | null; year?: number; gwnoLoc?: string }

async function main() {
  console.log(`\nlink-ucdp-sipri.ts — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`)

  const sipri = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: 'sipri_milex_v1' },
    select: { id: true, metadata: true },
  })
  console.log(`  SIPRI milex claims: ${sipri.length}`)

  // Index SIPRI by (iso, year)
  const sipriIndex = new Map<string, string>() // key = `${iso}|${year}` -> claimId
  const unknownNames = new Map<string, number>()
  for (const c of sipri) {
    const meta = (c.metadata ?? {}) as SipriMeta
    if (!meta.country || meta.year == null) continue
    const iso = sipriCountryToIso(meta.country)
    if (!iso) {
      unknownNames.set(meta.country, (unknownNames.get(meta.country) ?? 0) + 1)
      continue
    }
    sipriIndex.set(`${iso}|${meta.year}`, c.id)
  }
  console.log(`  SIPRI claims indexed by (ISO, year): ${sipriIndex.size}`)
  if (unknownNames.size > 0) {
    const sample = [...unknownNames.entries()].slice(0, 10).map(([n, k]) => `${n}(${k})`).join(', ')
    console.log(`  SIPRI country names with no ISO (top 10): ${sample}`)
  }

  const ucdp = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: 'ucdp_v1' },
    select: { id: true, metadata: true },
  })
  console.log(`  UCDP conflict-year claims: ${ucdp.length}`)

  type Candidate = { fromUcdpId: string; toSipriId: string; iso: string; year: number }
  const candidates: Candidate[] = []
  let unmatched = 0
  for (const c of ucdp) {
    const meta = (c.metadata ?? {}) as UcdpMeta
    if (!meta.country || meta.year == null) { unmatched++; continue }
    const key = `${meta.country}|${meta.year}`
    const sipriId = sipriIndex.get(key)
    if (!sipriId) { unmatched++; continue }
    candidates.push({ fromUcdpId: c.id, toSipriId: sipriId, iso: meta.country, year: meta.year })
  }
  console.log(`  UCDP claims with SIPRI match: ${candidates.length} (no match: ${unmatched})`)

  let inserted = 0
  let skipped = 0
  for (const cand of candidates) {
    const followUpContext = {
      iso: cand.iso,
      year: cand.year,
      heuristic: 'country_iso_year_join',
      pipeline_from: 'ucdp_v1',
      pipeline_to: 'sipri_milex_v1',
    }
    if (DRY_RUN) { inserted++; continue }
    try {
      await prisma.claimRelation.create({
        data: {
          fromClaimId: cand.fromUcdpId,
          toClaimId: cand.toSipriId,
          relationType: 'MILITARY_CONTEXT',
          year: cand.year,
          followUpContext,
        },
      })
      inserted++
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') { skipped++ } else throw e
    }
    if ((inserted + skipped) % 500 === 0) {
      console.log(`  Progress: ${inserted + skipped}/${candidates.length}`)
    }
  }

  console.log(`\n  ClaimRelations ${DRY_RUN ? 'would-be-inserted' : 'inserted'}: ${inserted}` +
    ` · already-existed: ${skipped}` +
    ` · mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
