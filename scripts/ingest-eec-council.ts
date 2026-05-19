// Pipeline 18 — EEC/EC Council Legislation (eec_council_v1)
// Dataset: EUR-Lex CELLAR SPARQL endpoint (publications.europa.eu/webapi/rdf/sparql)
//          Free, no API key required.
// Scope: Council Regulations and Directives from 1958–1993 (pre-Maastricht).
//        After Maastricht (1994+), EP+Council joint acts are covered by Pipeline 16.
//        Two eras based on treaty milestones:
//          - Treaty of Rome Era  (1958–1986, pre-Single European Act)
//          - Single European Act Era (1987–1993, post-SEA, pre-Maastricht)
// Run: npx tsx scripts/ingest-eec-council.ts --dry-run
//      npx tsx scripts/ingest-eec-council.ts --sample 20
//      npx tsx scripts/ingest-eec-council.ts --full [--eras rome,sea] [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'eec_council_v1'
const SPARQL_ENDPOINT = 'https://publications.europa.eu/webapi/rdf/sparql'
const EUR_LEX_BASE = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX'

// ── Treaty eras ───────────────────────────────────────────────────────────────

interface Era {
  key: string
  startYear: number
  endYear: number
  startDate: string
  endDate: string
  topicSlug: string
  topicName: string
}

const ERAS: Era[] = [
  {
    key: 'rome',
    startYear: 1958, endYear: 1986,
    startDate: '1958-01-01', endDate: '1987-01-01',
    topicSlug: 'eec-council-rome-era',
    topicName: 'Treaty of Rome Era (1958–1986) — Council Legislation',
  },
  {
    key: 'sea',
    startYear: 1987, endYear: 1993,
    startDate: '1987-01-01', endDate: '1994-01-01',
    topicSlug: 'eec-council-sea-era',
    topicName: 'Single European Act Era (1987–1993) — Council Legislation',
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  celex: string
  title: string
  date: string
  eraKey: string
  sourceUrl: string
  externalId: string
  claimText: string
}

// ── SPARQL ────────────────────────────────────────────────────────────────────

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

async function fetchYearChunk(year: number, eraEndDate: string, verbose: boolean): Promise<CandidateRecord[]> {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`
  const end = yearEnd < eraEndDate ? yearEnd : eraEndDate

  const query = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?date ?title WHERE {
  ?work cdm:resource_legal_id_celex ?celex ;
        cdm:work_date_document ?date .
  FILTER(REGEX(STR(?celex), "^3[0-9]{4}[RL][0-9]+$"))
  FILTER(?date >= "${yearStart}"^^xsd:date && ?date < "${end}"^^xsd:date)
  ?expr cdm:expression_belongs_to_work ?work ;
        cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/ENG> .
  ?expr cdm:expression_title ?title .
  FILTER(REGEX(STR(?title), "^(Council Regulation|Council Directive)"))
}`

  const rows = await sparqlQuery(query)
  if (verbose) console.log(`    Year ${year}: ${rows.length} acts`)
  return rows.map(r => ({
    celex: r.celex.value,
    title: r.title.value,
    date: r.date.value,
    eraKey: '',
    sourceUrl: `${EUR_LEX_BASE}:${r.celex.value}`,
    externalId: `eec_council_${r.celex.value.toLowerCase()}`,
    claimText: r.title.value,
  }))
}

async function fetchEra(era: Era, verbose: boolean): Promise<CandidateRecord[]> {
  const records: CandidateRecord[] = []
  for (let year = era.startYear; year <= Math.min(era.endYear, new Date().getFullYear()); year++) {
    const chunk = await fetchYearChunk(year, era.endDate, verbose)
    records.push(...chunk.map(r => ({ ...r, eraKey: era.key })))
    await new Promise(r => setTimeout(r, 300))
  }
  return records
}

// ── DB helpers ────────────────────────────────────────────────────────────────

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

async function ensureAllTopics(eraKeys: string[]): Promise<Map<string, { rootId: string; eraId: string }>> {
  const rootId = await ensureTopic('eec-council-legislation', 'EEC/EC Council Legislation', 'government')
  const map = new Map<string, { rootId: string; eraId: string }>()
  for (const era of ERAS.filter(e => eraKeys.includes(e.key))) {
    const eraId = await ensureTopic(era.topicSlug, era.topicName, 'government', 'eec-council-legislation')
    map.set(era.key, { rootId, eraId })
  }
  return map
}

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: CandidateRecord, rootId: string, eraId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const adoptedDate = new Date(rec.date + 'T00:00:00Z')
    if (isNaN(adoptedDate.getTime())) throw new Error(`Invalid date: ${rec.date}`)

    const source = await tx.source.upsert({
      where: { externalId: `eec_council_source_${rec.celex.toLowerCase()}` },
      update: {},
      create: {
        externalId: `eec_council_source_${rec.celex.toLowerCase()}`,
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
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: adoptedDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        externalId: rec.externalId,
        metadata: {
          celex: rec.celex,
          eraKey: rec.eraKey,
          sourceType: rec.celex.match(/^3[0-9]{4}L/) ? 'directive' : 'regulation',
        },
      },
    })

    await tx.claimTopic.createMany({
      data: [
        { claimId: claim.id, topicId: rootId },
        { claimId: claim.id, topicId: eraId },
      ],
      skipDuplicates: true,
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

    return 'ingested'
  } catch (err) {
    console.error(`  Error writing ${rec.externalId}: ${err}`)
    return 'failed'
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const isSample = args.includes('--sample')
  const isFull = args.includes('--full')
  const isVerbose = args.includes('--verbose')
  const limitIdx = args.indexOf('--limit')
  const limitVal = limitIdx >= 0 ? args[limitIdx + 1] : null
  const limit = (limitVal && !isNaN(parseInt(limitVal))) ? parseInt(limitVal) : Infinity
  const erasIdx = args.indexOf('--eras')
  const selectedEras = erasIdx >= 0 && args[erasIdx + 1]
    ? args[erasIdx + 1].split(',')
    : ERAS.map(e => e.key)
  const sampleN = isSample ? parseInt(args[args.indexOf('--sample') + 1] || '20') : 0

  console.log(`\n── Pipeline 18: EEC/EC Council Legislation ───────────────────────────────────`)
  if (isDryRun) console.log(`Mode: dry-run | Eras: ${selectedEras.join(', ')}`)
  else if (isSample) console.log(`Mode: sample (${sampleN}) | Eras: ${selectedEras.join(', ')}`)
  else console.log(`Mode: full | Eras: ${selectedEras.join(', ')}`)

  const activeEras = ERAS.filter(e => selectedEras.includes(e.key))

  // Fetch
  console.log(`\nStep 1: Fetching from CELLAR SPARQL...`)
  const allRecords: CandidateRecord[] = []
  for (const era of activeEras) {
    console.log(`  Fetching ${era.topicName}...`)
    const records = await fetchEra(era, isVerbose)
    console.log(`  → ${records.length} total acts for ${era.key} era`)
    allRecords.push(...records)
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\nTotal fetched: ${allRecords.length}`)

  if (isDryRun) {
    const sample = allRecords.slice(0, 10)
    const out = {
      runDate: new Date().toISOString(),
      mode: 'dry-run',
      totalFetched: allRecords.length,
      eraBreakdown: Object.fromEntries(
        activeEras.map(e => [e.key, allRecords.filter(r => r.eraKey === e.key).length])
      ),
      sample: sample.map(r => ({
        externalId: r.externalId,
        claimText: r.claimText,
        eraKey: r.eraKey,
        date: r.date,
      })),
    }
    fs.writeFileSync('pipeline-18-dry-run-sample.json', JSON.stringify(out, null, 2))
    console.log(`\nDry-run complete. Sample written to pipeline-18-dry-run-sample.json`)
    await prisma.$disconnect()
    return
  }

  const toIngest = isSample ? allRecords.slice(0, sampleN) : allRecords.slice(0, limit)

  // Ensure topics
  console.log(`\nStep 2: Ensuring topics...`)
  const topicMap = await ensureAllTopics(selectedEras)

  // Ingest
  console.log(`\nStep 3: Ingesting ${toIngest.length} records...`)
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const BATCH = 25

  for (let i = 0; i < toIngest.length; i += BATCH) {
    const batch = toIngest.slice(i, i + BATCH)
    await prisma.$transaction(
      async tx => {
        for (const rec of batch) {
          const topics = topicMap.get(rec.eraKey)
          if (!topics) { counts.errors++; continue }
          try {
            const result = await writeRow(tx, rec, topics.rootId, topics.eraId)
            counts[result === 'ingested' ? 'ingested' : result === 'skipped' ? 'skipped' : 'errors']++
          } catch (e) {
            counts.errors++
            if (isVerbose) console.error(`  Error on ${rec.externalId}:`, e)
          }
        }
      },
      { timeout: 30000 }
    )
    if ((i / BATCH) % 20 === 0) {
      console.log(`  Progress: ${i + batch.length}/${toIngest.length} | ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}`)
    }
  }

  console.log(`\n✓ Done. ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
