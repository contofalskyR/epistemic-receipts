// Pipeline 40 — Taiwan Legislative Yuan Enacted Laws (taiwan_legislation_v1)
// Dataset: Taiwan Ministry of Justice Laws Database (law.moj.gov.tw)
//          Free download, no API key. Bulk JSON download via ZIP.
// Scope: All active 法律 (statutes) in force, using English name where available.
// API:   GET https://law.moj.gov.tw/api/Ch/Law/JSON → ZIP → ChLaw.json
// Topic: tw-legislative-yuan (Legislative Yuan (Taiwan), domain=government).
// Run: npx tsx scripts/ingest-taiwan-legislation.ts --dry-run
//      npx tsx scripts/ingest-taiwan-legislation.ts --sample 10
//      npx tsx scripts/ingest-taiwan-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

const INGESTED_BY = 'taiwan_legislation_v1'
const PIPELINE = 'Pipeline 40'
const CH_LAW_ZIP_URL = 'https://law.moj.gov.tw/api/Ch/Law/JSON'

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface ChLawRecord {
  LawLevel: string
  LawName: string
  LawURL: string
  LawCategory: string
  LawModifiedDate: string
  LawEffectiveDate: string
  LawEffectiveNote: string
  LawAbandonNote: string
  LawHasEngVersion: string
  EngLawName: string
}

interface CandidateRecord {
  pcode: string
  lawName: string
  engLawName: string
  lawLevel: string
  modifiedDate: string
  enactedDate: Date
  enactedDateStr: string
  enactedPrecision: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
}

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

// ── Download and parse ─────────────────────────────────────────────────────────

function parseMojDate(dateStr: string): { date: Date; str: string; precision: string } | null {
  if (!dateStr || dateStr.length < 4) return null
  const s = dateStr.replace(/\D/g, '')
  const year = s.slice(0, 4)
  const month = s.slice(4, 6) || '01'
  const day = s.slice(6, 8) || '01'
  const precision = s.length >= 8 ? 'DAY' : s.length >= 6 ? 'MONTH' : 'YEAR'
  const iso = `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`
  const d = new Date(iso + 'T00:00:00Z')
  if (isNaN(d.getTime())) return null
  return { date: d, str: iso, precision }
}

function extractPcode(url: string): string | null {
  const m = url.match(/[?&]pcode=([A-Z0-9]+)/i)
  return m ? m[1] : null
}

async function downloadAndParseChLaws(): Promise<ChLawRecord[]> {
  const tmpDir = os.tmpdir()
  const zipPath = path.join(tmpDir, `tw_ch_laws_${Date.now()}.zip`)
  const extractDir = path.join(tmpDir, `tw_ch_laws_${Date.now()}`)

  console.log('  Downloading ChLaw.json ZIP from law.moj.gov.tw...')
  const res = await fetch(CH_LAW_ZIP_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ChLaw.json`)
  const buf = await res.arrayBuffer()
  fs.writeFileSync(zipPath, Buffer.from(buf))
  console.log(`  Downloaded ${(buf.byteLength / 1024 / 1024).toFixed(1)} MB`)

  fs.mkdirSync(extractDir, { recursive: true })
  execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' })
  fs.unlinkSync(zipPath)

  const jsonPath = path.join(extractDir, 'ChLaw.json')
  const raw = fs.readFileSync(jsonPath, 'utf-8').replace(/^﻿/, '') // strip BOM
  const data = JSON.parse(raw) as { Laws: ChLawRecord[] }

  // Cleanup
  try { execSync(`rm -rf "${extractDir}"`, { stdio: 'pipe' }) } catch {}

  return data.Laws ?? []
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildCandidate(rec: ChLawRecord, verbose: boolean): CandidateRecord | null {
  // Skip abandoned laws
  if (rec.LawAbandonNote && rec.LawAbandonNote.trim()) {
    if (verbose) console.log(`  Skip (abandoned): ${rec.LawName}`)
    return null
  }

  // Only include 法律 (statutes) — skip Constitutional provisions for scope consistency
  if (rec.LawLevel !== '法律') {
    if (verbose) console.log(`  Skip (level=${rec.LawLevel}): ${rec.LawName}`)
    return null
  }

  const pcode = extractPcode(rec.LawURL)
  if (!pcode) {
    if (verbose) console.log(`  Skip (no pcode): ${rec.LawName}`)
    return null
  }

  // Use English name if available, otherwise Chinese name
  const displayName = (rec.EngLawName && rec.EngLawName.trim())
    ? rec.EngLawName.trim()
    : rec.LawName.trim()

  if (!displayName) {
    if (verbose) console.log(`  Skip (no name): pcode=${pcode}`)
    return null
  }

  // Use LawModifiedDate as the canonical date (promulgation/amendment date)
  const parsed = parseMojDate(rec.LawModifiedDate)
  if (!parsed) {
    if (verbose) console.log(`  Skip (no date): ${displayName}`)
    return null
  }

  const externalId = `tw_law_${pcode}`
  const sourceExternalId = `tw_law_source_${pcode}`
  const sourceUrl = rec.LawURL.startsWith('http') ? rec.LawURL : `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${pcode}`

  return {
    pcode,
    lawName: rec.LawName,
    engLawName: rec.EngLawName ?? '',
    lawLevel: rec.LawLevel,
    modifiedDate: rec.LawModifiedDate,
    enactedDate: parsed.date,
    enactedDateStr: parsed.str,
    enactedPrecision: parsed.precision,
    sourceUrl,
    externalId,
    sourceExternalId,
    sourceName: displayName,
  }
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
        text: rec.sourceName,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.enactedDate,
        claimEmergedPrecision: rec.enactedPrecision as 'DAY' | 'MONTH' | 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          pcode: rec.pcode,
          lawName: rec.lawName,
          engLawName: rec.engLawName,
          modifiedDate: rec.modifiedDate,
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

  console.log(`\n── ${PIPELINE}: Taiwan Legislative Yuan Enacted Laws ─────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('tw-legislative-yuan', 'Legislative Yuan (Taiwan)', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Downloading and parsing Taiwan laws from law.moj.gov.tw...')
  const rawLaws = await downloadAndParseChLaws()
  console.log(`  Raw records: ${rawLaws.length}`)

  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()

  for (const law of rawLaws) {
    const rec = buildCandidate(law, verbose)
    if (!rec) continue
    if (seenIds.has(rec.externalId)) continue
    seenIds.add(rec.externalId)
    candidates.push(rec)
    if (limit > 0 && candidates.length >= limit) break
  }

  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      title: r.sourceName,
      externalId: r.externalId,
      pcode: r.pcode,
      lawName: r.lawName,
      engLawName: r.engLawName,
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
      totalCandidates: candidates.length,
      sample,
    }

    fs.writeFileSync('pipeline-40-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-40-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] ${r.sourceName.slice(0, 110)}${r.sourceName.length > 110 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample'
    ? candidates.slice(0, sampleN)
    : (limit > 0 ? candidates.slice(0, limit) : candidates)

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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.sourceName.slice(0, 70)}`)
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
