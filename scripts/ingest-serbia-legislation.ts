// Pipeline 96 — Serbia Legislation (serbia_legislation_v1)
// Dataset: Official Legal Information System of the Republic of Serbia
// Source: https://www.pravno-informacioni-sistem.rs/SlGlasnikPortal/reg/viewAct/{uuid}
//
// ── BLOCKER: SPA + AUTH-GATED API ────────────────────────────────────────────
// pravno-informacioni-sistem.rs is a Vue.js SPA (previously AngularJS until ~2019).
// ALL API endpoints return the 13 kB SPA HTML shell for unauthenticated requests:
//
//   GET /SlGlasnikPortal/api/reg/actViewUuid/{uuid}  → text/html (SPA shell)
//   POST /SlGlasnikPortal/api/mml/standardSearch     → text/html (SPA shell)
//   GET /SlGlasnikPortal/api/reg/hasChildActs/{uuid} → text/html (SPA shell, live)
//
// Only the filter-options endpoint was ever captured with JSON content in Wayback
// (2021), but it returns only filter metadata, not act data.
//
// The ELI collection endpoint (/SlGlasnikPortal/eli/collection) 302-redirects to
// the SPA homepage. ELI content negotiation (Accept: application/xml etc.) returns
// the same SPA shell — no XML/RDF representation is available.
//
// skupstina.rs (Parliament website) has DNS resolution failure from this network.
//
// Wayback CDX enumeration yields 1,433 unique viewAct UUID URLs (status=200),
// but those snapshots are all SPA shells with no act metadata embedded.
//
// The only CDX-accessible JSON endpoint is hasChildActs/{uuid} → {"hasChildActs": bool}
// (via Wayback 2021-era captures; returns SPA shell on the live site today).
//
// RESOLUTION PATH: This pipeline requires either
//   (a) a paid subscription to pravno-informacioni-sistem.rs with API credentials, or
//   (b) a browser-automation approach (Puppeteer / Playwright) that can execute
//       the Vue.js app and intercept the XHR responses to /api/reg/actViewUuid/.
// ─────────────────────────────────────────────────────────────────────────────
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-serbia-legislation.ts --dry-run
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-serbia-legislation.ts --sample 10
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-serbia-legislation.ts --full [--verbose]
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'serbia_legislation_v1'
const PIPELINE = 'Pipeline 96'
const CDX_API = 'http://web.archive.org/cdx/search/cdx'
const WAYBACK = 'https://web.archive.org/web'
const LIVE_BASE = 'https://pravno-informacioni-sistem.rs'
const REQUEST_DELAY_MS = 800
const CDX_PAGE_SIZE = 5000

interface ActSlug {
  uuid: string
  timestamp: string
  originalUrl: string
}

interface ActRecord {
  uuid: string
  timestamp: string
  originalUrl: string
  title: string | null
  year: number | null
}

type Counts = { ingested: number; skipped: number; errors: number }
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full [--verbose]')
        process.exit(1) as never
      })()
  const sai = args.indexOf('--sample')
  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ── HTTP ───────────────────────────────────────────────────────────────────────

function httpGet(urlStr: string, timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const lib = parsed.protocol === 'https:' ? https : http
    const req = (lib as typeof https).request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: parsed.protocol === 'https:' ? 443 : 80,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0; legal research)',
          'Accept': 'application/json,text/html,*/*',
          'Accept-Language': 'sr,en;q=0.8',
        },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpGet(new URL(res.headers.location, urlStr).toString(), timeoutMs).then(resolve, reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} for ${urlStr}`))
            return
          }
          resolve(Buffer.concat(chunks).toString('utf8'))
        })
        res.on('error', reject)
      }
    )
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${urlStr}`)) })
    req.on('error', reject)
    req.end()
  })
}

// ── CDX enumeration ────────────────────────────────────────────────────────────

async function getCdxSlugs(): Promise<ActSlug[]> {
  const url = `${CDX_API}?url=pravno-informacioni-sistem.rs/SlGlasnikPortal/reg/viewAct/*` +
    `&output=json&fl=original,timestamp&collapse=urlkey&filter=statuscode:200&limit=${CDX_PAGE_SIZE}`

  let body: string
  try {
    body = await httpGet(url, 60000)
  } catch (err) {
    console.error(`  CDX error: ${(err as Error).message}`)
    return []
  }

  let data: string[][]
  try {
    data = JSON.parse(body) as string[][]
  } catch {
    console.error('  CDX parse error')
    return []
  }

  const seen = new Set<string>()
  const results: ActSlug[] = []

  for (const row of data.slice(1)) {
    const [originalUrl, timestamp] = row
    if (!originalUrl || !timestamp) continue

    // Extract UUID from /reg/viewAct/{uuid}
    const m = /\/reg\/viewAct\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(originalUrl)
    if (!m) continue

    const uuid = m[1]!.toLowerCase()
    if (seen.has(uuid)) continue
    seen.add(uuid)

    results.push({ uuid, timestamp, originalUrl })
  }

  return results
}

// ── Act detail fetch (BLOCKED — API returns SPA shell) ────────────────────────
//
// The live /api/reg/actViewUuid/{uuid} and /reg/viewAct/{uuid} endpoints both
// return the SPA HTML shell rather than act metadata for unauthenticated requests.
//
// Wayback-cached pages are also SPA shells — the AngularJS/Vue.js app always
// loaded act data via authenticated API calls; the static HTML never contained
// act titles or dates.
//
// For future use: if API credentials become available, replace this function with
// a JSON fetch to /SlGlasnikPortal/api/reg/actViewUuid/{uuid} with a valid
// session cookie/token. The response is expected to contain `{ naziv: string,
// datumObjave: string, vrstaAkta: string, ... }` fields.
//
async function fetchActDetail(slug: ActSlug): Promise<{ title: string | null; year: number | null }> {
  // Attempt 1: live API (blocked — returns SPA shell for unauthenticated users)
  const apiUrl = `${LIVE_BASE}/SlGlasnikPortal/api/reg/actViewUuid/${slug.uuid}`
  try {
    const body = await httpGet(apiUrl, 15000)
    // Detect SPA shell vs actual JSON
    if (body.trimStart().startsWith('{')) {
      const d = JSON.parse(body) as Record<string, unknown>
      const title = (d['naziv'] ?? d['title'] ?? d['name'] ?? null) as string | null
      const dateStr = (d['datumObjave'] ?? d['publishedDate'] ?? null) as string | null
      const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) || null : null
      if (title) return { title, year }
    }
  } catch { /* blocked or error */ }

  // Attempt 2: Wayback-cached page with exact timestamp — also SPA shell
  // (documented above — not attempted to avoid pointless requests)

  return { title: null, year: null }
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()
async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | undefined
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (parent) parentTopicId = parent.id
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Write one record ───────────────────────────────────────────────────────────

async function writeRow(tx: TxClient, rec: ActRecord, topicId: string): Promise<'ingested' | 'skipped' | 'failed'> {
  const externalId = `${INGESTED_BY}_${rec.uuid}`
  const existing = await tx.claim.findUnique({ where: { externalId }, select: { id: true } })
  if (existing) return 'skipped'

  if (!rec.title) return 'skipped'  // skip records without resolvable titles

  try {
    const claimEmergedAt = rec.year ? new Date(`${rec.year}-01-01T00:00:00Z`) : null
    const sourceUrl = `${LIVE_BASE}/SlGlasnikPortal/reg/viewAct/${rec.uuid}`

    const source = await tx.source.upsert({
      where: { externalId: `src_${externalId}` },
      update: {},
      create: {
        externalId: `src_${externalId}`,
        name: `Службени гласник РС — ${rec.title.slice(0, 120)}`,
        url: sourceUrl,
        publishedAt: claimEmergedAt,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: `Republika Srbija je donela: ${rec.title}.`,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt,
        claimEmergedPrecision: rec.year ? 'YEAR' : undefined,
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId,
        metadata: {
          dataset: INGESTED_BY,
          uuid: rec.uuid,
          title: rec.title,
          year: rec.year,
          country: 'Serbia',
          countryCode: 'rs',
        },
      },
    })

    await tx.edge.create({
      data: { claimId: claim.id, sourceId: source.id, type: 'CITES', ingestedBy: INGESTED_BY, autoApproved: true },
    })
    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })
    return 'ingested'
  } catch (err) {
    console.error(`  Error writing ${externalId}: ${err}`)
    return 'failed'
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, sampleN, verbose } = parseArgs()
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE}: Serbia Legislation (serbia_legislation_v1) ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}`)
  console.log()
  console.log('BLOCKER: pravno-informacioni-sistem.rs is a Vue.js SPA with auth-gated APIs.')
  console.log('  All API endpoints return the SPA HTML shell for unauthenticated requests.')
  console.log('  CDX enumeration yields act UUIDs only — titles/dates are not accessible.')
  console.log()

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('ALLOW_EDITS=true is required for sample/full modes.')
    process.exit(2)
  }

  // Step 1: CDX enumeration
  console.log('Step 1: Enumerating Serbia acts via Wayback CDX API...')
  const allSlugs = await getCdxSlugs()
  console.log(`  CDX total (unique UUIDs): ${allSlugs.length}`)

  if (allSlugs.length === 0) {
    console.warn('WARNING: 0 acts enumerated. CDX may be unavailable.')
  }

  // Step 2: Dry-run
  if (mode === 'dry-run') {
    console.log('\nStep 2 (dry-run): Probing act detail API for sample UUIDs...')
    const SAMPLE_N = 5
    const sampleSlugs = allSlugs.slice(0, SAMPLE_N)

    const sampleResults: Array<{
      uuid: string
      waybackTimestamp: string
      actUrl: string
      apiAccessible: boolean
      title: string | null
    }> = []

    for (const slug of sampleSlugs) {
      process.stdout.write(`  UUID: ${slug.uuid}... `)
      const { title, year } = await fetchActDetail(slug)
      const accessible = title !== null
      sampleResults.push({
        uuid: slug.uuid,
        waybackTimestamp: slug.timestamp,
        actUrl: `${LIVE_BASE}/SlGlasnikPortal/reg/viewAct/${slug.uuid}`,
        apiAccessible: accessible,
        title: title ?? '(SPA-gated — not resolvable without auth)',
      })
      console.log(accessible ? `"${title}" (${year ?? '?'})` : 'BLOCKED (SPA shell returned)')
      await sleep(REQUEST_DELAY_MS)
    }

    const accessible = sampleResults.filter(r => r.apiAccessible).length

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      status: 'BLOCKED',
      blocker: {
        summary: 'SPA + auth-gated API — no act titles accessible without authentication',
        details: {
          liveApi: 'Returns SPA HTML shell (text/html, 13 kB) for all /api/reg/actViewUuid/{uuid} requests',
          waybackHtml: 'Wayback-cached /reg/viewAct/{uuid} pages are SPA shells with no embedded act metadata',
          eliEndpoint: '/eli/collection 302-redirects to SPA homepage; content negotiation (Accept: application/xml) returns SPA shell',
          skupstinaRs: 'skupstina.rs DNS resolution failure',
          hasChildActs: 'Only openly-indexed JSON endpoint; returns {"hasChildActs": bool} only',
          resolution: 'Requires paid API subscription or browser automation (Puppeteer/Playwright) to intercept XHR calls',
        },
      },
      cdxStats: {
        total: allSlugs.length,
        yearRange: { earliest: allSlugs[allSlugs.length - 1]?.timestamp?.slice(0, 4) ?? '?', latest: allSlugs[0]?.timestamp?.slice(0, 4) ?? '?' },
        note: `Wayback has crawled ${allSlugs.length} unique act URLs; actual corpus on pravno-informacioni-sistem.rs is estimated at ~5,000+ acts`,
      },
      sampleProbes: sampleResults,
      apiAccessible: `${accessible}/${SAMPLE_N} acts had resolvable titles (expected: 0)`,
    }

    fs.writeFileSync('pipeline-96-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\nWritten: pipeline-96-dry-run-sample.json')

    console.log('\nSummary:')
    console.log(`  CDX acts enumerated: ${allSlugs.length}`)
    console.log(`  API accessible:      ${accessible}/${SAMPLE_N} (0 expected — SPA-gated)`)
    console.log(`  Status:              BLOCKED`)
    console.log('\nResolution: obtain API credentials or implement browser automation.')
    console.log('Dry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  // Step 3: ensure topic (sample/full only)
  console.log('\nStep 2: Ensuring topic...')
  const topicId = await ensureTopic('rs-skupstina', 'Народна скупштина Србије', 'government', 'gov-region-europe')

  // Step 4: fetch + write (sample/full)
  // Note: fetchActDetail returns null for all records due to SPA-gating.
  // This means full/sample runs will ingest 0 records until API access is resolved.
  const existingRaw = await prisma.claim.findMany({
    where: { ingestedBy: INGESTED_BY }, select: { externalId: true },
  })
  const existingSet = new Set(existingRaw.map(c => c.externalId))
  console.log(`  ${existingSet.size} records already in DB`)

  const targetSlugs = mode === 'sample' ? allSlugs.slice(0, sampleN * 5) : allSlugs
  console.log(`\nStep 3: Fetching + writing ${targetSlugs.length} acts (0 expected due to SPA-gating)...`)

  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const startTime = Date.now()
  let fetched = 0, noTitle = 0, found = 0
  const pending: ActRecord[] = []

  async function flushPending() {
    if (pending.length === 0) return
    const batch = pending.splice(0)
    try {
      await prisma.$transaction(async (tx) => {
        for (const rec of batch) {
          const result = await writeRow(tx, rec, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${INGESTED_BY}_${rec.uuid} — ${rec.title?.slice(0, 80) ?? '(no title)'}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      console.error(`  Batch flush failed: ${(err as Error).message}`)
      counts.errors += batch.length
    }
  }

  for (const slug of targetSlugs) {
    const externalId = `${INGESTED_BY}_${slug.uuid}`
    if (existingSet.has(externalId)) { counts.skipped++; fetched++; continue }

    const { title, year } = await fetchActDetail(slug)
    fetched++
    if (!title) {
      noTitle++
    } else {
      found++
      pending.push({ ...slug, title, year })
      if (pending.length >= 50) await flushPending()
    }

    if (fetched % 50 === 0) {
      console.log(`  ${fetched}/${targetSlugs.length} fetched | Committed: ${counts.ingested} | No title: ${noTitle}`)
    }
    if (mode === 'sample' && found >= sampleN) break
    await sleep(REQUEST_DELAY_MS)
  }
  await flushPending()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Fetched: ${fetched} | With title: ${found} | No title (SPA-gated): ${noTitle}`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)
  console.log(`  NOTE: 0 ingested is expected — SPA-gating blocks all title resolution.`)

  console.log('\nPost-ingestion DB verification...')
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims: ${dbClaims} | Sources: ${dbSources} | Edges: ${dbEdges}`)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
