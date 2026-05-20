// Pipeline 45 — Mexico Congreso Federal Laws (mexico_legislation_v1)
// Dataset: Cámara de Diputados LeyesBiblio (www.diputados.gob.mx/LeyesBiblio)
// Scope: All federal laws (leyes, códigos, constitución, reglamentos) currently in force
// API: Scrape https://www.diputados.gob.mx/LeyesBiblio/index.htm
//      Extract law name, DOF original publication date, and reform page href as ID
// Run: npx tsx scripts/ingest-mexico-legislation.ts --dry-run
//      npx tsx scripts/ingest-mexico-legislation.ts --sample 10
//      npx tsx scripts/ingest-mexico-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'mexico_legislation_v1'
const PIPELINE = 'Pipeline 45'
const INDEX_URL = 'https://www.diputados.gob.mx/LeyesBiblio/index.htm'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CandidateRecord {
  externalId: string
  sourceExternalId: string
  title: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  sourceName: string
  refId: string
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

function httpsGetLatin1(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
          'Accept': 'text/html',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `https://${parsed.hostname}${res.headers.location}`
          res.resume()
          httpsGetLatin1(nextUrl, timeoutMs).then(resolve).catch(reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          // The page uses Latin-1 encoding
          const body = Buffer.concat(chunks).toString('latin1')
          resolve({ status: res.statusCode ?? 0, body })
        })
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

async function fetchWithRetry(url: string, retries = 3, timeoutMs = 30_000): Promise<{ status: number; body: string }> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await httpsGetLatin1(url, timeoutMs)
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        await sleep(delay); delay *= 2; continue
      }
      return res
    } catch (err) {
      if (attempt >= retries) throw err
      await sleep(delay); delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ── Parse DOF date DD/MM/YYYY → YYYY-MM-DD ────────────────────────────────────

function parseDofDate(dof: string): { date: Date; iso: string } | null {
  const m = dof.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const iso = `${m[3]}-${m[2]}-${m[1]}`
  const dt = new Date(iso + 'T00:00:00Z')
  if (isNaN(dt.getTime())) return null
  return { date: dt, iso }
}

// ── Scrape law list ────────────────────────────────────────────────────────────

async function fetchLawList(): Promise<CandidateRecord[]> {
  console.log(`  Fetching LeyesBiblio index...`)
  const res = await fetchWithRetry(INDEX_URL, 3, 30_000)
  if (res.status !== 200) throw new Error(`HTTP ${res.status} from LeyesBiblio`)

  const content = res.body
  const candidates: CandidateRecord[] = []
  const seen = new Set<string>()

  // Find each ref link + law name + DOF date
  // Pattern: href="ref/xxx.htm" followed by font tag with name, then DOF DD/MM/YYYY
  const refRe = /href="(ref\/([^"]+)\.htm)"/g
  let m: RegExpExecArray | null

  while ((m = refRe.exec(content)) !== null) {
    const refHref = m[1]
    const refId = m[2]
    const pos = m.index

    const chunk = content.slice(pos, pos + 600)

    // Extract law name from font tag right after the anchor
    const nameM = chunk.match(/<font[^>]*>([^<]+)<\/font>/)
    if (!nameM) continue
    const name = nameM[1].trim()

    // Skip navigation links
    const navWords = ['Cronol', 'Artículo', 'Período', 'Periodo', 'Más de', 'crono', 'Sentencia', 'Por Artíc', 'Por orden']
    if (navWords.some(w => name.includes(w))) continue
    if (!name || name.length < 5) continue

    // Find DOF date
    const dofM = chunk.match(/DOF (\d{2}\/\d{2}\/\d{4})/)
    if (!dofM) continue

    if (seen.has(refId)) continue
    seen.add(refId)

    const dateResult = parseDofDate(dofM[1])
    if (!dateResult) continue

    candidates.push({
      externalId: `mx_ley_${refId}`,
      sourceExternalId: `mx_ley_source_${refId}`,
      title: name,
      enactedDate: dateResult.date,
      enactedDateStr: dateResult.iso,
      sourceUrl: `https://www.diputados.gob.mx/LeyesBiblio/${refHref}`,
      sourceName: `Mexico ${name.slice(0, 60)}`,
      refId,
    })
  }

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
          refId: rec.refId,
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

  console.log(`\n── ${PIPELINE}: Mexico Congreso Federal Laws ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('mx-congreso', 'Congreso de la Unión (México)', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Scraping LeyesBiblio index...')
  const allCandidates = await fetchLawList()
  const filtered = limit > 0 ? allCandidates.slice(0, limit) : allCandidates
  console.log(`\nTotal candidates: ${filtered.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = filtered.slice(0, 15).map(r => ({
      title: r.title,
      externalId: r.externalId,
      refId: r.refId,
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

    fs.writeFileSync('pipeline-45-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-45-dry-run-sample.json')

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

  console.log(`\nStep 3: Writing ${rows.length} rows to DB (batches of 50, txn timeout 30s)...`)
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
