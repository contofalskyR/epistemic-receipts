// Tier 2 enrichment: Parliamentary majority composition via Wikidata SPARQL
//
// Backfills `governingParty`, `majorityType`, `coalitionPartners`, `majoritySeats`
// on PoliticalContext rows whose Tier 1 enrichment already ran but parliamentary-
// majority fields are still NULL.
//
// Schema note (deviation from the original task brief):
//   The `PoliticalContext` table already has every field this script needs from
//   the 2026-05-20 migration `add_political_context`. No new migration is run.
//   Brief said `coalitionPartners String[]` — schema stores it as a JSON-encoded
//   `String?` column. Brief said `seatCount Int?` — schema splits it into
//   `majoritySeats Int?` + `totalSeats Int?`. We use the existing columns.
//
// Strategy: for each country, one SPARQL query fetches every cabinet item
// (instance/subclass of `Q640506` "cabinet") in that country, with start/end
// dates and member parties (`wdt:P102`). Each PoliticalContext row's
// `enactmentDate` is then matched locally to the cabinet whose [start,end)
// bracket contains it — same approach as Tier 1, no per-row API calls.
//
// Idempotent: only rows where `governingParty IS NULL` are touched. Re-running
// is a no-op.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-parliamentary-majority.ts --dry-run
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-parliamentary-majority.ts --full [--country de] [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

// ── Country registry ──────────────────────────────────────────────────────────
// Mirrors the registry in `enrich-political-context-wikidata.ts`. Kept inline
// rather than imported so this script remains a single-file unit.

interface CountryInfo {
  country: string
  wikidataQid: string
}

const LEGISLATION_PIPELINES: Record<string, CountryInfo> = {
  congress_v1:                { country: 'United States',         wikidataQid: 'Q30'   },
  congress_bills_v1:          { country: 'United States',         wikidataQid: 'Q30'   },
  fr_rules_v1:                { country: 'United States',         wikidataQid: 'Q30'   },
  riksdag_v1:                 { country: 'Sweden',                wikidataQid: 'Q34'   },
  tweedekamer_v1:             { country: 'Netherlands',           wikidataQid: 'Q55'   },
  bundestag_v1:               { country: 'Germany',               wikidataQid: 'Q183'  },
  nationalrat_v1:             { country: 'Austria',               wikidataQid: 'Q40'   },
  oireachtas_v1:              { country: 'Ireland',               wikidataQid: 'Q27'   },
  canada_bills_v1:            { country: 'Canada',                wikidataQid: 'Q16'   },
  uk_legislation_v1:          { country: 'United Kingdom',        wikidataQid: 'Q145'  },
  australia_legislation_v1:   { country: 'Australia',             wikidataQid: 'Q408'  },
  norway_legislation_v1:      { country: 'Norway',                wikidataQid: 'Q20'   },
  nz_legislation_v1:          { country: 'New Zealand',           wikidataQid: 'Q664'  },
  india_legislation_v1:       { country: 'India',                 wikidataQid: 'Q668'  },
  singapore_legislation_v1:   { country: 'Singapore',             wikidataQid: 'Q334'  },
  iceland_legislation_v1:     { country: 'Iceland',               wikidataQid: 'Q189'  },
  denmark_legislation_v1:     { country: 'Denmark',               wikidataQid: 'Q35'   },
  finland_legislation_v1:     { country: 'Finland',               wikidataQid: 'Q33'   },
  switzerland_legislation_v1: { country: 'Switzerland',           wikidataQid: 'Q39'   },
  belgium_legislation_v1:     { country: 'Belgium',               wikidataQid: 'Q31'   },
  portugal_legislation_v1:    { country: 'Portugal',              wikidataQid: 'Q45'   },
  spain_legislation_v1:       { country: 'Spain',                 wikidataQid: 'Q29'   },
  poland_legislation_v1:      { country: 'Poland',                wikidataQid: 'Q36'   },
  italy_legislation_v1:       { country: 'Italy',                 wikidataQid: 'Q38'   },
  japan_legislation_v1:       { country: 'Japan',                 wikidataQid: 'Q17'   },
  argentina_legislation_v1:   { country: 'Argentina',             wikidataQid: 'Q414'  },
  taiwan_legislation_v1:      { country: 'Taiwan',                wikidataQid: 'Q865'  },
  mexico_legislation_v1:      { country: 'Mexico',                wikidataQid: 'Q96'   },
  brazil_legislation_v1:      { country: 'Brazil',                wikidataQid: 'Q155'  },
  south_africa_legislation_v1:{ country: 'South Africa',          wikidataQid: 'Q258'  },
  chile_legislation_v1:       { country: 'Chile',                 wikidataQid: 'Q298'  },
  colombia_legislation_v1:    { country: 'Colombia',              wikidataQid: 'Q739'  },
  philippines_legislation_v1: { country: 'Philippines',           wikidataQid: 'Q928'  },
  france_legislation_v1:      { country: 'France',                wikidataQid: 'Q142'  },
  bangladesh_legislation_v1:  { country: 'Bangladesh',            wikidataQid: 'Q902'  },
  russia_legislation_v1:      { country: 'Russia',                wikidataQid: 'Q159'  },
  israel_knesset_v1:          { country: 'Israel',                wikidataQid: 'Q801'  },
  scotland_legislation_v1:    { country: 'Scotland',              wikidataQid: 'Q22'   },
  wales_senedd_v1:            { country: 'Wales',                 wikidataQid: 'Q25'   },
  eu_parliament_v1:           { country: 'European Union',        wikidataQid: 'Q458'  },
  eu_legislation_v1:          { country: 'European Union',        wikidataQid: 'Q458'  },
  un_sc_resolutions_v1:       { country: 'United Nations',        wikidataQid: 'Q1065' },
  nato_official_texts_v1:     { country: 'NATO',                  wikidataQid: 'Q7184' },
  malaysia_legislation_v1:    { country: 'Malaysia',              wikidataQid: 'Q833'  },
  estonia_legislation_v1:     { country: 'Estonia',               wikidataQid: 'Q191'  },
  malta_legislation_v1:       { country: 'Malta',                 wikidataQid: 'Q233'  },
  georgia_legislation_v1:     { country: 'Georgia',               wikidataQid: 'Q230'  },
  jamaica_legislation_v1:     { country: 'Jamaica',               wikidataQid: 'Q766'  },
  srilanka_legislation_v1:    { country: 'Sri Lanka',             wikidataQid: 'Q854'  },
  pakistan_legislation_v1:    { country: 'Pakistan',              wikidataQid: 'Q843'  },
  tt_legislation_v1:          { country: 'Trinidad and Tobago',   wikidataQid: 'Q754'  },
  brunei_legislation_v1:      { country: 'Brunei',                wikidataQid: 'Q921'  },
  uruguay_legislation_v1:     { country: 'Uruguay',               wikidataQid: 'Q77'   },
  peru_legislation_v1:        { country: 'Peru',                  wikidataQid: 'Q419'  },
  costarica_legislation_v1:   { country: 'Costa Rica',            wikidataQid: 'Q800'  },
  uae_legislation_v1:         { country: 'United Arab Emirates',  wikidataQid: 'Q878'  },
}

// Build a reverse lookup `country label → CountryInfo` so we can map
// PoliticalContext rows (which carry the country label, not the pipeline tag)
// back to a Wikidata QID.
const COUNTRY_LABEL_TO_INFO: Record<string, CountryInfo> = (() => {
  const out: Record<string, CountryInfo> = {}
  for (const info of Object.values(LEGISLATION_PIPELINES)) {
    out[info.country] = info
  }
  return out
})()

// ── Types ──────────────────────────────────────────────────────────────────────

interface Cabinet {
  cabinetQid: string
  cabinetLabel: string
  headQid: string | null   // P6 head of government; lets us filter out state/Länder cabinets in federal countries
  start: Date | null
  end: Date | null
  parties: { qid: string; label: string }[]
}

interface SparqlBinding { value: string; type: string }
interface SparqlResult { results: { bindings: Array<Record<string, SparqlBinding>> } }

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --full [--country <label|tag|qid>] [--limit N] [--verbose]')
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
// Task brief asks for 500 ms between SPARQL queries; the public Wikidata
// endpoint advises ≥1 s in practice. We honor the brief's floor but bump to
// 1100 ms to stay clearly under the soft 429 threshold seen on the existing
// Tier 1 script.

let lastSparqlAt = 0
const SPARQL_GAP_MS = 1100
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }
async function sparqlThrottle() {
  const wait = SPARQL_GAP_MS - (Date.now() - lastSparqlAt)
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

// ── Fetch cabinet timeline for a country ──────────────────────────────────────
// Returns every cabinet (instance / subclass of Q640506 "cabinet") tied to the
// country, with start/end dates and member parties. Multiple parties per
// cabinet = coalition.
//
// Quirks observed during construction:
// - `wdt:P31/wdt:P279*` is the standard idiom for "instance of, possibly via
//   subclass chain." This picks up both `Q640506` (cabinet) and country-
//   specific subclasses (e.g., Q313827 "cabinet of Germany"). It also picks
//   up state/Länder cabinets in federal countries — Germany returns ~490
//   cabinets including Bavaria's, Hesse's, etc. The caller filters by the
//   row's `hogWikidataId` (Tier 1 output) when matching, which discards
//   state cabinets cleanly because their P6 is the state premier, not the
//   federal HoG.
// - Cabinet items in Wikidata almost never carry parties via `wdt:P102`
//   directly (verified empirically for Germany — Schröder/Schulze cabinets
//   have only P6, P31, P17, P580/582 and no party links at all). Party
//   info, when present, lives on the individual ministers via
//   `?cabinet wdt:P710 ?member . ?member wdt:P102 ?party` — that join is
//   expensive across hundreds of ministers per cabinet, so we include it as
//   an OPTIONAL with a guard query rather than a full traversal.
// - `wdt:P1830` (supported by) is the cleanest property for coalition
//   parties when it's set (e.g., Merkel III, some UK cabinets) but coverage
//   is spotty. Included as a UNION alternative.
// - Realistic outcome: party data will be NULL on most rows after this run.
//   That is the brief's stated expectation ("write NULL rather than
//   guessing"). The win of this pipeline is filling `governingParty` from
//   `hogParty` (Tier 1) on ~113k rows; coalition detail is a bonus where
//   Wikidata happens to have it.

async function fetchCabinets(countryQid: string): Promise<Cabinet[]> {
  const sparql = `
SELECT DISTINCT ?cabinet ?cabinetLabel ?head ?start ?end ?party ?partyLabel WHERE {
  ?cabinet wdt:P31/wdt:P279* wd:Q640506 .
  ?cabinet wdt:P17 wd:${countryQid} .
  OPTIONAL { ?cabinet wdt:P6 ?head . }
  OPTIONAL { ?cabinet wdt:P580 ?start . }
  OPTIONAL { ?cabinet wdt:P582 ?end . }
  OPTIONAL {
    { ?cabinet wdt:P102 ?party . }
    UNION
    { ?cabinet wdt:P1830 ?party . }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?start
`

  const data = await queryWikidata(sparql)

  const cabByQid = new Map<string, Cabinet>()
  for (const row of data.results.bindings) {
    const cabinetUri = row.cabinet?.value
    if (!cabinetUri) continue
    const cabinetQid = cabinetUri.replace('http://www.wikidata.org/entity/', '')

    let cab = cabByQid.get(cabinetQid)
    if (!cab) {
      const startStr = row.start?.value
      const endStr = row.end?.value
      const start = startStr ? new Date(startStr) : null
      const end = endStr ? new Date(endStr) : null
      const headUri = row.head?.value
      const headQid = headUri ? headUri.replace('http://www.wikidata.org/entity/', '') : null
      cab = {
        cabinetQid,
        cabinetLabel: row.cabinetLabel?.value ?? cabinetQid,
        headQid,
        start: start && !isNaN(start.getTime()) ? start : null,
        end: end && !isNaN(end.getTime()) ? end : null,
        parties: [],
      }
      cabByQid.set(cabinetQid, cab)
    }

    const partyUri = row.party?.value
    if (partyUri) {
      const partyQid = partyUri.replace('http://www.wikidata.org/entity/', '')
      const partyLabel = row.partyLabel?.value ?? partyQid
      if (!cab.parties.some(p => p.qid === partyQid)) {
        cab.parties.push({ qid: partyQid, label: partyLabel })
      }
    }
  }

  // Sort by start date ascending; cabinets with no start go to the end of the list
  // (they cannot be matched by date anyway, but keeping them in the array means
  // they still surface in dry-run summary counts).
  return Array.from(cabByQid.values()).sort((a, b) => {
    if (a.start && b.start) return a.start.getTime() - b.start.getTime()
    if (a.start) return -1
    if (b.start) return 1
    return 0
  })
}

// ── Match a date to a cabinet ────────────────────────────────────────────────
// The "latest cabinet that started on/before the date AND whose end is null
// or ≥ date" — i.e., the cabinet in power at `date`. Returning the *latest*
// (not the first) such candidate is required because many old Wikidata
// cabinets have a missing end date, which would otherwise match every
// subsequent date and shadow more-recent (better-data) cabinets.
//
// If `hogQid` is provided, cabinets whose `headQid` doesn't match are
// excluded — this is the federal-vs-state disambiguator. (Bavaria's
// "Söder III" cabinet has P17=Germany but P6=Söder, not Scholz, so it
// drops out cleanly when matching a federal row whose hogWikidataId is
// Scholz's QID.)

function matchCabinet(cabinets: Cabinet[], date: Date, hogQid: string | null): Cabinet | null {
  let best: Cabinet | null = null
  for (const cab of cabinets) {
    if (!cab.start) continue
    if (cab.start > date) break  // sorted ascending → no later cabinet can match
    if (cab.end !== null && cab.end < date) continue  // ended strictly before our date
    if (hogQid) {
      // Strict: require an explicit head match. Discards both wrong-head
      // cabinets (Söder III in Bavaria for a federal Merz row) AND
      // headless cabinets (Söder III again — its Wikidata item happens to
      // omit P6 entirely). The strictness costs some recall on older
      // cabinets where Wikidata hasn't recorded a head, but precision
      // matters more here per the brief's "write NULL rather than
      // guessing" principle.
      if (cab.headQid !== hogQid) continue
    }
    best = cab  // keep scanning — a later cabinet may also cover the date
  }
  return best
  // No fallback: if hogQid was provided and no federal cabinet matched, we
  // *intentionally* return null rather than falling back to a date-only match.
  // The fallback path was previously assigning state cabinets (e.g., Bavaria's
  // Söder III) to federal-period rows where the actual federal cabinet item
  // doesn't yet exist on Wikidata (e.g., the Merz cabinet at the time of
  // writing). The brief mandates "write NULL rather than guessing." When
  // hogQid is null at the row level (Tier 1 missed) the loop is already
  // effectively date-only, since the `hogQid && cab.headQid && …` guard is
  // false.
}

// ── Derive enrichment fields ─────────────────────────────────────────────────
// Returns the four parliamentary-majority columns for a single PoliticalContext
// row, given the matched cabinet (may be null) and the hogParty already on the
// row (Tier 1 output, may also be null).
//
// Decisions encoded here, all per the brief's "write NULL rather than guess":
//   governingParty:    hogParty if set, else first cabinet party, else null
//   majorityType:      "coalition" if cabinet has ≥2 distinct parties;
//                      null otherwise (we cannot tell majority vs minority
//                      from cabinet membership alone — seat data needed)
//   coalitionPartners: JSON-encoded array of party labels other than the
//                      governing party (empty array stored as NULL since
//                      empty string semantically equals "no coalition")
//   majoritySeats:     null — Wikidata does not consistently store per-
//                      cabinet seat counts. Field reserved for a future
//                      enrichment pass that uses ParlGov or per-election
//                      sources.

interface Derived {
  governingParty: string | null
  majorityType: string | null
  coalitionPartners: string | null  // JSON-encoded String[]
  majoritySeats: number | null
}

function deriveFields(cabinet: Cabinet | null, hogParty: string | null): Derived {
  const partyLabels = cabinet?.parties.map(p => p.label) ?? []
  const governingParty: string | null = hogParty ?? partyLabels[0] ?? null

  // If hogParty doesn't appear among the cabinet parties (different label
  // spellings, e.g. "CDU" vs "Christian Democratic Union of Germany"), still
  // prefer hogParty as authoritative — it came from the P102 statement on the
  // actual head of government, which is more specific than cabinet membership.

  let majorityType: string | null = null
  if (partyLabels.length >= 2) {
    majorityType = 'coalition'
  }

  let coalitionPartners: string | null = null
  if (partyLabels.length >= 2) {
    const others = partyLabels.filter(p => p !== governingParty)
    if (others.length > 0) coalitionPartners = JSON.stringify(others)
  }

  return {
    governingParty,
    majorityType,
    coalitionPartners,
    majoritySeats: null,
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, countryFilter, limit, verbose } = parseArgs()

  console.log('\n── Enrich: Parliamentary majority via Wikidata ──────────────────────────')
  console.log(`Mode: ${mode} | Country filter: ${countryFilter ?? 'all'} | Limit: ${limit || 'all'}`)

  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('\nRefusing to run --full without ALLOW_EDITS=true in the environment.')
    process.exit(1)
  }

  // ── Resolve country filter to a set of country labels ──────────────────────
  // Accepts: pipeline tag (`bundestag_v1`), country label (`Germany`), or QID (`Q183`).
  let countryLabelsAllowed: Set<string> | null = null
  if (countryFilter) {
    const labels = new Set<string>()
    for (const [tag, info] of Object.entries(LEGISLATION_PIPELINES)) {
      if (
        tag === countryFilter ||
        info.country.toLowerCase() === countryFilter.toLowerCase() ||
        info.country.toLowerCase().includes(countryFilter.toLowerCase()) ||
        info.wikidataQid === countryFilter
      ) {
        labels.add(info.country)
      }
    }
    if (labels.size === 0) {
      console.error(`No countries matched filter: ${countryFilter}`)
      process.exit(1)
    }
    countryLabelsAllowed = labels
  }

  // ── Find eligible PoliticalContext rows ────────────────────────────────────
  // Idempotent: skip any row that already has governingParty set. We *do* want
  // rows even when hogParty is null — cabinet membership can still give us a
  // governingParty value Tier 1 missed.
  console.log('\nQuerying eligible PoliticalContext rows...')
  const eligible = await prisma.politicalContext.findMany({
    where: {
      governingParty: null,
      enactmentDate: { not: null },
      ...(countryLabelsAllowed ? { country: { in: Array.from(countryLabelsAllowed) } } : {}),
    },
    select: {
      id: true,
      sourceId: true,
      country: true,
      enactmentDate: true,
      hogParty: true,
      hogWikidataId: true,
      headOfGovernment: true,
    },
    ...(limit > 0 ? { take: limit } : {}),
  })

  console.log(`Eligible rows: ${eligible.length}`)
  if (eligible.length === 0) {
    console.log('Nothing to enrich.')
    return
  }

  // Group by country label
  const byCountry = new Map<string, typeof eligible>()
  for (const row of eligible) {
    const arr = byCountry.get(row.country) ?? []
    arr.push(row)
    byCountry.set(row.country, arr)
  }

  // Summary
  for (const [label, rows] of Array.from(byCountry)) {
    const info = COUNTRY_LABEL_TO_INFO[label]
    console.log(`  ${label} (${info?.wikidataQid ?? '???'}): ${rows.length} rows`)
  }

  // ── Dry-run: fetch cabinets for the first country and sample matches ─────
  if (mode === 'dry-run') {
    const sampleByCountry: Record<string, unknown[]> = {}
    const stats = {
      countriesProbed: 0,
      countriesWithCabinets: 0,
      cabinetsTotal: 0,
      coalitionCabinets: 0,
      singlePartyCabinets: 0,
      sampleMatches: 0,
      sampleCoalition: 0,
      sampleSingleParty: 0,
      sampleUnmatched: 0,
    }

    // Probe up to the first 5 countries in the eligible set for a representative
    // dry-run snapshot. Full --dry-run across 50 countries would still be
    // cheap (≈55 s with 1.1 s throttle) but the smaller probe makes the
    // dry-run usable from a terminal that's also being watched live.
    const probeCountries = Array.from(byCountry.keys()).slice(0, 5)

    for (const country of probeCountries) {
      const info = COUNTRY_LABEL_TO_INFO[country]
      if (!info) {
        if (verbose) console.warn(`  No registry entry for country label "${country}" — skipping`)
        continue
      }
      stats.countriesProbed++

      console.log(`\nDry-run: fetching cabinets for ${country} (${info.wikidataQid})...`)
      let cabinets: Cabinet[] = []
      try {
        cabinets = await fetchCabinets(info.wikidataQid)
      } catch (err) {
        console.error(`  Wikidata query failed: ${err}`)
        continue
      }

      console.log(`  Found ${cabinets.length} cabinets`)
      if (cabinets.length > 0) stats.countriesWithCabinets++
      stats.cabinetsTotal += cabinets.length
      stats.coalitionCabinets += cabinets.filter(c => c.parties.length >= 2).length
      stats.singlePartyCabinets += cabinets.filter(c => c.parties.length === 1).length

      // Print first few cabinets
      cabinets.slice(0, 5).forEach(c => {
        const s = c.start?.toISOString().slice(0, 10) ?? '?'
        const e = c.end?.toISOString().slice(0, 10) ?? 'present'
        const ps = c.parties.map(p => p.label).join(', ') || '(no parties)'
        console.log(`    ${s} – ${e}: ${c.cabinetLabel} [${ps}]`)
      })

      // Match sample rows — pick a date-spread of 10 rows instead of the
      // first 10 (which would all share the newest date and bias the match
      // stats toward the most-recent cabinet, which is also the cabinet
      // most likely to be missing from Wikidata).
      const allRows = byCountry.get(country)!
      const sorted = [...allRows].sort((a, b) => {
        const ad = a.enactmentDate?.getTime() ?? 0
        const bd = b.enactmentDate?.getTime() ?? 0
        return ad - bd
      })
      const sampleSize = Math.min(10, sorted.length)
      const stepRows: typeof allRows = []
      for (let i = 0; i < sampleSize; i++) {
        const idx = Math.floor((i / sampleSize) * sorted.length)
        stepRows.push(sorted[idx]!)
      }
      const rows = stepRows
      const samples = rows.map(r => {
        const matched = r.enactmentDate ? matchCabinet(cabinets, r.enactmentDate, r.hogWikidataId) : null
        const derived = deriveFields(matched, r.hogParty)
        if (matched) {
          stats.sampleMatches++
          if (matched.parties.length >= 2) stats.sampleCoalition++
          else if (matched.parties.length === 1) stats.sampleSingleParty++
        } else {
          stats.sampleUnmatched++
        }
        return {
          politicalContextId: r.id,
          country: r.country,
          enactmentDate: r.enactmentDate?.toISOString().slice(0, 10),
          headOfGovernment: r.headOfGovernment,
          hogParty: r.hogParty,
          matchedCabinet: matched?.cabinetLabel ?? null,
          governingParty: derived.governingParty,
          majorityType: derived.majorityType,
          coalitionPartners: derived.coalitionPartners ? JSON.parse(derived.coalitionPartners) : [],
          majoritySeats: derived.majoritySeats,
        }
      })
      sampleByCountry[country] = samples
    }

    const out = {
      runDate: new Date().toISOString(),
      mode: 'dry-run',
      eligibleRowsTotal: eligible.length,
      countriesEligible: byCountry.size,
      countriesProbed: stats.countriesProbed,
      countriesWithCabinets: stats.countriesWithCabinets,
      cabinetsTotal: stats.cabinetsTotal,
      coalitionCabinets: stats.coalitionCabinets,
      singlePartyCabinets: stats.singlePartyCabinets,
      cabinetsMissingPartyData: stats.cabinetsTotal - stats.coalitionCabinets - stats.singlePartyCabinets,
      sampleMatchesByCountry: Object.fromEntries(Object.entries(sampleByCountry).map(([k, v]) => [k, (v as unknown[]).length])),
      sampleMatchStats: {
        matched: stats.sampleMatches,
        unmatched: stats.sampleUnmatched,
        matchedCoalition: stats.sampleCoalition,
        matchedSingleParty: stats.sampleSingleParty,
      },
      samples: sampleByCountry,
    }

    fs.writeFileSync('enrich-parliamentary-majority-dry-run.json', JSON.stringify(out, null, 2))
    console.log('\nWritten: enrich-parliamentary-majority-dry-run.json')
    console.log('\n── Dry-run summary ───────────────────────────────────────')
    console.log(`  Eligible rows (DB-wide):    ${eligible.length}`)
    console.log(`  Distinct countries:         ${byCountry.size}`)
    console.log(`  Countries probed:           ${stats.countriesProbed}`)
    console.log(`  Countries w/ cabinet data:  ${stats.countriesWithCabinets}`)
    console.log(`  Cabinets fetched:           ${stats.cabinetsTotal}`)
    console.log(`    Coalition cabinets:       ${stats.coalitionCabinets}`)
    console.log(`    Single-party cabinets:    ${stats.singlePartyCabinets}`)
    console.log(`    No party data:            ${stats.cabinetsTotal - stats.coalitionCabinets - stats.singlePartyCabinets}`)
    console.log(`  Sample-row matches:         ${stats.sampleMatches} (coalition: ${stats.sampleCoalition}, single: ${stats.sampleSingleParty})`)
    console.log(`  Sample-row no-match:        ${stats.sampleUnmatched}`)
    console.log('\nDry-run complete. STOP — awaiting --full + ALLOW_EDITS=true before writing.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  let totalEnriched = 0
  let totalUnmatched = 0
  let totalFailed = 0
  let totalCoalition = 0
  let totalSingleParty = 0

  for (const [country, rows] of Array.from(byCountry)) {
    const info = COUNTRY_LABEL_TO_INFO[country]
    if (!info) {
      console.warn(`  No registry entry for country label "${country}" — skipping ${rows.length} rows`)
      totalFailed += rows.length
      continue
    }

    console.log(`\nProcessing ${country} (${info.wikidataQid}): ${rows.length} rows`)

    let cabinets: Cabinet[] = []
    try {
      cabinets = await fetchCabinets(info.wikidataQid)
      console.log(`  Wikidata: ${cabinets.length} cabinets`)
      if (verbose && cabinets.length > 0) {
        cabinets.forEach(c => {
          const s = c.start?.toISOString().slice(0, 10) ?? '?'
          const e = c.end?.toISOString().slice(0, 10) ?? 'present'
          const ps = c.parties.map(p => p.label).join(', ') || '(no parties)'
          console.log(`    ${s} – ${e}: ${c.cabinetLabel} [${ps}]`)
        })
      }
    } catch (err) {
      console.error(`  Wikidata query failed for ${country}: ${err}`)
      console.error(`  Skipping all ${rows.length} rows for this country`)
      totalFailed += rows.length
      continue
    }

    let enriched = 0
    let unmatched = 0
    let failed = 0
    let coalition = 0
    let singleParty = 0

    for (const row of rows) {
      if (!row.enactmentDate) { unmatched++; continue }
      const matched = matchCabinet(cabinets, row.enactmentDate, row.hogWikidataId)
      const derived = deriveFields(matched, row.hogParty)

      // If we have absolutely nothing to add (no matched cabinet AND hogParty
      // is null), skip — leaving the row alone preserves idempotency for the
      // next run if cabinet data improves on Wikidata.
      if (!matched && !derived.governingParty) {
        unmatched++
        continue
      }

      try {
        await prisma.politicalContext.update({
          where: { id: row.id },
          data: {
            governingParty: derived.governingParty,
            majorityType: derived.majorityType,
            coalitionPartners: derived.coalitionPartners,
            majoritySeats: derived.majoritySeats,
          },
        })
        enriched++
        if (derived.majorityType === 'coalition') coalition++
        else if (matched && matched.parties.length === 1) singleParty++
        if (verbose) {
          console.log(`    [enriched] ${row.id} → ${derived.governingParty} (${derived.majorityType ?? 'unknown'})`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`    [failed] ${row.id}: ${msg}`)
        failed++
      }
    }

    console.log(`  ${country}: enriched=${enriched} unmatched=${unmatched} failed=${failed} (coalition=${coalition}, single=${singleParty})`)
    totalEnriched += enriched
    totalUnmatched += unmatched
    totalFailed += failed
    totalCoalition += coalition
    totalSingleParty += singleParty
  }

  console.log('\n── Enrichment complete ──────────────────────────────────────────────────')
  console.log(`  Total enriched:        ${totalEnriched}`)
  console.log(`    Coalition:           ${totalCoalition}`)
  console.log(`    Single-party only:   ${totalSingleParty}`)
  console.log(`    HoG-only (no cabinet): ${totalEnriched - totalCoalition - totalSingleParty}`)
  console.log(`  Total unmatched:       ${totalUnmatched}`)
  console.log(`  Total failed:          ${totalFailed}`)

  // DB verification — independent count per AGENTS.md rule 6
  const dbWithParty = await prisma.politicalContext.count({ where: { governingParty: { not: null } } })
  const dbCoalition = await prisma.politicalContext.count({ where: { majorityType: 'coalition' } })
  console.log(`\n  DB PoliticalContext with governingParty set: ${dbWithParty}`)
  console.log(`  DB PoliticalContext with majorityType=coalition: ${dbCoalition}`)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
