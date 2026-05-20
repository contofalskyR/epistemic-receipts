// Pipeline 34 — Switzerland Federal Legislation (switzerland_legislation_v1)
// Dataset: Fedlex SPARQL (fedlex.data.admin.ch/sparqlendpoint). Free, no API key.
// Scope: Bundesgesetze (type/21) and Dringliche Bundesgesetze (type/22) from OC collection.
// Topic: ch-fedlex (Swiss Federal Legislation, domain=government).
// Run: npx tsx scripts/ingest-switzerland-legislation.ts --dry-run
//      npx tsx scripts/ingest-switzerland-legislation.ts --sample 10
//      npx tsx scripts/ingest-switzerland-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'switzerland_legislation_v1'
const PIPELINE = 'Pipeline 34'
const SPARQL_ENDPOINT = 'https://fedlex.data.admin.ch/sparqlendpoint'
const PAGE_SIZE = 200
const PAGE_DELAY_MS = 300

// Resource types: 21 = Bundesgesetz, 22 = Dringliches Bundesgesetz
const TYPE_21 = 'https://fedlex.data.admin.ch/vocabulary/resource-type/21'
const TYPE_22 = 'https://fedlex.data.admin.ch/vocabulary/resource-type/22'
const LANG_DE = 'http://publications.europa.eu/resource/authority/language/DEU'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SparqlBinding {
  [key: string]: { type: string; value: string; 'xml:lang'?: string; datatype?: string }
}

interface SparqlResult {
  results: { bindings: SparqlBinding[] }
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  workUri: string
  typeDoc: string
  title: string
  titleShort: string
  docDate: Date
  docDateStr: string
  externalId: string
  sourceExternalId: string
  sourceName: string
  sourceUrl: string
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

// ── HTTP / SPARQL ──────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function sparqlQuery(query: string, retries = 4): Promise<SparqlResult> {
  let delay = 2000
  const url = new URL(SPARQL_ENDPOINT)
  url.searchParams.set('query', query)
  const target = url.toString()

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(target, {
        headers: { Accept: 'application/sparql-results+json' },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`Fedlex SPARQL ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`)
      return await res.json() as SparqlResult
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Network error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ── Derive externalId from work URI ───────────────────────────────────────────

function workUriToId(uri: string): string {
  // https://fedlex.data.admin.ch/eli/oc/2025/618 -> ch_fedlex_oc_2025_618
  const path = uri.replace('https://fedlex.data.admin.ch/', '').replace(/\//g, '_').replace(/[^a-zA-Z0-9_]/g, '_')
  return `ch_fedlex_${path}`
}

function workUriToSourceUrl(uri: string): string {
  // https://fedlex.data.admin.ch/eli/oc/2025/618 -> https://www.fedlex.admin.ch/eli/oc/2025/618/de
  return uri.replace('https://fedlex.data.admin.ch/', 'https://www.fedlex.admin.ch/') + '/de'
}

// ── Fetch page of Bundesgesetze ────────────────────────────────────────────────

async function fetchPage(offset: number): Promise<SparqlBinding[]> {
  const query = `
PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
SELECT DISTINCT ?work ?typeDoc ?date ?title ?titleShort WHERE {
  ?work a jolux:Work ;
        jolux:typeDocument ?typeDoc .
  FILTER(?typeDoc IN (
    <${TYPE_21}>,
    <${TYPE_22}>
  ))
  FILTER(CONTAINS(STR(?work), '/eli/oc/'))
  OPTIONAL { ?work jolux:dateDocument ?date }
  OPTIONAL {
    ?work jolux:isRealizedBy ?expr .
    ?expr jolux:language <${LANG_DE}> ;
          jolux:title ?title .
  }
  OPTIONAL {
    ?work jolux:isRealizedBy ?expr2 .
    ?expr2 jolux:language <${LANG_DE}> ;
           jolux:titleShort ?titleShort .
  }
}
ORDER BY DESC(?date) ?work
LIMIT ${PAGE_SIZE} OFFSET ${offset}
`.trim()

  const result = await sparqlQuery(query)
  return result.results.bindings
}

// ── Build candidate from SPARQL binding ───────────────────────────────────────

function buildCandidate(b: SparqlBinding, verbose: boolean): CandidateRecord | null {
  const workUri = b.work?.value ?? ''
  if (!workUri) return null

  const title = (b.title?.value ?? '').trim()
  if (!title) {
    if (verbose) console.log(`  Skip ${workUri}: no German title`)
    return null
  }

  const dateStr = b.date?.value?.slice(0, 10) ?? ''
  if (!dateStr) {
    if (verbose) console.log(`  Skip ${workUri}: no dateDocument`)
    return null
  }
  const docDate = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(docDate.getTime())) {
    if (verbose) console.log(`  Skip ${workUri}: invalid date ${dateStr}`)
    return null
  }

  const externalId = workUriToId(workUri)
  const sourceExternalId = `src_${externalId}`
  const titleShort = (b.titleShort?.value ?? '').trim()
  const displayName = titleShort ? `${title} (${titleShort})` : title

  return {
    workUri,
    typeDoc: b.typeDoc?.value ?? '',
    title,
    titleShort,
    docDate,
    docDateStr: dateStr,
    externalId,
    sourceExternalId,
    sourceName: displayName.slice(0, 200),
    sourceUrl: workUriToSourceUrl(workUri),
  }
}

// ── Fetch all Bundesgesetze ────────────────────────────────────────────────────

async function fetchAllBundesgesetze(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let offset = 0
  let pageNum = 0
  let skippedMalformed = 0

  while (true) {
    const bindings = await fetchPage(offset)
    pageNum++

    if (bindings.length === 0) break

    let newOnPage = 0
    for (const b of bindings) {
      const rec = buildCandidate(b, verbose)
      if (!rec) { skippedMalformed++; continue }
      if (seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      candidates.push(rec)
      newOnPage++
      if (hardLimit > 0 && candidates.length >= hardLimit) break
    }

    if (hardLimit > 0 && candidates.length >= hardLimit) break
    if (bindings.length < PAGE_SIZE) break  // last page

    if (verbose) console.log(`  ...page ${pageNum} (offset ${offset}): cumulative ${candidates.length}`)
    offset += PAGE_SIZE
    await sleep(PAGE_DELAY_MS)
  }

  if (skippedMalformed > 0) console.log(`  Skipped ${skippedMalformed} malformed/incomplete records`)
  return candidates
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
        publishedAt: rec.docDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.title,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.docDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          workUri: rec.workUri,
          typeDoc: rec.typeDoc,
          titleShort: rec.titleShort,
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

  console.log(`\n── ${PIPELINE}: Switzerland Federal Legislation ──────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('ch-fedlex', 'Swiss Federal Legislation', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Bundesgesetze from Fedlex SPARQL...')
  const candidates = await fetchAllBundesgesetze(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      title: r.title,
      titleShort: r.titleShort,
      externalId: r.externalId,
      workUri: r.workUri,
      typeDoc: r.typeDoc.split('/').slice(-2).join('/'),
      docDate: r.docDateStr,
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
      sample,
    }

    fs.writeFileSync('pipeline-34-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-34-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.docDateStr}] ${r.title.slice(0, 110)}${r.title.length > 110 ? '…' : ''}`)
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
