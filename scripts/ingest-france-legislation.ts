// Pipeline 51 — France Légifrance Lois (france_legislation_v1)
// Dataset: DILA Open Data — LEGI global snapshot (echanges.dila.gouv.fr/OPENDATA/LEGI/)
// Scope: NATURE=LOI and NATURE=LOI_ORGANIQUE from in-force LEGITEXT*.xml metadata files
// Process:
//   1. Fetch DILA directory listing to find latest Freemium_legi_global_*.tar.gz URL
//   2. Download to /tmp/dila_legi_global.tar.gz (cached; skip if exists and ≥1GB)
//   3. Extract only LEGITEXT*.xml files (wildcard filter, avoids full multi-GB extraction)
//   4. Parse NATURE, TITRE/TITREFULL, NUM, DATE_PUBLI, ID from each file
//   5. Filter for LOI / LOI_ORGANIQUE, build candidates, ingest
// Run: npx tsx scripts/ingest-france-legislation.ts --dry-run
//      npx tsx scripts/ingest-france-legislation.ts --sample 10
//      npx tsx scripts/ingest-france-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'
import * as http from 'http'
import * as path from 'path'
import { spawnSync } from 'child_process'

const prisma = new PrismaClient()

const INGESTED_BY = 'france_legislation_v1'
const PIPELINE = 'Pipeline 51'
const DILA_INDEX_URL = 'https://echanges.dila.gouv.fr/OPENDATA/LEGI/'
const ARCHIVE_CACHE = '/tmp/dila_legi_global.tar.gz'
const EXTRACT_DIR = '/tmp/dila_legi_extract'
const MIN_CACHE_BYTES = 500_000_000 // 500MB — if smaller, re-download

// ── Types ──────────────────────────────────────────────────────────────────────

interface CandidateRecord {
  externalId: string
  sourceExternalId: string
  title: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  sourceName: string
  nature: string
  num: string | null
  legitextId: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--limit N] [--verbose]')
        process.exit(1) as never
      })()

  const li = args.indexOf('--limit')
  const sai = args.indexOf('--sample')

  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function httpsGetStr(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http
    const req = (lib as typeof https).get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: parsed.protocol === 'https:' ? 443 : 80,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
          'Accept': '*/*',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location
          const nextUrl = loc.startsWith('http') ? loc : `${parsed.protocol}//${parsed.hostname}${loc}`
          res.resume()
          httpsGetStr(nextUrl, timeoutMs).then(resolve).catch(reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http
    const file = fs.createWriteStream(destPath)
    let received = 0

    const doRequest = (reqUrl: string) => {
      const p = new URL(reqUrl)
      const r = (lib as typeof https).get(
        {
          hostname: p.hostname,
          path: p.pathname + p.search,
          port: p.protocol === 'https:' ? 443 : 80,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)' },
          timeout: 600_000,
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume()
            doRequest(res.headers.location.startsWith('http') ? res.headers.location : `${p.protocol}//${p.hostname}${res.headers.location}`)
            return
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} downloading ${reqUrl}`))
            return
          }
          const total = parseInt(res.headers['content-length'] ?? '0', 10)
          let lastReported = 0
          res.on('data', (chunk: Buffer) => {
            received += chunk.length
            if (received - lastReported >= 50_000_000) {
              lastReported = received
              if (total > 0) {
                const pct = ((received / total) * 100).toFixed(1)
                process.stdout.write(`  Downloading: ${(received / 1e6).toFixed(0)}MB / ${(total / 1e6).toFixed(0)}MB (${pct}%)\r`)
              } else {
                process.stdout.write(`  Downloading: ${(received / 1e6).toFixed(0)}MB\r`)
              }
            }
          })
          res.pipe(file)
          res.on('end', () => { file.close(); console.log(''); resolve() })
          res.on('error', reject)
        }
      )
      r.on('error', reject)
      r.on('timeout', () => { r.destroy(); reject(new Error('Download timed out')) })
    }

    doRequest(url)
  })
}

// ── Find latest DILA snapshot URL ──────────────────────────────────────────────

async function findSnapshotUrl(): Promise<string> {
  console.log('  Fetching DILA directory listing...')
  const res = await httpsGetStr(DILA_INDEX_URL, 30_000)
  if (res.status !== 200) throw new Error(`HTTP ${res.status} from DILA index`)

  // Find all Freemium_legi_global_*.tar.gz links
  const re = /href="(Freemium_legi_global_[\d-]+\.tar\.gz)"/g
  const matches: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(res.body)) !== null) {
    matches.push(m[1])
  }

  if (matches.length === 0) throw new Error('No Freemium_legi_global snapshot found in DILA directory listing')

  // Sort and take the most recent
  matches.sort()
  const latest = matches[matches.length - 1]
  console.log(`  Latest snapshot: ${latest}`)
  return `${DILA_INDEX_URL}${latest}`
}

// ── Extract and parse LEGITEXT*.xml files from archive ───────────────────────

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`)
  const m = xml.match(re)
  return m ? m[1].trim() : null
}

function parseDateISO(s: string): { date: Date; iso: string } | null {
  // Handles YYYY-MM-DD format from DILA XML
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (!m) return null
  const iso = m[1]
  const dt = new Date(iso + 'T00:00:00Z')
  if (isNaN(dt.getTime())) return null
  return { date: dt, iso }
}

async function extractAndParse(verbose: boolean): Promise<CandidateRecord[]> {
  fs.mkdirSync(EXTRACT_DIR, { recursive: true })

  // BSD tar (macOS) uses --include for pattern filtering, not --wildcards (GNU tar)
  // Target only en_vigueur version/LEGITEXT*.xml files — these contain TITRE + metadata
  console.log('  Extracting en_vigueur version/LEGITEXT*.xml files (this may take several minutes)...')
  const tarResult = spawnSync('tar', [
    '-xzf', ARCHIVE_CACHE,
    '--include', '*en_vigueur*texte/version/LEGITEXT*.xml',
    '-C', EXTRACT_DIR,
  ], { maxBuffer: 10 * 1024 * 1024, timeout: 600_000 })

  if (tarResult.status !== 0 && tarResult.status !== null) {
    const stderr = tarResult.stderr?.toString() ?? ''
    if (tarResult.status > 2) throw new Error(`tar extraction failed (exit ${tarResult.status}): ${stderr}`)
    if (stderr && verbose) console.warn(`  tar warnings: ${stderr.slice(0, 200)}`)
  }

  console.log('  Extraction complete. Walking XML files...')

  const candidates: CandidateRecord[] = []
  const seen = new Set<string>()

  function walk(dir: string) {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) }
    catch { return }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile() && /^LEGITEXT\d+\.xml$/.test(entry.name)) {
        try {
          const xml = fs.readFileSync(fullPath, 'utf-8')

          const nature = extractTag(xml, 'NATURE')
          if (!nature || !['LOI', 'LOI_ORGANIQUE'].includes(nature)) continue

          const legitextId = extractTag(xml, 'ID') ?? entry.name.replace('.xml', '')
          if (seen.has(legitextId)) continue
          seen.add(legitextId)

          // TITRE/TITREFULL are in META_TEXTE_VERSION section of version files
          const titre = extractTag(xml, 'TITREFULL') || extractTag(xml, 'TITRE') || ''
          if (!titre) continue

          const datePubStr = extractTag(xml, 'DATE_PUBLI') ?? ''
          if (!datePubStr) continue
          const dateResult = parseDateISO(datePubStr)
          if (!dateResult) continue

          const num = extractTag(xml, 'NUM')

          candidates.push({
            externalId: `fr_loi_${legitextId}`,
            sourceExternalId: `fr_loi_source_${legitextId}`,
            title: titre,
            enactedDate: dateResult.date,
            enactedDateStr: dateResult.iso,
            sourceUrl: `https://www.legifrance.gouv.fr/loda/id/${legitextId}`,
            sourceName: num ? `France Loi n° ${num}` : `France ${nature} ${legitextId}`,
            nature,
            num: num ?? null,
            legitextId,
          })
        } catch {
          // Skip unparseable files
        }
      }
    }
  }

  walk(EXTRACT_DIR)

  console.log(`  Found ${candidates.length} LOI/LOI_ORGANIQUE records`)
  return candidates
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Write one record ───────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: CandidateRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: rec.sourceName,
        url: rec.sourceUrl,
        publishedAt: rec.enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.title,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.enactedDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          nature: rec.nature,
          num: rec.num,
          legitextId: rec.legitextId,
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'CITES',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
      },
    })

    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })

    return 'ingested'
  } catch (err) {
    console.error(`  Error writing ${rec.externalId}: ${err}`)
    return 'failed'
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── ${PIPELINE}: France Légifrance Lois ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('fr-parlement', 'Parlement français', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // Step 2: Ensure archive is downloaded
  console.log('\nStep 2: Ensuring DILA LEGI snapshot is available...')
  const cacheExists = fs.existsSync(ARCHIVE_CACHE)
  const cacheSize = cacheExists ? fs.statSync(ARCHIVE_CACHE).size : 0

  if (cacheExists && cacheSize >= MIN_CACHE_BYTES) {
    console.log(`  Using cached archive: ${ARCHIVE_CACHE} (${(cacheSize / 1e9).toFixed(2)}GB)`)
  } else {
    if (cacheExists) console.log(`  Cache too small (${(cacheSize / 1e6).toFixed(0)}MB), re-downloading`)
    const snapshotUrl = await findSnapshotUrl()
    console.log(`  Downloading ${snapshotUrl}...`)
    await downloadFile(snapshotUrl, ARCHIVE_CACHE)
    const newSize = fs.statSync(ARCHIVE_CACHE).size
    console.log(`  Downloaded: ${(newSize / 1e9).toFixed(2)}GB`)
  }

  // Step 3: Extract and parse
  console.log('\nStep 3: Extracting and parsing LOI/LOI_ORGANIQUE records...')
  const allCandidates = await extractAndParse(verbose)

  const filtered = limit > 0 ? allCandidates.slice(0, limit) : allCandidates
  console.log(`\nTotal candidates: ${filtered.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 4: Writing dry-run sample (no DB writes)...')

    const sample = filtered.slice(0, 15).map(r => ({
      title: r.title,
      externalId: r.externalId,
      nature: r.nature,
      num: r.num,
      legitextId: r.legitextId,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: filtered.length,
      sample,
    }

    fs.writeFileSync('pipeline-51-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-51-dry-run-sample.json')

    if (filtered.length > 0) {
      console.log('\nSample titles:')
      filtered.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] ${r.title.slice(0, 110)}${r.title.length > 110 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample' ? filtered.slice(0, sampleN) : filtered

  console.log(`\nStep 4: Writing ${rows.length} rows to DB (batches of 50, txn timeout 30s)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const BATCH = 50

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.title.slice(0, 70)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}-${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }

    if (!verbose) {
      const done = Math.min(i + BATCH, rows.length)
      process.stdout.write(`  ${done}/${rows.length} processed...\r`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  console.log('\nPost-ingestion DB verification...')
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)

  if (mode === 'sample') {
    console.log('\nAwaiting explicit go-ahead before full run.')
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
