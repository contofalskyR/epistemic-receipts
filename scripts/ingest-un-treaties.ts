// Pipeline 94 — UN Multilateral Treaties (un_treaties_v1)
// Dataset: UN Treaty Collection MTDSG — multilateral treaties deposited with the Secretary-General
// Source: https://treaties.un.org/Pages/ParticipationStatus.aspx (chapter-based HTML listing)
// Chapters I–XXIX enumerated at:
//   https://treaties.un.org/Pages/Treaties.aspx?id=N&subid=A&clang=_en  (N = 1..29)
// API: HTML scraping — no OData/JSON API available. Site is ASP.NET with VIEWSTATE.
// Claim: "[name] opened for signature [date], entered into force [date] — [N] parties"
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-un-treaties.ts --dry-run
//      ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-un-treaties.ts --sample 10
//      ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-un-treaties.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'
import * as fs from 'fs'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

const INGESTED_BY = 'un_treaties_v1'
const PIPELINE = 'Pipeline 94'
const BASE_URL = 'https://treaties.un.org'
const REQUEST_DELAY_MS = 600   // 600ms between requests — polite but not glacial
const DETAIL_DELAY_MS = 500    // slightly faster for detail pages

// UN MTDSG chapters I–XXIX (verified from treaties.un.org/Pages/ParticipationStatus.aspx 2026-06-07)
const CHAPTERS: Array<{ id: number; name: string }> = [
  { id: 1,  name: 'Charter of the United Nations and Statute of the International Court of Justice' },
  { id: 2,  name: 'Pacific Settlement of International Disputes' },
  { id: 3,  name: 'Privileges and Immunities, Diplomatic and Consular Relations, etc' },
  { id: 4,  name: 'Human Rights' },
  { id: 5,  name: 'Refugees and Stateless Persons' },
  { id: 6,  name: 'Narcotic Drugs and Psychotropic Substances' },
  { id: 7,  name: 'Traffic in Persons' },
  { id: 8,  name: 'Obscene Publications' },
  { id: 9,  name: 'Health' },
  { id: 10, name: 'International Trade and Development' },
  { id: 11, name: 'Transport and Communications' },
  { id: 12, name: 'Navigation' },
  { id: 13, name: 'Economic Statistics' },
  { id: 14, name: 'Educational and Cultural Matters' },
  { id: 15, name: 'Declaration of Death of Missing Persons' },
  { id: 16, name: 'Status of Women' },
  { id: 17, name: 'Freedom of Information' },
  { id: 18, name: 'Penal Matters' },
  { id: 19, name: 'Commodities' },
  { id: 20, name: 'Maintenance Obligations' },
  { id: 21, name: 'Law of the Sea' },
  { id: 22, name: 'Commercial Arbitration and Mediation' },
  { id: 23, name: 'Law of Treaties' },
  { id: 24, name: 'Outer Space' },
  { id: 25, name: 'Telecommunications' },
  { id: 26, name: 'Disarmament' },
  { id: 27, name: 'Environment' },
  { id: 28, name: 'Fiscal Matters' },
  { id: 29, name: 'Miscellaneous' },
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
  // Populated after ViewDetails fetch:
  eifDateStr: string | null
  partyCount: number | null
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

function curlGet(url: string, timeoutSec = 30): string {
  return execSync(
    `curl -s -m ${timeoutSec} -L -A "Mozilla/5.0 (compatible; EpistemicReceipts/1.0)" ` +
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

// ── ViewDetails scraping (EIF date + party count) ─────────────────────────────

function extractBetween(html: string, before: string, after: string): string | null {
  const start = html.indexOf(before)
  if (start === -1) return null
  const inner = html.slice(start + before.length)
  const end = inner.indexOf(after)
  if (end === -1) return null
  return inner.slice(0, end)
}

function parseFirstDate(text: string): string | null {
  const m = text.match(/(\d{1,2}\s+\w+\s+\d{4})/)
  return m ? m[1].trim() : null
}

function parseViewDetails(html: string): { eifDateStr: string | null; partyCount: number | null } {
  // EIF date: in div id="...rptEIF_ctl00_tcText"
  let eifDateStr: string | null = null
  const eifRaw = extractBetween(html, 'rptEIF_ctl00_tcText">', '</div>')
  if (eifRaw) {
    const text = stripHtml(eifRaw)
    eifDateStr = parseFirstDate(text)
  }

  // Party count: in div id="...rptStatus_ctl00_tcText" — "Parties : 175"
  let partyCount: number | null = null
  const statusRaw = extractBetween(html, 'rptStatus_ctl00_tcText">', '</div>')
  if (statusRaw) {
    const text = stripHtml(statusRaw)
    const pm = text.match(/Parties\s*:\s*(\d+)/)
    if (pm) partyCount = parseInt(pm[1], 10)
  }

  return { eifDateStr, partyCount }
}

async function fetchViewDetails(rec: TreatyRecord, delayMs: number): Promise<void> {
  await sleep(delayMs)
  try {
    const html = curlGet(rec.sourceUrl)
    const { eifDateStr, partyCount } = parseViewDetails(html)
    rec.eifDateStr = eifDateStr
    rec.partyCount = partyCount
  } catch {
    // leave nulls — we still write the claim, just without EIF/parties
  }
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
      eifDateStr: null,
      partyCount: null,
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

function buildClaimText(rec: TreatyRecord): string {
  const sigPart = rec.treatyDateStr
    ? `opened for signature ${rec.treatyDateStr}`
    : 'opened for signature (date unknown)'
  const eifPart = rec.eifDateStr
    ? `entered into force ${rec.eifDateStr}`
    : 'entry into force pending or unknown'
  const partiesPart = rec.partyCount !== null
    ? `${rec.partyCount} parties`
    : 'parties unknown'
  return `${rec.shortTitle} ${sigPart}, ${eifPart} — ${partiesPart}`
}

async function writeRow(tx: TxClient, rec: TreatyRecord, topicId: string): Promise<IngestResult> {
  const newText = buildClaimText(rec)
  const existing = await tx.claim.findUnique({
    where: { externalId: rec.externalId },
    select: { id: true, text: true },
  })

  if (existing) {
    // Update old-format records (they start with "The UN multilateral treaty")
    if (existing.text.startsWith('The UN multilateral treaty')) {
      await tx.claim.update({
        where: { id: existing.id },
        data: {
          text: newText,
          metadata: {
            dataset: INGESTED_BY,
            mtdsgNo: rec.mtdsgNo,
            chapterId: rec.chapterId,
            chapterName: rec.chapterName,
            location: rec.location,
            treatyDate: rec.treatyDateStr,
            eifDate: rec.eifDateStr,
            partyCount: rec.partyCount,
          } as Prisma.InputJsonValue,
        },
      })
      // Fix edge type from CITES → FOR and add EdgeRevision if missing
      const edge = await tx.edge.findFirst({ where: { claimId: existing.id, ingestedBy: INGESTED_BY } })
      if (edge && edge.type === 'CITES') {
        await tx.edge.update({
          where: { id: edge.id },
          data: { type: 'FOR', evidenceType: 'EVIDENTIARY', humanReviewed: false, autoApproved: true },
        })
        const hasRevision = await tx.edgeRevision.findFirst({ where: { edgeId: edge.id } })
        if (!hasRevision) {
          await tx.edgeRevision.create({
            data: {
              edgeId: edge.id,
              priorScore: null,
              newScore: 90,
              reason: 'UN Treaty Collection — official UN depositary record, treaties.un.org',
              changedAt: rec.treatyDate,
            },
          })
        }
      }
      return 'ingested'
    }
    return 'skipped'
  }

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
        humanReviewed: false,
        autoApproved: true,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: buildClaimText(rec),
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
          eifDate: rec.eifDateStr,
          partyCount: rec.partyCount,
        } as Prisma.InputJsonValue,
      },
    })

    const edge = await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'FOR',
        evidenceType: 'EVIDENTIARY',
        ingestedBy: INGESTED_BY,
        humanReviewed: false,
        autoApproved: true,
      },
    })

    await tx.edgeRevision.create({
      data: {
        edgeId: edge.id,
        priorScore: null,
        newScore: 90,
        reason: 'UN Treaty Collection — official UN depositary record, treaties.un.org',
        changedAt: rec.treatyDate,
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

  console.log('\nStep 2: Fetching treaties from UN Treaty Collection (chapters I–XXIX)...')
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

  // Fetch ViewDetails for EIF date + party count
  console.log(`\nStep 3: Fetching ViewDetails for ${rows.length} treaties (EIF date + party count)...`)
  for (let i = 0; i < rows.length; i++) {
    await fetchViewDetails(rows[i], i === 0 ? 0 : DETAIL_DELAY_MS)
    if ((i + 1) % 25 === 0 || i === rows.length - 1) {
      process.stdout.write(`  ${i + 1}/${rows.length} detail pages fetched\r`)
    }
  }
  console.log()

  const withEif = rows.filter(r => r.eifDateStr !== null).length
  const withParties = rows.filter(r => r.partyCount !== null).length
  console.log(`  EIF dates found: ${withEif}/${rows.length} | Party counts found: ${withParties}/${rows.length}`)

  console.log(`\nStep 4: Writing ${rows.length} rows to DB (batches of 50, txn timeout 30s)...`)
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
