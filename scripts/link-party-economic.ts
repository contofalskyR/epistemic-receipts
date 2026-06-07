/**
 * link-party-economic.ts
 *
 * Builds PASSED_DURING ClaimRelation rows from US congressional vote claims
 * (congress_votes_v1) to US WorldBank economic indicators (worldbank_v1)
 * where the vote year matches a WB indicator year (±1 year).
 *
 *   from = congress vote claim   (the vote)
 *   to   = worldbank claim        (US economic indicator)
 *   relationType = PASSED_DURING
 *
 * Party-line filter: the `congress_votes_v1` pipeline stores yea/nay counts
 * on Claim.metadata but does NOT store per-party breakdowns (the
 * LegislativeVote.byPartyJson column carries that, but no congress_votes_v1
 * claims currently link to LegislativeVote rows — verified empirically).
 * We therefore use the only signal available on the claim itself, per the
 * task spec: yea_pct > 0.8 OR nay_pct > 0.8. These are the "lopsided" /
 * strongly-decided votes; we treat them as the high-confidence subset
 * appropriate for a PASSED_DURING relation.
 *
 * Country: WorldBank side is filtered to countryIso3 = 'USA'. Indicator
 * filter is the same economic-only set used by link-worldbank-legislation.ts
 * (NY.GDP*, FP.CPI*, GC.DOD*, SL.UEM*, NY.GDP.DEFL*).
 *
 * Year window: vote year ±1 (WB year ∈ {voteYear-1, voteYear, voteYear+1}).
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-party-economic.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-party-economic.ts
 */

import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

interface Args { dryRun: boolean }

function parseArgs(): Args {
  return { dryRun: process.argv.includes('--dry-run') }
}

interface VoteMeta { yea?: number; nay?: number; present?: number; voteType?: string }

function readVoteMeta(meta: Prisma.JsonValue | null): VoteMeta {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {}
  const m = meta as Record<string, unknown>
  return {
    yea: typeof m.yea === 'number' ? m.yea : undefined,
    nay: typeof m.nay === 'number' ? m.nay : undefined,
    present: typeof m.present === 'number' ? m.present : undefined,
    voteType: typeof m.voteType === 'string' ? m.voteType : undefined,
  }
}

function isEconomicIndicator(code: string): boolean {
  return (
    code.startsWith('NY.GDP') ||
    code.startsWith('FP.CPI') ||
    code.startsWith('GC.DOD') ||
    code.startsWith('SL.UEM') ||
    code === 'NY.GDP.DEFL.KD.ZG'
  )
}

async function main() {
  const args = parseArgs()
  const isLive = !args.dryRun && !!process.env.ALLOW_EDITS

  console.log(`\nlink-party-economic.ts — ${isLive ? 'LIVE' : 'DRY RUN'}\n`)

  // ── Step 1: Load US WB economic indicator claims, index by year ───────────
  const wbRows = await prisma.$queryRaw<
    Array<{ id: string; year: number; code: string }>
  >`
    SELECT id,
           (metadata->>'year')::int   AS year,
           metadata->>'indicatorCode' AS code
    FROM "Claim"
    WHERE "ingestedBy" = 'worldbank_v1'
      AND deleted = false
      AND metadata->>'countryIso3' = 'USA'
      AND metadata->>'year' IS NOT NULL
      AND metadata->>'indicatorCode' IS NOT NULL
  `
  console.log(`  WorldBank US claims checked      : ${wbRows.length}`)

  const wbUsaEcon = wbRows.filter((r) => isEconomicIndicator(r.code))
  console.log(`  WorldBank US economic-indicator  : ${wbUsaEcon.length}`)

  const wbByYear = new Map<number, Array<{ id: string; code: string }>>()
  for (const r of wbUsaEcon) {
    const arr = wbByYear.get(r.year) ?? []
    arr.push({ id: r.id, code: r.code })
    wbByYear.set(r.year, arr)
  }

  // ── Step 2: Load congress_votes_v1 claims, filter to lopsided votes ───────
  const voteClaims = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: 'congress_votes_v1' },
    select: { id: true, externalId: true, claimEmergedAt: true, metadata: true },
  })
  console.log(`  congress_votes_v1 claims checked : ${voteClaims.length}`)

  type Vote = { id: string; externalId: string | null; year: number; yeaPct: number; nayPct: number }
  const votes: Vote[] = []
  let skippedNoYear = 0
  let skippedNoCount = 0
  let skippedNotLopsided = 0

  for (const c of voteClaims) {
    if (!c.claimEmergedAt) { skippedNoYear++; continue }
    const m = readVoteMeta(c.metadata)
    const yea = m.yea ?? 0
    const nay = m.nay ?? 0
    const present = m.present ?? 0
    const total = yea + nay + present
    if (total <= 0) { skippedNoCount++; continue }
    const yeaPct = yea / total
    const nayPct = nay / total
    if (yeaPct <= 0.8 && nayPct <= 0.8) { skippedNotLopsided++; continue }
    votes.push({
      id: c.id,
      externalId: c.externalId,
      year: c.claimEmergedAt.getUTCFullYear(),
      yeaPct,
      nayPct,
    })
  }

  console.log(`  Vote filter counts:`)
  console.log(`    qualifying (yea_pct>0.8 or nay_pct>0.8) : ${votes.length}`)
  console.log(`    skipped (no year)                       : ${skippedNoYear}`)
  console.log(`    skipped (no yea+nay+present)            : ${skippedNoCount}`)
  console.log(`    skipped (not lopsided)                  : ${skippedNotLopsided}`)

  // ── Step 3: Build pairs (vote year ±1) ────────────────────────────────────
  type Pair = {
    fromClaimId: string
    toClaimId: string
    voteExternalId: string | null
    voteYear: number
    yeaPct: number
    nayPct: number
    indicatorCode: string
    indicatorYear: number
    yearOffset: number
  }

  const seen = new Set<string>()
  const pairs: Pair[] = []

  for (const v of votes) {
    for (const dy of [-1, 0, 1]) {
      const cands = wbByYear.get(v.year + dy)
      if (!cands) continue
      for (const wb of cands) {
        const key = `${v.id}|${wb.id}`
        if (seen.has(key)) continue
        seen.add(key)
        pairs.push({
          fromClaimId: v.id,
          toClaimId: wb.id,
          voteExternalId: v.externalId,
          voteYear: v.year,
          yeaPct: v.yeaPct,
          nayPct: v.nayPct,
          indicatorCode: wb.code,
          indicatorYear: v.year + dy,
          yearOffset: dy,
        })
      }
    }
  }

  console.log(`\n  Candidate PASSED_DURING pairs   : ${pairs.length}`)

  if (!isLive) {
    console.log('\n  Sample first 5 candidate pairs:')
    for (const p of pairs.slice(0, 5)) {
      console.log(
        `    ${p.voteExternalId} (${p.voteYear}, yea ${(p.yeaPct * 100).toFixed(1)}%) → ${p.indicatorCode} ${p.indicatorYear} [Δ${p.yearOffset >= 0 ? '+' : ''}${p.yearOffset}]`
      )
    }
    console.log('\n  Dry-run / ALLOW_EDITS not set — no writes.')
    console.log('\n=== Summary ===')
    console.log(`  Congress claims checked    : ${voteClaims.length}`)
    console.log(`  WorldBank US claims        : ${wbRows.length}`)
    console.log(`  Candidate relations        : ${pairs.length}`)
    console.log(`  Would insert (dry run)     : ${pairs.length} (existing skipped at write time)`)
    await prisma.$disconnect()
    return
  }

  // ── Step 4: Batched inserts with createMany skipDuplicates ────────────────
  const BATCH = 500
  let inserted = 0
  for (let i = 0; i < pairs.length; i += BATCH) {
    const slice = pairs.slice(i, i + BATCH)
    const rows = slice.map((p) => ({
      fromClaimId: p.fromClaimId,
      toClaimId: p.toClaimId,
      relationType: 'PASSED_DURING',
      year: p.indicatorYear,
      followUpContext: {
        note: 'Congressional vote occurred during this US economic period',
        voteYear: p.voteYear,
        yeaPct: p.yeaPct,
        nayPct: p.nayPct,
        indicatorCode: p.indicatorCode,
        indicatorYear: p.indicatorYear,
        yearOffsetFromVote: p.yearOffset,
        heuristic: 'us_vote_year_window_lopsided',
        window: '±1 year',
        partyLineProxy: 'yea_pct>0.8 or nay_pct>0.8 (no per-party data on these claims)',
        pipeline_from: 'congress_votes_v1',
        pipeline_to: 'worldbank_v1',
      },
    }))
    const res = await prisma.$transaction(
      async (tx) => tx.claimRelation.createMany({ data: rows, skipDuplicates: true }),
      { timeout: 30000 }
    )
    inserted += res.count
    if ((i / BATCH) % 10 === 0) {
      console.log(`  Batch ${Math.floor(i / BATCH) + 1}: inserted ${res.count} (cumulative ${inserted})`)
    }
  }

  const skipped = pairs.length - inserted
  console.log('\n=== Summary ===')
  console.log(`  Congress claims checked    : ${voteClaims.length}`)
  console.log(`  WorldBank US claims        : ${wbRows.length}`)
  console.log(`  Candidate relations        : ${pairs.length}`)
  console.log(`  New relations created      : ${inserted}`)
  console.log(`  Skipped (already existed)  : ${skipped}`)

  const dbCount = await prisma.claimRelation.count({
    where: { relationType: 'PASSED_DURING' },
  })
  console.log(`  DB count (PASSED_DURING)   : ${dbCount}`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
