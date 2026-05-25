// Pipeline: impact_craters_v1
// Source: Wikipedia "List of impact structures on Earth"
//   https://en.wikipedia.org/wiki/List_of_impact_structures_on_Earth
// Wikitable rows give Name, Location, Country, Diameter (km), Age (Ma), Coordinates.
// Run:
//   npx tsx scripts/ingest-impact-craters.ts --dry-run
//   ALLOW_EDITS=true npx tsx scripts/ingest-impact-craters.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'impact_craters_v1'
const PAGE = 'List of impact structures on Earth'
const SOURCE_URL = `https://en.wikipedia.org/wiki/${encodeURIComponent(PAGE.replace(/ /g, '_'))}`
const API_URL = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(PAGE)}&prop=wikitext&format=json`

interface Crater {
  name: string
  location: string
  country: string
  diameterKm: number | null
  ageMa: number | null
  ageRaw: string | null
  lat: number | null
  lng: number | null
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

function stripLinks(s: string): string {
  return s
    .replace(/\[\[([^\[\]\|]+)\|([^\[\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\[\]]+)\]\]/g, '$1')
    .replace(/'''/g, '')
    .replace(/''/g, '')
    .trim()
}

function parseSortNum(s: string): number | null {
  // Strip {{0|...}} padding templates that confuse the regex
  const cleaned = s.replace(/\{\{0\|?[^}]*\}\}/g, '')
  const m = cleaned.match(/\{\{[Ss]ort\|[^|]*\|\s*[<~≈]?\s*([-+]?[0-9]+(?:[.,][0-9]+)?)/)
  if (m) return parseFloat(m[1].replace(',', '.'))
  const plain = stripLinks(cleaned).replace(/&nbsp;/g, ' ').match(/[<~≈]?\s*([-+]?[0-9]+(?:\.[0-9]+)?)/)
  return plain ? parseFloat(plain[1]) : null
}

function parseCoord(s: string): { lat: number | null; lng: number | null } {
  const m = s.match(/\{\{[Cc]oord\|([^}]+)\}\}/)
  if (!m) return { lat: null, lng: null }
  const parts = m[1].split('|').map(p => p.trim())
  // patterns: {{coord|LAT|DIR|LON|DIR|...}} or {{coord|D|M|S|DIR|D|M|S|DIR|...}}
  const nums: number[] = []
  let latSign = 1
  let lngSign = 1
  let dirIdx = 0
  for (const p of parts) {
    if (/^[NSEW]$/.test(p)) {
      if (p === 'S') latSign = -1
      else if (p === 'W') lngSign = -1
      // first dir terminates lat block
      if (dirIdx === 0) dirIdx = nums.length
    } else if (/^-?[0-9]+(?:\.[0-9]+)?$/.test(p)) {
      nums.push(parseFloat(p))
    } else {
      break
    }
  }
  if (nums.length === 0 || dirIdx === 0) return { lat: null, lng: null }
  const latNums = nums.slice(0, dirIdx)
  const lngNums = nums.slice(dirIdx)
  const dms = (arr: number[]) => (arr[0] ?? 0) + (arr[1] ?? 0) / 60 + (arr[2] ?? 0) / 3600
  const lat = latSign * dms(latNums)
  const lng = lngSign * dms(lngNums)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null }
  return { lat, lng }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

async function fetchWikitext(): Promise<string> {
  const res = await fetch(API_URL, { headers: { 'User-Agent': 'epistemic-receipts/1.0 (research)' } })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  const j = await res.json() as { parse: { wikitext: { '*': string } } }
  return j.parse.wikitext['*']
}

function stripCellPrefix(cell: string): string {
  // Strip "rowspan=..." / "style=..." attribute prefix ending with "|"
  // but only when the cell starts with attribute-like content (no [[ or {{).
  const m = cell.match(/^([^|\[\{\n]*?\|)([\s\S]*)$/)
  if (m && /=/.test(m[1])) return m[2].trim()
  return cell
}

function parseTableRows(tableText: string): string[][] {
  const lines = tableText.split('\n')
  const rowsRaw: string[][] = []
  let current: string[] = []
  let currentCell = ''
  let cellStarted = false
  const pushCell = () => {
    if (cellStarted) current.push(stripCellPrefix(currentCell.trim()))
    currentCell = ''
    cellStarted = false
  }
  const pushRow = () => {
    pushCell()
    if (current.length > 0) rowsRaw.push(current)
    current = []
  }
  for (const line of lines) {
    const t = line.trimEnd()
    if (t.startsWith('{|')) continue
    if (t.startsWith('|}')) { pushRow(); break }
    if (t.startsWith('|-')) { pushRow(); continue }
    if (t.startsWith('!')) { pushCell(); currentCell = t.slice(1).trim(); cellStarted = true; continue }
    if (t.startsWith('|')) {
      pushCell()
      const rest = t.slice(1)
      const parts = rest.split(/\s*\|\|\s*/)
      currentCell = parts[0].trim()
      cellStarted = true
      for (let i = 1; i < parts.length; i++) {
        pushCell()
        currentCell = parts[i].trim()
        cellStarted = true
      }
      continue
    }
    if (cellStarted) currentCell += '\n' + t
  }
  return rowsRaw.filter(r => r.length > 0)
}

function parseCraters(wt: string): Crater[] {
  // Find all wikitable blocks
  const tableRegex = /\{\|\s*class="wikitable[\s\S]*?\n\|\}/g
  const tables = wt.match(tableRegex) ?? []
  const craters: Crater[] = []
  const seen = new Set<string>()

  for (const table of tables) {
    // Detect column units by looking at header
    const headerMatch = table.match(/!\s*Age[^!\n]*\(([^)]+)\)/i)
    const ageUnit = headerMatch ? headerMatch[1].trim().toLowerCase() : 'million years'
    const ageInMa = /m(illion)?/i.test(ageUnit) ? 1 : /k(ilo)?/i.test(ageUnit) ? 0.001 : 1

    // Only keep tables that have the expected columns
    if (!/!\s*Name/i.test(table)) continue
    if (!/!\s*Country/i.test(table)) continue
    if (!/!\s*Diameter/i.test(table)) continue

    const rows = parseTableRows(table)
    let lastLocation = ''
    let lastCountry = ''
    for (const row of rows) {
      if (row.length < 4) continue

      // When a row has rowspan, fewer cells appear in the next row.
      // Map cells based on whether 6 or fewer
      let nameCell = '', locCell = '', countryCell = '', diamCell = '', ageCell = '', coordCell = ''
      if (row.length >= 6) {
        ;[nameCell, locCell, countryCell, diamCell, ageCell, coordCell] = row
      } else if (row.length === 5) {
        // location dropped (rowspan from above)
        ;[nameCell, countryCell, diamCell, ageCell, coordCell] = row
        locCell = lastLocation
      } else if (row.length === 4) {
        // location + country both dropped
        ;[nameCell, diamCell, ageCell, coordCell] = row
        locCell = lastLocation
        countryCell = lastCountry
      } else {
        continue
      }

      const name = stripLinks(nameCell).split('\n')[0].trim()
      if (!name) continue
      if (/^(name|location|country|diameter|age|coordinates)$/i.test(name)) continue

      const location = stripLinks(locCell).split('\n')[0].trim()
      const country = stripLinks(countryCell).split('\n')[0].trim()
      const diameterKm = parseSortNum(diamCell)
      const ageRawVal = parseSortNum(ageCell)
      const ageMa = ageRawVal != null ? ageRawVal * ageInMa : null
      const ageRaw = stripLinks(ageCell.replace(/\{\{[Ss]ort\|[^|]*\|/, '').replace(/\}\}/g, '').replace(/&nbsp;/g, ' ')).trim() || null
      const { lat, lng } = parseCoord(coordCell)

      if (row.length >= 6) { lastLocation = location; lastCountry = country }
      else if (row.length === 5) { lastCountry = country }

      const externalId = `impact_crater_${slugify(name)}`
      if (seen.has(externalId)) continue
      seen.add(externalId)
      craters.push({ name, location, country, diameterKm, ageMa, ageRaw, lat, lng, externalId })
    }
  }
  return craters
}

function buildClaimText(c: Crater): string {
  const parts: string[] = []
  parts.push(`${c.name} is an impact structure in ${c.location ? c.location + ', ' : ''}${c.country}`)
  if (c.diameterKm != null) parts.push(`with a diameter of ${c.diameterKm} km`)
  if (c.ageMa != null) parts.push(`aged approximately ${c.ageMa} million years`)
  return parts.join(', ') + '.'
}

async function writeCrater(tx: TxClient, c: Crater, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: c.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: `Wikipedia — List of impact structures on Earth — ${c.name}`,
      url: SOURCE_URL,
      publishedAt: null,
      methodologyType: 'derivative',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `impact_crater_source_${slugify(c.name)}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: buildClaimText(c),
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: c.externalId,
      metadata: {
        dataset: INGESTED_BY,
        name: c.name,
        location: c.location,
        country: c.country,
        diameterKm: c.diameterKm,
        ageMa: c.ageMa,
        ageRaw: c.ageRaw,
        lat: c.lat,
        lng: c.lng,
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
    data: { edgeId: edge.id, priorScore: null, newScore: 90, reason: 'Wikipedia list of confirmed impact structures', changedAt: new Date() },
  })

  await tx.claimTopic.upsert({
    where: { claimId_topicId: { claimId: claim.id, topicId } },
    update: {},
    create: { claimId: claim.id, topicId },
  })

  return 'ingested'
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

async function main() {
  const { dryRun, limit } = parseArgs()
  console.log(`\n── Pipeline: Earth Impact Craters (${INGESTED_BY}) ──`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'full'} | Limit: ${limit || 'all'}`)

  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to enable DB writes.')
    process.exit(1)
  }

  console.log(`\nFetching: ${SOURCE_URL}`)
  const wt = await fetchWikitext()
  const all = parseCraters(wt)
  console.log(`  Parsed ${all.length} craters`)
  const pool = limit > 0 ? all.slice(0, limit) : all

  if (dryRun) {
    const sample = pool.slice(0, 15)
    const outFile = 'impact-craters-dry-run-sample.json'
    fs.writeFileSync(outFile, JSON.stringify({ total: pool.length, sample }, null, 2))
    for (const c of sample) {
      console.log(`  ${c.name} | ${c.country} | ${c.diameterKm} km | ${c.ageMa} Ma | (${c.lat?.toFixed(2)}, ${c.lng?.toFixed(2)})`)
    }
    console.log(`\n  Written: ${outFile}`)
    await prisma.$disconnect()
    return
  }

  const topicId = await ensureTopic('impact-craters', 'Earth Impact Craters', 'geology')
  const counts = { ingested: 0, skipped: 0, errors: 0 }
  for (const c of pool) {
    try {
      const result = await prisma.$transaction(tx => writeCrater(tx, c, topicId), { timeout: 30000 })
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
    } catch (err) {
      console.error(`  Failed ${c.name}: ${err instanceof Error ? err.message : err}`)
      counts.errors++
    }
  }
  console.log(`\nIngestion complete. Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)
  const dbCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  console.log(`DB claims (${INGESTED_BY}): ${dbCount}`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
