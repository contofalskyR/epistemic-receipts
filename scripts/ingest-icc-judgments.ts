// Pipeline 75 — ICC Judgments & Indictments (icc_judgments_v1)
// Source: Wikipedia "List of people indicted in the International Criminal Court"
//         (en.wikipedia.org — MediaWiki parse API for wikitext)
// Note: icc-cpi.int is blocked by Cloudflare (403 for all automated requests).
//       The Wikipedia article cites primary ICC documents and is the most comprehensive
//       structured dataset of ICC indictments available without a paid/authenticated API.
//       Each record links to the ICC case page via the icc-cpi.int URL embedded in the wikitext.
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-icc-judgments.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-icc-judgments.ts --sample 20
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-icc-judgments.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'
import * as http from 'http'

const prisma = new PrismaClient()

const INGESTED_BY = 'icc_judgments_v1'
const PIPELINE = 'Pipeline 75'
const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const WIKI_PAGE = 'List_of_people_indicted_in_the_International_Criminal_Court'
const ICC_BASE = 'https://www.icc-cpi.int'

// The table uses situation numbers 1–17 in the S column
const SITUATION_BY_NUMBER: Record<number, { name: string; startYear: number }> = {
  1:  { name: 'Democratic Republic of the Congo', startYear: 2004 },
  2:  { name: 'Uganda', startYear: 2004 },
  3:  { name: 'Darfur, Sudan', startYear: 2005 },
  4:  { name: 'Central African Republic I', startYear: 2007 },
  5:  { name: 'Kenya', startYear: 2010 },
  6:  { name: 'Libya', startYear: 2011 },
  7:  { name: "Côte d'Ivoire", startYear: 2011 },
  8:  { name: 'Mali', startYear: 2013 },
  9:  { name: 'Central African Republic II', startYear: 2014 },
  10: { name: 'Georgia', startYear: 2016 },
  11: { name: 'Burundi', startYear: 2017 },
  12: { name: 'Bangladesh/Myanmar', startYear: 2019 },
  13: { name: 'Afghanistan', startYear: 2020 },
  14: { name: 'Palestine', startYear: 2021 },
  15: { name: 'Philippines', startYear: 2023 },
  16: { name: 'Venezuela I', startYear: 2021 },
  17: { name: 'Ukraine', startYear: 2022 },
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface IccIndictee {
  name: string
  situation: string
  chargeTypes: string[]   // genocide, crimes against humanity, war crimes, etc.
  indictYear: number
  status: string          // arrested, fugitive, acquitted, convicted, deceased, etc.
  externalId: string
  sourceExternalId: string
  sourceUrl: string
  claimText: string
  dateObj: Date
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

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http
    lib.get(url, {
      headers: {
        'User-Agent': 'EpistemicReceipts/1.0 (robert.contofalsky@rutgers.edu)',
        'Accept': 'application/json',
      },
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))) }
        catch (e) { reject(e) }
      })
      res.on('error', reject)
    }).on('error', reject)
  })
}

// ── Fetch Wikipedia wikitext ───────────────────────────────────────────────────

async function fetchWikitext(): Promise<string> {
  const params = new URLSearchParams({
    action: 'parse',
    page: WIKI_PAGE,
    prop: 'wikitext',
    format: 'json',
  })
  const url = `${WIKI_API}?${params}`
  const data = await fetchJson(url) as Record<string, unknown>
  const wikitext = (data as Record<string, Record<string, Record<string, string>>>)
    ?.parse?.wikitext?.['*']
  if (!wikitext || typeof wikitext !== 'string') {
    throw new Error('Could not extract wikitext from Wikipedia API response')
  }
  return wikitext
}

// ── Parse wikitext for indictees ───────────────────────────────────────────────

function stripWikiMarkup(text: string): string {
  let s = text
  // Expand known templates before stripping
  s = s.replace(/\{\{Sortname\|([^|{}]+)\|([^|{}]+)[^}]*\}\}/gi, '$1 $2')  // {{Sortname|First|Last}} → First Last
  s = s.replace(/\{\{Sort\|[^|{}]*\|([^|{}]*)\}\}/gi, '$1')                // {{Sort|key|display}} → display
  s = s.replace(/\{\{Dts[^}]*\|(20\d{2}|19\d{2})[^}]*\}\}/gi, '$1')       // {{Dts|...|YYYY|...}} → YYYY
  // Remove remaining templates iteratively (handles nesting by repeated passes)
  let prev = ''
  while (prev !== s) { prev = s; s = s.replace(/\{\{[^{}]*\}\}/g, '') }
  // Strip any residual braces and wiki syntax
  s = s.replace(/[{}]+/g, '')
  s = s.replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')  // [[link|text]] → text
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')        // remove references
  s = s.replace(/<[^>]+>/g, '')                           // remove HTML tags
  s = s.replace(/'{2,3}/g, '')                            // remove bold/italic
  s = s.replace(/\s+/g, ' ')
  return s.trim()
}

// Extract the display value from a wiki cell line: "| align=... | VALUE" → "VALUE"
// Splits on " | " (space-pipe-space); attributes use = so they appear before the first " | ".
// Templates like {{Sortname|A|B}} use "|" without spaces, so they survive the split.
function cellValue(line: string): string {
  const content = line.replace(/^\|\s*/, '')  // strip leading pipe + spaces
  const parts = content.split(' | ')
  return (parts.pop() ?? content).trim()
}

// Extract the first integer from raw cell content (handles {{Sort|N|display}} and plain numbers)
function cellInt(line: string): number {
  const raw = cellValue(line)
  const m = raw.match(/\b(\d+)\b/)
  return m ? parseInt(m[1], 10) : 0
}

function parseIndictees(wikitext: string): IccIndictee[] {
  const indictees: IccIndictee[] = []
  const seen = new Set<string>()

  // The article is a single wikitable. Columns (0-indexed):
  //   0: Name, 1: S (situation number 1–17), 2: Indicted (date),
  //   3: G, 4: H, 5: W, 6: A, 7: C, 8: Detained, 9: Current status, 10: Ind.
  // Rows are separated by \n|-. Split on that to get individual rows, then
  // filter to lines starting with | (not !/-/}) to get data cells.

  const rows = wikitext.split('\n|-')

  for (const rawRow of rows) {
    // Data cell lines start with | but NOT |- or |} or |+
    const cells = rawRow.split('\n').filter(l => /^\|(?![-}+|!])/.test(l))
    if (cells.length < 3) continue

    // Cell 0: Name — {{Sortname|First|Last}} or [[Name]]
    const rawName = cellValue(cells[0])
    const name = stripWikiMarkup(rawName)
    if (!name || name.length < 2) continue
    if (/^(style|class|Name|!)/i.test(name)) continue

    // Cell 1: Situation number
    const sitNum = cellInt(cells[1])
    if (sitNum < 1 || sitNum > 20) continue
    const sitInfo = SITUATION_BY_NUMBER[sitNum]
    const situation = sitInfo?.name ?? `Situation ${sitNum}`
    const indictYear = sitInfo?.startYear ?? 2002

    // Cell 2: Indictment date — {{Dts|format=dmy|YYYY|Mon|DD}}
    const rawDate = cellValue(cells[2])
    const yearMatch = rawDate.match(/\b(19|20)\d{2}\b/)
    const parsedYear = yearMatch ? parseInt(yearMatch[0], 10) : indictYear

    // Cells 3–7: G H W A C charge counts
    const chargeNames = ['genocide', 'crimes against humanity', 'war crimes', 'aggression', 'contempt']
    const chargeTypes: string[] = []
    for (let ci = 3; ci <= 7 && ci < cells.length; ci++) {
      if (cellInt(cells[ci]) > 0) chargeTypes.push(chargeNames[ci - 3])
    }

    // Status: search cells 8+ for status keywords
    let status = 'Unknown'
    for (let ci = 8; ci < cells.length; ci++) {
      const cell = stripWikiMarkup(cellValue(cells[ci]))
      if (/arrest|fugitive|acquit|convict|deceas|died|releas|withdrawn|discharg/i.test(cell)) {
        status = cell.replace(/\s+/g, ' ').slice(0, 80)
        break
      }
    }

    const nameSlug = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 50)
    const sitSlug = situation.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)
    const externalId = `icc_indictee_${sitSlug}_${nameSlug}`
    if (seen.has(externalId)) continue
    seen.add(externalId)

    const dateObj = new Date(`${parsedYear}-01-01T00:00:00Z`)
    const sourceUrl = `${ICC_BASE}/cases`
    const chargeDesc = chargeTypes.length > 0 ? ` on charges of ${chargeTypes.join(', ')}` : ''
    const claimText = `The International Criminal Court indicted ${name} in the ${situation} situation${chargeDesc}.`

    indictees.push({
      name, situation, chargeTypes,
      indictYear: parsedYear, status, externalId,
      sourceExternalId: `${externalId}_src`, sourceUrl, claimText,
      dateObj,
    })
  }

  return indictees
}

async function fetchAllCandidates(limit: number): Promise<IccIndictee[]> {
  console.log('  Fetching wikitext from Wikipedia...')
  const wikitext = await fetchWikitext()
  console.log(`  Wikitext length: ${wikitext.length} chars`)

  const indictees = parseIndictees(wikitext)
  console.log(`  Parsed ${indictees.length} indictees from wikitext`)

  if (limit > 0) return indictees.slice(0, limit)
  return indictees
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

async function writeRow(tx: TxClient, rec: IccIndictee, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: `ICC — ${rec.name} (${rec.situation})`,
        url: rec.sourceUrl,
        publishedAt: rec.dateObj,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.dateObj,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          name: rec.name,
          situation: rec.situation,
          chargeTypes: rec.chargeTypes,
          status: rec.status,
          indictYear: rec.indictYear,
          country: 'International',
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

  console.log(`\n── ${PIPELINE}: ICC Judgments & Indictments ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)
  console.log(`Source: Wikipedia (icc-cpi.int blocked by Cloudflare)`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic(
      'icc-international-criminal-court',
      'International Criminal Court',
      'international',
      'gov-region-international',
    )
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching ICC indictees from Wikipedia wikitext...')
  const allCandidates = await fetchAllCandidates(limit)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  if (allCandidates.length === 0) {
    console.error('\nERROR: No indictees parsed — check Wikipedia article structure.')
    process.exit(1)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const bySituation: Record<string, number> = {}
    const byCharge: Record<string, number> = {}
    for (const r of allCandidates) {
      bySituation[r.situation] = (bySituation[r.situation] ?? 0) + 1
      for (const ct of r.chargeTypes) {
        byCharge[ct] = (byCharge[ct] ?? 0) + 1
      }
    }

    const sample = allCandidates.slice(0, 15).map(r => ({
      name: r.name, situation: r.situation, chargeTypes: r.chargeTypes,
      status: r.status, indictYear: r.indictYear, externalId: r.externalId,
      claimText: r.claimText, sourceUrl: r.sourceUrl,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      sourceNote: 'Wikipedia wikitext — icc-cpi.int blocked by Cloudflare',
      distribution: { bySituation, byCharge },
      sample,
    }

    fs.writeFileSync('pipeline-75-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-75-dry-run-sample.json')

    console.log('\nDistribution by situation:')
    Object.entries(bySituation).sort((a, b) => b[1] - a[1])
      .forEach(([s, n]) => console.log(`  ${s}: ${n}`))
    console.log('\nDistribution by charge type:')
    Object.entries(byCharge).sort((a, b) => b[1] - a[1])
      .forEach(([c, n]) => console.log(`  ${c}: ${n}`))
    console.log('\nSample (first 5):')
    allCandidates.slice(0, 5).forEach((r, i) =>
      console.log(`  ${i + 1}. ${r.name} — ${r.situation} (${r.indictYear}) ${r.status}`)
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
