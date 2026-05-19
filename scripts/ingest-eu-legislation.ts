// Pipeline 16 — EU Legislation (eu_legislation_v1)
// Dataset: EUR-Lex CELLAR SPARQL endpoint (publications.europa.eu/webapi/rdf/sparql)
//          Free, no API key required.
// Scope: Regulations and Directives jointly adopted by the European Parliament
//        and the Council (ordinary legislative procedure), from 1979 to present.
//        Excludes implementing/delegated acts (Commission only) and Council-only acts.
// Topics: Organized by European Parliament electoral term.
// Run: npx tsx scripts/ingest-eu-legislation.ts --dry-run
//      npx tsx scripts/ingest-eu-legislation.ts --sample 20
//      npx tsx scripts/ingest-eu-legislation.ts --full [--terms 9,10] [--limit N]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'eu_legislation_v1'
const SPARQL_ENDPOINT = 'https://publications.europa.eu/webapi/rdf/sparql'
const EUR_LEX_BASE = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX'

// ── Parliamentary terms ────────────────────────────────────────────────────────

interface EPTerm {
  term: number
  ordinal: string
  startYear: number
  endYear: number       // inclusive end year (last year with legislation in term)
  startDate: string     // ISO date
  endDate: string       // ISO date (exclusive for FILTER)
  topicSlug: string
  topicName: string
}

// Terms 1–7 (1979–2014) omitted: EUR-Lex joint-acts API does not surface pre-2014 data reliably.
// Add back if a backfill source is found.
const EP_TERMS: EPTerm[] = [
  { term: 8,  ordinal: '8th',  startYear: 2014, endYear: 2019, startDate: '2014-07-01', endDate: '2019-07-02', topicSlug: 'ep-term-8-legislation',  topicName: 'EP 8th Term (2014–2019) — Legislation' },
  { term: 9,  ordinal: '9th',  startYear: 2019, endYear: 2024, startDate: '2019-07-02', endDate: '2024-07-16', topicSlug: 'ep-term-9-legislation',  topicName: 'EP 9th Term (2019–2024) — Legislation' },
  { term: 10, ordinal: '10th', startYear: 2024, endYear: 2099, startDate: '2024-07-16', endDate: '2099-12-31', topicSlug: 'ep-term-10-legislation', topicName: 'EP 10th Term (2024–2029) — Legislation' },
]

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  celex: string
  title: string
  date: string          // ISO date string
  term: number
  sourceUrl: string
  externalId: string
  claimText: string
}

// ── SPARQL helpers ─────────────────────────────────────────────────────────────

async function sparqlQuery(query: string): Promise<Record<string, { value: string }>[]> {
  const resp = await fetch(SPARQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Accept': 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `query=${encodeURIComponent(query)}`,
  })
  if (!resp.ok) throw new Error(`SPARQL error ${resp.status}: ${await resp.text()}`)
  const data = await resp.json() as { results: { bindings: Record<string, { value: string }>[] } }
  return data.results.bindings
}

// Fetch all EP+Council Regulations and Directives for a date range.
// Uses year-chunked pagination to avoid SPARQL timeouts.
async function fetchYearChunk(year: number, termEndDate: string, verbose: boolean): Promise<CandidateRecord[]> {
  const yearStart = `${year}-01-01`
  // Cap end at term boundary or end of year, whichever is earlier
  const yearEnd = `${year + 1}-01-01`
  const end = yearEnd < termEndDate ? yearEnd : termEndDate

  const query = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?date ?title WHERE {
  ?work cdm:resource_legal_id_celex ?celex ;
        cdm:work_date_document ?date .
  FILTER(REGEX(STR(?celex), "^3[0-9]{4}[RL][0-9]+$"))
  FILTER(?date >= "${yearStart}"^^xsd:date && ?date < "${end}"^^xsd:date)
  ?expr cdm:expression_belongs_to_work ?work ;
        cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/ENG> .
  ?expr cdm:expression_title ?title .
  FILTER(REGEX(STR(?title), "^(Regulation|Directive) \\\\(E[UEC]+\\\\) [0-9]{4}/[0-9]+ of the European Parliament and of the Council"))
}`

  const rows = await sparqlQuery(query)
  if (verbose) console.log(`    Year ${year}: ${rows.length} acts`)
  return rows.map(r => ({
    celex: r.celex.value,
    title: r.title.value,
    date: r.date.value,
    term: 0,   // filled by caller
    sourceUrl: `${EUR_LEX_BASE}:${r.celex.value}`,
    externalId: `eu_legislation_${r.celex.value.toLowerCase()}`,
    claimText: r.title.value,
  }))
}

async function fetchTerm(epTerm: EPTerm, verbose: boolean): Promise<CandidateRecord[]> {
  const records: CandidateRecord[] = []
  for (let year = epTerm.startYear; year <= Math.min(epTerm.endYear, new Date().getFullYear()); year++) {
    const chunk = await fetchYearChunk(year, epTerm.endDate, verbose)
    records.push(...chunk.map(r => ({ ...r, term: epTerm.term })))
    // Brief pause to be polite to the endpoint
    await new Promise(r => setTimeout(r, 300))
  }
  return records
}

// ── DB helpers ─────────────────────────────────────────────────────────────────

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

async function ensureAllTopics(termNums: number[]): Promise<Map<number, { rootId: string; termId: string }>> {
  const rootId = await ensureTopic('eu-legislation', 'EU Legislation', 'government')
  const map = new Map<number, { rootId: string; termId: string }>()
  for (const t of EP_TERMS.filter(t => termNums.includes(t.term))) {
    const termId = await ensureTopic(t.topicSlug, t.topicName, 'government', 'eu-legislation')
    map.set(t.term, { rootId, termId })
  }
  return map
}

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: CandidateRecord, rootId: string, termId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const epTerm = EP_TERMS.find(t => t.term === rec.term)
    if (!epTerm) throw new Error(`EP term ${rec.term} not found`)

    const adoptedDate = new Date(rec.date + 'T00:00:00Z')
    if (isNaN(adoptedDate.getTime())) throw new Error(`Invalid date: ${rec.date}`)

    const source = await tx.source.upsert({
      where: { externalId: `eu_legislation_source_${rec.celex.toLowerCase()}` },
      update: {},
      create: {
        externalId: `eu_legislation_source_${rec.celex.toLowerCase()}`,
        name: rec.celex,
        url: rec.sourceUrl,
        publishedAt: adoptedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.claimText,
        currentStatus: 'HARD_FACT',
        claimType: 'INSTITUTIONAL',
        claimEmergedAt: adoptedDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        externalId: rec.externalId,
        autoApproved: true,
        verificationStatus: 'VERIFIED',
        metadata: {
          celex: rec.celex,
          epTerm: rec.term,
          epTermLabel: epTerm.topicName,
          sourceType: rec.celex.includes('L') && rec.celex.match(/^3[0-9]{4}L/) ? 'directive' : 'regulation',
        },
      },
    })

    // Topic junctions
    await tx.claimTopic.createMany({
      data: [
        { claimId: claim.id, topicId: rootId },
        { claimId: claim.id, topicId: termId },
      ],
      skipDuplicates: true,
    })

    // Source edge
    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'CITES',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
      },
    })

    return 'ingested'
  } catch (err) {
    console.error(`  Error writing ${rec.externalId}: ${err}`)
    return 'failed'
  }
}

// ── CLI ────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const isSample = args.includes('--sample')
  const isFull = args.includes('--full')
  const mode = isDryRun ? 'dry-run' : isSample ? 'sample' : 'full'

  const sampleLimit = isSample ? parseInt(args[args.indexOf('--sample') + 1] ?? '10', 10) : null
  const hardLimit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : null
  const verbose = args.includes('--verbose')

  const termsArg = args.includes('--terms')
    ? args[args.indexOf('--terms') + 1].split(',').map(Number)
    : EP_TERMS.map(t => t.term)

  const selectedTerms = EP_TERMS.filter(t => termsArg.includes(t.term))

  console.log(`\n── Pipeline 16: EU Legislation (EP+Council joint acts) ───────────────────`)
  console.log(`Mode: ${mode} | Terms: ${selectedTerms.map(t => t.ordinal).join(', ')}`)

  let topicMap = new Map<number, { rootId: string; termId: string }>()
  if (!isDryRun) {
    console.log('\nStep 1: Ensuring topics...')
    topicMap = await ensureAllTopics(termsArg)
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching EU legislation from CELLAR SPARQL...')
  const allCandidates: CandidateRecord[] = []

  for (const epTerm of selectedTerms) {
    console.log(`  Fetching ${epTerm.topicName}...`)
    const records = await fetchTerm(epTerm, verbose)
    console.log(`    Total: ${records.length} acts`)
    allCandidates.push(...records)
    if (hardLimit && allCandidates.length >= hardLimit) break
  }

  const candidates = hardLimit ? allCandidates.slice(0, hardLimit) : allCandidates

  // Deduplicate by celex
  const seen = new Set<string>()
  const deduped = candidates.filter(r => { if (seen.has(r.celex)) return false; seen.add(r.celex); return true })

  console.log(`\nTotal candidates: ${deduped.length} (raw: ${candidates.length})`)
  const byTerm = EP_TERMS.map(t => ({ term: t.ordinal, count: deduped.filter(r => r.term === t.term).length })).filter(x => x.count > 0)
  byTerm.forEach(x => console.log(`  ${x.term} term: ${x.count}`))

  if (isDryRun || isSample) {
    const sample = isSample ? deduped.slice(0, sampleLimit!) : deduped.slice(0, 5)
    const sampleFile = 'pipeline-16-dry-run-sample.json'
    fs.writeFileSync(sampleFile, JSON.stringify(sample, null, 2))
    console.log(`\nStep 3: Written sample to ${sampleFile}`)
    console.log('\nSample titles:')
    sample.slice(0, 5).forEach((r, i) => console.log(`  ${i + 1}. ${r.celex} — ${r.title.slice(0, 100)}...`))
    return
  }

  // Full ingest
  console.log('\nStep 3: Writing to DB...')
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const BATCH = 50

  for (let i = 0; i < deduped.length; i += BATCH) {
    const batch = deduped.slice(i, i + BATCH)
    await prisma.$transaction(async (tx) => {
      for (const row of batch) {
        const topics = topicMap.get(row.term)
        if (!topics) { counts.errors++; continue }
        const result = await writeRow(tx, row, topics.rootId, topics.termId)
        counts[result === 'ingested' ? 'ingested' : result === 'skipped' ? 'skipped' : 'errors']++
      }
    })
    if ((i / BATCH) % 10 === 0) {
      process.stdout.write(`  ${i + batch.length}/${deduped.length} processed...\r`)
    }
  }

  console.log(`\nDone. Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
