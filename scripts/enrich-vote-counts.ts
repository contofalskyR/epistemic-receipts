// Enrichment: Legislative Vote Counts
// Backfills LegislativeVote records for legislation sources using country-
// specific free APIs. Idempotent — skips sources that already have vote rows.
//
// Supported countries:
//   us       — VoteView API (congress_v1 / congress_bills_v1); also scans
//              existing congress_votes_v1 claim metadata
//   canada   — OpenParliament.ca /votes/ endpoint
//   uk       — UK Parliament Divisions API (free, no key required)
//   eu       — HowTheyVote.eu votes.csv release joined by texts_adopted_reference
//   de       — pending (Bundestag named votes require HTML scrape + drucksache→vorgang map)
//   il       — pending (no schema linkage from Knesset OData votes to IsraelLawID)
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

// ── UK: commonsvotes-api.parliament.uk (Cloudflare-free) ────────────────────
// Strategy:
//   1. Skip pre-2017 sources (electronic division records are sparse before then)
//   2. Fetch short title from legislation.gov.uk HTML <title> tag
//   3. Convert "Foo Act 2023" → search term → query commonsvotes-api by searchTerm
//   4. Pick division with highest total votes (most contested)
//   5. Fetch byPartyJson from groupedbyparty endpoint
//
// votes.parliament.uk is Cloudflare-protected; commonsvotes-api.parliament.uk is not.
// Many UK Acts pass without a division (uncontested) — skip rate will be high.

interface UkDivision {
  DivisionId: number
  Date: string
  Title: string
  AyeCount: number
  NoCount: number
}

interface UkDivisionGrouped extends UkDivision {
  Ayes: { PartyName: string; VoteCount: number }[]
  Noes: { PartyName: string; VoteCount: number }[]
}

const ukTitleCache = new Map<string, string | null>()
const ukDivisionCache = new Map<string, UkDivision | null>()

async function fetchUkTitle(type: string, year: string, chapter: string): Promise<string | null> {
  const key = `${type}/${year}/${chapter}`
  if (ukTitleCache.has(key)) return ukTitleCache.get(key) ?? null

  try {
    // Fetch HTML page — <title> element contains the short title cleanly
    const res = await fetch(`https://www.legislation.gov.uk/${type}/${year}/${chapter}`, {
      headers: { 'User-Agent': 'EpistemicReceipts/1.0 (+https://epistemic-receipts.vercel.app)' },
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    })
    if (!res.ok) { ukTitleCache.set(key, null); return null }
    const html = await res.text()
    const m = html.match(/<title>([^<]+)<\/title>/)
    const raw = m ? m[1].trim() : null
    // Strip any " | legislation.gov.uk" suffix if present
    const title = raw ? raw.replace(/\s*\|.*$/, '').trim() : null
    ukTitleCache.set(key, title)
    return title
  } catch {
    ukTitleCache.set(key, null)
    return null
  }
}

async function findUkDivisionByBillName(actTitle: string): Promise<UkDivision | null> {
  // "Online Safety Act 2023" → "Online Safety Bill"
  // Appending "Bill" narrows the search to the legislative bill, excluding derived SIs
  const searchTerm = actTitle
    .replace(/\s+Act(\s+\d{4})?$/, ' Bill')
    .trim()
  const cacheKey = searchTerm.toLowerCase()
  if (ukDivisionCache.has(cacheKey)) return ukDivisionCache.get(cacheKey) ?? null

  try {
    const url = `https://commonsvotes-api.parliament.uk/data/divisions.json/search?queryParameters.searchTerm=${encodeURIComponent(searchTerm)}`
    const divs = await fetchJson<UkDivision[]>(url)
    if (!divs || divs.length === 0) {
      ukDivisionCache.set(cacheKey, null)
      return null
    }
    // Prefer Third Reading; fall back to division with highest total votes
    const thirdReading = divs.find(d => /third\s*reading/i.test(d.Title))
    const byVotes = [...divs].sort((a, b) => (b.AyeCount + b.NoCount) - (a.AyeCount + a.NoCount))
    const result = thirdReading ?? byVotes[0] ?? null
    ukDivisionCache.set(cacheKey, result)
    return result
  } catch {
    ukDivisionCache.set(cacheKey, null)
    return null
  }
}

async function fetchUkDivisionGrouped(divisionId: number): Promise<UkDivisionGrouped | null> {
  try {
    const url = `https://commonsvotes-api.parliament.uk/data/divisions.json/groupedbyparty?queryParameters.divisionId=${divisionId}`
    const rows = await fetchJson<UkDivisionGrouped[]>(url)
    return Array.isArray(rows) && rows.length > 0 ? rows[0]! : null
  } catch {
    return null
  }
}

async function enrichUkVotes(
  sources: { id: string; externalId: string | null; publishedAt: Date | null }[],
  dryRun: boolean,
  verbose: boolean,
): Promise<Counts> {
  const counts: Counts = { enriched: 0, skipped: 0, failed: 0 }
  let written = 0

  // Electronic division records are sparse before 2017
  const CUTOFF = new Date('2017-01-01')

  for (const source of sources) {
    // Skip ancient legislation — commonsvotes-api won't have records
    if (!source.publishedAt || source.publishedAt < CUTOFF) {
      if (verbose) console.log(`    [skip] pre-2017: ${source.externalId}`)
      counts.skipped++
      continue
    }

    const existing = await prisma.legislativeVote.findFirst({ where: { sourceId: source.id, dataSource: 'uk-parliament' } })
    if (existing) { counts.skipped++; continue }

    const extId = source.externalId ?? ''

    // Parse: uk_legislation_source_ukpga_2023_45
    const m = extId.match(/^uk_legislation_source_(ukpga|uksi|asp|anaw|mwa|ukcm|nia|apni)_(\d{4})_(\d+)$/)
    if (!m) {
      if (verbose) console.log(`    [skip] unparseable externalId: ${extId}`)
      counts.skipped++
      continue
    }
    const [, legType, year, chapter] = m as [string, string, string, string]

    const title = await fetchUkTitle(legType, year, chapter)
    await sleep(400)

    if (!title) {
      if (verbose) console.log(`    [skip] no title from legislation.gov.uk: ${legType}/${year}/${chapter}`)
      counts.skipped++
      continue
    }

    const division = await findUkDivisionByBillName(title)
    await sleep(300)

    if (!division) {
      if (verbose) console.log(`    [skip] no division found for "${title}"`)
      counts.skipped++
      continue
    }

    if (dryRun) {
      console.log(`    [dry-run] ${extId}: "${title}" → [${division.DivisionId}] "${division.Title}" aye=${division.AyeCount} noe=${division.NoCount}`)
      counts.enriched++
      continue
    }

    try {
      // Fetch grouped party breakdown for byPartyJson
      const grouped = await fetchUkDivisionGrouped(division.DivisionId)
      await sleep(200)

      const byPartyJson = grouped
        ? { ayes: grouped.Ayes, noes: grouped.Noes }
        : null

      await prisma.legislativeVote.create({
        data: {
          sourceId: source.id,
          chamber: 'House of Commons',
          yesCount: division.AyeCount,
          noCount: division.NoCount,
          passageThreshold: 'simple_majority',
          voteDate: new Date(division.Date),
          passageType: 'legislative_vote',
          dataSource: 'uk-parliament',
          byPartyJson: byPartyJson ? JSON.stringify(byPartyJson) : undefined,
        },
      })
      counts.enriched++
      written++
      if (verbose) console.log(`    [enriched] ${extId}: "${title}" aye=${division.AyeCount} noe=${division.NoCount}`)
    } catch (err) {
      console.error(`    [failed] ${extId}: ${err}`)
      counts.failed++
    }
  }

  console.log(`  UK Parliament: written ${written} votes`)
  return counts
}

// ── Germany: Bundestag named votes (Namentliche Abstimmungen) — pending ───────
// Status: investigated 2026-05-22. The DIP REST API exposes no roll-call endpoint.
// Named-vote data is published only as Excel/PDF lists and as HTML cards under
// https://www.bundestag.de/parlament/plenum/abstimmung/liste (ajax filterlist
// returns chart-values="ja,nein,enthalten,nichtabg" + Drucksache references).
// Linking a named vote back to a bundestag_v1 vorgang requires resolving the
// Drucksache numbers shown on each vote card to a vorgang via DIP's
// /vorgangsposition?f.drucksache=... query — a separate scrape-and-resolve
// pipeline, not a simple REST call.
async function enrichGermanyVotes(
  sources: { id: string; externalId: string | null; publishedAt: Date | null }[],
  _dryRun: boolean,
  _verbose: boolean,
): Promise<Counts> {
  console.log(`  NOTE: Bundestag named votes require an HTML-scrape + drucksache→vorgang resolution pipeline.`)
  console.log(`  Endpoint surveyed: https://www.bundestag.de/ajax/filterlist/de/parlament/plenum/abstimmung/liste/484422-484422`)
  console.log(`  Vote cards expose ja/nein/enthalten/nichtabg counts but only Drucksache refs, not vorgang IDs.`)
  console.log(`  Skipping in this run; track as a separate ingester proposal.`)
  return { enriched: 0, skipped: sources.length, failed: 0 }
}

// ── Israel: Knesset OData votes — pending ────────────────────────────────────
// Status: investigated 2026-05-22. The Knesset operates two OData services:
//   ParliamentInfo.svc — KNS_IsraelLaw (our source records), KNS_Bill, KNS_PlmSessionItem
//   Votes.svc          — View_vote_rslts_hdr_Approved with vote_id, sess_item_id,
//                        sess_item_dscr, total_for/against/abstain
// Both work. However, the Vote → IsraelLaw relationship is not expressed in the
// OData schema: votes attach to sess_item_id (plenary session items), and there
// is no documented pivot from session items back to a specific IsraelLawID.
// Linking would require fuzzy Hebrew text matching of sess_item_dscr against
// KNS_IsraelLaw.Name, which is brittle. Defer to a separate pipeline.
async function enrichIsraelVotes(
  sources: { id: string; externalId: string | null; publishedAt: Date | null }[],
  _dryRun: boolean,
  _verbose: boolean,
): Promise<Counts> {
  console.log(`  NOTE: Knesset Votes.svc exists with total_for/against/abstain but has no schema linkage to IsraelLawID.`)
  console.log(`  Votes attach to sess_item_id (session items); linking back to IsraelLaw needs Hebrew text matching.`)
  console.log(`  Skipping in this run; track as a separate ingester proposal.`)
  return { enriched: 0, skipped: sources.length, failed: 0 }
}

// ── EU Parliament vote data via HowTheyVote.eu ────────────────────────────────
// Strategy:
//   1. Download HowTheyVote.eu's latest votes.csv release (gzip).
//   2. Build map of texts_adopted_reference (e.g. P9_TA(2022)0040) → main RCV
//      vote counts (count_for / against / abstention / did_not_vote).
//   3. Match by parsing eu_parliament_v1 externalIds: ep_src_TA-X-YYYY-NNNN
//      → P{X}_TA({YYYY}){NNNN}.
// Source: github.com/HowTheyVote/data — releases include votes.csv.gz with
// the texts_adopted_reference column joining each RCV to its TA document.
// Coverage: EP-9 (Jul 2019 →) through current EP-10 plenaries; only TAs with
// recorded roll-call votes are present.

import * as path from 'path'
import * as zlib from 'zlib'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

interface HtvVote {
  id: string
  timestamp: string
  is_main: boolean
  count_for: number
  count_against: number
  count_abstention: number
  count_did_not_vote: number
  result: string
  reference: string
  display_title: string
  texts_adopted_reference: string
}

const HTV_RELEASES_API = 'https://api.github.com/repos/HowTheyVote/data/releases/latest'
const CACHE_DIR = path.join(process.cwd(), '.cache', 'howtheyvote')

async function ensureHtvVotesCsv(verbose: boolean): Promise<string> {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })

  // Find the latest release tag and download its votes.csv.gz once.
  const releaseInfo = await fetchJson<{ tag_name: string; assets: { name: string; browser_download_url: string }[] }>(
    HTV_RELEASES_API,
    { 'User-Agent': 'EpistemicReceipts/1.0' },
  )
  const tag = releaseInfo.tag_name
  const csvPath = path.join(CACHE_DIR, `votes-${tag}.csv`)
  if (fs.existsSync(csvPath)) {
    if (verbose) console.log(`  Cache hit: ${csvPath}`)
    return csvPath
  }

  const asset = releaseInfo.assets.find(a => a.name === 'votes.csv.gz')
  if (!asset) throw new Error('votes.csv.gz not found in HowTheyVote release assets')

  console.log(`  Downloading HowTheyVote votes.csv.gz (release ${tag})...`)
  const res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'EpistemicReceipts/1.0' } })
  if (!res.ok || !res.body) throw new Error(`HTV download failed: HTTP ${res.status}`)

  const tmpGz = path.join(CACHE_DIR, `votes-${tag}.csv.gz`)
  await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(tmpGz))

  await pipeline(fs.createReadStream(tmpGz), zlib.createGunzip(), fs.createWriteStream(csvPath))
  fs.unlinkSync(tmpGz)
  console.log(`  Cached: ${csvPath}`)
  return csvPath
}

// Minimal RFC-4180 CSV parser sufficient for HowTheyVote's votes.csv (no embedded newlines inside quotes).
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += ch
    } else {
      if (ch === ',') { out.push(cur); cur = '' }
      else if (ch === '"') inQuotes = true
      else cur += ch
    }
  }
  out.push(cur)
  return out
}

async function loadHtvVoteMap(verbose: boolean): Promise<Map<string, HtvVote>> {
  const csvPath = await ensureHtvVotesCsv(verbose)
  const text = fs.readFileSync(csvPath, 'utf-8')
  // HowTheyVote ships CSVs with CRLF — strip trailing CRs before parsing.
  const lines = text.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.length > 0)
  const header = parseCsvLine(lines[0]!)

  const col = (name: string) => {
    const idx = header.indexOf(name)
    if (idx === -1) throw new Error(`HTV CSV missing column: ${name}`)
    return idx
  }
  const iTa = col('texts_adopted_reference')
  const iIsMain = col('is_main')
  const iFor = col('count_for')
  const iAgainst = col('count_against')
  const iAbs = col('count_abstention')
  const iDnv = col('count_did_not_vote')
  const iId = col('id')
  const iTs = col('timestamp')
  const iRef = col('reference')
  const iTitle = col('display_title')
  const iResult = col('result')

  // Map: TA reference (e.g. P9_TA(2022)0040) → best vote (main + latest timestamp wins)
  const map = new Map<string, HtvVote>()
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]!)
    const ta = f[iTa]
    if (!ta) continue
    const vote: HtvVote = {
      id: f[iId]!,
      timestamp: f[iTs]!,
      is_main: f[iIsMain] === 'True',
      count_for: parseInt(f[iFor] ?? '0', 10) || 0,
      count_against: parseInt(f[iAgainst] ?? '0', 10) || 0,
      count_abstention: parseInt(f[iAbs] ?? '0', 10) || 0,
      count_did_not_vote: parseInt(f[iDnv] ?? '0', 10) || 0,
      result: f[iResult] ?? '',
      reference: f[iRef] ?? '',
      display_title: f[iTitle] ?? '',
      texts_adopted_reference: ta,
    }
    const existing = map.get(ta)
    if (!existing) { map.set(ta, vote); continue }
    // Prefer main vote; if both main, prefer later timestamp.
    if (vote.is_main && !existing.is_main) { map.set(ta, vote); continue }
    if (vote.is_main === existing.is_main && vote.timestamp > existing.timestamp) {
      map.set(ta, vote)
    }
  }

  if (verbose) console.log(`  HTV loaded: ${map.size} unique TA references`)
  return map
}

// Convert ep_src_TA-9-2022-0040 → P9_TA(2022)0040
function externalIdToTaRef(extId: string): string | null {
  const m = extId.match(/^ep_src_TA-(\d+)-(\d{4})-(\d+)$/)
  if (!m) return null
  const [, term, year, num] = m
  const padded = num!.padStart(4, '0')
  return `P${term}_TA(${year})${padded}`
}

async function enrichEuVotes(
  sources: { id: string; externalId: string | null; publishedAt: Date | null }[],
  dryRun: boolean,
  verbose: boolean,
): Promise<Counts> {
  const counts: Counts = { enriched: 0, skipped: 0, failed: 0 }

  let htv: Map<string, HtvVote>
  try {
    htv = await loadHtvVoteMap(verbose)
  } catch (err) {
    console.error(`  HTV load failed: ${err}`)
    counts.failed += sources.length
    return counts
  }

  for (const source of sources) {
    const extId = source.externalId
    if (!extId) { counts.skipped++; continue }
    const ref = externalIdToTaRef(extId)
    if (!ref) {
      if (verbose) console.log(`    [skip] unparseable externalId: ${extId}`)
      counts.skipped++
      continue
    }
    const vote = htv.get(ref)
    if (!vote) {
      if (verbose) console.log(`    [skip] no HTV vote for ${ref}`)
      counts.skipped++
      continue
    }

    if (dryRun) {
      if (verbose) console.log(`    [dry-run] ${extId} → ${ref}: for=${vote.count_for} against=${vote.count_against} abs=${vote.count_abstention} (main=${vote.is_main})`)
      counts.enriched++
      continue
    }

    const existing = await prisma.legislativeVote.findFirst({ where: { sourceId: source.id, dataSource: 'howtheyvote_eu' } })
    if (existing) { counts.skipped++; continue }

    const totalSeats = vote.count_for + vote.count_against + vote.count_abstention + vote.count_did_not_vote
    try {
      await prisma.legislativeVote.create({
        data: {
          sourceId: source.id,
          chamber: 'European Parliament',
          yesCount: vote.count_for,
          noCount: vote.count_against,
          abstainCount: vote.count_abstention,
          totalSeats: totalSeats > 0 ? totalSeats : null,
          passageThreshold: 'simple_majority',
          voteDate: vote.timestamp ? new Date(vote.timestamp.replace(' ', 'T') + 'Z') : null,
          passageType: 'legislative_vote',
          dataSource: 'howtheyvote_eu',
        },
      })
      counts.enriched++
      if (verbose) console.log(`    [enriched] ${extId} → ${ref}: ${vote.count_for}–${vote.count_against}`)
    } catch (err) {
      console.error(`    [failed] ${extId}: ${err}`)
      counts.failed++
    }
  }

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
  // If true, dry-run scans the full source list instead of the default 20-row
  // slice. Set on handlers whose matching is in-memory (no per-source HTTP).
  cheapDryRun?: boolean
}

const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  us: {
    label: 'United States',
    ingestedByTags: ['congress_v1', 'congress_bills_v1'],
    handler: enrichUsCongressVotes,
    cheapDryRun: true,
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
    cheapDryRun: true,
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

    // Fetch eligible sources. Order by publishedAt desc so dry-run samples
    // bias toward recent records (which have better external-API coverage).
    const sources = await prisma.source.findMany({
      where: {
        ingestedBy: { in: config.ingestedByTags },
        deleted: false,
      },
      select: { id: true, externalId: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      ...(limit > 0 ? { take: limit } : {}),
    })

    if (sources.length === 0) {
      console.log(`  No sources found for tags: ${config.ingestedByTags.join(', ')}`)
      continue
    }

    // In dry-run, work on a small subset to keep slow per-source handlers fast.
    // Handlers flagged cheapDryRun do in-memory matching and process everything.
    const workSources = dryRun && !config.cheapDryRun ? sources.slice(0, 20) : sources
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
