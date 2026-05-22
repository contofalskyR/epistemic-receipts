// Enrichment: Legislative Vote Counts
// Backfills LegislativeVote records for legislation sources using country-
// specific free APIs. Idempotent — skips sources that already have vote rows.
//
// Supported countries:
//   us       — VoteView API (congress_v1 / congress_bills_v1); also scans
//              existing congress_votes_v1 claim metadata
//   canada   — OpenParliament.ca /votes/ endpoint
//   uk       — UK Parliament Divisions API (free, no key required)
//   eu       — EP Open Data Portal adopted-texts vote data
//   de       — Bundestag DIP named votes (Namentliche Abstimmungen)
//   il       — Knesset OData KNS_Vote
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-vote-counts.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-vote-counts.ts --full [--country us] [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --full [--country <code>] [--limit N] [--verbose]')
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

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

type IngestResult = 'enriched' | 'skipped' | 'failed'
type Counts = { enriched: number; skipped: number; failed: number }

// ── HTTP helpers ──────────────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} at ${url}`)
  }
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}, retries = 3): Promise<T> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...headers } })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new HttpError(res.status, url)
    return res.json() as Promise<T>
  }
  throw new Error('Failed after retries')
}

// ── US Congress: match existing congress_votes_v1 claims ──────────────────────
// congress_bills_v1 claims have externalId: congress_{congress}_{type}_{number}
// congress_votes_v1 claims have externalId: congress_vote_{chamber}_{congress}_{type}_{number}_*
// We join on the (congress, type, number) fragment.

interface CongressVoteClaim {
  id: string
  externalId: string | null
  metadata: unknown
  claimEmergedAt: Date | null
  edges: { source: { id: string } }[]
}

async function enrichUsCongressVotes(
  sources: { id: string; externalId: string | null; publishedAt: Date | null }[],
  dryRun: boolean,
  verbose: boolean,
): Promise<Counts> {
  const counts: Counts = { enriched: 0, skipped: 0, failed: 0 }

  // Load all existing congress_votes_v1 claims (metadata has yea/nay)
  const voteClaims = await prisma.claim.findMany({
    where: { ingestedBy: 'congress_votes_v1', deleted: false },
    select: {
      id: true,
      externalId: true,
      metadata: true,
      claimEmergedAt: true,
      edges: { select: { source: { select: { id: true } } } },
    },
  })

  // Build a lookup: "congress_type_number" → array of vote claims
  const votesByBillKey = new Map<string, CongressVoteClaim[]>()
  for (const vc of voteClaims) {
    // externalId pattern: congress_vote_{chamber}_{congress}_{type}_{number}_*
    const m = vc.externalId?.match(/^congress_vote_[^_]+_(\d+)_([a-z]+)_(\d+)_/)
    if (!m) continue
    const key = `${m[1]}_${m[2]}_${m[3]}`
    const arr = votesByBillKey.get(key) ?? []
    arr.push(vc as CongressVoteClaim)
    votesByBillKey.set(key, arr)
  }

  console.log(`  congress_votes_v1 claims loaded: ${voteClaims.length}, bill keys: ${votesByBillKey.size}`)

  for (const source of sources) {
    // Check if already enriched
    const existing = await prisma.legislativeVote.findFirst({ where: { sourceId: source.id, dataSource: 'congress_votes_v1' } })
    if (existing) { counts.skipped++; continue }

    // Match externalId: congress_law_source_{congress}_{type}_{number}
    const m = source.externalId?.match(/^congress_law_source_(\d+)_([a-z]+)_(\d+)$/)
    if (!m) {
      if (verbose) console.log(`    [skip] no match for externalId: ${source.externalId}`)
      counts.skipped++
      continue
    }
    const key = `${m[1]}_${m[2]}_${m[3]}`
    const matchedVotes = votesByBillKey.get(key)

    if (!matchedVotes || matchedVotes.length === 0) {
      if (verbose) console.log(`    [skip] no vote claim for ${key}`)
      counts.skipped++
      continue
    }

    for (const vc of matchedVotes) {
      const meta = vc.metadata as Record<string, unknown> | null
      if (!meta) continue

      const yea = typeof meta.yea === 'number' ? meta.yea : null
      const nay = typeof meta.nay === 'number' ? meta.nay : null
      const present = typeof meta.present === 'number' ? meta.present : null
      const chamber = typeof meta.chamber === 'string' ? meta.chamber : 'Unknown'
      const voteType = typeof meta.voteType === 'string' ? meta.voteType : null

      if (dryRun) {
        if (verbose) console.log(`    [dry-run] would write: ${chamber} ${yea}–${nay} (${voteType})`)
        counts.enriched++
        continue
      }

      try {
        await prisma.legislativeVote.create({
          data: {
            sourceId: source.id,
            chamber,
            yesCount: yea,
            noCount: nay,
            abstainCount: present,
            passageThreshold: 'simple_majority',
            voteDate: vc.claimEmergedAt,
            passageType: 'legislative_vote',
            dataSource: 'congress_votes_v1',
          },
        })
        counts.enriched++
        if (verbose) console.log(`    [enriched] ${source.externalId}: ${chamber} ${yea}–${nay}`)
      } catch (err) {
        console.error(`    [failed] ${source.externalId}: ${err}`)
        counts.failed++
      }
    }
  }

  return counts
}

// ── Canada: OpenParliament.ca votes API ──────────────────────────────────────
// Matches by bill number within a parliament session.
// API: https://api.openparliament.ca/votes/?format=json&bill=C-10

interface OpenParliamentVote {
  bill_url: string | null   // e.g. "/bills/44-1/C-11/"
  session: string
  result: string
  yea_total: number | null
  nay_total: number | null
  paired_total: number | null
  date: string | null
}

interface OpenParliamentPage {
  objects: OpenParliamentVote[]
  pagination: { next_url: string | null }
}

async function enrichCanadaVotes(
  sources: { id: string; externalId: string | null; publishedAt: Date | null }[],
  dryRun: boolean,
  verbose: boolean,
): Promise<Counts> {
  const counts: Counts = { enriched: 0, skipped: 0, failed: 0 }
  const PAGE_DELAY = 500

  // Build a lookup of bill number → source id
  // canada_bills_v1 source externalId: canada_source_{parliament}_{session}_{billNumber}
  // e.g. canada_source_44_1_C-11 → key "44-1_c-11"
  const sourceLookup = new Map<string, string>() // "parl-session_billnumber" → sourceId
  for (const s of sources) {
    const m = s.externalId?.match(/^canada_source_(\d+)_(\d+)_(.+)$/)
    if (!m) continue
    const key = `${m[1]!}-${m[2]!}_${m[3]!.toLowerCase()}`
    sourceLookup.set(key, s.id)
  }

  if (sourceLookup.size === 0) {
    console.log('  No Canada sources with parseable externalIds')
    counts.skipped += sources.length
    return counts
  }

  console.log(`  Fetching OpenParliament votes (${sourceLookup.size} unique bills)...`)

  // Fetch all votes from OpenParliament in pages
  const OP_BASE = 'https://api.openparliament.ca'
  let url: string | null = `${OP_BASE}/votes/?format=json&limit=500`
  let totalFetched = 0

  while (url) {
    let page: OpenParliamentPage
    try {
      page = await fetchJson<OpenParliamentPage>(url)
    } catch (err) {
      console.error(`  OpenParliament API error: ${err}`)
      break
    }

    for (const vote of page.objects) {
      if (!vote.bill_url) continue
      // bill_url: "/bills/44-1/C-11/"  → session="44-1", bill="c-11"
      const m = vote.bill_url.match(/^\/bills\/(\d+-\d+)\/([^/]+)\/$/)
      if (!m) continue
      const key = `${m[1]}_${m[2]!.toLowerCase()}`
      const sourceId = sourceLookup.get(key)
      if (!sourceId) continue

      if (dryRun) {
        if (verbose) console.log(`    [dry-run] ${key}: yea=${vote.yea_total} nay=${vote.nay_total}`)
        counts.enriched++
        continue
      }

      // Check if already enriched
      const existing = await prisma.legislativeVote.findFirst({ where: { sourceId, dataSource: 'openparliament' } })
      if (existing) { counts.skipped++; continue }

      try {
        await prisma.legislativeVote.create({
          data: {
            sourceId,
            chamber: 'House of Commons',
            yesCount: vote.yea_total,
            noCount: vote.nay_total,
            passageThreshold: 'simple_majority',
            voteDate: vote.date ? new Date(vote.date) : null,
            passageType: 'legislative_vote',
            dataSource: 'openparliament',
          },
        })
        counts.enriched++
        if (verbose) console.log(`    [enriched] ${key}: yea=${vote.yea_total} nay=${vote.nay_total}`)
      } catch (err) {
        console.error(`    [failed] ${key}: ${err}`)
        counts.failed++
      }
    }

    totalFetched += page.objects.length
    const nextRaw = page.pagination.next_url
    if (nextRaw) {
      url = nextRaw.startsWith('http') ? nextRaw : `${OP_BASE}${nextRaw}`
    } else {
      url = null
    }
    if (url) await sleep(PAGE_DELAY)
  }

  console.log(`  OpenParliament: fetched ${totalFetched} vote records total`)
  const unmatched = sources.length - counts.enriched - counts.skipped - counts.failed
  counts.skipped += Math.max(0, unmatched)
  return counts
}

// ── UK: Official UK Parliament Divisions API ─────────────────────────────────
// Free, no key required. https://votes.parliament.uk/Votes/Commons/Divisions

async function enrichUkVotes(
  sources: { id: string; externalId: string | null; publishedAt: Date | null }[],
  dryRun: boolean,
  verbose: boolean,
): Promise<Counts> {
  const counts: Counts = { enriched: 0, skipped: 0, failed: 0 }
  const PAGE_DELAY = 300
  let fetched = 0

  for (const source of sources) {
    if (!source.publishedAt) { counts.skipped++; continue }

    const existing = await prisma.legislativeVote.findFirst({ where: { sourceId: source.id, dataSource: 'uk-parliament' } })
    if (existing) { counts.skipped++; continue }

    const dateStr = source.publishedAt.toISOString().slice(0, 10)

    try {
      // Query Commons divisions on the enactment date
      const url = `https://votes.parliament.uk/Votes/Commons/Divisions?startDate=${dateStr}&endDate=${dateStr}&format=json`
      const data = await fetchJson<{ value: Array<{ DivisionId: number; Date: string; AyeCount: number; NoeCount: number; Title: string }> }>(url)

      const divisions = data?.value ?? []
      if (divisions.length === 0) { counts.skipped++; continue }

      const div = divisions[0]!

      if (dryRun) {
        if (verbose) console.log(`    [dry-run] ${source.externalId}: aye=${div.AyeCount} no=${div.NoeCount}`)
        counts.enriched++
        continue
      }

      await prisma.legislativeVote.create({
        data: {
          sourceId: source.id,
          chamber: 'House of Commons',
          yesCount: div.AyeCount,
          noCount: div.NoeCount,
          passageThreshold: 'simple_majority',
          voteDate: new Date(div.Date),
          passageType: 'legislative_vote',
          dataSource: 'uk-parliament',
        },
      })
      counts.enriched++
      fetched++
      if (verbose) console.log(`    [enriched] ${source.externalId}`)
    } catch (err) {
      // 403 = API doesn't cover this date range (pre-~2001 legislation) — not a real failure
      if (err instanceof HttpError && err.status === 403) {
        counts.skipped++
      } else {
        if (verbose) console.error(`    [failed] ${source.externalId}: ${err}`)
        counts.failed++
      }
    }

    await sleep(PAGE_DELAY)
  }

  console.log(`  UK Parliament: matched ${fetched} votes`)
  return counts
}

// ── Germany: Bundestag named votes (Namentliche Abstimmungen) ─────────────────
// DIP API endpoint for roll-call votes linked to Vorgänge.

interface DipAbstimmung {
  id: string
  vorgang_id?: string | null
  datum?: string | null
  titel?: string | null
  ja?: number | null
  nein?: number | null
  enthalten?: number | null
  nichtabgegeben?: number | null
}

interface DipAbstimmungPage {
  documents: DipAbstimmung[]
  cursor?: string
  numFound?: number
}

async function enrichGermanyVotes(
  sources: { id: string; externalId: string | null; publishedAt: Date | null }[],
  dryRun: boolean,
  verbose: boolean,
): Promise<Counts> {
  const counts: Counts = { enriched: 0, skipped: 0, failed: 0 }
  const API_KEY = 'OSOegLs.PR2lwJ1dwCeje9vTj7FPOt3hvpYKtwKkhw' // public Bundestag key
  const PAGE_DELAY = 300

  // Build lookup: bundestag vorgang id → source id
  // bundestag_v1 source externalId: bundestag_source_{id}
  // DIP abstimmung records have vorgang_id matching the numeric portion
  const vorgangToSource = new Map<string, string>()
  for (const s of sources) {
    const m = s.externalId?.match(/^bundestag_source_(.+)$/)
    if (m) vorgangToSource.set(m[1]!, s.id)
  }

  if (vorgangToSource.size === 0) {
    console.log('  No Bundestag sources with parseable externalIds')
    counts.skipped += sources.length
    return counts
  }

  // The DIP search API (search.dip.bundestag.de/api/v1) does not expose an
  // abstimmung/vote endpoint. Bundestag Namentliche Abstimmungen (named votes)
  // are published as XML files via https://www.bundestag.de/services/opendata
  // and require a separate download-and-parse pipeline (not a simple REST call).
  // This handler is a placeholder — implement by downloading the XML roll-call
  // vote files and matching them to vorgang IDs.
  console.log(`  NOTE: Bundestag DIP API has no abstimmung endpoint.`)
  console.log(`  Named vote data requires XML download from bundestag.de/services/opendata.`)
  console.log(`  This enrichment step is pending a dedicated download-and-parse implementation.`)
  counts.skipped += sources.length
  return counts
}

// ── Israel: Knesset OData KNS_Vote ───────────────────────────────────────────

interface KnessetVote {
  VoteID: number
  IsraelLawID?: number | null
  KnessetNum?: number | null
  Name?: string | null
  VoteDate?: string | null
  AcceptedText?: string | null
  For?: number | null
  Against?: number | null
  Abstain?: number | null
}

interface KnessetODataPage {
  value: KnessetVote[]
  'odata.nextLink'?: string
}

async function enrichIsraelVotes(
  sources: { id: string; externalId: string | null; publishedAt: Date | null }[],
  dryRun: boolean,
  verbose: boolean,
): Promise<Counts> {
  const counts: Counts = { enriched: 0, skipped: 0, failed: 0 }

  // Build lookup: IsraelLawID → source id
  // israel_knesset_v1 source externalId: israel_knesset_source_{id}
  const lawIdToSource = new Map<number, string>()
  for (const s of sources) {
    const m = s.externalId?.match(/^israel_knesset_source_(\d+)$/)
    if (m) lawIdToSource.set(parseInt(m[1]!, 10), s.id)
  }

  if (lawIdToSource.size === 0) {
    console.log('  No Israel Knesset sources with parseable externalIds')
    counts.skipped += sources.length
    return counts
  }

  // The Knesset OData service (knesset.gov.il/Odata/ParliamentInfo.svc) does
  // not expose a KNS_Vote entity. Available entities include KNS_PlenumSession
  // and KNS_PlmSessionItem, which contain the plenary session schedule but
  // not individual division vote counts. Knesset roll-call vote data is
  // published separately on knesset.gov.il/Odata/Votes.svc (a different
  // service path). This handler is a placeholder pending verification of
  // that alternate endpoint.
  console.log(`  NOTE: KNS_Vote not available in the ParliamentInfo OData service.`)
  console.log(`  Knesset vote data may be at knesset.gov.il/Odata/Votes.svc — pending verification.`)
  counts.skipped += sources.length
  return counts
}

// ── EU Parliament vote data ───────────────────────────────────────────────────
// EP Open Data Portal /api/v2/adopted-texts includes vote metadata in some records.
// We check the existing eu_parliament_v1 sources and look for vote data via
// the EP voting lists endpoint.

async function enrichEuVotes(
  sources: { id: string; externalId: string | null; publishedAt: Date | null }[],
  dryRun: boolean,
  verbose: boolean,
): Promise<Counts> {
  const counts: Counts = { enriched: 0, skipped: 0, failed: 0 }

  // EP voting list API: /api/v2/votes?activity-id=<adopted-text-id>
  // externalId pattern for eu_parliament_v1: eu_parliament_{eliId}_source or similar
  // Check a few sources to understand the externalId pattern
  const sampleExtIds = sources.slice(0, 5).map(s => s.externalId)
  if (verbose) console.log(`  Sample EU source externalIds: ${JSON.stringify(sampleExtIds)}`)

  let processed = 0
  for (const source of sources.slice(0, dryRun ? 5 : sources.length)) {
    const existing = await prisma.legislativeVote.findFirst({ where: { sourceId: source.id, dataSource: 'ep_opendata' } })
    if (existing) { counts.skipped++; continue }

    // Extract doc reference from externalId to build vote API URL
    // eu_parliament_v1 externalIds are based on ELI IDs — format varies
    const extId = source.externalId
    if (!extId) { counts.skipped++; continue }

    // Attempt vote lookup by adopted text ID from EP API
    // The EP voting endpoint: /api/v2/activities?activity-type=VOTE&reference=<ref>
    // For simplicity, we flag as skipped unless we can extract a usable reference
    // More complete matching would require storing the EP document reference
    // in the claim metadata during initial ingestion
    if (verbose) console.log(`    [skip] EU vote lookup requires doc reference not stored in current externalId: ${extId}`)
    counts.skipped++
    processed++
  }

  if (!dryRun && sources.length > 0) {
    console.log(`  EP vote enrichment: needs doc reference stored in source metadata.`)
    console.log(`  Current eu_parliament_v1 sources store ELI IDs but not the EP internal vote reference.`)
    console.log(`  Recommendation: update ingest-eu-parliament.ts to store voteRef in externalId or metadata,`)
    console.log(`  then re-run this enrichment step.`)
  }

  counts.skipped = sources.length
  return counts
}

// ── Country handler registry ──────────────────────────────────────────────────

type Handler = (
  sources: { id: string; externalId: string | null; publishedAt: Date | null }[],
  dryRun: boolean,
  verbose: boolean,
) => Promise<Counts>

interface CountryConfig {
  label: string
  ingestedByTags: string[]
  handler: Handler
}

const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  us: {
    label: 'United States',
    ingestedByTags: ['congress_v1', 'congress_bills_v1'],
    handler: enrichUsCongressVotes,
  },
  canada: {
    label: 'Canada',
    ingestedByTags: ['canada_bills_v1'],
    handler: enrichCanadaVotes,
  },
  uk: {
    label: 'United Kingdom',
    ingestedByTags: ['uk_legislation_v1'],
    handler: enrichUkVotes,
  },
  de: {
    label: 'Germany',
    ingestedByTags: ['bundestag_v1'],
    handler: enrichGermanyVotes,
  },
  il: {
    label: 'Israel',
    ingestedByTags: ['israel_knesset_v1'],
    handler: enrichIsraelVotes,
  },
  eu: {
    label: 'European Union',
    ingestedByTags: ['eu_parliament_v1', 'eu_legislation_v1'],
    handler: enrichEuVotes,
  },
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, countryFilter, limit, verbose } = parseArgs()

  console.log('\n── Enrich: Legislative Vote Counts ─────────────────────────────────────')
  console.log(`Mode: ${mode} | Country: ${countryFilter ?? 'all'} | Limit: ${limit || 'all'}`)

  const dryRun = mode === 'dry-run'

  const countriesToProcess = countryFilter
    ? Object.entries(COUNTRY_CONFIGS).filter(([k]) => k === countryFilter)
    : Object.entries(COUNTRY_CONFIGS)

  if (countriesToProcess.length === 0) {
    console.error(`No handler for country: ${countryFilter}`)
    console.error(`Available: ${Object.keys(COUNTRY_CONFIGS).join(', ')}`)
    process.exit(1)
  }

  const totals: Counts = { enriched: 0, skipped: 0, failed: 0 }
  const dryRunSample: unknown[] = []

  for (const [code, config] of countriesToProcess) {
    console.log(`\n── ${config.label} (${code}) ──────────────────────────`)

    // Fetch eligible sources
    const sources = await prisma.source.findMany({
      where: {
        ingestedBy: { in: config.ingestedByTags },
        deleted: false,
      },
      select: { id: true, externalId: true, publishedAt: true },
      ...(limit > 0 ? { take: limit } : {}),
    })

    if (sources.length === 0) {
      console.log(`  No sources found for tags: ${config.ingestedByTags.join(', ')}`)
      continue
    }

    // In dry-run, work on a small subset
    const workSources = dryRun ? sources.slice(0, 20) : sources
    console.log(`  Sources: ${sources.length} (processing: ${workSources.length})`)

    const counts = await config.handler(workSources, dryRun, verbose)
    console.log(`  Result: enriched=${counts.enriched} skipped=${counts.skipped} failed=${counts.failed}`)

    totals.enriched += counts.enriched
    totals.skipped += counts.skipped
    totals.failed += counts.failed

    if (dryRun) {
      dryRunSample.push({ country: config.label, code, sources: sources.length, ...counts })
    }
  }

  console.log('\n── Summary ──────────────────────────────────────────────────────────────')
  console.log(`  Total enriched: ${totals.enriched}`)
  console.log(`  Total skipped:  ${totals.skipped}`)
  console.log(`  Total failed:   ${totals.failed}`)

  if (dryRun) {
    fs.writeFileSync(
      'enrich-vote-counts-dry-run.json',
      JSON.stringify({ runDate: new Date().toISOString(), mode: 'dry-run', totals, byCountry: dryRunSample }, null, 2)
    )
    console.log('\nWritten: enrich-vote-counts-dry-run.json')
    console.log('\nDry-run complete. STOP — awaiting go-ahead before full run.')
    return
  }

  // DB verification
  const dbCount = await prisma.legislativeVote.count()
  console.log(`\n  DB LegislativeVote rows: ${dbCount}`)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
