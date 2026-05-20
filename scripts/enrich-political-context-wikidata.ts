// Enrichment: Political Context via Wikidata SPARQL
// Backfills PoliticalContext records for all legislation sources.
// Strategy: one SPARQL query per country fetches the full HoG term history;
//           each source's enactment date is matched locally — avoids per-row
//           API calls and stays well under Wikidata's rate limit.
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-political-context-wikidata.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-political-context-wikidata.ts --full [--country de] [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

// ── Country registry ──────────────────────────────────────────────────────────
// Maps ingestedBy pipeline tag → { country label, Wikidata QID, HoG property }
// P6 = head of government (most countries)
// P35 = head of state (where HoG is not applicable, e.g., presidential systems
//       that already use P6 for the same person)

interface CountryInfo {
  country: string
  wikidataQid: string
  hogProperty: string  // P6 for head of gov, P35 for head of state as fallback
}

const LEGISLATION_PIPELINES: Record<string, CountryInfo> = {
  congress_v1:               { country: 'United States',   wikidataQid: 'Q30',   hogProperty: 'P35' }, // P35 = President
  congress_bills_v1:         { country: 'United States',   wikidataQid: 'Q30',   hogProperty: 'P35' },
  fr_rules_v1:               { country: 'United States',   wikidataQid: 'Q30',   hogProperty: 'P35' },
  riksdag_v1:                { country: 'Sweden',          wikidataQid: 'Q34',   hogProperty: 'P6'  },
  tweedekamer_v1:            { country: 'Netherlands',     wikidataQid: 'Q55',   hogProperty: 'P6'  },
  bundestag_v1:              { country: 'Germany',         wikidataQid: 'Q183',  hogProperty: 'P6'  },
  nationalrat_v1:            { country: 'Austria',         wikidataQid: 'Q40',   hogProperty: 'P6'  },
  oireachtas_v1:             { country: 'Ireland',         wikidataQid: 'Q27',   hogProperty: 'P6'  },
  canada_bills_v1:           { country: 'Canada',          wikidataQid: 'Q16',   hogProperty: 'P6'  },
  uk_legislation_v1:         { country: 'United Kingdom',  wikidataQid: 'Q145',  hogProperty: 'P6'  },
  australia_legislation_v1:  { country: 'Australia',       wikidataQid: 'Q408',  hogProperty: 'P6'  },
  norway_legislation_v1:     { country: 'Norway',          wikidataQid: 'Q20',   hogProperty: 'P6'  },
  nz_legislation_v1:         { country: 'New Zealand',     wikidataQid: 'Q664',  hogProperty: 'P6'  },
  india_legislation_v1:      { country: 'India',           wikidataQid: 'Q668',  hogProperty: 'P6'  },
  singapore_legislation_v1:  { country: 'Singapore',       wikidataQid: 'Q334',  hogProperty: 'P6'  },
  iceland_legislation_v1:    { country: 'Iceland',         wikidataQid: 'Q189',  hogProperty: 'P6'  },
  denmark_legislation_v1:    { country: 'Denmark',         wikidataQid: 'Q35',   hogProperty: 'P6'  },
  finland_legislation_v1:    { country: 'Finland',         wikidataQid: 'Q33',   hogProperty: 'P6'  },
  switzerland_legislation_v1:{ country: 'Switzerland',     wikidataQid: 'Q39',   hogProperty: 'P6'  },
  belgium_legislation_v1:    { country: 'Belgium',         wikidataQid: 'Q31',   hogProperty: 'P6'  },
  portugal_legislation_v1:   { country: 'Portugal',        wikidataQid: 'Q45',   hogProperty: 'P6'  },
  spain_legislation_v1:      { country: 'Spain',           wikidataQid: 'Q29',   hogProperty: 'P6'  },
  poland_legislation_v1:     { country: 'Poland',          wikidataQid: 'Q36',   hogProperty: 'P6'  },
  italy_legislation_v1:      { country: 'Italy',           wikidataQid: 'Q38',   hogProperty: 'P6'  },
  japan_legislation_v1:      { country: 'Japan',           wikidataQid: 'Q17',   hogProperty: 'P6'  },
  argentina_legislation_v1:  { country: 'Argentina',       wikidataQid: 'Q414',  hogProperty: 'P6'  },
  taiwan_legislation_v1:     { country: 'Taiwan',          wikidataQid: 'Q865',  hogProperty: 'P6'  },
  mexico_legislation_v1:     { country: 'Mexico',          wikidataQid: 'Q96',   hogProperty: 'P6'  },
  brazil_legislation_v1:     { country: 'Brazil',          wikidataQid: 'Q155',  hogProperty: 'P35' },
  south_africa_legislation_v1:{ country: 'South Africa',   wikidataQid: 'Q258',  hogProperty: 'P6'  },
  chile_legislation_v1:      { country: 'Chile',           wikidataQid: 'Q298',  hogProperty: 'P6'  },
  colombia_legislation_v1:   { country: 'Colombia',        wikidataQid: 'Q739',  hogProperty: 'P6'  },
  philippines_legislation_v1:{ country: 'Philippines',     wikidataQid: 'Q928',  hogProperty: 'P6'  },
  france_legislation_v1:     { country: 'France',          wikidataQid: 'Q142',  hogProperty: 'P6'  },
  bangladesh_legislation_v1: { country: 'Bangladesh',      wikidataQid: 'Q902',  hogProperty: 'P6'  },
  russia_legislation_v1:     { country: 'Russia',          wikidataQid: 'Q159',  hogProperty: 'P6'  },
  israel_knesset_v1:         { country: 'Israel',          wikidataQid: 'Q801',  hogProperty: 'P6'  },
  scotland_legislation_v1:   { country: 'Scotland',        wikidataQid: 'Q22',   hogProperty: 'P6'  },
  wales_senedd_v1:           { country: 'Wales',           wikidataQid: 'Q25',   hogProperty: 'P6'  },
  eu_parliament_v1:          { country: 'European Union',  wikidataQid: 'Q458',  hogProperty: 'P6'  },
  eu_legislation_v1:         { country: 'European Union',  wikidataQid: 'Q458',  hogProperty: 'P6'  },
  un_sc_resolutions_v1:      { country: 'United Nations',  wikidataQid: 'Q1065', hogProperty: 'P6'  },
  nato_official_texts_v1:    { country: 'NATO',            wikidataQid: 'Q7184', hogProperty: 'P6'  },
}

const ALL_INGEST_TAGS = Object.keys(LEGISLATION_PIPELINES)

// ── Types ──────────────────────────────────────────────────────────────────────

interface HogTerm {
  personQid: string
  personLabel: string
  partyQid: string | null
  partyLabel: string | null
  start: Date
  end: Date | null
}

interface SparqlBinding {
  value: string
  type: string
}

interface SparqlResult {
  results: {
    bindings: Array<Record<string, SparqlBinding>>
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --full [--country <tag>] [--limit N] [--verbose]')
        process.exit(1) as never
      })()

  const ci = args.indexOf('--country')
  const li = args.indexOf('--limit')

  return {
    mode: mode as 'dry-run' | 'full',
    countryFilter: ci !== -1 ? (args[ci + 1] ?? null) : null,
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
  }
}

// ── Rate limiter ──────────────────────────────────────────────────────────────

let lastSparqlAt = 0

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function sparqlThrottle() {
  const wait = 1100 - (Date.now() - lastSparqlAt)
  if (wait > 0) await sleep(wait)
  lastSparqlAt = Date.now()
}

// ── Wikidata SPARQL ───────────────────────────────────────────────────────────

async function queryWikidata(sparql: string, retries = 3): Promise<SparqlResult> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`
  let delay = 3000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await sparqlThrottle()
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/sparql-results+json',
          'User-Agent': 'EpistemicReceipts/1.0 (robert.contofalsky@rutgers.edu)',
        },
      })
      if (res.status === 429 && attempt < retries) {
        console.warn(`  Wikidata 429 — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`Wikidata SPARQL ${res.status}`)
      return res.json() as Promise<SparqlResult>
    } catch (err) {
      if (attempt < retries) {
        console.warn(`  Wikidata error (attempt ${attempt + 1}): ${err} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
      } else {
        throw err
      }
    }
  }
  throw new Error('Wikidata SPARQL failed after retries')
}

// ── Fetch HoG terms for a country ────────────────────────────────────────────
// Returns all head-of-government terms sorted by start date ascending.

async function fetchHogTerms(info: CountryInfo): Promise<HogTerm[]> {
  const sparql = `
SELECT ?person ?personLabel ?party ?partyLabel ?start ?end WHERE {
  wd:${info.wikidataQid} p:${info.hogProperty} ?statement .
  ?statement ps:${info.hogProperty} ?person .
  ?statement pq:P580 ?start .
  OPTIONAL { ?statement pq:P582 ?end . }
  OPTIONAL { ?person wdt:P102 ?party . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?start
`

  const data = await queryWikidata(sparql)
  const seen = new Set<string>()
  const terms: HogTerm[] = []

  for (const row of data.results.bindings) {
    const personQid = (row.person?.value ?? '').replace('http://www.wikidata.org/entity/', '')
    const startStr = row.start?.value
    if (!personQid || !startStr) continue

    const start = new Date(startStr)
    if (isNaN(start.getTime())) continue

    const endStr = row.end?.value
    const end = endStr ? new Date(endStr) : null
    if (end !== null && isNaN(end.getTime())) continue

    const partyQid = row.party?.value
      ? row.party.value.replace('http://www.wikidata.org/entity/', '')
      : null

    // Deduplicate on (personQid, start) — SPARQL can return multiple party rows
    const key = `${personQid}__${startStr}`
    if (seen.has(key)) continue
    seen.add(key)

    terms.push({
      personQid,
      personLabel: row.personLabel?.value ?? personQid,
      partyQid,
      partyLabel: row.partyLabel?.value ?? null,
      start,
      end,
    })
  }

  return terms
}

// ── Match a date to a HoG term ────────────────────────────────────────────────

function matchHog(terms: HogTerm[], date: Date): HogTerm | null {
  // Find the term whose [start, end) bracket contains the date.
  // Terms are sorted ascending by start.
  for (const term of terms) {
    if (term.start > date) break
    if (term.end === null || term.end >= date) return term
  }
  // Fallback: the last term before the date (end might just be missing)
  let best: HogTerm | null = null
  for (const term of terms) {
    if (term.start <= date) best = term
  }
  return best
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, countryFilter, limit, verbose } = parseArgs()

  console.log('\n── Enrich: Political Context via Wikidata ───────────────────────────────')
  console.log(`Mode: ${mode} | Country filter: ${countryFilter ?? 'all'} | Limit: ${limit || 'all'}`)

  // Determine which ingestedBy tags to process
  const tagsToProcess = countryFilter
    ? ALL_INGEST_TAGS.filter(t => {
        const info = LEGISLATION_PIPELINES[t]!
        return t === countryFilter ||
          info.country.toLowerCase().includes(countryFilter.toLowerCase()) ||
          info.wikidataQid === countryFilter
      })
    : ALL_INGEST_TAGS

  if (tagsToProcess.length === 0) {
    console.error(`No pipelines matched country filter: ${countryFilter}`)
    process.exit(1)
  }

  // Find sources eligible for enrichment (no existing PoliticalContext record)
  console.log('\nQuerying eligible sources...')
  const rawSources = await prisma.source.findMany({
    where: {
      ingestedBy: { in: tagsToProcess },
      deleted: false,
      politicalContext: null,
      publishedAt: { not: null },
    },
    select: {
      id: true,
      ingestedBy: true,
      publishedAt: true,
      externalId: true,
      name: true,
    },
    ...(limit > 0 ? { take: limit } : {}),
  })

  console.log(`Eligible sources: ${rawSources.length}`)
  if (rawSources.length === 0) {
    console.log('Nothing to enrich.')
    return
  }

  // Group by ingestedBy pipeline tag
  const byTag = new Map<string, typeof rawSources>()
  for (const s of rawSources) {
    const arr = byTag.get(s.ingestedBy) ?? []
    arr.push(s)
    byTag.set(s.ingestedBy, arr)
  }

  // Summary of work
  for (const [tag, sources] of Array.from(byTag)) {
    const info = LEGISLATION_PIPELINES[tag]
    console.log(`  ${tag} (${info?.country ?? '?'}): ${sources.length} sources`)
  }

  if (mode === 'dry-run') {
    // Fetch Wikidata for first country only as a spot-check
    const firstTag = Array.from(byTag.keys())[0]!
    const info = LEGISLATION_PIPELINES[firstTag]!
    console.log(`\nDry-run: fetching HoG terms for ${info.country} (${info.wikidataQid})...`)

    let hogTerms: HogTerm[] = []
    try {
      hogTerms = await fetchHogTerms(info)
      console.log(`  Found ${hogTerms.length} HoG terms`)
      hogTerms.slice(0, 5).forEach(t =>
        console.log(`  ${t.start.toISOString().slice(0, 10)} – ${t.end?.toISOString().slice(0, 10) ?? 'present'}: ${t.personLabel} (${t.partyLabel ?? 'no party'})`)
      )
    } catch (err) {
      console.error(`  Wikidata query failed: ${err}`)
    }

    const sampleSources = (byTag.get(firstTag) ?? []).slice(0, 10)
    const sample = sampleSources.map(s => {
      const matched = hogTerms.length > 0 && s.publishedAt
        ? matchHog(hogTerms, s.publishedAt)
        : null
      return {
        sourceId: s.id,
        externalId: s.externalId,
        country: info.country,
        enactmentDate: s.publishedAt?.toISOString().slice(0, 10),
        headOfGovernment: matched?.personLabel ?? null,
        hogParty: matched?.partyLabel ?? null,
        hogWikidataId: matched?.personQid ?? null,
      }
    })

    fs.writeFileSync(
      'enrich-political-context-dry-run.json',
      JSON.stringify({ runDate: new Date().toISOString(), eligibleSources: rawSources.length, byPipeline: Object.fromEntries(Array.from(byTag.entries()).map(([k, v]) => [k, v.length])), sample }, null, 2)
    )
    console.log('\nWritten: enrich-political-context-dry-run.json')
    console.log('\nDry-run complete. STOP — awaiting go-ahead before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  let totalEnriched = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const [tag, sources] of Array.from(byTag)) {
    const info = LEGISLATION_PIPELINES[tag]
    if (!info) {
      console.warn(`  Unknown pipeline tag: ${tag} — skipping`)
      continue
    }

    console.log(`\nProcessing ${info.country} (${tag}): ${sources.length} sources`)

    let hogTerms: HogTerm[] = []
    try {
      hogTerms = await fetchHogTerms(info)
      console.log(`  Wikidata: ${hogTerms.length} HoG terms found`)
      if (verbose && hogTerms.length > 0) {
        hogTerms.forEach(t =>
          console.log(`    ${t.start.toISOString().slice(0, 10)} – ${t.end?.toISOString().slice(0, 10) ?? 'present'}: ${t.personLabel}`)
        )
      }
    } catch (err) {
      console.error(`  Wikidata query failed for ${info.country}: ${err}`)
      console.error(`  Skipping all ${sources.length} sources for this country`)
      totalFailed += sources.length
      continue
    }

    let enriched = 0
    let skipped = 0
    let failed = 0

    for (const source of sources) {
      if (!source.publishedAt) { skipped++; continue }

      const matched = hogTerms.length > 0 ? matchHog(hogTerms, source.publishedAt) : null

      try {
        await prisma.politicalContext.create({
          data: {
            sourceId: source.id,
            country: info.country,
            enactmentDate: source.publishedAt,
            headOfGovernment: matched?.personLabel ?? null,
            hogParty: matched?.partyLabel ?? null,
            hogWikidataId: matched?.personQid ?? null,
            wikidataItemId: info.wikidataQid,
          },
        })
        enriched++
        if (verbose) console.log(`    [enriched] ${source.externalId ?? source.id} → ${matched?.personLabel ?? 'no match'}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('Unique constraint')) {
          skipped++
          if (verbose) console.log(`    [skipped] ${source.externalId ?? source.id}: already exists`)
        } else {
          console.error(`    [failed] ${source.externalId ?? source.id}: ${msg}`)
          failed++
        }
      }
    }

    console.log(`  ${info.country}: enriched=${enriched} skipped=${skipped} failed=${failed}`)
    totalEnriched += enriched
    totalSkipped += skipped
    totalFailed += failed
  }

  console.log('\n── Enrichment complete ──────────────────────────────────────────────────')
  console.log(`  Total enriched: ${totalEnriched}`)
  console.log(`  Total skipped:  ${totalSkipped}`)
  console.log(`  Total failed:   ${totalFailed}`)

  // DB verification
  const dbCount = await prisma.politicalContext.count()
  console.log(`\n  DB PoliticalContext rows: ${dbCount}`)
  console.log(`  Expected minimum: ${totalEnriched} (this run)`)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
