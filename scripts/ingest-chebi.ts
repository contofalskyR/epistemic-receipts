// ChEBI (Chemical Entities of Biological Interest) ontology ingestion
// Dataset: EBI ChEBI Flat File — compounds.tsv.gz
// Source: https://ftp.ebi.ac.uk/pub/databases/chebi/flat_files/compounds.tsv.gz
// Docs:   https://www.ebi.ac.uk/chebi/
//
// Quality gates (per CLAUDE.md "API-only sourcing" + ChEBI's own curation tier):
//   STATUS = 'C' / status_id = 1 — checked (approved by ChEBI; rejects submitted/obsolete/expired)
//   STAR / stars >= 3            — manually curated by a ChEBI curator (3-star is the highest tier)
//   PARENT_ID / parent_id empty  — canonical entry only (drops secondary/merged accessions)
//
// Schema note (2026-05-21): EBI's compounds.tsv now uses lowercase headers and renamed columns:
//   `status_id` (numeric FK; 1 = checked) replaces the old `STATUS` letter column
//   `stars` replaces the old `STAR` column
// The parser resolves both legacy and new column names for forward/backward compatibility.
//
// Run:
//   npx tsx scripts/ingest-chebi.ts --dry-run [--sample 15]
//   npx tsx scripts/ingest-chebi.ts --sample 10
//   npx tsx scripts/ingest-chebi.ts --full [--limit N] [--verbose]
//
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { gunzipSync } from 'node:zlib'
import * as fs from 'node:fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'chebi_v1'
const PIPELINE = 'ChEBI Compounds'
const FLAT_FILE_URL =
  'https://ftp.ebi.ac.uk/pub/databases/chebi/flat_files/compounds.tsv.gz'
const DEFINITION_MAX_CHARS = 400
const BATCH = 50
const TXN_TIMEOUT_MS = 30_000
const EDGE_SCORE = 95 // matches PubChem chemistry — curator-reviewed primary

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChebiRow {
  chebiId: number         // numeric portion of CHEBI:NNNN
  accession: string       // CHEBI:NNNN
  name: string
  definition: string | null
  star: number
  status: string
  source: string | null
  modifiedOn: string | null
  externalId: string
  sourceExternalId: string
  sourceUrl: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode =
    args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full')  ? 'full'
    : args.includes('--sample') ? 'sample'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--limit N] [--verbose]')
        process.exit(1) as never
      })()
  const li = args.indexOf('--limit')
  const sai = args.indexOf('--sample')
  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '15', 10) || 15) : 15,
    verbose: args.includes('--verbose'),
  }
}

// ── Download + decompress ──────────────────────────────────────────────────────

async function fetchFlatFile(): Promise<string> {
  console.log(`  Fetching ${FLAT_FILE_URL}`)
  const res = await fetch(FLAT_FILE_URL, {
    headers: { 'User-Agent': 'EpistemicReceipts/1.0 (chebi ingester; research)' },
  })
  if (!res.ok) {
    throw new Error(`ChEBI flat file fetch failed: HTTP ${res.status} ${res.statusText}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  console.log(`  Downloaded ${(buf.byteLength / 1024 / 1024).toFixed(2)} MB compressed`)
  const tsv = gunzipSync(buf).toString('utf8')
  console.log(`  Decompressed to ${(tsv.length / 1024 / 1024).toFixed(2)} MB TSV`)
  return tsv
}

// ── Parse ──────────────────────────────────────────────────────────────────────

// ChEBI's compounds.tsv encodes missing values as the literal "null" string.
function cleanCell(v: string | undefined): string | null {
  if (v === undefined) return null
  const t = v.trim()
  if (t === '' || t === 'null') return null
  return t
}

function buildIndexMap(header: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (let i = 0; i < header.length; i++) {
    map[header[i].trim().toUpperCase()] = i
  }
  return map
}

function pickIndex(map: Record<string, number>, ...candidates: string[]): number | null {
  for (const c of candidates) {
    if (map[c] !== undefined) return map[c]
  }
  return null
}

function pickIndexWithKey(
  map: Record<string, number>,
  ...candidates: string[]
): { index: number; key: string } | null {
  for (const c of candidates) {
    if (map[c] !== undefined) return { index: map[c], key: c }
  }
  return null
}

// Maps the resolved STATUS column key to the value that represents "checked/approved".
// Old schema: STATUS column, letter 'C'. New schema: status_id numeric FK, value '1'.
function checkedStatusValue(statusKey: string): string {
  return statusKey === 'STATUS_ID' ? '1' : 'C'
}

function parseRows(tsv: string, verbose: boolean): {
  rows: ChebiRow[]
  parsed: number
  filteredByStatus: number
  filteredByStar: number
  filteredBySecondary: number
  malformed: number
  hadDefinitionColumn: boolean
} {
  const lines = tsv.split('\n')
  if (lines.length === 0) throw new Error('Empty ChEBI flat file')
  const header = lines[0].split('\t')
  const idx = buildIndexMap(header)

  const iAccession = pickIndex(idx, 'CHEBI_ACCESSION', 'ACCESSION')
  const iId        = pickIndex(idx, 'ID', 'CHEBI_ID')
  const iName      = pickIndex(idx, 'NAME', 'CHEBI_NAME')
  const iStar      = pickIndex(idx, 'STARS', 'STAR')
  const statusPick = pickIndexWithKey(idx, 'STATUS_ID', 'STATUS')
  const iParent    = pickIndex(idx, 'PARENT_ID')
  const iDef       = pickIndex(idx, 'DEFINITION')
  const iSource    = pickIndex(idx, 'SOURCE')
  const iModified  = pickIndex(idx, 'MODIFIED_ON')

  if (iName === null || iStar === null || statusPick === null || (iAccession === null && iId === null)) {
    throw new Error(
      `ChEBI flat-file schema unexpected. Header: ${header.slice(0, 12).join(' | ')}\n` +
      `Required columns missing — need NAME, STAR/STARS, STATUS/STATUS_ID and (CHEBI_ACCESSION or ID).`
    )
  }

  const iStatus = statusPick.index
  const expectedCheckedStatus = checkedStatusValue(statusPick.key)

  if (verbose) {
    console.log(`  Header columns: ${header.join(' | ')}`)
    console.log(`  Resolved indexes — id=${iId} accession=${iAccession} name=${iName} ` +
                `star=${iStar} status=${iStatus} (column=${statusPick.key}, ` +
                `checked-value='${expectedCheckedStatus}') parent=${iParent} definition=${iDef}`)
  }

  const rows: ChebiRow[] = []
  let parsed = 0, filteredByStatus = 0, filteredByStar = 0, filteredBySecondary = 0, malformed = 0
  const seen = new Set<number>()

  for (let li = 1; li < lines.length; li++) {
    const line = lines[li]
    if (!line) continue
    const cells = line.split('\t')
    parsed++

    const status = cleanCell(cells[iStatus])
    const starStr = cleanCell(cells[iStar])
    const star = starStr ? parseInt(starStr, 10) : NaN
    if (status !== expectedCheckedStatus) { filteredByStatus++; continue }
    if (!Number.isFinite(star) || star < 3) { filteredByStar++; continue }

    if (iParent !== null) {
      const parent = cleanCell(cells[iParent])
      if (parent !== null) { filteredBySecondary++; continue }
    }

    const name = cleanCell(cells[iName])
    if (!name) { malformed++; continue }

    let accession = iAccession !== null ? cleanCell(cells[iAccession]) : null
    const idCell = iId !== null ? cleanCell(cells[iId]) : null
    let numericId: number | null = null
    if (accession) {
      const m = accession.match(/^CHEBI:(\d+)$/)
      if (!m) { malformed++; continue }
      numericId = parseInt(m[1], 10)
    } else if (idCell) {
      numericId = parseInt(idCell, 10)
      if (!Number.isFinite(numericId)) { malformed++; continue }
      accession = `CHEBI:${numericId}`
    }
    if (numericId === null || !accession) { malformed++; continue }

    if (seen.has(numericId)) continue
    seen.add(numericId)

    const definition = iDef !== null ? cleanCell(cells[iDef]) : null
    const source = iSource !== null ? cleanCell(cells[iSource]) : null
    const modifiedOn = iModified !== null ? cleanCell(cells[iModified]) : null

    rows.push({
      chebiId: numericId,
      accession,
      name,
      definition,
      star,
      status,
      source,
      modifiedOn,
      externalId: `chebi_${numericId}`,
      sourceExternalId: `chebi_source_${numericId}`,
      sourceUrl: `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${accession}`,
    })
  }

  return {
    rows,
    parsed,
    filteredByStatus,
    filteredByStar,
    filteredBySecondary,
    malformed,
    hadDefinitionColumn: iDef !== null,
  }
}

// ── Claim text ─────────────────────────────────────────────────────────────────

function truncateDefinition(def: string): string {
  const collapsed = def.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= DEFINITION_MAX_CHARS) return collapsed
  return collapsed.slice(0, DEFINITION_MAX_CHARS - 1).trimEnd() + '…'
}

function buildClaimText(row: ChebiRow): string {
  if (row.definition) return `${row.name}: ${truncateDefinition(row.definition)}`
  return row.name
}

// ── Topics ─────────────────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string,
  name: string,
  domain: string,
  parentSlug?: string,
): Promise<string> {
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

// ── Write one row ──────────────────────────────────────────────────────────────

async function writeRow(tx: TxClient, row: ChebiRow, topicIds: string[]): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({
    where: { externalId: row.externalId },
    select: { id: true },
  })
  if (existing) return 'skipped'

  try {
    const source = await tx.source.upsert({
      where: { externalId: row.sourceExternalId },
      update: {},
      create: {
        externalId: row.sourceExternalId,
        name: `${row.name} — ChEBI`,
        url: row.sourceUrl,
        publishedAt: null,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: buildClaimText(row),
        claimType: 'EMPIRICAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: row.externalId,
        metadata: {
          dataset: INGESTED_BY,
          chebiId: row.chebiId,
          chebiAccession: row.accession,
          star: row.star,
          status: row.status,
          chebiSource: row.source,
          modifiedOn: row.modifiedOn,
        },
      },
    })

    const edge = await tx.edge.create({
      data: {
        sourceId: source.id,
        claimId: claim.id,
        type: 'FOR',
        evidenceType: 'EVIDENTIARY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
      },
    })

    await tx.edgeRevision.create({
      data: {
        edgeId: edge.id,
        priorScore: null,
        newScore: EDGE_SCORE,
        reason: 'ChEBI curator-reviewed entry (STATUS=C, STAR≥3) — primary chemistry HARD_FACT',
        changedAt: new Date(),
      },
    })

    for (const topicId of topicIds) {
      await tx.claimTopic.upsert({
        where: { claimId_topicId: { claimId: claim.id, topicId } },
        update: {},
        create: { claimId: claim.id, topicId },
      })
    }

    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Error writing ${row.externalId}: ${msg}`)
    return 'failed'
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, sampleN, verbose } = parseArgs()
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE} (${INGESTED_BY}) ─────────────────────────────────────────`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}${limit ? ` limit=${limit}` : ''}`)
  console.log(`Source: EBI ChEBI compounds.tsv.gz (gates: STATUS=C, STAR≥3, canonical entries only)`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('\nALLOW_EDITS=true is required for sample/full modes (refusing to write to DB).')
    process.exit(2)
  }

  console.log('\nStep 1: Downloading + decompressing flat file...')
  const tsv = await fetchFlatFile()

  console.log('\nStep 2: Parsing + filtering...')
  const parseResult = parseRows(tsv, verbose)
  const { rows, parsed, filteredByStatus, filteredByStar, filteredBySecondary, malformed, hadDefinitionColumn } = parseResult

  console.log(`  Rows parsed:               ${parsed}`)
  console.log(`  Filtered (STATUS ≠ 'C'):   ${filteredByStatus}`)
  console.log(`  Filtered (STAR < 3):       ${filteredByStar}`)
  console.log(`  Filtered (secondary IDs):  ${filteredBySecondary}`)
  console.log(`  Malformed (skipped):       ${malformed}`)
  console.log(`  Candidates:                ${rows.length}`)
  if (!hadDefinitionColumn) {
    console.warn(`  Note: no DEFINITION column found in flat file — claim text will use NAME only.`)
  }

  if (rows.length === 0) {
    console.error('\nERROR: 0 candidates after filtering — schema or quality gates may be misaligned.')
    process.exit(1)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    const withDef = rows.filter(r => r.definition).length
    const sample = rows.slice(0, sampleN).map(r => ({
      externalId: r.externalId,
      accession: r.accession,
      name: r.name,
      star: r.star,
      status: r.status,
      sourceUrl: r.sourceUrl,
      claimText: buildClaimText(r),
      hasDefinition: r.definition !== null,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      sourceFile: FLAT_FILE_URL,
      gates: { status: 'C', star: '>= 3', canonicalOnly: true },
      parsing: {
        rowsParsed: parsed,
        filteredByStatus,
        filteredByStar,
        filteredBySecondary,
        malformed,
        hadDefinitionColumn,
      },
      totalCandidates: rows.length,
      coverage: {
        withDefinition: withDef,
        withDefinitionPct: ((100 * withDef) / rows.length).toFixed(1) + '%',
      },
      sample,
    }

    const outPath = 'pipeline-chebi-dry-run-sample.json'
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
    console.log(`\nWritten: ${outPath}`)
    console.log(`Coverage:`)
    console.log(`  With definition: ${withDef} / ${rows.length} (${output.coverage.withDefinitionPct})`)
    console.log(`\nSample (first 5):`)
    rows.slice(0, 5).forEach((r, i) =>
      console.log(`  ${i + 1}. ${r.accession} — ${buildClaimText(r).slice(0, 110)}${buildClaimText(r).length > 110 ? '…' : ''}`),
    )
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  console.log('\nStep 3: Ensuring topics...')
  const chemistryTopicId = await ensureTopic('chemistry', 'Chemistry', 'chemistry')
  const compoundsTopicId = await ensureTopic('chemical-compounds', 'Chemical Compounds', 'chemistry', 'chemistry')
  const topicIds = [chemistryTopicId, compoundsTopicId]

  const pool = mode === 'sample' ? rows.slice(0, sampleN) : rows
  const work = limit > 0 ? pool.slice(0, limit) : pool

  console.log(`\nStep 4: Writing ${work.length} rows to DB (batches of ${BATCH}, txn timeout ${TXN_TIMEOUT_MS / 1000}s)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (let i = 0; i < work.length; i += BATCH) {
    const batch = work.slice(i, i + BATCH)
    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx as TxClient, row, topicIds)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.name.slice(0, 70)}`)
        }
      }, { timeout: TXN_TIMEOUT_MS })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}–${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }
    if (!verbose) process.stdout.write(`  ${Math.min(i + BATCH, work.length)}/${work.length} processed...\r`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  // DB verification — per CLAUDE.md rule 6, don't trust in-script counters alone.
  console.log('\nPost-ingestion DB verification...')
  const dbClaims  = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  const dbEdges   = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
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
