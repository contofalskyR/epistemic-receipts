// Pipeline 103 — African Court on Human and Peoples' Rights (african_court_v1)
// Dataset: African Court on Human and Peoples' Rights — all received applications
// Source: https://www.african-court.org/cpmt/received-cases (CPMT case management system)
//         HTML table rendered server-side, DataTables used client-side only.
// Scope: All 300 applications on record (Finalized, Pending, Struck out, etc.)
//        Est. ~300 records as of 2026-05-20.
//
// Note: The old site (wpafc/) is in maintenance mode. The new site /cpmt/received-cases
//       provides a complete server-side rendered HTML table of all cases.
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-african-court.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-african-court.ts --sample 10
//      ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-african-court.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'african_court_v1'
const PIPELINE = 'Pipeline 103'
const SOURCE_URL = 'https://www.african-court.org/cpmt/received-cases'
const REQUEST_DELAY_MS = 500
const BATCH_SIZE = 50

// ── Types ──────────────────────────────────────────────────────────────────────

interface CaseRecord {
  rowNum: number
  caseNum: string
  applicant: string
  respondent: string
  filedDate: string | null
  decisionDate: string | null
  status: string
  externalId: string
  sourceUrl: string
  claimText: string
  claimDate: Date | null
  claimDatePrecision: 'DAY' | 'YEAR'
}

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--verbose]')
        process.exit(1) as never
      })()
  const sai = args.indexOf('--sample')
  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function httpsGet(urlStr: string, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr)
    const req = https.get(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        port: 443,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
          'Accept': 'text/html,*/*',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : `https://${u.hostname}${res.headers.location}`
          res.resume()
          httpsGet(next, timeoutMs).then(resolve).catch(reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

// ── HTML parsing ───────────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDate(s: string): Date | null {
  if (!s || !/\d{4}/.test(s)) return null
  const d = new Date(s + (s.length === 10 ? 'T00:00:00Z' : ''))
  return isNaN(d.getTime()) ? null : d
}

function parseCases(html: string): CaseRecord[] {
  // Extract rows from the #cases table
  const tableMatch = html.match(/<table[^>]*id="cases"[^>]*>([\s\S]*?)<\/table>/i)
  if (!tableMatch) return []

  const tableHtml = tableMatch[1]
  const rowRegex = /<tr[^>]*>\s*([\s\S]*?)\s*<\/tr>/gi
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
  const records: CaseRecord[] = []

  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowHtml = rowMatch[1]
    const cells: string[] = []
    let cellMatch: RegExpExecArray | null
    cellRegex.lastIndex = 0
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripTags(cellMatch[1]))
    }
    if (cells.length < 4) continue

    const rowNum = parseInt(cells[0] ?? '')
    if (isNaN(rowNum) || rowNum <= 0) continue

    const caseNum = (cells[1] ?? '').trim()
    const applicant = (cells[2] ?? '').trim()
    const respondent = (cells[3] ?? '').trim()
    const filedDate = (cells[4] ?? '').trim() || null
    const decisionDate = (cells[5] ?? '').trim() || null
    const status = (cells[6] ?? '').trim()

    if (!caseNum) continue

    const externalId = `african_court_${caseNum.replace(/[^a-zA-Z0-9]/g, '_').replace(/__+/g, '_')}`

    // Use decision date as primary claim date, fall back to filed date
    const dateParsed = parseDate(decisionDate ?? '') ?? parseDate(filedDate ?? '')
    const claimDate = dateParsed

    const statusNote = status ? ` (${status})` : ''
    const respondentShort = respondent.split('\n')[0].trim()
    const claimText = `African Court Application ${caseNum}: ${applicant.slice(0, 100)} v. ${respondentShort.slice(0, 100)}${statusNote}.`

    records.push({
      rowNum,
      caseNum,
      applicant,
      respondent: respondentShort,
      filedDate: filedDate,
      decisionDate: decisionDate,
      status,
      externalId,
      sourceUrl: SOURCE_URL,
      claimText: claimText.slice(0, 500),
      claimDate,
      claimDatePrecision: 'DAY',
    })
  }

  return records
}

// ── Topic ──────────────────────────────────────────────────────────────────────

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

// ── Write row ──────────────────────────────────────────────────────────────────

async function writeRow(tx: TxClient, rec: CaseRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const source = await tx.source.upsert({
      where: { externalId: `src_${rec.externalId}` },
      update: {},
      create: {
        externalId: `src_${rec.externalId}`,
        name: `African Court — Application ${rec.caseNum}`,
        url: rec.sourceUrl,
        publishedAt: rec.claimDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.claimDate,
        claimEmergedPrecision: rec.claimDate ? 'DAY' : undefined,
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          caseNum: rec.caseNum,
          applicant: rec.applicant,
          respondent: rec.respondent,
          filedDate: rec.filedDate,
          decisionDate: rec.decisionDate,
          status: rec.status,
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
  const { mode, sampleN, verbose } = parseArgs()
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE}: African Court on Human and Peoples' Rights ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}`)
  console.log(`Source: ${SOURCE_URL}`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('ALLOW_EDITS=true is required for sample/full modes.')
    process.exit(2)
  }

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    await ensureTopic('international-law', 'International Law', 'law')
    await ensureTopic('human-rights', 'Human Rights', 'law', 'international-law')
    topicId = await ensureTopic('african-court', 'African Court on Human and Peoples\' Rights', 'law', 'human-rights')
    console.log(`  Topic ID: ${topicId}`)
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching cases from African Court CPMT...')
  let html: string
  try {
    html = await httpsGet(SOURCE_URL)
  } catch (err) {
    console.error(`ERROR fetching ${SOURCE_URL}: ${(err as Error).message}`)
    process.exit(1)
  }
  await sleep(REQUEST_DELAY_MS)

  const allCases = parseCases(html)
  console.log(`\nTotal cases parsed: ${allCases.length}`)

  if (allCases.length === 0) {
    console.error('ERROR: 0 cases parsed. Check HTML structure of received-cases page.')
    process.exit(1)
  }

  // Status distribution
  const byStatus: Record<string, number> = {}
  for (const c of allCases) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1
  }
  console.log('Status distribution:', JSON.stringify(byStatus))

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    const sample = allCases.slice(0, 15).map(r => ({
      caseNum: r.caseNum,
      externalId: r.externalId,
      applicant: r.applicant.slice(0, 80),
      respondent: r.respondent,
      filedDate: r.filedDate,
      decisionDate: r.decisionDate,
      status: r.status,
      claimText: r.claimText.slice(0, 160),
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      source: SOURCE_URL,
      totalCases: allCases.length,
      byStatus,
      sample,
    }

    fs.writeFileSync('pipeline-103-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-103-dry-run-sample.json')

    console.log('\nSample (first 5):')
    allCases.slice(0, 5).forEach((r, i) =>
      console.log(`  ${i + 1}. [${r.caseNum}] ${r.applicant.slice(0, 60)} v. ${r.respondent} (${r.status})`)
    )
    console.log('\nDry-run complete. No DB writes performed.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample' ? allCases.slice(0, sampleN) : allCases
  console.log(`\nStep 3: Writing ${rows.length} rows (batches of ${BATCH_SIZE})...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${row.caseNum} — ${row.applicant.slice(0, 60)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}–${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }
    if (!verbose) process.stdout.write(`  ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} processed...\r`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`\nDB: Claims=${dbClaims} Sources=${dbSources} Edges=${dbEdges}`)

  if (mode === 'sample') console.log('\nSample complete. Review then run --full with ALLOW_EDITS=true.')
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
