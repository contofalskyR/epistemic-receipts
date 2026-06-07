// Drugs@FDA approval ingestion (drugsatfda_v1)
// Source: https://www.fda.gov/drugs/drug-approvals-and-databases/drugsfda-data-files
// Scope: One claim per FDA-approved drug product (ORIG submissions, SubmissionStatus=AP).
//        After ingestion, creates OUTCOME ClaimRelations to matching clinicaltrials_v1 claims.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-drugs-fda.ts --dry-run
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-drugs-fda.ts --full [--limit N]
//
// Flags:
//   --dry-run   Parse and preview without writing to DB
//   --full      Write to DB (requires ALLOW_EDITS=true)
//   --limit N   Cap records processed (default: all)

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PIPELINE = 'drugsatfda_v1'
const FDA_PAGE_URL = 'https://www.fda.gov/drugs/drug-approvals-and-databases/drugsfda-data-files'
const FDA_ZIP_FALLBACK = 'https://www.fda.gov/media/89850/download'
const ZIP_PATH = '/tmp/drugsatfda.zip'
const EXTRACT_DIR = '/tmp/drugsatfda'
const TX_TIMEOUT_MS = 30_000
const BATCH_SIZE = 500
const LOG_INTERVAL = 500
const MAX_TRIAL_LINKS = 3

// ── Arg parsing ───────────────────────────────────────────────────────────────

interface Args {
  dryRun: boolean
  limit: number
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  let dryRun = false
  let limit = Number.MAX_SAFE_INTEGER
  let hasMode = false

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') {
      dryRun = true
      hasMode = true
    } else if (a === '--full') {
      hasMode = true
    } else if (a === '--limit' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10)
      if (!isNaN(n) && n > 0) limit = n
    }
  }

  if (!hasMode) {
    console.error('Usage: --dry-run | --full [--limit N]')
    process.exit(1)
  }

  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true in environment')
    process.exit(1)
  }

  return { dryRun, limit }
}

// ── Data types ────────────────────────────────────────────────────────────────

interface AppRow {
  applNo: string
  applType: string
  sponsorName: string
}

interface ProductRow {
  applNo: string
  productNo: string
  form: string
  strength: string
  drugName: string
  activeIngredient: string
}

interface SubmissionRow {
  applNo: string
  actionDate: string // SubmissionStatusDate
}

interface FdaRecord {
  applNo: string
  productNo: string
  applType: string
  sponsorName: string
  drugName: string
  activeIngredient: string
  form: string
  strength: string
  actionDate: string
  externalId: string
  claimText: string
}

// ── Download & parse ──────────────────────────────────────────────────────────

async function discoverZipUrl(): Promise<string> {
  try {
    const res = await fetch(FDA_PAGE_URL, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return FDA_ZIP_FALLBACK
    const html = await res.text()
    const match = /href="(\/media\/\d+\/download[^"]*)"/.exec(html)
    if (match) return `https://www.fda.gov${match[1]}`
  } catch {
    // fall through to fallback
  }
  return FDA_ZIP_FALLBACK
}

async function downloadZip(url: string): Promise<void> {
  // Reuse cached zip if it's less than 12 hours old
  if (fs.existsSync(ZIP_PATH)) {
    const ageMs = Date.now() - fs.statSync(ZIP_PATH).mtimeMs
    if (ageMs < 12 * 60 * 60 * 1000) {
      console.log(`  Using cached ZIP (${(ageMs / 3600000).toFixed(1)}h old): ${ZIP_PATH}`)
      return
    }
  }

  console.log(`  Downloading Drugs@FDA ZIP from: ${url}`)
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(ZIP_PATH, buf)
  console.log(`  Downloaded ${(buf.length / 1024 / 1024).toFixed(1)} MB`)
}

function parseTsv(filePath: string): Record<string, string>[] {
  if (!fs.existsSync(filePath)) throw new Error(`TSV not found: ${filePath}`)
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split('\t').map(h => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const cols = line.split('\t')
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

function buildRecords(extractDir: string): FdaRecord[] {
  console.log('  Parsing Applications.txt ...')
  const appMap = new Map<string, AppRow>()
  for (const r of parseTsv(path.join(extractDir, 'Applications.txt'))) {
    const applNo = r['ApplNo']?.trim() ?? ''
    if (applNo) {
      appMap.set(applNo, {
        applNo,
        applType: r['ApplType']?.trim() ?? '',
        sponsorName: r['SponsorName']?.trim() ?? '',
      })
    }
  }
  console.log(`    ${appMap.size} applications loaded`)

  console.log('  Parsing Products.txt ...')
  const productMap = new Map<string, ProductRow[]>()
  for (const r of parseTsv(path.join(extractDir, 'Products.txt'))) {
    const applNo = r['ApplNo']?.trim() ?? ''
    if (!applNo) continue
    const list = productMap.get(applNo) ?? []
    list.push({
      applNo,
      productNo: r['ProductNo']?.trim() ?? '',
      form: r['Form']?.trim() ?? '',
      strength: r['Strength']?.trim() ?? '',
      drugName: r['DrugName']?.trim() ?? '',
      activeIngredient: r['ActiveIngredient']?.trim() ?? '',
    })
    productMap.set(applNo, list)
  }
  const totalProducts = Array.from(productMap.values()).reduce((s, a) => s + a.length, 0)
  console.log(`    ${totalProducts} products loaded across ${productMap.size} applications`)

  console.log('  Parsing Submissions.txt (ORIG + AP only) ...')
  const approvalMap = new Map<string, SubmissionRow>() // applNo → earliest ORIG AP
  for (const r of parseTsv(path.join(extractDir, 'Submissions.txt'))) {
    const applNo = r['ApplNo']?.trim() ?? ''
    const submType = r['SubmissionType']?.trim() ?? ''
    const status = r['SubmissionStatus']?.trim() ?? ''
    const dateStr = r['SubmissionStatusDate']?.trim() ?? ''
    if (submType === 'ORIG' && status === 'AP' && applNo && dateStr) {
      // Keep earliest ORIG AP for dedup safety (should only be one per application)
      if (!approvalMap.has(applNo)) {
        approvalMap.set(applNo, { applNo, actionDate: dateStr })
      }
    }
  }
  console.log(`    ${approvalMap.size} ORIG approved submissions`)

  console.log('  Building claim records ...')
  const records: FdaRecord[] = []

  for (const [applNo, submission] of approvalMap) {
    const app = appMap.get(applNo)
    const products = productMap.get(applNo)
    if (!app || !products || products.length === 0) continue

    const rawDate = submission.actionDate
    // SubmissionStatusDate format: "YYYY-MM-DD HH:MM:SS"
    const dateForId = rawDate.split(' ')[0] // "YYYY-MM-DD"

    for (const prod of products) {
      const externalId = `drugsatfda:${applNo}:${prod.productNo}:${dateForId}`

      const ingredientPart = prod.activeIngredient ? ` (${prod.activeIngredient})` : ''
      const formPart = [prod.form, prod.strength].filter(Boolean).join(' ')
      const formStr = formPart ? `, ${formPart}` : ''
      const sponsorPart = app.sponsorName ? ` by ${app.sponsorName}` : ''
      const datePart = dateForId ? ` Approved ${dateForId}.` : ''

      const claimText =
        `FDA Original Approval: ${prod.drugName || 'Unknown'}${ingredientPart}${formStr}.` +
        ` Application ${app.applType} ${applNo}${sponsorPart}.${datePart}`

      records.push({
        applNo,
        productNo: prod.productNo,
        applType: app.applType,
        sponsorName: app.sponsorName,
        drugName: prod.drugName,
        activeIngredient: prod.activeIngredient,
        form: prod.form,
        strength: prod.strength,
        actionDate: rawDate,
        externalId,
        claimText,
      })
    }
  }

  console.log(`    ${records.length} claim records built`)
  return records
}

// ── Ingestion ─────────────────────────────────────────────────────────────────

type Counts = { ingested: number; skipped: number; errors: number; links: number }

async function ingestRecord(record: FdaRecord, counts: Counts): Promise<void> {
  try {
    const existing = await prisma.claim.findUnique({
      where: { externalId: record.externalId },
      select: { id: true },
    })
    if (existing) {
      counts.skipped++
      return
    }

    const actionDate = new Date(record.actionDate)
    const dateValid = !isNaN(actionDate.getTime())

    await prisma.$transaction(async tx => {
      await tx.claim.create({
        data: {
          text: record.claimText,
          externalId: record.externalId,
          claimType: 'INSTITUTIONAL',
          currentStatus: 'HARD_FACT',
          verificationStatus: 'VERIFIED',
          ingestedBy: PIPELINE,
          autoApproved: true,
          humanReviewed: false,
          claimEmergedAt: dateValid ? actionDate : null,
          claimEmergedPrecision: dateValid ? 'DAY' : null,
          metadata: {
            applNo: record.applNo,
            productNo: record.productNo,
            applType: record.applType,
            sponsorName: record.sponsorName,
            drugName: record.drugName,
            activeIngredient: record.activeIngredient,
            form: record.form,
            strength: record.strength,
            actionDate: record.actionDate,
          },
        },
      })
    }, { timeout: TX_TIMEOUT_MS })

    counts.ingested++
  } catch (err) {
    counts.errors++
    const msg = err instanceof Error ? err.message : String(err)
    if (counts.errors <= 5) console.error(`  ERROR on ${record.externalId}: ${msg}`)
  }
}

async function buildOutcomeLinks(counts: Counts): Promise<void> {
  console.log('\n  Building OUTCOME links to clinicaltrials_v1 ...')

  // Load all drugsatfda_v1 claims with activeIngredient in metadata
  const fdaClaims = await prisma.claim.findMany({
    where: { ingestedBy: PIPELINE, deleted: false },
    select: { id: true, metadata: true },
  })
  console.log(`    ${fdaClaims.length} Drugs@FDA claims to process`)

  // Build ingredient → fda claim id map
  interface FdaMeta { activeIngredient?: string }
  const ingredientMap = new Map<string, string[]>() // ingredient → [fdaClaimId]
  for (const c of fdaClaims) {
    const meta = c.metadata as FdaMeta | null
    const ing = meta?.activeIngredient?.trim().toLowerCase()
    if (!ing || ing.length < 4) continue
    const list = ingredientMap.get(ing) ?? []
    list.push(c.id)
    ingredientMap.set(ing, list)
  }
  console.log(`    ${ingredientMap.size} unique active ingredients`)

  // For each ingredient, find matching clinicaltrials_v1 claims (limit to top 3)
  let linksCreated = 0
  let linksSkipped = 0
  let ingredientIdx = 0

  for (const [ingredient, fdaIds] of ingredientMap) {
    ingredientIdx++
    if (ingredientIdx % 500 === 0) {
      console.log(`    Linking ingredient ${ingredientIdx}/${ingredientMap.size} — ${linksCreated} links created`)
    }

    const trialClaims = await prisma.claim.findMany({
      where: {
        ingestedBy: 'clinicaltrials_v1',
        deleted: false,
        text: { contains: ingredient, mode: 'insensitive' },
      },
      select: { id: true },
      take: MAX_TRIAL_LINKS,
    })

    if (trialClaims.length === 0) continue

    // Pick one representative FDA claim per ingredient (use first)
    const fdaId = fdaIds[0]

    for (const trial of trialClaims) {
      try {
        await prisma.claimRelation.create({
          data: {
            fromClaimId: trial.id,
            toClaimId: fdaId,
            relationType: 'OUTCOME',
            followUpContext: {
              via: 'ingredient_match',
              confidence: 'medium',
              ingredient,
              pipeline_from: 'clinicaltrials_v1',
              pipeline_to: PIPELINE,
            },
          },
        })
        linksCreated++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('Unique constraint')) {
          linksSkipped++
        } else if (linksSkipped + linksCreated < 5) {
          console.error(`  Link error: ${msg}`)
        }
      }
    }
  }

  counts.links = linksCreated
  console.log(`    Links created: ${linksCreated}, already-existing skipped: ${linksSkipped}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit } = parseArgs()
  const mode = dryRun ? 'DRY-RUN' : 'FULL'
  console.log(`\n=== Drugs@FDA Ingestion (${mode}) ===`)
  console.log(`Pipeline: ${PIPELINE}`)
  console.log(`Limit: ${limit === Number.MAX_SAFE_INTEGER ? 'none' : limit}`)

  // Step 1: download
  const zipUrl = await discoverZipUrl()
  await downloadZip(zipUrl)

  // Step 2: extract
  console.log('\nExtracting ZIP ...')
  fs.mkdirSync(EXTRACT_DIR, { recursive: true })
  execSync(`unzip -o "${ZIP_PATH}" -d "${EXTRACT_DIR}"`, { stdio: 'pipe' })
  console.log(`  Extracted to ${EXTRACT_DIR}`)

  // Step 3: parse and build records
  console.log('\nParsing TSV files ...')
  const records = buildRecords(EXTRACT_DIR)

  const toProcess = records.slice(0, limit)
  console.log(`\nRecords to process: ${toProcess.length}`)

  if (dryRun) {
    console.log('\n[DRY-RUN] First 5 records:')
    for (const r of toProcess.slice(0, 5)) {
      console.log(`  externalId: ${r.externalId}`)
      console.log(`  text: ${r.claimText.slice(0, 120)}`)
      console.log()
    }
    console.log('[DRY-RUN] No database writes performed.')
    await prisma.$disconnect()
    return
  }

  // Step 4: ingest
  console.log('\nIngesting claims ...')
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0, links: 0 }
  const total = toProcess.length

  for (let i = 0; i < toProcess.length; i++) {
    await ingestRecord(toProcess[i], counts)

    if ((i + 1) % LOG_INTERVAL === 0 || i + 1 === total) {
      console.log(`  Ingested ${counts.ingested} / ${total} (${counts.skipped} skipped, ${counts.errors} errors)`)
    }
  }

  // Step 5: DB verification
  const dbCount = await prisma.claim.count({ where: { ingestedBy: PIPELINE, deleted: false } })
  console.log(`\nDB verification: ${dbCount} total ${PIPELINE} claims in database`)
  if (dbCount !== counts.ingested && counts.skipped === 0) {
    console.warn(`WARNING: DB count (${dbCount}) does not match ingested counter (${counts.ingested})`)
  }

  // Step 6: outcome links
  if (counts.ingested > 0 || dbCount > 0) {
    await buildOutcomeLinks(counts)
  }

  // Step 7: summary
  console.log('\n=== Summary ===')
  console.log(`  Ingested: ${counts.ingested}`)
  console.log(`  Skipped:  ${counts.skipped}`)
  console.log(`  Errors:   ${counts.errors}`)
  console.log(`  OUTCOME links created: ${counts.links}`)
  console.log(`  DB total (${PIPELINE}): ${dbCount}`)

  await prisma.$disconnect()
}

main().catch(err => {
  console.error('Fatal error:', err)
  prisma.$disconnect().finally(() => process.exit(1))
})
