// Pipeline 9 — SEC EDGAR Historically Significant Filings ingester
// Dataset: SEC EDGAR XBRL/submissions API (free, no API key)
// Creates: Claims (INSTITUTIONAL HARD_FACT), Sources, Edges, ClaimTopics
// Run: npx tsx scripts/ingest-sec-edgar.ts --dry-run
//      npx tsx scripts/ingest-sec-edgar.ts --sample 10
//      npx tsx scripts/ingest-sec-edgar.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'sec_edgar_v1'
const BATCH_SIZE = 50
const USER_AGENT = 'EpistemicReceipts robert.contofalsky@gmail.com'
const EDGAR_BASE = 'https://data.sec.gov'
const FILING_BASE = 'https://www.sec.gov/Archives/edgar/data'

// ── Curated company list (CIKs verified against EDGAR submissions API) ────────

interface CompanySpec {
  name: string
  cik: string  // zero-padded to 10 digits
  forms: string[]
  dateStart: string
  dateEnd: string
  note: string
}

const COMPANIES: CompanySpec[] = [
  {
    name: 'Enron Corp',
    cik: '0001024401',  // verified: ENRON CORP/OR/ (CIK 0001024401) via EDGAR full-text search
    forms: ['10-K', '10-Q', '8-K'],
    dateStart: '1997-01-01',
    dateEnd: '2002-12-31',
    note: 'Corporate fraud — revenue inflation, SPEs, bankruptcy 2001',
  },
  {
    name: 'WorldCom / MCI Inc',
    cik: '0000723527',  // verified: MCI INC (CIK 0000723527) — WorldCom renamed MCI post-bankruptcy
    forms: ['10-K', '10-Q', '8-K'],
    dateStart: '1999-01-01',
    dateEnd: '2003-12-31',
    note: 'Accounting fraud — $11B in capitalised expenses, bankruptcy 2002',
  },
  {
    name: 'Lehman Brothers Holdings Inc',
    cik: '0000806085',  // verified: LEHMAN BROTHERS HOLDINGS INC (CIK 0000806085) via EDGAR search
    forms: ['10-K', '10-Q', '8-K'],
    dateStart: '2005-01-01',
    dateEnd: '2009-12-31',
    note: 'Repo 105 off-balance-sheet leverage, bankruptcy September 2008',
  },
  {
    name: 'The Boeing Company',
    cik: '0000012927',  // verified: BOEING CO (CIK 0000012927) via EDGAR submissions API
    forms: ['8-K', '10-K'],
    dateStart: '2018-01-01',
    dateEnd: '2021-12-31',
    note: '737 MAX incidents — Lion Air Oct 2018, Ethiopian Mar 2019, global grounding',
  },
  {
    name: 'General Electric Co',
    cik: '0000040545',  // verified: GENERAL ELECTRIC CO (GE) (CIK 0000040545) via EDGAR search
    forms: ['10-K', '8-K'],
    dateStart: '2017-01-01',
    dateEnd: '2022-12-31',
    note: 'GE Power impairment charges, LTC insurance reserve shortfall, SEC investigation',
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface EdgarFiling {
  accessionNumber: string
  filingDate: string
  form: string
  primaryDocument: string
  primaryDocDescription: string
}

interface EdgarSubmissionsResponse {
  name: string
  cik: string
  filings?: {
    recent?: {
      accessionNumber: string[]
      filingDate: string[]
      form: string[]
      primaryDocument: string[]
      primaryDocDescription: string[]
    }
  }
}

interface FilingRecord {
  companyName: string
  cik: string
  accessionNumber: string
  filingDate: string
  form: string
  primaryDocument: string
  filingUrl: string
  externalId: string
  sourceExternalId: string
  claimText: string
  sourceName: string
}

interface DeadLetter {
  company: string
  accession: string | null
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
    console.error('Usage: --dry-run | --sample N | --full  [--verbose]')
    process.exit(1)
  }

  const sampleIdx = args.indexOf('--sample')
  return {
    mode,
    sampleN: sampleIdx !== -1 ? parseInt(args[sampleIdx + 1] ?? '10', 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.json() as Promise<T>
}

function formatAccession(raw: string): string {
  // Normalize "0000101830-01-500498" -> "0000101830-01-500498" (already canonical)
  return raw
}

function accessionToPath(accession: string): string {
  // "0000101830-01-500498" -> "000010183001500498"
  return accession.replace(/-/g, '')
}

function buildFilingUrl(cik: string, accession: string, primaryDoc: string): string {
  const numericCik = parseInt(cik, 10).toString()
  const path = accessionToPath(accession)
  return `${FILING_BASE}/${numericCik}/${path}/${primaryDoc}`
}

function buildIndexUrl(cik: string, accession: string): string {
  const numericCik = parseInt(cik, 10).toString()
  const path = accessionToPath(accession)
  return `${FILING_BASE}/${numericCik}/${path}/`
}

// ── Fetch filings for one company ─────────────────────────────────────────────

async function fetchCompanyFilings(spec: CompanySpec): Promise<{ filings: EdgarFiling[]; resolvedName: string }> {
  const url = `${EDGAR_BASE}/submissions/CIK${spec.cik}.json`
  console.log(`  Fetching: ${url}`)

  const data = await fetchJSON<EdgarSubmissionsResponse>(url)
  const resolvedName = data.name ?? spec.name

  const recent = data.filings?.recent
  if (!recent) {
    console.log(`  No filings.recent for ${spec.name}`)
    return { filings: [], resolvedName }
  }

  const {
    accessionNumber: accessions,
    filingDate: dates,
    form: forms,
    primaryDocument: docs,
    primaryDocDescription: descs,
  } = recent

  const filings: EdgarFiling[] = []
  const start = new Date(spec.dateStart)
  const end = new Date(spec.dateEnd)

  for (let i = 0; i < accessions.length; i++) {
    const form = forms[i]
    const date = dates[i]
    if (!form || !date) continue
    if (!spec.forms.includes(form)) continue

    const d = new Date(date)
    if (d < start || d > end) continue

    filings.push({
      accessionNumber: accessions[i],
      filingDate: date,
      form,
      primaryDocument: docs[i] ?? '',
      primaryDocDescription: descs[i] ?? '',
    })
  }

  console.log(`  ${resolvedName}: ${filings.length} filings in range (${spec.dateStart}–${spec.dateEnd})`)
  return { filings, resolvedName }
}

// ── Build record ──────────────────────────────────────────────────────────────

function buildRecord(
  spec: CompanySpec,
  resolvedName: string,
  filing: EdgarFiling,
): FilingRecord | DeadLetter {
  const { accessionNumber, filingDate, form, primaryDocument } = filing

  if (!accessionNumber || !filingDate || !form) {
    return { company: spec.name, accession: accessionNumber ?? null, reason: 'missing required fields' }
  }

  const filingUrl = primaryDocument
    ? buildFilingUrl(spec.cik, accessionNumber, primaryDocument)
    : buildIndexUrl(spec.cik, accessionNumber)

  const accessionClean = formatAccession(accessionNumber)
  const externalId = `sec_edgar_${accessionClean.replace(/-/g, '_')}`
  const sourceExternalId = `sec_edgar_source_${accessionClean.replace(/-/g, '_')}`

  const claimText = `${resolvedName} filed a ${form} with the SEC on ${filingDate} (accession ${accessionClean}).`
  const sourceName = `SEC EDGAR — ${resolvedName} ${form} (${filingDate})`

  return {
    companyName: resolvedName,
    cik: spec.cik,
    accessionNumber: accessionClean,
    filingDate,
    form,
    primaryDocument,
    filingUrl,
    externalId,
    sourceExternalId,
    claimText,
    sourceName,
  }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string,
  name: string,
  domain: string,
  parentSlug?: string,
  description?: string,
): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    topicCache.set(slug, existing.id)
    return existing.id
  }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (!parent) throw new Error(`Parent topic not found: ${parentSlug}`)
    parentTopicId = parent.id
  }
  const created = await prisma.topic.create({
    data: { slug, name, domain, description: description ?? null, parentTopicId },
  })
  topicCache.set(slug, created.id)
  return created.id
}

async function ensureTopics(): Promise<string> {
  await ensureTopic(
    'corporate-accountability',
    'Corporate Accountability',
    'politics',
    undefined,
    'SEC filings, corporate disclosures, financial fraud, and regulatory compliance.',
  )

  const topicId = await ensureTopic(
    'sec-filings',
    'SEC Filings',
    'politics',
    'corporate-accountability',
    'Historically significant SEC EDGAR filings — 10-Ks, 10-Qs, 8-Ks from major companies.',
  )

  console.log(`  corporate-accountability: ${topicCache.get('corporate-accountability')}`)
  console.log(`  sec-filings: ${topicId}`)
  return topicId
}

// ── Single row write ──────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  record: FilingRecord,
  secFilingsTopicId: string,
): Promise<'ingested' | 'skipped' | 'conflict'> {
  const existing = await tx.claim.findUnique({
    where: { externalId: record.externalId },
    select: { externalId: true, ingestedBy: true },
  })
  if (existing) {
    return existing.ingestedBy === INGESTED_BY ? 'skipped' : 'conflict'
  }

  const filingDate = new Date(record.filingDate)

  const claim = await tx.claim.create({
    data: {
      text: record.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
      externalId: record.externalId,
      claimEmergedAt: filingDate,
      claimEmergedPrecision: 'DAY',
      metadata: {
        company_name: record.companyName,
        cik: record.cik,
        accession_number: record.accessionNumber,
        form_type: record.form,
        filing_date: record.filingDate,
        primary_document: record.primaryDocument,
        dataset: 'sec_edgar',
        source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${record.cik}&type=${encodeURIComponent(record.form)}&dateb=&owner=include&count=40`,
      },
    },
  })

  const source = await tx.source.create({
    data: {
      name: record.sourceName,
      url: record.filingUrl,
      publishedAt: filingDate,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      externalId: record.sourceExternalId,
      autoApproved: true,
    },
  })

  const edge = await tx.edge.create({
    data: {
      claimId: claim.id,
      sourceId: source.id,
      type: 'FOR',
      evidenceType: 'EVIDENTIARY',
      ingestedBy: INGESTED_BY,
      autoApproved: true,
    },
  })

  await tx.edgeRevision.create({
    data: { edgeId: edge.id, newScore: 1, reason: 'initial ingestion' },
  })

  await tx.claimTopic.create({
    data: { claimId: claim.id, topicId: secFilingsTopicId },
  })

  return 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, sampleN, verbose } = parseArgs()

  console.log(`\n── Pipeline 9: SEC EDGAR Historically Significant Filings ───────────`)
  console.log(`Mode: ${mode}`)
  console.log(`Companies: ${COMPANIES.map(c => c.name).join(', ')}`)

  // Step 1: Topics
  console.log('\nStep 1: Ensuring topics...')
  const secFilingsTopicId = await ensureTopics()

  // Step 2: Fetch filings from EDGAR API
  console.log('\nStep 2: Fetching filings from SEC EDGAR...')
  const allRecords: FilingRecord[] = []
  const dead: DeadLetter[] = []
  const externalIdsSeen = new Set<string>()

  for (const spec of COMPANIES) {
    await sleep(200)  // respect 10 req/sec limit
    try {
      const { filings, resolvedName } = await fetchCompanyFilings(spec)

      for (const filing of filings) {
        const result = buildRecord(spec, resolvedName, filing)
        if ('reason' in result) {
          dead.push(result as DeadLetter)
          continue
        }
        const rec = result as FilingRecord
        if (externalIdsSeen.has(rec.externalId)) {
          dead.push({ company: rec.companyName, accession: rec.accessionNumber, reason: 'duplicate externalId in this run' })
          continue
        }
        externalIdsSeen.add(rec.externalId)
        allRecords.push(rec)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`  FAILED fetching ${spec.name}: ${msg}`)
      dead.push({ company: spec.name, accession: null, reason: `API error: ${msg}` })
    }
  }

  console.log(`\nFetch complete: ${allRecords.length} valid filings, ${dead.length} dead-lettered`)

  if (dead.length > 0) {
    console.log('Dead-letter entries:')
    dead.forEach(d => console.log(`  ${d.company} / ${d.accession ?? 'N/A'}: ${d.reason}`))
  }

  // Spot-check: verify 3 records against live EDGAR API
  if (allRecords.length > 0) {
    console.log('\nStep 3: Spot-checking filing URLs against EDGAR...')
    const indices = [0, Math.floor(allRecords.length / 2), allRecords.length - 1]
    for (const i of indices) {
      const r = allRecords[i]
      if (!r) continue
      await sleep(200)
      try {
        const res = await fetch(r.filingUrl, {
          method: 'HEAD',
          headers: { 'User-Agent': USER_AGENT },
        })
        const status = res.status
        const ok = status === 200 || status === 302 || status === 301
        console.log(`  [${ok ? 'OK' : 'FAIL'}] ${r.companyName} ${r.form} ${r.filingDate} → HTTP ${status}`)
        if (!ok) {
          dead.push({ company: r.companyName, accession: r.accessionNumber, reason: `spot-check: HTTP ${status}` })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.log(`  [FAIL] ${r.companyName} ${r.form} ${r.filingDate}: ${msg}`)
      }
    }
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    const byCompany: Record<string, number> = {}
    const byForm: Record<string, number> = {}
    for (const r of allRecords) {
      byCompany[r.companyName] = (byCompany[r.companyName] ?? 0) + 1
      byForm[r.form] = (byForm[r.form] ?? 0) + 1
    }

    console.log('\nDry-run summary:')
    console.log(`  Total filings to ingest: ${allRecords.length}`)
    console.log('  By company:')
    for (const [co, n] of Object.entries(byCompany)) console.log(`    ${co}: ${n}`)
    console.log('  By form type:')
    for (const [f, n] of Object.entries(byForm)) console.log(`    ${f}: ${n}`)

    console.log('\nSample claims (first 5):')
    for (const r of allRecords.slice(0, 5)) {
      console.log(`  [${r.form}] ${r.claimText}`)
      console.log(`           URL: ${r.filingUrl}`)
      console.log(`           externalId: ${r.externalId}`)
    }

    const sample = allRecords.slice(0, 10).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
      filingUrl: r.filingUrl,
      form: r.form,
      filingDate: r.filingDate,
    }))
    fs.writeFileSync('pipeline-9-dry-run-sample.json', JSON.stringify(sample, null, 2))
    fs.writeFileSync('pipeline-9-dead-letter.json', JSON.stringify(dead, null, 2))

    console.log('\n  Written: pipeline-9-dry-run-sample.json')
    console.log('  Written: pipeline-9-dead-letter.json')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample run.')
    return
  }

  // ── Sample run ─────────────────────────────────────────────────────────────
  if (mode === 'sample') {
    const rows = allRecords.slice(0, sampleN)
    console.log(`\nSample run: ${rows.length} rows in rolled-back transaction...`)
    let ingested = 0, skipped = 0, conflicts = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const result = await writeRow(tx, row, secFilingsTopicId)
          if (result === 'ingested') ingested++
          else if (result === 'skipped') skipped++
          else conflicts++
          if (verbose) console.log(`  [${result}] ${row.companyName} ${row.form} ${row.filingDate}`)
        }
        throw new Error('INTENTIONAL_ROLLBACK_SAMPLE_RUN')
      }, { timeout: 30000 })
    } catch (e) {
      if (e instanceof Error && e.message === 'INTENTIONAL_ROLLBACK_SAMPLE_RUN') {
        console.log(`\nRolled back. Would have ingested: ${ingested}, skipped: ${skipped}, conflicts: ${conflicts}`)
      } else {
        throw e
      }
    }

    const afterCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
    console.log(`  Post-rollback DB count for ${INGESTED_BY}: ${afterCount} (expected 0)`)
    console.log('\nAwaiting explicit go-ahead before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log(`\nFull ingestion: ${allRecords.length} rows in batches of ${BATCH_SIZE}...`)
  const startTime = Date.now()
  let totalIngested = 0, totalSkipped = 0, totalConflicts = 0, totalErrors = 0
  const errorLog: Array<{ accession: string; error: string }> = []

  for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
    const batch = allRecords.slice(i, i + BATCH_SIZE)
    let batchIngested = 0, batchSkipped = 0, batchConflicts = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, secFilingsTopicId)
          if (result === 'ingested') batchIngested++
          else if (result === 'skipped') batchSkipped++
          else batchConflicts++
        }
      }, { timeout: 30000 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`  Batch ${i}–${i + batch.length - 1} FAILED: ${msg}`)
      for (const row of batch) {
        try {
          await prisma.$transaction(async (tx) => {
            const result = await writeRow(tx, row, secFilingsTopicId)
            if (result === 'ingested') batchIngested++
            else if (result === 'skipped') batchSkipped++
            else batchConflicts++
          }, { timeout: 30000 })
        } catch (rowErr) {
          const rowMsg = rowErr instanceof Error ? rowErr.message : String(rowErr)
          errorLog.push({ accession: row.accessionNumber, error: rowMsg })
          totalErrors++
        }
      }
    }

    totalIngested += batchIngested
    totalSkipped += batchSkipped
    totalConflicts += batchConflicts

    if (verbose || i % 100 === 0) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, allRecords.length)}/${allRecords.length} — ingested ${totalIngested}`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${totalIngested} | Skipped: ${totalSkipped} | Conflicts: ${totalConflicts} | Errors: ${totalErrors}`)

  console.log('\nPost-ingestion DB verification...')
  const claimCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const sourceCount = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const edgeCount = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims:  ${claimCount}`)
  console.log(`  Sources: ${sourceCount}`)
  console.log(`  Edges:   ${edgeCount}`)

  if (claimCount !== totalIngested) {
    console.error(`  WARNING: DB claim count (${claimCount}) does not match ingested counter (${totalIngested})`)
  }

  if (errorLog.length > 0) {
    fs.writeFileSync('pipeline-9-errors.json', JSON.stringify(errorLog, null, 2))
    console.log('  Written: pipeline-9-errors.json')
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
