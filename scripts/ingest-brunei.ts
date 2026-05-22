// Pipeline 90 — Brunei Darussalam Laws (brunei_legislation_v1)
// Dataset: Attorney General's Chambers — Laws of Brunei Darussalam (BRULAW catalogue)
// Source: https://www.agc.gov.bn/AGC%20Site%20Pages/BRULAW%20{LETTER}.aspx
//         (alphabetical pages A–Y; the SharePoint catalog uses inconsistent dash
//         conventions for the first three letters: A/B/C use "BRULAW%20-%20X.aspx",
//         D-Y use "BRULAW%20X.aspx".)
//
// Each alphabetical page is a SharePoint-rendered HTML table with one row per Act:
//   col 1: act title (in <strong>...</strong>)
//   col 2: CAP. NNN identifier, often wrapped in <a> link to the per-act detail page
//          (this is the canonical citation form, "Chapter NNN of the Revised Laws")
//   col 3: subsidiary-legislation links if any
//   col 4: "DATE COMING INTO FORCE" — DD-MM-YYYY (sometimes wrapped in <a> link to
//          a Gazette PDF) or "Repealed".
//
// We capture the Cap-numbered primary Acts (skipping Repealed rows for now — those
// would need humanReviewed curation since the title block format on a repealed row
// is inconsistent and contains no CAP number we can use as a stable ID).
//
// Run:
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-brunei.ts --dry-run
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-brunei.ts --sample 10
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-brunei.ts --full [--limit N] [--verbose]
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'brunei_legislation_v1'
const PIPELINE = 'Pipeline 90'
const BASE_URL = 'https://www.agc.gov.bn'
const REQUEST_DELAY_MS = 600

// First three letters use a hyphenated path; rest do not (AGC's own inconsistency).
const LETTERS: Array<{ letter: string; path: string }> = [
  { letter: 'A', path: '/AGC%20Site%20Pages/BRULAW%20-%20A.aspx' },
  { letter: 'B', path: '/AGC%20Site%20Pages/BRULAW%20-%20B.aspx' },
  { letter: 'C', path: '/AGC%20Site%20Pages/BRULAW%20-%20C.aspx' },
  { letter: 'D', path: '/AGC%20Site%20Pages/BRULAW%20D.aspx' },
  { letter: 'E', path: '/AGC%20Site%20Pages/BRULAW%20E.aspx' },
  { letter: 'F', path: '/AGC%20Site%20Pages/BRULAW%20F.aspx' },
  { letter: 'G', path: '/AGC%20Site%20Pages/BRULAW%20G.aspx' },
  { letter: 'H', path: '/AGC%20Site%20Pages/BRULAW%20H.aspx' },
  { letter: 'I', path: '/AGC%20Site%20Pages/BRULAW%20I.aspx' },
  { letter: 'K', path: '/AGC%20Site%20Pages/BRULAW%20K.aspx' },
  { letter: 'L', path: '/AGC%20Site%20Pages/BRULAW%20L.aspx' },
  { letter: 'M', path: '/AGC%20Site%20Pages/BRULAW%20M.aspx' },
  { letter: 'N', path: '/AGC%20Site%20Pages/BRULAW%20N.aspx' },
  { letter: 'O', path: '/AGC%20Site%20Pages/BRULAW%20O.aspx' },
  { letter: 'P', path: '/AGC%20Site%20Pages/BRULAW%20P.aspx' },
  { letter: 'Q', path: '/AGC%20Site%20Pages/BRULAW%20Q.aspx' },
  { letter: 'R', path: '/AGC%20Site%20Pages/BRULAW%20R.aspx' },
  { letter: 'S', path: '/AGC%20Site%20Pages/BRULAW%20S.aspx' },
  { letter: 'T', path: '/AGC%20Site%20Pages/BRULAW%20T.aspx' },
  { letter: 'U', path: '/AGC%20Site%20Pages/BRULAW%20U.aspx' },
  { letter: 'V', path: '/AGC%20Site%20Pages/BRULAW%20V.aspx' },
  { letter: 'W', path: '/AGC%20Site%20Pages/BRULAW%20W.aspx' },
  { letter: 'Y', path: '/AGC%20Site%20Pages/BRULAW%20Y.aspx' },
]

interface CandidateRecord {
  letter: string
  cap: string                  // e.g. "267", "40A", "160"
  title: string
  enactedDate: Date | null
  enactedDatePrecision: 'DAY' | 'YEAR'
  rawDate: string | null
  actDetailUrl: string | null  // /AGC%20Site%20Pages/{TITLE}.aspx if present
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
          'Accept': 'text/html,application/xhtml+xml',
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
    .replace(/&#58;/gi, ':').replace(/&#160;/g, ' ').replace(/​/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function stripHtml(s: string): string {
  // Replace block-breaking tags with a space so adjacent inline text doesn't fuse
  // (e.g. "CAP. 205<br>S 66/2001" → "CAP. 205 S 66/2001", not "CAP. 205S 66/2001").
  return s
    .replace(/<\s*(br|p|div|td|tr|li|hr)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Split a chunk of HTML at <tr ...> boundaries inside the main BRULAW table only,
// then yield each row's inner HTML. Avoids parsing the page navigation tables
// (which use ms-rteTable-3) by restricting to ms-rteTable-1.
function* iterateLawRows(html: string): IterableIterator<string> {
  const tableRe = /<table[^>]*class="[^"]*ms-rteTable-1[^"]*"[^>]*>([\s\S]*?)<\/table>/g
  for (const tm of html.matchAll(tableRe)) {
    const body = tm[1]!
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g
    for (const rm of body.matchAll(trRe)) yield rm[1]!
  }
}

// Extract the four key fields from a row's TDs:
//   td[0]: title (in <strong>)
//   td[1]: CAP. NNN identifier with link to act detail page
//   td[3]: DATE COMING INTO FORCE (DD-MM-YYYY or "Repealed")
function parseLawRow(rowHtml: string, letter: string): CandidateRecord | null {
  const tdMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]!)
  if (tdMatches.length < 2) return null

  const titleCell = tdMatches[0]!
  // Layout column count varies — A pages have 4 TDs (title, CAP, SL, date) while
  // most other letters have 5 TDs (title, 1%-separator, CAP, SL, date). Scan every
  // TD after the first for the CAP. NNN cell rather than indexing by position.
  let capCellIdx = -1
  let cap: string | null = null
  for (let i = 1; i < tdMatches.length - 1; i++) {
    const m = decodeEntities(stripHtml(tdMatches[i]!))
      .match(/CAP\.\s*([0-9]+(?:[A-Z](?![A-Z]))?)/i)
    if (m) { capCellIdx = i; cap = m[1]!.toUpperCase(); break }
  }
  const dateCell = tdMatches[tdMatches.length - 1] ?? ''

  // Skip rows that are header rows / non-act rows
  const titleText = decodeEntities(stripHtml(titleCell))
  if (!titleText || titleText.length < 3) return null
  if (/^(title|date coming into force|cap\b|subsidiary)$/i.test(titleText)) return null

  // No CAP. NNN identifier → not a primary-act row (could be a subsidiary-only
  // sub-row or a "Repealed"-marker row); skip.
  if (!cap) return null
  const capCell = tdMatches[capCellIdx]!

  // Detail page URL — first <a href="/AGC..."> inside the cap cell
  const detailMatch = capCell.match(/href="(\/AGC[^"]+\.aspx)"/i)
  const actDetailUrl = detailMatch ? `${BASE_URL}${detailMatch[1]!}` : null

  // Date — DD-MM-YYYY anywhere in the date cell
  const dateText = decodeEntities(stripHtml(dateCell))
  let enactedDate: Date | null = null
  let enactedDatePrecision: 'DAY' | 'YEAR' = 'YEAR'
  let rawDate: string | null = null
  const dm = dateText.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/)
  if (dm) {
    const [, d, m, y] = dm
    enactedDate = new Date(`${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}T00:00:00Z`)
    if (!Number.isNaN(enactedDate.getTime())) {
      enactedDatePrecision = 'DAY'
      rawDate = `${d!.padStart(2, '0')}-${m!.padStart(2, '0')}-${y}`
    } else {
      enactedDate = null
    }
  } else if (/repealed/i.test(dateText)) {
    rawDate = 'Repealed'
  }

  // Clean title — strip out trailing CAP / SL / [M] junk that sometimes bleeds in
  const cleanTitle = titleText
    .replace(/\s*CAP\.\s*\d+[A-Z]?\s*$/i, '')
    .replace(/\s*\[[MS]\]\s*$/i, '')
    .replace(/\s*SL\s*$/i, '')
    .trim()
  if (!cleanTitle || cleanTitle.length < 3) return null

  const externalId = `bn_law_cap_${cap}`
  return {
    letter,
    cap,
    title: cleanTitle,
    enactedDate,
    enactedDatePrecision,
    rawDate,
    actDetailUrl,
    externalId,
    sourceExternalId: `src_${externalId}`,
    sourceUrl: actDetailUrl ?? `${BASE_URL}/AGC%20Site%20Pages/BRULAW%20${letter}.aspx`,
  }
}

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const seen = new Map<string, CandidateRecord>()
  let totalRowsScanned = 0

  for (const { letter, path } of LETTERS) {
    const url = `${BASE_URL}${path}`
    try {
      const html = await httpsGet(url)
      let added = 0
      let rowsScanned = 0
      for (const rowHtml of iterateLawRows(html)) {
        rowsScanned++
        const rec = parseLawRow(rowHtml, letter)
        if (!rec) continue
        if (!seen.has(rec.externalId)) {
          seen.set(rec.externalId, rec)
          added++
          if (limit > 0 && seen.size >= limit) {
            console.log(`  ${letter}: ${added} acts (hit limit)`)
            return [...seen.values()]
          }
        }
      }
      totalRowsScanned += rowsScanned
      if (verbose) console.log(`  ${letter}: rows=${rowsScanned} new=${added} — total ${seen.size}`)
      else console.log(`  ${letter}: ${added} acts`)
    } catch (err) {
      console.error(`  ${letter} failed: ${(err as Error).message}`)
    }
    await sleep(REQUEST_DELAY_MS)
  }

  console.log(`\n  Total <tr> rows scanned: ${totalRowsScanned}`)
  console.log(`  Unique CAP-numbered acts: ${seen.size}`)
  return [...seen.values()]
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
    // Fallback to Brunei's full independence (1984-01-01) when no commencement date is exposed
    const enactedDate = rec.enactedDate ?? new Date('1984-01-01T00:00:00Z')
    const precision = rec.enactedDate ? rec.enactedDatePrecision : 'YEAR'

    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: `Laws of Brunei — ${rec.title.slice(0, 100)} (Cap. ${rec.cap})`,
        url: rec.sourceUrl,
        publishedAt: enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claimText = `Brunei Darussalam enacted the ${rec.title} (Chapter ${rec.cap} of the Laws of Brunei).`

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
          cap: rec.cap,
          title: rec.title,
          letter: rec.letter,
          actDetailUrl: rec.actDetailUrl,
          rawDate: rec.rawDate,
          dateSource: rec.enactedDate ? 'date_coming_into_force' : 'brunei_independence_fallback',
          country: 'Brunei Darussalam',
          source: 'agc.gov.bn',
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

  console.log(`\n── ${PIPELINE}: Brunei Laws (Attorney General's Chambers) ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}${limit ? ` limit=${limit}` : ''}`)
  console.log(`Source: agc.gov.bn — BRULAW alphabetical pages (A–Y, ${LETTERS.length} pages)`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('\nALLOW_EDITS=true is required for sample/full modes.')
    process.exit(2)
  }

  console.log('\nStep 1: Fetching BRULAW alphabetical catalogue...')
  const candidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal unique candidates: ${candidates.length}`)
  if (candidates.length === 0) {
    console.error('\nERROR: 0 candidates parsed — agc.gov.bn BRULAW markup may have changed.')
    process.exit(1)
  }

  if (mode === 'dry-run') {
    const byLetter: Record<string, number> = {}
    let withDate = 0, withDetailUrl = 0
    for (const r of candidates) {
      byLetter[r.letter] = (byLetter[r.letter] ?? 0) + 1
      if (r.enactedDate) withDate++
      if (r.actDetailUrl) withDetailUrl++
    }
    const sample = candidates.slice(0, 15).map(r => ({
      externalId: r.externalId,
      cap: r.cap,
      title: r.title,
      enactedDate: r.enactedDate?.toISOString().slice(0, 10) ?? null,
      rawDate: r.rawDate,
      actDetailUrl: r.actDetailUrl,
      sourceUrl: r.sourceUrl,
      claimText: `Brunei Darussalam enacted the ${r.title} (Chapter ${r.cap} of the Laws of Brunei).`,
    }))
    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: candidates.length,
      coverage: { withDate, withDetailUrl },
      distribution: { byLetter },
      sample,
    }
    fs.writeFileSync('pipeline-90-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-90-dry-run-sample.json')

    console.log('\nLetter distribution:')
    Object.entries(byLetter).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => console.log(`  ${k}: ${v}`))

    console.log('\nCoverage:')
    console.log(`  Date coming into force present: ${withDate} / ${candidates.length} (${(100 * withDate / candidates.length).toFixed(1)}%)`)
    console.log(`  Act detail page URL present:    ${withDetailUrl} / ${candidates.length} (${(100 * withDetailUrl / candidates.length).toFixed(1)}%)`)

    console.log('\nSample (first 5):')
    candidates.slice(0, 5).forEach((r, i) => console.log(
      `  ${i + 1}. Cap ${r.cap} — ${r.title}${r.rawDate ? ` [${r.rawDate}]` : ''}`
    ))
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  console.log('\nStep 2: Ensuring topic...')
  const topicId = await ensureTopic('bn-parliament', 'Laws of Brunei Darussalam', 'government', 'gov-region-asia-pacific')

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
