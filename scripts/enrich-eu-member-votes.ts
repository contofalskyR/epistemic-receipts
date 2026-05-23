// Enrichment: EU Parliament individual MEP votes via HowTheyVote.eu
// Downloads member_votes.csv.gz + members.csv.gz from the 2026-05-16 release,
// streams them, and creates MemberVote records for each LegislativeVote with
// dataSource='howtheyvote_eu'.
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-eu-member-votes.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-eu-member-votes.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import * as readline from 'readline'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

const prisma = new PrismaClient()
const RELEASE_TAG = '2026-05-16'
const CACHE_DIR = path.join(process.cwd(), '.cache', 'howtheyvote')
const HTV_BASE = `https://github.com/HowTheyVote/data/releases/download/${RELEASE_TAG}`

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --full [--limit N] [--verbose]')
        process.exit(1) as never
      })()
  const li = args.indexOf('--limit')
  return {
    mode: mode as 'dry-run' | 'full',
    limit: li !== -1 ? parseInt(args[li + 1] ?? '0', 10) : 0,
    verbose: args.includes('--verbose'),
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ── CSV parser (same as enrich-vote-counts.ts) ────────────────────────────────

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
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

// ── Download and decompress a .csv.gz from the HTV release ───────────────────

async function ensureCachedCsv(filename: string): Promise<string> {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
  const baseName = filename.replace(/\.gz$/, '')
  const csvPath = path.join(CACHE_DIR, `${path.basename(baseName, '.csv')}-${RELEASE_TAG}.csv`)
  if (fs.existsSync(csvPath)) {
    console.log(`  Cache hit: ${path.basename(csvPath)}`)
    return csvPath
  }
  const url = `${HTV_BASE}/${filename}`
  console.log(`  Downloading ${filename} from ${url}...`)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EpistemicReceipts/1.0' },
    redirect: 'follow',
  })
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status} for ${url}`)
  const tmpGz = path.join(CACHE_DIR, `${path.basename(baseName, '.csv')}-${RELEASE_TAG}.tmp.gz`)
  await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(tmpGz))
  await pipeline(fs.createReadStream(tmpGz), zlib.createGunzip(), fs.createWriteStream(csvPath))
  fs.unlinkSync(tmpGz)
  console.log(`  Cached: ${path.basename(csvPath)}`)
  return csvPath
}

// ── Convert ep_src_TA-9-2022-0040 → P9_TA(2022)0040 ─────────────────────────

function externalIdToTaRef(extId: string): string | null {
  const m = extId.match(/^ep_src_TA-(\d+)-(\d{4})-(\d+)$/)
  if (!m) return null
  const [, term, year, num] = m
  return `P${term}_TA(${year})${num!.padStart(4, '0')}`
}

// ── Build taRef → best vote_id from the cached votes.csv ─────────────────────
// Multiple vote_ids can share the same taRef; prefer is_main=True, then latest timestamp.

function loadTaRefToVoteId(): Map<string, string> {
  const csvPath = path.join(CACHE_DIR, `votes-${RELEASE_TAG}.csv`)
  if (!fs.existsSync(csvPath)) {
    throw new Error(
      `votes.csv not found at ${csvPath}. Run enrich-vote-counts.ts --country eu first to cache it.`
    )
  }

  const text = fs.readFileSync(csvPath, 'utf-8')
  const lines = text.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.length > 0)
  const header = parseCsvLine(lines[0]!)

  const col = (name: string) => {
    const idx = header.indexOf(name)
    if (idx === -1) throw new Error(`votes.csv missing column: ${name}`)
    return idx
  }
  const iId = col('id')
  const iTa = col('texts_adopted_reference')
  const iIsMain = col('is_main')
  const iTs = col('timestamp')

  // taRef → { voteId, isMain, timestamp }
  const best = new Map<string, { voteId: string; isMain: boolean; timestamp: string }>()

  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]!)
    const voteId = f[iId]
    const taRef = f[iTa]
    if (!voteId || !taRef) continue
    const isMain = f[iIsMain] === 'True'
    const ts = f[iTs] ?? ''
    const existing = best.get(taRef)
    if (!existing) {
      best.set(taRef, { voteId, isMain, timestamp: ts })
    } else if (isMain && !existing.isMain) {
      best.set(taRef, { voteId, isMain, timestamp: ts })
    } else if (isMain === existing.isMain && ts > existing.timestamp) {
      best.set(taRef, { voteId, isMain, timestamp: ts })
    }
  }

  const result = new Map<string, string>()
  Array.from(best.entries()).forEach(([taRef, { voteId }]) => result.set(taRef, voteId))
  console.log(`  Loaded ${result.size} taRef → voteId mappings from votes.csv`)
  return result
}

// ── Position → vote label ─────────────────────────────────────────────────────

function mapPosition(pos: string): string {
  switch (pos) {
    case 'FOR': return 'Yea'
    case 'AGAINST': return 'Nay'
    case 'ABSTENTION': return 'Abstain'
    case 'DID_NOT_VOTE': return 'Not Voting'
    default: return pos
  }
}

// ── Load members.csv → member_id → { name, country } ─────────────────────────

interface MemberInfo {
  name: string
  country: string | null
  group: string | null
}

async function loadMemberMap(): Promise<Map<string, MemberInfo>> {
  const csvPath = await ensureCachedCsv('members.csv.gz')
  const text = fs.readFileSync(csvPath, 'utf-8')
  const lines = text.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.length > 0)
  const header = parseCsvLine(lines[0]!)
  console.log(`  members.csv columns: ${header.join(', ')}`)

  const iId = header.indexOf('id')
  const iFirst = header.indexOf('first_name')
  const iLast = header.indexOf('last_name')
  const iCountry = header.indexOf('country')

  if (iId === -1) throw new Error('members.csv missing "id" column')

  const map = new Map<string, MemberInfo>()
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]!)
    const id = f[iId]
    if (!id) continue
    const firstName = iFirst !== -1 ? (f[iFirst] ?? '') : ''
    const lastName = iLast !== -1 ? (f[iLast] ?? '') : ''
    const name = `${firstName} ${lastName}`.trim() || `MEP ${id}`
    const country = iCountry !== -1 ? (f[iCountry] || null) : null
    map.set(id, { name, country, group: null })
  }

  console.log(`  Loaded ${map.size} MEP member records`)
  return map
}

// ── Load group_memberships + groups → member_id → group abbreviation ──────────

async function loadGroupMap(): Promise<Map<string, string>> {
  // groups.csv: id → short label / abbreviation
  let groupsCsvPath: string
  try {
    groupsCsvPath = await ensureCachedCsv('groups.csv.gz')
  } catch {
    console.warn('  groups.csv.gz unavailable — group abbreviations will be missing')
    return new Map()
  }

  const groupsText = fs.readFileSync(groupsCsvPath, 'utf-8')
  const groupsLines = groupsText.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.length > 0)
  const groupsHeader = parseCsvLine(groupsLines[0]!)
  console.log(`  groups.csv columns: ${groupsHeader.join(', ')}`)

  const iGId = groupsHeader.indexOf('id')
  // Try common column names for the abbreviation
  const iAbbr = ['abbreviation', 'abbr', 'short_label', 'code'].reduce(
    (found, name) => found !== -1 ? found : groupsHeader.indexOf(name),
    -1
  )

  const groupIdToAbbr = new Map<string, string>()
  for (let i = 1; i < groupsLines.length; i++) {
    const f = parseCsvLine(groupsLines[i]!)
    const gid = iGId !== -1 ? f[iGId] : null
    if (!gid) continue
    const abbr = iAbbr !== -1 ? (f[iAbbr] || null) : null
    if (abbr) groupIdToAbbr.set(gid, abbr)
  }
  console.log(`  Loaded ${groupIdToAbbr.size} group abbreviations`)

  // group_memberships.csv: member_id, group_id, (optional) start_date / end_date
  let gmCsvPath: string
  try {
    gmCsvPath = await ensureCachedCsv('group_memberships.csv.gz')
  } catch {
    console.warn('  group_memberships.csv.gz unavailable — will rely on member_votes group_id column')
    return new Map()
  }

  const gmText = fs.readFileSync(gmCsvPath, 'utf-8')
  const gmLines = gmText.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.length > 0)
  const gmHeader = parseCsvLine(gmLines[0]!)
  console.log(`  group_memberships.csv columns: ${gmHeader.join(', ')}`)

  const iMembId = gmHeader.indexOf('member_id')
  const iGrpId = gmHeader.indexOf('group_id')
  const iEnd = gmHeader.indexOf('end_date')

  if (iMembId === -1 || iGrpId === -1) {
    console.warn('  group_memberships.csv missing member_id or group_id columns — skipping')
    return new Map()
  }

  // Use most recent (or current) membership per member
  const memberToGroup = new Map<string, { abbr: string; endDate: string | null }>()
  for (let i = 1; i < gmLines.length; i++) {
    const f = parseCsvLine(gmLines[i]!)
    const membId = f[iMembId]
    const grpId = f[iGrpId]
    if (!membId || !grpId) continue
    const abbr = groupIdToAbbr.get(grpId) ?? grpId
    const endDate = iEnd !== -1 ? (f[iEnd] || null) : null
    const existing = memberToGroup.get(membId)
    // Prefer current (null endDate); among dated, prefer later
    if (!existing || (!endDate && existing.endDate) ||
        (endDate && existing.endDate && endDate > existing.endDate)) {
      memberToGroup.set(membId, { abbr, endDate })
    }
  }

  const result = new Map<string, string>()
  Array.from(memberToGroup.entries()).forEach(([membId, { abbr }]) => result.set(membId, abbr))
  console.log(`  Loaded ${result.size} member → group mappings`)
  return result
}

// ── Stream member_votes.csv, collecting rows for relevant vote IDs ─────────────

interface MvRow {
  memberId: string
  position: string
  groupId: string | null
}

async function streamMemberVotes(
  csvPath: string,
  relevantVoteIds: Set<string>,
): Promise<Map<string, MvRow[]>> {
  const rowsByVoteId = new Map<string, MvRow[]>()
  let headerParsed = false
  let iVoteId = -1, iMembId = -1, iPos = -1, iGroupId = -1
  let totalLines = 0
  let relevantCount = 0

  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    if (!line.trim()) continue

    if (!headerParsed) {
      const f = parseCsvLine(line)
      iVoteId = f.indexOf('vote_id')
      iMembId = f.indexOf('member_id')
      iPos = f.indexOf('position')
      iGroupId = f.indexOf('group_id')
      console.log(`  member_votes.csv columns: ${f.join(', ')}`)
      if (iVoteId === -1 || iMembId === -1 || iPos === -1) {
        throw new Error(`member_votes.csv missing required columns (found: ${f.join(', ')})`)
      }
      headerParsed = true
      continue
    }

    totalLines++
    const f = parseCsvLine(line)
    const voteId = f[iVoteId]
    if (!voteId || !relevantVoteIds.has(voteId)) continue

    const memberId = f[iMembId] ?? ''
    const position = f[iPos] ?? ''
    const groupId = iGroupId !== -1 ? (f[iGroupId] || null) : null

    const arr = rowsByVoteId.get(voteId) ?? []
    arr.push({ memberId, position, groupId })
    rowsByVoteId.set(voteId, arr)
    relevantCount++

    if (relevantCount % 100_000 === 0) {
      process.stdout.write(`\r  Streamed ${(totalLines / 1_000_000).toFixed(1)}M rows, ${relevantCount.toLocaleString()} relevant...`)
    }
  }

  process.stdout.write('\n')
  console.log(
    `  Done: ${totalLines.toLocaleString()} data rows scanned, ` +
    `${relevantCount.toLocaleString()} relevant rows for ${rowsByVoteId.size} vote IDs`
  )
  return rowsByVoteId
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, verbose } = parseArgs()
  const dryRun = mode === 'dry-run'

  console.log(`\n── Enrich EU MEP Individual Votes ──────────────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | Release: ${RELEASE_TAG}`)

  // 1. Load taRef → best vote_id from cached votes.csv
  const taRefToVoteId = loadTaRefToVoteId()

  // 2. Fetch all LegislativeVotes with dataSource='howtheyvote_eu'
  const allLvs = await prisma.legislativeVote.findMany({
    where: { dataSource: 'howtheyvote_eu' },
    include: {
      source: { select: { id: true, externalId: true } },
      memberVotes: { select: { id: true }, take: 1 },
    },
  })
  console.log(`Found ${allLvs.length} howtheyvote_eu LegislativeVote records in DB`)

  // Filter to unenriched, then apply limit
  const unenriched = allLvs.filter(lv => lv.memberVotes.length === 0)
  const toProcess = limit > 0 ? unenriched.slice(0, limit) : unenriched
  console.log(`  ${unenriched.length} unenriched, processing ${toProcess.length}`)

  if (toProcess.length === 0) {
    console.log('Nothing to do.')
    await prisma.$disconnect()
    return
  }

  // 3. Build vote_id → LegislativeVote for the records we'll process
  const voteIdToLv = new Map<string, typeof allLvs[0]>()
  for (const lv of toProcess) {
    const extId = lv.source.externalId
    if (!extId) continue
    const taRef = externalIdToTaRef(extId)
    if (!taRef) {
      if (verbose) console.log(`  [skip] unparseable externalId: ${extId}`)
      continue
    }
    const voteId = taRefToVoteId.get(taRef)
    if (!voteId) {
      if (verbose) console.log(`  [skip] no vote_id for taRef: ${taRef}`)
      continue
    }
    voteIdToLv.set(voteId, lv)
  }
  console.log(`  ${voteIdToLv.size} LegislativeVotes mapped to HTV vote IDs`)

  if (voteIdToLv.size === 0) {
    console.log('No matches found — check that votes.csv is from the same release.')
    await prisma.$disconnect()
    return
  }

  // 4. Load member info (name, country) and group info
  console.log(`\n── Loading member data ──────────────────────────────────────────────────`)
  const memberMap = await loadMemberMap()
  const groupMap = await loadGroupMap()

  // Merge group info from group_memberships into memberMap
  Array.from(memberMap.entries()).forEach(([membId, info]) => {
    if (!info.group) {
      const g = groupMap.get(membId)
      if (g) info.group = g
    }
  })

  // 5. Download member_votes.csv and stream it
  console.log(`\n── Streaming member_votes.csv ───────────────────────────────────────────`)
  const memberVotesCsvPath = await ensureCachedCsv('member_votes.csv.gz')
  const relevantVoteIds = new Set(voteIdToLv.keys())
  const rowsByVoteId = await streamMemberVotes(memberVotesCsvPath, relevantVoteIds)

  // 6. Write MemberVote records
  console.log(`\n── Writing MemberVote records ───────────────────────────────────────────`)
  let enriched = 0, skipped = 0, failed = 0, noRows = 0
  let processedCount = 0

  for (const [voteId, lv] of Array.from(voteIdToLv.entries())) {
    const rows = rowsByVoteId.get(voteId)
    if (!rows || rows.length === 0) {
      if (verbose) console.log(`  [no-rows] vote ${voteId} (${lv.source.externalId})`)
      noRows++
      processedCount++
      continue
    }

    if (dryRun) {
      const taRef = externalIdToTaRef(lv.source.externalId ?? '') ?? voteId
      const sample = rows.slice(0, 3).map(r => {
        const info = memberMap.get(r.memberId)
        const group = r.groupId ? (groupMap.get(r.groupId) ?? r.groupId) : (info?.group ?? null)
        return `${info?.name ?? `MEP ${r.memberId}`} (${info?.country ?? '?'}, ${group ?? '?'}): ${r.position}`
      })
      console.log(`  [dry-run] vote ${voteId} → ${taRef}: ${rows.length} members`)
      if (verbose) sample.forEach(s => console.log(`    ${s}`))
      enriched++
    } else {
      try {
        await prisma.memberVote.createMany({
          data: rows.map(r => {
            const info = memberMap.get(r.memberId)
            const group = r.groupId ? (groupMap.get(r.groupId) ?? r.groupId) : (info?.group ?? null)
            return {
              legislativeVoteId: lv.id,
              memberName: info?.name ?? `MEP ${r.memberId}`,
              memberState: info?.country ?? null,
              memberParty: group,
              memberId: r.memberId,
              chamber: 'European Parliament',
              vote: mapPosition(r.position),
            }
          }),
          skipDuplicates: true,
        })
        enriched++
        if (verbose) console.log(`  [enriched] vote ${voteId}: ${rows.length} members`)
      } catch (err) {
        console.error(`  [failed] vote ${voteId}: ${err}`)
        failed++
      }
    }

    processedCount++
    if (processedCount % 100 === 0) {
      console.log(
        `  Progress: ${processedCount}/${voteIdToLv.size} votes ` +
        `(enriched=${enriched} skipped=${skipped} no-rows=${noRows} failed=${failed})`
      )
    }
  }

  console.log(`\nResults: enriched=${enriched} skipped=${skipped} no-rows=${noRows} failed=${failed}`)

  if (!dryRun) {
    const dbCount = await prisma.memberVote.count({ where: { chamber: 'European Parliament' } })
    console.log(`DB MemberVote rows (European Parliament): ${dbCount.toLocaleString()}`)
  }

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
