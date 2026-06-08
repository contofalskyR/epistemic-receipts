// Pipeline: ICC Cases — indictments, trials, and judgments
// Dataset: ICC official case pages (icc-cpi.int) via Wayback Machine fallback
// Pipeline tag: icc_cases_v1
// Source type: primary (official court decisions)
// Claim type: INSTITUTIONAL
//
// icc-cpi.int is behind Cloudflare and blocks automated requests.
// The script tries the live URL first; if blocked it falls back to the
// Wayback Machine via the archive.org/wayback/available API.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-icc-cases.ts --dry-run
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-icc-cases.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as http from 'http'

const prisma = new PrismaClient()

const INGESTED_BY = 'icc_cases_v1'
const ICC_BASE   = 'https://www.icc-cpi.int'
const WAYBACK_AVAIL = 'https://archive.org/wayback/available'
const THROTTLE_MS = 1200
const DRY_RUN_LIMIT = 5

// ── Curated case list ──────────────────────────────────────────────────────────
// All slugs verified to have Wayback Machine snapshots during probing (2026-06-07).
// Each entry traces to a canonical ICC case page: ICC_BASE/{slug}

interface CaseEntry {
  slug: string       // e.g. 'drc/lubanga'
  situation: string  // human-readable situation name
}

const CASE_SLUGS: CaseEntry[] = [
  // DRC — Democratic Republic of the Congo
  { slug: 'drc/lubanga',       situation: 'Democratic Republic of the Congo' },
  { slug: 'drc/katanga',       situation: 'Democratic Republic of the Congo' },
  { slug: 'drc/ntaganda',      situation: 'Democratic Republic of the Congo' },
  { slug: 'drc/ngudjolo',      situation: 'Democratic Republic of the Congo' },
  { slug: 'drc/mbarushimana',  situation: 'Democratic Republic of the Congo' },
  { slug: 'drc/mudacumura',    situation: 'Democratic Republic of the Congo' },
  // Uganda
  { slug: 'uganda/kony',   situation: 'Uganda' },
  { slug: 'uganda/ongwen', situation: 'Uganda' },
  // Darfur, Sudan
  { slug: 'darfur/abd-al-rahman', situation: 'Darfur, Sudan' },
  { slug: 'darfur/abugarda',      situation: 'Darfur, Sudan' },
  { slug: 'darfur/albashir',      situation: 'Darfur, Sudan' },
  { slug: 'darfur/banda',         situation: 'Darfur, Sudan' },
  { slug: 'darfur/harun',         situation: 'Darfur, Sudan' },
  { slug: 'darfur/hussein',       situation: 'Darfur, Sudan' },
  // Kenya
  { slug: 'kenya/kenyatta', situation: 'Kenya' },
  { slug: 'kenya/barasa',   situation: 'Kenya' },
  { slug: 'kenya/bett',     situation: 'Kenya' },
  { slug: 'kenya/gicheru',  situation: 'Kenya' },
  // Libya
  { slug: 'libya/gaddafi',    situation: 'Libya' },
  { slug: 'libya/al-werfalli', situation: 'Libya' },
  { slug: 'libya/khaled',     situation: 'Libya' },
  // Central African Republic
  { slug: 'car/bemba',      situation: 'Central African Republic' },
  { slug: 'car/bemba-et-al', situation: 'Central African Republic' },
  // Mali
  { slug: 'mali/al-mahdi',  situation: 'Mali' },
  { slug: 'mali/al-hassan', situation: 'Mali' },
  { slug: 'mali/ghaly',     situation: 'Mali' },
  // Republic of the Philippines
  { slug: 'Philippines/duterte', situation: 'Republic of the Philippines' },
]

// ── Parsed case types ─────────────────────────────────────────────────────────

interface ParsedDefendant {
  name: string
  status: string    // e.g. 'Convicted', 'At large', 'Case closed', 'Acquitted'
  charges: string
  description: string
}

interface ParsedCase {
  slug: string
  situation: string
  canonicalUrl: string
  fetchedFromUrl: string
  caseTitle: string       // "The Prosecutor v. ..."
  caseNumber: string      // "ICC-01/04-01/06"
  casePhase: string       // "Trial" | "Reparation/Compensation" | "Closed" etc.
  defendants: ParsedDefendant[]
}

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const isLive   = !isDryRun

  if (isLive && process.env.ALLOW_EDITS !== 'true') {
    console.error('Live run requires ALLOW_EDITS=true. Use --dry-run or set ALLOW_EDITS=true.')
    process.exit(1)
  }

  const li = args.indexOf('--limit')
  const limit = li !== -1 ? parseInt(args[li + 1] ?? '0', 10) : 0

  return { isDryRun, limit, verbose: args.includes('--verbose') }
}

// ── HTTP utilities ────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

let lastRequestAt = 0
async function throttle() {
  const wait = THROTTLE_MS - (Date.now() - lastRequestAt)
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
}

function getUrl(url: string, timeoutMs = 30000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0; research pipeline)',
        'Accept': 'text/html,application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }
    const req = lib.get(options, res => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${parsed.protocol}//${parsed.host}${res.headers.location}`
        res.resume()
        resolve(getUrl(redirectUrl, timeoutMs))
        return
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { body += chunk })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)) })
  })
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const { status, body } = await getUrl(url)
    if (status === 403 || status === 429 || body.includes('Cloudflare')) return null
    if (status < 200 || status >= 300) return null
    return body
  } catch {
    return null
  }
}

async function getWaybackUrl(iccUrl: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(iccUrl)
    const { body } = await getUrl(`${WAYBACK_AVAIL}?url=${encoded}`)
    const data = JSON.parse(body)
    const snap = data?.archived_snapshots?.closest
    return (snap?.available && snap?.url) ? snap.url as string : null
  } catch {
    return null
  }
}

// ── Page fetcher: live → Wayback fallback ─────────────────────────────────────

async function fetchCasePage(slug: string): Promise<{ html: string; url: string } | null> {
  const canonicalUrl = `${ICC_BASE}/${slug}`

  // 1. Try live ICC page
  await throttle()
  const liveHtml = await fetchHtml(canonicalUrl)
  if (liveHtml && liveHtml.length > 5000 && liveHtml.includes('icc-cpi.int')) {
    return { html: liveHtml, url: canonicalUrl }
  }

  // 2. Fall back to Wayback Machine
  await throttle()
  const waybackUrl = await getWaybackUrl(canonicalUrl)
  if (!waybackUrl) return null

  await throttle()
  const waybackHtml = await fetchHtml(waybackUrl)
  if (waybackHtml && waybackHtml.length > 5000) {
    return { html: waybackHtml, url: waybackUrl }
  }

  return null
}

// ── HTML parser ───────────────────────────────────────────────────────────────

function stripHtml(s: string): string {
  return s
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ').trim()
}

function extractBetween(html: string, startPattern: RegExp, endPattern: RegExp): string | null {
  const start = html.search(startPattern)
  if (start === -1) return null
  const sub = html.slice(start)
  const end = sub.search(endPattern)
  return end === -1 ? sub : sub.slice(0, end)
}

function parseDefendants(html: string): ParsedDefendant[] {
  const defendants: ParsedDefendant[] = []

  // Find all defendant blocks — each is a views_slideshow_cycle_div item
  // Pattern: defState > name > description > charges within each slide
  const slideBlocks = html.split(/views_slideshow_cycle_div_/)
  const blocks = slideBlocks.length > 1 ? slideBlocks.slice(1) : [html]

  for (const block of blocks) {
    // Name
    const nameM = block.match(/aboutDefendant[\s\S]*?<h4>\s*([^<]+?)\s*<\/h4>/)
    const name = nameM ? nameM[1].trim() : null
    if (!name) continue

    // Status
    const statusM = block.match(/defState[^>]*>\s*([^<\n]+?)\s*<\/div>/)
    const status = statusM ? statusM[1].trim() : 'Unknown'

    // Description (role/title)
    const descM = block.match(/descriptionDesignation[\s\S]*?<p>\s*<p>([\s\S]*?)<\/p>/)
    const description = descM ? stripHtml(descM[1]).slice(0, 400) : ''

    // Charges
    const chargesM = block.match(/defendant_charges[\s\S]*?<p>\s*<p>([\s\S]*?)<\/p>/)
    const charges = chargesM ? stripHtml(chargesM[1]).slice(0, 500) : ''

    defendants.push({ name, status, description, charges })
  }

  // Fallback: try single-defendant pattern if slideshow not found
  if (defendants.length === 0) {
    const nameM = html.match(/<h4>\s*([^<]+?)\s*<\/h4>/)
    const statusM = html.match(/defState[^>]*>\s*([^<\n]+?)\s*<\/div>/)
    const chargesM = html.match(/defendant_charges[\s\S]*?<p>\s*<p>([\s\S]*?)<\/p>/)
    const descM = html.match(/descriptionDesignation[\s\S]*?<p>\s*<p>([\s\S]*?)<\/p>/)

    if (nameM) {
      defendants.push({
        name: nameM[1].trim(),
        status: statusM ? statusM[1].trim() : 'Unknown',
        description: descM ? stripHtml(descM[1]).slice(0, 400) : '',
        charges: chargesM ? stripHtml(chargesM[1]).slice(0, 500) : '',
      })
    }
  }

  return defendants
}

function parseCasePage(html: string, slug: string, situation: string, fetchedFromUrl: string): ParsedCase | null {
  const canonicalUrl = `${ICC_BASE}/${slug}`

  // Case title (The Prosecutor v. ...)
  const titleM = html.match(/body_copy[\s\S]*?<p>(The Prosecutor v\.[^<]+)<\/p>/)
    || html.match(/The Prosecutor v\.\s*([^\n<]+)/)
  const caseTitle = titleM
    ? (titleM[0].includes('body_copy') ? titleM[1] : `The Prosecutor v. ${titleM[1]}`).trim()
    : `ICC Case: ${slug}`

  // Case number
  const caseNoM = html.match(/ICC-\d{2}\/\d{2}(?:-\d+\/\d+-\d+)?/)
  const caseNumber = caseNoM ? caseNoM[0] : ''

  // Case phase
  const phaseM = html.match(/ICCCasePhase[\s\S]*?<a[^>]*>([^<]+)<\/a>/)
    || html.match(/ICCCasePhase[\s\S]*?<h2>([^<]+)<\/h2>/)
  const casePhase = phaseM ? phaseM[1].trim() : ''

  const defendants = parseDefendants(html)
  if (defendants.length === 0) return null

  return { slug, situation, canonicalUrl, fetchedFromUrl, caseTitle, caseNumber, casePhase, defendants }
}

// ── Claim text builder ────────────────────────────────────────────────────────

function buildClaimText(defendant: ParsedDefendant, situation: string, casePhase: string): string {
  const name = defendant.name
  const status = defendant.status.toLowerCase()
  const charges = defendant.charges
    .replace(/^Charges?:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  let action = 'indicted'
  if (status.includes('convicted')) action = 'convicted'
  else if (status.includes('acquitted')) action = 'acquitted'
  else if (status.includes('closed')) action = 'charged'
  else if (status.includes('custody')) action = 'indicted'
  else if (status.includes('large')) action = 'indicted'

  // Clean charges text: strip verdict prefix and "allegedly" preamble
  const cleanedCharges = charges
    .replace(/^Charges?:\s*/i, '')
    .replace(/^Found guilty,?\s+(?:on\s+[\w\s,]+\d{4},?\s+)?(?:of\s+the\s+)?/i, '')
    .replace(/^Allegedly\s+responsible\s+for\s+(?:the\s+)?/i, '')
    .replace(/^The\s+accused\s+(?:is\s+)?(?:alleged\s+to\s+be\s+)?(?:responsible\s+for\s+)?/i, '')
    .trim()

  // Extract year from charges or description
  const yearM = (charges + ' ' + defendant.description).match(/\b(200[0-9]|201[0-9]|202[0-9]|199[0-9])\b/)
  const yearNote = yearM ? yearM[0] : ''

  // Shorten charges to first sentence or 200 chars
  const chargesSummary = cleanedCharges.split(/\.\s+/)[0].slice(0, 200)

  const yearSuffix = yearNote ? `, ${yearNote}` : ''
  return `${name} ${action} by ICC for ${chargesSummary || defendant.description.slice(0, 200) || 'international crimes'} (${situation}${yearSuffix})`
}

// ── DB types ──────────────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// ── Topic upsert ──────────────────────────────────────────────────────────────

async function upsertTopics(tx: TxClient): Promise<{ rootId: string; iccId: string }> {
  // "international-law" under root; "icc-cases" under international-law
  let root = await tx.topic.findFirst({ where: { slug: 'international-law' } })
  if (!root) {
    root = await tx.topic.create({ data: { name: 'International Law', slug: 'international-law', domain: 'law' } })
  }

  let iccTopic = await tx.topic.findFirst({ where: { slug: 'icc-cases' } })
  if (!iccTopic) {
    iccTopic = await tx.topic.create({
      data: { name: 'ICC Cases', slug: 'icc-cases', domain: 'law', parentTopicId: root.id },
    })
  }

  return { rootId: root.id, iccId: iccTopic.id }
}

// ── Writer ────────────────────────────────────────────────────────────────────

interface WriteResult { created: number; skipped: number }

async function writeDefendant(
  tx: TxClient,
  defendant: ParsedDefendant,
  parsed: ParsedCase,
  topicId: string,
  dryRun: boolean,
): Promise<{ created: boolean }> {
  const claimText = buildClaimText(defendant, parsed.situation, parsed.casePhase)
  // externalId encodes case number + defendant slug for uniqueness
  const externalId = `icc_${parsed.caseNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${defendant.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)}`

  if (dryRun) {
    console.log(`  [DRY] ${defendant.name} | ${defendant.status} | ${claimText.slice(0, 120)}...`)
    return { created: false }
  }

  const existingSource = await tx.source.findUnique({ where: { externalId } })
  if (existingSource) return { created: false }

  // Create source, claim, edge, edge revision in one transaction batch
  const source = await tx.source.create({
    data: {
      name: `ICC – ${parsed.caseTitle}`,
      url: parsed.canonicalUrl,
      publishedAt: null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      externalId,
      autoApproved: true,
    },
  })

  const claimEmergedAt = (() => {
    // Try to find a year in charges or description
    const yearM = (defendant.charges + ' ' + defendant.description).match(/\b(19|20)\d{2}\b/)
    if (yearM) return new Date(`${yearM[0]}-01-01T00:00:00Z`)
    return null
  })()

  const claim = await tx.claim.create({
    data: {
      text: claimText,
      currentStatus: 'HARD_FACT',
      claimType: 'INSTITUTIONAL',
      claimEmergedAt,
      claimEmergedPrecision: claimEmergedAt ? 'YEAR' : null,
      ingestedBy: INGESTED_BY,
      autoApproved: true,
      verificationStatus: 'PROVISIONAL',
      metadata: {
        pipeline: INGESTED_BY,
        situation: parsed.situation,
        caseNumber: parsed.caseNumber,
        casePhase: parsed.casePhase,
        defendantName: defendant.name,
        defendantStatus: defendant.status,
        charges: defendant.charges,
        description: defendant.description,
        sourceUrl: parsed.fetchedFromUrl,
        canonicalUrl: parsed.canonicalUrl,
      },
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId: source.id,
      claimId: claim.id,
      type: 'FOR',
      evidenceType: 'PROCEDURAL',
      ingestedBy: INGESTED_BY,
      autoApproved: true,
    },
  })

  await tx.edgeRevision.create({
    data: {
      edgeId: edge.id,
      priorScore: null,
      newScore: 90,
      reason: 'ICC official case page — institutional primary source',
    },
  })

  await tx.claimTopic.upsert({
    where: { claimId_topicId: { claimId: claim.id, topicId } },
    create: { claimId: claim.id, topicId },
    update: {},
  })

  return { created: true }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { isDryRun, limit, verbose } = parseArgs()
  const mode = isDryRun ? 'DRY-RUN' : 'LIVE'

  console.log(`\n[icc_cases_v1] ${mode} — ICC Cases pipeline`)
  console.log(`Cases in curated list: ${CASE_SLUGS.length}`)
  if (limit > 0) console.log(`Limit: ${limit} cases`)
  if (isDryRun) console.log(`(dry-run: will print first ${DRY_RUN_LIMIT} defendants, no DB writes)`)
  console.log()

  const toProcess = limit > 0 ? CASE_SLUGS.slice(0, limit) : CASE_SLUGS
  let totalCreated = 0
  let totalSkipped = 0
  let totalFailed = 0
  let dryRunCount = 0

  // Upsert topics once (live only)
  let iccTopicId = ''
  if (!isDryRun) {
    const topics = await prisma.$transaction(tx => upsertTopics(tx as unknown as TxClient))
    iccTopicId = topics.iccId
    console.log(`Topics upserted (icc-cases: ${iccTopicId})`)
  }

  for (const entry of toProcess) {
    if (isDryRun && dryRunCount >= DRY_RUN_LIMIT) break

    console.log(`\nFetching: ${entry.slug}`)
    const result = await fetchCasePage(entry.slug)

    if (!result) {
      console.warn(`  ❌ Could not fetch (live or Wayback) — skipping`)
      totalFailed++
      continue
    }

    if (verbose) console.log(`  Fetched from: ${result.url.slice(0, 80)}...`)

    const parsed = parseCasePage(result.html, entry.slug, entry.situation, result.url)
    if (!parsed) {
      console.warn(`  ❌ Could not parse defendants — skipping`)
      totalFailed++
      continue
    }

    console.log(`  Case: ${parsed.caseTitle} [${parsed.caseNumber}] phase=${parsed.casePhase}`)
    console.log(`  Defendants: ${parsed.defendants.map(d => d.name).join(', ')}`)

    if (isDryRun) {
      for (const def of parsed.defendants) {
        if (dryRunCount >= DRY_RUN_LIMIT) break
        const claimText = buildClaimText(def, parsed.situation, parsed.casePhase)
        console.log(`  [DRY] ${def.name} | ${def.status}`)
        console.log(`        ${claimText.slice(0, 140)}`)
        dryRunCount++
      }
      continue
    }

    // Live write
    const writeResults = await prisma.$transaction(async tx => {
      const results: boolean[] = []
      for (const def of parsed.defendants) {
        const r = await writeDefendant(tx as unknown as TxClient, def, parsed, iccTopicId, false)
        results.push(r.created)
      }
      return results
    }, { timeout: 30000 })

    const created = writeResults.filter(Boolean).length
    const skipped = writeResults.length - created
    totalCreated += created
    totalSkipped += skipped
    console.log(`  ✅ ${created} created, ${skipped} skipped (already exists)`)
  }

  console.log('\n── Summary ──────────────────────────────────────────────')
  if (isDryRun) {
    console.log(`Dry-run complete. Would process ${toProcess.length} case pages.`)
    console.log(`(preview limited to ${DRY_RUN_LIMIT} defendants)`)
  } else {
    console.log(`Created: ${totalCreated} claims/sources/edges`)
    console.log(`Skipped: ${totalSkipped} (already ingested)`)
    console.log(`Failed:  ${totalFailed} (fetch or parse error)`)
    console.log(`Total processed: ${toProcess.length - totalFailed} / ${toProcess.length} cases`)

    // Post-run count verification (Rule 6)
    const dbCount = await prisma.claim.count({
      where: { ingestedBy: INGESTED_BY, deleted: false },
    })
    console.log(`\nDB verification: ${dbCount} total claims with ingestedBy='${INGESTED_BY}'`)
  }
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
