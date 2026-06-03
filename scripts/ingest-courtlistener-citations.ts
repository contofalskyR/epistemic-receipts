// CourtListener citation-graph ETL.
//
// Materialises ClaimRelation 'cites' edges between CourtListener opinion Claims
// already in our DB. We do NOT ingest the ~70M raw citation edges from
// /api/rest/v4/opinions-cited/ — instead, for each Claim whose externalId encodes
// a CourtListener cluster ID, we ask the API which of *our* opinions cite which
// other of *our* opinions, and persist only the both-ends-known edges.
//
// Pipeline order:
//   1. Load all Claims with ingestedBy IN ('courtlistener_scotus_v1',
//      'courtlistener_circuits_v1', 'courtlistener_state_supreme_v1'),
//      deleted=false. Parse the cluster ID out of externalId.
//   2. For each batch of cluster IDs (chunks of 100), fetch the underlying
//      opinion objects via /opinions/?cluster__in=... to learn
//      opinionId -> clusterId for everything in our DB.
//   3. For each batch of citing opinion IDs (chunks of 100), page through
//      /opinions-cited/?citing_opinion__in=... For each edge, if both the citing
//      and cited opinion map back to clusters we have, upsert a ClaimRelation
//      row (fromClaimId=citing, toClaimId=cited, relationType='cites', year=
//      citing claim's year).
//
// Requires: COURTLISTENER_TOKEN in .env.local
// Run:      npx dotenv-cli -e .env.local -- npx tsx \
//             scripts/ingest-courtlistener-citations.ts --dry-run [--slow] [--limit N]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4'

const PIPELINES = [
  'courtlistener_scotus_v1',
  'courtlistener_circuits_v1',
  'courtlistener_state_supreme_v1',
]

// externalId formats per pipeline (see corresponding ingest-*.ts scripts).
// SCOTUS uses the legacy `cl-cluster-` prefix; circuits + state-supreme prefix
// their own pipeline tag.
const EXTERNAL_ID_PATTERNS: Array<RegExp> = [
  /^cl-cluster-(\d+)$/,
  /^courtlistener_circuits_v1-(\d+)$/,
  /^courtlistener_state_supreme_v1-(\d+)$/,
]

// ── CLI flags ─────────────────────────────────────────────────────────────────

function parseDryRun(): boolean {
  return process.argv.includes('--dry-run')
}

function parseSlow(): boolean {
  return process.argv.includes('--slow')
}

function parseLimit(): number | null {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--limit')
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10)
    if (!isNaN(n) && n > 0) return n
  }
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── API fetch (matches ingest-courtlistener-circuits.ts) ─────────────────────

const TRANSIENT_STATUSES = new Set([502, 503, 504])
const MAX_429_WAIT_MS = 120_000

let MAX_RETRIES = 5
let REQUEST_DELAY_MS = 800
let FETCH_TIMEOUT_MS = 30_000

async function clFetch(urlOrPath: string, token: string): Promise<unknown> {
  const url = urlOrPath.startsWith('http') ? urlOrPath : `${BASE_URL}${urlOrPath}`

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    let res: Response
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    try {
      res = await fetch(url, {
        headers: {
          'Authorization': `Token ${token}`,
          'Accept': 'application/json',
        },
        signal: ctrl.signal,
      })
      clearTimeout(timer)
    } catch (networkErr) {
      clearTimeout(timer)
      if (attempt > MAX_RETRIES) throw networkErr
      const reason = (networkErr as Error)?.name === 'AbortError'
        ? `fetch timeout (${FETCH_TIMEOUT_MS / 1000}s)`
        : 'network error'
      const backoff = Math.min(2 ** attempt * 1000, 300_000)
      console.log(`  Retrying after ${reason} (attempt ${attempt}/${MAX_RETRIES}, waiting ${Math.ceil(backoff / 1000)}s)...`)
      await sleep(backoff)
      continue
    }

    if (res.status === 401) {
      throw new Error('CourtListener returned 401 — check COURTLISTENER_TOKEN in .env')
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10)
      const wait = isNaN(retryAfter) ? 60000 : retryAfter * 1000
      if (wait > MAX_429_WAIT_MS) {
        throw new Error(`CourtListener rate limit too long (${Math.ceil(wait / 1000)}s) — wait and restart`)
      }
      console.log(`  Rate limited (429) — waiting ${Math.ceil(wait / 1000)}s before retry...`)
      await sleep(wait)
      continue
    }

    if (TRANSIENT_STATUSES.has(res.status)) {
      if (attempt > MAX_RETRIES) {
        throw new Error(`CourtListener fetch failed: ${res.status} ${res.statusText} — ${url}`)
      }
      console.log(`  Retrying after ${res.status} (attempt ${attempt}/${MAX_RETRIES})...`)
      await sleep(2 ** attempt * 1000)
      continue
    }

    if (!res.ok) {
      throw new Error(`CourtListener fetch failed: ${res.status} ${res.statusText} — ${url}`)
    }

    return res.json()
  }

  throw new Error('clFetch: exhausted retries')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface ClaimRow {
  id: string
  externalId: string | null
  claimEmergedAt: Date | null
}

interface OpinionRecord {
  id: number
  cluster: string | number | null
}

interface OpinionsCitedEdge {
  citing_opinion: string | number | null
  cited_opinion: string | number | null
}

interface CLPage<T> {
  count: number
  next: string | null
  results: T[]
}

function clusterIdFromExternalId(externalId: string | null): string | null {
  if (!externalId) return null
  for (const re of EXTERNAL_ID_PATTERNS) {
    const m = re.exec(externalId)
    if (m) return m[1]
  }
  return null
}

// CourtListener returns related-object pointers as full URLs:
//   "https://www.courtlistener.com/api/rest/v4/opinions/12345/"
// or sometimes as bare integers. Extract the trailing numeric ID either way.
function extractTrailingId(value: string | number | null | undefined): string | null {
  if (value == null) return null
  if (typeof value === 'number') return String(value)
  const m = /(\d+)\/?\s*$/.exec(value)
  return m ? m[1] : null
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const token = process.env.COURTLISTENER_TOKEN
  if (!token) {
    console.error('\nError: COURTLISTENER_TOKEN not set in .env\n')
    process.exit(1)
  }

  const dryRun = parseDryRun()
  const slow = parseSlow()
  const limit = parseLimit()

  if (slow) {
    MAX_RETRIES = 10
    REQUEST_DELAY_MS = 1500
    FETCH_TIMEOUT_MS = 90_000
    console.log('  [slow mode] timeout=90s, delay=1.5s, retries=10')
  }

  console.log(
    `\n=== CourtListener Citation Graph ETL` +
    `${dryRun ? ' [DRY RUN]' : ''}` +
    `${limit ? ` (limit ${limit})` : ''} ===\n`,
  )

  // ── Step 1: load our Claims ────────────────────────────────────────────────
  const claims: ClaimRow[] = await prisma.claim.findMany({
    where: {
      ingestedBy: { in: PIPELINES },
      deleted: false,
    },
    select: {
      id: true,
      externalId: true,
      claimEmergedAt: true,
    },
    ...(limit ? { take: limit } : {}),
  })

  // clusterId (string of digits) → { claimId, year? }
  const clusterToClaim = new Map<string, { claimId: string; year: number | null }>()
  for (const c of claims) {
    const clusterId = clusterIdFromExternalId(c.externalId)
    if (!clusterId) continue
    const year = c.claimEmergedAt ? c.claimEmergedAt.getUTCFullYear() : null
    clusterToClaim.set(clusterId, { claimId: c.id, year })
  }

  const allClusterIds = Array.from(clusterToClaim.keys())
  console.log(`Loaded ${claims.length} claims; ${allClusterIds.length} have parseable cluster IDs.\n`)

  if (allClusterIds.length === 0) {
    console.log('Nothing to do.')
    await prisma.$disconnect()
    return
  }

  // ── Step 2: resolve cluster IDs → opinion IDs ──────────────────────────────
  // Map: opinionId (string) → clusterId (string). Only contains opinions whose
  // cluster lives in our DB — exactly what we need to test "is this end of an
  // edge something we know about?".
  const opinionToCluster = new Map<string, string>()

  const clusterBatches = chunk(allClusterIds, 100)
  console.log(`Resolving opinion IDs for ${allClusterIds.length} clusters in ${clusterBatches.length} batch(es)...`)

  for (let i = 0; i < clusterBatches.length; i++) {
    const batch = clusterBatches[i]
    let nextUrl: string | null =
      `/opinions/?cluster__in=${batch.join(',')}&page_size=100&fields=id,cluster`

    while (nextUrl) {
      await sleep(REQUEST_DELAY_MS)
      const page = (await clFetch(nextUrl, token)) as CLPage<OpinionRecord>
      for (const op of page.results ?? []) {
        if (op.id == null) continue
        const clusterId = extractTrailingId(op.cluster)
        if (!clusterId) continue
        if (!clusterToClaim.has(clusterId)) continue
        opinionToCluster.set(String(op.id), clusterId)
      }
      nextUrl = page.next
    }

    if ((i + 1) % 10 === 0 || i === clusterBatches.length - 1) {
      console.log(`  cluster batch ${i + 1}/${clusterBatches.length} — opinions resolved: ${opinionToCluster.size}`)
    }
  }

  const allOpinionIds = Array.from(opinionToCluster.keys())
  console.log(`\nResolved ${allOpinionIds.length} opinion IDs across ${clusterToClaim.size} clusters.\n`)

  if (allOpinionIds.length === 0) {
    console.log('No opinions to query.')
    await prisma.$disconnect()
    return
  }

  // ── Step 3: pull citation edges ────────────────────────────────────────────
  // For each batch of our opinion IDs, page through /opinions-cited/ and keep
  // only the edges whose other end also maps back to a cluster we have.
  interface CitationPair {
    citingClaimId: string
    citedClaimId: string
    year: number | null
  }
  const pairs: CitationPair[] = []
  // Dedup at collection time — same (citing,cited) can in principle appear
  // twice if a cluster has multiple opinions.
  const seenPair = new Set<string>()

  const opinionBatches = chunk(allOpinionIds, 100)
  console.log(`Fetching opinions-cited for ${allOpinionIds.length} opinions in ${opinionBatches.length} batch(es)...`)

  let edgesScanned = 0
  for (let i = 0; i < opinionBatches.length; i++) {
    const batch = opinionBatches[i]
    let nextUrl: string | null =
      `/opinions-cited/?citing_opinion__in=${batch.join(',')}&page_size=100`

    while (nextUrl) {
      await sleep(REQUEST_DELAY_MS)
      const page = (await clFetch(nextUrl, token)) as CLPage<OpinionsCitedEdge>
      for (const edge of page.results ?? []) {
        edgesScanned++
        const citingOpId = extractTrailingId(edge.citing_opinion)
        const citedOpId = extractTrailingId(edge.cited_opinion)
        if (!citingOpId || !citedOpId) continue

        const citingClusterId = opinionToCluster.get(citingOpId)
        const citedClusterId = opinionToCluster.get(citedOpId)
        if (!citingClusterId || !citedClusterId) continue
        if (citingClusterId === citedClusterId) continue // self-reference between opinions in the same cluster

        const citing = clusterToClaim.get(citingClusterId)
        const cited = clusterToClaim.get(citedClusterId)
        if (!citing || !cited) continue
        if (citing.claimId === cited.claimId) continue

        const key = `${citing.claimId} ${cited.claimId}`
        if (seenPair.has(key)) continue
        seenPair.add(key)

        pairs.push({
          citingClaimId: citing.claimId,
          citedClaimId: cited.claimId,
          year: citing.year,
        })
      }
      nextUrl = page.next
    }

    if ((i + 1) % 10 === 0 || i === opinionBatches.length - 1) {
      console.log(`  opinion batch ${i + 1}/${opinionBatches.length} — both-ends-in-DB pairs so far: ${pairs.length} (scanned ${edgesScanned} raw edges)`)
    }
  }

  console.log(`\nFound ${pairs.length} citation pairs where both endpoints live in our DB.\n`)

  // ── Step 4: persist ClaimRelation rows ─────────────────────────────────────
  let created = 0
  let skipped = 0
  let errors = 0

  if (dryRun) {
    console.log('[DRY RUN] No DB writes. Sample (first 5 pairs):')
    for (const p of pairs.slice(0, 5)) {
      console.log(`  ${p.citingClaimId} -[cites:${p.year ?? '?'}]-> ${p.citedClaimId}`)
    }
  } else {
    for (const p of pairs) {
      try {
        await prisma.claimRelation.create({
          data: {
            fromClaimId: p.citingClaimId,
            toClaimId: p.citedClaimId,
            relationType: 'cites',
            year: p.year ?? undefined,
          },
        })
        created++
      } catch (e: unknown) {
        if ((e as { code?: string })?.code === 'P2002') {
          // unique constraint on (fromClaimId, toClaimId, relationType) — idempotent
          skipped++
        } else {
          errors++
          const msg = e instanceof Error ? e.message : String(e)
          console.error(`  Failed: ${p.citingClaimId} -> ${p.citedClaimId} — ${msg}`)
        }
      }
    }
  }

  console.log(`\n=== Totals ===`)
  console.log(`  Claims queried        : ${claims.length}`)
  console.log(`  Clusters parsed       : ${allClusterIds.length}`)
  console.log(`  Opinions resolved     : ${allOpinionIds.length}`)
  console.log(`  Raw edges scanned     : ${edgesScanned}`)
  console.log(`  Citation pairs found  : ${pairs.length}`)
  console.log(`  ClaimRelations created: ${dryRun ? '0 (dry run)' : created}`)
  console.log(`  Skipped (already exist): ${dryRun ? '—' : skipped}`)
  console.log(`  Errors                : ${dryRun ? '—' : errors}\n`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
