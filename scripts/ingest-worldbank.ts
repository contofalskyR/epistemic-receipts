// Pipeline: worldbank_v1
// Source: World Bank Open Data API
//   https://api.worldbank.org/v2/
// Indicators: GDP, GDP per capita, population, life expectancy, CO2 per capita
// Years: 1990-2022 inclusive, all real countries (excludes World Bank aggregates).
// Run:
//   npx tsx scripts/ingest-worldbank.ts --dry-run
//   ALLOW_EDITS=true npx tsx scripts/ingest-worldbank.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'worldbank_v1'
const SOURCE_URL = 'https://data.worldbank.org/'
const API_BASE = 'https://api.worldbank.org/v2'

interface Indicator {
  code: string
  label: string
  unit: string
}

const INDICATORS: Indicator[] = [
  { code: 'NY.GDP.MKTP.CD', label: 'GDP', unit: 'current US$' },
  { code: 'NY.GDP.PCAP.CD', label: 'GDP per capita', unit: 'current US$' },
  { code: 'SP.POP.TOTL', label: 'Population', unit: 'people' },
  { code: 'SP.DYN.LE00.IN', label: 'Life expectancy at birth', unit: 'years' },
  { code: 'EN.GHG.CO2.PC.CE.AR5', label: 'CO2 emissions per capita', unit: 't CO2eq/person' },
  { code: 'NY.GDP.MKTP.KD.ZG', label: 'GDP growth', unit: 'annual %' },
  { code: 'SL.UEM.TOTL.ZS', label: 'Unemployment', unit: '% of total labor force' },
  { code: 'FP.CPI.TOTL.ZG', label: 'Inflation (consumer prices)', unit: 'annual %' },
  { code: 'GC.DOD.TOTL.GD.ZS', label: 'Central government debt', unit: '% of GDP' },
]

const YEAR_FROM = 1990
const YEAR_TO = 2022

interface Observation {
  countryIso3: string
  countryName: string
  indicatorCode: string
  indicatorLabel: string
  unit: string
  year: number
  value: number
  externalId: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

function parseArgs() {
  const args = process.argv.slice(2)
  const li = args.indexOf('--limit')
  const limit = li !== -1 ? parseInt(args[li + 1] ?? '0', 10) || 0 : 0
  return { dryRun: args.includes('--dry-run'), limit }
}

async function fetchJson<T>(url: string, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'epistemic-receipts/1.0 (research)' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json() as T
    } catch (err) {
      if (i === retries - 1) throw err
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
  throw new Error('unreachable')
}

interface WBCountry {
  id: string
  iso2Code: string
  name: string
  region: { value: string }
}

interface WBObservation {
  indicator: { id: string; value: string }
  country: { id: string; value: string }
  countryiso3code: string
  date: string
  value: number | null
}

async function fetchCountries(): Promise<WBCountry[]> {
  const j = await fetchJson<[unknown, WBCountry[]]>(`${API_BASE}/country?format=json&per_page=400`)
  return j[1].filter(c => c.region.value.trim() !== 'Aggregates')
}

async function fetchObservations(iso3: string, indicator: Indicator): Promise<Observation[]> {
  const url = `${API_BASE}/country/${iso3}/indicator/${indicator.code}?format=json&per_page=200&date=${YEAR_FROM}:${YEAR_TO}`
  const j = await fetchJson<[unknown, WBObservation[] | null]>(url)
  if (!Array.isArray(j[1])) return []
  const out: Observation[] = []
  for (const row of j[1]) {
    if (row.value == null) continue
    const year = parseInt(row.date, 10)
    if (!Number.isFinite(year)) continue
    out.push({
      countryIso3: row.countryiso3code,
      countryName: row.country.value,
      indicatorCode: indicator.code,
      indicatorLabel: indicator.label,
      unit: indicator.unit,
      year,
      value: row.value,
      externalId: `worldbank_${iso3}_${indicator.code}_${year}`,
    })
  }
  return out
}

function formatNumber(n: number, indicator: string): string {
  if (indicator === 'NY.GDP.MKTP.CD' || indicator === 'NY.GDP.PCAP.CD') {
    return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }
  if (indicator === 'SP.POP.TOTL') {
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }
  if (indicator === 'SP.DYN.LE00.IN') return n.toFixed(1)
  if (
    indicator === 'NY.GDP.MKTP.KD.ZG' ||
    indicator === 'SL.UEM.TOTL.ZS' ||
    indicator === 'FP.CPI.TOTL.ZG' ||
    indicator === 'GC.DOD.TOTL.GD.ZS'
  ) {
    return n.toFixed(2) + '%'
  }
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function buildClaimText(o: Observation): string {
  return `${o.countryName} ${o.indicatorLabel.toLowerCase()} in ${o.year} was ${formatNumber(o.value, o.indicatorCode)} ${o.unit}.`
}

const topicCache = new Map<string, string>()
async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  topicCache.set(slug, created.id)
  return created.id
}

async function writeObservation(tx: TxClient, o: Observation, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: o.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const sourceExternalId = `worldbank_source_${o.countryIso3}_${o.indicatorCode}_${o.year}`
  const source = await tx.source.create({
    data: {
      name: `World Bank — ${o.countryName} ${o.indicatorLabel} (${o.year})`,
      url: `https://data.worldbank.org/indicator/${o.indicatorCode}?locations=${o.countryIso3}`,
      publishedAt: null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: sourceExternalId,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: buildClaimText(o),
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: new Date(`${o.year}-12-31T00:00:00Z`),
      claimEmergedPrecision: 'YEAR',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: o.externalId,
      metadata: {
        dataset: INGESTED_BY,
        countryIso3: o.countryIso3,
        countryName: o.countryName,
        indicatorCode: o.indicatorCode,
        indicatorLabel: o.indicatorLabel,
        unit: o.unit,
        year: o.year,
        value: o.value,
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
      humanReviewed: false,
      autoApproved: true,
    },
  })

  await tx.edgeRevision.create({
    data: { edgeId: edge.id, priorScore: null, newScore: 95, reason: 'World Bank Open Data — country indicator as HARD_FACT', changedAt: new Date() },
  })

  await tx.claimTopic.upsert({
    where: { claimId_topicId: { claimId: claim.id, topicId } },
    update: {},
    create: { claimId: claim.id, topicId },
  })

  return 'ingested'
}

async function main() {
  const { dryRun, limit } = parseArgs()
  console.log(`\n── Pipeline: World Bank Open Data (${INGESTED_BY}) ──`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'full'} | Limit: ${limit || 'all'}`)
  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to enable DB writes.')
    process.exit(1)
  }

  console.log(`\nFetching countries…`)
  const countries = await fetchCountries()
  console.log(`  ${countries.length} real countries`)
  const targetCountries = limit > 0 ? countries.slice(0, limit) : countries

  console.log(`\nFetching observations for ${INDICATORS.length} indicators × ${targetCountries.length} countries (${YEAR_FROM}–${YEAR_TO})…`)
  const all: Observation[] = []
  let n = 0
  for (const country of targetCountries) {
    for (const ind of INDICATORS) {
      try {
        const obs = await fetchObservations(country.id, ind)
        all.push(...obs)
      } catch (err) {
        console.error(`  ${country.id}/${ind.code}: ${err instanceof Error ? err.message : err}`)
      }
    }
    n++
    if (n % 20 === 0) console.log(`  ${n}/${targetCountries.length} countries — ${all.length} observations so far`)
  }
  console.log(`  Total observations: ${all.length}`)

  if (dryRun) {
    const sample = all.slice(0, 20)
    const outFile = 'worldbank-dry-run-sample.json'
    fs.writeFileSync(outFile, JSON.stringify({ total: all.length, sample }, null, 2))
    for (const o of sample) console.log(`  ${o.countryIso3} ${o.year} ${o.indicatorCode}: ${formatNumber(o.value, o.indicatorCode)}`)
    console.log(`\n  Written: ${outFile}`)
    await prisma.$disconnect()
    return
  }

  const topicId = await ensureTopic('world-bank-indicators', 'World Bank Indicators', 'economics')
  const counts = { ingested: 0, skipped: 0, errors: 0 }
  let written = 0
  for (const o of all) {
    try {
      const r = await prisma.$transaction(tx => writeObservation(tx, o, topicId), { timeout: 30000 })
      if (r === 'ingested') counts.ingested++
      else if (r === 'skipped') counts.skipped++
      else counts.errors++
    } catch (err) {
      console.error(`  Failed ${o.externalId}: ${err instanceof Error ? err.message : err}`)
      counts.errors++
    }
    written++
    if (written % 500 === 0) console.log(`  Progress: ${written}/${all.length} — ingested=${counts.ingested}`)
  }
  console.log(`\nIngestion complete. Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)
  const db = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  console.log(`DB claims (${INGESTED_BY}): ${db}`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
