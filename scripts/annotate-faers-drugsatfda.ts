// Annotates existing drugsatfda_v1 Claim records with FDA FAERS adverse event counts.
// Stores counts in claim.metadata — not as new Claim rows (FAERS is a signal, not a hard fact).
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/annotate-faers-drugsatfda.ts [--dry-run] [--limit N] [--resume]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PIPELINE = 'drugsatfda_v1'
const FAERS_BASE = 'https://api.fda.gov/drug/event.json'
const MIN_INTERVAL_MS = 1100 // ~1 req/sec, polite for FAERS

// ── CLI ───────────────────────────────────────────────────────────────────────

interface Args {
  dryRun: boolean
  limit:  number
  resume: boolean
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const limitIdx = argv.indexOf('--limit')
  return {
    dryRun: argv.includes('--dry-run'),
    limit:  limitIdx !== -1 ? (parseInt(argv[limitIdx + 1] ?? '0', 10) || 0) : 0,
    resume: argv.includes('--resume'),
  }
}

// ── Rate limiting + fetch ─────────────────────────────────────────────────────

let lastReqAt = 0

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function throttle(): Promise<void> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function fetchTotal(url: string, retries = 4): Promise<number | null> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    let res: Response
    try {
      res = await fetch(url)
    } catch {
      if (attempt < retries) { await sleep(delay); delay *= 2; continue }
      return null
    }
    if (res.status === 404) return 0
    if (res.status === 429) {
      console.warn(`  429 — backing off ${delay}ms (attempt ${attempt + 1})`)
      await sleep(delay); delay *= 2; continue
    }
    if (!res.ok) {
      if (attempt < retries) { await sleep(delay); delay *= 2; continue }
      return null
    }
    const json = await res.json() as { meta?: { results?: { total?: number } } }
    return json?.meta?.results?.total ?? 0
  }
  return null
}

// ── FAERS queries — sequential to respect rate limit ─────────────────────────

interface FaersCounts {
  total:   number
  serious: number
  deaths:  number
}

async function queryFaers(drugName: string): Promise<FaersCounts | null> {
  const encoded = encodeURIComponent(`"${drugName.toUpperCase()}"`)
  const base = `${FAERS_BASE}?search=patient.drug.openfda.generic_name.exact:${encoded}`

  const total   = await fetchTotal(`${base}&limit=1`)
  if (total === null) return null  // hard API failure

  const serious = await fetchTotal(`${base}+AND+serious:1&limit=1`)
  const deaths  = await fetchTotal(`${base}+AND+seriousnessdeath:1&limit=1`)

  return {
    total,
    serious: serious ?? 0,
    deaths:  deaths  ?? 0,
  }
}

// ── Drug name extraction ──────────────────────────────────────────────────────

function extractDrugName(meta: Record<string, unknown>, text: string): string | null {
  // Prefer activeIngredient stored in metadata by the drugsatfda ingester
  if (typeof meta.activeIngredient === 'string' && meta.activeIngredient.trim()) {
    return meta.activeIngredient.trim()
  }
  // Fall back: parse from text "FDA Original Approval: {drugName} ({activeIngredient})..."
  const m = text.match(/FDA Original Approval:\s+[^(]+\(([^)]+)\)/)
  if (m) return m[1].trim()
  // Last resort: brand name from metadata
  if (typeof meta.drugName === 'string' && meta.drugName.trim()) {
    return meta.drugName.trim()
  }
  return null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { dryRun, limit, resume } = parseArgs()

  console.log(`\nFAERS annotation — ${PIPELINE}`)
  console.log(`  mode   : ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`)
  console.log(`  limit  : ${limit || 'none'}`)
  console.log(`  resume : ${resume}`)

  const allClaims = await prisma.claim.findMany({
    where: { ingestedBy: PIPELINE, deleted: false },
    select: { id: true, text: true, metadata: true },
    orderBy: { id: 'asc' },
  })

  // Filter to unprocessed claims when --resume is set
  const candidates = resume
    ? allClaims.filter(c => {
        const m = c.metadata as Record<string, unknown> | null
        return !m?.faers_last_checked
      })
    : allClaims

  const toProcess = limit ? candidates.slice(0, limit) : candidates

  console.log(`\n  ${allClaims.length} total drugsatfda_v1 claims`)
  console.log(`  ${toProcess.length} to process${resume ? ' (unannotated only)' : ''}`)
  if (toProcess.length === 0) { await prisma.$disconnect(); return }

  const counts = { updated: 0, skipped: 0, errors: 0, noResults: 0 }

  for (let i = 0; i < toProcess.length; i++) {
    const claim = toProcess[i]
    const meta = (claim.metadata ?? {}) as Record<string, unknown>
    const drugName = extractDrugName(meta, claim.text)

    if (!drugName) {
      console.warn(`  [${i + 1}/${toProcess.length}] id=${claim.id} — no drug name found, skipping`)
      counts.skipped++
      continue
    }

    const faers = await queryFaers(drugName)

    if (faers === null) {
      console.error(`  [${i + 1}/${toProcess.length}] ${drugName} — FAERS API failure, skipping`)
      counts.errors++
      continue
    }

    if (faers.total === 0) counts.noResults++

    const isoDate = new Date().toISOString().split('T')[0]
    console.log(
      `  [${i + 1}/${toProcess.length}] ${drugName} — ` +
      `${faers.total.toLocaleString()} AEs, ${faers.serious.toLocaleString()} serious, ` +
      `${faers.deaths.toLocaleString()} deaths`
    )

    if (!dryRun) {
      const merged = {
        ...meta,
        faers_adverse_events: faers.total,
        faers_serious:        faers.serious,
        faers_deaths:         faers.deaths,
        faers_last_checked:   isoDate,
      }
      await prisma.claim.update({
        where: { id: claim.id },
        data:  { metadata: merged },
      })
      counts.updated++
    }
  }

  console.log(`\n── Summary ─────────────────────────────────────────`)
  console.log(`  Updated    : ${counts.updated}`)
  console.log(`  No results : ${counts.noResults}`)
  console.log(`  Skipped    : ${counts.skipped}`)
  console.log(`  Errors     : ${counts.errors}`)
  if (dryRun) console.log(`  (dry run — no writes committed)`)

  await prisma.$disconnect()
}

main().catch(err => {
  console.error('Fatal:', err)
  prisma.$disconnect().finally(() => process.exit(1))
})
