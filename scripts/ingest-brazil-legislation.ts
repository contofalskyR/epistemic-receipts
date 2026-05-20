// Pipeline 47 — Brazil Congresso Nacional Enacted Laws (brazil_legislation_v1)
// Dataset: Câmara dos Deputados Dados Abertos (dadosabertos.camara.leg.br)
// Scope: PL + PLP proposals with codSituacao=1140 (Transformado em Norma Jurídica)
//        These are bills that have been enacted as federal laws
// API: GET https://dadosabertos.camara.leg.br/api/v2/proposicoes?codSituacao=1140&siglaTipo=PL|PLP
//      Paginate with itens=100; use ementa as title, dataApresentacao as date
// Run: npx tsx scripts/ingest-brazil-legislation.ts --dry-run
//      npx tsx scripts/ingest-brazil-legislation.ts --sample 10
//      npx tsx scripts/ingest-brazil-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'brazil_legislation_v1'
const PIPELINE = 'Pipeline 47'
const PAGE_DELAY_MS = 200
const BASE_URL = 'https://dadosabertos.camara.leg.br/api/v2/proposicoes'
const ENACTED_TYPES = ['PL', 'PLP']

// ── Types ──────────────────────────────────────────────────────────────────────

interface CamaraProposicao {
  id: number
  siglaTipo: string
  numero: number
  ano: number
  ementa: string
  dataApresentacao: string
}

interface CandidateRecord {
  externalId: string
  sourceExternalId: string
  title: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  sourceName: string
  tipo: string
  numero: number
  ano: number
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

function httpsGet(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
          'Accept': 'application/json',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `https://${parsed.hostname}${res.headers.location}`
          res.resume()
          httpsGet(nextUrl, timeoutMs).then(resolve).catch(reject)
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

async function fetchWithRetry(url: string, retries = 4, timeoutMs = 30_000): Promise<{ status: number; body: string }> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await httpsGet(url, timeoutMs)
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      return res
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Fetch error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ── Fetch all enacted propositions for a given tipo ───────────────────────────

async function fetchByType(tipo: string, limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  let page = 1

  while (true) {
    const url = `${BASE_URL}?codSituacao=1140&siglaTipo=${tipo}&itens=100&pagina=${page}&ordem=ASC&ordenarPor=id`
    const res = await fetchWithRetry(url, 3, 30_000)
    if (res.status !== 200) {
      console.warn(`  HTTP ${res.status} for ${tipo} page ${page}`)
      break
    }

    const data = JSON.parse(res.body) as { dados: CamaraProposicao[]; links: Array<{ rel: string; href: string }> }
    const items = data.dados ?? []
    if (items.length === 0) break

    for (const item of items) {
      const ementa = item.ementa?.trim() ?? ''
      if (!ementa) {
        if (verbose) console.log(`  Skip ${tipo} ${item.numero}/${item.ano}: no ementa`)
        continue
      }

      const dateStr = item.dataApresentacao?.slice(0, 10) ?? ''
      if (!dateStr) continue
      const enactedDate = new Date(dateStr + 'T00:00:00Z')
      if (isNaN(enactedDate.getTime())) continue

      candidates.push({
        externalId: `br_lei_${tipo}_${item.ano}_${item.numero}`,
        sourceExternalId: `br_lei_source_${item.id}`,
        title: ementa,
        enactedDate,
        enactedDateStr: dateStr,
        sourceUrl: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${item.id}`,
        sourceName: `Brazil ${tipo} ${item.numero}/${item.ano}`,
        tipo,
        numero: item.numero,
        ano: item.ano,
      })

      if (limit > 0 && candidates.length >= limit) return candidates
    }

    if (verbose) console.log(`  ${tipo} page ${page}: ${items.length} records (total ${candidates.length})`)
    else process.stdout.write(`  ${tipo}: ${candidates.length} collected...\r`)

    // Check if there's a next page
    const links = data.links ?? []
    const hasNext = links.some(l => l.rel === 'next')
    if (!hasNext || items.length < 100) break

    page++
    await sleep(PAGE_DELAY_MS)
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
          tipo: rec.tipo,
          numero: rec.numero,
          ano: rec.ano,
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

  console.log(`\n── ${PIPELINE}: Brazil Congresso Enacted Laws ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | Types: ${ENACTED_TYPES.join(', ')}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('br-congresso', 'Congresso Nacional do Brasil', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching enacted propositions from Câmara API...')
  const allCandidates: CandidateRecord[] = []
  const seenIds = new Set<string>()

  for (const tipo of ENACTED_TYPES) {
    console.log(`  Fetching ${tipo} enacted...`)
    const typeRecords = await fetchByType(tipo, limit > 0 ? limit - allCandidates.length : 0, verbose)
    let added = 0
    for (const c of typeRecords) {
      if (seenIds.has(c.externalId)) continue
      seenIds.add(c.externalId)
      allCandidates.push(c)
      added++
    }
    console.log(`  ${tipo}: ${typeRecords.length} fetched, ${added} added`)
    if (limit > 0 && allCandidates.length >= limit) break
    await sleep(500)
  }

  console.log(`\nTotal candidates: ${allCandidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 15).map(r => ({
      title: r.title,
      externalId: r.externalId,
      tipo: r.tipo,
      numero: r.numero,
      ano: r.ano,
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
      totalCandidates: allCandidates.length,
      sample,
    }

    fs.writeFileSync('pipeline-47-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-47-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nSample titles:')
      allCandidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] ${r.title.slice(0, 110)}${r.title.length > 110 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample' ? allCandidates.slice(0, sampleN) : allCandidates

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
