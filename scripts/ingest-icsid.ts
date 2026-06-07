// ICSID arbitration case ingester (icsid_v1)
// Source: ICSID case database, World Bank
//   https://icsid.worldbank.org/cases/case-database
// JSON list endpoint (discovered from the page's allCases.js bundle):
//   https://icsid.worldbank.org/api/all/cases   → { data: { GetAllCasesResult: [...] }, method }
// Per-case detail HTML (server-rendered, parsed for subject/sector/instrument/outcome):
//   https://icsid.worldbank.org/cases/case-database/case-detail?CaseNo=ARB/XX/XX
//
// One Claim per ICSID case, keyed on caseno.
//
// Run:
//   npx tsx scripts/ingest-icsid.ts --dry-run --limit 10
//   ALLOW_EDITS=true npx tsx scripts/ingest-icsid.ts --limit 500
//
// Flags:
//   --dry-run        Parse + preview without writing to DB
//   --limit N        Cap number of records processed (default 500)
//   --skip-existing  Skip records already in DB (by externalId)
//   --no-detail      Skip per-case detail HTML fetch (faster, less metadata)

import 'dotenv/config'
import * as fs from 'fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PIPELINE     = 'icsid_v1'
const LIST_URL     = 'https://icsid.worldbank.org/api/all/cases'
const DETAIL_URL   = 'https://icsid.worldbank.org/cases/case-database/case-detail?CaseNo='
const SOURCE_BASE  = 'https://icsid.worldbank.org/cases/case-database/case-detail?CaseNo='
const TX_TIMEOUT   = 30_000
const LOG_PATH     = '/tmp/icsid-agent.log'
const CACHE_LIST   = '/tmp/icsid-all.json'
const DETAIL_DELAY = 180 // ms between detail HTML fetches (~5.5 req/sec)
const UA           = 'epistemic-receipts/1.0 (mailto:robert.contofalsky@rutgers.edu)'

// ── Respondent → ISO 3166-1 alpha-3 ─────────────────────────────────────────
// Built by surveying the 185 distinct primary respondents in the ICSID DB.
// Strips "Republic of …", "Kingdom of …", etc. via normalize(), then looks up
// the simplified country name. Multi-word countries are listed verbatim.

const COUNTRY_ALPHA3: Record<string, string> = {
  // Americas
  'argentina': 'ARG', 'argentine': 'ARG',
  'bolivia': 'BOL',
  'brazil': 'BRA',
  'canada': 'CAN',
  'chile': 'CHL',
  'colombia': 'COL',
  'costa rica': 'CRI',
  'cuba': 'CUB',
  'dominican': 'DOM', 'dominican republic': 'DOM',
  'ecuador': 'ECU',
  'el salvador': 'SLV',
  'grenada': 'GRD',
  'guatemala': 'GTM',
  'guyana': 'GUY',
  'haiti': 'HTI',
  'honduras': 'HND',
  'jamaica': 'JAM',
  'mexico': 'MEX', 'mexican states': 'MEX',
  'nicaragua': 'NIC',
  'panama': 'PAN',
  'paraguay': 'PRY',
  'peru': 'PER',
  'saint lucia': 'LCA',
  'st. kitts': 'KNA', 'federation of st. kitts': 'KNA',
  'suriname': 'SUR',
  'trinidad': 'TTO', 'trinidad & tobago': 'TTO', 'trinidad and tobago': 'TTO',
  'united mexican states': 'MEX', 'united mexican': 'MEX', 'mexican': 'MEX',
  'united states': 'USA', 'united states of america': 'USA', 'united america': 'USA', 'america': 'USA',
  'uruguay': 'URY', 'oriental uruguay': 'URY',
  'venezuela': 'VEN', 'bolivarian venezuela': 'VEN',
  // Europe
  'albania': 'ALB',
  'austria': 'AUT',
  'belarus': 'BLR',
  'belgium': 'BEL',
  'bosnia': 'BIH', 'bosnia and herzegovina': 'BIH',
  'bulgaria': 'BGR',
  'croatia': 'HRV',
  'cyprus': 'CYP',
  'czech': 'CZE', 'czech republic': 'CZE',
  'denmark': 'DNK',
  'estonia': 'EST',
  'european union': 'EU',
  'finland': 'FIN',
  'france': 'FRA', 'french': 'FRA',
  'georgia': 'GEO',
  'germany': 'DEU', 'federal germany': 'DEU',
  'greece': 'GRC', 'hellenic': 'GRC',
  'hungary': 'HUN',
  'iceland': 'ISL',
  'ireland': 'IRL',
  'italy': 'ITA', 'italian': 'ITA',
  'kosovo': 'XKX',
  'latvia': 'LVA',
  'lithuania': 'LTU',
  'macedonia': 'MKD', 'north macedonia': 'MKD',
  'malta': 'MLT',
  'moldova': 'MDA',
  'montenegro': 'MNE',
  'netherlands': 'NLD',
  'norway': 'NOR',
  'poland': 'POL',
  'portugal': 'PRT', 'portuguese': 'PRT',
  'romania': 'ROU',
  'serbia': 'SRB',
  'slovakia': 'SVK', 'slovak': 'SVK',
  'slovenia': 'SVN',
  'spain': 'ESP',
  'sweden': 'SWE',
  'switzerland': 'CHE', 'swiss confederation': 'CHE',
  'turkey': 'TUR', 'türkiye': 'TUR', 'turkiye': 'TUR',
  'ukraine': 'UKR',
  'united kingdom': 'GBR',
  // Asia / Middle East
  'afghanistan': 'AFG',
  'armenia': 'ARM',
  'azerbaijan': 'AZE',
  'bahrain': 'BHR',
  'bangladesh': 'BGD',
  'cambodia': 'KHM',
  'china': 'CHN', "people's china": 'CHN',
  'india': 'IND',
  'indonesia': 'IDN',
  'iran': 'IRN', 'islamic iran': 'IRN',
  'iraq': 'IRQ',
  'israel': 'ISR',
  'japan': 'JPN',
  'jordan': 'JOR', 'hashemite jordan': 'JOR',
  'kazakhstan': 'KAZ',
  'korea': 'KOR', 'south korea': 'KOR',
  'kuwait': 'KWT',
  'kyrgyz': 'KGZ', 'kyrgyzstan': 'KGZ',
  'lao': 'LAO', "lao people's democratic": 'LAO', 'laos': 'LAO',
  'lebanon': 'LBN', 'lebanese': 'LBN',
  'malaysia': 'MYS',
  'mongolia': 'MNG',
  'myanmar': 'MMR', 'union of myanmar': 'MMR',
  'nepal': 'NPL',
  'oman': 'OMN', 'sultanate of oman': 'OMN',
  'pakistan': 'PAK', 'islamic pakistan': 'PAK',
  'palestine': 'PSE',
  'papua new guinea': 'PNG',
  'philippines': 'PHL',
  'qatar': 'QAT',
  'saudi arabia': 'SAU',
  'sri lanka': 'LKA', 'democratic socialist sri lanka': 'LKA',
  'syria': 'SYR',
  'tajikistan': 'TJK',
  'thailand': 'THA',
  'timor-leste': 'TLS', 'democratic timor-leste': 'TLS',
  'turkmenistan': 'TKM',
  'united arab emirates': 'ARE',
  'uzbekistan': 'UZB',
  'vietnam': 'VNM', 'viet nam': 'VNM', 'socialist viet nam': 'VNM', 'socialist vietnam': 'VNM',
  'yemen': 'YEM',
  // Africa
  'algeria': 'DZA', "people's democratic algeria": 'DZA',
  'angola': 'AGO',
  'benin': 'BEN',
  'burkina faso': 'BFA',
  'burundi': 'BDI',
  'cabo verde': 'CPV',
  'cameroon': 'CMR', 'united cameroon': 'CMR',
  'central african': 'CAF', 'central african republic': 'CAF',
  'chad': 'TCD',
  'comoros': 'COM', 'union of the comoros': 'COM',
  'congo': 'COG', "people's congo": 'COG',
  'democratic congo': 'COD', 'democratic republic of the congo': 'COD',
  "côte d'ivoire": 'CIV', "cote d'ivoire": 'CIV',
  'egypt': 'EGY', 'arab egypt': 'EGY',
  'equatorial guinea': 'GNQ',
  'eritrea': 'ERI',
  'ethiopia': 'ETH',
  'gabon': 'GAB', 'gabonese': 'GAB',
  'gambia': 'GMB', 'the gambia': 'GMB',
  'ghana': 'GHA',
  'guinea': 'GIN', "people's revolutionary guinea": 'GIN',
  'guinea-bissau': 'GNB',
  'kenya': 'KEN',
  'liberia': 'LBR',
  'libya': 'LBY',
  'madagascar': 'MDG', 'democratic madagascar': 'MDG',
  'mali': 'MLI',
  'mauritania': 'MRT', 'islamic mauritania': 'MRT',
  'mauritius': 'MUS',
  'morocco': 'MAR',
  'mozambique': 'MOZ',
  'namibia': 'NAM',
  'niger': 'NER',
  'nigeria': 'NGA', 'federal nigeria': 'NGA',
  'rwanda': 'RWA',
  'senegal': 'SEN',
  'seychelles': 'SYC',
  'sierra leone': 'SLE',
  'somalia': 'SOM',
  'south africa': 'ZAF',
  'south sudan': 'SSD',
  'sudan': 'SDN',
  'tanzania': 'TZA', 'united tanzania': 'TZA',
  'togo': 'TGO',
  'tunisia': 'TUN',
  'uganda': 'UGA',
  'zambia': 'ZMB',
  'zimbabwe': 'ZWE',
  // Oceania
  'australia': 'AUS', 'commonwealth of australia': 'AUS',
  'new zealand': 'NZL',
  'fiji': 'FJI',
}

// ── Args ────────────────────────────────────────────────────────────────────

interface Args {
  dryRun: boolean
  limit: number
  skipExisting: boolean
  noDetail: boolean
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const args: Args = {
    dryRun: false,
    limit: 500,
    skipExisting: false,
    noDetail: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') args.dryRun = true
    else if (a === '--no-detail') args.noDetail = true
    else if (a === '--skip-existing') args.skipExisting = true
    else if (a === '--limit' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10)
      if (!isNaN(n) && n > 0) args.limit = n
    }
  }
  return args
}

// ── Types ──────────────────────────────────────────────────────────────────

interface RawCase {
  caseid: string
  caseno: string
  claimant?: string
  respondent?: string
  status?: string
  casetype?: string
  econsector?: string
  instrumentinvk1?: string
  instrumentinvk2?: string
  partiessub?: string
  rulesapplied?: string
  seatarbitration?: string
  subject?: string
  Date_Concluded?: string
  caseproceedings?: Array<{ dateregistered?: string }>
}

interface DetailExtras {
  subject?: string
  econSector?: string
  instrument?: string
  applicableRules?: string
  claimantNationality?: string
  respondentNationality?: string
  outcomeDate?: string
  outcomeText?: string
  proceedingTimeline: Array<{ date: string; development: string }>
}

// ── Fetch helpers ──────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function fetchJson<T>(url: string, retries = 3): Promise<T> {
  let delay = 1000
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        if (attempt < retries) { await sleep(delay); delay *= 2; continue }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
      return await res.json() as T
    } catch (e) {
      lastErr = e
      if (attempt < retries) { await sleep(delay); delay *= 2; continue }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`fetch failed: ${String(lastErr)}`)
}

async function fetchText(url: string, retries = 2): Promise<string | null> {
  let delay = 800
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } })
      if (res.status === 404) return null
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        if (attempt < retries) { await sleep(delay); delay *= 2; continue }
      }
      if (!res.ok) return null
      return await res.text()
    } catch {
      if (attempt < retries) { await sleep(delay); delay *= 2; continue }
    }
  }
  return null
}

async function fetchList(): Promise<RawCase[]> {
  let payload: { data?: { GetAllCasesResult?: RawCase[] } }
  if (fs.existsSync(CACHE_LIST)) {
    console.log(`  Using cached list at ${CACHE_LIST}`)
    payload = JSON.parse(fs.readFileSync(CACHE_LIST, 'utf8'))
  } else {
    console.log(`  Fetching ${LIST_URL} ...`)
    payload = await fetchJson(LIST_URL)
    fs.writeFileSync(CACHE_LIST, JSON.stringify(payload))
    console.log(`  Cached → ${CACHE_LIST}`)
  }
  const list = payload?.data?.GetAllCasesResult ?? []
  console.log(`  Parsed ${list.length} cases`)
  return list
}

// ── Detail page scraping ───────────────────────────────────────────────────
// The case detail HTML is server-rendered. We extract label/value rows of the
// form: <label>Subject of Dispute:</label> ... <div class="...rightcol...">VALUE</div>

function stripTags(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractRow(html: string, labelRegex: RegExp): string | undefined {
  const labelM = labelRegex.exec(html)
  if (!labelM) return undefined
  // From the label position, find the next rightcol div
  const after = html.slice(labelM.index + labelM[0].length)
  const valM = /<div class="[^"]*rightcol[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(after)
  if (!valM) return undefined
  const text = stripTags(valM[1])
  return text || undefined
}

function parseDetail(html: string): DetailExtras {
  const subject              = extractRow(html, /<label>\s*Subject of Dispute:?\s*<\/label>/i)
  const econSector           = extractRow(html, /<label>\s*Economic Sector:?\s*<\/label>/i)
  const instrument           = extractRow(html, /<label>\s*Instrument\(s\) Invoked:?\s*<\/label>/i)
  const applicableRules      = extractRow(html, /<label>\s*Applicable Rules:?\s*<\/label>/i)
  const claimantNationality  = extractRow(html, /<label>\s*Claimant\(s\)\/Nationality\(ies\):?\s*<\/label>/i)
  const respondentNationality = extractRow(html, /<label>\s*Respondent\(s\):?\s*<\/label>/i)
  const outcomeRaw           = extractRow(html, /<label>\s*Outcome of Proceeding:?\s*<\/label>/i)

  let outcomeDate: string | undefined
  let outcomeText: string | undefined
  if (outcomeRaw) {
    const m = /^([A-Z][a-z]+ \d{1,2}, \d{4})\s*-\s*(.+)$/.exec(outcomeRaw)
    if (m) { outcomeDate = m[1]; outcomeText = m[2] } else { outcomeText = outcomeRaw }
  }

  // Procedural details table: <td>Date</td><td>Development</td>
  const proceedingTimeline: Array<{ date: string; development: string }> = []
  const tableM = /<table>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>[\s\S]*?<\/table>/i.exec(html)
  if (tableM) {
    const rowRe = /<tr>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi
    let m: RegExpExecArray | null
    while ((m = rowRe.exec(tableM[1])) !== null) {
      const date = stripTags(m[1])
      const dev = stripTags(m[2])
      if (date && dev) proceedingTimeline.push({ date, development: dev })
    }
  }

  return {
    subject, econSector, instrument, applicableRules,
    claimantNationality, respondentNationality,
    outcomeDate, outcomeText, proceedingTimeline,
  }
}

// ── Country resolution ────────────────────────────────────────────────────

function normalizeCountry(raw: string): string {
  return raw
    .replace(/[‘’]/g, "'")
    .replace(/[,.;:]/g, ' ')
    .toLowerCase()
    .replace(/\b(republic|kingdom|state|states|federal|federation|democratic|socialist|people'?s|islamic|hashemite|sultanate|union|commonwealth|cooperative|co-operative|grand duchy|oriental|plurinational|independent|former yugoslav)\b/g, ' ')
    .replace(/\bof\b/g, ' ')
    .replace(/\bthe\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Atomic names whose tokens get destroyed by the strip list ("kingdom" → empty).
const ATOMIC_PREMATCH: Record<string, string> = {
  'united kingdom': 'GBR',
  'european union': 'EU',
}

function resolveRespondentAlpha3(respondent: string): { alpha3: string | null; primaryName: string } {
  if (!respondent) return { alpha3: null, primaryName: '' }
  // Strip non-state co-respondents (corp names after "and")
  const split = respondent.split(/\s+and\s+/i)
  let primary = split[0].trim()
  // Strip trailing punctuation
  primary = primary.replace(/[,;:]\s*$/, '').trim()
  const lower = primary.toLowerCase()
  for (const [key, code] of Object.entries(ATOMIC_PREMATCH)) {
    if (lower === key) return { alpha3: code, primaryName: primary }
  }
  const norm = normalizeCountry(primary)
  // Direct hit
  if (COUNTRY_ALPHA3[norm]) return { alpha3: COUNTRY_ALPHA3[norm], primaryName: primary }
  // Try matching any token-substring
  for (const [key, code] of Object.entries(COUNTRY_ALPHA3)) {
    if (norm === key) return { alpha3: code, primaryName: primary }
  }
  // Multi-word: try contiguous tokens (longest first)
  const tokens = norm.split(' ').filter(Boolean)
  for (let len = tokens.length; len >= 1; len--) {
    for (let i = 0; i + len <= tokens.length; i++) {
      const sub = tokens.slice(i, i + len).join(' ')
      if (COUNTRY_ALPHA3[sub]) return { alpha3: COUNTRY_ALPHA3[sub], primaryName: primary }
    }
  }
  return { alpha3: null, primaryName: primary }
}

// ── Date parsing ───────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
}

function parseMonthDayYear(s: string): Date | null {
  // "August 28, 2025"
  const m = /^([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(s.trim())
  if (!m) return null
  const month = MONTHS[m[1]]
  if (month === undefined) return null
  return new Date(Date.UTC(parseInt(m[3], 10), month, parseInt(m[2], 10)))
}

function parseSlashDate(s: string): Date | null {
  // "8/28/2025 12:00:00 AM" or "8/28/2025"
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s.trim())
  if (!m) return null
  return new Date(Date.UTC(parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10)))
}

// ── Topic cache ───────────────────────────────────────────────────────────

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
  const created = await prisma.topic.create({
    data: { slug, name, domain, ...(parentTopicId ? { parentTopicId } : {}) },
  })
  topicCache.set(slug, created.id)
  return created.id
}

// ── Polity cache (reused for respondent country linking) ──────────────────

const polityCache = new Map<string, string | null>()

async function findPolityId(alpha3: string): Promise<string | null> {
  if (polityCache.has(alpha3)) return polityCache.get(alpha3)!
  const polity =
    await prisma.polity.findFirst({ where: { countryCode: alpha3, endYear: null }, select: { id: true } })
    ?? await prisma.polity.findFirst({ where: { countryCode: alpha3 }, select: { id: true } })
  const id = polity?.id ?? null
  polityCache.set(alpha3, id)
  return id
}

// ── Build claim text ──────────────────────────────────────────────────────

interface NormalizedCase {
  caseNumber: string
  claimant: string
  respondent: string
  respondentPrimaryName: string
  alpha3: string | null
  status: string
  filingDate: Date | null
  filingDateRaw?: string
  closingDate: Date | null
  closingDateRaw?: string
  detail: DetailExtras | null
  sourceUrl: string
  externalId: string
}

function normalize(raw: RawCase, detail: DetailExtras | null): NormalizedCase {
  const respondent = (raw.respondent ?? '').trim()
  const { alpha3, primaryName } = resolveRespondentAlpha3(respondent)
  const filingRaw = raw.caseproceedings?.[0]?.dateregistered ?? ''
  const filingDate = filingRaw ? parseSlashDate(filingRaw) : null
  const concludedRaw = raw.Date_Concluded ?? ''
  let closingDate: Date | null = null
  if (concludedRaw) closingDate = parseSlashDate(concludedRaw)
  if (!closingDate && detail?.outcomeDate) closingDate = parseMonthDayYear(detail.outcomeDate)
  if (!closingDate && detail?.proceedingTimeline?.length) {
    // last entry
    const last = detail.proceedingTimeline[detail.proceedingTimeline.length - 1]
    closingDate = parseMonthDayYear(last.date)
  }
  const externalId = `icsid_${raw.caseno.replace(/[^A-Za-z0-9]/g, '_')}`
  return {
    caseNumber: raw.caseno,
    claimant: (raw.claimant ?? '').trim(),
    respondent,
    respondentPrimaryName: primaryName,
    alpha3,
    status: (raw.status ?? '').trim(),
    filingDate,
    filingDateRaw: filingRaw || undefined,
    closingDate,
    closingDateRaw: concludedRaw || (detail?.outcomeDate ?? undefined),
    detail,
    sourceUrl: `${SOURCE_BASE}${encodeURIComponent(raw.caseno).replace(/%2F/g, '/')}`,
    externalId,
  }
}

function buildTitle(c: NormalizedCase): string {
  return `${c.claimant} v. ${c.respondent} (ICSID Case No. ${c.caseNumber})`
}

function buildBody(c: NormalizedCase): string {
  const d = c.detail
  const parts: string[] = []
  parts.push(`ICSID investment-arbitration case ${c.caseNumber}: ${c.claimant} v. ${c.respondent}.`)
  if (d?.subject) parts.push(`Subject of dispute: ${d.subject}.`)
  if (d?.econSector) parts.push(`Economic sector: ${d.econSector}.`)
  if (d?.instrument) parts.push(`Instrument(s) invoked: ${d.instrument}.`)
  if (d?.applicableRules) parts.push(`Applicable rules: ${d.applicableRules}.`)
  if (d?.claimantNationality) parts.push(`Claimant(s)/nationality: ${d.claimantNationality}.`)
  if (c.filingDateRaw) parts.push(`Registered: ${c.filingDateRaw.split(' ')[0]}.`)
  parts.push(`Status: ${c.status || 'unknown'}.`)
  if (d?.outcomeText) {
    const datePrefix = d.outcomeDate ? `${d.outcomeDate} — ` : ''
    parts.push(`Outcome: ${datePrefix}${d.outcomeText}`)
  }
  return parts.join(' ')
}

// ── Write one entry ───────────────────────────────────────────────────────

type WriteResult = 'ingested' | 'updated' | 'skipped' | 'failed'

async function writeEntry(
  c: NormalizedCase,
  topicId: string,
  skipExisting: boolean,
): Promise<WriteResult> {
  if (skipExisting) {
    const exists = await prisma.claim.findUnique({
      where: { externalId: c.externalId }, select: { id: true },
    })
    if (exists) return 'skipped'
  }

  const existing = await prisma.claim.findUnique({
    where: { externalId: c.externalId }, select: { id: true },
  })
  const isUpdate = !!existing

  const title = buildTitle(c)
  const body  = buildBody(c)
  const claimText = `${title} — ${body}`

  const metadata = {
    dataset: PIPELINE,
    title,
    body,
    caseNumber: c.caseNumber,
    claimant: c.claimant,
    respondent: c.respondent,
    respondentState: c.respondentPrimaryName,
    alpha3: c.alpha3 ?? undefined,
    status: c.status,
    outcome: c.detail?.outcomeText ?? undefined,
    outcomeDate: c.detail?.outcomeDate ?? undefined,
    awardAmount: undefined as string | undefined, // not published in ICSID metadata
    filingDate: c.filingDate ? c.filingDate.toISOString().slice(0, 10) : undefined,
    closingDate: c.closingDate ? c.closingDate.toISOString().slice(0, 10) : undefined,
    subject: c.detail?.subject ?? undefined,
    economicSector: c.detail?.econSector ?? undefined,
    instrument: c.detail?.instrument ?? undefined,
    applicableRules: c.detail?.applicableRules ?? undefined,
    claimantNationality: c.detail?.claimantNationality ?? undefined,
    respondentNationality: c.detail?.respondentNationality ?? undefined,
    proceedingTimeline: c.detail?.proceedingTimeline?.length ? c.detail.proceedingTimeline : undefined,
    sourceUrl: c.sourceUrl,
    tags: ['icsid', 'investment-arbitration', 'world-bank', c.alpha3 ?? 'unknown-country'],
  }

  const polityId = c.alpha3 ? await findPolityId(c.alpha3) : null

  await prisma.$transaction(async tx => {
    const source = await tx.source.upsert({
      where: { externalId: c.externalId },
      update: {
        name: `ICSID — ${c.caseNumber}`,
        url: c.sourceUrl,
        publishedAt: c.filingDate ?? undefined,
      },
      create: {
        externalId: c.externalId,
        name: `ICSID — ${c.caseNumber}`,
        url: c.sourceUrl,
        publishedAt: c.filingDate ?? undefined,
        methodologyType: 'primary',
        ingestedBy: PIPELINE,
        humanReviewed: false,
        autoApproved: true,
      },
    })

    const claim = await tx.claim.upsert({
      where: { externalId: c.externalId },
      update: {
        text: claimText,
        metadata,
        claimEmergedAt: c.filingDate ?? undefined,
        claimEmergedPrecision: c.filingDate ? 'DAY' : undefined,
      },
      create: {
        externalId: c.externalId,
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: c.filingDate ?? undefined,
        claimEmergedPrecision: c.filingDate ? 'DAY' : undefined,
        ingestedBy: PIPELINE,
        humanReviewed: false,
        autoApproved: true,
        metadata,
      },
    })

    const edgeExists = await tx.edge.findFirst({
      where: { claimId: claim.id, sourceId: source.id, type: 'FOR' },
      select: { id: true },
    })
    if (!edgeExists) {
      await tx.edge.create({
        data: {
          claimId: claim.id,
          sourceId: source.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: PIPELINE,
          humanReviewed: false,
          autoApproved: true,
        },
      })
    }

    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })

    if (polityId) {
      await tx.polityClaim.upsert({
        where: { polityId_claimId: { polityId, claimId: claim.id } },
        update: {},
        create: { polityId, claimId: claim.id, matchMethod: 'auto_country_respondent' },
      })
    }
  }, { timeout: TX_TIMEOUT })

  return isUpdate ? 'updated' : 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs()

  console.log('\n=== ICSID arbitration ingestion ===')
  console.log(`  Pipeline     : ${PIPELINE}`)
  console.log(`  Mode         : ${args.dryRun ? 'dry-run' : 'live'}`)
  console.log(`  Limit        : ${args.limit}`)
  if (args.skipExisting) console.log(`  Skip-existing: yes`)
  if (args.noDetail)     console.log(`  Detail fetch : disabled`)

  console.log('\nFetching case list...')
  const allCases = await fetchList()

  // Sort newest first by dateregistered so the limit captures the most recent
  const sortable = allCases.slice().sort((a, b) => {
    const da = parseSlashDate(a.caseproceedings?.[0]?.dateregistered ?? '')
    const db = parseSlashDate(b.caseproceedings?.[0]?.dateregistered ?? '')
    return (db?.getTime() ?? 0) - (da?.getTime() ?? 0)
  })
  const batch = sortable.slice(0, args.limit)
  console.log(`  Processing ${batch.length} of ${allCases.length} cases (newest first)`)

  // Fetch details (rate-limited)
  const enriched: NormalizedCase[] = []
  if (args.noDetail) {
    for (const r of batch) enriched.push(normalize(r, null))
  } else {
    console.log(`\nFetching per-case detail HTML (rate: ~${Math.round(1000 / DETAIL_DELAY)} req/sec) ...`)
    let detailFetched = 0
    let detailFailed = 0
    for (let i = 0; i < batch.length; i++) {
      const r = batch[i]
      const url = `${DETAIL_URL}${encodeURIComponent(r.caseno).replace(/%2F/g, '/')}`
      const html = await fetchText(url)
      let detail: DetailExtras | null = null
      if (html) {
        try { detail = parseDetail(html); detailFetched++ }
        catch { detailFailed++ }
      } else {
        detailFailed++
      }
      enriched.push(normalize(r, detail))
      if ((i + 1) % 50 === 0) {
        console.log(`  Detail progress: ${i + 1}/${batch.length} (ok=${detailFetched} fail=${detailFailed})`)
      }
      await sleep(DETAIL_DELAY)
    }
    console.log(`  Detail done: ok=${detailFetched} fail=${detailFailed}`)
  }

  if (args.dryRun) {
    console.log('\n── Sample (first 5) ──')
    for (const c of enriched.slice(0, 5)) {
      console.log(`  [${c.caseNumber}] ${c.claimant} v. ${c.respondentPrimaryName}`)
      console.log(`      alpha3      : ${c.alpha3 ?? 'n/a'}`)
      console.log(`      status      : ${c.status}`)
      console.log(`      filing      : ${c.filingDate?.toISOString().slice(0, 10) ?? '—'}`)
      console.log(`      closing     : ${c.closingDate?.toISOString().slice(0, 10) ?? '—'}`)
      if (c.detail?.subject) console.log(`      subject     : ${c.detail.subject.slice(0, 80)}`)
      if (c.detail?.econSector) console.log(`      sector      : ${c.detail.econSector}`)
      if (c.detail?.outcomeText) console.log(`      outcome     : ${c.detail.outcomeText.slice(0, 80)}`)
      console.log(`      title       : ${buildTitle(c).slice(0, 110)}`)
    }
    const withCountry = enriched.filter(e => e.alpha3 !== null).length
    const withDetail  = enriched.filter(e => e.detail !== null).length
    const unresolved  = enriched.filter(e => e.alpha3 === null)
    console.log(`\n  Country resolved : ${withCountry}/${enriched.length} (${Math.round(100 * withCountry / Math.max(1, enriched.length))}%)`)
    console.log(`  Detail HTML parsed: ${withDetail}/${enriched.length}`)
    if (unresolved.length) {
      const distinct = Array.from(new Set(unresolved.map(u => u.respondentPrimaryName))).slice(0, 15)
      console.log(`  Unresolved respondents (top 15 distinct): ${distinct.join(' | ')}`)
    }
    console.log('\nDry-run complete — no DB writes')
    await prisma.$disconnect()
    return
  }

  // Live run guard
  if (!process.env.ALLOW_EDITS && args.limit >= 5000) {
    console.error('\nERROR: Large run requires ALLOW_EDITS=true in environment.')
    await prisma.$disconnect()
    process.exit(1)
  }

  // Ensure parent topic + investment-arbitration child
  await ensureTopic('international-law', 'International Law', 'government')
  const topicId = await ensureTopic(
    'investment-arbitration', 'Investment Arbitration', 'government', 'international-law',
  )

  let ingested = 0, updated = 0, skipped = 0, failed = 0
  const errors: string[] = []
  let sampleText: string | null = null

  for (let i = 0; i < enriched.length; i++) {
    const c = enriched[i]
    try {
      const result = await writeEntry(c, topicId, args.skipExisting)
      if (result === 'ingested') {
        ingested++
        if (!sampleText) sampleText = buildTitle(c).slice(0, 120)
      } else if (result === 'updated') updated++
      else if (result === 'skipped') skipped++
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      const line = `  [${c.caseNumber}] ${c.respondentPrimaryName}: ${msg}`
      errors.push(line)
      if (errors.length <= 5) console.error(line)
    }
    if ((i + 1) % 100 === 0) {
      console.log(`  Progress: ${i + 1}/${enriched.length} (ingested=${ingested} updated=${updated} skipped=${skipped} failed=${failed})`)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`  Ingested : ${ingested}`)
  console.log(`  Updated  : ${updated}`)
  console.log(`  Skipped  : ${skipped}`)
  console.log(`  Failed   : ${failed}`)
  if (sampleText) console.log(`  Sample   : "${sampleText}..."`)

  const dbCount = await prisma.claim.count({
    where: { ingestedBy: PIPELINE, deleted: false },
  })
  console.log(`\n  DB count (${PIPELINE}): ${dbCount} claims`)

  const logLines = [
    `ICSID pipeline complete — ${new Date().toISOString()}`,
    `  Ingested: ${ingested} | Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed}`,
    `  DB count: ${dbCount} claims`,
    ...(sampleText ? [`  Sample: "${sampleText}..."`] : []),
    ...(errors.length > 0 ? [`  First errors: ${errors.slice(0, 3).join(' | ')}`] : []),
  ]
  fs.writeFileSync(LOG_PATH, logLines.join('\n') + '\n')
  console.log(`\n  Log written to ${LOG_PATH}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('Fatal error:', msg)
  fs.writeFileSync(LOG_PATH, `ICSID pipeline FAILED: ${msg}\n`)
  await prisma.$disconnect()
  process.exit(1)
})
