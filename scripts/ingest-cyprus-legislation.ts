// Pipeline 93 — Cyprus Legislation (cyprus_legislation_v1)
// Source: cylaw.org (Cyprus Bar Association — official Cyprus law database)
// Data: Numbered legislation index pages, one per year (1878–present), ~14,500 laws
// Note: Law titles are in Greek (official legal language); English translations exist for
//       major laws at cylaw.org/en/ but the comprehensive numbered index is Greek-only.
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-cyprus-legislation.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-cyprus-legislation.ts --sample 20
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-cyprus-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'
import * as http from 'http'

const prisma = new PrismaClient()

const INGESTED_BY = 'cyprus_legislation_v1'
const PIPELINE = 'Pipeline 93'
const BASE_URL = 'https://cylaw.org'
const ARITH_INDEX = 'https://cylaw.org/nomoi/arith_index.html'
const REQUEST_DELAY_MS = 800

// Years to ingest (focus on modern era; old colonial laws pre-1960 are lower value)
const START_YEAR = 1960
const END_YEAR = new Date().getFullYear()

// ── Types ──────────────────────────────────────────────────────────────────────

interface CandidateRecord {
  lawNo: string         // e.g. "1(I)/2020" or "5/1977"
  title: string         // Greek title
  year: number
  publishedAt: Date
  externalId: string
  sourceExternalId: string
  sourceUrl: string
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
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '20', 10) || 20) : 20,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const follow = (u: string, redirects = 0) => {
      if (redirects > 5) { reject(new Error('Too many redirects')); return }
      const parsed = new URL(u)
      const lib = parsed.protocol === 'https:' ? https : http
      lib.get(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
          'Accept-Language': 'el,en;q=0.9',
        },
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${parsed.protocol}//${parsed.host}${res.headers.location}`
          follow(next, redirects + 1)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          // The page uses windows-1253 encoding — decode properly
          const buf = Buffer.concat(chunks)
          // Use latin1 as proxy for windows-1253 (Greek chars)
          resolve(buf.toString('binary'))
        })
        res.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

// Convert windows-1253 binary string to UTF-8
function decodeWin1253(str: string): string {
  // Map windows-1253 high bytes to Unicode
  const map: Record<number, number> = {
    0x80:0x20AC,0x82:0x201A,0x83:0x0192,0x84:0x201E,0x85:0x2026,0x86:0x2020,
    0x87:0x2021,0x89:0x2030,0x8B:0x2039,0x91:0x2018,0x92:0x2019,0x93:0x201C,
    0x94:0x201D,0x95:0x2022,0x96:0x2013,0x97:0x2014,0x99:0x2122,0x9B:0x203A,
    0xA0:0x00A0,0xA1:0x0385,0xA2:0x0386,0xA3:0x00A3,0xA4:0x00A4,0xA5:0x00A5,
    0xA6:0x00A6,0xA7:0x00A7,0xA8:0x00A8,0xA9:0x00A9,0xAA:0x037A,0xAB:0x00AB,
    0xAC:0x00AC,0xAD:0x00AD,0xAF:0x2015,0xB0:0x00B0,0xB1:0x00B1,0xB2:0x00B2,
    0xB3:0x00B3,0xB4:0x0384,0xB5:0x00B5,0xB6:0x00B6,0xB7:0x00B7,0xB8:0x0388,
    0xB9:0x0389,0xBA:0x038A,0xBB:0x00BB,0xBC:0x038C,0xBD:0x00BD,0xBE:0x038E,
    0xBF:0x038F,0xC0:0x0390,0xC1:0x0391,0xC2:0x0392,0xC3:0x0393,0xC4:0x0394,
    0xC5:0x0395,0xC6:0x0396,0xC7:0x0397,0xC8:0x0398,0xC9:0x0399,0xCA:0x039A,
    0xCB:0x039B,0xCC:0x039C,0xCD:0x039D,0xCE:0x039E,0xCF:0x039F,0xD0:0x03A0,
    0xD1:0x03A1,0xD3:0x03A3,0xD4:0x03A4,0xD5:0x03A5,0xD6:0x03A6,0xD7:0x03A7,
    0xD8:0x03A8,0xD9:0x03A9,0xDA:0x03AA,0xDB:0x03AB,0xDC:0x03AC,0xDD:0x03AD,
    0xDE:0x03AE,0xDF:0x03AF,0xE0:0x03B0,0xE1:0x03B1,0xE2:0x03B2,0xE3:0x03B3,
    0xE4:0x03B4,0xE5:0x03B5,0xE6:0x03B6,0xE7:0x03B7,0xE8:0x03B8,0xE9:0x03B9,
    0xEA:0x03BA,0xEB:0x03BB,0xEC:0x03BC,0xED:0x03BD,0xEE:0x03BE,0xEF:0x03BF,
    0xF0:0x03C0,0xF1:0x03C1,0xF2:0x03C2,0xF3:0x03C3,0xF4:0x03C4,0xF5:0x03C5,
    0xF6:0x03C6,0xF7:0x03C7,0xF8:0x03C8,0xF9:0x03C9,0xFA:0x03CA,0xFB:0x03CB,
    0xFC:0x03CC,0xFD:0x03CD,0xFE:0x03CE,
  }
  return str.split('').map(ch => {
    const code = ch.charCodeAt(0)
    if (code < 0x80) return ch
    if (map[code]) return String.fromCodePoint(map[code])
    if (code >= 0x80 && code <= 0xFF) return ch
    return ch
  }).join('')
}

// ── Parsing ────────────────────────────────────────────────────────────────────

function parseYearIndex(html: string, year: number): CandidateRecord[] {
  const decoded = decodeWin1253(html)
  const records: CandidateRecord[] = []
  const seen = new Set<string>()

  // Pattern: <a href="/nomoi/arith/YYYY_N_NNN.pdf">Ν. X(I)/YYYY - Title</a>
  const linkPattern = /href="(\/nomoi\/arith\/(\d{4})_\d+_(\d+)\.pdf)"[^>]*>([^<]+)<\/a>/g
  let m: RegExpExecArray | null
  while ((m = linkPattern.exec(decoded)) !== null) {
    const [, href, linkYear, seqStr, rawText] = m
    if (parseInt(linkYear, 10) !== year) continue

    const text = rawText.trim()
    if (!text || text.length < 5) continue

    // Parse law number and title: "Ν. 1(I)/2020 - Title of law"
    const lawMatch = text.match(/^[ΝN]\.\s*(\S+)\s*-\s*(.+)/)
    if (!lawMatch) continue

    const lawNo = lawMatch[1].trim()
    const title = lawMatch[2].trim()
    if (!title || title.length < 3) continue

    const externalId = `cy_law_${year}_${lawNo.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toLowerCase()}`
    if (seen.has(externalId)) continue
    seen.add(externalId)

    const publishedAt = new Date(`${year}-01-01T00:00:00Z`)
    const sourceUrl = `${BASE_URL}${href}`

    records.push({
      lawNo, title, year, publishedAt, externalId,
      sourceExternalId: `${externalId}_src`,
      sourceUrl,
    })
  }

  return records
}

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const allRecords: CandidateRecord[] = []

  for (let year = END_YEAR; year >= START_YEAR; year--) {
    const url = `${BASE_URL}/nomoi/${year}_arith_index.html`
    if (verbose) console.log(`  Fetching ${year}...`)
    try {
      const html = await fetchUrl(url)
      const records = parseYearIndex(html, year)
      allRecords.push(...records)
      if (verbose) console.log(`    ${year}: ${records.length} laws`)
      else process.stdout.write(`  ${year}: ${records.length} laws (total: ${allRecords.length})\r`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (verbose) console.warn(`  ${year}: ${msg}`)
    }
    if (limit > 0 && allRecords.length >= limit) {
      allRecords.splice(limit)
      break
    }
    await sleep(REQUEST_DELAY_MS)
  }

  if (allRecords.length > 0) console.log()
  return allRecords
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
        name: `Cyprus Law No. ${rec.lawNo} (${rec.year}) — ${rec.title.slice(0, 80)}`,
        url: rec.sourceUrl,
        publishedAt: rec.publishedAt,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
      },
    })

    const claimText = `Cyprus enacted Law No. ${rec.lawNo}: ${rec.title}.`

    const claim = await tx.claim.create({
      data: {
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.publishedAt,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          lawNo: rec.lawNo,
          title: rec.title,
          year: rec.year,
          country: 'Cyprus',
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

  console.log(`\n── ${PIPELINE}: Cyprus Legislation ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | Years: ${START_YEAR}–${END_YEAR}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic('parliament-cyprus', 'House of Representatives of Cyprus', 'government', 'gov-region-europe')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Cyprus laws from cylaw.org (year-by-year index)...')
  const allCandidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  if (allCandidates.length === 0) {
    console.error('\nERROR: No candidates parsed — check cylaw.org structure.')
    process.exit(1)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const byDecade: Record<string, number> = {}
    for (const r of allCandidates) {
      const decade = `${Math.floor(r.year / 10) * 10}s`
      byDecade[decade] = (byDecade[decade] ?? 0) + 1
    }

    const sample = allCandidates.slice(0, 15).map(r => ({
      lawNo: r.lawNo, title: r.title, year: r.year, externalId: r.externalId,
      claimText: `Cyprus enacted Law No. ${r.lawNo}: ${r.title}.`,
      sourceUrl: r.sourceUrl,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      yearRange: `${START_YEAR}–${END_YEAR}`,
      distribution: { byDecade },
      sample,
    }

    fs.writeFileSync('pipeline-93-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-93-dry-run-sample.json')

    console.log('\nDistribution by decade:')
    Object.entries(byDecade).sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([d, n]) => console.log(`  ${d}: ${n}`))
    console.log('\nSample (first 5):')
    allCandidates.slice(0, 5).forEach((r, i) =>
      console.log(`  ${i + 1}. [${r.lawNo}] ${r.title.slice(0, 80)}${r.title.length > 80 ? '…' : ''}`)
    )
    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  if (mode === 'full' && !process.env.ALLOW_EDITS) {
    console.error('ERROR: Set ALLOW_EDITS=true to run in full mode.')
    process.exit(1)
  }

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
          if (verbose) console.log(`  [${result}] ${row.externalId}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}–${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }
    if (!verbose) process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length} processed...\r`)
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

  if (mode === 'sample') console.log('\nAwaiting explicit go-ahead before full run.')
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
