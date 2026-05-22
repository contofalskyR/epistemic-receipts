// Pipeline 89 — Trinidad and Tobago Revised Laws (tt_legislation_v1)
// Dataset: Government of T&T — Revised Laws of Trinidad and Tobago (chapter-numbered)
// Source: https://rgd.legalaffairs.gov.tt/laws2/  (Registrar General's Department,
//         Ministry of Legal Affairs)
//
// Structure: Apache directory listing.
//   - /laws2/?F=2                                  → 27 chapter HTML pages
//     (Ch._3.htm, Chs._1-2.htm, ..., Ch._90.htm)
//   - Each chapter HTML lists acts as:
//       <a href="Alphabetical_List/lawspdfs/X.YY.pdf">Title</a>
//     where X is the chapter number and YY the sub-act within that chapter
//     (T&T's "Chapter X:YY" Revised Laws citation form).
//   - /laws2/Alphabetical_List/lawspdfs/?F=2       → all PDFs with Last-modified
//     mtimes — used as the consolidated-revision publication date for each act.
//
// The catalog does NOT expose original enactment dates per row — only the date the
// consolidated PDF was last revised. We therefore set claimEmergedAt to the PDF's
// HTTP Last-Modified header (DAY precision) and document in metadata that this is
// the published-revision date, not the original enactment date.
//
// Run:
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-tt.ts --dry-run
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-tt.ts --sample 10
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-tt.ts --full [--limit N] [--verbose]
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'tt_legislation_v1'
const PIPELINE = 'Pipeline 89'
const BASE_URL = 'https://rgd.legalaffairs.gov.tt'
const LAWS_PATH = '/laws2'
const REQUEST_DELAY_MS = 400

interface CandidateRecord {
  chapter: string         // e.g. "3:01"
  chapterMajor: number    // 3
  chapterMinor: string    // "01"
  title: string
  pdfUrl: string
  pdfLastModified: Date | null
  externalId: string
  sourceExternalId: string
  sourceUrl: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

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

function httpsGet(url: string, timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0; legal research)',
          'Accept': 'text/html,*/*;q=0.9',
          'Accept-Language': 'en-GB,en;q=0.9',
        },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpsGet(new URL(res.headers.location, url).toString(), timeoutMs).then(resolve, reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for ${url}`))
            return
          }
          resolve(Buffer.concat(chunks).toString('utf8'))
        })
        res.on('error', reject)
      }
    )
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timed out: ${url}`)) })
    req.on('error', reject)
    req.end()
  })
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

// Parse the Apache directory index of /laws2/?F=2 — extract chapter HTM filenames.
function parseChapterIndex(html: string): string[] {
  const out = new Set<string>()
  for (const m of html.matchAll(/href="((?:Ch\.|Chs\.)[_0-9-]+\.htm)"/g)) out.add(m[1]!)
  return [...out]
}

// Parse a chapter HTML page — collect (chapter-key, title, pdfPath) triples.
// Each act link looks like:
//   <a href="Alphabetical_List/lawspdfs/3.01.pdf">Interpretation</a>
function parseChapterPage(html: string): Array<{ pdf: string; title: string }> {
  const out: Array<{ pdf: string; title: string }> = []
  const re = /<a[^>]+href="(?:Alphabetical_List\/)?lawspdfs\/([0-9]+\.[0-9]+)\.pdf"[^>]*>([\s\S]*?)<\/a>/gi
  for (const m of html.matchAll(re)) {
    const title = decodeEntities(stripHtml(m[2]!))
    if (!title || title.length < 2 || /^chapter\s/i.test(title)) continue
    out.push({ pdf: m[1]!, title })
  }
  return out
}

// Parse the PDF directory index — extract (pdfKey → Last-Modified Date) map.
// Each row looks like:
//   <a href="1.01.pdf">1.01.pdf</a></td><td align="right">05-Dec-2018 07:29</td>
function parsePdfIndex(html: string): Map<string, Date> {
  const out = new Map<string, Date>()
  const re = /<a href="([0-9]+\.[0-9]+)\.pdf">[\s\S]*?<\/td>\s*<td[^>]*>\s*(\d{2})-([A-Za-z]{3})-(\d{4})\s+\d{2}:\d{2}/g
  const monMap: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  }
  for (const m of html.matchAll(re)) {
    const monthNum = monMap[m[3]!]
    if (!monthNum) continue
    const dt = new Date(`${m[4]}-${monthNum}-${m[2]}T00:00:00Z`)
    if (!Number.isNaN(dt.getTime())) out.set(m[1]!, dt)
  }
  return out
}

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  console.log('  Fetching chapter index...')
  const chapterIndex = await httpsGet(`${BASE_URL}${LAWS_PATH}/?F=2`)
  const chapterFiles = parseChapterIndex(chapterIndex)
  console.log(`  Found ${chapterFiles.length} chapter HTML pages`)

  console.log('  Fetching PDF directory index (for mtimes)...')
  const pdfIndex = await httpsGet(`${BASE_URL}${LAWS_PATH}/Alphabetical_List/lawspdfs/?F=2`)
  const pdfMtimes = parsePdfIndex(pdfIndex)
  console.log(`  Found ${pdfMtimes.size} PDFs with Last-Modified dates`)

  const seen = new Set<string>()
  const records: CandidateRecord[] = []

  for (const chFile of chapterFiles) {
    const url = `${BASE_URL}${LAWS_PATH}/${chFile}`
    try {
      const html = await httpsGet(url)
      const acts = parseChapterPage(html)
      let added = 0
      for (const act of acts) {
        const [majorStr, minor] = act.pdf.split('.')
        const major = parseInt(majorStr!, 10)
        if (!Number.isFinite(major)) continue
        const chapterId = `${major}:${minor}`
        const externalId = `tt_law_${major}_${minor}`
        if (seen.has(externalId)) continue
        seen.add(externalId)
        records.push({
          chapter: chapterId,
          chapterMajor: major,
          chapterMinor: minor!,
          title: act.title,
          pdfUrl: `${BASE_URL}${LAWS_PATH}/Alphabetical_List/lawspdfs/${act.pdf}.pdf`,
          pdfLastModified: pdfMtimes.get(act.pdf) ?? null,
          externalId,
          sourceExternalId: `src_${externalId}`,
          sourceUrl: `${BASE_URL}${LAWS_PATH}/${chFile}`,
        })
        added++
      }
      if (verbose) console.log(`  ${chFile}: parsed=${acts.length} new=${added} — total ${records.length}`)
      else console.log(`  ${chFile}: ${added} acts`)
      if (limit > 0 && records.length >= limit) return records.slice(0, limit)
    } catch (err) {
      console.error(`  ${chFile} failed: ${(err as Error).message}`)
    }
    await sleep(REQUEST_DELAY_MS)
  }

  console.log(`\n  Unique candidates: ${records.length}`)
  return records
}

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    if (parentSlug && !existing.parentTopicId) {
      const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
      if (parent) {
        await prisma.topic.update({ where: { id: existing.id }, data: { parentTopicId: parent.id } })
        console.log(`  Reconciled parent on existing topic ${slug} → ${parentSlug}`)
      }
    }
    topicCache.set(slug, existing.id)
    return existing.id
  }
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

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: CandidateRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const enactedDate = rec.pdfLastModified ?? new Date('1962-08-31T00:00:00Z') // T&T independence — only used if mtime missing
    const precision: 'DAY' | 'YEAR' = rec.pdfLastModified ? 'DAY' : 'YEAR'

    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: `Trinidad & Tobago Revised Laws — Chapter ${rec.chapter}`,
        url: rec.sourceUrl,
        publishedAt: enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claimText = `Trinidad and Tobago published the ${rec.title} (Chapter ${rec.chapter} of the Revised Laws of Trinidad and Tobago).`

    const claim = await tx.claim.create({
      data: {
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'PROVISIONAL',
        claimEmergedAt: enactedDate,
        claimEmergedPrecision: precision,
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          chapter: rec.chapter,
          chapterMajor: rec.chapterMajor,
          chapterMinor: rec.chapterMinor,
          title: rec.title,
          pdfUrl: rec.pdfUrl,
          dateSource: rec.pdfLastModified ? 'pdf_last_modified' : 'tt_independence_fallback',
          pdfLastModified: rec.pdfLastModified?.toISOString() ?? null,
          country: 'Trinidad and Tobago',
          source: 'rgd.legalaffairs.gov.tt',
          note: 'Consolidated Revised Laws chapter — claimEmergedAt is the published-PDF revision date, not the original act enactment date.',
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

async function main() {
  const { mode, limit, sampleN, verbose } = parseArgs()
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE}: Trinidad & Tobago Revised Laws (Ministry of Legal Affairs) ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}${limit ? ` limit=${limit}` : ''}`)
  console.log(`Source: rgd.legalaffairs.gov.tt/laws2 — chapter-numbered consolidated laws`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('\nALLOW_EDITS=true is required for sample/full modes.')
    process.exit(2)
  }

  console.log('\nStep 1: Fetching chapter index and PDF directory...')
  const candidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal unique candidates: ${candidates.length}`)
  if (candidates.length === 0) {
    console.error('\nERROR: 0 candidates parsed — rgd.legalaffairs.gov.tt structure may have changed.')
    process.exit(1)
  }

  if (mode === 'dry-run') {
    const byChapter: Record<string, number> = {}
    const byYear: Record<string, number> = {}
    let withDate = 0
    for (const r of candidates) {
      const key = `Ch.${r.chapterMajor}`
      byChapter[key] = (byChapter[key] ?? 0) + 1
      if (r.pdfLastModified) {
        withDate++
        const y = r.pdfLastModified.getUTCFullYear()
        byYear[y] = (byYear[y] ?? 0) + 1
      }
    }
    const sample = candidates.slice(0, 15).map(r => ({
      externalId: r.externalId,
      chapter: r.chapter,
      title: r.title,
      pdfUrl: r.pdfUrl,
      pdfLastModified: r.pdfLastModified?.toISOString() ?? null,
      sourceUrl: r.sourceUrl,
      claimText: `Trinidad and Tobago published the ${r.title} (Chapter ${r.chapter} of the Revised Laws of Trinidad and Tobago).`,
    }))
    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: candidates.length,
      coverage: { withPdfMtime: withDate },
      distribution: { byChapter, byYear },
      sample,
    }
    fs.writeFileSync('pipeline-89-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-89-dry-run-sample.json')

    console.log('\nPDF Last-Modified year distribution:')
    Object.entries(byYear).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => console.log(`  ${k}: ${v}`))

    console.log('\nCoverage:')
    console.log(`  PDF Last-Modified present: ${withDate} / ${candidates.length} (${(100 * withDate / candidates.length).toFixed(1)}%)`)

    console.log('\nSample (first 5):')
    candidates.slice(0, 5).forEach((r, i) => console.log(
      `  ${i + 1}. Ch ${r.chapter} — ${r.title}`
    ))
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  console.log('\nStep 2: Ensuring topic...')
  const topicId = await ensureTopic('tt-parliament', 'Parliament of Trinidad and Tobago', 'government', 'gov-region-americas')

  const rows = mode === 'sample' ? candidates.slice(0, sampleN) : candidates
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
      console.error(`  Batch ${i}–${i + batch.length} failed: ${(err as Error).message}`)
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
