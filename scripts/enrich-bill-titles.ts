// Enrichment: Bill Titles for congress_v1 Sources
// Backfills real bill titles into Source.name for congress_v1 records using
// the Congress.gov v3 API. Idempotent — only touches Sources whose name is
// still the generic placeholder ("Congress.gov: H.R. 82 (118th Congress)"),
// starts with "congress_law_", or is null. Already-enriched names are left
// alone so repeat runs only fill remaining gaps.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-bill-titles.ts --dry-run --limit 20
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-bill-titles.ts --full
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-bill-titles.ts --full --limit 100

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CONGRESS_BASE = 'https://api.congress.gov/v3'
const THROTTLE_MS = 400
const RATE_LIMIT_BACKOFF_MS = 30_000
const MAX_TITLE_LENGTH = 280  // safety ceiling; only truncates extremely long official titles
const SHORT_TITLE_BUDGET = 120

// Bill type → URL segment (Congress.gov accepts lowercase short codes)
const BILL_TYPE_URL: Record<string, string> = {
  HR:      'hr',
  S:       's',
  HJRES:   'hjres',
  SJRES:   'sjres',
  HCONRES: 'hconres',
  SCONRES: 'sconres',
  HRES:    'hres',
  SRES:    'sres',
}

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --full [--limit N] [--verbose]')
        process.exit(1) as never
      })()
  const li = args.indexOf('--limit')
  return {
    mode: mode as 'dry-run' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ── HTTP ───────────────────────────────────────────────────────────────────────

interface BillResponse {
  bill?: {
    title?: string
    type?: string
    number?: string
    congress?: number
  }
}

interface TitlesResponse {
  titles?: Array<{
    title?: string
    titleType?: string
    titleTypeCode?: number
  }>
}

let lastReqAt = 0
async function throttle() {
  const wait = THROTTLE_MS - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function congressFetch<T>(url: string, retries = 3): Promise<T | null> {
  let attempt = 0
  let delay = 2000
  while (attempt <= retries) {
    await throttle()
    let res: Response
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } })
    } catch (err) {
      if (attempt >= retries) throw err
      await sleep(delay); delay *= 2; attempt++; continue
    }
    if (res.status === 404) return null
    if (res.status === 429) {
      console.warn(`  HTTP 429 — sleeping ${RATE_LIMIT_BACKOFF_MS}ms`)
      await sleep(RATE_LIMIT_BACKOFF_MS)
      attempt++
      continue
    }
    if ([502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay); delay *= 2; attempt++; continue
    }
    if (!res.ok) {
      throw new Error(`Congress API ${res.status} at ${url.replace(/api_key=[^&]+/, 'api_key=REDACTED')}`)
    }
    return res.json() as Promise<T>
  }
  return null
}

// ── Title selection ────────────────────────────────────────────────────────────
// Prefer the main bill.title if it fits the short-title budget (≤120 chars).
// Otherwise consult the /titles endpoint for an official "Short Title" entry
// and pick the shortest one that fits. Fall back to the long bill.title if
// no short title is found.

function normalizeTitle(t: string): string {
  return t.replace(/\s+/g, ' ').trim()
}

async function pickShortTitle(
  congress: number,
  billTypeLower: string,
  number: string,
  apiKey: string,
): Promise<string | null> {
  const url = `${CONGRESS_BASE}/bill/${congress}/${billTypeLower}/${number}/titles?api_key=${encodeURIComponent(apiKey)}&format=json&limit=250`
  const data = await congressFetch<TitlesResponse>(url)
  if (!data?.titles?.length) return null
  const shorts = data.titles
    .filter(t => typeof t.title === 'string' && t.title.length > 0)
    .filter(t => (t.titleType ?? '').toLowerCase().includes('short') || t.titleType === 'Display Title')
    .map(t => normalizeTitle(t.title!))
    .filter(t => t.length > 0 && t.length <= SHORT_TITLE_BUDGET)
  if (shorts.length === 0) return null
  shorts.sort((a, b) => a.length - b.length)
  return shorts[0] ?? null
}

async function resolveBillTitle(
  congress: number,
  billType: string,
  number: string,
  apiKey: string,
): Promise<string | null> {
  const lower = BILL_TYPE_URL[billType.toUpperCase()] ?? billType.toLowerCase()
  const url = `${CONGRESS_BASE}/bill/${congress}/${lower}/${number}?api_key=${encodeURIComponent(apiKey)}&format=json`
  const data = await congressFetch<BillResponse>(url)
  const raw = data?.bill?.title
  if (!raw) return null
  const main = normalizeTitle(raw)
  if (!main) return null
  if (main.length <= SHORT_TITLE_BUDGET) return main
  const short = await pickShortTitle(congress, lower, number, apiKey)
  if (short) return short
  if (main.length <= MAX_TITLE_LENGTH) return main
  return main.slice(0, MAX_TITLE_LENGTH - 1).trimEnd() + '…'
}

// ── Generic-name detection ─────────────────────────────────────────────────────
// A Source.name is considered "generic" (eligible for enrichment) if it
// matches the original ingester's placeholder shape, starts with the bare
// externalId-style "congress_law_" prefix, or is empty.

const GENERIC_NAME_RE = /^Congress\.gov:\s+[A-Z.]+(?:\s?J?\.?(?:Con)?Res\.)?\s*\d+\s+\(\d+\w{2}\s+Congress\)\s*$/i
const LEGACY_PREFIX_RE = /^congress_law_/i

function isGenericName(name: string | null | undefined): boolean {
  if (!name) return true
  if (LEGACY_PREFIX_RE.test(name)) return true
  if (GENERIC_NAME_RE.test(name)) return true
  return false
}

// ── Candidate loading ──────────────────────────────────────────────────────────

interface Candidate {
  sourceId: string
  externalId: string | null
  currentName: string
  congress: number
  billType: string
  billNumber: string
}

async function loadCandidates(limit: number): Promise<Candidate[]> {
  // Pull all congress_v1 sources, filter in JS so we can use the same regex
  // logic in --dry-run reports. 10k rows fits comfortably in memory.
  const rows = await prisma.source.findMany({
    where: { ingestedBy: 'congress_v1', deleted: false },
    select: {
      id: true,
      name: true,
      externalId: true,
      edges: {
        where: { deleted: false },
        take: 1,
        select: { claim: { select: { metadata: true } } },
      },
    },
  })

  const candidates: Candidate[] = []
  for (const r of rows) {
    if (!isGenericName(r.name)) continue
    const meta = (r.edges[0]?.claim?.metadata ?? null) as
      | { billType?: unknown; billNumber?: unknown; congress?: unknown }
      | null
    if (!meta) continue
    const billType = typeof meta.billType === 'string' ? meta.billType : null
    const billNumber = typeof meta.billNumber === 'string'
      ? meta.billNumber
      : (typeof meta.billNumber === 'number' ? String(meta.billNumber) : null)
    const congress = typeof meta.congress === 'number'
      ? meta.congress
      : (typeof meta.congress === 'string' ? parseInt(meta.congress, 10) : NaN)
    if (!billType || !billNumber || !congress || isNaN(congress)) continue
    candidates.push({
      sourceId: r.id,
      externalId: r.externalId,
      currentName: r.name ?? '',
      congress,
      billType: billType.toUpperCase(),
      billNumber,
    })
    if (limit > 0 && candidates.length >= limit) break
  }
  return candidates
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, verbose } = parseArgs()
  const apiKey = process.env.CONGRESS_API_KEY
  if (!apiKey) {
    console.error('CONGRESS_API_KEY missing from environment.')
    process.exit(1)
  }

  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to enable DB writes.')
    process.exit(1)
  }

  console.log('\n── Enrichment: Bill Titles (congress_v1) ──────────────────────────')
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  const total = await prisma.source.count({ where: { ingestedBy: 'congress_v1', deleted: false } })
  console.log(`Total congress_v1 sources in DB: ${total}`)

  console.log('Loading candidates (sources with generic names + claim metadata)...')
  const candidates = await loadCandidates(limit)
  console.log(`Candidates to enrich: ${candidates.length}`)

  if (candidates.length === 0) {
    console.log('Nothing to do.')
    return
  }

  let enriched = 0
  let skipped = 0
  let failed = 0
  const examples: Array<{ before: string; after: string; bill: string }> = []
  const startTime = Date.now()

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!
    const billLabel = `${c.congress}/${c.billType}/${c.billNumber}`
    try {
      const title = await resolveBillTitle(c.congress, c.billType, c.billNumber, apiKey)
      if (!title) {
        failed++
        if (verbose) console.warn(`  [no-title] ${billLabel}`)
        continue
      }
      if (title === c.currentName) {
        skipped++
        continue
      }

      if (mode === 'dry-run') {
        if (examples.length < 20) {
          examples.push({ before: c.currentName, after: title, bill: billLabel })
        }
        enriched++
      } else {
        await prisma.source.update({
          where: { id: c.sourceId },
          data: { name: title },
        })
        enriched++
        if (verbose) console.log(`  [updated] ${billLabel} → ${title.slice(0, 80)}`)
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  [error] ${billLabel} — ${msg}`)
    }

    if ((i + 1) % 100 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`  Progress: ${i + 1}/${candidates.length} | enriched=${enriched} skipped=${skipped} failed=${failed} | ${elapsed}s elapsed`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nDone in ${elapsed}s`)
  console.log(`  Enriched: ${enriched}`)
  console.log(`  Skipped (already correct): ${skipped}`)
  console.log(`  Failed: ${failed}`)

  if (mode === 'dry-run' && examples.length > 0) {
    console.log('\nSample title diffs (would-be updates):')
    for (const ex of examples) {
      console.log(`  ${ex.bill}`)
      console.log(`    before: ${ex.before}`)
      console.log(`    after:  ${ex.after}`)
    }
  }

  if (mode === 'full') {
    // Independent DB verification per CLAUDE.md rule 6.
    const remainingGeneric = await prisma.source.count({
      where: {
        ingestedBy: 'congress_v1',
        deleted: false,
        OR: [
          { name: { startsWith: 'Congress.gov: ' } },
          { name: { startsWith: 'congress_law_' } },
        ],
      },
    })
    console.log(`\nDB verification: ${remainingGeneric} congress_v1 sources still match the generic prefixes`)
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
