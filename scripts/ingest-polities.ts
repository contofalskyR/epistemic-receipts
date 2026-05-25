// Pipeline — Wikidata Polities
// Ingest sovereign states and historical polities from Wikidata SPARQL
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-polities.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-polities.ts --full
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-polities.ts --full --limit 500

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const USER_AGENT = 'epistemic-receipts-ingester/1.0 (research; contact robert.contofalsky@rutgers.edu)'

// ── Government type mapping ────────────────────────────────────────────────────

// Maps Wikidata Q-numbers (for instance-of / P31 values) to governmentType strings
const GOV_TYPE_MAP: Record<string, string> = {
  Q43702: 'fascist',       // fascism
  Q7112154: 'fascist',     // fascist state
  Q849706: 'communist',    // communist state
  Q152750: 'communist',    // communist party
  Q7203: 'communist',      // Marxist–Leninist state
  Q7269: 'empire',         // empire
  Q48349: 'empire',        // absolute monarchy
  Q194203: 'city_state',   // city-state
  Q1250464: 'theocracy',   // theocracy
  Q185553: 'authoritarian', // authoritarian state
  Q13228731: 'authoritarian', // authoritarian regime
  Q7270: 'republic',       // republic
  Q3624078: 'republic',    // sovereign state (often republic)
  Q7272: 'democracy',      // democracy
  Q2532639: 'democracy',   // representative democracy
  Q28523: 'monarchy',      // constitutional monarchy
  Q41614: 'monarchy',      // monarchy
}

type GovernmentType =
  | 'democracy' | 'republic' | 'monarchy' | 'empire' | 'fascist'
  | 'communist' | 'authoritarian' | 'theocracy' | 'city_state'
  | 'tribal' | 'colonial' | 'other'

function mapGovernmentType(instanceQids: string[]): GovernmentType {
  for (const qid of instanceQids) {
    const mapped = GOV_TYPE_MAP[qid]
    if (mapped) return mapped as GovernmentType
  }
  return 'other'
}

// ── SPARQL query ──────────────────────────────────────────────────────────────

function buildQuery(limit: number): string {
  return `
SELECT DISTINCT ?item ?itemLabel ?countryCode ?startTime ?endTime ?instanceOf WHERE {
  ?item wdt:P31 ?instanceOf .
  VALUES ?instanceOf {
    wd:Q3624078 wd:Q7270 wd:Q6256 wd:Q7271 wd:Q7272 wd:Q43702 wd:Q7112154
    wd:Q849706 wd:Q152750 wd:Q7203 wd:Q7269 wd:Q48349 wd:Q194203
    wd:Q1250464 wd:Q185553 wd:Q13228731 wd:Q28523 wd:Q41614 wd:Q2532639
  }
  OPTIONAL { ?item wdt:P297 ?countryCode . }
  OPTIONAL { ?item wdt:P571 ?startTime . }
  OPTIONAL { ?item wdt:P580 ?startTime . }
  OPTIONAL { ?item wdt:P582 ?endTime . }
  OPTIONAL { ?item wdt:P576 ?endTime . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT ${limit}
`
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SparqlBinding {
  item: { value: string }
  itemLabel: { value: string }
  countryCode?: { value: string }
  startTime?: { value: string }
  endTime?: { value: string }
  instanceOf: { value: string }
}

interface SparqlResult {
  results: {
    bindings: SparqlBinding[]
  }
}

interface PolityRecord {
  wikidataId: string
  name: string
  countryCode: string | null
  governmentType: GovernmentType
  startYear: number | null
  endYear: number | null
  instanceQids: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractQid(uri: string): string {
  return uri.replace('http://www.wikidata.org/entity/', '')
}

function extractYear(isoDate: string | undefined): number | null {
  if (!isoDate) return null
  // Handle negative years: "-0044-01-01T00:00:00Z" → -44
  const m = isoDate.match(/^(-?\d{4,})/)
  if (!m) return null
  return parseInt(m[1], 10)
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  if (!args.includes('--dry-run') && !args.includes('--full')) {
    console.error('Usage: --dry-run | --full  [--limit N]')
    process.exit(1)
  }
  const mode = args.includes('--full') ? 'full' : 'dry-run'
  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true')
    process.exit(1)
  }
  const li = args.indexOf('--limit')
  return {
    mode: mode as 'dry-run' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '5000', 10) || 5000) : 5000,
  }
}

// ── Fetch SPARQL ──────────────────────────────────────────────────────────────

async function fetchPolities(limit: number): Promise<SparqlBinding[]> {
  const query = buildQuery(limit)
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`

  console.log(`Fetching SPARQL (limit=${limit})…`)
  const res = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': USER_AGENT,
    },
  })
  if (!res.ok) {
    throw new Error(`SPARQL fetch failed: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as SparqlResult
  return data.results.bindings
}

// ── Normalise bindings into PolityRecord (dedup on QID) ──────────────────────

function normaliseBindings(bindings: SparqlBinding[]): PolityRecord[] {
  const byQid = new Map<string, PolityRecord>()

  for (const b of bindings) {
    const qid = extractQid(b.item.value)
    const instanceQid = extractQid(b.instanceOf.value)
    const existing = byQid.get(qid)

    if (existing) {
      // Accumulate instance-of QIDs for better gov-type resolution
      if (!existing.instanceQids.includes(instanceQid)) {
        existing.instanceQids.push(instanceQid)
        existing.governmentType = mapGovernmentType(existing.instanceQids)
      }
      continue
    }

    byQid.set(qid, {
      wikidataId: qid,
      name: b.itemLabel.value,
      countryCode: b.countryCode?.value ?? null,
      governmentType: mapGovernmentType([instanceQid]),
      startYear: extractYear(b.startTime?.value),
      endYear: extractYear(b.endTime?.value),
      instanceQids: [instanceQid],
    })
  }

  return Array.from(byQid.values())
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit } = parseArgs()

  const bindings = await fetchPolities(limit)
  console.log(`Raw bindings returned: ${bindings.length}`)

  const records = normaliseBindings(bindings)
  console.log(`Unique polities after dedup: ${records.length}`)

  // Gov-type breakdown
  const govTypeCounts: Record<string, number> = {}
  for (const r of records) {
    govTypeCounts[r.governmentType] = (govTypeCounts[r.governmentType] ?? 0) + 1
  }
  console.log('Government type breakdown:')
  for (const [k, v] of Object.entries(govTypeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`)
  }

  if (mode === 'dry-run') {
    console.log('\nDry run — first 5 samples:')
    for (const r of records.slice(0, 5)) {
      console.log(`  ${r.wikidataId} | ${r.name} | ${r.governmentType} | ${r.startYear ?? '?'}–${r.endYear ?? 'active'} | cc=${r.countryCode ?? '—'}`)
    }
    console.log('\nDry run complete. Pass --full with ALLOW_EDITS=true to write.')
    await prisma.$disconnect()
    return
  }

  // Full ingest — upsert in batches
  let upserted = 0
  let errors = 0
  const BATCH = 50

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map(async (r) => {
        try {
          await prisma.polity.upsert({
            where: { wikidataId: r.wikidataId },
            update: {
              name: r.name,
              countryCode: r.countryCode,
              governmentType: r.governmentType,
              startYear: r.startYear,
              endYear: r.endYear,
            },
            create: {
              name: r.name,
              countryCode: r.countryCode,
              governmentType: r.governmentType,
              startYear: r.startYear,
              endYear: r.endYear,
              wikidataId: r.wikidataId,
            },
          })
          upserted++
        } catch (err) {
          console.error(`Failed upsert ${r.wikidataId}: ${err}`)
          errors++
        }
      })
    )
    // Brief pause between batches to be kind to DB
    if (i + BATCH < records.length) await sleep(100)
    if ((i / BATCH) % 10 === 0) {
      console.log(`  Progress: ${Math.min(i + BATCH, records.length)}/${records.length}`)
    }
  }

  console.log(`\nDone. Upserted: ${upserted}  Errors: ${errors}`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Fatal:', err)
  prisma.$disconnect()
  process.exit(1)
})
