// Pipeline 109 — NIH MeSH (Medical Subject Headings)
// Dataset: NIH National Library of Medicine MeSH Vocabulary
// Source:  SPARQL endpoint https://id.nlm.nih.gov/mesh/sparql
//          ~30,594 current TopicalDescriptors; ~30,412 have preferredConcept scope notes
// Scope:   One claim per current MeSH TopicalDescriptor (D-prefix URIs only)
// Run:     set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-mesh.ts --dry-run
//          set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-mesh.ts --sample 5
//          set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-mesh.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'mesh_v1'
const PIPELINE = 'Pipeline 109'
const SPARQL_ENDPOINT = 'https://id.nlm.nih.gov/mesh/sparql'
const MESHB_BASE = 'https://meshb.nlm.nih.gov/record/ui?ui='
const PAGE_SIZE = 500
const PAGE_DELAY_MS = 400

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface MeshDescriptor {
  descriptorUri: string
  descriptorId: string  // e.g. D000001
  label: string
  scopeNote: string | null
  claimText: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
}

interface SparqlBinding {
  d: { value: string }
  label: { value: string }
  note?: { value: string }
}

interface SparqlResult {
  results: { bindings: SparqlBinding[] }
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

const SPARQL_QUERY = `
PREFIX meshv: <http://id.nlm.nih.gov/mesh/vocab#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?d ?label ?note WHERE {
  ?d a meshv:TopicalDescriptor ;
     rdfs:label ?label .
  OPTIONAL {
    ?d meshv:preferredConcept ?c .
    ?c meshv:scopeNote ?note .
  }
  FILTER(lang(?label) = 'en')
  FILTER(REGEX(STR(?d), '^http://id.nlm.nih.gov/mesh/D'))
}
ORDER BY ?d
LIMIT ${PAGE_SIZE}
OFFSET `

async function fetchPage(offset: number, retries = 4): Promise<SparqlBinding[]> {
  const query = SPARQL_QUERY + String(offset)
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=JSON`

  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'EpistemicReceipts/1.0 (robert.contofalsky@rutgers.edu)',
        },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        const retryAfter = res.headers.get('Retry-After')
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay
        console.warn(`  HTTP ${res.status} at offset ${offset} — retrying in ${waitMs}ms`)
        await sleep(waitMs)
        delay *= 2
        continue
      }
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`SPARQL ${res.status} at offset ${offset}: ${body.slice(0, 200)}`)
      }
      const data = await res.json() as SparqlResult
      return data.results.bindings
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Error at offset ${offset}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at offset ${offset}`)
}

// ── Build descriptor record ────────────────────────────────────────────────────

function buildDescriptor(binding: SparqlBinding): MeshDescriptor | null {
  const uri = binding.d.value
  const label = binding.label.value.trim()
  const scopeNote = binding.note?.value.trim() ?? null

  // Extract D-number from URI: http://id.nlm.nih.gov/mesh/D000001 → D000001
  const match = uri.match(/\/mesh\/(D\d+)$/)
  if (!match) return null
  const descriptorId = match[1]

  const claimText = scopeNote
    ? `${label} is defined by NIH MeSH as: ${scopeNote}`
    : `${label} is a Medical Subject Heading (MeSH) descriptor used by NIH for indexing biomedical literature.`

  const sourceUrl = `${MESHB_BASE}${descriptorId}`
  const externalId = `mesh_${descriptorId}`
  const sourceExternalId = `mesh_src_${descriptorId}`

  return { descriptorUri: uri, descriptorId, label, scopeNote, claimText, sourceUrl, externalId, sourceExternalId }
}

// ── Fetch all descriptors ──────────────────────────────────────────────────────

async function fetchAllDescriptors(hardLimit: number, verbose: boolean): Promise<MeshDescriptor[]> {
  const all: MeshDescriptor[] = []
  const seenIds = new Set<string>()
  let offset = 0
  let pageNum = 1

  while (true) {
    let bindings: SparqlBinding[]
    try {
      bindings = await fetchPage(offset)
    } catch (err) {
      console.error(`  Failed at offset ${offset}: ${err instanceof Error ? err.message : err}`)
      break
    }

    if (bindings.length === 0) break

    let newOnPage = 0
    for (const binding of bindings) {
      const rec = buildDescriptor(binding)
      if (!rec) continue
      if (seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      all.push(rec)
      newOnPage++
      if (hardLimit > 0 && all.length >= hardLimit) break
    }

    if (verbose) {
      console.log(`  Page ${pageNum} (offset ${offset}): ${newOnPage} new (total: ${all.length})`)
    } else {
      process.stdout.write(`  Page ${pageNum}: ${all.length} descriptors fetched...\r`)
    }

    if (hardLimit > 0 && all.length >= hardLimit) break
    if (bindings.length < PAGE_SIZE) break

    offset += PAGE_SIZE
    pageNum++
    await sleep(PAGE_DELAY_MS)
  }

  process.stdout.write('\n')
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

async function writeRow(tx: TxClient, rec: MeshDescriptor, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: `MeSH Descriptor: ${rec.label}`,
        url: rec.sourceUrl,
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
        ingestedBy: INGESTED_BY,
        autoApproved: false,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          descriptorId: rec.descriptorId,
          descriptorUri: rec.descriptorUri,
          hasScopeNote: rec.scopeNote !== null,
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'CITES',
        ingestedBy: INGESTED_BY,
        autoApproved: false,
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

  console.log(`\n── ${PIPELINE}: NIH MeSH Medical Subject Headings ──────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('nih-mesh', 'NIH MeSH', 'medicine')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  const fetchLimit = mode === 'dry-run' ? 20 : (mode === 'sample' ? sampleN + 5 : limit)
  console.log('\nStep 2: Fetching MeSH descriptors from SPARQL endpoint...')
  const candidates = await fetchAllDescriptors(fetchLimit, verbose)
  console.log(`Total candidates: ${candidates.length}`)

  const withNote = candidates.filter(c => c.scopeNote !== null).length
  const withoutNote = candidates.length - withNote
  if (candidates.length > 0) {
    console.log(`  With scope note: ${withNote} | Without: ${withoutNote}`)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      descriptorId: r.descriptorId,
      descriptorUri: r.descriptorUri,
      hasScopeNote: r.scopeNote !== null,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: false,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      sparqlEndpoint: SPARQL_ENDPOINT,
      totalFetched: candidates.length,
      withScopeNote: withNote,
      withoutScopeNote: withoutNote,
      sample,
    }

    fs.writeFileSync('mesh-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: mesh-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample terms:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.descriptorId}] ${r.label}${r.scopeNote ? ` — ${r.scopeNote.slice(0, 80)}…` : ' (no scope note)'}`)
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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.label}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}–${i + batch.length} failed: ${msg}`)
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
