// Pipeline 53 — South Korea National Acts (korea_legislation_v1)
// Dataset: Korea Legislation Research Institute (KLRI) English Law Database
// URL: https://elaw.klri.re.kr/eng_service/lawViewContent.do?hseq=N
// No API key required — publicly accessible English translations
// Scope: All Korean laws available in English via KLRI (hseq 1–2000+)
// Run: npx tsx scripts/ingest-korea-legislation.ts --dry-run
//      npx tsx scripts/ingest-korea-legislation.ts --sample 10
//      npx tsx scripts/ingest-korea-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'korea_legislation_v1'
const PIPELINE = 'Pipeline 53'
const KLRI_BASE = 'https://elaw.klri.re.kr'
const MAX_HSEQ = 2200        // probe this many sequential IDs
const REQUEST_DELAY_MS = 800 // be polite
const MAX_CONSECUTIVE_EMPTY = 50 // stop if 50 in a row return no content

// ── Types ──────────────────────────────────────────────────────────────────────

interface CandidateRecord {
  externalId: string
  sourceExternalId: string
  hseq: number
  actNumber: string
  title: string
  enactedDate: Date
  enactedDateStr: string
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

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ── HTTP ───────────────────────────────────────────────────────────────────────

function httpsGet(url: string, timeoutMs = 20000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0; legal research)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpsGet(res.headers.location as string, timeoutMs).then(resolve).catch(reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }))
        res.on('error', reject)
      }
    )
    req.on('timeout', () => { req.destroy(); reject(new Error('Timed out')) })
    req.on('error', reject)
  })
}

// ── Parsers ────────────────────────────────────────────────────────────────────

// Month abbreviation → number
const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

function parseKlriDate(raw: string): Date | null {
  // Formats: "Mar. 15, 1951"  "Sep.  2, 1999"  "Oct.  2, 1948"
  const m = raw.match(/([A-Za-z]+)\.\s+(\d{1,2}),\s+(\d{4})/)
  if (!m) return null
  const month = MONTH_MAP[m[1]!]
  if (!month) return null
  const day = m[2]!.padStart(2, '0')
  const year = m[3]!
  const d = new Date(`${year}-${month}-${day}`)
  return isNaN(d.getTime()) ? null : d
}

function parseLawContent(html: string, hseq: number): CandidateRecord | null {
  // Extract title from <title> tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1]!.trim() : ''
  if (!title || title.length < 3) return null

  // Skip non-law pages (error pages, empty, etc.)
  if (title.includes('elaw.klri') || title === 'Korea Legislation Research Institute') return null

  // Extract Act No. and date: "Act No. 179, Mar. 15, 1951"
  const actMatch = html.match(/Act No\.\s*([\d,]+),\s*([A-Za-z]+\.\s+\d{1,2},\s+\d{4})/)
  if (!actMatch) return null

  const actNumber = `Act No. ${actMatch[1]!.replace(/,/g, '')}`
  const dateStr = actMatch[2]!.trim()
  const enactedDate = parseKlriDate(dateStr)
  if (!enactedDate) return null

  const sourceUrl = `${KLRI_BASE}/eng_service/lawView.do?hseq=${hseq}&lang=ENG`

  return {
    externalId: `kr_law_klri_${hseq}`,
    sourceExternalId: `src_kr_law_klri_${hseq}`,
    hseq,
    actNumber,
    title,
    enactedDate,
    enactedDateStr: dateStr,
    sourceUrl,
    sourceName: title,
  }
}

// ── DB write ───────────────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  topicCache.set(slug, created.id)
  return created.id
}

async function writeRow(rec: CandidateRecord, topicId: string): Promise<IngestResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
      if (existing) return 'skipped'

      const claimText = `South Korea enacted the ${rec.title} (${rec.actNumber}) on ${rec.enactedDateStr}.`

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
          autoApproved: true,
        },
      })

      const claim = await tx.claim.create({
        data: {
          text: claimText,
          ingestedBy: INGESTED_BY,
          autoApproved: true,
          externalId: rec.externalId,
          metadata: {
            dataset: INGESTED_BY,
            hseq: rec.hseq,
            actNumber: rec.actNumber,
            title: rec.title,
            enactedDate: rec.enactedDateStr,
            enactedYear: rec.enactedDate.getFullYear(),
            country: 'South Korea',
            source: 'KLRI',
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
    })
  } catch (err) {
    console.error(`  Error writing hseq=${rec.hseq}: ${err}`)
    return 'failed'
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── ${PIPELINE}: South Korea National Acts (KLRI) ─────────`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}${limit ? ` limit=${limit}` : ''}`)
  console.log(`Source: Korea Legislation Research Institute (no API key required)`)

  const candidates: CandidateRecord[] = []
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  // ── Step 1: Enumerate laws by probing hseq IDs ────────────────────────────
  console.log(`\nStep 1: Probing KLRI hseq IDs 1–${MAX_HSEQ}...`)

  let consecutiveEmpty = 0
  const maxHseq = limit > 0 ? Math.min(MAX_HSEQ, limit * 3) : MAX_HSEQ

  for (let hseq = 1; hseq <= maxHseq; hseq++) {
    if (limit > 0 && candidates.length >= limit) break
    if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
      console.log(`  Stopping: ${MAX_CONSECUTIVE_EMPTY} consecutive empty IDs`)
      break
    }

    try {
      const { status, body } = await httpsGet(
        `${KLRI_BASE}/eng_service/lawViewContent.do?hseq=${hseq}`
      )

      if (status !== 200 || body.length < 200) {
        consecutiveEmpty++
        if (verbose) console.log(`  hseq=${hseq}: empty/404`)
        await sleep(REQUEST_DELAY_MS)
        continue
      }

      const rec = parseLawContent(body, hseq)
      if (!rec) {
        consecutiveEmpty++
        if (verbose) console.log(`  hseq=${hseq}: no parseable law`)
        await sleep(REQUEST_DELAY_MS)
        continue
      }

      consecutiveEmpty = 0
      candidates.push(rec)

      if (verbose) console.log(`  hseq=${hseq}: ${rec.title} (${rec.actNumber}, ${rec.enactedDateStr})`)
      else if (candidates.length % 50 === 0) console.log(`  ...${candidates.length} laws found (hseq=${hseq})`)

    } catch (err) {
      if (verbose) console.error(`  hseq=${hseq} error: ${err}`)
      consecutiveEmpty++
    }

    await sleep(REQUEST_DELAY_MS)
  }

  console.log(`  Found ${candidates.length} parseable laws`)

  if (mode === 'dry-run') {
    console.log('\n── Dry-run sample (first 5) ──')
    candidates.slice(0, 5).forEach(r => console.log(`  ${r.externalId}: ${r.title} | ${r.actNumber} | ${r.enactedDateStr}`))
    const dryPath = 'pipeline-53-dry-run-sample.json'
    fs.writeFileSync(dryPath, JSON.stringify(candidates.slice(0, 20), null, 2))
    console.log(`\nDry-run complete. Sample written to ${dryPath}`)
    await prisma.$disconnect()
    return
  }

  // ── Step 2: Topic ──────────────────────────────────────────────────────────
  console.log('\nStep 2: Ensuring topics...')
  const topicId = await ensureTopic('kr-national-assembly', 'National Assembly of South Korea', 'government')

  // ── Step 3: Ingest ─────────────────────────────────────────────────────────
  const batch = mode === 'sample' ? candidates.slice(0, sampleN) : candidates
  console.log(`\nStep 3: Ingesting ${batch.length} records...`)

  for (const rec of batch) {
    const result = await writeRow(rec, topicId)
    counts[result === 'ingested' ? 'ingested' : result === 'skipped' ? 'skipped' : 'errors']++
    if (verbose || (counts.ingested % 100 === 0 && counts.ingested > 0)) {
      console.log(`  [${result}] hseq=${rec.hseq}: ${rec.title}`)
    }
  }

  console.log('\n── Results ──────────────────────────────────────────────')
  console.log(`  Ingested: ${counts.ingested}`)
  console.log(`  Skipped:  ${counts.skipped}`)
  console.log(`  Errors:   ${counts.errors}`)
  console.log('─────────────────────────────────────────────────────────\n')

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
