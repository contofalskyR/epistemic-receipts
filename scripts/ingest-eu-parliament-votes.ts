// Pipeline — European Parliament Plenary Votes (eu_parliament_votes_v2)
// Goal: expand EU legislative votes from ~1,900 to 24k+ by ingesting the full
// HowTheyVote.eu roll-call dataset, which mirrors the European Parliament's
// published roll-call XML (DOCEO) with per-MEP positions and political-group
// breakdowns. The EP Open Data API (data.europarl.europa.eu/api/v2) exposes
// vote *metadata* as JSON-LD but does NOT include aggregate tallies or per-
// group breakdowns, so HTV — which extracts and normalises the same EP DOCEO
// records — is the canonical machine-readable source for the data we need.
//
// Each ingested vote becomes:
//   - one Source (externalId: eu_vote_htv_<id>, url: howtheyvote.eu/votes/<id>)
//   - one LegislativeVote (dataSource: eu_parliament_votes_v2)
//   - byPartyJson populated as { ShortLabel: { yes, no, abstain } } per political
//     group, computed by aggregating member_votes.csv by group_code.
//
// Run:
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-eu-parliament-votes.ts --dry-run --limit 20
//   ALLOW_EDITS=true npx ts-node --project tsconfig.scripts.json scripts/ingest-eu-parliament-votes.ts --limit 5000
//   ALLOW_EDITS=true npx ts-node --project tsconfig.scripts.json scripts/ingest-eu-parliament-votes.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import * as readline from 'readline'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

const prisma = new PrismaClient()

const INGESTED_BY = 'eu_parliament_votes_v2'
const RELEASE_TAG = '2026-05-16'
const CACHE_DIR = path.join(process.cwd(), '.cache', 'howtheyvote')
const HTV_BASE = `https://github.com/HowTheyVote/data/releases/download/${RELEASE_TAG}`
const BATCH_SIZE = 200

interface VoteRow {
  id: string
  timestamp: string
  display_title: string
  reference: string
  procedure_title: string
  procedure_reference: string
  is_main: boolean
  count_for: number
  count_against: number
  count_abstention: number
  count_did_not_vote: number
  result: string
  texts_adopted_reference: string
}

type PartyTally = { yes: number; no: number; abstain: number }
type PartyMap = Record<string, PartyTally>

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const li = args.indexOf('--limit')
  return {
    dryRun: args.includes('--dry-run'),
    limit: li !== -1 ? parseInt(args[li + 1] ?? '0', 10) || 0 : 0,
    verbose: args.includes('--verbose'),
  }
}

// ── CSV ───────────────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else inQuotes = false
      } else cur += ch
    } else {
      if (ch === ',') { out.push(cur); cur = '' }
      else if (ch === '"') inQuotes = true
      else cur += ch
    }
  }
  out.push(cur)
  return out
}

async function ensureCachedCsv(filename: string): Promise<string> {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
  const baseName = filename.replace(/\.gz$/, '')
  const csvPath = path.join(CACHE_DIR, `${path.basename(baseName, '.csv')}-${RELEASE_TAG}.csv`)
  if (fs.existsSync(csvPath)) return csvPath
  const url = `${HTV_BASE}/${filename}`
  console.log(`  Downloading ${filename}...`)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EpistemicReceipts/1.0' },
    redirect: 'follow',
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`)
  const tmpGz = path.join(CACHE_DIR, `${path.basename(baseName, '.csv')}-${RELEASE_TAG}.tmp.gz`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(tmpGz))
  await pipeline(fs.createReadStream(tmpGz), zlib.createGunzip(), fs.createWriteStream(csvPath))
  fs.unlinkSync(tmpGz)
  return csvPath
}

// ── Load reference data ───────────────────────────────────────────────────────

async function loadGroupShortLabels(): Promise<Map<string, string>> {
  const csvPath = await ensureCachedCsv('groups.csv.gz')
  const text = fs.readFileSync(csvPath, 'utf-8')
  const lines = text.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.length > 0)
  const header = parseCsvLine(lines[0]!)
  const iCode = header.indexOf('code')
  const iShort = header.indexOf('short_label')
  const iLabel = header.indexOf('label')
  const map = new Map<string, string>()
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]!)
    const code = f[iCode]
    if (!code) continue
    const label = (iShort !== -1 && f[iShort]) || (iLabel !== -1 && f[iLabel]) || code
    map.set(code, label)
  }
  return map
}

async function loadVotes(): Promise<VoteRow[]> {
  const csvPath = await ensureCachedCsv('votes.csv.gz')
  const text = fs.readFileSync(csvPath, 'utf-8')
  const lines = text.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.length > 0)
  const header = parseCsvLine(lines[0]!)
  const col = (name: string) => {
    const idx = header.indexOf(name)
    if (idx === -1) throw new Error(`votes.csv missing column: ${name}`)
    return idx
  }
  const iId = col('id')
  const iTs = col('timestamp')
  const iTitle = col('display_title')
  const iRef = col('reference')
  const iProcTitle = col('procedure_title')
  const iProcRef = col('procedure_reference')
  const iIsMain = col('is_main')
  const iFor = col('count_for')
  const iAgainst = col('count_against')
  const iAbs = col('count_abstention')
  const iDnv = col('count_did_not_vote')
  const iResult = col('result')
  const iTa = col('texts_adopted_reference')

  const out: VoteRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]!)
    const id = f[iId]
    if (!id) continue
    out.push({
      id,
      timestamp: f[iTs] ?? '',
      display_title: f[iTitle] ?? '',
      reference: f[iRef] ?? '',
      procedure_title: f[iProcTitle] ?? '',
      procedure_reference: f[iProcRef] ?? '',
      is_main: f[iIsMain] === 'True',
      count_for: parseInt(f[iFor] ?? '0', 10) || 0,
      count_against: parseInt(f[iAgainst] ?? '0', 10) || 0,
      count_abstention: parseInt(f[iAbs] ?? '0', 10) || 0,
      count_did_not_vote: parseInt(f[iDnv] ?? '0', 10) || 0,
      result: f[iResult] ?? '',
      texts_adopted_reference: f[iTa] ?? '',
    })
  }
  return out
}

async function streamPartyBreakdowns(
  relevantVoteIds: Set<string>,
  groupShortLabels: Map<string, string>,
): Promise<Map<string, PartyMap>> {
  const csvPath = await ensureCachedCsv('member_votes.csv.gz')
  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath),
    crlfDelay: Infinity,
  })

  let iVoteId = -1, iPos = -1, iGroup = -1
  let headerParsed = false
  let scanned = 0
  let relevantRows = 0
  const out = new Map<string, PartyMap>()

  for await (const line of rl) {
    if (!line.trim()) continue
    if (!headerParsed) {
      const f = parseCsvLine(line)
      iVoteId = f.indexOf('vote_id')
      iPos = f.indexOf('position')
      iGroup = f.indexOf('group_code')
      if (iVoteId === -1 || iPos === -1 || iGroup === -1) {
        throw new Error(`member_votes.csv missing required columns (got: ${f.join(',')})`)
      }
      headerParsed = true
      continue
    }
    scanned++
    if (scanned % 2_000_000 === 0) {
      process.stdout.write(`\r  Streamed ${(scanned / 1_000_000).toFixed(1)}M rows, ${relevantRows.toLocaleString()} relevant...`)
    }
    // Cheap pre-filter to skip the costly parseCsvLine for irrelevant rows.
    const commaIdx = line.indexOf(',')
    if (commaIdx === -1) continue
    const voteId = line.slice(0, commaIdx)
    if (!relevantVoteIds.has(voteId)) continue

    const f = parseCsvLine(line)
    const pos = f[iPos]
    const groupCode = f[iGroup]
    if (!groupCode) continue
    const label = groupShortLabels.get(groupCode) ?? groupCode

    let pm = out.get(voteId)
    if (!pm) { pm = {}; out.set(voteId, pm) }
    let tally = pm[label]
    if (!tally) { tally = { yes: 0, no: 0, abstain: 0 }; pm[label] = tally }
    if (pos === 'FOR') tally.yes++
    else if (pos === 'AGAINST') tally.no++
    else if (pos === 'ABSTENTION') tally.abstain++
    relevantRows++
  }

  process.stdout.write('\n')
  console.log(`  Done streaming: ${scanned.toLocaleString()} rows scanned, ${relevantRows.toLocaleString()} relevant`)
  return out
}

// ── Vote → DB row mapping ─────────────────────────────────────────────────────

function buildSourceName(v: VoteRow): string {
  const title = (v.display_title || v.procedure_title || '').trim()
  const ref = (v.reference || v.procedure_reference || '').trim()
  const base = title || ref || `EP Vote ${v.id}`
  // Tag amendment/sub-votes so titles aren't collisions across rows.
  if (!v.is_main && ref) return `${base} (${ref})`.slice(0, 500)
  return base.slice(0, 500)
}

function inferResult(v: VoteRow): string {
  // HTV result column is sometimes blank; fall back to counts.
  const r = (v.result || '').trim().toLowerCase()
  if (r === 'adopted') return 'passed'
  if (r === 'rejected') return 'failed'
  if (r === 'lapsed') return 'failed'
  if (r) return r
  if (v.count_for > v.count_against) return 'passed'
  if (v.count_against > v.count_for) return 'failed'
  if (v.count_for > 0 && v.count_for === v.count_against) return 'tied'
  return 'unknown'
}

function externalId(v: VoteRow): string {
  return `eu_vote_htv_${v.id}`
}

function sourceUrl(v: VoteRow): string {
  return `https://howtheyvote.eu/votes/${v.id}`
}

function parseTimestamp(ts: string): Date | null {
  if (!ts) return null
  const iso = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit, verbose } = parseArgs()

  console.log(`\n── EU Parliament Votes Ingest (${INGESTED_BY}) ──`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'full'} | Limit: ${limit || 'all'} | Release: ${RELEASE_TAG}`)

  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to enable DB writes.')
    process.exit(1)
  }

  console.log('\nStep 1: Load votes.csv + groups.csv...')
  const groupLabels = await loadGroupShortLabels()
  console.log(`  ${groupLabels.size} political groups`)
  const allVotes = await loadVotes()
  console.log(`  ${allVotes.length.toLocaleString()} HTV vote rows`)

  // Apply limit (newest first — better signal in --limit runs)
  allVotes.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
  const votes = limit > 0 ? allVotes.slice(0, limit) : allVotes
  console.log(`  Processing ${votes.length.toLocaleString()} (after limit)`)

  console.log('\nStep 2: Identify already-ingested sources...')
  const allExtIds = votes.map(externalId)
  // chunk to avoid Prisma query length cap
  const existing = new Set<string>()
  for (let i = 0; i < allExtIds.length; i += 5000) {
    const chunk = allExtIds.slice(i, i + 5000)
    const found = await prisma.source.findMany({
      where: { externalId: { in: chunk } },
      select: { externalId: true },
    })
    for (const s of found) if (s.externalId) existing.add(s.externalId)
  }
  const toIngest = votes.filter(v => !existing.has(externalId(v)))
  console.log(`  ${existing.size.toLocaleString()} already ingested, ${toIngest.length.toLocaleString()} to write`)

  if (toIngest.length === 0) {
    console.log('Nothing to do.')
    await prisma.$disconnect()
    return
  }

  console.log('\nStep 3: Stream member_votes.csv for political-group breakdowns...')
  const relevantIds = new Set(toIngest.map(v => v.id))
  const partyMaps = await streamPartyBreakdowns(relevantIds, groupLabels)
  console.log(`  Built breakdowns for ${partyMaps.size.toLocaleString()} of ${relevantIds.size.toLocaleString()} votes`)

  if (dryRun) {
    console.log('\nStep 4: Dry-run preview (no DB writes)...')
    const sample = toIngest.slice(0, 5)
    for (const v of sample) {
      const pm = partyMaps.get(v.id) ?? {}
      const groupSummary = Object.entries(pm)
        .map(([g, t]) => `${g}: ${t.yes}-${t.no}-${t.abstain}`)
        .join(' · ')
      console.log(`  ${v.timestamp.slice(0, 10)} [${v.id}] ${buildSourceName(v).slice(0, 80)}`)
      console.log(`    ${v.count_for} for / ${v.count_against} against / ${v.count_abstention} abstain → ${inferResult(v)}`)
      console.log(`    groups: ${groupSummary || '(no per-MEP positions in dataset for this vote)'}`)
      console.log(`    url: ${sourceUrl(v)}`)
    }
    const decade: Record<string, number> = {}
    for (const v of toIngest) {
      const y = (v.timestamp || '').slice(0, 4)
      if (!y) continue
      const d = `${Math.floor(parseInt(y, 10) / 10) * 10}s`
      decade[d] = (decade[d] ?? 0) + 1
    }
    console.log('\n  Distribution by decade:')
    for (const [d, n] of Object.entries(decade).sort()) console.log(`    ${d}: ${n.toLocaleString()}`)
    console.log('\nDry-run complete.')
    await prisma.$disconnect()
    return
  }

  console.log('\nStep 4: Writing Source + LegislativeVote rows in batches...')
  const startTime = Date.now()
  let written = 0
  let failed = 0

  for (let i = 0; i < toIngest.length; i += BATCH_SIZE) {
    const batch = toIngest.slice(i, i + BATCH_SIZE)
    try {
      await prisma.$transaction(async (tx) => {
        // Bulk insert sources
        const sourceRows = batch.map(v => ({
          externalId: externalId(v),
          name: buildSourceName(v),
          url: sourceUrl(v),
          publishedAt: parseTimestamp(v.timestamp),
          methodologyType: 'primary',
          ingestedBy: INGESTED_BY,
          autoApproved: true,
          humanReviewed: false,
        }))
        await tx.source.createMany({ data: sourceRows, skipDuplicates: true })

        // Fetch source IDs for this batch
        const sources = await tx.source.findMany({
          where: { externalId: { in: batch.map(externalId) } },
          select: { id: true, externalId: true },
        })
        const srcByExt = new Map(sources.map(s => [s.externalId!, s.id]))

        const voteRows = batch.flatMap(v => {
          const sourceId = srcByExt.get(externalId(v))
          if (!sourceId) return []
          const pm = partyMaps.get(v.id)
          const byPartyJson = pm && Object.keys(pm).length > 0 ? JSON.stringify(pm) : null
          return [{
            sourceId,
            chamber: 'European Parliament',
            yesCount: v.count_for,
            noCount: v.count_against,
            abstainCount: v.count_abstention,
            totalSeats: v.count_for + v.count_against + v.count_abstention + v.count_did_not_vote,
            passageThreshold: 'simple_majority',
            voteDate: parseTimestamp(v.timestamp),
            passageType: 'legislative_vote',
            byPartyJson,
            dataSource: INGESTED_BY,
            result: inferResult(v),
          }]
        })
        await tx.legislativeVote.createMany({ data: voteRows })
      }, { timeout: 30000 })
      written += batch.length
      if (verbose || i % (BATCH_SIZE * 10) === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        process.stdout.write(`\r  ${written.toLocaleString()}/${toIngest.length.toLocaleString()} written (${elapsed}s)...`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`\n  Batch ${i}-${i + batch.length} failed: ${msg}`)
      failed += batch.length
    }
  }

  process.stdout.write('\n')
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nInsertion complete in ${elapsed}s. Written: ${written.toLocaleString()} | Failed: ${failed}`)

  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbVotes = await prisma.legislativeVote.count({ where: { dataSource: INGESTED_BY } })
  console.log(`Post-run DB state — ${INGESTED_BY}: ${dbSources.toLocaleString()} sources, ${dbVotes.toLocaleString()} legislative votes`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
