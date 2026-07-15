// Build the landmark roll-call subset for voteview_v1 member-vote backfill (B11-3).
//
// Two-criteria hybrid per B11 owner decision:
//   A) Named landmark legislation — ILIKE search on Source.name using patterns derived
//      from the Wikipedia "List of United States federal legislation" article
//      (https://en.wikipedia.org/wiki/List_of_United_States_federal_legislation)
//      and the Mayhew (1991, "Divided We Govern") landmark list.
//      Every match must trace to a voteview_v1 LegislativeVote record in this DB.
//      Training-data recall is not a source: if an act can't be mapped to a rollcall
//      via a DB record, it is skipped and counted in the residue log.
//   B) <0.5% margin votes — |yesCount - noCount| / (yesCount + noCount) < 0.005.
//      Exact formula: marginRatio = |yea − nay| / (yea + nay). Filter: < 0.005.
//
// Output: JSON file listing one entry per rollcall:
//   { externalId, legislativeVoteId, sourceId, sourceName, voteDate, result,
//     reason, reasonType, sourceUrl }
// Cap: 1,500 after dedup. Landmarks first (sorted by date), then close-calls.
//
// Sources used to compile the landmark list:
//   - Wikipedia: https://en.wikipedia.org/wiki/List_of_United_States_federal_legislation
//   - Mayhew, David R. (1991). Divided We Govern. Yale University Press.
//   - Congressional Research Service (CRS) Landmark Legislation reports
//
// Spot-check anchors (verified against live Voteview rollcall pages):
//   Civil Rights Act 1964  → voteview_source_88_h_128  (House passage H.R. 7152)
//   Voting Rights Act 1965 → voteview_source_89_h_87   (House passage H.R. 6400)
//   ACA 2010               → voteview_source_111_h_1150 (House passage H.R. 3590)
//   AUMF 2001              → voteview_source_107_s_281  (Senate passage S.J.Res.23)
//   Veto override          → voteview_source_102_h_855  (China MFN override, 345-74)
//
// Run:
//   npx tsx --env-file=.env.local scripts/build-landmark-subset.ts
//   npx tsx --env-file=.env.local scripts/build-landmark-subset.ts --output data/landmark-rollcalls.json

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// Landmark entries: each has a human-readable label, a source URL for the citation,
// and one or more ILIKE patterns against Source.name. Any matching voteview_v1 vote
// is included. If no rows match, the entry is counted as a miss (residue).
// Patterns use SQL ILIKE syntax: % = any string, _ = any char.
type LandmarkEntry = {
  label: string
  sourceUrl: string
  patterns: string[]
  // direct externalIds: bypass text search for votes where name doesn't contain
  // enough identifying info (e.g. AUMF — "joint resolution" with no bill # in name)
  directIds?: string[]
}

const LANDMARKS: LandmarkEntry[] = [
  // ── Civil rights ────────────────────────────────────────────────────────────
  {
    label: 'Civil Rights Act of 1964',
    sourceUrl: 'https://en.wikipedia.org/wiki/Civil_Rights_Act_of_1964',
    patterns: ['%H.R. 7152%', '%HR. 7152%', '%HR 7152%'],
  },
  {
    label: 'Voting Rights Act of 1965',
    sourceUrl: 'https://en.wikipedia.org/wiki/Voting_Rights_Act_of_1965',
    patterns: ['%H.R. 6400%', '%S. 1564%voting rights%'],
  },
  {
    label: 'Civil Rights Act of 1968 (Fair Housing Act)',
    sourceUrl: 'https://en.wikipedia.org/wiki/Civil_Rights_Act_of_1968',
    patterns: ['%H.R. 2516%', '%fair housing act%1968%'],
  },
  {
    label: 'Civil Rights Act of 1957',
    sourceUrl: 'https://en.wikipedia.org/wiki/Civil_Rights_Act_of_1957',
    patterns: ['%H.R. 6127%', '%civil rights act%1957%'],
  },
  {
    label: 'Civil Rights Act of 1960',
    sourceUrl: 'https://en.wikipedia.org/wiki/Civil_Rights_Act_of_1960',
    patterns: ['%H.R. 8601%'],
  },

  // ── Social insurance ────────────────────────────────────────────────────────
  {
    label: 'Social Security Act of 1935',
    sourceUrl: 'https://en.wikipedia.org/wiki/Social_Security_Act',
    patterns: ['%H.R. 7260%', '%social security act%1935%'],
  },
  {
    label: 'Medicare and Medicaid Act of 1965',
    sourceUrl: 'https://en.wikipedia.org/wiki/Social_Security_Amendments_of_1965',
    patterns: ['%H.R. 6675%', '%social security amendments%1965%'],
  },
  {
    label: 'Affordable Care Act 2010',
    sourceUrl: 'https://en.wikipedia.org/wiki/Affordable_Care_Act',
    patterns: ['%patient protection and affordable care act%', '%H.R. 3590%'],
    directIds: ['voteview_source_111_h_1150', 'voteview_source_111_s_396'],
  },
  {
    label: 'Social Security Amendments of 1983 (Greenspan Commission)',
    sourceUrl: 'https://en.wikipedia.org/wiki/Social_Security_Amendments_of_1983',
    patterns: ['%H.R. 1900%', '%social security amendments%1983%'],
  },

  // ── National security / military ────────────────────────────────────────────
  {
    label: 'Authorization for Use of Military Force 2001 (AUMF)',
    sourceUrl: 'https://en.wikipedia.org/wiki/Authorization_for_Use_of_Military_Force_of_2001',
    patterns: ['%joint resolution to authorize the use of united states armed forces against those responsible%'],
    directIds: ['voteview_source_107_s_281', 'voteview_source_107_h_339'],
  },
  {
    label: 'Authorization for Use of Military Force Against Iraq 2002',
    sourceUrl: 'https://en.wikipedia.org/wiki/Authorization_for_Use_of_Military_Force_Against_Iraq_Resolution_of_2002',
    patterns: ['%H.J.Res. 114%', '%H.J. Res. 114%', '%iraq resolution%2002%'],
  },
  {
    label: 'National Security Act of 1947',
    sourceUrl: 'https://en.wikipedia.org/wiki/National_Security_Act_of_1947',
    patterns: ['%national security act%1947%', '%S. 758%'],
  },
  {
    label: 'Gulf of Tonkin Resolution 1964',
    sourceUrl: 'https://en.wikipedia.org/wiki/Gulf_of_Tonkin_Resolution',
    patterns: ['%gulf of tonkin%', '%southeast asia resolution%', '%H.J.Res. 1145%'],
  },
  {
    label: 'War Powers Resolution 1973',
    sourceUrl: 'https://en.wikipedia.org/wiki/War_Powers_Resolution',
    patterns: ['%war powers resolution%', '%H.J.Res. 542%'],
  },

  // ── Economic / financial ────────────────────────────────────────────────────
  {
    label: 'Marshall Plan (Economic Cooperation Act of 1948)',
    sourceUrl: 'https://en.wikipedia.org/wiki/Marshall_Plan',
    patterns: ['%economic cooperation act%1948%', '%S. 2202%'],
  },
  {
    label: 'National Labor Relations Act 1935 (Wagner Act)',
    sourceUrl: 'https://en.wikipedia.org/wiki/National_Labor_Relations_Act_of_1935',
    patterns: ['%national labor relations act%', '%wagner act%', '%S. 1958%'],
  },
  {
    label: 'Taft-Hartley Act 1947',
    sourceUrl: 'https://en.wikipedia.org/wiki/Taft%E2%80%93Hartley_Act',
    patterns: ['%taft%hartley%', '%labor management relations act%1947%', '%H.R. 3020%'],
  },
  {
    label: 'Glass-Steagall Act 1933 (Banking Act of 1933)',
    sourceUrl: 'https://en.wikipedia.org/wiki/Glass%E2%80%93Steagall_legislation',
    patterns: ['%glass%steagall%', '%banking act%1933%'],
  },
  {
    label: 'Gramm-Leach-Bliley Act 1999',
    sourceUrl: 'https://en.wikipedia.org/wiki/Gramm%E2%80%93Leach%E2%80%93Bliley_Act',
    patterns: ['%gramm%leach%bliley%', '%financial services modernization%', '%S. 900%'],
  },
  {
    label: 'Dodd-Frank Wall Street Reform Act 2010',
    sourceUrl: 'https://en.wikipedia.org/wiki/Dodd%E2%80%93Frank_Wall_Street_Reform_and_Consumer_Protection_Act',
    patterns: ['%dodd%frank%wall street%', '%H.R. 4173%'],
  },
  {
    label: 'Tax Cuts and Jobs Act 2017',
    sourceUrl: 'https://en.wikipedia.org/wiki/Tax_Cuts_and_Jobs_Act_of_2017',
    patterns: ['%tax cuts and jobs act%'],
  },
  {
    label: 'NAFTA Implementation Act 1993',
    sourceUrl: 'https://en.wikipedia.org/wiki/North_American_Free_Trade_Agreement',
    patterns: ['%north american free trade%', '%NAFTA%implement%', '%H.R. 3450%'],
  },
  {
    label: 'Balanced Budget Act of 1997',
    sourceUrl: 'https://en.wikipedia.org/wiki/Balanced_Budget_Act_of_1997',
    patterns: ['%balanced budget act%1997%', '%H.R. 2015%'],
  },
  {
    label: 'Budget Control Act of 2011',
    sourceUrl: 'https://en.wikipedia.org/wiki/Budget_Control_Act_of_2011',
    patterns: ['%budget control act%2011%', '%S. 365%2011%'],
  },

  // ── Environment / social ────────────────────────────────────────────────────
  {
    label: 'Immigration and Nationality Act of 1965 (Hart-Celler)',
    sourceUrl: 'https://en.wikipedia.org/wiki/Immigration_and_Nationality_Act_of_1965',
    patterns: ['%H.R. 2580%', '%hart%celler%'],
  },
  {
    label: 'Clean Air Act of 1970',
    sourceUrl: 'https://en.wikipedia.org/wiki/Clean_Air_Act_(United_States)',
    patterns: ['%clean air act%1970%', '%S. 4358%'],
  },
  {
    label: 'Clean Water Act of 1972',
    sourceUrl: 'https://en.wikipedia.org/wiki/Clean_Water_Act',
    patterns: ['%clean water act%', '%federal water pollution control%1972%', '%S. 2770%'],
  },
  {
    label: 'National Environmental Policy Act 1969',
    sourceUrl: 'https://en.wikipedia.org/wiki/National_Environmental_Policy_Act',
    patterns: ['%national environmental policy act%'],
  },
  {
    label: 'Americans with Disabilities Act 1990',
    sourceUrl: 'https://en.wikipedia.org/wiki/Americans_with_Disabilities_Act_of_1990',
    patterns: ['%americans with disabilities act%', '%S. 933%'],
  },
  {
    label: 'Elementary and Secondary Education Act 1965',
    sourceUrl: 'https://en.wikipedia.org/wiki/Elementary_and_Secondary_Education_Act',
    patterns: ['%elementary and secondary education act%', '%H.R. 2362%'],
  },
  {
    label: 'Equal Pay Act of 1963',
    sourceUrl: 'https://en.wikipedia.org/wiki/Equal_Pay_Act_of_1963',
    patterns: ['%equal pay act%1963%'],
  },
  {
    label: 'Freedom of Information Act 1966',
    sourceUrl: 'https://en.wikipedia.org/wiki/Freedom_of_Information_Act_(United_States)',
    patterns: ['%freedom of information act%'],
  },
  {
    label: 'USA PATRIOT Act 2001',
    sourceUrl: 'https://en.wikipedia.org/wiki/Patriot_Act',
    patterns: ['%USA PATRIOT Act%', '%uniting and strengthening america%', '%H.R. 3162%'],
  },
  {
    label: 'Brady Handgun Violence Prevention Act 1993',
    sourceUrl: 'https://en.wikipedia.org/wiki/Brady_Handgun_Violence_Prevention_Act',
    patterns: ['%brady handgun%', '%H.R. 1025%'],
  },
  {
    label: 'Personal Responsibility and Work Opportunity Act 1996 (Welfare Reform)',
    sourceUrl: 'https://en.wikipedia.org/wiki/Personal_Responsibility_and_Work_Opportunity_Act',
    patterns: ['%personal responsibility%work opportunity%', '%H.R. 3734%'],
  },
]

const SOURCE_DOCUMENT_URL = 'https://en.wikipedia.org/wiki/List_of_United_States_federal_legislation'
const LANDMARK_CAP = 1500

type SubsetEntry = {
  externalId: string
  legislativeVoteId: string
  sourceId: string
  sourceName: string
  voteDate: string | null
  result: string | null
  reason: string
  reasonType: 'landmark' | 'close_call'
  sourceUrl: string
}

type VoteRow = {
  id: string
  yesCount: number | null
  noCount: number | null
  voteDate: Date | null
  result: string | null
  sourceId: string
  externalId: string | null
  sourceName: string
}

async function run() {
  const args = process.argv.slice(2)
  const outputPath = (() => {
    const idx = args.indexOf('--output')
    return idx >= 0 ? args[idx + 1] : null
  })()

  console.log('Building landmark roll-call subset for voteview_v1...')
  console.log(`Source document: ${SOURCE_DOCUMENT_URL}\n`)

  const seen = new Set<string>()
  const subset: SubsetEntry[] = []
  const residue: string[] = []

  // ── Criterion A: named landmark legislation ─────────────────────────────────
  console.log('Criterion A: named landmark legislation...')

  for (const entry of LANDMARKS) {
    const matchedIds = new Set<string>()

    // 1. Direct externalId lookups (bypasses text search)
    if (entry.directIds?.length) {
      const directRows = await prisma.$queryRaw<VoteRow[]>`
        SELECT lv.id, lv."yesCount", lv."noCount", lv."voteDate", lv.result,
               s.id AS "sourceId", s."externalId", s.name AS "sourceName"
        FROM "LegislativeVote" lv
        JOIN "Source" s ON s.id = lv."sourceId"
        WHERE lv."dataSource" = 'voteview_v1'
          AND s."externalId" = ANY(${entry.directIds})
      `
      for (const v of directRows) {
        if (!seen.has(v.id)) {
          seen.add(v.id)
          matchedIds.add(v.id)
          subset.push({
            externalId: v.externalId ?? '',
            legislativeVoteId: v.id,
            sourceId: v.sourceId,
            sourceName: v.sourceName,
            voteDate: v.voteDate?.toISOString().slice(0, 10) ?? null,
            result: v.result,
            reason: `landmark: ${entry.label}`,
            reasonType: 'landmark',
            sourceUrl: entry.sourceUrl,
          })
        }
      }
    }

    // 2. ILIKE text search on Source.name for each pattern (OR across patterns)
    for (const pattern of entry.patterns) {
      const rows = await prisma.$queryRaw<VoteRow[]>`
        SELECT lv.id, lv."yesCount", lv."noCount", lv."voteDate", lv.result,
               s.id AS "sourceId", s."externalId", s.name AS "sourceName"
        FROM "LegislativeVote" lv
        JOIN "Source" s ON s.id = lv."sourceId"
        WHERE lv."dataSource" = 'voteview_v1'
          AND s.name ILIKE ${pattern}
      `
      for (const v of rows) {
        if (!seen.has(v.id)) {
          seen.add(v.id)
          matchedIds.add(v.id)
          subset.push({
            externalId: v.externalId ?? '',
            legislativeVoteId: v.id,
            sourceId: v.sourceId,
            sourceName: v.sourceName,
            voteDate: v.voteDate?.toISOString().slice(0, 10) ?? null,
            result: v.result,
            reason: `landmark: ${entry.label}`,
            reasonType: 'landmark',
            sourceUrl: entry.sourceUrl,
          })
        }
      }
    }

    if (matchedIds.size === 0) {
      residue.push(entry.label)
      console.log(`  MISS: ${entry.label}`)
    } else {
      console.log(`  HIT (${matchedIds.size}): ${entry.label}`)
    }
  }

  const landmarkCount = subset.length
  console.log(`\n  Named landmark total: ${landmarkCount} votes from ${LANDMARKS.length - residue.length}/${LANDMARKS.length} entries`)
  if (residue.length > 0) {
    console.log(`  RESIDUE (${residue.length} entries not found in DB):`)
    for (const r of residue) console.log(`    - ${r}`)
  }

  // ── Criterion B: <0.5% margin votes ────────────────────────────────────────
  // Formula: |yea − nay| / (yea + nay) < 0.005 for voteview_v1 votes with both counts.
  console.log('\nCriterion B: <0.5% margin votes...')

  const closeCallRows = await prisma.$queryRaw<VoteRow[]>`
    SELECT lv.id, lv."yesCount", lv."noCount", lv."voteDate", lv.result,
           s.id AS "sourceId", s."externalId", s.name AS "sourceName"
    FROM "LegislativeVote" lv
    JOIN "Source" s ON s.id = lv."sourceId"
    WHERE lv."dataSource" = 'voteview_v1'
      AND lv."yesCount" IS NOT NULL
      AND lv."noCount" IS NOT NULL
      AND (lv."yesCount" + lv."noCount") > 0
      AND ABS(lv."yesCount" - lv."noCount")::float / (lv."yesCount" + lv."noCount")::float < 0.005
    ORDER BY lv."voteDate" DESC
  `

  console.log(`  Close-call (<0.5%): ${closeCallRows.length} votes`)

  for (const v of closeCallRows) {
    if (seen.has(v.id)) continue
    seen.add(v.id)
    const yes = v.yesCount ?? 0
    const no = v.noCount ?? 0
    const margin = (Math.abs(yes - no) / (yes + no) * 100).toFixed(3)
    subset.push({
      externalId: v.externalId ?? '',
      legislativeVoteId: v.id,
      sourceId: v.sourceId,
      sourceName: v.sourceName,
      voteDate: v.voteDate?.toISOString().slice(0, 10) ?? null,
      result: v.result,
      reason: `decided by ${margin}% margin (${yes}–${no})`,
      reasonType: 'close_call',
      sourceUrl: '',
    })
  }

  // ── Sort and cap ────────────────────────────────────────────────────────────
  // Landmarks first (sorted by date desc), then close-calls (date desc)
  subset.sort((a, b) => {
    if (a.reasonType !== b.reasonType) return a.reasonType === 'landmark' ? -1 : 1
    return (b.voteDate ?? '').localeCompare(a.voteDate ?? '')
  })

  const capped = subset.slice(0, LANDMARK_CAP)
  const capLandmarks = capped.filter(e => e.reasonType === 'landmark').length
  const capCloseCall = capped.filter(e => e.reasonType === 'close_call').length

  console.log(`\n── Summary ──`)
  console.log(`  Total before cap: ${subset.length}`)
  console.log(`  After cap (${LANDMARK_CAP}): ${capped.length}`)
  console.log(`    Landmark: ${capLandmarks}`)
  console.log(`    Close-call (<0.5%): ${capCloseCall}`)
  console.log(`  Residue (not found in DB): ${residue.length} acts`)

  console.log(`\n── Sample (first 10) ──`)
  for (const e of capped.slice(0, 10)) {
    console.log(`  [${e.voteDate}] ${e.externalId}`)
    console.log(`    ${e.reason}`)
    console.log(`    Name: ${e.sourceName.slice(0, 80)}`)
  }

  if (outputPath) {
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(outputPath, JSON.stringify(capped, null, 2))
    console.log(`\nOutput written to: ${outputPath} (${capped.length} entries)`)
    console.log(`\nNEXT STEPS (Workstream C):`)
    console.log(`  1. Owner reviews this file — confirm landmark text matches look correct`)
    console.log(`  2. Pilot: run enrich-member-votes.ts on first 25 entries`)
    console.log(`  3. Spot-check 5 MemberVote rows vs. live XML`)
    console.log(`  4. Owner yes → full landmark run → DB-verified counts + residue log`)
  } else {
    console.log(`\nPass --output data/landmark-rollcalls.json to write the file.`)
  }

  await prisma.$disconnect()
}

run().catch(e => { console.error(e); process.exit(1) })
