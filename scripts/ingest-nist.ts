// NIST physical & chemical reference data ingestion
//   - nist_constants_v1  → 2022 CODATA recommended values (~350 entries)
//                          Source: https://physics.nist.gov/cuu/Constants/Table/allascii.txt
//   - nist_webbook_v1    → curated common elements/compounds via NIST Chemistry WebBook
//                          Source: https://webbook.nist.gov/cgi/cbook.cgi?ID={CAS}&Units=SI
//
// Both sources are free, no API key. Patterns lifted from ingest-openfda.ts (Source/Claim/
// Edge/EdgeRevision in a single transaction) and ingest-pubchem.ts (topic management).
//
// Run:
//   npx tsx scripts/ingest-nist.ts --section constants --dry-run
//   npx tsx scripts/ingest-nist.ts --section constants --limit 50
//   npx tsx scripts/ingest-nist.ts --section webbook   --dry-run
//   npx tsx scripts/ingest-nist.ts --section all       --limit 0   (full)

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CONSTANTS_URL = 'https://physics.nist.gov/cuu/Constants/Table/allascii.txt'
const CONSTANTS_PAGE_URL = 'https://physics.nist.gov/cuu/Constants/index.html'
const WEBBOOK_URL = (id: string) =>
  `https://webbook.nist.gov/cgi/cbook.cgi?ID=${encodeURIComponent(id)}&Units=SI`

// 2022 CODATA adjustment was published 2024-05-20; the file at allascii.txt is
// that snapshot. Use it as publishedAt and as claimEmergedAt with YEAR precision
// for "the year these recommended values were determined" (2022).
const CODATA_YEAR = 2022
const CODATA_PUBLISHED_AT = new Date('2024-05-20T00:00:00Z')

// ── Types ────────────────────────────────────────────────────────────────────

interface NistConstant {
  quantity: string
  value: string
  uncertainty: string
  unit: string
}

interface CompoundDef {
  name: string
  cas: string
}

interface CompoundData {
  formula: string
  molecularWeight: string | null
  iupacName: string | null
}

type IngestResult = 'ingested' | 'skipped' | 'failed'

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(): { section: 'constants' | 'webbook' | 'all'; dryRun: boolean; limit: number } {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : undefined
  }
  const sectionRaw = get('--section') ?? 'constants'
  if (sectionRaw !== 'constants' && sectionRaw !== 'webbook' && sectionRaw !== 'all') {
    throw new Error(`Unknown --section value: ${sectionRaw}. Use constants | webbook | all`)
  }
  const limitStr = get('--limit')
  const limit = limitStr ? parseInt(limitStr, 10) : 0
  return {
    section: sectionRaw,
    dryRun: args.includes('--dry-run'),
    limit: Number.isFinite(limit) && limit > 0 ? limit : 0,
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 350 // ~3 req/sec — well below NIST's tolerance

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function throttle(): Promise<void> {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function fetchText(url: string, retries = 3): Promise<string> {
  let delay = 1000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, { headers: { 'User-Agent': 'epistemic-receipts/1.0 (research)' } })
    if (res.ok) return await res.text()
    if ([502, 503, 504, 429].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms (${url})`)
      await sleep(delay)
      delay *= 2
      continue
    }
    throw new Error(`Fetch failed: ${res.status} ${res.statusText} — ${url}`)
  }
  throw new Error(`Exhausted retries: ${url}`)
}

// ── Constants parser ─────────────────────────────────────────────────────────
//
// The allascii.txt file uses a fixed-column layout. Numeric fields contain
// internal spaces for digit grouping ("6.644 657 3450 e-27"), so naive
// whitespace splitting won't work. Columns observed in the live file
// (2022 CODATA adjustment, fetched 2026-05-21):
//   [0,   60)  Quantity
//   [60,  85)  Value
//   [85,  110) Uncertainty
//   [110, …)   Unit
// A dashes separator line precedes the data rows; the column header line
// is detected dynamically so a future column-width shift surfaces clearly.

const COL_VALUE = 60
const COL_UNCERTAINTY = 85
const COL_UNIT = 110

function parseConstants(raw: string): NistConstant[] {
  const lines = raw.split(/\r?\n/)
  const dashIdx = lines.findIndex(l => /^-{10,}\s*$/.test(l))
  if (dashIdx === -1) {
    throw new Error('Could not locate dashes separator line in NIST constants file')
  }
  const headerLine = lines[dashIdx - 1] ?? ''
  if (!/Quantity/i.test(headerLine) || !/Value/i.test(headerLine) ||
      !/Uncertainty/i.test(headerLine) || !/Unit/i.test(headerLine)) {
    throw new Error(`Expected "Quantity … Value … Uncertainty … Unit" header, got: ${headerLine}`)
  }

  const constants: NistConstant[] = []
  for (let i = dashIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || !line.trim()) continue
    if (line.length < COL_VALUE + 2) continue // line too short to carry a numeric field

    const quantity = line.slice(0, COL_VALUE).trim()
    const value = line.slice(COL_VALUE, COL_UNCERTAINTY).trim()
    const uncertainty = line.slice(COL_UNCERTAINTY, COL_UNIT).trim()
    const unit = line.slice(COL_UNIT).trim()

    if (!quantity || !value) continue
    constants.push({ quantity, value, uncertainty, unit })
  }
  return constants
}

function slugifyQuantity(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function constantClaimText(c: NistConstant): string {
  const unit = c.unit ? ` ${c.unit}` : ''
  const unc = c.uncertainty
    ? ` (uncertainty: ${c.uncertainty}${c.unit ? ` ${c.unit}` : ''})`
    : ' (exact, no uncertainty)'
  return `${c.quantity}: ${c.value}${unit}${unc}`
}

// ── Topic management ─────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string,
  name: string,
  domain: string,
  parentSlug?: string,
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
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

async function tagClaim(claimId: string, topicIds: string[]): Promise<void> {
  for (const topicId of topicIds) {
    await prisma.claimTopic.upsert({
      where: { claimId_topicId: { claimId, topicId } },
      update: {},
      create: { claimId, topicId },
    })
  }
}

// ── Ingest one constant ──────────────────────────────────────────────────────

async function ingestConstant(
  c: NistConstant,
  topicId: string,
  dryRun: boolean,
): Promise<IngestResult> {
  const slug = slugifyQuantity(c.quantity)
  if (!slug) return 'skipped'
  const externalId = `nist_const_${slug}`

  const existing = await prisma.claim.findUnique({ where: { externalId } })
  if (existing) {
    console.log(`  Skipped (exists): ${c.quantity}`)
    return 'skipped'
  }

  const claimText = constantClaimText(c)
  const sourceName = `NIST CODATA ${CODATA_YEAR} — ${c.quantity}`

  if (dryRun) {
    console.log(`  [dry-run] ${c.quantity} = ${c.value}${c.unit ? ' ' + c.unit : ''}`)
    return 'ingested'
  }

  try {
    await prisma.$transaction(
      async tx => {
        const source = await tx.source.create({
          data: {
            name: sourceName,
            url: CONSTANTS_PAGE_URL,
            publishedAt: CODATA_PUBLISHED_AT,
            methodologyType: 'primary',
            ingestedBy: 'nist_constants_v1',
            humanReviewed: false,
            autoApproved: true,
            externalId: `nist_const_source_${slug}`,
          },
        })

        const claim = await tx.claim.create({
          data: {
            text: claimText,
            claimType: 'EMPIRICAL',
            currentStatus: 'HARD_FACT',
            verificationStatus: 'VERIFIED',
            claimEmergedAt: new Date(Date.UTC(CODATA_YEAR, 0, 1)),
            claimEmergedPrecision: 'YEAR',
            ingestedBy: 'nist_constants_v1',
            humanReviewed: false,
            autoApproved: true,
            externalId,
            metadata: {
              dataset: 'nist_constants_v1',
              codataYear: CODATA_YEAR,
              quantity: c.quantity,
              value: c.value,
              uncertainty: c.uncertainty || null,
              unit: c.unit || null,
              category: 'PHYSICS',
            },
          },
        })

        const edge = await tx.edge.create({
          data: {
            sourceId: source.id,
            claimId: claim.id,
            type: 'FOR',
            evidenceType: 'EVIDENTIARY',
            ingestedBy: 'nist_constants_v1',
            humanReviewed: false,
            autoApproved: true,
          },
        })

        // strength 1.0 → newScore 100 (per task brief)
        await tx.edgeRevision.create({
          data: {
            edgeId: edge.id,
            priorScore: null,
            newScore: 100,
            reason: 'NIST CODATA recommended value — physical constant as HARD_FACT',
            changedAt: CODATA_PUBLISHED_AT,
          },
        })
      },
      { timeout: 30000 },
    )

    const created = await prisma.claim.findUnique({ where: { externalId } })
    if (created) await tagClaim(created.id, [topicId])
    console.log(`  Ingested: ${c.quantity}`)
    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: ${c.quantity} — ${msg}`)
    return 'failed'
  }
}

// ── WebBook parsing ──────────────────────────────────────────────────────────
//
// WebBook serves HTML; the &JSON query flag from the task brief is not part of
// the documented API and is silently ignored by the live endpoint. Parse the
// two reliable HTML markers instead:
//   <strong>…Formula</a>:</strong> H<sub>2</sub>O</li>
//   <strong>…Molecular weight</a>:</strong> 18.0153</li>

function stripHtmlSimple(s: string): string {
  return s
    .replace(/<sub>/gi, '')
    .replace(/<\/sub>/gi, '')
    .replace(/<sup>([^<]*)<\/sup>/gi, '^$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

function parseCompoundHtml(html: string): CompoundData | null {
  // Formula: tolerate the linked-glossary `</a>:</strong>` form
  const formulaMatch =
    html.match(/Formula<\/a>\s*:\s*<\/strong>\s*([\s\S]*?)<\/li>/i) ??
    html.match(/<strong>\s*Formula\s*:\s*<\/strong>\s*([\s\S]*?)<\/li>/i)
  if (!formulaMatch) return null
  const formula = stripHtmlSimple(formulaMatch[1])
  if (!formula) return null

  const mwMatch =
    html.match(/Molecular weight<\/a>\s*:\s*<\/strong>\s*([\s\S]*?)<\/li>/i) ??
    html.match(/<strong>\s*Molecular weight\s*:\s*<\/strong>\s*([\s\S]*?)<\/li>/i)
  const molecularWeight = mwMatch ? stripHtmlSimple(mwMatch[1]) : null

  // IUPAC InChI block also carries the standard name on some compounds
  const iupacMatch = html.match(/<strong>IUPAC Standard InChI:<\/strong>\s*<span[^>]*>\s*([^<\n]+)/i)
  const iupacName = iupacMatch ? iupacMatch[1].trim() : null

  return { formula, molecularWeight, iupacName }
}

// Curated list of common elements / compounds, each with a verifiable CAS
// number that resolves on the WebBook (spot-checked 2026-05-21).
const COMMON_COMPOUNDS: CompoundDef[] = [
  { name: 'Water',            cas: '7732-18-5' },
  { name: 'Carbon dioxide',   cas: '124-38-9'  },
  { name: 'Methane',          cas: '74-82-8'   },
  { name: 'Ethanol',          cas: '64-17-5'   },
  { name: 'Glucose',          cas: '50-99-7'   },
  { name: 'Ammonia',          cas: '7664-41-7' },
  { name: 'Sulfuric acid',    cas: '7664-93-9' },
  { name: 'Sodium chloride',  cas: '7647-14-5' },
  { name: 'Hydrogen',         cas: '1333-74-0' },
  { name: 'Oxygen',           cas: '7782-44-7' },
  { name: 'Nitrogen',         cas: '7727-37-9' },
  { name: 'Helium',           cas: '7440-59-7' },
  { name: 'Argon',            cas: '7440-37-1' },
  { name: 'Iron',             cas: '7439-89-6' },
  { name: 'Gold',             cas: '7440-57-5' },
  { name: 'Copper',           cas: '7440-50-8' },
  { name: 'Carbon monoxide',  cas: '630-08-0'  },
  { name: 'Hydrogen peroxide', cas: '7722-84-1' },
  { name: 'Acetic acid',      cas: '64-19-7'   },
  { name: 'Benzene',          cas: '71-43-2'   },
]

function compoundClaimText(name: string, cas: string, data: CompoundData): string {
  const parts = [`${name} (CAS ${cas}) has molecular formula ${data.formula}`]
  if (data.molecularWeight) parts.push(`and molecular weight ${data.molecularWeight} g/mol`)
  return parts.join(' ') + '.'
}

async function ingestCompound(
  def: CompoundDef,
  topicId: string,
  dryRun: boolean,
): Promise<IngestResult> {
  const externalId = `nist_webbook_${def.cas}`

  const existing = await prisma.claim.findUnique({ where: { externalId } })
  if (existing) {
    console.log(`  Skipped (exists): ${def.name} (CAS ${def.cas})`)
    return 'skipped'
  }

  const url = WEBBOOK_URL(def.cas)
  let html: string
  try {
    html = await fetchText(url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed fetch: ${def.name} — ${msg}`)
    return 'failed'
  }

  const data = parseCompoundHtml(html)
  if (!data) {
    console.warn(`  Skipped (no parseable Formula): ${def.name} (CAS ${def.cas})`)
    return 'skipped'
  }

  const claimText = compoundClaimText(def.name, def.cas, data)

  if (dryRun) {
    console.log(`  [dry-run] ${def.name} (${def.cas}) → ${data.formula}${data.molecularWeight ? ', MW ' + data.molecularWeight : ''}`)
    return 'ingested'
  }

  try {
    await prisma.$transaction(
      async tx => {
        const source = await tx.source.create({
          data: {
            name: `NIST Chemistry WebBook — ${def.name} (CAS ${def.cas})`,
            url,
            publishedAt: null,
            methodologyType: 'primary',
            ingestedBy: 'nist_webbook_v1',
            humanReviewed: false,
            autoApproved: true,
            externalId: `nist_webbook_source_${def.cas}`,
          },
        })

        const claim = await tx.claim.create({
          data: {
            text: claimText,
            claimType: 'EMPIRICAL',
            currentStatus: 'HARD_FACT',
            verificationStatus: 'VERIFIED',
            claimEmergedAt: null,
            claimEmergedPrecision: null,
            ingestedBy: 'nist_webbook_v1',
            humanReviewed: false,
            autoApproved: true,
            externalId,
            metadata: {
              dataset: 'nist_webbook_v1',
              name: def.name,
              cas: def.cas,
              formula: data.formula,
              molecularWeight: data.molecularWeight,
              iupacInchI: data.iupacName,
              category: 'CHEMISTRY',
            },
          },
        })

        const edge = await tx.edge.create({
          data: {
            sourceId: source.id,
            claimId: claim.id,
            type: 'FOR',
            evidenceType: 'EVIDENTIARY',
            ingestedBy: 'nist_webbook_v1',
            humanReviewed: false,
            autoApproved: true,
          },
        })

        await tx.edgeRevision.create({
          data: {
            edgeId: edge.id,
            priorScore: null,
            newScore: 100,
            reason: 'NIST Chemistry WebBook — molecular formula as HARD_FACT',
            changedAt: new Date(),
          },
        })
      },
      { timeout: 30000 },
    )

    const created = await prisma.claim.findUnique({ where: { externalId } })
    if (created) await tagClaim(created.id, [topicId])
    console.log(`  Ingested: ${def.name} — ${data.formula}${data.molecularWeight ? ` (MW ${data.molecularWeight})` : ''}`)
    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: ${def.name} — ${msg}`)
    return 'failed'
  }
}

// ── Section runners ──────────────────────────────────────────────────────────

async function runConstantsSection(dryRun: boolean, limit: number) {
  console.log(`\n--- NIST Fundamental Physical Constants (nist_constants_v1) ---\n`)
  console.log(`Fetching ${CONSTANTS_URL}`)
  const raw = await fetchText(CONSTANTS_URL)
  const all = parseConstants(raw)
  console.log(`Parsed ${all.length} constants from allascii.txt`)
  const pool = limit > 0 ? all.slice(0, limit) : all

  const topicId = dryRun
    ? '(dry-run)'
    : await ensureTopic('nist-constants', 'NIST Fundamental Physical Constants', 'physics')

  const counts = { ingested: 0, skipped: 0, errors: 0 }
  for (const c of pool) {
    const r = await ingestConstant(c, topicId, dryRun)
    if (r === 'ingested') counts.ingested++
    else if (r === 'skipped') counts.skipped++
    else counts.errors++
  }
  return counts
}

async function runWebbookSection(dryRun: boolean, limit: number) {
  console.log(`\n--- NIST Chemistry WebBook (nist_webbook_v1) ---\n`)
  const pool = limit > 0 ? COMMON_COMPOUNDS.slice(0, limit) : COMMON_COMPOUNDS
  console.log(`Processing ${pool.length} common compounds`)

  const topicId = dryRun
    ? '(dry-run)'
    : await ensureTopic('nist-chemistry', 'NIST Chemistry WebBook', 'chemistry')

  const counts = { ingested: 0, skipped: 0, errors: 0 }
  for (const def of pool) {
    const r = await ingestCompound(def, topicId, dryRun)
    if (r === 'ingested') counts.ingested++
    else if (r === 'skipped') counts.skipped++
    else counts.errors++
  }
  return counts
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { section, dryRun, limit } = parseArgs()
  console.log(`\n=== NIST Ingestion — section: ${section}, dry-run: ${dryRun}, limit: ${limit || 'all'} ===`)

  const totals = { ingested: 0, skipped: 0, errors: 0 }
  const add = (c: { ingested: number; skipped: number; errors: number }) => {
    totals.ingested += c.ingested
    totals.skipped += c.skipped
    totals.errors += c.errors
  }

  if (section === 'constants' || section === 'all') add(await runConstantsSection(dryRun, limit))
  if (section === 'webbook'   || section === 'all') add(await runWebbookSection(dryRun, limit))

  console.log(`\n=== Summary ===`)
  console.log(`  Ingested : ${totals.ingested}`)
  console.log(`  Skipped  : ${totals.skipped}`)
  console.log(`  Errors   : ${totals.errors}`)

  // Per AGENTS.md: verify ingester counters against DB state (skip on dry-run).
  if (!dryRun) {
    const constantsDb = await prisma.claim.count({
      where: { ingestedBy: 'nist_constants_v1', deleted: false },
    })
    const webbookDb = await prisma.claim.count({
      where: { ingestedBy: 'nist_webbook_v1', deleted: false },
    })
    console.log(`  DB nist_constants_v1: ${constantsDb}`)
    console.log(`  DB nist_webbook_v1  : ${webbookDb}`)
  }

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
