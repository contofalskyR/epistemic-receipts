// Enrichment: Wikidata Cross-Reference for Source records
// Links existing Source records to Wikidata Q-numbers via SPARQL.
// Enrichment only — never ingests Wikidata claims as HARD_FACT.
//
// Strategies by pipeline:
//   un_sc_resolutions_v1     → P3306 (UN document symbol) exact match — HIGH confidence
//   courtlistener_scotus_v1  → P5765 (CourtListener opinion ID) exact match — HIGH confidence
//   legislation pipelines    → title + jurisdiction SPARQL match — MEDIUM confidence
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-wikidata-crossref.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-wikidata-crossref.ts --full [--pipeline un_sc_resolutions_v1] [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

// ── Types ──────────────────────────────────────────────────────────────────────

interface SparqlBinding { value: string; type: string }
interface SparqlResult {
  results: { bindings: Array<Record<string, SparqlBinding>> }
}

interface WikidataMatch {
  sourceId: string
  externalId: string | null
  sourceName: string
  wikidataQid: string
  wikidataLabel: string | null
  matchMethod: string
  confidence: string
}

// ── Pipeline registry ─────────────────────────────────────────────────────────
// Maps ingestedBy tag → matching strategy

interface LegislationPipeline {
  countryQid: string   // Wikidata Q-number for the country
  countryLabel: string
  language: string     // preferred language for label matching
}

const LEGISLATION_PIPELINES: Record<string, LegislationPipeline> = {
  riksdag_v1:               { countryQid: 'Q34',   countryLabel: 'Sweden',           language: 'en' },
  tweedekamer_v1:           { countryQid: 'Q55',   countryLabel: 'Netherlands',       language: 'en' },
  bundestag_v1:             { countryQid: 'Q183',  countryLabel: 'Germany',           language: 'en' },
  nationalrat_v1:           { countryQid: 'Q40',   countryLabel: 'Austria',           language: 'en' },
  oireachtas_v1:            { countryQid: 'Q27',   countryLabel: 'Ireland',           language: 'en' },
  canada_bills_v1:          { countryQid: 'Q16',   countryLabel: 'Canada',            language: 'en' },
  uk_legislation_v1:        { countryQid: 'Q145',  countryLabel: 'United Kingdom',    language: 'en' },
  nz_legislation_v1:        { countryQid: 'Q664',  countryLabel: 'New Zealand',       language: 'en' },
  nz_repealed_acts_v1:      { countryQid: 'Q664',  countryLabel: 'New Zealand',       language: 'en' },
  nz_bills_v1:              { countryQid: 'Q664',  countryLabel: 'New Zealand',       language: 'en' },
  nz_local_acts_v1:         { countryQid: 'Q664',  countryLabel: 'New Zealand',       language: 'en' },
  scotland_legislation_v1:  { countryQid: 'Q22',   countryLabel: 'Scotland',          language: 'en' },
  wales_senedd_v1:          { countryQid: 'Q25',   countryLabel: 'Wales',             language: 'en' },
  australia_legislation_v1: { countryQid: 'Q408',  countryLabel: 'Australia',         language: 'en' },
  singapore_legislation_v1: { countryQid: 'Q334',  countryLabel: 'Singapore',         language: 'en' },
  iceland_legislation_v1:   { countryQid: 'Q189',  countryLabel: 'Iceland',           language: 'en' },
  finland_legislation_v1:   { countryQid: 'Q33',   countryLabel: 'Finland',           language: 'en' },
  portugal_legislation_v1:  { countryQid: 'Q45',   countryLabel: 'Portugal',          language: 'en' },
  taiwan_legislation_v1:    { countryQid: 'Q865',  countryLabel: 'Taiwan',            language: 'en' },
  south_africa_legislation_v1: { countryQid: 'Q258', countryLabel: 'South Africa',    language: 'en' },
  malaysia_legislation_v1:  { countryQid: 'Q833',  countryLabel: 'Malaysia',          language: 'en' },
  estonia_legislation_v1:   { countryQid: 'Q191',  countryLabel: 'Estonia',           language: 'en' },
  malta_legislation_v1:     { countryQid: 'Q233',  countryLabel: 'Malta',             language: 'en' },
  georgia_legislation_v1:   { countryQid: 'Q230',  countryLabel: 'Georgia',           language: 'en' },
  jamaica_legislation_v1:   { countryQid: 'Q766',  countryLabel: 'Jamaica',           language: 'en' },
  srilanka_legislation_v1:  { countryQid: 'Q854',  countryLabel: 'Sri Lanka',         language: 'en' },
  tt_legislation_v1:        { countryQid: 'Q754',  countryLabel: 'Trinidad and Tobago', language: 'en' },
  brunei_legislation_v1:    { countryQid: 'Q921',  countryLabel: 'Brunei',            language: 'en' },
  uruguay_legislation_v1:   { countryQid: 'Q77',   countryLabel: 'Uruguay',           language: 'en' },
  peru_legislation_v1:      { countryQid: 'Q419',  countryLabel: 'Peru',              language: 'en' },
  mexico_legislation_v1:    { countryQid: 'Q96',   countryLabel: 'Mexico',            language: 'en' },
  israel_knesset_v1:        { countryQid: 'Q801',  countryLabel: 'Israel',            language: 'en' },
  bangladesh_legislation_v1:{ countryQid: 'Q902',  countryLabel: 'Bangladesh',        language: 'en' },
  eu_parliament_v1:         { countryQid: 'Q458',  countryLabel: 'European Union',    language: 'en' },
  eu_legislation_v1:        { countryQid: 'Q458',  countryLabel: 'European Union',    language: 'en' },
}

// Pipelines handled by dedicated exact-match strategies
const DEDICATED_PIPELINES = ['un_sc_resolutions_v1', 'courtlistener_scotus_v1', 'nobel_v1']

// All supported pipelines
const ALL_PIPELINES = [...DEDICATED_PIPELINES, ...Object.keys(LEGISLATION_PIPELINES)]

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --full [--pipeline <tag>] [--limit N] [--verbose]')
        process.exit(1) as never
      })()

  const pi = args.indexOf('--pipeline')
  const li = args.indexOf('--limit')
  return {
    mode: mode as 'dry-run' | 'full',
    pipelineFilter: pi !== -1 ? (args[pi + 1] ?? null) : null,
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
  }
}

// ── Rate limiter ──────────────────────────────────────────────────────────────

let lastSparqlAt = 0

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function sparqlThrottle() {
  const wait = 1200 - (Date.now() - lastSparqlAt)
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
      if (!res.ok) throw new Error(`Wikidata SPARQL HTTP ${res.status}`)
      return res.json() as Promise<SparqlResult>
    } catch (err) {
      if (attempt < retries) {
        console.warn(`  Wikidata error (attempt ${attempt + 1}): ${err} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
      } else { throw err }
    }
  }
  throw new Error('Wikidata SPARQL failed after retries')
}

function qid(url: string): string {
  return url.replace('http://www.wikidata.org/entity/', '')
}

// ── Strategy 1: UN SC Resolutions via label matching ─────────────────────────
// Wikidata labels for UNSC resolution items follow the pattern
// "United Nations Security Council Resolution N". We extract N from our
// externalId (format: "S/RES/{N}({year})") and match locally.

async function matchUnscResolutions(
  sources: Array<{ id: string; externalId: string | null; name: string }>,
  verbose: boolean
): Promise<WikidataMatch[]> {
  console.log(`\nStrategy: UN SC Resolutions via label matching (${sources.length} sources)`)

  // Build a map from resolution number → source
  const numToSource = new Map<string, { id: string; externalId: string | null; name: string }>()
  for (const source of sources) {
    const m = (source.externalId ?? '').match(/^S\/RES\/(\d+)\(/)
    if (m) numToSource.set(m[1]!, source)
  }
  if (numToSource.size === 0) {
    console.log('  No parseable UNSC resolution IDs')
    return []
  }

  // Bulk fetch all UNSC resolution items — filter to English labels starting with
  // "United Nations Security Council" to avoid non-resolution items in the class.
  console.log(`  Fetching UNSC resolution Q-numbers from Wikidata (${numToSource.size} IDs in DB)...`)
  const sparql = `
SELECT ?item ?lbl WHERE {
  ?item wdt:P31 wd:Q189760 .
  ?item rdfs:label ?lbl .
  FILTER(LANG(?lbl) = "en")
  FILTER(STRSTARTS(LCASE(?lbl), "united nations security council resolution"))
}
LIMIT 10000
`
  const data = await queryWikidata(sparql)
  // Build map: resolution number → {qid, label}
  const numToQid = new Map<string, { qid: string; label: string }>()
  for (const row of data.results.bindings) {
    const itemQid = row.item?.value ? qid(row.item.value) : null
    const label = row.lbl?.value ?? ''
    if (!itemQid) continue
    // Extract trailing number from label: "United Nations Security Council Resolution 1244"
    const m = label.match(/(\d+)\s*$/)
    if (m) numToQid.set(m[1]!, { qid: itemQid, label })
  }
  console.log(`  Wikidata returned ${numToQid.size} labeled UNSC resolution items`)

  const matches: WikidataMatch[] = []
  for (const [num, source] of numToSource) {
    const entry = numToQid.get(num)
    if (entry) {
      matches.push({
        sourceId: source.id,
        externalId: source.externalId,
        sourceName: source.name,
        wikidataQid: entry.qid,
        wikidataLabel: entry.label,
        matchMethod: 'unsc_resolution_number',
        confidence: 'high',
      })
      if (verbose) console.log(`    [match] S/RES/${num} → ${entry.qid} (${entry.label})`)
    }
  }
  console.log(`  Matched: ${matches.length} / ${sources.length}`)
  return matches
}

// ── Strategy 2: SCOTUS via P5765 (CourtListener opinion ID) ──────────────────
// Our externalId format is "cl-source-<opinionId>"; extract the numeric ID.

async function matchScotusCourtlistener(
  sources: Array<{ id: string; externalId: string | null; name: string }>,
  verbose: boolean
): Promise<WikidataMatch[]> {
  console.log(`\nStrategy: SCOTUS via P5765 CourtListener opinion ID (${sources.length} sources)`)

  // Build a map of CourtListener opinion IDs → source records
  const clIdToSource = new Map<string, { id: string; externalId: string | null; name: string }>()
  for (const source of sources) {
    const ext = source.externalId ?? ''
    // externalId format: "cl-source-111719"
    const match = ext.match(/^cl-source-(\d+)$/)
    if (match) clIdToSource.set(match[1]!, source)
  }
  if (clIdToSource.size === 0) {
    console.log('  No parseable CourtListener IDs found — skipping')
    return []
  }
  console.log(`  ${clIdToSource.size} sources have parseable CourtListener IDs`)

  // Bulk fetch SCOTUS items with P5765
  console.log('  Fetching SCOTUS items from Wikidata via P5765...')
  const sparql = `
SELECT ?item ?itemLabel ?clId WHERE {
  ?item wdt:P5765 ?clId .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`
  const data = await queryWikidata(sparql)
  const clMap = new Map<string, { qid: string; label: string }>()
  for (const row of data.results.bindings) {
    const clId = row.clId?.value
    const itemQid = row.item?.value ? qid(row.item.value) : null
    const label = row.itemLabel?.value ?? ''
    if (clId && itemQid) clMap.set(clId, { qid: itemQid, label })
  }
  console.log(`  Wikidata returned ${clMap.size} items with P5765`)

  const matches: WikidataMatch[] = []
  for (const [clId, entry] of clMap) {
    const source = clIdToSource.get(clId)
    if (source) {
      matches.push({
        sourceId: source.id,
        externalId: source.externalId,
        sourceName: source.name,
        wikidataQid: entry.qid,
        wikidataLabel: entry.label,
        matchMethod: 'p5765_courtlistener',
        confidence: 'high',
      })
      if (verbose) console.log(`    [match] cl-${clId} → ${entry.qid} (${entry.label})`)
    }
  }
  console.log(`  Matched: ${matches.length} / ${sources.length}`)
  return matches
}

// ── Strategy 3: Nobel Prizes ──────────────────────────────────────────────────
// Nobel items in Wikidata: instance of Q7191 (Nobel Prize). Match by year + category.
// Our externalId format: "nobel-source-med-2025", "nobel-source-physics-2024" etc.

async function matchNobelPrizes(
  sources: Array<{ id: string; externalId: string | null; name: string }>,
  verbose: boolean
): Promise<WikidataMatch[]> {
  console.log(`\nStrategy: Nobel Prizes (${sources.length} sources)`)

  // Category mapping between our tags and Wikidata Nobel Prize categories
  const CATEGORY_QID: Record<string, string> = {
    physics:    'Q38104',  // Nobel Prize in Physics
    chemistry:  'Q44585',  // Nobel Prize in Chemistry
    med:        'Q80061',  // Nobel Prize in Physiology or Medicine
    literature: 'Q37922',  // Nobel Prize in Literature
    peace:      'Q35637',  // Nobel Peace Prize
    economics:  'Q8343',   // Nobel Memorial Prize in Economic Sciences
  }

  // Parse our externalIds: "nobel-source-{category}-{year}"
  const idToSource = new Map<string, { id: string; externalId: string | null; name: string; category: string; year: string }>()
  for (const source of sources) {
    const ext = source.externalId ?? ''
    const m = ext.match(/^nobel-source-([a-z]+)-(\d{4})$/)
    if (m) {
      idToSource.set(ext, { ...source, category: m[1]!, year: m[2]! })
    }
  }
  if (idToSource.size === 0) {
    console.log('  No parseable Nobel IDs — skipping')
    return []
  }

  // Build lookup: "{category}-{year}" → Wikidata item
  const categoryYearToQid = new Map<string, { qid: string; label: string }>()

  // Query: Nobel Prizes by category and year (P585 = point in time)
  const sparql = `
SELECT ?item ?itemLabel ?year ?category WHERE {
  ?item wdt:P31 ?category .
  VALUES ?category { wd:Q38104 wd:Q44585 wd:Q80061 wd:Q37922 wd:Q35637 wd:Q8343 }
  ?item wdt:P585 ?yearDt .
  BIND(YEAR(?yearDt) AS ?year)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`
  const data = await queryWikidata(sparql)
  for (const row of data.results.bindings) {
    const itemQid = row.item?.value ? qid(row.item.value) : null
    const catQid = row.category?.value ? qid(row.category.value) : null
    const year = row.year?.value
    const label = row.itemLabel?.value ?? ''
    if (!itemQid || !catQid || !year) continue

    // Reverse-map catQid to our category tag
    const catTag = Object.entries(CATEGORY_QID).find(([, q]) => q === catQid)?.[0]
    if (catTag) {
      categoryYearToQid.set(`${catTag}-${year}`, { qid: itemQid, label })
    }
  }
  console.log(`  Wikidata returned ${categoryYearToQid.size} Nobel Prize year+category items`)

  const matches: WikidataMatch[] = []
  for (const [ext, sourceInfo] of idToSource) {
    const key = `${sourceInfo.category}-${sourceInfo.year}`
    const entry = categoryYearToQid.get(key)
    if (entry) {
      matches.push({
        sourceId: sourceInfo.id,
        externalId: ext,
        sourceName: sourceInfo.name,
        wikidataQid: entry.qid,
        wikidataLabel: entry.label,
        matchMethod: 'nobel_category_year',
        confidence: 'high',
      })
      if (verbose) console.log(`    [match] ${ext} → ${entry.qid} (${entry.label})`)
    }
  }
  console.log(`  Matched: ${matches.length} / ${sources.length}`)
  return matches
}

// ── Strategy 4: Legislation by title + jurisdiction ───────────────────────────
// Per country: bulk-fetch Wikidata legislation items for that country,
// then do local normalized title matching. Only exact normalized matches accepted.

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
}

// Pipelines whose names are just reference numbers — skip title matching entirely.
const SKIP_TITLE_MATCH = new Set([
  'riksdag_v1', 'tweedekamer_v1', 'bundestag_v1', 'nationalrat_v1',
  'uk_legislation_v1', 'scotland_legislation_v1', 'nz_legislation_v1',
  'nz_repealed_acts_v1', 'nz_bills_v1', 'nz_local_acts_v1',
  'canada_bills_v1', 'australia_legislation_v1', 'finland_legislation_v1',
  'portugal_legislation_v1', 'taiwan_legislation_v1', 'mexico_legislation_v1',
  'bangladesh_legislation_v1', 'eu_parliament_v1', 'eu_legislation_v1',
  'oireachtas_v1', 'iceland_legislation_v1', 'peru_legislation_v1',
  'uruguay_legislation_v1', 'brunei_legislation_v1', 'tt_legislation_v1',
])

// Extract a clean title from our source name for title-based matching.
// Returns empty string for pipelines whose names are just opaque reference numbers.
function extractTitle(name: string, pipelineTag: string): string {
  if (SKIP_TITLE_MATCH.has(pipelineTag)) return ''

  // Jamaica: "Laws of Jamaica — The Road Traffic Act" → "Road Traffic Act"
  const jamaicaM = name.match(/^Laws of Jamaica\s*[—-]+\s*(?:The\s+)?(.+)$/)
  if (jamaicaM) return jamaicaM[1]!.trim()

  // Georgia: "Matsne (Georgia) — LAW OF GEORGIA ON FACTORING" → "Law On Factoring"
  // Also: "Matsne (Georgia) — LAW OF GEORGIA FOREIGN AGENTS REGISTRATION ACT"
  const georgiaM = name.match(/^Matsne \(Georgia\)\s*[—-]+\s*(?:LAW OF GEORGIA\s+(?:ON\s+)?)?(.+)$/)
  if (georgiaM) return georgiaM[1]!.trim()

  // Singapore: "Singapore Statutes — Accountants Act 2004" → "Accountants Act 2004"
  const singaporeM = name.match(/^Singapore Statutes\s*[—-]+\s*(.+)$/)
  if (singaporeM) return singaporeM[1]!.trim()

  // Malta: "Laws of Malta — Kostituzzjoni ta' Malta" → skip (Maltese)
  if (name.startsWith('Laws of Malta')) return ''

  // Estonia: likely in Estonian — skip
  if (pipelineTag === 'estonia_legislation_v1') return ''

  // Malaysia: "Malaysia Laws — ..." — try stripping prefix
  const malaysiaM = name.match(/^(?:Malaysia[^——]*)[——]\s*(.+)$/)
  if (malaysiaM && pipelineTag === 'malaysia_legislation_v1') return malaysiaM[1]!.trim()

  // South Africa: "South Africa — ..." — try stripping
  const saM = name.match(/^South Africa[\s——:]+(.+)$/)
  if (saM && pipelineTag === 'south_africa_legislation_v1') return saM[1]!.trim()

  // Israel: names might be in Hebrew or English
  if (pipelineTag === 'israel_knesset_v1') return ''

  // Sri Lanka: check format
  const slM = name.match(/^(?:Sri Lanka[\s——:]+)?(.+Act.*)$/)
  if (slM && pipelineTag === 'srilanka_legislation_v1') return slM[1]!.trim()

  // Wales: "Senedd Cymru — ..." → strip prefix
  const walesM = name.match(/^(?:Senedd Cymru|Welsh Parliament)\s*[——]\s*(.+)$/)
  if (walesM) return walesM[1]!.trim()

  // Generic fallback: anything that looks like "Xxx Act YYYY" is usable
  if (/\bAct\b/.test(name) && !/^\w+ \d/.test(name)) return name.trim()

  return ''
}

async function matchLegislationByTitle(
  tag: string,
  info: LegislationPipeline,
  sources: Array<{ id: string; externalId: string | null; name: string }>,
  verbose: boolean
): Promise<WikidataMatch[]> {
  console.log(`\n  ${tag} (${info.countryLabel}): ${sources.length} sources`)

  // Build a set of normalized source titles to match against
  const titleToSources = new Map<string, Array<{ id: string; externalId: string | null; name: string }>>()
  let skippedGeneric = 0
  for (const source of sources) {
    const title = extractTitle(source.name, tag)
    if (!title || title.length < 8) { skippedGeneric++; continue }
    const norm = normalizeTitle(title)
    const arr = titleToSources.get(norm) ?? []
    arr.push(source)
    titleToSources.set(norm, arr)
  }
  if (titleToSources.size === 0) {
    console.log(`    No matchable titles (${skippedGeneric} generic names skipped)`)
    return []
  }
  console.log(`    ${titleToSources.size} unique normalized titles (${skippedGeneric} generic skipped)`)

  // Query Wikidata for legislation items from this country.
  // Use multiple candidate classes via UNION to maximize coverage:
  //   Q820655 = statute | Q1137377 = act of parliament | Q49371 = legislation
  const sparql = `
SELECT DISTINCT ?item ?lbl WHERE {
  ?item wdt:P17 wd:${info.countryQid} .
  { ?item wdt:P31/wdt:P279* wd:Q820655 } UNION
  { ?item wdt:P31 wd:Q1137377 } UNION
  { ?item wdt:P31 wd:Q49371 }
  ?item rdfs:label ?lbl .
  FILTER(LANG(?lbl) = "${info.language}")
}
LIMIT 5000
`
  const wikidataItems: Array<{ qid: string; label: string }> = []
  try {
    const data = await queryWikidata(sparql)
    const seen = new Set<string>()
    for (const row of data.results.bindings) {
      const itemQid = row.item?.value ? qid(row.item.value) : null
      const label = row.lbl?.value ?? ''
      if (itemQid && label && !seen.has(itemQid)) {
        wikidataItems.push({ qid: itemQid, label })
        seen.add(itemQid)
      }
    }
  } catch (err) {
    console.warn(`    Wikidata SPARQL failed for ${info.countryLabel}: ${err}`)
    return []
  }
  console.log(`    Wikidata returned ${wikidataItems.length} legislation items`)
  if (wikidataItems.length === 0) return []

  // Build Wikidata lookup by normalized title
  const wdByTitle = new Map<string, { qid: string; label: string }>()
  for (const item of wikidataItems) {
    const norm = normalizeTitle(item.label)
    if (norm) wdByTitle.set(norm, item)  // last one wins on collision
  }

  const matches: WikidataMatch[] = []
  for (const [norm, sourcesForTitle] of titleToSources) {
    const wdEntry = wdByTitle.get(norm)
    if (!wdEntry) continue
    // Only link the first source when titles collide (shouldn't be common)
    const source = sourcesForTitle[0]!
    matches.push({
      sourceId: source.id,
      externalId: source.externalId,
      sourceName: source.name,
      wikidataQid: wdEntry.qid,
      wikidataLabel: wdEntry.label,
      matchMethod: 'title_jurisdiction',
      confidence: 'medium',
    })
    if (verbose) console.log(`    [match] "${source.name}" → ${wdEntry.qid}`)
  }
  console.log(`    Matched: ${matches.length} / ${sources.length}`)
  return matches
}

// ── Write matches to DB ───────────────────────────────────────────────────────

async function writeMatches(matches: WikidataMatch[], verbose: boolean): Promise<{ written: number; skipped: number; failed: number }> {
  let written = 0, skipped = 0, failed = 0
  for (const m of matches) {
    try {
      await prisma.wikidataLink.create({
        data: {
          sourceId: m.sourceId,
          wikidataQid: m.wikidataQid,
          wikidataLabel: m.wikidataLabel,
          matchMethod: m.matchMethod,
          confidence: m.confidence,
        },
      })
      written++
      if (verbose) console.log(`  [written] ${m.externalId ?? m.sourceId} → ${m.wikidataQid}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Unique constraint')) {
        skipped++
        if (verbose) console.log(`  [skipped] ${m.externalId ?? m.sourceId}: already linked`)
      } else {
        console.error(`  [failed] ${m.externalId ?? m.sourceId}: ${msg}`)
        failed++
      }
    }
  }
  return { written, skipped, failed }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, pipelineFilter, limit, verbose } = parseArgs()
  console.log('\n── Enrich: Wikidata Cross-Reference ─────────────────────────────────────')
  console.log(`Mode: ${mode} | Pipeline filter: ${pipelineFilter ?? 'all'} | Limit: ${limit || 'all'}`)

  // Determine which pipelines to process
  const pipelines = pipelineFilter
    ? ALL_PIPELINES.filter(p => p === pipelineFilter || p.includes(pipelineFilter))
    : ALL_PIPELINES

  if (pipelines.length === 0) {
    console.error(`No pipelines matched: ${pipelineFilter}`)
    process.exit(1)
  }
  console.log(`Processing ${pipelines.length} pipeline(s): ${pipelines.slice(0, 5).join(', ')}${pipelines.length > 5 ? '...' : ''}`)

  // Fetch all eligible sources (no existing WikidataLink)
  console.log('\nQuerying eligible sources...')
  const rawSources = await prisma.source.findMany({
    where: {
      ingestedBy: { in: pipelines },
      deleted: false,
      wikidataLink: null,  // not yet linked
    },
    select: { id: true, ingestedBy: true, name: true, externalId: true },
    ...(limit > 0 ? { take: limit } : {}),
  })

  // Group by pipeline
  const byPipeline = new Map<string, typeof rawSources>()
  for (const s of rawSources) {
    const arr = byPipeline.get(s.ingestedBy) ?? []
    arr.push(s)
    byPipeline.set(s.ingestedBy, arr)
  }

  console.log(`Eligible sources: ${rawSources.length} across ${byPipeline.size} pipeline(s)`)
  for (const [tag, sources] of byPipeline) {
    console.log(`  ${tag}: ${sources.length} sources`)
  }

  if (rawSources.length === 0) {
    console.log('Nothing to enrich.')
    return
  }

  // ── Dry-run: run first 3 pipelines as spot-check ─────────────────────────
  if (mode === 'dry-run') {
    const dryPipelines = Array.from(byPipeline.keys()).slice(0, 3)
    const allMatches: WikidataMatch[] = []

    for (const tag of dryPipelines) {
      const sources = (byPipeline.get(tag) ?? []).slice(0, 200) // cap per-pipeline in dry-run

      if (tag === 'un_sc_resolutions_v1') {
        allMatches.push(...await matchUnscResolutions(sources, verbose))
      } else if (tag === 'courtlistener_scotus_v1') {
        allMatches.push(...await matchScotusCourtlistener(sources, verbose))
      } else if (tag === 'nobel_v1') {
        allMatches.push(...await matchNobelPrizes(sources, verbose))
      } else {
        const info = LEGISLATION_PIPELINES[tag]
        if (info) allMatches.push(...await matchLegislationByTitle(tag, info, sources, verbose))
      }
    }

    const outPath = 'enrich-wikidata-crossref-dry-run.json'
    fs.writeFileSync(outPath, JSON.stringify({
      runDate: new Date().toISOString(),
      mode: 'dry-run',
      eligibleTotal: rawSources.length,
      byPipeline: Object.fromEntries(Array.from(byPipeline.entries()).map(([k, v]) => [k, v.length])),
      spotCheckPipelines: dryPipelines,
      matchCount: allMatches.length,
      matchRate: allMatches.length > 0
        ? `${((allMatches.length / dryPipelines.reduce((s, t) => s + Math.min((byPipeline.get(t) ?? []).length, 200), 0)) * 100).toFixed(1)}%`
        : '0%',
      sample: allMatches.slice(0, 30),
    }, null, 2))
    console.log(`\nWritten: ${outPath}`)
    console.log(`\nDry-run complete. Matches found: ${allMatches.length}`)
    console.log('STOP — review output file before running --full.')
    return
  }

  // ── Full run ──────────────────────────────────────────────────────────────
  let totalWritten = 0, totalSkipped = 0, totalFailed = 0

  for (const [tag, sources] of byPipeline) {
    let matches: WikidataMatch[] = []

    if (tag === 'un_sc_resolutions_v1') {
      matches = await matchUnscResolutions(sources, verbose)
    } else if (tag === 'courtlistener_scotus_v1') {
      matches = await matchScotusCourtlistener(sources, verbose)
    } else if (tag === 'nobel_v1') {
      matches = await matchNobelPrizes(sources, verbose)
    } else {
      const info = LEGISLATION_PIPELINES[tag]
      if (!info) {
        console.warn(`Unknown pipeline: ${tag} — skipping`)
        continue
      }
      matches = await matchLegislationByTitle(tag, info, sources, verbose)
    }

    if (matches.length === 0) {
      console.log(`  No matches for ${tag} — skipping write`)
      continue
    }

    console.log(`  Writing ${matches.length} matches for ${tag}...`)
    const { written, skipped, failed } = await writeMatches(matches, verbose)
    console.log(`  ${tag}: written=${written} skipped=${skipped} failed=${failed}`)
    totalWritten += written
    totalSkipped += skipped
    totalFailed += failed
  }

  console.log('\n── Enrichment complete ──────────────────────────────────────────────────')
  console.log(`  Total written:  ${totalWritten}`)
  console.log(`  Total skipped:  ${totalSkipped}`)
  console.log(`  Total failed:   ${totalFailed}`)

  const dbCount = await prisma.wikidataLink.count()
  console.log(`\n  DB WikidataLink rows: ${dbCount}`)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
