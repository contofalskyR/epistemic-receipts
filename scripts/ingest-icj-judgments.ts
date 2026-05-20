// Pipeline 65 — ICJ Judgments (icj_judgments_v1)
// Source: CD-ICJ open dataset on Zenodo (https://zenodo.org/records/10030647)
// Scope: All ICJ decisions (Judgments, Orders, Advisory Opinions) 1946–2023
// Run: npx tsx scripts/ingest-icj-judgments.ts --dry-run
//      npx tsx scripts/ingest-icj-judgments.ts --sample 10
//      npx tsx scripts/ingest-icj-judgments.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'
import * as http from 'http'
import * as path from 'path'
import * as os from 'os'
import { execSync } from 'child_process'
import { parse as csvParse } from 'csv-parse/sync'

const prisma = new PrismaClient()

const INGESTED_BY = 'icj_judgments_v1'
const PIPELINE = 'Pipeline 65'
const ZENODO_ZIP_URL = 'https://zenodo.org/api/records/10030647/files/CD-ICJ_2023-10-22_EN_CSV_BEST_META.zip/content'

const DECISION_TYPE_MAP: Record<string, string> = {
  JUD: 'Judgment',
  ORD: 'Order',
  ADV: 'Advisory Opinion',
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface IcjCsvRow {
  doc_id: string
  court: string
  caseno: string
  shortname: string
  fullname: string
  applicant: string
  respondent: string
  date: string
  doctype: string
  collision: string
  stage: string
  opinion: string
  [key: string]: string
}

interface CandidateRecord {
  caseNo: string
  fullName: string
  applicant: string
  respondent: string
  date: string
  dateObj: Date
  docType: string
  decisionType: string
  collision: string
  claimText: string
  externalId: string
  sourceExternalId: string
  sourceUrl: string
  sourceName: string
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

// ── HTTP download ──────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string, redirects = 0) => {
      if (redirects > 10) { reject(new Error('Too many redirects')); return }
      const parsed = new URL(u)
      const lib = parsed.protocol === 'https:' ? https : http
      lib.get(u, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)' },
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${parsed.protocol}//${parsed.host}${res.headers.location}`
          res.resume()
          follow(next, redirects + 1)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} downloading zip`))
          return
        }
        const out = fs.createWriteStream(destPath)
        res.pipe(out)
        out.on('finish', () => { out.close(); resolve() })
        out.on('error', reject)
        res.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

// ── Fetch & parse CSV ──────────────────────────────────────────────────────────

function buildIcjUrl(caseNo: string, date: string, docType: string, collision: string): string {
  const casePadded = caseNo.padStart(3, '0')
  const dateFmt = date.replace(/-/g, '')
  const collPadded = collision.padStart(2, '0')
  return `https://www.icj-cij.org/public/files/case-related/${caseNo}/${casePadded}-${dateFmt}-${docType}-${collPadded}-00-EN.pdf`
}

function rowToCandidate(row: IcjCsvRow): CandidateRecord | null {
  const { caseno, fullname, applicant, respondent, date, doctype, collision } = row

  if (!caseno || !date || !doctype || !fullname) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  const dateObj = new Date(date + 'T00:00:00Z')
  if (isNaN(dateObj.getTime())) return null

  const decisionType = DECISION_TYPE_MAP[doctype] ?? doctype

  const claimText = doctype === 'ADV'
    ? `${fullname} — ICJ Advisory Opinion No. ${caseno} (${date}).`
    : `${fullname} — ICJ ${decisionType} No. ${caseno} (${date}).`

  const externalId = `icj_decision_${caseno}_${date.replace(/-/g, '')}_${doctype.toLowerCase()}`

  return {
    caseNo: caseno,
    fullName: fullname,
    applicant,
    respondent,
    date,
    dateObj,
    docType: doctype,
    decisionType,
    collision,
    claimText,
    externalId,
    sourceExternalId: `icj_src_${externalId}`,
    sourceUrl: buildIcjUrl(caseno, date, doctype, collision),
    sourceName: `ICJ — ${fullname.slice(0, 100)} (${decisionType}, ${date})`,
  }
}

async function fetchAllCandidates(limit: number): Promise<CandidateRecord[]> {
  const tmpDir = os.tmpdir()
  const zipPath = path.join(tmpDir, 'icj_meta_ep.zip')
  const csvName = 'CD-ICJ_2023-10-22_EN_CSV_BEST_META.csv'
  const csvPath = path.join(tmpDir, csvName)

  console.log('  Downloading CD-ICJ metadata CSV from Zenodo (~64KB)...')
  await downloadFile(ZENODO_ZIP_URL, zipPath)
  console.log('  Extracting...')
  execSync(`unzip -o "${zipPath}" -d "${tmpDir}"`, { stdio: 'pipe' })

  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const rows = csvParse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as IcjCsvRow[]

  console.log(`  Parsed ${rows.length} CSV rows.`)

  // Deduplicate: one decision per (caseno, date, doctype).
  // Prefer majority opinion (opinion=0), then lowest collision number.
  const decisionsMap = new Map<string, IcjCsvRow>()
  for (const row of rows) {
    const key = `${row.caseno}_${row.date}_${row.doctype}`
    const existing = decisionsMap.get(key)
    if (!existing) {
      decisionsMap.set(key, row)
    } else {
      const curOp = parseInt(row.opinion, 10)
      const exOp = parseInt(existing.opinion, 10)
      if (curOp < exOp) {
        decisionsMap.set(key, row)
      } else if (curOp === exOp && parseInt(row.collision, 10) < parseInt(existing.collision, 10)) {
        decisionsMap.set(key, row)
      }
    }
  }

  console.log(`  Unique decisions after deduplication: ${decisionsMap.size}`)

  const candidates: CandidateRecord[] = []
  let malformed = 0
  const sorted = [...decisionsMap.values()].sort((a, b) => a.date.localeCompare(b.date))

  for (const row of sorted) {
    const rec = rowToCandidate(row)
    if (!rec) { malformed++; continue }
    candidates.push(rec)
    if (limit > 0 && candidates.length >= limit) break
  }

  if (malformed > 0) console.log(`  Dropped ${malformed} malformed rows.`)

  try { fs.unlinkSync(zipPath) } catch {}
  try { fs.unlinkSync(csvPath) } catch {}

  return candidates
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
    else console.warn(`  Parent topic ${parentSlug} not found — creating ${slug} without parent`)
  }

  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}${parentTopicId ? ` (parent: ${parentSlug})` : ''}`)
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
        publishedAt: rec.dateObj,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.dateObj,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          caseNumber: rec.caseNo,
          title: rec.fullName,
          applicant: rec.applicant,
          respondent: rec.respondent,
          decisionType: rec.decisionType,
          date: rec.date,
          country: 'International',
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'FOR',
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

  console.log(`\n── ${PIPELINE}: ICJ Judgments ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic(
      'icj-international-court-of-justice',
      'International Court of Justice',
      'international',
      'gov-region-international',
    )
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching ICJ decisions from Zenodo CD-ICJ dataset...')
  const allCandidates = await fetchAllCandidates(limit)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(-15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      date: r.date,
      decisionType: r.decisionType,
      caseNo: r.caseNo,
      applicant: r.applicant,
      respondent: r.respondent,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const byDecade: Record<string, number> = {}
    const byType: Record<string, number> = {}
    for (const r of allCandidates) {
      const decade = r.date.slice(0, 3) + '0s'
      byDecade[decade] = (byDecade[decade] ?? 0) + 1
      byType[r.decisionType] = (byType[r.decisionType] ?? 0) + 1
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      distribution: { byDecade, byType },
      sampleNewest: sample,
    }

    fs.writeFileSync('pipeline-65-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-65-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nDistribution by decade:')
      for (const [k, v] of Object.entries(byDecade).sort()) {
        console.log(`  ${k}: ${v}`)
      }
      console.log('\nDistribution by type:')
      for (const [k, v] of Object.entries(byType)) {
        console.log(`  ${k}: ${v}`)
      }
      console.log('\nSample (newest first):')
      allCandidates.slice(-5).reverse().forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.date}] ${r.claimText.slice(0, 110)}${r.claimText.length > 110 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample' ? allCandidates.slice(-sampleN) : allCandidates

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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.claimText.slice(0, 70)}`)
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
