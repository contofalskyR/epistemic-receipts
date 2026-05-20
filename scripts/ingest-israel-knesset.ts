// Pipeline 54 — Israel Knesset Enacted Laws (israel_knesset_v1)
// Dataset: Knesset OData v3 ParliamentInfo service
// URL:     https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_IsraelLaw/
//
// Endpoint choice — KNS_IsraelLaw (not KNS_Law):
//   The task brief suggested KNS_Law + IsActive/StatusID filter, but probing
//   the service shows KNS_Law has 61,153 records, no IsActive/StatusID field,
//   and is a chronological gazette dump that mixes British Mandate ordinances,
//   secondary regulations (חקיקת משנה / תקנות / צו), and primary statutes.
//   KNS_IsraelLaw is the curated authoritative list of 2,009 primary Israeli
//   laws (the formal output of the Knesset enacting legislation since 1949),
//   with each record carrying KnessetNum, IsBasicLaw, IsBudgetLaw,
//   LawValidityID/Desc, and ValidityStart/FinishDate. KNS_LawType
//   (suggested for type reference) returns 404 — types live inline on the
//   record (TypeID/TypeDesc on KNS_Law); KNS_IsraelLaw has no Type field
//   because every entry is by definition a primary Israeli law.
//   The KNS_Status entity also exists but its rows describe bill/session
//   workflow states (TypeID 1/2/4/5/12 etc.), not law-validity states.
//
// Scope: All 2,009 primary Israeli laws enacted by the Knesset (or carried
//        over as 'Israeli law' at independence). Validity (in-force vs.
//        repealed/expired) recorded in claim metadata — per ROADMAP.md long-
//        horizon note, repealed laws remain HARD_FACT (the fact that they
//        were enacted is still true).
//
// Topic: il-knesset (Knesset (Israel)), parent = gov-region-asia-pacific
//
// Run: npx tsx scripts/ingest-israel-knesset.ts --dry-run
//      npx tsx scripts/ingest-israel-knesset.ts --sample 10
//      npx tsx scripts/ingest-israel-knesset.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'israel_knesset_v1'
const PIPELINE = 'Pipeline 54'
const PAGE_SIZE = 100
const PAGE_DELAY_MS = 300
const BASE_URL = 'https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_IsraelLaw'

// ── Types ──────────────────────────────────────────────────────────────────────

interface KnessetLaw {
  IsraelLawID: number
  KnessetNum: number | null
  Name: string
  IsBasicLaw: boolean | null
  IsFavoriteLaw: boolean | null
  PublicationDate: string | null
  LatestPublicationDate: string | null
  IsBudgetLaw: boolean | null
  LawValidityID: number | null
  LawValidityDesc: string | null
  ValidityStartDate: string | null
  ValidityStartDateNotes: string | null
  ValidityFinishDate: string | null
  ValidityFinishDateNotes: string | null
  LastUpdatedDate: string | null
}

interface KnessetResponse {
  'odata.metadata'?: string
  'odata.count'?: string
  value: KnessetLaw[]
}

interface CandidateRecord {
  externalId: string
  sourceExternalId: string
  lawId: number
  name: string
  enactedDate: Date
  enactedDateStr: string
  knessetNum: number | null
  isBasicLaw: boolean | null
  isBudgetLaw: boolean | null
  lawValidityId: number | null
  lawValidityDesc: string | null
  validityStartDate: string | null
  validityFinishDate: string | null
  latestPublicationDate: string | null
  sourceUrl: string
  sourceName: string
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
          'Accept': 'application/json',
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

async function fetchWithRetry(url: string, retries = 4, timeoutMs = 30_000): Promise<{ status: number; body: string }> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await httpsGet(url, timeoutMs)
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      return res
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Fetch error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ── Fetch all enacted laws ─────────────────────────────────────────────────────

function parseEnacted(date: string | null): Date | null {
  if (!date) return null
  const iso = date.length >= 10 ? date.slice(0, 10) + 'T00:00:00Z' : null
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

async function fetchEnactedLaws(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seen = new Set<string>() // defensive duplicate guard
  let skip = 0
  let pageNum = 1
  let totalReported: number | null = null
  let noDate = 0
  let noName = 0

  while (true) {
    const inlineCount = pageNum === 1 ? '&$inlinecount=allpages' : ''
    const url = `${BASE_URL}/?$format=json&$top=${PAGE_SIZE}&$skip=${skip}&$orderby=IsraelLawID${inlineCount}`
    const res = await fetchWithRetry(url, 4, 30_000)
    if (res.status !== 200) {
      console.warn(`  HTTP ${res.status} on page ${pageNum} (skip=${skip})`)
      break
    }

    let data: KnessetResponse
    try {
      data = JSON.parse(res.body) as KnessetResponse
    } catch (err) {
      console.error(`  JSON parse error on page ${pageNum}: ${err}`)
      break
    }

    const items = data.value ?? []
    if (pageNum === 1 && data['odata.count']) {
      totalReported = parseInt(data['odata.count'], 10)
      console.log(`  Server reports ${totalReported} total KNS_IsraelLaw rows`)
    }

    if (items.length === 0) break

    for (const law of items) {
      const enactedDate = parseEnacted(law.PublicationDate)
      if (!enactedDate) { noDate++; continue }

      const name = (law.Name ?? '').trim()
      if (!name) { noName++; continue }

      const externalId = `israel_knesset_${law.IsraelLawID}`
      if (seen.has(externalId)) continue
      seen.add(externalId)

      const dateStr = law.PublicationDate!.slice(0, 10)

      candidates.push({
        externalId,
        sourceExternalId: `israel_knesset_source_${law.IsraelLawID}`,
        lawId: law.IsraelLawID,
        name,
        enactedDate,
        enactedDateStr: dateStr,
        knessetNum: law.KnessetNum,
        isBasicLaw: law.IsBasicLaw,
        isBudgetLaw: law.IsBudgetLaw,
        lawValidityId: law.LawValidityID,
        lawValidityDesc: law.LawValidityDesc,
        validityStartDate: law.ValidityStartDate ? law.ValidityStartDate.slice(0, 10) : null,
        validityFinishDate: law.ValidityFinishDate ? law.ValidityFinishDate.slice(0, 10) : null,
        latestPublicationDate: law.LatestPublicationDate ? law.LatestPublicationDate.slice(0, 10) : null,
        sourceUrl: `https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_IsraelLaw(${law.IsraelLawID}L)`,
        sourceName: name.length > 250 ? name.slice(0, 247) + '...' : name,
      })

      if (limit > 0 && candidates.length >= limit) {
        if (verbose) console.log(`  Reached limit ${limit}; stopping pagination`)
        return candidates
      }
    }

    if (verbose) {
      console.log(`  Page ${pageNum} (skip=${skip}): +${items.length} rows; running candidates=${candidates.length}`)
    } else {
      process.stdout.write(`  ${candidates.length} candidates collected (page ${pageNum})...\r`)
    }

    if (items.length < PAGE_SIZE) break
    skip += PAGE_SIZE
    pageNum++
    await sleep(PAGE_DELAY_MS)
  }

  if (noDate > 0) console.log(`  Skipped ${noDate} rows with no parseable PublicationDate`)
  if (noName > 0) console.log(`  Skipped ${noName} rows with empty Name`)
  if (totalReported !== null) {
    console.log(`  Pagination done: server total=${totalReported}, fetched candidates=${candidates.length}`)
  }
  return candidates
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string,
  name: string,
  domain: string,
  parentSlug?: string,
): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!

  let parentTopicId: string | undefined
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (!parent) {
      throw new Error(`Parent topic '${parentSlug}' not found — run scripts/migrate-government-regions.ts first`)
    }
    parentTopicId = parent.id
  }

  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    if (parentTopicId && existing.parentTopicId !== parentTopicId) {
      await prisma.topic.update({ where: { id: existing.id }, data: { parentTopicId } })
      console.log(`  Updated topic ${slug} parent → ${parentSlug}`)
    }
    topicCache.set(slug, existing.id)
    return existing.id
  }

  const created = await prisma.topic.create({
    data: { slug, name, domain, ...(parentTopicId ? { parentTopicId } : {}) },
  })
  console.log(`  Created topic: ${slug}${parentSlug ? ` (parent: ${parentSlug})` : ''}`)
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
        name: rec.sourceName,
        url: rec.sourceUrl,
        publishedAt: rec.enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.name.slice(0, 1000),
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.enactedDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          lawId: rec.lawId,
          knessetNum: rec.knessetNum,
          isBasicLaw: rec.isBasicLaw,
          isBudgetLaw: rec.isBudgetLaw,
          lawValidityId: rec.lawValidityId,
          lawValidityDesc: rec.lawValidityDesc,
          validityStartDate: rec.validityStartDate,
          validityFinishDate: rec.validityFinishDate,
          latestPublicationDate: rec.latestPublicationDate,
        },
      },
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

  console.log(`\n── ${PIPELINE}: Israel Knesset Enacted Laws ────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('il-knesset', 'Knesset (Israel)', 'government', 'gov-region-asia-pacific')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching enacted laws from Knesset OData (KNS_IsraelLaw)...')
  const allCandidates = await fetchEnactedLaws(limit, verbose)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 15).map(r => ({
      claimText: r.name,
      externalId: r.externalId,
      lawId: r.lawId,
      knessetNum: r.knessetNum,
      isBasicLaw: r.isBasicLaw,
      isBudgetLaw: r.isBudgetLaw,
      lawValidityId: r.lawValidityId,
      lawValidityDesc: r.lawValidityDesc,
      validityStartDate: r.validityStartDate,
      validityFinishDate: r.validityFinishDate,
      latestPublicationDate: r.latestPublicationDate,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    // Coverage summary
    const byValidity: Record<string, number> = {}
    const byKnesset: Record<string, number> = {}
    let basicCount = 0, budgetCount = 0
    for (const c of allCandidates) {
      const v = c.lawValidityDesc ?? '(none)'
      byValidity[v] = (byValidity[v] ?? 0) + 1
      const k = c.knessetNum === null ? '(none)' : String(c.knessetNum)
      byKnesset[k] = (byKnesset[k] ?? 0) + 1
      if (c.isBasicLaw) basicCount++
      if (c.isBudgetLaw) budgetCount++
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      summary: {
        basicLaws: basicCount,
        budgetLaws: budgetCount,
        byValidity,
        byKnesset,
      },
      sample,
    }

    fs.writeFileSync('pipeline-54-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-54-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nFirst 5 by IsraelLawID:')
      allCandidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] (K${r.knessetNum ?? '?'}) ${r.name.slice(0, 110)}${r.name.length > 110 ? '…' : ''}`)
      )
      console.log('\nValidity distribution:')
      Object.entries(byValidity).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}`)
      })
      console.log(`Basic Laws: ${basicCount} | Budget Laws: ${budgetCount}`)
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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.name.slice(0, 70)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}-${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }

    if (!verbose) {
      const done = Math.min(i + BATCH, rows.length)
      process.stdout.write(`  ${done}/${rows.length} processed...\r`)
    }
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
