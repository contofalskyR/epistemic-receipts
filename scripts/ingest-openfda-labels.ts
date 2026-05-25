// openFDA Drug Labels ingester — pipeline tag: openfda_labels_v1
// Endpoint: https://api.fda.gov/drug/label.json
// API key: OPENFDA_API_KEY in .env.local (240 req/min when authenticated)
// Run:
//   npx tsx scripts/ingest-openfda-labels.ts --dry-run                (discover partitions, no record fetch)
//   npx tsx scripts/ingest-openfda-labels.ts --dry-run --limit 50     (discover + sample 50 records)
//   npx tsx scripts/ingest-openfda-labels.ts --limit 1000
//   npx tsx scripts/ingest-openfda-labels.ts                          (full run, ~258k records)
//
// Partitioning: openFDA caps `skip + limit ≤ 25_000` per query, so a single
// search cannot enumerate the full 258k-record corpus. The script discovers
// partitions by binary-splitting the effective_time date range, probing each
// subrange's `meta.results.total` until every partition has ≤ 25k records.
// Each partition is then paginated independently via `search=effective_time:
// [start TO end]`. The sum of partition totals is asserted against the global
// server total before any fetching begins.
//
// Architectural note (see CONSULTANT.md changelog 2026-05-21):
// Drug-label records may be background-tier under AGENTS.md (similar to
// individual FAERS reports). This script was built per explicit task brief.
// Full-run candidates should be reviewed against the reference-tier test
// before a production run.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INGESTED_BY = 'openfda_labels_v1'
const ENDPOINT = 'https://api.fda.gov/drug/label.json'
const PAGE_SIZE = 100 // openFDA accepts up to 1000; left at 100 to limit blast radius of this fix
const DELAY_MS = 300 // ~200 req/min, under 240/min authenticated limit
const PROGRESS_EVERY = 500
const TEXT_TRUNCATE = 500
const API_KEY = process.env.OPENFDA_API_KEY ?? ''

// openFDA caps the highest result index at `skip + limit ≤ 25_000` per query.
// A partition with `total ≤ 25_000` is fully retrievable; anything larger must
// be subdivided further (see discoverPartitions). The cap is inclusive — total
// = 25,000 fits exactly (skip=24,000 + limit=1,000 = 25,000).
const OPENFDA_PARTITION_CAP = 25000

// Date-range window for partition discovery. Live data spans 1970-2029 today;
// a wider window costs only a few extra probe requests against empty subranges.
const PARTITION_START_DATE = '19000101'
const PARTITION_END_DATE = '20991231'

// ── Types ────────────────────────────────────────────────────────────────────

interface OpenFDALabelMeta {
  results?: { skip?: number; limit?: number; total?: number }
  last_updated?: string
}

interface OpenFDALabelResponse {
  meta?: OpenFDALabelMeta
  results?: DrugLabel[]
  error?: { code: string; message: string }
}

interface DrugLabel {
  id?: string
  effective_time?: string
  purpose?: string[]
  description?: string[]
  indications_and_usage?: string[]
  openfda?: {
    brand_name?: string[]
    generic_name?: string[]
    manufacturer_name?: string[]
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

interface Args {
  dryRun: boolean
  limit: number | null
  verbose: boolean
}

function parseArgs(): Args {
  const a = process.argv.slice(2)
  const dryRun = a.includes('--dry-run')
  const verbose = a.includes('--verbose')
  const limitIdx = a.indexOf('--limit')
  let limit: number | null = null
  if (limitIdx !== -1 && a[limitIdx + 1]) {
    const n = parseInt(a[limitIdx + 1], 10)
    if (!isNaN(n) && n > 0) limit = n
  }
  return { dryRun, limit, verbose }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function parseEffectiveTime(s: string | undefined): Date | null {
  if (!s || s.length < 8) return null
  const year = parseInt(s.slice(0, 4), 10)
  const month = parseInt(s.slice(4, 6), 10) - 1
  const day = parseInt(s.slice(6, 8), 10)
  const d = new Date(Date.UTC(year, month, day))
  return isNaN(d.getTime()) ? null : d
}

function buildClaimText(label: DrugLabel): string | null {
  const brand = label.openfda?.brand_name?.[0]?.trim()
  const generic = label.openfda?.generic_name?.[0]?.trim()
  if (!brand && !generic) return null

  const head = brand && generic
    ? `${brand} (${generic})`
    : (brand ?? generic)!

  const bodyRaw =
    label.purpose?.[0]
    ?? label.indications_and_usage?.[0]
    ?? label.description?.[0]
    ?? ''
  const body = bodyRaw.replace(/\s+/g, ' ').trim()
  if (!body) return `${head}: (no purpose or indication on label)`

  const remaining = TEXT_TRUNCATE - head.length - 2 // ": "
  if (remaining <= 0) return head.slice(0, TEXT_TRUNCATE)
  const truncatedBody = body.length > remaining
    ? body.slice(0, remaining - 1) + '…'
    : body
  return `${head}: ${truncatedBody}`
}

function buildSourceUrl(labelId: string): string {
  return `${ENDPOINT}?search=id:${encodeURIComponent(labelId)}`
}

function buildFetchUrl(skip: number, limit: number, search?: string): string {
  const u = new URL(ENDPOINT)
  if (search) u.searchParams.set('search', search)
  u.searchParams.set('limit', String(limit))
  u.searchParams.set('skip', String(skip))
  if (API_KEY) u.searchParams.set('api_key', API_KEY)
  return u.toString()
}

async function fetchPage(skip: number, limit: number, search?: string): Promise<OpenFDALabelResponse> {
  const url = buildFetchUrl(skip, limit, search)
  const maxAttempts = 5
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url)
      if (res.status === 429) {
        console.warn(`  Rate limited at skip=${skip} (attempt ${attempt}), sleeping 30s and retrying...`)
        await sleep(30000)
        continue
      }
      if (res.status >= 500) {
        console.warn(`  Server ${res.status} at skip=${skip} (attempt ${attempt}), sleeping 15s and retrying...`)
        await sleep(15000)
        continue
      }
      return res.json() as Promise<OpenFDALabelResponse>
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (attempt === maxAttempts) throw e
      const backoff = Math.min(60_000, 5000 * 2 ** (attempt - 1))
      console.warn(`  Network error at skip=${skip} (attempt ${attempt}/${maxAttempts}): ${msg}. Sleeping ${backoff / 1000}s...`)
      await sleep(backoff)
    }
  }
  throw new Error(`fetchPage exhausted ${maxAttempts} attempts at skip=${skip}`)
}

// ── Partition discovery ──────────────────────────────────────────────────────

interface Partition {
  start: string // YYYYMMDD inclusive
  end: string // YYYYMMDD inclusive
  total: number
}

function parseYYYYMMDD(s: string): Date {
  return new Date(Date.UTC(
    parseInt(s.slice(0, 4), 10),
    parseInt(s.slice(4, 6), 10) - 1,
    parseInt(s.slice(6, 8), 10),
  ))
}

function formatYYYYMMDD(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, '0')
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = d.getUTCDate().toString().padStart(2, '0')
  return `${y}${m}${day}`
}

function addDaysUTC(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000)
}

function midpointDayUTC(start: Date, end: Date): Date {
  // Floor to day so the split aligns on a date boundary and the right partition
  // can start at (mid + 1 day) without overlap or gap.
  const midMs = Math.floor((start.getTime() + end.getTime()) / 2)
  const mid = new Date(midMs)
  return new Date(Date.UTC(mid.getUTCFullYear(), mid.getUTCMonth(), mid.getUTCDate()))
}

async function probeRangeTotal(start: string, end: string): Promise<number> {
  const url = buildFetchUrl(0, 1, `effective_time:[${start} TO ${end}]`)
  const maxAttempts = 5
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url)
      if (res.status === 429) {
        console.warn(`  Probe rate-limited on [${start} TO ${end}] (attempt ${attempt}), sleeping 30s...`)
        await sleep(30000)
        continue
      }
      if (res.status >= 500) {
        console.warn(`  Probe server ${res.status} on [${start} TO ${end}] (attempt ${attempt}), sleeping 15s...`)
        await sleep(15000)
        continue
      }
      const data = (await res.json()) as OpenFDALabelResponse
      if (data.error) {
        if (data.error.code === 'NOT_FOUND') return 0
        throw new Error(`probe [${start} TO ${end}] failed: ${data.error.code} — ${data.error.message}`)
      }
      return data.meta?.results?.total ?? 0
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (attempt === maxAttempts) throw e
      const backoff = Math.min(60_000, 5000 * 2 ** (attempt - 1))
      console.warn(`  Probe network error on [${start} TO ${end}] (attempt ${attempt}/${maxAttempts}): ${msg}. Sleeping ${backoff / 1000}s...`)
      await sleep(backoff)
    }
  }
  throw new Error(`probeRangeTotal exhausted ${maxAttempts} attempts on [${start} TO ${end}]`)
}

async function discoverPartitions(
  startStr: string,
  endStr: string,
  depth = 0,
  onProbe?: (depth: number, total: number, start: string, end: string) => void,
): Promise<Partition[]> {
  await sleep(DELAY_MS)
  const total = await probeRangeTotal(startStr, endStr)
  onProbe?.(depth, total, startStr, endStr)
  if (total === 0) return []
  if (total <= OPENFDA_PARTITION_CAP) {
    return [{ start: startStr, end: endStr, total }]
  }

  const startDate = parseYYYYMMDD(startStr)
  const endDate = parseYYYYMMDD(endStr)
  // Single-day partition still over the cap — give up subdividing on date;
  // we'd need a secondary partition key (e.g. openfda.product_type). For now
  // accept the partial-retrieval risk and warn loudly.
  if (startDate.getTime() >= endDate.getTime()) {
    console.warn(
      `  ⚠ Single day ${startStr} has ${total.toLocaleString('en-US')} records — exceeds cap (${OPENFDA_PARTITION_CAP.toLocaleString('en-US')}). ` +
        `Only the first ${OPENFDA_PARTITION_CAP.toLocaleString('en-US')} will be retrievable in this partition.`,
    )
    return [{ start: startStr, end: endStr, total }]
  }

  const mid = midpointDayUTC(startDate, endDate)
  const leftEnd = formatYYYYMMDD(mid)
  const rightStart = formatYYYYMMDD(addDaysUTC(mid, 1))
  const left = await discoverPartitions(startStr, leftEnd, depth + 1, onProbe)
  const right = await discoverPartitions(rightStart, endStr, depth + 1, onProbe)
  return [...left, ...right]
}

// ── Per-label write ──────────────────────────────────────────────────────────

type WriteResult = 'ingested' | 'skipped' | 'error'

async function writeLabel(label: DrugLabel): Promise<{ result: WriteResult; reason?: string }> {
  const labelId = label.id
  if (!labelId) return { result: 'error', reason: 'missing id' }

  const claimText = buildClaimText(label)
  if (!claimText) return { result: 'error', reason: 'no brand_name or generic_name' }

  const sourceUrl = buildSourceUrl(labelId)
  const brand = label.openfda?.brand_name?.[0]?.trim() ?? null
  const generic = label.openfda?.generic_name?.[0]?.trim() ?? null
  const displayName = brand ?? generic ?? labelId
  const sourceName = `${displayName} FDA Label`
  const publishedAt = parseEffectiveTime(label.effective_time)

  // Dedup by source URL (per brief). externalId on Claim/Source acts as a
  // belt-and-suspenders unique constraint.
  const existingSource = await prisma.source.findFirst({
    where: { url: sourceUrl, ingestedBy: INGESTED_BY },
    select: { id: true },
  })
  if (existingSource) return { result: 'skipped', reason: 'already ingested' }

  const externalId = `openfda_label_${labelId}`
  const existingByExternalId = await prisma.claim.findUnique({
    where: { externalId },
    select: { id: true },
  })
  if (existingByExternalId) return { result: 'skipped', reason: 'externalId exists' }

  try {
    await prisma.$transaction(async tx => {
      const claim = await tx.claim.create({
        data: {
          text: claimText,
          claimType: 'INSTITUTIONAL',
          currentStatus: 'HARD_FACT',
          verificationStatus: 'VERIFIED',
          autoApproved: true,
          humanReviewed: false,
          ingestedBy: INGESTED_BY,
          externalId,
          claimEmergedAt: publishedAt,
          claimEmergedPrecision: publishedAt ? 'DAY' : null,
          metadata: {
            category: 'MEDICINE',
            dataset: 'openFDA drug label',
            labelId,
            brand_name: brand,
            generic_name: generic,
            manufacturer_name: label.openfda?.manufacturer_name?.[0] ?? null,
            effective_time: label.effective_time ?? null,
            indications_and_usage_present: !!label.indications_and_usage?.length,
            purpose_present: !!label.purpose?.length,
          },
        },
      })

      const source = await tx.source.create({
        data: {
          name: sourceName,
          url: sourceUrl,
          publishedAt,
          methodologyType: 'primary',
          ingestedBy: INGESTED_BY,
          externalId: `openfda_label_source_${labelId}`,
          autoApproved: true,
        },
      })

      const edge = await tx.edge.create({
        data: {
          claimId: claim.id,
          sourceId: source.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: INGESTED_BY,
          autoApproved: true,
        },
      })

      await tx.edgeRevision.create({
        data: {
          edgeId: edge.id,
          newScore: 100,
          reason: 'openFDA drug label — FOR / strength 1.0',
        },
      })
    }, { timeout: 30000 })

    return { result: 'ingested' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { result: 'error', reason: msg }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit, verbose } = parseArgs()

  console.log(`\n── Pipeline: openFDA Drug Labels (${INGESTED_BY}) ──`)
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'WRITE'} | Limit: ${limit ?? 'none (full)'}`)
  if (!API_KEY) {
    console.warn('  WARNING: OPENFDA_API_KEY not set — rate limit will be 40 req/min')
  } else {
    console.log('  OPENFDA_API_KEY present')
  }
  console.log('')

  // ── Phase 1: discover partitions ───────────────────────────────────────────
  console.log(`Discovering effective_time partitions ([${PARTITION_START_DATE} TO ${PARTITION_END_DATE}])...`)
  const probeStart = Date.now()
  const globalTotal = await probeRangeTotal(PARTITION_START_DATE, PARTITION_END_DATE)
  console.log(`  Server-reported total in window: ${globalTotal.toLocaleString('en-US')}`)

  const partitions = await discoverPartitions(
    PARTITION_START_DATE,
    PARTITION_END_DATE,
    0,
    verbose
      ? (depth, total, s, e) =>
          console.log(`  probe d=${depth} [${s} TO ${e}] → ${total.toLocaleString('en-US')}`)
      : undefined,
  )
  const partitionSum = partitions.reduce((s, p) => s + p.total, 0)
  const probeElapsed = ((Date.now() - probeStart) / 1000).toFixed(1)
  console.log(
    `  Discovered ${partitions.length} partition(s) summing to ${partitionSum.toLocaleString('en-US')} ` +
      `(server total ${globalTotal.toLocaleString('en-US')}, ${probeElapsed}s).`,
  )

  if (partitionSum !== globalTotal) {
    console.error(
      `  ✗ Partition sum (${partitionSum}) does not match server total (${globalTotal}). ` +
        `Aborting before any record fetch — partitioning is unsound.`,
    )
    process.exit(1)
  }
  console.log(`  ✓ Partition sum matches server total.`)

  for (const p of partitions) {
    console.log(`    [${p.start} TO ${p.end}] ${p.total.toLocaleString('en-US')}`)
  }

  // If dry-run and no limit specified, the partition map IS the verification.
  // Skip fetching individual records — that path is already exercised by the
  // pre-partitioning dry-run history and is no longer the interesting question.
  if (dryRun && limit === null) {
    console.log(`\n── Summary ──`)
    console.log(`  Mode                 : DRY-RUN (partition discovery only)`)
    console.log(`  Partitions discovered: ${partitions.length}`)
    console.log(`  Sum of partitions    : ${partitionSum.toLocaleString('en-US')}`)
    console.log(`  Server total         : ${globalTotal.toLocaleString('en-US')}`)
    console.log(`  Match                : ${partitionSum === globalTotal ? 'YES ✓' : 'NO ✗'}`)
    console.log(`  Probe time           : ${probeElapsed}s`)
    console.log(`  (Pass --limit N to also sample N records across partitions.)`)
    return
  }

  // ── Phase 2: iterate partitions ────────────────────────────────────────────
  let totalSeen = 0
  let ingested = 0
  let skipped = 0
  let errors = 0
  const errorSamples: Array<{ id?: string; reason: string }> = []
  const dryRunSample: Array<Record<string, unknown>> = []
  const startTime = Date.now()

  partitions: for (const part of partitions) {
    if (limit !== null && totalSeen >= limit) break
    const search = `effective_time:[${part.start} TO ${part.end}]`
    let skip = 0
    if (verbose) {
      console.log(`\n  Partition [${part.start} TO ${part.end}] expected ${part.total.toLocaleString('en-US')}`)
    }

    while (skip < part.total) {
      const remainingInPartition = part.total - skip
      const remainingInLimit = limit !== null ? limit - totalSeen : Infinity
      const pageLimit = Math.min(PAGE_SIZE, remainingInPartition, remainingInLimit)
      if (pageLimit <= 0) break

      // Safety net — should never trip because discoverPartitions guarantees
      // part.total ≤ OPENFDA_PARTITION_CAP, so skip + pageLimit ≤ part.total
      // ≤ OPENFDA_PARTITION_CAP. Defense-in-depth in case a partition somehow
      // grew between discovery and iteration.
      if (skip + pageLimit > OPENFDA_PARTITION_CAP) {
        console.warn(
          `  ⚠ Partition cap reached in [${part.start} TO ${part.end}] at skip=${skip}. Stopping this partition.`,
        )
        break
      }

      const data = await fetchPage(skip, pageLimit, search)

      if (data.error) {
        if (data.error.code === 'NOT_FOUND') {
          if (verbose) console.log(`    NOT_FOUND at skip=${skip} — partition end.`)
          break
        }
        const isPaginationLimit =
          data.error.code === 'BAD_REQUEST' &&
          /skip|pagination|limit/i.test(data.error.message)
        if (isPaginationLimit) {
          console.warn(
            `  ⚠ Unexpected pagination error in [${part.start} TO ${part.end}] at skip=${skip}: ` +
              `${data.error.code} — ${data.error.message}. Stopping this partition.`,
          )
          break
        }
        console.error(
          `  openFDA error in [${part.start} TO ${part.end}] at skip=${skip}: ` +
            `${data.error.code} — ${data.error.message}`,
        )
        errors++
        break
      }

      const results = data.results ?? []
      if (results.length === 0) {
        if (verbose) console.log(`    Empty page at skip=${skip} — partition end.`)
        break
      }

      for (const label of results) {
        totalSeen++

        if (dryRun) {
          const text = buildClaimText(label)
          if (!text) {
            errors++
            if (errorSamples.length < 10) {
              errorSamples.push({ id: label.id, reason: 'no brand_name or generic_name' })
            }
            continue
          }
          if (dryRunSample.length < 5) {
            dryRunSample.push({
              externalId: `openfda_label_${label.id}`,
              text,
              claimType: 'INSTITUTIONAL',
              currentStatus: 'HARD_FACT',
              verificationStatus: 'VERIFIED',
              ingestedBy: INGESTED_BY,
              sourceUrl: buildSourceUrl(label.id ?? ''),
              effective_time: label.effective_time ?? null,
              partition: `${part.start}-${part.end}`,
            })
          }
          ingested++ // counted as "would ingest"
        } else {
          try {
            const { result, reason } = await writeLabel(label)
            if (result === 'ingested') {
              ingested++
              if (verbose) console.log(`  [ingested] ${label.id} — ${label.openfda?.brand_name?.[0] ?? label.openfda?.generic_name?.[0] ?? '?'}`)
            } else if (result === 'skipped') {
              skipped++
            } else {
              errors++
              if (errorSamples.length < 25) {
                errorSamples.push({ id: label.id, reason: reason ?? 'unknown' })
              }
              if (verbose) console.warn(`  [error] ${label.id}: ${reason}`)
            }
          } catch (e) {
            // Belt-and-suspenders — writeLabel catches internally, but a thrown
            // error here (e.g. connection blip outside the transaction) must not
            // halt pagination.
            errors++
            const msg = e instanceof Error ? e.message : String(e)
            if (errorSamples.length < 25) {
              errorSamples.push({ id: label.id, reason: `outer: ${msg}` })
            }
            console.error(`  [fatal-row-skipped] ${label.id}: ${msg}`)
          }
        }

        if (totalSeen % PROGRESS_EVERY === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
          console.log(`  Progress: seen=${totalSeen} ingested=${ingested} skipped=${skipped} errors=${errors} (${elapsed}s)`)
        }

        if (limit !== null && totalSeen >= limit) break partitions
      }

      skip += results.length
      if (results.length < pageLimit) {
        if (verbose) console.log(`    Partial page (${results.length} < ${pageLimit}) — partition end.`)
        break
      }
      await sleep(DELAY_MS)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n── Summary ──`)
  console.log(`  Mode               : ${dryRun ? 'DRY-RUN' : 'WRITE'}`)
  console.log(`  Partitions         : ${partitions.length}`)
  console.log(`  Expected (sum)     : ${partitionSum.toLocaleString('en-US')}`)
  console.log(`  Total seen         : ${totalSeen}`)
  console.log(`  ${dryRun ? 'Would ingest' : 'Ingested'}     : ${ingested}`)
  console.log(`  Skipped            : ${skipped}`)
  console.log(`  Errors             : ${errors}`)
  console.log(`  Elapsed (fetch)    : ${elapsed}s`)
  console.log(`  Server total       : ${globalTotal.toLocaleString('en-US')}`)

  if (errorSamples.length > 0) {
    console.log(`\n  Sample errors (first ${errorSamples.length}):`)
    for (const e of errorSamples) {
      console.log(`    ${e.id ?? '(no id)'}: ${e.reason}`)
    }
  }

  if (dryRun && dryRunSample.length > 0) {
    console.log(`\n  Dry-run sample (first ${dryRunSample.length}):`)
    console.log(JSON.stringify(dryRunSample, null, 2))
  }

  if (!dryRun) {
    const dbCount = await prisma.claim.count({
      where: { ingestedBy: INGESTED_BY, deleted: false },
    })
    console.log(`\n  DB verification: claim.count({ ingestedBy: '${INGESTED_BY}' }) = ${dbCount}`)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
