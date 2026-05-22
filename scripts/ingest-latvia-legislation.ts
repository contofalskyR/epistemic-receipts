// Pipeline 104 — Latvia Legislation (latvia_legislation_v1)
// Dataset: Latvian consolidated laws from likumi.lv (official law database)
// Source:  https://likumi.lv — XML sitemaps enumerate all ~124K document IDs;
//          individual law pages are server-side rendered with full metadata.
// Scope:   All standalone laws (Veids: likums) regardless of issuing body
//          (Saeima, Augstākā Padome, Satversmes Sapulce). Latvian titles.
// Method:  Parse 3 sitemaps → slug-filter to ~1,100 law candidates → fetch each
//          detail page (1.1s delay per robots.txt) → keep Veids=likums → write.
// Note:    The likumi.lv *listing* page is a React SPA (previous blocker), but
//          individual detail pages are SSR HTML. Sitemaps provide complete ID coverage.
// Run:     npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-latvia-legislation.ts --dry-run
//          npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-latvia-legislation.ts --sample 5
//          npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-latvia-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'latvia_legislation_v1'
const PIPELINE = 'Pipeline 104'
const BASE_URL = 'https://likumi.lv'
const PAGE_DELAY_MS = 1100  // robots.txt: crawl-delay 1

const SITEMAP_URLS = [
  'https://likumi.lv/sitemap.xml',
  'https://likumi.lv/sitemap-1.xml',
  'https://likumi.lv/sitemap-2.xml',
]

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  docId: string
  slug: string
  claimText: string
  issuer: string
  status: string
  adoptedDate: string
  adoptedDateIso: string
  inForceDate: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
}

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
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '5', 10) || 5) : 5,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function fetchText(url: string, retries = 4): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'EpistemicReceipts/1.0 (robert.contofalsky@rutgers.edu)',
          'Accept': 'text/html,application/xhtml+xml,text/xml',
          'Accept-Language': 'lv,en',
        },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay); delay *= 2; continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} at ${url}`)
      return await res.text()
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Network error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay); delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at ${url}`)
}

// ── Sitemap parsing ────────────────────────────────────────────────────────────

interface DocEntry { docId: string; slug: string }

function parseSitemap(xml: string): DocEntry[] {
  const entries: DocEntry[] = []
  const re = /<loc>https:\/\/likumi\.lv\/ta\/id\/(\d+)-([^<]+)<\/loc>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    entries.push({ docId: m[1], slug: m[2] })
  }
  return entries
}

// Latvian laws almost always have "likums" in the URL slug.
// "Par XYZ" laws become "likums-par-xyz" or "par-xyz-likums".
// Codes (Kodekss) and the Constitution (Satversme) are the main exceptions.
// Aggressive exclusions keep the candidate set to ~1,100 instead of 70K+.
function isLikelyLaw(slug: string): boolean {
  const EXCLUDE = [
    'grozijum', 'noteikum', 'rikojum', 'lemum', 'nolikum',
    'instrukcij', 'pazinojum', 'pavele', 'reglamenta-',
    'saistoso-noteikumu', 'saeimas-priekssedetaja',
  ]
  if (EXCLUDE.some(p => slug.includes(p))) return false

  if (slug.includes('likums')) return true
  if (slug.endsWith('kodekss') || slug.includes('kodekss-')) return true
  if (slug.includes('satversme')) return true
  return false
}

async function fetchAllCandidateIds(): Promise<DocEntry[]> {
  const all: DocEntry[] = []
  const seenIds = new Set<string>()

  for (const url of SITEMAP_URLS) {
    process.stdout.write(`  Fetching ${url}...`)
    let xml: string
    try {
      xml = await fetchText(url)
    } catch (err) {
      console.warn(`\n  Failed: ${err instanceof Error ? err.message : err}`)
      continue
    }
    const entries = parseSitemap(xml)
    let added = 0
    for (const e of entries) {
      if (seenIds.has(e.docId)) continue
      if (!isLikelyLaw(e.slug)) continue
      seenIds.add(e.docId)
      all.push(e)
      added++
    }
    console.log(` ${entries.length} entries, ${added} law candidates`)
    await sleep(500)
  }

  return all
}

// ── Page parsing ───────────────────────────────────────────────────────────────

function parseLvDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

interface LawMeta {
  title: string | null
  issuer: string | null
  docType: string | null
  adoptedRaw: string | null
  inForceRaw: string | null
  status: string | null
}

function parseLawPage(html: string): LawMeta {
  function extractField(label: string): string | null {
    const re = new RegExp(
      `<font class='fclg2'>\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</font>(.*?)</span>`,
      's'
    )
    const m = html.match(re)
    if (!m) return null
    return m[1].replace(/<[^>]+>/g, '').trim().replace(/\.$/, '') || null
  }

  const veidMatch = html.match(/<font class='fclg2'>Veids:\s*<\/font><a[^>]*>([^<]+)<\/a>/)
  const docType = veidMatch ? veidMatch[1].trim() : extractField('Veids:')

  const statusMatch = html.match(/class='container fss fwn fcw'>([^<]+)<\/div>/)
  const status = statusMatch ? statusMatch[1].trim() : null

  return {
    title: extractField('Nosaukums:'),
    issuer: extractField('Izdevējs:'),
    docType,
    adoptedRaw: extractField('Pieņemts:'),
    inForceRaw: extractField('Stājas spēkā:'),
    status,
  }
}

// ── Fetch all laws ─────────────────────────────────────────────────────────────

async function fetchAllLaws(
  candidates: DocEntry[],
  hardLimit: number,
  verbose: boolean,
): Promise<CandidateRecord[]> {
  const results: CandidateRecord[] = []
  const seenExtIds = new Set<string>()
  let fetched = 0
  let notLaw = 0
  let noMeta = 0

  for (const { docId, slug } of candidates) {
    const externalId = `latvia_legislation_${docId}`
    if (seenExtIds.has(externalId)) continue

    const url = `${BASE_URL}/ta/id/${docId}-${slug}`
    let html: string
    try {
      html = await fetchText(url)
    } catch (err) {
      console.warn(`  Failed ${docId}: ${err instanceof Error ? err.message : err}`)
      await sleep(PAGE_DELAY_MS)
      continue
    }
    fetched++

    const meta = parseLawPage(html)

    if (!meta.title || !meta.docType) {
      noMeta++
      if (verbose) console.log(`  [no-meta] ${docId}`)
      await sleep(PAGE_DELAY_MS)
      continue
    }

    if (meta.docType !== 'likums') {
      notLaw++
      if (verbose) console.log(`  [skip:${meta.docType}] ${docId} — ${meta.title.slice(0, 60)}`)
      await sleep(PAGE_DELAY_MS)
      continue
    }

    const adoptedIso = meta.adoptedRaw ? parseLvDate(meta.adoptedRaw) : null
    const inForceIso = meta.inForceRaw ? parseLvDate(meta.inForceRaw) : null
    const dateIso = adoptedIso ?? inForceIso ?? null
    if (!dateIso) {
      if (verbose) console.log(`  [no-date] ${docId} — ${meta.title.slice(0, 60)}`)
      await sleep(PAGE_DELAY_MS)
      continue
    }

    seenExtIds.add(externalId)

    results.push({
      docId,
      slug,
      claimText: meta.title,
      issuer: meta.issuer ?? 'Saeima',
      status: meta.status ?? 'unknown',
      adoptedDate: meta.adoptedRaw ?? '',
      adoptedDateIso: dateIso,
      inForceDate: meta.inForceRaw ?? '',
      sourceUrl: url,
      externalId,
      sourceExternalId: `latvia_legislation_src_${docId}`,
      sourceName: `${meta.title} (${meta.adoptedRaw ?? inForceIso ?? '?'})`,
    })

    if (verbose) {
      console.log(`  [law] ${docId} — ${meta.title.slice(0, 70)} (${dateIso})`)
    } else {
      process.stdout.write(`  Fetched ${fetched}/${candidates.length} | Laws: ${results.length} | Skip: ${notLaw} | NoMeta: ${noMeta}    \r`)
    }

    if (hardLimit > 0 && results.length >= hardLimit) break
    await sleep(PAGE_DELAY_MS)
  }

  process.stdout.write('\n')
  console.log(`  Fetched: ${fetched} | Laws: ${results.length} | Not-law: ${notLaw} | No-meta: ${noMeta}`)
  return results
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Write one record ───────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: CandidateRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const enactedDate = new Date(`${rec.adoptedDateIso}T00:00:00Z`)

    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: rec.sourceName,
        url: rec.sourceUrl,
        publishedAt: enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: enactedDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: false,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          docId: rec.docId,
          slug: rec.slug,
          issuer: rec.issuer,
          status: rec.status,
          adoptedDate: rec.adoptedDate,
          inForceDate: rec.inForceDate,
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'CITES',
        ingestedBy: INGESTED_BY,
        autoApproved: false,
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

  console.log(`\n── ${PIPELINE}: Latvia Legislation (Saeima / likumi.lv) ──────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('lv-saeima', 'Latvian Saeima (Parliament)', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Parsing sitemaps for law candidates...')
  const allCandidates = await fetchAllCandidateIds()
  console.log(`  Total law-slug candidates: ${allCandidates.length}`)

  // For dry-run/sample: fetch only enough candidates to find the target N laws.
  // ~70% of slug candidates are confirmed laws, so 10x headroom is safe.
  const fetchCandidates = mode === 'dry-run'
    ? allCandidates.slice(0, 30)
    : mode === 'sample'
    ? allCandidates.slice(0, sampleN * 10)
    : (limit > 0 ? allCandidates.slice(0, limit * 3) : allCandidates)

  const fetchLimit = mode === 'dry-run' ? 20
    : mode === 'sample' ? sampleN
    : (limit > 0 ? limit : 0)

  console.log(`\nStep 3: Fetching ${fetchCandidates.length} detail pages (1.1s delay each)...`)
  const candidates = await fetchAllLaws(fetchCandidates, fetchLimit, verbose)
  console.log(`\nTotal confirmed laws: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 4: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      docId: r.docId,
      issuer: r.issuer,
      status: r.status,
      adoptedDate: r.adoptedDate,
      inForceDate: r.inForceDate,
      sourceUrl: r.sourceUrl,
      sourceName: r.sourceName,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: false,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      sitemapCandidates: allCandidates.length,
      confirmedLaws: candidates.length,
      note: 'Dry-run sampled first 30 slug candidates. Full run covers all ~1,100 slug candidates (~18 min).',
      sample,
    }

    fs.writeFileSync('pipeline-104-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-104-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample laws:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.adoptedDate || r.inForceDate}] ${r.claimText.slice(0, 100)}${r.claimText.length > 100 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample'
    ? candidates.slice(0, sampleN)
    : (limit > 0 ? candidates.slice(0, limit) : candidates)

  console.log(`\nStep 4: Writing ${rows.length} rows to DB (batches of 50, txn timeout 30s)...`)
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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.claimText.slice(0, 70)}`)
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
