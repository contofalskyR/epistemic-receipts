// Pipeline 37 — Spain BOE Enacted Laws (spain_legislation_v1)
// Dataset: BOE (Boletín Oficial del Estado) via ELI (European Legislation Identifier).
//          Free, no API key required. Scrapes the ELI hierarchy pages.
// Scope:   All Leyes (l) and Leyes Orgánicas (lo) published in the BOE from 1978–present.
//          ELI hierarchy: /eli/es/{type}/years.php → /YYYY → /YYYY/MM → /YYYY/MM/DD.
// Topic:   es-boe (BOE (Spain), domain=government).
// Run: npx tsx scripts/ingest-spain-legislation.ts --dry-run
//      npx tsx scripts/ingest-spain-legislation.ts --sample 10
//      npx tsx scripts/ingest-spain-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'spain_legislation_v1'
const PIPELINE = 'Pipeline 37'
const BOE_ELI_BASE = 'https://www.boe.es/eli/es'
const PAGE_DELAY_MS = 300

// Law types to ingest: regular laws and organic laws
const LAW_TYPES: Array<{ type: string; label: string }> = [
  { type: 'l',  label: 'Ley' },
  { type: 'lo', label: 'Ley Orgánica' },
]

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  lawType: string
  claimText: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
  lawNumber: string
}

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

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function fetchHtml(url: string, retries = 4): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
        },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} at ${url} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`BOE ELI ${res.status} at ${url}`)
      return await res.text()
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Fetch error at ${url}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at ${url}`)
}

// ── Parsing ────────────────────────────────────────────────────────────────────

// Extracts href values from lista-eli divs: <div class='lista-eli'><a href = 'PATH'>
const LISTA_RE = /class='lista-eli'><a href = '([^']+)'/g

function parseListaLinks(html: string): string[] {
  const links: string[] = []
  let m: RegExpExecArray | null
  LISTA_RE.lastIndex = 0
  while ((m = LISTA_RE.exec(html)) !== null) {
    links.push(m[1]!)
  }
  return links
}

// Extracts law entries from a day page. Each <li class='bullet'> has:
//   <span class='bloque'>TITLE</span>
//   <span class='bloquep'>...<a href='ELI_URL'>...</a>...</span>
const LI_RE = /<li class='bullet'>([\s\S]*?)<\/li>/g
const BLOQUE_RE = /<span class='bloque'>([\s\S]*?)<\/span>/
const ELI_HREF_RE = /href='(https:\/\/www\.boe\.es\/eli\/es\/[^']+)'/

// ELI URL pattern: https://www.boe.es/eli/es/{type}/{YYYY}/{MM}/{DD}/{N}
const ELI_PATH_RE = /\/eli\/es\/(l|lo)\/(\d{4})\/(\d{2})\/(\d{2})\/(\d+)/

// Law number extraction: "Ley X/YYYY" or "Ley Orgánica X/YYYY"
const LAW_NUM_RE = /Ley(?:\s+Org[aá]nica)?\s+(\d+\/\d{4})/

function parseDayPage(html: string, verbose: boolean): CandidateRecord[] {
  const candidates: CandidateRecord[] = []
  let m: RegExpExecArray | null
  LI_RE.lastIndex = 0

  while ((m = LI_RE.exec(html)) !== null) {
    const li = m[1]!

    const bloqueMatch = BLOQUE_RE.exec(li)
    const hrefMatch = ELI_HREF_RE.exec(li)
    if (!bloqueMatch || !hrefMatch) {
      if (verbose) console.log(`  Skip li: missing bloque or href`)
      continue
    }

    const rawTitle = bloqueMatch[1]!.replace(/\s+/g, ' ').trim()
    const eliUrl = hrefMatch[1]!.trim()

    const pathMatch = ELI_PATH_RE.exec(eliUrl)
    if (!pathMatch) {
      if (verbose) console.log(`  Skip: ELI URL doesn't match pattern: ${eliUrl}`)
      continue
    }

    const [, lawType, yr, mo, dd, num] = pathMatch
    const enactedDateStr = `${yr}-${mo}-${dd}`
    const enactedDate = new Date(`${enactedDateStr}T00:00:00Z`)
    if (isNaN(enactedDate.getTime())) {
      if (verbose) console.log(`  Skip: invalid date ${enactedDateStr} in ${eliUrl}`)
      continue
    }

    if (!rawTitle) {
      if (verbose) console.log(`  Skip: empty title for ${eliUrl}`)
      continue
    }

    const numMatch = LAW_NUM_RE.exec(rawTitle)
    const lawNumber = numMatch ? numMatch[1]! : `${num}/${yr}`

    const typeLabel = lawType === 'lo' ? 'LeyOrg' : 'Ley'
    const externalId = `es_boe_${typeLabel}_${yr}_${mo}_${dd}_${num}`
    const sourceExternalId = `es_boe_${typeLabel}_src_${yr}_${mo}_${dd}_${num}`
    const sourceName = `Spain ${lawType === 'lo' ? 'Ley Orgánica' : 'Ley'} ${lawNumber}`

    candidates.push({
      lawType: lawType!,
      claimText: rawTitle,
      enactedDate,
      enactedDateStr,
      sourceUrl: eliUrl,
      externalId,
      sourceExternalId,
      sourceName,
      lawNumber,
    })
  }

  return candidates
}

// ── Fetch all laws via ELI hierarchy ───────────────────────────────────────────

async function fetchAllLaws(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const all: CandidateRecord[] = []
  const seenIds = new Set<string>()

  for (const { type, label } of LAW_TYPES) {
    console.log(`\n  Fetching ${label} (type=${type})...`)
    const yearsUrl = `${BOE_ELI_BASE}/${type}/years.php`
    let yearsHtml: string
    try {
      yearsHtml = await fetchHtml(yearsUrl)
    } catch (err) {
      console.warn(`  Failed to fetch years page for ${type}: ${err instanceof Error ? err.message : err}`)
      continue
    }

    const yearPaths = parseListaLinks(yearsHtml)
    console.log(`  Found ${yearPaths.length} years`)

    for (const yearPath of yearPaths) {
      const yearUrl = `https://www.boe.es${yearPath}`
      let yearHtml: string
      try {
        yearHtml = await fetchHtml(yearUrl)
      } catch (err) {
        console.warn(`  Failed year ${yearPath}: ${err instanceof Error ? err.message : err}`)
        await sleep(PAGE_DELAY_MS)
        continue
      }

      const monthPaths = parseListaLinks(yearHtml)
      if (verbose) console.log(`  ${yearPath}: ${monthPaths.length} months`)

      for (const monthPath of monthPaths) {
        const monthUrl = `https://www.boe.es${monthPath}`
        let monthHtml: string
        try {
          monthHtml = await fetchHtml(monthUrl)
        } catch (err) {
          console.warn(`  Failed month ${monthPath}: ${err instanceof Error ? err.message : err}`)
          await sleep(PAGE_DELAY_MS)
          continue
        }

        const dayPaths = parseListaLinks(monthHtml)

        for (const dayPath of dayPaths) {
          const dayUrl = `https://www.boe.es${dayPath}`
          let dayHtml: string
          try {
            dayHtml = await fetchHtml(dayUrl)
          } catch (err) {
            console.warn(`  Failed day ${dayPath}: ${err instanceof Error ? err.message : err}`)
            await sleep(PAGE_DELAY_MS)
            continue
          }

          const recs = parseDayPage(dayHtml, verbose)
          for (const rec of recs) {
            if (seenIds.has(rec.externalId)) continue
            seenIds.add(rec.externalId)
            all.push(rec)
            if (hardLimit > 0 && all.length >= hardLimit) break
          }

          if (hardLimit > 0 && all.length >= hardLimit) break
          await sleep(PAGE_DELAY_MS)
        }

        if (hardLimit > 0 && all.length >= hardLimit) break
        await sleep(PAGE_DELAY_MS)
      }

      if (!verbose) {
        process.stdout.write(`  ${label} — ${yearPath}: total ${all.length} laws so far\r`)
      }

      if (hardLimit > 0 && all.length >= hardLimit) break
      await sleep(PAGE_DELAY_MS)
    }

    console.log(`\n  Done with ${label}: ${all.filter(r => r.lawType === type).length} laws`)
    if (hardLimit > 0 && all.length >= hardLimit) break
  }

  return all
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
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
        name: rec.sourceName,
        url: rec.sourceUrl,
        publishedAt: rec.enactedDate,
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
        claimEmergedAt: rec.enactedDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          lawType: rec.lawType,
          lawNumber: rec.lawNumber,
          enactedDate: rec.enactedDateStr,
          eliUrl: rec.sourceUrl,
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

  console.log(`\n── ${PIPELINE}: Spain BOE Legislation (Ley + Ley Orgánica) ───────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('es-boe', 'BOE (Spain)', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching laws via BOE ELI hierarchy...')
  const candidates = await fetchAllLaws(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      lawType: r.lawType,
      lawNumber: r.lawNumber,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      sourceName: r.sourceName,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: candidates.length,
      byType: {
        ley: candidates.filter(c => c.lawType === 'l').length,
        leyOrganica: candidates.filter(c => c.lawType === 'lo').length,
      },
      sample,
    }

    fs.writeFileSync('pipeline-37-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-37-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] ${r.claimText.slice(0, 110)}${r.claimText.length > 110 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
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
