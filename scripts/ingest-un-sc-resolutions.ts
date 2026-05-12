// UN Security Council Resolutions ingester — Pipeline 7
// Dataset: CR-UNSC v2025-12-22, DOI 10.5281/zenodo.15154519
// Creates: Claims (INSTITUTIONAL HARD_FACT), Sources, Edges, ClaimTopic edges
// No GraphML ingestion — deferred to Phase 2 (edges are untyped)
// Run: npx tsx scripts/ingest-un-sc-resolutions.ts --dry-run
//      npx tsx scripts/ingest-un-sc-resolutions.ts --sample 10
//      npx tsx scripts/ingest-un-sc-resolutions.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { parse as csvParse } from 'csv-parse/sync'

const prisma = new PrismaClient()

const INGESTED_BY = 'un_sc_resolutions_v1'
const BATCH_SIZE = 100
const DEFAULT_CSV = 'data/cr-unsc/csv_full/CR-UNSC_2025-12-22_ALL_CSV_FULL.csv'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CSVRow {
  res_no: string
  symbol: string
  year: string
  date: string
  vote_date: string
  topic: string
  title: string
  vote_yes: string
  vote_no: string
  vote_abstention: string
  vote_nonvote: string
  vote_total: string
  vote_detail: string
  vote_summary: string
  chapter6: string
  chapter7: string
  chapter8: string
  human_rights: string
  peace_threat: string
  peace_breach: string
  aggression: string
  self_defence: string
  iso_alpha3: string
  iso_name: string
  m49_region: string
  subjects: string
  meeting_record: string
  draft: string
  url_record: string
  doi_concept: string
  doi_version: string
  version: string
  [key: string]: string
}

interface ParsedRow {
  res_no: number
  symbol: string
  year: number
  date: Date
  dateIso: string
  vote_date: string
  topic: string
  vote_yes: number
  vote_no: number
  vote_abstain: number
  vote_nonvoting: number
  vote_total: number
  vote_detail_raw: string
  chapter6: boolean
  chapter7: boolean
  chapter8: boolean
  human_rights: boolean
  peace_threat: boolean
  peace_breach: boolean
  aggression: boolean
  self_defence: boolean
  iso_alpha3: string[]
  iso_name: string[]
  m49_region: string[]
  subjects: string[]
  meeting_record: string | null
  draft: string | null
  url_record: string
  doi_concept: string
  doi_version: string
  dataset_version: string
  claimText: string
}

interface DeadLetter {
  csvRow: number
  res_no: string | null
  reason: string
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : args.includes('--sample') ? 'sample'
    : null

  if (!mode) {
    console.error('Usage: --dry-run | --sample N | --full  [--csv <path>] [--limit N] [--verbose]')
    process.exit(1)
  }

  const csvIdx    = args.indexOf('--csv')
  const limitIdx  = args.indexOf('--limit')
  const sampleIdx = args.indexOf('--sample')

  return {
    mode,
    csvPath: csvIdx !== -1 ? args[csvIdx + 1] : DEFAULT_CSV,
    limit: limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? '0', 10) : 0,
    sampleN: sampleIdx !== -1 ? parseInt(args[sampleIdx + 1] ?? '10', 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function na(v: string): string | null {
  if (!v || v.trim() === '' || v.trim() === 'NA') return null
  return v.trim()
}

function naArr(v: string): string[] {
  const clean = na(v)
  if (!clean) return []
  return clean.split('|').map(s => s.trim()).filter(Boolean)
}

function parseBool(v: string): boolean {
  return v.trim().toUpperCase() === 'TRUE'
}

function parseIntField(v: string): number | null {
  const n = parseInt(v ?? '', 10)
  return isNaN(n) ? null : n
}

function parseDate(v: string): Date | null {
  const clean = na(v)
  if (!clean) return null
  const d = new Date(clean)
  return isNaN(d.getTime()) ? null : d
}

function toDateIso(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

function parseCSV(csvPath: string): { parsed: ParsedRow[]; dead: DeadLetter[] } {
  const fullPath = path.resolve(process.cwd(), csvPath)
  const raw = fs.readFileSync(fullPath)
  const rows: CSVRow[] = csvParse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: false,
    max_record_size: 10 * 1024 * 1024,
  })

  const parsed: ParsedRow[] = []
  const dead: DeadLetter[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const csvRowNum = i + 2 // 1-indexed, account for header

    // Required fields
    const res_no = parseIntField(row.res_no)
    if (!res_no || res_no <= 0) {
      dead.push({ csvRow: csvRowNum, res_no: row.res_no ?? null, reason: 'unparseable res_no' })
      continue
    }
    const symbol = na(row.symbol)
    if (!symbol) {
      dead.push({ csvRow: csvRowNum, res_no: row.res_no, reason: 'empty symbol' })
      continue
    }
    const date = parseDate(row.date)
    if (!date) {
      dead.push({ csvRow: csvRowNum, res_no: row.res_no, reason: `unparseable date: ${row.date}` })
      continue
    }
    const url_record = na(row.url_record)
    if (!url_record || !url_record.startsWith('http')) {
      dead.push({ csvRow: csvRowNum, res_no: row.res_no, reason: `invalid url_record: ${row.url_record}` })
      continue
    }

    // Vote fields
    const vote_yes  = parseIntField(row.vote_yes)
    const vote_no   = parseIntField(row.vote_no)
    const vote_abstain  = parseIntField(row.vote_abstention)
    const vote_nonvoting = parseIntField(row.vote_nonvote)
    const vote_total = parseIntField(row.vote_total)
    if (vote_yes === null || vote_no === null || vote_abstain === null || vote_total === null) {
      dead.push({ csvRow: csvRowNum, res_no: row.res_no, reason: 'unparseable vote tally' })
      continue
    }

    const year = parseIntField(row.year)
    if (!year) {
      dead.push({ csvRow: csvRowNum, res_no: row.res_no, reason: `unparseable year: ${row.year}` })
      continue
    }

    // Topic/title for claim text
    const topicText = na(row.topic) ?? na(row.title) ?? '[no subject in dataset]'
    const topicTrunc = topicText.length > 200 ? topicText.slice(0, 200) : topicText
    const dateIso = toDateIso(date)
    const claimText = `UN Security Council adopted Resolution ${res_no} on ${dateIso} concerning ${topicTrunc}. Vote: ${vote_yes}-${vote_no}-${vote_abstain} (total ${vote_total} members).`

    // vote_date: render as ISO string if valid and different from date
    const voteDateRaw = na(row.vote_date)
    const vote_date = voteDateRaw ?? dateIso

    parsed.push({
      res_no,
      symbol,
      year,
      date,
      dateIso,
      vote_date,
      topic: topicTrunc,
      vote_yes,
      vote_no,
      vote_abstain,
      vote_nonvoting: vote_nonvoting ?? 0,
      vote_total,
      vote_detail_raw: row.vote_detail ?? '',
      chapter6: parseBool(row.chapter6),
      chapter7: parseBool(row.chapter7),
      chapter8: parseBool(row.chapter8),
      human_rights: parseBool(row.human_rights),
      peace_threat: parseBool(row.peace_threat),
      peace_breach: parseBool(row.peace_breach),
      aggression: parseBool(row.aggression),
      self_defence: parseBool(row.self_defence),
      iso_alpha3: naArr(row.iso_alpha3),
      iso_name: naArr(row.iso_name),
      m49_region: naArr(row.m49_region),
      subjects: naArr(row.subjects),
      meeting_record: na(row.meeting_record),
      draft: na(row.draft),
      url_record,
      doi_concept: row.doi_concept?.trim() ?? '',
      doi_version: row.doi_version?.trim() ?? '',
      dataset_version: row.version?.trim() ?? '2025-12-22',
      claimText,
    })
  }

  return { parsed, dead }
}

// ── Metadata builder ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMetadata(r: ParsedRow): any {
  const meta: Record<string, unknown> = {
    res_no: r.res_no,
    symbol: r.symbol,
    year: r.year,
    date: r.dateIso,
    vote: {
      yes: r.vote_yes,
      no: r.vote_no,
      abstain: r.vote_abstain,
      nonvoting: r.vote_nonvoting,
      total: r.vote_total,
      vote_date: r.vote_date,
      detail_raw: r.vote_detail_raw,
    },
    thematic: {
      chapter6: r.chapter6,
      chapter7: r.chapter7,
      chapter8: r.chapter8,
      human_rights: r.human_rights,
      peace_threat: r.peace_threat,
      peace_breach: r.peace_breach,
      aggression: r.aggression,
      self_defence: r.self_defence,
    },
    geography: {
      iso_alpha3: r.iso_alpha3,
      iso_name: r.iso_name,
      m49_region: r.m49_region,
    },
    subjects: r.subjects,
    dataset: {
      doi_concept: r.doi_concept,
      doi_version: r.doi_version,
      version: r.dataset_version,
    },
  }
  if (r.meeting_record) meta['meeting_record'] = r.meeting_record
  if (r.draft) meta['draft'] = r.draft
  return meta
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string, name: string, domain: string, parentSlug?: string
): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug} (${created.id})`)
  topicCache.set(slug, created.id)
  return created.id
}

async function ensureP7Topics(): Promise<string> {
  await ensureTopic('international-law', 'International Law', 'law')
  await ensureTopic('security-council', 'UN Security Council', 'law', 'international-law')
  await ensureTopic('peacekeeping', 'Peacekeeping', 'law', 'security-council')
  await ensureTopic('sanctions', 'Sanctions', 'law', 'security-council')
  return topicCache.get('security-council')!
}

// ── Single row write (within a transaction) ───────────────────────────────────

async function writeRow(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  row: ParsedRow,
  securityCouncilTopicId: string,
): Promise<'ingested' | 'skipped'> {
  const existing = await tx.claim.findUnique({ where: { externalId: row.symbol } })
  if (existing) return 'skipped'

  const claim = await tx.claim.create({
    data: {
      text: row.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'PROVISIONAL',
      autoApproved: true,
      humanReviewed: true,
      ingestedBy: INGESTED_BY,
      externalId: row.symbol,
      claimEmergedAt: row.date,
      claimEmergedPrecision: 'DAY',
      metadata: buildMetadata(row),
    },
  })

  // Source — NOTE: Source model has no metadata field; provenance tracked via Claim.metadata
  const source = await tx.source.create({
    data: {
      name: `UN Digital Library — ${row.symbol}`,
      url: row.url_record,
      publishedAt: row.date,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      externalId: row.symbol,
      autoApproved: true,
    },
  })

  const edge = await tx.edge.create({
    data: {
      claimId: claim.id,
      sourceId: source.id,
      type: 'FOR',
      evidenceType: 'PROCEDURAL',
      ingestedBy: INGESTED_BY,
      autoApproved: true,
    },
  })

  // EdgeRevision (required by schema — initial score)
  await tx.edgeRevision.create({
    data: { edgeId: edge.id, newScore: 1, reason: 'initial ingestion' },
  })

  await tx.claimTopic.create({
    data: { claimId: claim.id, topicId: securityCouncilTopicId },
  })

  return 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, csvPath, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── Pipeline 7: UN SC Resolutions ──────────────────────────────────`)
  console.log(`Mode: ${mode} | CSV: ${csvPath}`)

  // Parse CSV
  console.log('\nParsing CSV...')
  const { parsed, dead } = parseCSV(csvPath)
  const rows = limit > 0 ? parsed.slice(0, limit) : parsed

  // Parse validation report
  const yearCounts: Record<number, number> = {}
  const totalCounts: Record<number, number> = {}
  for (const r of parsed) {
    yearCounts[r.year] = (yearCounts[r.year] ?? 0) + 1
    totalCounts[r.vote_total] = (totalCounts[r.vote_total] ?? 0) + 1
  }
  const years = Object.keys(yearCounts).map(Number).sort()

  console.log(`\nCSV Parse Validation:`)
  console.log(`  Total rows parsed: ${parsed.length}`)
  console.log(`  Dead-lettered: ${dead.length}`)
  console.log(`  Year range: ${years[0]} – ${years[years.length - 1]}`)
  console.log(`  Vote totals: ${JSON.stringify(totalCounts)}`)
  if (limit > 0) console.log(`  Limit applied: processing ${rows.length} rows`)

  if (dead.length > 0) {
    console.log(`\nDead-letter rows:`)
    dead.forEach(d => console.log(`  Row ${d.csvRow} (res_no=${d.res_no}): ${d.reason}`))
    fs.writeFileSync('pipeline-7-dead-letter.json', JSON.stringify(dead, null, 2))
    console.log(`  Written: pipeline-7-dead-letter.json`)
    if (dead.length > 10) {
      console.error(`\nABORTED: ${dead.length} dead-letter rows exceeds threshold of 10. Human review required.`)
      process.exit(1)
    }
  } else {
    fs.writeFileSync('pipeline-7-dead-letter.json', '[]')
  }

  // ── Dry-run ──────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    const sample = rows.slice(0, 5).map(r => ({
      claimText: r.claimText,
      externalId: r.symbol,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'PROVISIONAL',
      metadata: buildMetadata(r),
      source: {
        name: `UN Digital Library — ${r.symbol}`,
        url: r.url_record,
        methodologyType: 'primary',
      },
    }))
    fs.writeFileSync('pipeline-7-dry-run-sample.json', JSON.stringify(sample, null, 2))

    const summary = [
      `Pipeline 7 Dry-Run Summary — ${new Date().toISOString()}`,
      `CSV: ${csvPath}`,
      `Total rows to ingest: ${rows.length}`,
      `Dead-lettered rows: ${dead.length}`,
      `Year range: ${years[0]} – ${years[years.length - 1]}`,
      `Vote totals distribution: ${JSON.stringify(totalCounts)}`,
      ``,
      `SPEC CONFLICT NOTED:`,
      `  Spec's Source.metadata field does not exist in schema.prisma.`,
      `  Source model has no metadata column. Dataset provenance is tracked`,
      `  in Claim.metadata.dataset instead. No data is lost; shape matches spec intent.`,
      `  If Source.metadata is required, a separate migration must be added first.`,
      ``,
      `DOI NOTE:`,
      `  Spec template hardcoded both doi_concept and doi_version as 10.5281/zenodo.15154519.`,
      `  Actual CSV has: doi_concept=10.5281/zenodo.7319780 (concept, version-agnostic)`,
      `                  doi_version=10.5281/zenodo.15154519 (version-specific)`,
      `  Using actual CSV values — they are correct and distinct.`,
      ``,
      `Estimated DB rows if full run:`,
      `  Claims: ${rows.length}`,
      `  Sources: ${rows.length}`,
      `  Edges: ${rows.length}`,
      `  EdgeRevisions: ${rows.length}`,
      `  ClaimTopic edges: ${rows.length}`,
      `  Total: ~${rows.length * 5}`,
    ].join('\n')

    fs.writeFileSync('pipeline-7-dry-run-summary.txt', summary)
    console.log(`\nDry-run complete.`)
    console.log(`  Written: pipeline-7-dry-run-sample.json (first 5 records)`)
    console.log(`  Written: pipeline-7-dry-run-summary.txt`)
    console.log(`\nAwaiting explicit go-ahead before sample run.`)
    return
  }

  // ── Topic setup (required for sample and full) ────────────────────────────
  console.log('\nEnsuring P7 topics...')
  const securityCouncilTopicId = await ensureP7Topics()
  console.log(`  security-council topic ID: ${securityCouncilTopicId}`)

  // ── Sample run ────────────────────────────────────────────────────────────
  if (mode === 'sample') {
    const sampleRows = rows.slice(0, sampleN)
    console.log(`\nSample run: writing ${sampleRows.length} rows inside a transaction (will rollback)...`)
    let sampleIngested = 0
    let sampleSkipped = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of sampleRows) {
          const result = await writeRow(tx, row, securityCouncilTopicId)
          if (result === 'ingested') sampleIngested++
          else sampleSkipped++
          if (verbose) console.log(`  [${result}] ${row.symbol}`)
        }
        // Force rollback
        throw new Error('INTENTIONAL_ROLLBACK_SAMPLE_RUN')
      })
    } catch (e) {
      if (e instanceof Error && e.message === 'INTENTIONAL_ROLLBACK_SAMPLE_RUN') {
        console.log(`\nTransaction rolled back successfully.`)
        console.log(`  Would have ingested: ${sampleIngested}, skipped: ${sampleSkipped}`)
      } else {
        throw e
      }
    }

    // Verify rollback
    const afterCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
    console.log(`  Post-rollback claim count for ${INGESTED_BY}: ${afterCount} (expected 0)`)
    if (afterCount > 0) {
      console.error(`  WARNING: Rollback may have failed — ${afterCount} rows remain in DB`)
    } else {
      console.log(`  Rollback verified.`)
    }
    console.log(`\nAwaiting explicit go-ahead before full run.`)
    return
  }

  // ── Full run ──────────────────────────────────────────────────────────────
  console.log(`\nFull ingestion: ${rows.length} rows in batches of ${BATCH_SIZE}...`)
  const startTime = Date.now()
  let totalIngested = 0
  let totalSkipped = 0
  let totalErrors = 0
  const errorLog: Array<{ symbol: string; error: string }> = []

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    let batchIngested = 0
    let batchSkipped = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, securityCouncilTopicId)
          if (result === 'ingested') batchIngested++
          else batchSkipped++
        }
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`  Batch ${i}–${i + batch.length - 1} FAILED: ${msg}`)
      // Try rows individually to isolate failures
      for (const row of batch) {
        try {
          await prisma.$transaction(async (tx) => {
            const result = await writeRow(tx, row, securityCouncilTopicId)
            if (result === 'ingested') batchIngested++
            else batchSkipped++
          })
        } catch (rowErr) {
          const rowMsg = rowErr instanceof Error ? rowErr.message : String(rowErr)
          errorLog.push({ symbol: row.symbol, error: rowMsg })
          totalErrors++
          console.error(`    Row failed: ${row.symbol} — ${rowMsg}`)
        }
      }
    }

    totalIngested += batchIngested
    totalSkipped += batchSkipped

    if (verbose || i % 500 === 0) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} — ingested ${totalIngested}, skipped ${totalSkipped}`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${totalIngested} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`)

  // Post-ingestion verification
  console.log('\nPost-ingestion verification...')
  const claimCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const sourceCount = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const edgeCount = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  const ctEdgeCount = await prisma.claimTopic.count({
    where: { topicId: securityCouncilTopicId },
  })
  const provisionalCount = await prisma.claim.count({
    where: { ingestedBy: INGESTED_BY, verificationStatus: 'PROVISIONAL' },
  })
  const nullMetaCount = await prisma.claim.count({
    where: { ingestedBy: INGESTED_BY, metadata: null },
  })

  console.log(`  Claims: ${claimCount}`)
  console.log(`  Sources: ${sourceCount}`)
  console.log(`  Edges: ${edgeCount}`)
  console.log(`  ClaimTopic (security-council): ${ctEdgeCount}`)
  console.log(`  verificationStatus=PROVISIONAL: ${provisionalCount}`)
  console.log(`  Claims with null metadata: ${nullMetaCount}`)

  // Spot-check 5 random claims
  const spotCheck = await prisma.claim.findMany({
    where: { ingestedBy: INGESTED_BY },
    take: 5,
    skip: Math.floor(Math.random() * Math.max(1, claimCount - 5)),
    select: { externalId: true, verificationStatus: true, claimType: true, currentStatus: true, metadata: true, text: true },
  })
  console.log('\nSpot-check (5 random claims):')
  for (const c of spotCheck) {
    const meta = c.metadata as Record<string, unknown> | null
    const vote = meta?.['vote'] as Record<string, unknown> | undefined
    console.log(`  ${c.externalId}: ${c.claimType}/${c.currentStatus}/${c.verificationStatus} | vote=${vote?.['yes']}-${vote?.['no']}-${vote?.['abstain']}`)
  }

  // Write report
  const report = [
    `# Pipeline 7 Ingestion Report`,
    ``,
    `**Date:** ${new Date().toISOString()}`,
    `**Dataset:** CR-UNSC v2025-12-22 (DOI 10.5281/zenodo.15154519)`,
    `**Runtime:** ${elapsed}s`,
    ``,
    `## Row Counts`,
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Claims ingested | ${claimCount} |`,
    `| Sources ingested | ${sourceCount} |`,
    `| Edges ingested | ${edgeCount} |`,
    `| ClaimTopic edges (security-council) | ${ctEdgeCount} |`,
    `| verificationStatus=PROVISIONAL | ${provisionalCount} |`,
    `| Claims with null metadata | ${nullMetaCount} |`,
    `| Dead-lettered rows | ${dead.length} |`,
    `| Row-level errors | ${totalErrors} |`,
    ``,
    `## Spec Conflicts Noted`,
    ``,
    `1. **Source.metadata**: Spec specified a metadata object for Source records, but the`,
    `   Source model in schema.prisma has no metadata column. Dataset provenance is stored`,
    `   in Claim.metadata.dataset instead. No data lost. If Source.metadata is needed,`,
    `   a separate migration is required.`,
    ``,
    `2. **doi_concept vs doi_version**: Spec template set both to 10.5281/zenodo.15154519.`,
    `   Actual CSV has distinct values: doi_concept=10.5281/zenodo.7319780 (concept DOI,`,
    `   version-agnostic) and doi_version=10.5281/zenodo.15154519 (version DOI). Actual`,
    `   CSV values used — they are correct.`,
    ``,
    `## Future Work`,
    ``,
    `- **Phase 2 — Citation graph**: 16,308 GraphML edges deferred (untyped, NLP required)`,
    `- **Follow-up classification script**: tag peacekeeping/sanctions ClaimTopics based on`,
    `  metadata.subjects and metadata.thematic fields. Separate spec needed.`,
    `- **Source.metadata migration**: If provenance derivation needs to be queryable on Source,`,
    `  add metadata: Json? to Source model in a future migration.`,
    ``,
    `## Error Log`,
    errorLog.length > 0 ? JSON.stringify(errorLog, null, 2) : 'None.',
  ].join('\n')

  fs.writeFileSync('pipeline-7-ingestion-report.md', report)
  console.log('\nWritten: pipeline-7-ingestion-report.md')
  if (dead.length > 0) console.log('Written: pipeline-7-dead-letter.json')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
