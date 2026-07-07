// Pilot pipeline 3: DOJ FARA Foreign Agent Registrations
// Archetype: bulk CSV download (zip) + row-by-row processing
// Migrated from scripts/ingest-doj-fara.ts (now in scripts/legacy/)

import { definePipeline, type Adapter } from '@/lib/ingest/definePipeline'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const TAG = 'doj_fara_v1'
const BULK_URL = 'https://efile.fara.gov/bulk/zip/FARA_All_ForeignPrincipals.csv.zip'
const BATCH_SIZE = 100

interface FaraRow {
  termDate: string
  fpName: string
  fpRegDate: string
  country: string
  regNumber: string
  regDate: string
  registrantName: string
  city: string
  state: string
}

function parseCursor(cursor: string | null): number {
  if (!cursor) return 0
  const m = /^ROW:(\d+)$/.exec(cursor)
  return m ? parseInt(m[1]!) : 0
}

function encodeCursor(idx: number): string {
  return `ROW:${idx}`
}

async function downloadAndParseCSV(): Promise<FaraRow[]> {
  const zipPath = '/tmp/doj-fara-fp.zip'
  const extractDir = '/tmp/doj-fara-extract'

  if (!fs.existsSync(zipPath)) {
    const res = await fetch(BULK_URL)
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
    fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()))
  }

  fs.mkdirSync(extractDir, { recursive: true })
  execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' })

  const csvPath = path.join(extractDir, 'FARA_All_ForeignPrincipals.csv')
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found at ${csvPath}`)

  const jsonPath = '/tmp/doj-fara-fp.json'
  execSync(
    `python3 -c "import csv, json; rows = []; f = open('${csvPath}', encoding='latin1'); [rows.append({k.strip(): (v.strip() if v else '') for k, v in r.items() if k}) for r in csv.DictReader(f)]; open('${jsonPath}', 'w').write(json.dumps(rows))"`,
    { stdio: 'pipe' }
  )

  const records = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, string>[]
  return records.map(r => ({
    termDate: r['Foreign Principal Termination Date'] ?? '',
    fpName: r['Foreign Principal'] ?? '',
    fpRegDate: r['Foreign Principal Registration Date'] ?? '',
    country: r['Country/Location Represented'] ?? '',
    regNumber: r['Registration Number'] ?? '',
    regDate: r['Registrant Date'] ?? '',
    registrantName: r['Registrant Name'] ?? '',
    city: r['City'] ?? '',
    state: r['State'] ?? '',
  }))
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

function parseFaraDate(s: string): Date | null {
  if (!s?.trim()) return null
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim())
  if (!m) return null
  return new Date(Date.UTC(parseInt(m[3]!), parseInt(m[1]!) - 1, parseInt(m[2]!)))
}

let csvCache: FaraRow[] | null = null

const faraAdapter: Adapter<FaraRow> = {
  async fetchBatch(cursor) {
    if (!csvCache) {
      const all = await downloadAndParseCSV()
      csvCache = all.filter(r => !r.termDate && r.fpName && r.registrantName && r.regNumber)
    }

    const startIdx = parseCursor(cursor)
    if (startIdx >= csvCache.length) return { items: [], nextCursor: null }

    const items = csvCache.slice(startIdx, startIdx + BATCH_SIZE)
    const nextIdx = startIdx + items.length
    const nextCursor = nextIdx < csvCache.length ? encodeCursor(nextIdx) : null
    return { items, nextCursor }
  },
}

function transform(row: FaraRow) {
  const externalId = `doj_fara_${row.regNumber}_${slugify(row.fpName)}`
  const country = row.country ? ` (${row.country})` : ''
  const claimText = `${row.registrantName} is registered as a foreign agent for ${row.fpName}${country}`
  const sourceUrl = `https://efile.fara.gov/api/v1/RegDocs/html/${row.regNumber}`
  const publishedAt = parseFaraDate(row.fpRegDate) ?? parseFaraDate(row.regDate)

  return {
    externalId,
    claim: {
      text: claimText,
      claimType: 'EMPIRICAL',
      currentStatus: 'VERIFIED',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: publishedAt,
      claimEmergedPrecision: publishedAt ? 'DAY' : null,
      metadata: {
        dataset: TAG,
        tags: ['foreign-lobbying', 'doj', 'fara'],
        registration_number: row.regNumber,
        registrant_name: row.registrantName,
        foreign_principal: row.fpName,
        country: row.country,
        fp_reg_date: row.fpRegDate,
        registrant_date: row.regDate,
        city: row.city || null,
        state: row.state || null,
        active: true,
        termination_date: null,
      },
    },
    sources: [{
      externalId,
      name: `DOJ FARA Registration — ${row.registrantName}`,
      url: sourceUrl,
      publishedAt,
      methodologyType: 'primary',
    }],
    edges: [{ sourceIndex: 0, type: 'FOR', evidenceType: 'EVIDENTIARY' }],
    topicSlugs: ['foreign-lobbying'],
  }
}

function validate(t: ReturnType<typeof transform>): { ok: true } | { ok: false; reason: string } {
  if (!t.externalId) return { ok: false, reason: 'missing externalId' }
  if (!t.claim.text?.trim()) return { ok: false, reason: 'empty claim text' }
  if (!t.claim.metadata?.registration_number) return { ok: false, reason: 'missing registration_number' }
  if (t.claim.text.length > 2000) return { ok: false, reason: 'claim text too long' }
  return { ok: true }
}

export const pipeline = definePipeline({
  tag: TAG,
  adapter: faraAdapter,
  batchSize: BATCH_SIZE,
  rateLimitMs: 0,
  autoApproved: false,
  transform,
  validate,
})
