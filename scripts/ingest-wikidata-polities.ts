// Pipeline 129 — Wikidata Historical Polities
// Dataset: Wikidata SPARQL — all sovereign states, empires, republics, etc. from antiquity to present
// Scope: Every political entity with a government type, start/end year, and optional ISO code
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-wikidata-polities.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-wikidata-polities.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'wikidata_polities_v1'
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const DRY_RUN_SAMPLE = 30
const BATCH_SIZE = 500

// ── Government type normalization ──────────────────────────────────────────────
// Maps Wikidata Q-ids (and partial English labels) → our governmentType enum.
// Wikidata has 200+ "instance of" values; we bucket into ~15 meaningful types.

const QTYPE_MAP: Record<string, string> = {
  // Republics / democracies
  Q7275: 'republic',          // sovereign state (fallback)
  Q3624078: 'republic',       // sovereign state
  Q6256: 'republic',          // country
  Q512187: 'republic',        // republic
  Q41710: 'republic',         // republic
  Q159025: 'republic',        // democratic republic
  Q1520223: 'republic',       // constitutional republic
  Q858439: 'democracy',       // democracy
  Q8928: 'democracy',         // liberal democracy
  Q7755: 'democracy',         // parliamentary democracy
  Q130942: 'democracy',       // representative democracy
  Q685963: 'democracy',       // constitutional democracy
  // Monarchies
  Q164950: 'monarchy',        // constitutional monarchy
  Q842112: 'monarchy',        // absolute monarchy
  Q192107: 'monarchy',        // monarchy
  Q208011: 'monarchy',        // parliamentary monarchy
  // Empires
  Q48349: 'empire',           // empire
  Q48264: 'empire',           // colonial empire
  Q188009: 'empire',          // hegemony (close enough)
  // Fascist / far-right authoritarian
  Q101785: 'fascist',         // fascist state
  Q7174: 'fascist',           // fascism
  // Communist / socialist
  Q849718: 'communist',       // communist state
  Q252947: 'communist',       // people's republic
  Q686090: 'communist',       // socialist republic
  Q7112912: 'communist',      // socialist state
  // Authoritarian (non-fascist, non-communist)
  Q371094: 'authoritarian',   // military dictatorship
  Q179435: 'authoritarian',   // dictatorship
  Q7176: 'authoritarian',     // authoritarianism
  Q2036158: 'authoritarian',  // authoritarian state
  Q161227: 'authoritarian',   // junta
  Q172579: 'authoritarian',   // oligarchy
  // Theocracy
  Q1370598: 'theocracy',      // theocracy
  Q131596: 'theocracy',       // Islamic republic
  // City-states
  Q123705: 'city_state',      // city-state (historical: Athens, Sparta, Venice, Carthage)
  // Tribal / chiefdom
  Q208241: 'tribal',          // chiefdom
  Q7295553: 'tribal',         // tribal confederation
  Q4917: 'tribal',            // tribe
  // Colonial / protectorate
  Q161243: 'colonial',        // colony
  Q41571: 'colonial',         // protectorate
  Q5153359: 'colonial',       // colonial possession
}

// Fallback: match on label keywords
function labelToType(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('empire')) return 'empire'
  if (l.includes('republic') || l.includes('democracy')) return 'republic'
  if (l.includes('kingdom') || l.includes('monarchy') || l.includes('sultanate') || l.includes('caliphate') || l.includes('emirate')) return 'monarchy'
  if (l.includes('fascist') || l.includes('nazi')) return 'fascist'
  if (l.includes('communist') || l.includes('soviet') || l.includes('people\'s')) return 'communist'
  if (l.includes('dictatorship') || l.includes('authoritarian') || l.includes('junta')) return 'authoritarian'
  if (l.includes('theocrat') || l.includes('islamic state') || l.includes('papal')) return 'theocracy'
  if (l.includes('city-state') || l.includes('city state') || l.includes('polis')) return 'city_state'
  if (l.includes('tribe') || l.includes('chiefdom') || l.includes('confederacy')) return 'tribal'
  if (l.includes('colony') || l.includes('colonial') || l.includes('protectorate')) return 'colonial'
  return 'other'
}

function resolveGovernmentType(qid: string, instanceOfLabel: string): string {
  return QTYPE_MAP[qid] ?? labelToType(instanceOfLabel)
}

// ── SPARQL query ──────────────────────────────────────────────────────────────
// Pulls all entities that are instances of sovereign state subtypes.
// Uses UNION to cast a wide net across empires, republics, kingdoms, etc.

// Use only the two canonical Wikidata entity types:
//   Q3624078 = sovereign state (all modern nations)
//   Q3024240  = historical country (Soviet Union, Nazi Germany, Byzantine Empire, Weimar Republic, etc.)
// Government type comes from P122 (basic form of government), Wikidata's dedicated property.
// This avoids guessing Q-ids for government subtypes and eliminates noise from administrative entities.
// UNION approach:
// - Modern sovereign states (Q3624078) REQUIRE P298 ISO code — filters out companies/orgs
//   wrongly tagged as sovereign states in Wikidata
// - Historical countries (Q3024240) are generally clean — no ISO required
//   This catches: Soviet Union, Nazi Germany, Byzantine Empire, Weimar Republic, etc.
const SPARQL_QUERY = `
SELECT DISTINCT
  ?entity
  ?entityLabel
  ?instanceOf
  ?instanceOfLabel
  ?govType
  ?govTypeLabel
  ?startTime
  ?endTime
  ?isoCode
  ?replacesLabel
WHERE {
  {
    ?entity wdt:P31 wd:Q3624078 .
    ?entity wdt:P30 ?continent .             # must be on a continent — companies/studios are not
    OPTIONAL { ?entity wdt:P298 ?isoCode }
    BIND(wd:Q3624078 AS ?instanceOf)
  } UNION {
    ?entity wdt:P31 wd:Q3024240 .              # historical country (Soviet Union, Nazi Germany, etc.)
    # Must have a geographic anchor (continent or capital). Nested UNION inside UNION
    # parses unreliably; FILTER+EXISTS is cleaner.
    FILTER (EXISTS { ?entity wdt:P30 [] } || EXISTS { ?entity wdt:P36 [] })
    OPTIONAL { ?entity wdt:P298 ?isoCode }
    BIND(wd:Q3024240 AS ?instanceOf)
  }
  OPTIONAL { ?entity wdt:P122 ?govType }      # basic form of government
  OPTIONAL { ?entity wdt:P571 ?startTime }    # inception
  OPTIONAL { ?entity wdt:P576 ?endTime }      # dissolved/abolished
  OPTIONAL { ?entity wdt:P1365 ?replaces }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
ORDER BY ?entityLabel
`

interface SparqlBinding {
  entity?: { value: string }
  entityLabel?: { value: string }
  instanceOf?: { value: string }
  instanceOfLabel?: { value: string }
  govType?: { value: string }
  govTypeLabel?: { value: string }
  startTime?: { value: string }
  endTime?: { value: string }
  isoCode?: { value: string }
  replacesLabel?: { value: string }
}

interface SparqlResponse {
  results: { bindings: SparqlBinding[] }
}

interface PolityCandidate {
  wikidataId: string
  name: string
  instanceOfQid: string
  instanceOfLabel: string
  governmentType: string
  startYear: number | null
  endYear: number | null
  countryCode: string | null
  successorOf: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractQid(uri: string): string {
  return uri.replace('http://www.wikidata.org/entity/', '')
}

function parseYear(wdTime: string | undefined): number | null {
  if (!wdTime) return null
  // Format: +YYYY-MM-DDT00:00:00Z or -YYYY-MM-DDT00:00:00Z
  const m = wdTime.match(/^([+-])(\d+)-/)
  if (!m) return null
  const year = parseInt(m[2], 10)
  return m[1] === '-' ? -year : year
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ── Fetch from Wikidata ────────────────────────────────────────────────────────

async function fetchPolities(): Promise<PolityCandidate[]> {
  console.log('  Querying Wikidata SPARQL...')
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(SPARQL_QUERY)}&format=json`

  const res = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'epistemic-receipts/1.0 (research; robert.contofalsky@rutgers.edu)',
    },
  })

  if (!res.ok) throw new Error(`Wikidata SPARQL error: ${res.status} ${res.statusText}`)

  const data = (await res.json()) as SparqlResponse
  const bindings = data.results.bindings
  console.log(`  Raw bindings: ${bindings.length}`)

  // Deduplicate: one candidate per wikidataId (keep first occurrence per entity)
  const seen = new Map<string, PolityCandidate>()

  for (const b of bindings) {
    const entityUri = b.entity?.value
    if (!entityUri) continue
    const wikidataId = extractQid(entityUri)
    if (seen.has(wikidataId)) continue

    const name = b.entityLabel?.value ?? wikidataId
    // Skip auto-generated labels that are just Q-numbers (no English label)
    if (/^Q\d+$/.test(name)) continue

    // Government type from P122 (basic form of government) — much more accurate than P31 subtype
    const govTypeQid = b.govType?.value ? extractQid(b.govType.value) : ''
    const govTypeLabel = b.govTypeLabel?.value ?? ''
    // Fall back to instanceOf label for entities without P122
    const instanceOfLabel = b.instanceOfLabel?.value ?? ''
    const governmentType = resolveGovernmentType(govTypeQid, govTypeLabel || instanceOfLabel)

    seen.set(wikidataId, {
      wikidataId,
      name,
      instanceOfQid: govTypeQid,
      instanceOfLabel: govTypeLabel || instanceOfLabel,
      governmentType,
      startYear: parseYear(b.startTime?.value),
      endYear: parseYear(b.endTime?.value),
      countryCode: b.isoCode?.value ?? null,
      successorOf: b.replacesLabel?.value ?? null,
    })
  }

  return Array.from(seen.values())
}

// ── Ingest ─────────────────────────────────────────────────────────────────────

async function ingestPolities(candidates: PolityCandidate[]): Promise<{ ingested: number; skipped: number; errors: number }> {
  const counts = { ingested: 0, skipped: 0, errors: 0 }

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)

    for (const c of batch) {
      try {
        const existing = await prisma.polity.findUnique({ where: { wikidataId: c.wikidataId }, select: { id: true } })
        if (existing) { counts.skipped++; continue }

        await prisma.polity.create({
          data: {
            name: c.name,
            countryCode: c.countryCode,
            governmentType: c.governmentType,
            startYear: c.startYear,
            endYear: c.endYear,
            wikidataId: c.wikidataId,
            successorOf: c.successorOf,
          },
        })
        counts.ingested++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Failed ${c.wikidataId} (${c.name}): ${msg}`)
        counts.errors++
      }
    }

    console.log(`  Progress: ${Math.min(i + BATCH_SIZE, candidates.length)}/${candidates.length}`)
    if (i + BATCH_SIZE < candidates.length) await sleep(200)
  }

  return counts
}

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  if (!args.includes('--dry-run') && !args.includes('--full')) {
    console.error('Usage: --dry-run | --full')
    process.exit(1)
  }
  const mode = args.includes('--full') ? 'full' : 'dry-run'
  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true')
    process.exit(1)
  }
  return { mode: mode as 'dry-run' | 'full' }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode } = parseArgs()

  console.log('\n── Pipeline 129: Wikidata Historical Polities ──────────────────────')
  console.log(`Mode: ${mode}`)

  console.log('\nStep 1: Fetching polities from Wikidata SPARQL...')
  const candidates = await fetchPolities()
  console.log(`  Unique polities: ${candidates.length}`)

  // Government type distribution
  const typeCounts: Record<string, number> = {}
  for (const c of candidates) typeCounts[c.governmentType] = (typeCounts[c.governmentType] ?? 0) + 1
  console.log('\n  Government type distribution:')
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type.padEnd(16)} ${count}`)
  }

  if (mode === 'dry-run') {
    const sample = candidates.slice(0, DRY_RUN_SAMPLE)
    console.log(`\nSample (first ${DRY_RUN_SAMPLE}):`)
    for (const c of sample) {
      const years = `${c.startYear ?? '?'} – ${c.endYear ?? 'present'}`
      console.log(`  [${c.governmentType.padEnd(14)}] ${years.padEnd(20)} ${c.name} (${c.wikidataId})`)
    }

    fs.writeFileSync('pipeline-129-dry-run-sample.json', JSON.stringify({ runDate: new Date().toISOString(), total: candidates.length, typeCounts, sample }, null, 2))
    console.log('\n  Written: pipeline-129-dry-run-sample.json')
    console.log('\nDry-run complete. STOP — awaiting explicit go-ahead before full run.')
    return
  }

  console.log(`\nStep 2: Ingesting ${candidates.length} polities...`)
  const counts = await ingestPolities(candidates)

  console.log(`\nIngestion complete`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  const dbTotal = await prisma.polity.count()
  console.log(`  DB total: ${dbTotal}`)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
