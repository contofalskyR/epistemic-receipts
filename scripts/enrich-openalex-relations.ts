// OpenAlex citation graph enrichment
//
// Builds the ClaimRelation table for OpenAlex-sourced claims by walking each
// work's `referenced_works`, `related_works`, and citing works (via
// `cited_by_api_url`). Citing works that aren't already in the DB are inserted
// as lightweight stub Claims (status=PROVISIONAL, ingestedBy=openalex_stub_v1)
// so the relation has a destination.
//
// Run: npx ts-node --project tsconfig.scripts.json scripts/enrich-openalex-relations.ts --dry-run
// Full: ALLOW_EDITS=true npx ts-node --project tsconfig.scripts.json scripts/enrich-openalex-relations.ts --commit

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const OA_BASE = 'https://api.openalex.org'
const MAILTO  = 'robert.contofalsky@rutgers.edu'
const UA      = `epistemic-receipts/1.0 (mailto:${MAILTO})`
const MIN_INTERVAL_MS = 100 // 10 req/sec polite ceiling
const CITED_BY_LIMIT = 10   // top citing papers per work

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run') || !args.includes('--commit')
  const commit = args.includes('--commit')
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? '0', 10) || 0 : 0
  const skipStubs = args.includes('--no-stubs')
  return { dryRun, commit, limit, skipStubs }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

let lastReqAt = 0
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }
async function throttle() {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function fetchJson<T = unknown>(url: string, retries = 3): Promise<T | null> {
  let delay = 1000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    let res: Response
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    } catch (err) {
      if (attempt >= retries) {
        console.warn(`  fetch error after ${retries} retries: ${(err as Error).message}`)
        return null
      }
      await sleep(delay); delay *= 2; continue
    }
    if (res.status === 404) return null
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '0', 10)
      const wait = retryAfter > 0 ? retryAfter * 1000 : delay
      console.warn(`  HTTP ${res.status} — waiting ${wait}ms`)
      await sleep(wait); delay *= 2; continue
    }
    if (!res.ok) {
      console.warn(`  HTTP ${res.status} ${url}`)
      return null
    }
    try { return (await res.json()) as T } catch { return null }
  }
  return null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractWorkId(idOrUrl: string | null | undefined): string | null {
  if (!idOrUrl) return null
  const m = /\/W(\d+)$/i.exec(idOrUrl) || /^W(\d+)$/i.exec(idOrUrl)
  return m ? `W${m[1]}` : null
}

interface OAWork {
  id?: string
  doi?: string | null
  title?: string | null
  publication_year?: number | null
  publication_date?: string | null
  cited_by_count?: number | null
  referenced_works?: string[] | null
  related_works?: string[] | null
  cited_by_api_url?: string | null
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit, skipStubs } = parseArgs()

  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('Refusing to write without ALLOW_EDITS=true. Pass --dry-run to preview.')
    process.exit(1)
  }

  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'COMMIT'}`)
  if (limit > 0) console.log(`Limit: ${limit} source claims`)
  if (skipStubs) console.log('Stub creation disabled (--no-stubs)')

  // Find all OpenAlex-sourced claims. We can't filter by Claim.source.url cheaply
  // because that's an Edge→Source join; the canonical signal is externalId.
  console.log('Loading OpenAlex-sourced claims…')
  const baseWhere = { externalId: { startsWith: 'openalex_W' }, deleted: false } as const
  const total = await prisma.claim.count({ where: baseWhere })
  console.log(`Found ${total.toLocaleString()} OpenAlex claims`)

  const take = limit > 0 ? limit : total
  const claims = await prisma.claim.findMany({
    where: baseWhere,
    select: { id: true, externalId: true, openAlexId: true, metadata: true },
    take,
  })

  const stats = {
    processed: 0,
    workFetchOk: 0,
    workFetchFail: 0,
    citesAdded: 0,
    relatedAdded: 0,
    citedByAdded: 0,
    stubsCreated: 0,
    relationsSkippedExisting: 0,
  }

  // Build claim-id index by openalex workId for fast lookup.
  // We index by externalId since openAlexId may be null until populated.
  console.log('Building workId → claimId index…')
  const allOaClaims = await prisma.claim.findMany({
    where: { OR: [{ externalId: { startsWith: 'openalex_W' } }, { openAlexId: { not: null } }] },
    select: { id: true, externalId: true, openAlexId: true },
  })
  const workIdToClaim = new Map<string, string>()
  for (const c of allOaClaims) {
    const wid = c.openAlexId ?? extractWorkId(c.externalId?.replace(/^openalex_/, '') ?? null) ?? null
    if (wid) workIdToClaim.set(wid, c.id)
  }
  console.log(`Indexed ${workIdToClaim.size.toLocaleString()} workIds`)

  for (const claim of claims) {
    stats.processed += 1
    const workId = claim.openAlexId
      ?? extractWorkId(claim.externalId?.replace(/^openalex_/, '') ?? null)
      ?? null
    if (!workId) continue

    if (stats.processed % 50 === 0 || stats.processed === 1) {
      console.log(
        `[${stats.processed}/${claims.length}] ` +
        `cites=${stats.citesAdded} related=${stats.relatedAdded} ` +
        `cited_by=${stats.citedByAdded} stubs=${stats.stubsCreated} ` +
        `existing=${stats.relationsSkippedExisting}`,
      )
    }

    // Backfill Claim.openAlexId on the source claim if missing.
    if (!claim.openAlexId && !dryRun) {
      try {
        await prisma.claim.update({ where: { id: claim.id }, data: { openAlexId: workId } })
      } catch { /* ignore */ }
    }

    const work = await fetchJson<OAWork>(`${OA_BASE}/works/${workId}?mailto=${encodeURIComponent(MAILTO)}`)
    if (!work) { stats.workFetchFail += 1; continue }
    stats.workFetchOk += 1

    // 1) Outgoing CITES (this paper → papers it cites)
    for (const refUrl of work.referenced_works ?? []) {
      const otherWid = extractWorkId(refUrl)
      if (!otherWid) continue
      const otherClaimId = workIdToClaim.get(otherWid)
      if (!otherClaimId) continue
      if (otherClaimId === claim.id) continue

      const inserted = await upsertRelation(
        claim.id, otherClaimId, 'CITES', null, dryRun, stats,
      )
      if (inserted) stats.citesAdded += 1
    }

    // 2) RELATED (topically similar)
    for (const relUrl of work.related_works ?? []) {
      const otherWid = extractWorkId(relUrl)
      if (!otherWid) continue
      const otherClaimId = workIdToClaim.get(otherWid)
      if (!otherClaimId) continue
      if (otherClaimId === claim.id) continue

      const inserted = await upsertRelation(
        claim.id, otherClaimId, 'RELATED', null, dryRun, stats,
      )
      if (inserted) stats.relatedAdded += 1
    }

    // 3) CITED_BY — fetch top N most-recent citing papers
    if (work.cited_by_api_url) {
      const citedByUrl = `${work.cited_by_api_url}&sort=publication_year:desc&per-page=${CITED_BY_LIMIT}&mailto=${encodeURIComponent(MAILTO)}`
      const citedRes = await fetchJson<{ results?: OAWork[] }>(citedByUrl)
      const results = citedRes?.results ?? []
      for (const citing of results) {
        const otherWid = extractWorkId(citing.id)
        if (!otherWid) continue
        let otherClaimId = workIdToClaim.get(otherWid)

        if (!otherClaimId && !skipStubs) {
          // Create a lightweight stub claim
          const stubId = await createStubClaim(citing, otherWid, dryRun)
          if (stubId) {
            otherClaimId = stubId
            workIdToClaim.set(otherWid, stubId)
            stats.stubsCreated += 1
          }
        }
        if (!otherClaimId) continue
        if (otherClaimId === claim.id) continue

        const inserted = await upsertRelation(
          claim.id, otherClaimId, 'CITED_BY',
          citing.publication_year ?? null,
          dryRun, stats,
        )
        if (inserted) stats.citedByAdded += 1
      }
    }
  }

  console.log('\n— Summary —')
  console.log(JSON.stringify(stats, null, 2))

  await prisma.$disconnect()
}

// ── DB helpers ───────────────────────────────────────────────────────────────

async function upsertRelation(
  fromClaimId: string,
  toClaimId: string,
  relationType: 'CITES' | 'RELATED' | 'CITED_BY',
  year: number | null,
  dryRun: boolean,
  stats: { relationsSkippedExisting: number },
): Promise<boolean> {
  if (dryRun) return true
  try {
    await prisma.claimRelation.create({
      data: { fromClaimId, toClaimId, relationType, year },
    })
    return true
  } catch (err) {
    // Unique violation → already exists
    const msg = (err as Error).message ?? ''
    if (msg.includes('Unique constraint') || msg.includes('P2002')) {
      stats.relationsSkippedExisting += 1
      return false
    }
    console.warn(`  relation upsert error: ${msg}`)
    return false
  }
}

async function createStubClaim(
  work: OAWork,
  workId: string,
  dryRun: boolean,
): Promise<string | null> {
  const title = work.title?.trim()
  if (!title) return null
  if (dryRun) return `stub_${workId}` // sentinel — used only for dedupe within the dry run

  const externalId = `openalex_${workId}`
  const sourceUrl = work.doi ? `https://doi.org/${work.doi.replace(/^https?:\/\/doi\.org\//, '')}` : null

  try {
    const existing = await prisma.claim.findUnique({ where: { externalId } })
    if (existing) return existing.id

    const claim = await prisma.claim.create({
      data: {
        text: title.slice(0, 500),
        claimType: 'EMPIRICAL',
        currentStatus: 'DISPUTED',
        verificationStatus: 'PROVISIONAL',
        claimEmergedAt: work.publication_year
          ? new Date(Date.UTC(work.publication_year, 0, 1))
          : null,
        claimEmergedPrecision: work.publication_year ? 'YEAR' : null,
        ingestedBy: 'openalex_stub_v1',
        humanReviewed: false,
        autoApproved: false,
        externalId,
        openAlexId: workId,
        metadata: {
          dataset: 'openalex_stub_v1',
          openalex_id: workId,
          title,
          doi: work.doi ?? null,
          publication_year: work.publication_year ?? null,
          source_url: sourceUrl,
          stub_reason: 'created_by_enrich_openalex_relations',
        },
      },
    })
    return claim.id
  } catch (err) {
    console.warn(`  stub create failed (${workId}): ${(err as Error).message}`)
    return null
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
