// Pipeline 43 — Argentina Congreso de la Nación Leyes (argentina_legislation_v1)
// Dataset: datos.jus.gob.ar — Base Infoleg Normativa Nacional
// Source: https://datos.jus.gob.ar/dataset/justicia-base-infoleg-normativa-nacional
// Scope: All "Ley" type records with a non-empty title
// API: Download ZIP from datos.jus.gob.ar, extract CSV in-memory, filter tipo_norma=Ley
// Run: npx tsx scripts/ingest-argentina-legislation.ts --dry-run
//      npx tsx scripts/ingest-argentina-legislation.ts --sample 10
//      npx tsx scripts/ingest-argentina-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'
import * as http from 'http'
import * as os from 'os'
import * as path from 'path'
import { spawnSync } from 'child_process'

const prisma = new PrismaClient()

const INGESTED_BY = 'argentina_legislation_v1'
const PIPELINE = 'Pipeline 43'

const INFOLEG_ZIP_URL = 'https://datos.jus.gob.ar/dataset/d9a963ea-8b1d-4ca3-9dd9-07a4773e8c23/resource/bf0ec116-ad4e-4572-a476-e57167a84403/download/base-infoleg-normativa-nacional.zip'
const CSV_NAME = 'base-infoleg-normativa-nacional.csv'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CandidateRecord {
  externalId: string
  sourceExternalId: string
  title: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  sourceName: string
  idNorma: string
  numeroNorma: string
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

// ── HTTP download ─────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string) => {
      const parsed = new URL(u)
      const mod = parsed.protocol === 'https:' ? https : http
      const req = mod.get(u, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)' },
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          follow(res.headers.location.startsWith('http') ? res.headers.location : `${parsed.origin}${res.headers.location}`)
          return
        }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} for ${u}`)); return }
        const stream = fs.createWriteStream(destPath)
        res.pipe(stream)
        stream.on('finish', resolve)
        stream.on('error', reject)
        res.on('error', reject)
      })
      req.on('error', reject)
    }
    follow(url)
  })
}

// ── CSV parsing (no external deps) ────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      fields.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

// ── Load CSV from ZIP ─────────────────────────────────────────────────────────

async function loadCandidates(zipPath: string, verbose: boolean): Promise<CandidateRecord[]> {
  console.log('  Extracting CSV from ZIP (this may take a moment)...')
  const result = spawnSync('unzip', ['-p', zipPath, CSV_NAME], { maxBuffer: 300 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`unzip failed: ${result.stderr?.toString()}`)

  const content = result.stdout.toString('utf-8')
  const lines = content.split('\n')
  console.log(`  CSV has ${lines.length} lines`)

  if (lines.length < 2) throw new Error('CSV appears empty')

  // Parse header row, stripping BOM
  const header = parseCSVLine(lines[0].replace(/^﻿/, ''))
  const idxId = header.indexOf('id_norma')
  const idxTipo = header.indexOf('tipo_norma')
  const idxNum = header.indexOf('numero_norma')
  const idxFecha = header.indexOf('fecha_sancion')
  const idxTitulo = header.indexOf('titulo_resumido')
  const idxSumario = header.indexOf('titulo_sumario')
  const idxTextoOrig = header.indexOf('texto_original')

  if (idxId < 0 || idxTipo < 0) throw new Error('Expected columns not found in CSV header')

  const candidates: CandidateRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = parseCSVLine(line)
    if (cols[idxTipo]?.trim() !== 'Ley') continue

    const idNorma = cols[idxId]?.trim() ?? ''
    if (!idNorma) continue

    const titulo = (cols[idxTitulo]?.trim() || cols[idxSumario]?.trim()) ?? ''
    if (!titulo) {
      if (verbose) console.log(`  Skip id_norma=${idNorma}: no title`)
      continue
    }

    const fechaStr = cols[idxFecha]?.trim()?.slice(0, 10) ?? ''
    if (!fechaStr || fechaStr === '0000-00-00') continue

    const enactedDate = new Date(fechaStr + 'T00:00:00Z')
    if (isNaN(enactedDate.getTime())) continue

    const numeroNorma = cols[idxNum]?.trim() ?? ''
    const textoOrig = cols[idxTextoOrig]?.trim() ?? ''
    const sourceUrl = textoOrig.startsWith('http')
      ? textoOrig
      : `https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=${idNorma}`

    candidates.push({
      externalId: `ar_ley_${idNorma}`,
      sourceExternalId: `ar_ley_source_${idNorma}`,
      title: titulo,
      enactedDate,
      enactedDateStr: fechaStr,
      sourceUrl,
      sourceName: numeroNorma ? `Argentina Ley N° ${numeroNorma}` : `Argentina Ley id_norma ${idNorma}`,
      idNorma,
      numeroNorma,
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
          idNorma: rec.idNorma,
          numeroNorma: rec.numeroNorma,
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

  console.log(`\n── ${PIPELINE}: Argentina Congreso Leyes ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('ar-congreso', 'Congreso de la Nación Argentina', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Downloading and parsing Infoleg dataset...')
  const tmpDir = os.tmpdir()
  const zipPath = path.join(tmpDir, 'argentina-infoleg.zip')

  if (fs.existsSync(zipPath)) {
    console.log(`  Using cached ZIP at ${zipPath}`)
  } else {
    console.log(`  Downloading ZIP (~47MB) from datos.jus.gob.ar...`)
    await downloadFile(INFOLEG_ZIP_URL, zipPath)
    console.log(`  Download complete: ${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(1)}MB`)
  }

  const allCandidates = await loadCandidates(zipPath, verbose)
  const filtered = limit > 0 ? allCandidates.slice(0, limit) : allCandidates
  console.log(`\nTotal candidates: ${filtered.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = filtered.slice(0, 15).map(r => ({
      title: r.title,
      externalId: r.externalId,
      idNorma: r.idNorma,
      numeroNorma: r.numeroNorma,
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

    fs.writeFileSync('pipeline-43-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-43-dry-run-sample.json')

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
