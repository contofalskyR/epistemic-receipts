// Pipeline 74 — UN General Assembly Resolutions (un_ga_resolutions_v1)
// Dataset: UN Digital Library — OAI-PMH harvest filtered to A/RES/* symbols
// Source: https://digitallibrary.un.org/oai2d (OAI-PMH 2.0 with MARC21)
// Scope: All GA resolutions (A/RES/*) in the UN Digital Library OAI-PMH repository
// Note: The JSON search API (/search?of=recjson) is WAF-protected (AWS WAF JS challenge)
//       and inaccessible from non-browser clients. OAI-PMH is the machine-access protocol.
//       Total collection: ~19,225 records; GA resolutions are a subset filtered by MARC 191 $a.
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-un-ga-resolutions.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-un-ga-resolutions.ts --sample 20
//      ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-un-ga-resolutions.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'un_ga_resolutions_v1'
const PIPELINE = 'Pipeline 74'
const OAI_BASE = 'https://digitallibrary.un.org/oai2d'
const REQUEST_DELAY_MS = 800
const BATCH_SIZE = 50

// ── Types ──────────────────────────────────────────────────────────────────────

interface OAIRecord {
  oaiId: string       // e.g. oai:digitallibrary.un.org:2394
  recid: string       // numeric part of oaiId
  symbol: string      // MARC 191 $a, e.g. A/RES/79/1
  title: string       // MARC 245 $a + $b
  dateStr: string     // MARC 269 $a (preferred) or extracted from MARC 260 $c
  datePrecision: 'DAY' | 'YEAR'
  date: Date
}

interface CandidateRecord extends OAIRecord {
  year: number
  externalId: string
  sourceUrl: string
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
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '20', 10) || 20) : 20,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function httpsGet(urlStr: string, timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr)
    const req = https.get(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        port: 443,
        headers: {
          'User-Agent': 'EpistemicReceipts/1.0 (OAI-PMH harvester; https://epistemic.receipts)',
          'Accept': 'text/xml,application/xml,*/*',
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
        if (res.statusCode && res.statusCode >= 400) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode} from ${urlStr}`))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error(`Request timed out: ${urlStr}`)) })
  })
}

// ── OAI-PMH XML parsing ───────────────────────────────────────────────────────

function extractTagSubfield(xml: string, tag: string, code: string): string {
  // Handle both <datafield> and <marc:datafield> (namespace-prefixed)
  const dfRegex = new RegExp(`<(?:marc:)?datafield[^>]+tag="${tag}"[^>]*>([\\s\\S]*?)<\\/(?:marc:)?datafield>`, 'g')
  let dfMatch: RegExpExecArray | null
  while ((dfMatch = dfRegex.exec(xml)) !== null) {
    const sfRegex = new RegExp(`<(?:marc:)?subfield[^>]+code="${code}"[^>]*>([^<]*)<\\/(?:marc:)?subfield>`)
    const sfMatch = sfRegex.exec(dfMatch[1])
    if (sfMatch) return sfMatch[1].trim()
  }
  return ''
}

function extractAllTagSubfields(xml: string, tag: string, code: string): string[] {
  const results: string[] = []
  const dfRegex = new RegExp(`<(?:marc:)?datafield[^>]+tag="${tag}"[^>]*>([\\s\\S]*?)<\\/(?:marc:)?datafield>`, 'g')
  let dfMatch: RegExpExecArray | null
  while ((dfMatch = dfRegex.exec(xml)) !== null) {
    const sfRegex = new RegExp(`<(?:marc:)?subfield[^>]+code="${code}"[^>]*>([^<]*)<\\/(?:marc:)?subfield>`)
    const sfMatch = sfRegex.exec(dfMatch[1])
    if (sfMatch) results.push(sfMatch[1].trim())
  }
  return results
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}

function parseOAIDate(raw: string): { dateStr: string; precision: 'DAY' | 'YEAR'; date: Date } | null {
  const s = raw.trim()
  // ISO: 1979-06-01
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00Z')
    if (!isNaN(d.getTime())) return { dateStr: s, precision: 'DAY', date: d }
  }
  // Year only
  const ym = s.match(/\b(1[89]\d\d|20\d\d)\b/)
  if (ym) {
    const d = new Date(`${ym[1]}-01-01T00:00:00Z`)
    if (!isNaN(d.getTime())) return { dateStr: `${ym[1]}-01-01`, precision: 'YEAR', date: d }
  }
  return null
}

function parseOAIPage(xml: string): { records: OAIRecord[]; resumptionToken: string | null } {
  const records: OAIRecord[] = []

  // Extract each <record>
  const recRegex = /<record>([\s\S]*?)<\/record>/g
  let recMatch: RegExpExecArray | null
  while ((recMatch = recRegex.exec(xml)) !== null) {
    const recXml = recMatch[1]

    // Skip deleted records
    if (/<header[^>]*status="deleted"/.test(recXml)) continue

    // OAI identifier
    const idMatch = recXml.match(/<identifier>([^<]+)<\/identifier>/)
    if (!idMatch) continue
    const oaiId = idMatch[1].trim()
    const recidMatch = oaiId.match(/:(\d+)$/)
    if (!recidMatch) continue
    const recid = recidMatch[1]

    // Only process if metadata block exists
    if (!/<metadata>/.test(recXml)) continue

    // MARC 191 $a — UN document symbol
    const symbols = extractAllTagSubfields(recXml, '191', 'a')
    const symbol = symbols.find(s => s.startsWith('A/RES/'))
    if (!symbol) continue

    // MARC 245 $a and $b — title
    const titleA = extractTagSubfield(recXml, '245', 'a')
    const titleB = extractTagSubfield(recXml, '245', 'b')
    const rawTitle = [titleA, titleB].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    const title = decodeXmlEntities(rawTitle || symbol).slice(0, 500)

    // Date: MARC 269 $a (ISO date), then MARC 260 $c
    const date269 = extractTagSubfield(recXml, '269', 'a')
    const date260 = extractTagSubfield(recXml, '260', 'c')
    const dateParsed = parseOAIDate(date269) || parseOAIDate(date260)
    if (!dateParsed) continue

    records.push({
      oaiId,
      recid,
      symbol: decodeXmlEntities(symbol),
      title,
      dateStr: dateParsed.dateStr,
      datePrecision: dateParsed.precision,
      date: dateParsed.date,
    })
  }

  // Resumption token
  const rtMatch = xml.match(/<resumptionToken[^>]*>([^<]+)<\/resumptionToken>/)
  const resumptionToken = rtMatch ? rtMatch[1].trim() : null

  return { records, resumptionToken }
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(dryRunMode: boolean, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  let pageNum = 1
  let resumptionToken: string | null = null
  const maxPages = dryRunMode ? 3 : Infinity

  while (pageNum <= maxPages) {
    const url = resumptionToken
      ? `${OAI_BASE}?verb=ListRecords&resumptionToken=${encodeURIComponent(resumptionToken)}`
      : `${OAI_BASE}?verb=ListRecords&metadataPrefix=marcxml`

    if (verbose || pageNum === 1) console.log(`  Page ${pageNum}${resumptionToken ? ' (token)' : ' (fresh)'}...`)

    let xml: string
    try {
      xml = await httpsGet(url)
    } catch (err) {
      console.error(`  ERROR page ${pageNum}: ${(err as Error).message}`)
      break
    }

    const { records, resumptionToken: nextToken } = parseOAIPage(xml)
    const gaRecords = records  // already filtered to A/RES/ in parseOAIPage

    for (const r of gaRecords) {
      candidates.push({
        ...r,
        year: r.date.getFullYear(),
        externalId: `unga_${r.symbol.replace(/[^a-zA-Z0-9]/g, '_').replace(/__+/g, '_').toLowerCase()}`,
        sourceUrl: `https://digitallibrary.un.org/record/${r.recid}`,
      })
    }

    if (!verbose) process.stdout.write(`  Page ${pageNum}: ${records.length} total, ${gaRecords.length} GA res — ${candidates.length} cumulative\r`)
    else console.log(`  Page ${pageNum}: ${records.length} records, ${gaRecords.length} GA resolutions — ${candidates.length} cumulative`)

    if (!nextToken || pageNum >= maxPages) {
      resumptionToken = null
      break
    }

    resumptionToken = nextToken
    pageNum++
    await sleep(REQUEST_DELAY_MS)
  }

  console.log()
  return candidates
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

async function writeRow(tx: TxClient, rec: CandidateRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const source = await tx.source.upsert({
      where: { externalId: `src_${rec.externalId}` },
      update: {},
      create: {
        externalId: `src_${rec.externalId}`,
        name: `UN Digital Library — ${rec.symbol}`,
        url: rec.sourceUrl,
        publishedAt: rec.date,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claimText = rec.title !== rec.symbol
      ? `UN General Assembly adopted Resolution ${rec.symbol} on ${rec.dateStr}: ${rec.title.slice(0, 300)}`
      : `UN General Assembly adopted Resolution ${rec.symbol} on ${rec.dateStr}.`

    const claim = await tx.claim.create({
      data: {
        text: claimText.slice(0, 500),
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.date,
        claimEmergedPrecision: rec.datePrecision,
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          symbol: rec.symbol,
          recid: rec.recid,
          year: rec.year,
          oaiId: rec.oaiId,
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
    console.error(`  Error ${rec.externalId}: ${err}`)
    return 'failed'
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, sampleN, verbose } = parseArgs()
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE}: UN General Assembly Resolutions ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}`)
  console.log(`Source: ${OAI_BASE} (OAI-PMH / MARC21)`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('ALLOW_EDITS=true is required for sample/full modes.')
    process.exit(2)
  }

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    await ensureTopic('international-law', 'International Law', 'law')
    topicId = await ensureTopic('un-general-assembly', 'UN General Assembly', 'government', 'international-law')
    console.log(`  Topic ID: ${topicId}`)
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Harvesting GA resolutions via OAI-PMH...')
  const isDryRun = mode === 'dry-run'
  const allCandidates = await fetchAllCandidates(isDryRun, verbose)
  console.log(`Total GA resolutions found: ${allCandidates.length}`)

  if (allCandidates.length === 0) {
    console.error('ERROR: 0 candidates — check OAI-PMH availability.')
    process.exit(1)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    const byDecade: Record<string, number> = {}
    for (const r of allCandidates) {
      const decade = `${Math.floor(r.year / 10) * 10}s`
      byDecade[decade] = (byDecade[decade] ?? 0) + 1
    }

    const sample = allCandidates.slice(0, 15).map(r => ({
      symbol: r.symbol,
      externalId: r.externalId,
      date: r.dateStr,
      datePrecision: r.datePrecision,
      year: r.year,
      title: r.title.slice(0, 120),
      sourceUrl: r.sourceUrl,
      claimText: (r.title !== r.symbol
        ? `UN General Assembly adopted Resolution ${r.symbol} on ${r.dateStr}: ${r.title.slice(0, 100)}`
        : `UN General Assembly adopted Resolution ${r.symbol} on ${r.dateStr}.`).slice(0, 200),
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      source: OAI_BASE,
      note: 'Dry-run fetches first 3 OAI-PMH pages (~300 records) and filters to A/RES/* symbols. Full run paginates all ~19,225 records.',
      pagesFetched: 3,
      candidatesFromFirstThreePages: allCandidates.length,
      distribution: { byDecade },
      sample,
    }

    fs.writeFileSync('pipeline-74-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-74-dry-run-sample.json')

    console.log('\nDistribution by decade (first 3 pages only):')
    Object.entries(byDecade).sort((a, b) => a[0].localeCompare(b[0])).forEach(([d, n]) =>
      console.log(`  ${d}: ${n}`)
    )
    console.log('\nSample (first 5):')
    allCandidates.slice(0, 5).forEach((r, i) =>
      console.log(`  ${i + 1}. [${r.dateStr}] ${r.symbol} — ${r.title.slice(0, 80)}${r.title.length > 80 ? '…' : ''}`)
    )
    console.log('\nDry-run complete. No DB writes performed.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample' ? allCandidates.slice(0, sampleN) : allCandidates
  console.log(`\nStep 3: Writing ${rows.length} rows (batches of ${BATCH_SIZE}, txn timeout 30s)...`)
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
          if (verbose) console.log(`  [${result}] ${row.symbol}`)
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
