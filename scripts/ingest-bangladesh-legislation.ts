// Pipeline 50 — Bangladesh Jatiya Sangsad Enacted Acts (bangladesh_legislation_v1)
// Dataset: bdlaws.minlaw.gov.bd — Laws of Bangladesh Chronological Index
// URL:     http://bdlaws.minlaw.gov.bd/laws-of-bangladesh-chronological-index.html
// Scope:   All Acts of Bangladesh, ~1,610 records from 1799 to present
// Topic:   bd-parliament (Jatiya Sangsad (Bangladesh), domain=government)
// Run: npx tsx scripts/ingest-bangladesh-legislation.ts --dry-run
//      npx tsx scripts/ingest-bangladesh-legislation.ts --sample 10
//      npx tsx scripts/ingest-bangladesh-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INGESTED_BY = 'bangladesh_legislation_v1'
const PIPELINE = 'Pipeline 50'
const INDEX_URL = 'http://bdlaws.minlaw.gov.bd/laws-of-bangladesh-chronological-index.html'

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  actId: string
  title: string
  year: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
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

// ── Bengali numeral → ASCII ────────────────────────────────────────────────────

// Bengali digits ০(U+09E6)–৯(U+09EF) map directly to 0–9
function bengaliToAscii(s: string): string {
  return s.replace(/[০-৯]/gu, c => String(c.charCodeAt(0) - 0x09E6))
}

// ── Year extraction ────────────────────────────────────────────────────────────

function extractYear(title: string): string | null {
  const ascii = bengaliToAscii(title)
  // Take the last 4-digit year in range 1700–2099
  const matches = [...ascii.matchAll(/\b(1[7-9]\d{2}|20\d{2})\b/g)]
  return matches.length > 0 ? matches[matches.length - 1][1] : null
}

// ── Fetch index ────────────────────────────────────────────────────────────────

async function fetchIndex(): Promise<CandidateRecord[]> {
  const res = await fetch(INDEX_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching bdlaws index`)

  // bdlaws.minlaw.gov.bd returns UTF-16 BE with a BOM (0xFE 0xFF); skip first 2 bytes
  const buf = await res.arrayBuffer()
  const html = new TextDecoder('utf-16be').decode(new Uint8Array(buf).slice(2))

  // Each act has exactly 3 <a> tags pointing to /act-{id}.html:
  //   [0] full title (English or Bengali)
  //   [1] act number (Roman or Bengali numeral)
  //   [2] year (Latin digits or Bengali numerals, e.g. "1799" or "২০২৬")
  const linkRe = /<a\s[^>]*href="[^"]*\/act-(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/gi
  const actLinks = new Map<string, string[]>() // actId → [title, num, year]

  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const actId = m[1]
    const text = m[2].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ')
    if (!actLinks.has(actId)) actLinks.set(actId, [])
    actLinks.get(actId)!.push(text)
  }

  const results: CandidateRecord[] = []
  let noYear = 0

  for (const [actId, texts] of actLinks) {
    const title = texts[0] ?? ''
    if (!title) continue

    // Third link is the year column; convert Bengali numerals if needed
    const rawYear = texts[2] ? bengaliToAscii(texts[2]).trim() : extractYear(title) ?? ''
    const yearMatch = rawYear.match(/^(1[7-9]\d{2}|20\d{2})$/)
    if (!yearMatch) { noYear++; continue }
    const year = yearMatch[1]

    const enactedDate = new Date(`${year}-01-01T00:00:00Z`)
    const enactedDateStr = `${year}-01-01`
    const sourceUrl = `http://bdlaws.minlaw.gov.bd/act-${actId}.html`

    results.push({
      actId,
      title,
      year,
      enactedDate,
      enactedDateStr,
      sourceUrl,
      externalId: `bd_act_${actId}`,
      sourceExternalId: `bd_act_source_${actId}`,
    })
  }

  if (noYear > 0) console.log(`  Skipped ${noYear} acts (no parseable year)`)
  return results
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
        name: rec.title.slice(0, 255),
        url: rec.sourceUrl,
        publishedAt: rec.enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.title.slice(0, 1000),
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.enactedDate,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          actId: rec.actId,
          year: rec.year,
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

  console.log(`\n── ${PIPELINE}: Bangladesh Jatiya Sangsad Enacted Acts ─────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('bd-parliament', 'Jatiya Sangsad (Bangladesh)', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Bangladesh Acts from bdlaws chronological index (UTF-16 LE)...')
  const allCandidates = await fetchIndex()
  console.log(`  Total acts found: ${allCandidates.length}`)

  const candidates = limit > 0 ? allCandidates.slice(0, limit) : allCandidates
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      title: r.title,
      externalId: r.externalId,
      actId: r.actId,
      year: r.year,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const { writeFileSync } = await import('fs')
    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: candidates.length,
      sample,
    }
    writeFileSync('pipeline-50-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-50-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.year}] ${r.title.slice(0, 110)}${r.title.length > 110 ? '…' : ''}`)
      )
      console.log('Oldest acts:')
      candidates.slice(-3).forEach((r, i) =>
        console.log(`  ${candidates.length - 2 + i}. [${r.year}] ${r.title.slice(0, 80)}`)
      )
    }

    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample'
    ? candidates.slice(0, sampleN)
    : candidates

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
