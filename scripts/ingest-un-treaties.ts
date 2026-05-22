// Pipeline 94 — UN Multilateral Treaties (un_treaties_v1)
// Dataset: UN Treaty Collection MTDSG — multilateral treaties deposited with the Secretary-General
// Source: https://treaties.un.org/Pages/ParticipationStatus.aspx (chapter-based HTML listing)
// Chapters I–XXVII enumerated at:
//   https://treaties.un.org/Pages/Treaties.aspx?id=N&subid=A&clang=_en  (N = 1..27)
// API: HTML scraping — no OData/JSON API available. Site is ASP.NET with VIEWSTATE.
// Run: npx tsx scripts/ingest-un-treaties.ts --dry-run
//      npx tsx scripts/ingest-un-treaties.ts --sample 10
//      npx tsx scripts/ingest-un-treaties.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

const INGESTED_BY = 'un_treaties_v1'
const PIPELINE = 'Pipeline 94'
const BASE_URL = 'https://treaties.un.org'
const REQUEST_DELAY_MS = 1000

// UN MTDSG chapters I–XXVII
const CHAPTERS: Array<{ id: number; name: string }> = [
  { id: 1,  name: 'Charter of the United Nations and Statute of the ICJ' },
  { id: 2,  name: 'Pacific Settlement of International Disputes' },
  { id: 3,  name: 'Privileges and Immunities, Diplomatic and Consular Relations' },
  { id: 4,  name: 'Human Rights' },
  { id: 5,  name: 'Refugees and Stateless Persons' },
  { id: 6,  name: 'Narcotic Drugs and Psychotropic Substances' },
  { id: 7,  name: 'Traffic in Persons' },
  { id: 8,  name: 'Obscene Publications' },
  { id: 9,  name: 'Transport and Communications' },
  { id: 10, name: 'Commerce' },
  { id: 11, name: 'Commodities' },
  { id: 12, name: 'Customs' },
  { id: 13, name: 'Intellectual Property' },
  { id: 14, name: 'Labour' },
  { id: 15, name: 'Penal Matters' },
  { id: 16, name: 'Psychotropic Substances' },
  { id: 17, name: 'Private International Law' },
  { id: 18, name: 'Monetary, Financial and Fiscal Matters' },
  { id: 19, name: 'Health and Medical Assistance' },
  { id: 20, name: 'Social Matters' },
  { id: 21, name: 'Aerial Navigation' },
  { id: 22, name: 'Sea Law' },
  { id: 23, name: 'Environmental Conventions' },
  { id: 24, name: 'Arms Regulation and Disarmament' },
  { id: 25, name: 'Arbitration' },
  { id: 26, name: 'Relations between States' },
  { id: 27, name: 'Various Treaties' },
]

// ── Types ──────────────────────────────────────────────────────────────────────

interface TreatyRecord {
  mtdsgNo: string
  title: string
  shortTitle: string
  location: string
  treatyDate: Date
  treatyDateStr: string
  chapterId: number
  chapterName: string
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

// ── HTTP via curl ──────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function curlGet(url: string): string {
  return execSync(
    `curl -s -m 30 -L -A "Mozilla/5.0 (compatible; EpistemicReceipts/1.0)" ` +
    `-H "Accept-Language: en-US,en;q=0.9" ` +
    `"${url}"`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  )
}

// ── Parsing ────────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/\s+/g, ' ').trim()
}

function parseTreatyDate(titleStr: string): { cleanTitle: string; location: string; date: Date | null; dateStr: string } {
  // Titles end with "... City, DD Month YYYY" or "... City/Country, DD Month YYYY"
  // e.g. "San Francisco, 26 June 1945" or "New York, 17 December 1963"
  const dateMatch = titleStr.match(/,\s+(\d{1,2}\s+\w+\s+\d{4})\s*$/)
  const placeMatch = titleStr.match(/\.\s+&nbsp;&nbsp;([^,]+),\s+\d{1,2}\s+\w+\s+\d{4}\s*$/)

  if (dateMatch) {
    const dateStr = dateMatch[1]
    const parsed = new Date(`${dateStr} UTC`)
    const locationStr = placeMatch ? placeMatch[1].trim() : ''

    // Remove the ". &nbsp;&nbsp;Location, Date" suffix
    const cleanTitle = titleStr
      .replace(/\.\s+&nbsp;&nbsp;.*$/, '')
      .replace(/\s+&nbsp;&nbsp;.*$/, '')
      .trim()

    return {
      cleanTitle: stripHtml(cleanTitle),
      location: stripHtml(locationStr),
      date: isNaN(parsed.getTime()) ? null : parsed,
      dateStr: isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10),
    }
  }

  return { cleanTitle: stripHtml(titleStr), location: '', date: null, dateStr: '' }
}

function parseChapterPage(html: string, chapterId: number, chapterName: string): TreatyRecord[] {
  const records: TreatyRecord[] = []

  // Each treaty row: <a href="ViewDetails.aspx?src=TREATY&mtdsg_no=I-1&chapter=1&clang=_en">title...</a>
  const rowPattern = /<a\s+href="ViewDetails\.aspx\?src=TREATY&(?:amp;)?mtdsg_no=([^&"]+)&(?:amp;)?chapter=(\d+)[^"]*"[^>]*>([^<]*(?:<[^>]*>[^<]*)*?)<\/a>/g

  // Also try the invisible cell pattern which has the clean short title
  // <td class="invisible">I-1</td>  and  <td class="invisible">Charter of...</td>
  const invisiblePattern = /<td[^>]*class="invisible"[^>]*>([^<]*)<\/td>/g

  // Parse entire table rows looking for mtdsg_no in href
  const linkPattern = /href="ViewDetails\.aspx\?[^"]*mtdsg_no=([^&"]+)[^"]*"[^>]*>(.+?)<\/a>/gs
  let match: RegExpExecArray | null

  while ((match = linkPattern.exec(html)) !== null) {
    const mtdsgNo = match[1].replace(/&amp;/g, '&')
    const rawTitle = match[2]

    // Only take the first occurrence (not duplicates)
    const externalId = `un_treaty_${mtdsgNo.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
    if (records.some(r => r.externalId === externalId)) continue

    const { cleanTitle, location, date, dateStr } = parseTreatyDate(rawTitle)
    if (!cleanTitle || cleanTitle.length < 5) continue

    // Short title: everything before the comma-location-date suffix, max 200 chars
    const shortTitle = cleanTitle.slice(0, 200)

    const treatyDate = date ?? new Date('1945-01-01T00:00:00Z')
    const treatyDateStrFinal = dateStr || '1945-01-01'

    records.push({
      mtdsgNo,
      title: cleanTitle,
      shortTitle,
      location,
      treatyDate,
      treatyDateStr: treatyDateStrFinal,
      chapterId,
      chapterName,
      externalId,
      sourceExternalId: `${externalId}_src`,
      sourceUrl: `${BASE_URL}/Pages/ViewDetails.aspx?src=TREATY&mtdsg_no=${mtdsgNo}&chapter=${chapterId}&clang=_en`,
    })
  }

  return records
}

// ── Fetch all treaties from all chapters ───────────────────────────────────────

async function fetchAllTreaties(limit: number, verbose: boolean): Promise<TreatyRecord[]> {
  const allRecords: TreatyRecord[] = []
  const seen = new Set<string>()

  for (const chapter of CHAPTERS) {
    const url = `${BASE_URL}/Pages/Treaties.aspx?id=${chapter.id}&subid=A&clang=_en`
    if (verbose) console.log(`  Fetching chapter ${chapter.id}: ${chapter.name}`)

    let html: string
    try {
      html = curlGet(url)
    } catch (err) {
      console.warn(`  Failed to fetch chapter ${chapter.id}: ${err}`)
      await sleep(REQUEST_DELAY_MS)
      continue
    }

    const rows = parseChapterPage(html, chapter.id, chapter.name)
    let newThisChapter = 0

    for (const row of rows) {
      if (seen.has(row.externalId)) continue
      seen.add(row.externalId)
      allRecords.push(row)
      newThisChapter++
    }

    if (!verbose) process.stdout.write(`  Chapter ${chapter.id}: ${newThisChapter} treaties (total: ${allRecords.length})\r`)
    else console.log(`  Chapter ${chapter.id}: ${newThisChapter} new treaties`)

    if (limit > 0 && allRecords.length >= limit) break
    await sleep(REQUEST_DELAY_MS)
  }
  console.log()
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
  }

  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Write one record ───────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: TreatyRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: `UNTC — ${rec.shortTitle.slice(0, 120)}`,
        url: rec.sourceUrl,
        publishedAt: rec.treatyDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const locationPart = rec.location ? ` Opened for signature at ${rec.location}.` : ''
    const claimText = `The UN multilateral treaty "${rec.shortTitle}" was deposited with the Secretary-General (MTDSG No. ${rec.mtdsgNo}, Chapter: ${rec.chapterName}).${locationPart} Date: ${rec.treatyDateStr}.`

    const claim = await tx.claim.create({
      data: {
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.treatyDate,
        claimEmergedPrecision: rec.treatyDateStr.length === 10 ? 'DAY' : 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          mtdsgNo: rec.mtdsgNo,
          chapterId: rec.chapterId,
          chapterName: rec.chapterName,
          location: rec.location,
          treatyDate: rec.treatyDateStr,
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

  console.log(`\n── ${PIPELINE}: UN Multilateral Treaties ──────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('un-treaties', 'UN Multilateral Treaties', 'government', 'international-law')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching treaties from UN Treaty Collection (chapters I–XXVII)...')
  const candidates = await fetchAllTreaties(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  if (candidates.length === 0) {
    console.error('\nERROR: No candidates — check HTML structure of treaties.un.org.')
    process.exit(1)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const byChapter: Record<string, number> = {}
    for (const r of candidates) {
      byChapter[`Chapter ${r.chapterId}`] = (byChapter[`Chapter ${r.chapterId}`] ?? 0) + 1
    }

    const sample = candidates.slice(0, 15).map(r => ({
      mtdsgNo: r.mtdsgNo,
      title: r.title.slice(0, 120),
      location: r.location,
      treatyDate: r.treatyDateStr,
      chapterName: r.chapterName,
      externalId: r.externalId,
      sourceUrl: r.sourceUrl,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: candidates.length,
      distribution: { byChapter },
      sample,
    }

    fs.writeFileSync('pipeline-94-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-94-dry-run-sample.json')

    console.log('\nDistribution by chapter (top 10):')
    Object.entries(byChapter).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .forEach(([c, n]) => console.log(`  ${c}: ${n}`))

    console.log('\nSample (first 5):')
    candidates.slice(0, 5).forEach((r, i) =>
      console.log(`  ${i + 1}. [${r.mtdsgNo}] ${r.title.slice(0, 80)}${r.title.length > 80 ? '…' : ''} (${r.treatyDateStr})`)
    )

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  if (process.env.ALLOW_EDITS !== 'true') {
    console.error('\nERROR: ALLOW_EDITS=true required for writes.')
    process.exit(1)
  }

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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.title.slice(0, 70)}`)
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
