// Polity → LegislativeVote + Claim direct linking.
//
// Match rules:
//   Votes:  LegislativeVote.dataSource → alpha-2 → alpha-3 matches Polity.countryCode
//           AND voteDate year in [polity.startYear, polity.endYear] (null = open)
//   Claims: Claim.ingestedBy → alpha-2 → alpha-3 matches Polity.countryCode
//           AND claimEmergedAt year in [polity.startYear, polity.endYear] (null = open)
//
// Skips: howtheyvote_eu (multi-country), pipelines not in PIPELINE_COUNTRY, claims
//        with no claimEmergedAt.
//
// Run: ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-polity-votes-claims.ts
//      Add --dry-run to preview without writes. Add --votes-only or --claims-only to restrict.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PIPELINE_COUNTRY } from '../lib/globe-pipeline-country'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')
const ALLOW_EDITS = process.env.ALLOW_EDITS === 'true'
const VOTES_ONLY = process.argv.includes('--votes-only')
const CLAIMS_ONLY = process.argv.includes('--claims-only')
const BATCH = 2000

// ISO 3166-1 alpha-2 → alpha-3. Covers all codes in PIPELINE_COUNTRY.
const ALPHA2_TO_ALPHA3: Record<string, string> = {
  US: 'USA', GB: 'GBR', DE: 'DEU', FR: 'FRA', IT: 'ITA', ES: 'ESP',
  PT: 'PRT', NL: 'NLD', BE: 'BEL', SE: 'SWE', DK: 'DNK', FI: 'FIN',
  NO: 'NOR', AT: 'AUT', CH: 'CHE', IE: 'IRL', PL: 'POL', CZ: 'CZE',
  HU: 'HUN', SK: 'SVK', SI: 'SVN', HR: 'HRV', RO: 'ROU', BG: 'BGR',
  RS: 'SRB', EE: 'EST', LV: 'LVA', LT: 'LTU', CY: 'CYP', MT: 'MLT',
  IS: 'ISL', LU: 'LUX', GE: 'GEO', RU: 'RUS', CA: 'CAN', MX: 'MEX',
  BR: 'BRA', AR: 'ARG', CL: 'CHL', CO: 'COL', PE: 'PER', UY: 'URY',
  CR: 'CRI', JM: 'JAM', TT: 'TTO', JP: 'JPN', KR: 'KOR', CN: 'CHN',
  IN: 'IND', ID: 'IDN', MY: 'MYS', SG: 'SGP', TH: 'THA', PH: 'PHL',
  AU: 'AUS', TW: 'TWN', LK: 'LKA', PK: 'PAK', BD: 'BGD', BN: 'BRN',
  AE: 'ARE', KE: 'KEN', ZA: 'ZAF', IL: 'ISR',
}

// Extra datasource overrides not in PIPELINE_COUNTRY.
// howtheyvote_eu is intentionally absent — it covers multiple EU member states.
const DATASOURCE_OVERRIDES: Record<string, string> = {
  voteview_v1: 'US',
  'uk-parliament': 'GB',
  uk_parliament: 'GB',
  openparliament: 'CA',
}

function toAlpha3(alpha2: string): string | null {
  return ALPHA2_TO_ALPHA3[alpha2] ?? null
}

function resolveToAlpha3(tag: string): string | null {
  const alpha2 = DATASOURCE_OVERRIDES[tag] ?? PIPELINE_COUNTRY[tag]
  if (!alpha2) return null
  return toAlpha3(alpha2)
}

function yearInRange(year: number, startYear: number | null, endYear: number | null): boolean {
  if (startYear != null && year < startYear) return false
  if (endYear != null && year > endYear) return false
  return true
}

async function linkVotes(polityByAlpha3: Map<string, { id: string; name: string; startYear: number | null; endYear: number | null }[]>) {
  console.log('\n── Votes ──')

  const votes = await prisma.legislativeVote.findMany({
    select: { id: true, dataSource: true, voteDate: true },
  })
  console.log(`  Total LegislativeVote rows: ${votes.length}`)

  const existing = new Set(
    (await prisma.polityVote.findMany({ select: { voteId: true } })).map((r) => r.voteId),
  )

  const toInsert: { polityId: string; voteId: string; matchMethod: string }[] = []
  let skippedNoCountry = 0
  let skippedNoDate = 0
  let skippedNoPolity = 0

  for (const v of votes) {
    if (existing.has(v.id)) continue
    const ds = v.dataSource ?? ''
    const alpha3 = resolveToAlpha3(ds)
    if (!alpha3) { skippedNoCountry++; continue }

    const candidates = polityByAlpha3.get(alpha3)
    if (!candidates || candidates.length === 0) { skippedNoPolity++; continue }

    const year = v.voteDate ? v.voteDate.getUTCFullYear() : null

    for (const polity of candidates) {
      if (year != null && !yearInRange(year, polity.startYear, polity.endYear)) continue
      // If no voteDate, only link to open-ended polities (both null)
      if (year == null && (polity.startYear != null || polity.endYear != null)) {
        skippedNoDate++
        continue
      }
      toInsert.push({ polityId: polity.id, voteId: v.id, matchMethod: 'auto_country_date' })
    }
  }

  let inserted = 0
  if (toInsert.length > 0 && !DRY_RUN && ALLOW_EDITS) {
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const r = await prisma.polityVote.createMany({ data: toInsert.slice(i, i + BATCH), skipDuplicates: true })
      inserted += r.count
    }
  } else if (!DRY_RUN && !ALLOW_EDITS) {
    // no-op
  }

  console.log(`  skipped no-country-map: ${skippedNoCountry}  no-polity: ${skippedNoPolity}  no-date-bounded: ${skippedNoDate}`)
  console.log(`  new links: ${toInsert.length}  inserted: ${inserted}  preexisting: ${existing.size}`)
  return inserted
}

async function linkClaims(polityByAlpha3: Map<string, { id: string; name: string; startYear: number | null; endYear: number | null }[]>) {
  console.log('\n── Claims ──')

  const claims = await prisma.claim.findMany({
    where: {
      deleted: false,
      claimEmergedAt: { not: null },
    },
    select: { id: true, ingestedBy: true, claimEmergedAt: true },
  })
  console.log(`  Claims with claimEmergedAt (not deleted): ${claims.length}`)

  const existing = new Set(
    (await prisma.polityClaim.findMany({ select: { claimId: true } })).map((r) => r.claimId),
  )

  const toInsert: { polityId: string; claimId: string; matchMethod: string }[] = []
  let skippedNoCountry = 0
  let skippedNoPolity = 0
  let skippedOutOfRange = 0

  for (const c of claims) {
    if (existing.has(c.id)) continue
    const alpha3 = resolveToAlpha3(c.ingestedBy)
    if (!alpha3) { skippedNoCountry++; continue }

    const candidates = polityByAlpha3.get(alpha3)
    if (!candidates || candidates.length === 0) { skippedNoPolity++; continue }

    const year = c.claimEmergedAt!.getUTCFullYear()

    let matched = false
    for (const polity of candidates) {
      if (!yearInRange(year, polity.startYear, polity.endYear)) { skippedOutOfRange++; continue }
      toInsert.push({ polityId: polity.id, claimId: c.id, matchMethod: 'auto_country_date' })
      matched = true
    }
    void matched
  }

  let inserted = 0
  if (toInsert.length > 0 && !DRY_RUN && ALLOW_EDITS) {
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const r = await prisma.polityClaim.createMany({ data: toInsert.slice(i, i + BATCH), skipDuplicates: true })
      inserted += r.count
    }
  }

  console.log(`  skipped no-country-map: ${skippedNoCountry}  no-polity: ${skippedNoPolity}  out-of-range: ${skippedOutOfRange}`)
  console.log(`  new links: ${toInsert.length}  inserted: ${inserted}  preexisting: ${existing.size}`)
  return inserted
}

async function main() {
  if (!DRY_RUN && !ALLOW_EDITS) {
    console.error('Refusing to write: set ALLOW_EDITS=true or pass --dry-run')
    process.exit(2)
  }

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'}`)

  const polities = await prisma.polity.findMany({
    where: { countryCode: { not: null } },
    select: { id: true, name: true, countryCode: true, startYear: true, endYear: true },
  })
  console.log(`Loaded ${polities.length} polities with countryCode`)

  const polityByAlpha3 = new Map<string, { id: string; name: string; startYear: number | null; endYear: number | null }[]>()
  for (const p of polities) {
    const key = p.countryCode!
    const list = polityByAlpha3.get(key) ?? []
    list.push({ id: p.id, name: p.name, startYear: p.startYear, endYear: p.endYear })
    polityByAlpha3.set(key, list)
  }

  let votesInserted = 0
  let claimsInserted = 0

  if (!CLAIMS_ONLY) votesInserted = await linkVotes(polityByAlpha3)
  if (!VOTES_ONLY) claimsInserted = await linkClaims(polityByAlpha3)

  // DB-side verification per AGENTS.md rule
  const finalVotes = await prisma.polityVote.count()
  const finalClaims = await prisma.polityClaim.count()
  console.log('\n── Summary ──')
  console.log(`inserted vote links this run:  ${votesInserted}`)
  console.log(`inserted claim links this run: ${claimsInserted}`)
  console.log(`total PolityVote rows:  ${finalVotes}`)
  console.log(`total PolityClaim rows: ${finalClaims}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
