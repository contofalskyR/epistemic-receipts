// Build the landmark roll-call subset for voteview_v1 member-vote backfill (B11-3).
//
// Two-criteria hybrid per B11 owner decision:
//   A) Named landmark legislation — text-search on Source.title using known bill name patterns.
//      Every match traces to a record already in the DB (no training-data recall).
//      Passage + cloture pairs both included.
//   B) <0.5% margin votes — |yesCount - noCount| / (yesCount + noCount) < 0.005.
//
// Output: JSON file listing (externalId, legislativeVoteId, sourceId, reason, date, result)
//   for owner review before any backfill is run.
// Cap: 1,500 after dedup. Each vote carries a machine-readable reason so vote pages can
//   display "landmark: Civil Rights Act of 1964" or "decided by <0.5%".
//
// Run:
//   npx tsx scripts/build-landmark-subset.ts               # dry-run, prints counts + sample
//   npx tsx scripts/build-landmark-subset.ts --output /tmp/landmark-subset.json

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

// Landmark name patterns — matched against Source.title (case-insensitive ILIKE).
// Each entry: { label, patterns[] }. ALL patterns are OR'd within a label.
// Source: drawn from commonly-cited landmark legislation lists (Mayhew, CQ, CRS).
// Every pattern here must be verifiable against the actual DB after the script runs.
const LANDMARK_PATTERNS: { label: string; patterns: string[] }[] = [
  { label: 'Civil Rights Act of 1964',        patterns: ['civil rights act%1964', '%H.R. 7152%', '%HR 7152%'] },
  { label: 'Civil Rights Act of 1968',        patterns: ['civil rights act%1968', 'fair housing act%1968', '%H.R. 2516%'] },
  { label: 'Voting Rights Act of 1965',       patterns: ['voting rights act%1965', '%H.R. 6400%', '%HR 6400%'] },
  { label: 'Social Security Act of 1935',     patterns: ['social security act%1935', '%H.R. 7260%'] },
  { label: 'Medicare/Medicaid 1965',          patterns: ['social security amendments%1965', '%H.R. 6675%'] },
  { label: 'Affordable Care Act 2010',        patterns: ['affordable care act', 'patient protection%affordable', '%H.R. 3590%', '%ACA%passage%'] },
  { label: 'Authorization for Use of Military Force 2001', patterns: ['authorization for use of military force%2001', 'AUMF%2001', '%S.J.Res. 23%', '%SJRes23%'] },
  { label: 'Authorization for Use of Military Force 2002 (Iraq)', patterns: ['authorization for use of military force%2002', 'iraq%use of military force', '%H.J.Res. 114%'] },
  { label: 'Gulf of Tonkin Resolution',       patterns: ['gulf of tonkin', 'southeast asia resolution', '%H.J.Res. 1145%'] },
  { label: 'War Powers Resolution 1973',      patterns: ['war powers resolution', 'war powers act%1973', '%H.J.Res. 542%'] },
  { label: 'Immigration Act of 1965',         patterns: ['immigration%nationality act%1965', 'hart%celler', '%H.R. 2580%'] },
  { label: 'Clean Air Act 1970',              patterns: ['clean air act%1970', '%S. 4358%'] },
  { label: 'Clean Water Act 1972',            patterns: ['clean water act%1972', 'federal water pollution control%1972', '%S. 2770%'] },
  { label: 'National Security Act 1947',      patterns: ['national security act%1947', '%S. 758%'] },
  { label: 'Marshall Plan / Economic Cooperation Act 1948', patterns: ['economic cooperation act%1948', 'marshall plan%', '%S. 2202%'] },
  { label: 'Civil Rights Act of 1957',        patterns: ['civil rights act%1957', '%H.R. 6127%'] },
  { label: 'Civil Rights Act of 1960',        patterns: ['civil rights act%1960', '%H.R. 8601%'] },
  { label: 'Elementary and Secondary Education Act 1965', patterns: ['elementary and secondary education act%1965', '%H.R. 2362%'] },
  { label: 'Americans with Disabilities Act 1990', patterns: ['americans with disabilities act', '%S. 933%', '%HR 2273%'] },
  { label: 'NAFTA Implementation Act 1993',   patterns: ['north american free trade', 'NAFTA%implement', '%H.R. 3450%'] },
  { label: 'Gramm-Leach-Bliley Act 1999',    patterns: ['gramm%leach%bliley', 'financial services modernization', '%S. 900%'] },
  { label: 'USA PATRIOT Act 2001',            patterns: ['USA PATRIOT Act', 'uniting and strengthening america%', '%H.R. 3162%'] },
  { label: 'Dodd-Frank Act 2010',             patterns: ['dodd%frank%wall street', 'dodd%frank financial', '%H.R. 4173%'] },
  { label: 'Tax Cuts and Jobs Act 2017',      patterns: ['tax cuts and jobs act', '%H.R. 1%2017%'] },
  { label: 'National Labor Relations Act 1935', patterns: ['national labor relations act', 'wagner act%1935', '%S. 1958%'] },
  { label: 'Taft-Hartley Act 1947',           patterns: ['taft%hartley', 'labor management relations act%1947', '%H.R. 3020%'] },
  { label: 'Sherman Antitrust Act 1890',      patterns: ['sherman%antitrust', 'sherman act%1890'] },
  { label: 'Glass-Steagall Act 1933',         patterns: ['glass%steagall', 'banking act%1933'] },
  { label: 'Social Security Amendments 1983 (Greenspan Commission)', patterns: ['social security amendments%1983', '%H.R. 1900%1983%'] },
  { label: 'Balanced Budget Act 1997',        patterns: ['balanced budget act%1997', '%H.R. 2015%1997%'] },
  { label: 'Budget Control Act 2011',         patterns: ['budget control act%2011', 'debt ceiling%2011', '%S. 365%'] },
  { label: 'Brady Handgun Violence Prevention Act 1993', patterns: ['brady handgun', '%H.R. 1025%'] },
  { label: 'Contract With America Advancement Act 1996', patterns: ['welfare reform%1996', 'personal responsibility%work opportunity', '%H.R. 3734%'] },
  { label: 'Equal Pay Act 1963',              patterns: ['equal pay act%1963', '%S. 1409%1963%'] },
  { label: 'Freedom of Information Act 1966', patterns: ['freedom of information act%1966', '%H.R. 5012%1966%'] },
  { label: 'National Environmental Policy Act 1969', patterns: ['national environmental policy act', '%S. 1075%1969%'] },
  { label: 'Cloture votes (landmark context)', patterns: ['%cloture%civil rights%', '%cloture%voting rights%'] },
]

const LANDMARK_CAP = 1500

function marginPct(yes: number, no: number): number {
  const total = yes + no
  if (total === 0) return 1
  return Math.abs(yes - no) / total
}

async function run() {
  const args = process.argv.slice(2)
  const outputPath = (() => {
    const idx = args.indexOf('--output')
    return idx >= 0 ? args[idx + 1] : null
  })()

  console.log('Building landmark roll-call subset for voteview_v1...\n')

  // ── Criterion B: close-call (<0.5% margin) ─────────────────────────────────
  console.log('Criterion B: <0.5% margin votes...')
  const allVoteview = await prisma.legislativeVote.findMany({
    where: { dataSource: 'voteview_v1', yesCount: { not: null }, noCount: { not: null } },
    select: {
      id: true,
      yesCount: true,
      noCount: true,
      voteDate: true,
      result: true,
      source: { select: { id: true, externalId: true, title: true } },
    },
  })

  const closeCall = allVoteview.filter(v => {
    const yes = v.yesCount ?? 0
    const no = v.noCount ?? 0
    return yes + no > 0 && marginPct(yes, no) < 0.005
  })

  console.log(`  Close-call (<0.5%): ${closeCall.length} votes`)

  type SubsetEntry = {
    externalId: string
    legislativeVoteId: string
    sourceId: string
    sourceTitle: string
    voteDate: string | null
    result: string | null
    reason: string
    reasonType: 'close_call' | 'landmark'
  }

  const seen = new Set<string>()
  const subset: SubsetEntry[] = []

  for (const v of closeCall) {
    if (seen.has(v.id)) continue
    seen.add(v.id)
    subset.push({
      externalId: v.source.externalId ?? '',
      legislativeVoteId: v.id,
      sourceId: v.source.id,
      sourceTitle: v.source.title ?? '',
      voteDate: v.voteDate?.toISOString().slice(0, 10) ?? null,
      result: v.result,
      reason: `decided by <0.5% margin`,
      reasonType: 'close_call',
    })
  }

  // ── Criterion A: named landmark legislation ─────────────────────────────────
  console.log('Criterion A: named landmark legislation (text search)...')
  let landmarkHits = 0

  for (const { label, patterns } of LANDMARK_PATTERNS) {
    // Build OR conditions over all patterns for this landmark
    const orConditions = patterns.map(p => ({
      source: { title: { contains: p.replace(/%/g, ''), mode: 'insensitive' as const } },
    }))

    const matches = await prisma.legislativeVote.findMany({
      where: {
        dataSource: 'voteview_v1',
        OR: orConditions,
      },
      select: {
        id: true,
        yesCount: true,
        noCount: true,
        voteDate: true,
        result: true,
        source: { select: { id: true, externalId: true, title: true } },
      },
    })

    for (const v of matches) {
      if (seen.has(v.id)) continue
      seen.add(v.id)
      subset.push({
        externalId: v.source.externalId ?? '',
        legislativeVoteId: v.id,
        sourceId: v.source.id,
        sourceTitle: v.source.title ?? '',
        voteDate: v.voteDate?.toISOString().slice(0, 10) ?? null,
        result: v.result,
        reason: `landmark: ${label}`,
        reasonType: 'landmark',
      })
      landmarkHits++
    }
  }

  console.log(`  Named landmark matches: ${landmarkHits} unique votes`)

  // ── Sort and cap ────────────────────────────────────────────────────────────
  // Landmarks first, then close-call by date desc
  subset.sort((a, b) => {
    if (a.reasonType !== b.reasonType) return a.reasonType === 'landmark' ? -1 : 1
    return (b.voteDate ?? '').localeCompare(a.voteDate ?? '')
  })

  const capped = subset.slice(0, LANDMARK_CAP)

  const landmarkCount = capped.filter(e => e.reasonType === 'landmark').length
  const closeCallCount = capped.filter(e => e.reasonType === 'close_call').length

  console.log(`\n── Summary ──`)
  console.log(`  Total before cap: ${subset.length}`)
  console.log(`  After cap (${LANDMARK_CAP}):`)
  console.log(`    Landmark: ${landmarkCount}`)
  console.log(`    Close-call: ${closeCallCount}`)

  if (capped.length > 0) {
    console.log(`\n── Sample (first 5) ──`)
    for (const e of capped.slice(0, 5)) {
      console.log(`  [${e.voteDate}] ${e.externalId} — ${e.reason}`)
      console.log(`    Title: ${e.sourceTitle.slice(0, 80)}`)
    }
  }

  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(capped, null, 2))
    console.log(`\nOutput written to: ${outputPath}`)
    console.log(`NEXT STEP: Review the file, then present to owner for pilot approval.`)
    console.log(`Pilot will draw the first 25 entries from this list.`)
  } else {
    console.log(`\nPass --output /tmp/landmark-subset.json to write the full list.`)
  }

  await prisma.$disconnect()
}

run().catch(e => { console.error(e); process.exit(1) })
