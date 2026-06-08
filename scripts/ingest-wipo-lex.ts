// Pipeline 89 — WIPO Lex IP Legislation (wipo_lex_v1)
// Source: WIPO Lex (https://www.wipo.int/wipolex)
//         Country results pages: /wipolex/en/legislation/results?countryOrgs={code}
//         Detail pages:          /wipolex/en/legislation/details/{id}
// Run: npx tsx scripts/ingest-wipo-lex.ts --dry-run
//      npx tsx scripts/ingest-wipo-lex.ts --sample 10
//      npx tsx scripts/ingest-wipo-lex.ts --full [--limit N] [--verbose]
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'wipo_lex_v1'
const PIPELINE = 'Pipeline 89'
const WIPO_LEX_BASE = 'https://www.wipo.int'
const WIPO_LEX_RESULTS = `${WIPO_LEX_BASE}/wipolex/en/legislation/results`
const WIPO_LEX_DETAIL = `${WIPO_LEX_BASE}/wipolex/en/legislation/details`
const REQUEST_DELAY_MS = 800

// ── Country/org list from WIPO Lex dropdown (201 entries as of 2026-05) ────────

const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'CAN', name: 'Andean Community' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia (Plurinational State of)' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei Darussalam' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'HK', name: 'Hong Kong, China' },
  { code: 'MO', name: 'Macao, China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CK', name: 'Cook Islands' },
  { code: 'GCC', name: 'Cooperation Council for the Arab States of the Gulf (GCC)' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'KP', name: "Democratic People's Republic of Korea" },
  { code: 'CD', name: 'Democratic Republic of the Congo' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'EU', name: 'European Union (EU)' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'VA', name: 'Holy See' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran (Islamic Republic of)' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: "Lao People's Democratic Republic" },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia (Federated States of)' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands (Kingdom of the)' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NU', name: 'Niue' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KR', name: 'Republic of Korea' },
  { code: 'MD', name: 'Republic of Moldova' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russian Federation' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'Sao Tome and Principe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syrian Arab Republic' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Türkiye' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'TZ', name: 'United Republic of Tanzania' },
  { code: 'US', name: 'United States of America' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VE', name: 'Venezuela (Bolivarian Republic of)' },
  { code: 'VN', name: 'Viet Nam' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
]

// ── Types ──────────────────────────────────────────────────────────────────────

interface CandidateRecord {
  detailId: string
  countryCode: string
  countryName: string
  title: string
  year: number
  enactedDate: Date | null
  enactedYear: number | null
  eventLabel: string
  typeOfText: string
  subjects: string[]
  externalId: string
  sourceExternalId: string
  sourceUrl: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

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

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function httpsGet(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Referer': 'https://www.wipo.int/wipolex/en/main/legislation',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `https://${parsed.hostname}${res.headers.location}`
          res.resume()
          httpsGet(nextUrl, timeoutMs).then(resolve).catch(reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

async function fetchWithRetry(url: string, timeoutMs = 30_000): Promise<string | null> {
  let delay = 2000
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      const res = await httpsGet(url, timeoutMs)
      if ([429, 502, 503, 504].includes(res.status) && attempt < 3) {
        console.warn(`    HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (res.status === 404) return null
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
      return res.body
    } catch (err) {
      if (attempt >= 3) { console.error(`    Error: ${err}`); return null }
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`    Error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  return null
}

// ── HTML parsing ───────────────────────────────────────────────────────────────

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim()
}

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

function parseHumanDate(s: string): Date | null {
  // "October 19, 1976" or "December 23, 2022"
  const m = s.trim().match(/^(\w+)\s+(\d{1,2}),\s+(\d{4})$/)
  if (!m) return null
  const month = MONTH_MAP[m[1].toLowerCase()]
  if (month === undefined) return null
  const day = parseInt(m[2])
  const year = parseInt(m[3])
  if (isNaN(day) || isNaN(year)) return null
  const d = new Date(Date.UTC(year, month, day))
  return isNaN(d.getTime()) ? null : d
}

// Parse one row's cells: [typeOfText, year, dates, title, subjects]
function parseRow(rowHtml: string, countryCode: string, countryName: string): CandidateRecord | null {
  const cells = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/g)
  if (!cells || cells.length < 5) return null

  const cellText = (idx: number) => stripTags(cells[idx].replace(/<td[^>]*>|<\/td>/g, ''))

  // Cell 0: type of text
  const typeOfText = cellText(0)

  // Cell 1: year of version
  const yearStr = cellText(1).trim()
  const year = parseInt(yearStr)
  if (isNaN(year) || year < 1800 || year > 2100) return null

  // Cell 2: dates — HTML pattern is <div>LABEL :</div><div class="black">DATE</div>
  // Event types seen: "Entry into force", "Adopted", "Signed", "Published"
  // Use the first div.black (primary date) and the label div that precedes it.
  const datesHtml = cells[2]
  let enactedDate: Date | null = null
  let enactedYear: number | null = null
  let eventLabel = 'Enacted'

  const firstBlackIdx = datesHtml.search(/<div[^>]*class="black"/)
  if (firstBlackIdx !== -1) {
    const blackMatch = datesHtml.slice(firstBlackIdx).match(/<div[^>]*class="black"[^>]*>([\s\S]*?)<\/div>/)
    if (blackMatch) {
      const dateText = stripTags(blackMatch[1])
      enactedDate = parseHumanDate(dateText)
      if (enactedDate) enactedYear = enactedDate.getUTCFullYear()
    }
    // Find the event label from the preceding div
    const before = datesHtml.slice(0, firstBlackIdx)
    const labelMatch = before.match(/(Entry into force|Adopted|Enacted|Signed|Published)\s*:/i)
    if (labelMatch) eventLabel = labelMatch[1]!.trim()
  }

  // Cell 3: title with href
  const titleHtml = cells[3]
  const hrefMatch = titleHtml.match(/href="\/wipolex\/en\/legislation\/details\/(\d+)"/)
  if (!hrefMatch) return null
  const detailId = hrefMatch[1]

  // Extract title text from the anchor
  const anchorMatch = titleHtml.match(/href="\/wipolex\/en\/legislation\/details\/\d+"[^>]*>([\s\S]*?)<\/a>/)
  if (!anchorMatch) return null
  const title = stripTags(anchorMatch[1])
  if (!title) return null

  // Cell 4: subjects (multiple <div> entries)
  const subjectDivs = [...cells[4].matchAll(/<div[^>]*>([\s\S]*?)<\/div>/g)]
  const subjects = subjectDivs
    .map(m => stripTags(m[1]))
    .filter(s => s.length > 0)

  return {
    detailId,
    countryCode,
    countryName,
    title,
    year,
    enactedDate,
    enactedYear,
    eventLabel,
    typeOfText,
    subjects,
    externalId: `wipo_lex_${detailId}`,
    sourceExternalId: `src_wipo_lex_${detailId}`,
    sourceUrl: `${WIPO_LEX_DETAIL}/${detailId}`,
  }
}

function parseCountryPage(html: string, countryCode: string, countryName: string): CandidateRecord[] {
  const records: CandidateRecord[] = []

  // Extract all <tr>...</tr> blocks
  const rowMatches = html.match(/<tr>([\s\S]*?)<\/tr>/g) ?? []
  for (const rowHtml of rowMatches) {
    const rec = parseRow(rowHtml, countryCode, countryName)
    if (rec) records.push(rec)
  }

  return records
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean, countryLimit?: number): Promise<CandidateRecord[]> {
  const allCandidates: CandidateRecord[] = []
  const countriesToFetch = countryLimit != null ? COUNTRIES.slice(0, countryLimit) : COUNTRIES

  console.log(`  Fetching ${countriesToFetch.length} country/org pages...`)

  for (let i = 0; i < countriesToFetch.length; i++) {
    if (limit > 0 && allCandidates.length >= limit) break

    const { code, name } = countriesToFetch[i]
    // No `last` param = server default = last version only (confirmed empirically)
    const url = `${WIPO_LEX_RESULTS}?countryOrgs=${encodeURIComponent(code)}`

    if (verbose) process.stdout.write(`  [${i + 1}/${countriesToFetch.length}] ${name} (${code})... `)

    const html = await fetchWithRetry(url, 30_000)
    if (!html) {
      if (verbose) console.log('FAILED')
      else process.stdout.write(`  [${i + 1}/${countriesToFetch.length}] ${name}: FAILED\n`)
      if (i + 1 < countriesToFetch.length) await sleep(REQUEST_DELAY_MS)
      continue
    }

    const records = parseCountryPage(html, code, name)
    allCandidates.push(...records)

    if (verbose) console.log(`${records.length} records (total ${allCandidates.length})`)
    else process.stdout.write(`  [${i + 1}/${countriesToFetch.length}] ${name}: ${records.length} records\r`)

    if (i + 1 < countriesToFetch.length) await sleep(REQUEST_DELAY_MS)
  }

  if (!verbose) process.stdout.write('\n')
  return allCandidates
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }

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
        name: `WIPO Lex: ${rec.title.slice(0, 200)}`,
        url: rec.sourceUrl,
        publishedAt: rec.enactedDate ?? new Date(Date.UTC(rec.year, 0, 1)),
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
      },
    })

    const displayDate = rec.enactedDate
      ? rec.enactedDate.toISOString().slice(0, 10)
      : String(rec.year)
    const claimText = `${rec.countryName} ${rec.title} — ${rec.typeOfText} ${rec.eventLabel} ${displayDate}`

    const claim = await tx.claim.create({
      data: {
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.enactedDate ?? new Date(Date.UTC(rec.year, 0, 1)),
        claimEmergedPrecision: rec.enactedDate ? 'DAY' : 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          detailId: rec.detailId,
          countryCode: rec.countryCode,
          countryName: rec.countryName,
          title: rec.title,
          year: rec.year,
          enactedYear: rec.enactedYear,
          eventLabel: rec.eventLabel,
          typeOfText: rec.typeOfText,
          subjects: rec.subjects,
          pipeline: INGESTED_BY,
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'CITES',
        evidenceType: 'EVIDENTIARY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
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
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE}: WIPO Lex IP Legislation ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | Countries: ${COUNTRIES.length}`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('\nALLOW_EDITS=true is required for sample/full modes.')
    process.exit(2)
  }

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic('wipo-lex-ip-laws', 'WIPO Lex — IP Legislation', 'international', 'gov-region-international')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // Dry-run only fetches first 8 countries to avoid 161-second wait
  const dryRunCountryLimit = mode === 'dry-run' ? 8 : undefined

  console.log('\nStep 2: Fetching WIPO Lex legislation from country pages...')
  const allCandidates = await fetchAllCandidates(limit, verbose, dryRunCountryLimit)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 5).map(r => {
      const displayDate = r.enactedDate
        ? r.enactedDate.toISOString().slice(0, 10)
        : String(r.year)
      return {
        externalId: r.externalId,
        claimText: `${r.countryName} ${r.title} — ${r.typeOfText} ${r.eventLabel} ${displayDate}`,
        detailId: r.detailId,
        countryCode: r.countryCode,
        countryName: r.countryName,
        title: r.title,
        year: r.year,
        enactedDate: r.enactedDate?.toISOString().slice(0, 10) ?? null,
        eventLabel: r.eventLabel,
        typeOfText: r.typeOfText,
        subjects: r.subjects,
        sourceUrl: r.sourceUrl,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      }
    })

    const byCountry: Record<string, number> = {}
    const byYear: Record<string, number> = {}
    const byType: Record<string, number> = {}

    for (const r of allCandidates) {
      byCountry[r.countryName] = (byCountry[r.countryName] ?? 0) + 1
      const y = String(r.enactedYear ?? r.year)
      byYear[y] = (byYear[y] ?? 0) + 1
      byType[r.typeOfText] = (byType[r.typeOfText] ?? 0) + 1
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      note: 'Dry-run fetches only first 8 countries; full run covers all 201.',
      totalCandidates: allCandidates.length,
      distribution: { byCountry: Object.fromEntries(Object.entries(byCountry).sort(([, a], [, b]) => b - a).slice(0, 20)), byType },
      sampleFirst5: sample,
    }

    fs.writeFileSync('pipeline-89-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-89-dry-run-sample.json')

    // Top 10 countries
    const topCountries = Object.entries(byCountry).sort(([, a], [, b]) => b - a).slice(0, 10)
    console.log('\nTop 10 countries by record count:')
    for (const [k, v] of topCountries) {
      console.log(`  ${k}: ${v}`)
    }

    console.log('\nType distribution:')
    for (const [k, v] of Object.entries(byType).sort(([, a], [, b]) => b - a)) {
      console.log(`  ${k}: ${v}`)
    }

    if (allCandidates.length > 0) {
      console.log('\nFirst 5 laws:')
      allCandidates.slice(0, 5).forEach((r, i) => {
        const date = r.enactedDate ? r.enactedDate.toISOString().slice(0, 10) : String(r.year)
        console.log(`  ${i + 1}. [${r.countryCode}] ${r.title.slice(0, 60)} — ${r.eventLabel} ${date}`)
      })
    }

    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample' ? allCandidates.slice(0, sampleN) : allCandidates

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
          if (verbose) {
            const date = row.enactedDate ? row.enactedDate.toISOString().slice(0, 10) : String(row.year)
            console.log(`  [${result}] ${row.externalId} — [${row.countryCode}] ${row.title.slice(0, 50)} ${row.eventLabel} ${date}`)
          }
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

    if (i + BATCH < rows.length) await sleep(REQUEST_DELAY_MS)
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
