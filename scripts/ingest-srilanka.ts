// Pipeline 80 — Sri Lanka National Acts of Parliament (srilanka_legislation_v1)
// Dataset: Department of Government Printing — Acts of Parliament
// Source: https://documents.gov.lk/view/act/acts.html (year index)
//         https://documents.gov.lk/view/act/acts_{YYYY}.html (per-year listing)
// PDF pattern: /view/act/{YYYY}/{M}/{NN}-{YYYY}_{E|S|T}.pdf  (E=English, S=Sinhala, T=Tamil)
//
// The task brief named lawnet.gov.lk, but that domain currently returns a placeholder
// ("root directory" response under a mybluehost.me cert) — effectively parked. The
// authoritative public catalogue of post-1948 Sri Lankan Acts is published by the
// Department of Government Printing on documents.gov.lk, year index covers 1981–2026
// (no API; plain static HTML tables — one row per Act with Act Number, Date,
// Description, and download links for English/Sinhala/Tamil PDFs).
//
// Run:
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-srilanka.ts --dry-run
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-srilanka.ts --sample 10
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-srilanka.ts --full [--limit N] [--verbose]
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'srilanka_legislation_v1'
const PIPELINE = 'Pipeline 80'
const BASE_URL = 'https://documents.gov.lk'
const YEAR_START = 1981
const YEAR_END = 2026
const REQUEST_DELAY_MS = 500

interface CandidateRecord {
  actNumber: string
  year: number
  enactedDate: Date | null
  enactedDatePrecision: 'DAY' | 'YEAR'
  description: string
  pdfEn: string | null
  pdfSi: string | null
  pdfTa: string | null
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
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ── HTTP ───────────────────────────────────────────────────────────────────────

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
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-GB,en;q=0.9',
        },
        timeout: timeoutMs,
        // documents.gov.lk presents a generic Bluehost cert chain; reject only on hard transport errors
        rejectUnauthorized: false,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirect = new URL(res.headers.location, url).toString()
          httpsGet(redirect, timeoutMs).then(resolve, reject)
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

// ── Parsers ────────────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

// Each <tr> in the per-year table has 4 <td>s:
//   1) Act Number — e.g. "34/2024", "09/2026", "78/1981"
//   2) Date       — "YYYY-MM-DD"
//   3) Description (may include trailing whitespace/newlines)
//   4) Download   — three <a href="…_{E|S|T}.pdf">…</a> buttons; missing langs render
//                   as <button … disabled>…</button> (no <a>), which we treat as null.
function parseYearPage(html: string, year: number): CandidateRecord[] {
  const records: CandidateRecord[] = []
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/)
  if (!tbodyMatch) return records
  const rows = tbodyMatch[1]!.split(/<tr>/).slice(1) // first chunk is pre-row whitespace

  for (const rowChunk of rows) {
    const rowEnd = rowChunk.indexOf('</tr>')
    const row = rowEnd >= 0 ? rowChunk.slice(0, rowEnd) : rowChunk
    const tds = [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => m[1]!)
    if (tds.length < 4) continue

    const actCell = stripHtml(tds[0]!)
    // "NN/YYYY" or "NNX/YYYY" — keep the act number portion before the slash
    const actNumMatch = actCell.match(/^([0-9A-Za-z]+)\s*\/\s*(\d{4})$/)
    if (!actNumMatch) continue
    const actNumber = actNumMatch[1]!.toUpperCase()
    const yearFromCell = parseInt(actNumMatch[2]!, 10)
    if (yearFromCell !== year) continue // page sanity guard

    const dateCell = stripHtml(tds[1]!)
    let enactedDate: Date | null = null
    let enactedDatePrecision: 'DAY' | 'YEAR' = 'YEAR'
    const dm = dateCell.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dm) {
      enactedDate = new Date(`${dm[1]}-${dm[2]}-${dm[3]}T00:00:00Z`)
      enactedDatePrecision = 'DAY'
    } else {
      enactedDate = new Date(`${year}-01-01T00:00:00Z`)
      enactedDatePrecision = 'YEAR'
    }

    const description = decodeEntities(stripHtml(tds[2]!))
    if (!description || description.length < 2) continue

    const dlCell = tds[3]!
    const hrefs = [...dlCell.matchAll(/href="([^"]+\.pdf)"/gi)].map(m => m[1]!)
    const pdfEn = hrefs.find(h => /_E\.pdf$/i.test(h)) ?? null
    const pdfSi = hrefs.find(h => /_S\.pdf$/i.test(h)) ?? null
    const pdfTa = hrefs.find(h => /_T\.pdf$/i.test(h)) ?? null

    const absolutize = (rel: string | null): string | null =>
      rel ? `${BASE_URL}/view/act/${rel.replace(/^\/+/, '')}` : null

    const externalId = `lk_act_${year}_${actNumber}`
    records.push({
      actNumber,
      year,
      enactedDate,
      enactedDatePrecision,
      description,
      pdfEn: absolutize(pdfEn),
      pdfSi: absolutize(pdfSi),
      pdfTa: absolutize(pdfTa),
      externalId,
      sourceExternalId: `src_${externalId}`,
      sourceUrl: `${BASE_URL}/view/act/acts_${year}.html`,
    })
  }

  return records
}

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const seen = new Set<string>()
  const records: CandidateRecord[] = []
  let parsedTotal = 0

  for (let year = YEAR_END; year >= YEAR_START; year--) {
    const url = `${BASE_URL}/view/act/acts_${year}.html`
    try {
      const html = await httpsGet(url)
      const rows = parseYearPage(html, year)
      parsedTotal += rows.length
      let added = 0
      for (const r of rows) {
        if (seen.has(r.externalId)) continue
        seen.add(r.externalId); records.push(r); added++
      }
      if (verbose) console.log(`  ${year}: parsed=${rows.length} new=${added} — total ${records.length}`)
      else console.log(`  ${year}: ${added} acts`)
      if (limit > 0 && records.length >= limit) return records.slice(0, limit)
    } catch (err) {
      console.error(`  ${year} fetch failed: ${(err as Error).message}`)
    }
    await sleep(REQUEST_DELAY_MS)
  }

  console.log(`\n  Parsed rows (pre-dedup):       ${parsedTotal}`)
  console.log(`  Unique candidates after dedup: ${records.length}`)
  return records
}

// ── Topic management ───────────────────────────────────────────────────────────

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

// ── Write one row ─────────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: CandidateRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const enactedDate = rec.enactedDate ?? new Date(`${rec.year}-01-01T00:00:00Z`)
    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: `Sri Lanka Acts of ${rec.year} — Act No. ${rec.actNumber}`,
        url: rec.sourceUrl,
        publishedAt: enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claimText = `Sri Lanka enacted the ${rec.description} (Act No. ${rec.actNumber} of ${rec.year}).`

    const claim = await tx.claim.create({
      data: {
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'PROVISIONAL',
        claimEmergedAt: enactedDate,
        claimEmergedPrecision: rec.enactedDatePrecision,
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          actNumber: rec.actNumber,
          year: rec.year,
          dateRaw: rec.enactedDate?.toISOString().slice(0, 10) ?? null,
          description: rec.description,
          pdfUrls: { en: rec.pdfEn, si: rec.pdfSi, ta: rec.pdfTa },
          country: 'Sri Lanka',
          source: 'documents.gov.lk',
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
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE}: Sri Lanka National Acts of Parliament (Dept. of Government Printing) ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}${limit ? ` limit=${limit}` : ''}`)
  console.log(`Source: documents.gov.lk — Acts of Parliament ${YEAR_START}–${YEAR_END}`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('\nALLOW_EDITS=true is required for sample/full modes (refusing to write to DB).')
    process.exit(2)
  }

  console.log('\nStep 1: Fetching Acts of Parliament catalogue (per year)...')
  const candidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal unique candidates: ${candidates.length}`)
  if (candidates.length === 0) {
    console.error('\nERROR: 0 candidates parsed — documents.gov.lk markup may have changed.')
    process.exit(1)
  }

  if (mode === 'dry-run') {
    const byYear: Record<string, number> = {}
    const byDecade: Record<string, number> = {}
    let withDate = 0, withEn = 0, withSi = 0, withTa = 0
    for (const r of candidates) {
      byYear[r.year] = (byYear[r.year] ?? 0) + 1
      const decade = `${Math.floor(r.year / 10) * 10}s`
      byDecade[decade] = (byDecade[decade] ?? 0) + 1
      if (r.enactedDatePrecision === 'DAY') withDate++
      if (r.pdfEn) withEn++
      if (r.pdfSi) withSi++
      if (r.pdfTa) withTa++
    }

    const sample = candidates.slice(0, 15).map(r => ({
      externalId: r.externalId,
      actNumber: r.actNumber,
      year: r.year,
      date: r.enactedDate?.toISOString().slice(0, 10) ?? null,
      description: r.description,
      pdfEn: r.pdfEn,
      pdfSi: r.pdfSi,
      pdfTa: r.pdfTa,
      sourceUrl: r.sourceUrl,
      claimText: `Sri Lanka enacted the ${r.description} (Act No. ${r.actNumber} of ${r.year}).`,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: candidates.length,
      coverage: {
        precisionDay: withDate,
        pdfEnglish: withEn,
        pdfSinhala: withSi,
        pdfTamil: withTa,
      },
      distribution: { byDecade, byYear },
      sample,
    }

    fs.writeFileSync('pipeline-80-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-80-dry-run-sample.json')

    console.log('\nDecade distribution:')
    Object.entries(byDecade).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => console.log(`  ${k}: ${v}`))

    console.log('\nCoverage:')
    console.log(`  DAY-precision dates: ${withDate} / ${candidates.length} (${(100 * withDate / candidates.length).toFixed(1)}%)`)
    console.log(`  English PDF link:    ${withEn} / ${candidates.length} (${(100 * withEn / candidates.length).toFixed(1)}%)`)
    console.log(`  Sinhala PDF link:    ${withSi} / ${candidates.length} (${(100 * withSi / candidates.length).toFixed(1)}%)`)
    console.log(`  Tamil PDF link:      ${withTa} / ${candidates.length} (${(100 * withTa / candidates.length).toFixed(1)}%)`)

    console.log('\nSample (first 5):')
    candidates.slice(0, 5).forEach((r, i) => console.log(
      `  ${i + 1}. Act ${r.actNumber}/${r.year} — ${r.description.slice(0, 75)}${r.description.length > 75 ? '…' : ''}`
    ))
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  console.log('\nStep 2: Ensuring topic...')
  const topicId = await ensureTopic('lk-parliament', 'Parliament of Sri Lanka', 'government', 'gov-region-asia-pacific')

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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.description.slice(0, 70)}`)
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
