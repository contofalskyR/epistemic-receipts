// link-icsid-ofac.ts
//
// Builds SANCTION_CONTEXT ClaimRelation rows from ICSID arbitration cases
// (icsid_v1) to OFAC SDN entries (ofac_sdn_v1) where the ICSID respondent
// country matches a sanctioned country, within ±5 years of the case's filing.
//
// Direction: fromClaim = ICSID case, toClaim = OFAC SDN entry.
//
// Time-window note: OFAC SDN entries carry no per-record designation date in
// the bulk XML feed we ingest. The OFAC sanctions regime against the states
// covered by this linker (Iran, Russia, Venezuela, Syria, Cuba, DPRK, etc.)
// has been in continuous force since well before any ICSID case in our DB
// was filed. We treat the OFAC list as "currently in force" and apply the
// ±5y window relative to today: only ICSID cases whose filing date is
// within (today - 5y) get linked. That captures the contemporaneously-
// relevant cases for the current sanctions regime.
//
// Volume control: a sanctioned country can have thousands of OFAC SDN
// entries (Iran ~3000, Russia ~2000). Linking every ICSID case to every
// SDN entry would create millions of edges. We cap each ICSID case at
// MAX_LINKS_PER_CASE (default 10) representative OFAC entries, sorted
// deterministically by OFAC uid ascending so re-runs are stable.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/link-icsid-ofac.ts --dry-run
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-icsid-ofac.ts
//
// Flags:
//   --dry-run        Don't write ClaimRelation rows
//   --years N        Time window in years (default 5)
//   --per-case N     Cap OFAC entries linked per ICSID case (default 10)

import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const LOG_PATH = '/tmp/icsid-link-agent.log'

interface Args { dryRun: boolean; years: number; perCase: number }

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const a: Args = { dryRun: false, years: 5, perCase: 10 }
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i]
    if (v === '--dry-run') a.dryRun = true
    else if (v === '--years' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10); if (!isNaN(n) && n > 0) a.years = n
    } else if (v === '--per-case' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10); if (!isNaN(n) && n > 0) a.perCase = n
    }
  }
  return a
}

function readAlpha3(meta: Prisma.JsonValue | null): string | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const v = (meta as { alpha3?: unknown }).alpha3
  return typeof v === 'string' ? v : null
}

function readUid(meta: Prisma.JsonValue | null): number | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const v = (meta as { uid?: unknown }).uid
  return typeof v === 'number' ? v : null
}

async function main() {
  const args = parseArgs()
  console.log(`\nlink-icsid-ofac.ts — ${args.dryRun || !process.env.ALLOW_EDITS ? 'DRY RUN' : 'LIVE'}`)
  console.log(`  Window  : ±${args.years} years (anchored to today)`)
  console.log(`  Per-case: cap ${args.perCase} OFAC entries\n`)

  const isLive = !args.dryRun && !!process.env.ALLOW_EDITS

  const cutoff = new Date()
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - args.years)

  // 1. Load ICSID cases with filing date within the time window
  const icsidClaims = await prisma.claim.findMany({
    where: {
      deleted: false,
      ingestedBy: 'icsid_v1',
      claimEmergedAt: { gte: cutoff },
    },
    select: { id: true, externalId: true, claimEmergedAt: true, metadata: true },
  })
  console.log(`  ICSID claims (filing ≥ ${cutoff.toISOString().slice(0, 10)}): ${icsidClaims.length}`)

  // Bucket ICSID by alpha3
  const icsidByAlpha3 = new Map<string, typeof icsidClaims>()
  let icsidWithCountry = 0
  for (const c of icsidClaims) {
    const a3 = readAlpha3(c.metadata)
    if (!a3) continue
    icsidWithCountry++
    const bucket = icsidByAlpha3.get(a3) ?? []
    bucket.push(c)
    icsidByAlpha3.set(a3, bucket)
  }
  console.log(`  ICSID with country alpha3: ${icsidWithCountry} across ${icsidByAlpha3.size} countries`)

  // 2. Load OFAC SDN claims; bucket by alpha3
  const ofacClaims = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: 'ofac_sdn_v1' },
    select: { id: true, externalId: true, metadata: true },
  })
  console.log(`  OFAC SDN claims: ${ofacClaims.length}`)

  const ofacByAlpha3 = new Map<string, Array<{ id: string; externalId: string | null; uid: number | null }>>()
  let ofacWithCountry = 0
  for (const c of ofacClaims) {
    const a3 = readAlpha3(c.metadata)
    if (!a3) continue
    ofacWithCountry++
    const bucket = ofacByAlpha3.get(a3) ?? []
    bucket.push({ id: c.id, externalId: c.externalId, uid: readUid(c.metadata) })
    ofacByAlpha3.set(a3, bucket)
  }
  // Sort each bucket deterministically by uid asc (nulls last)
  for (const bucket of ofacByAlpha3.values()) {
    bucket.sort((a, b) => {
      if (a.uid === null && b.uid === null) return 0
      if (a.uid === null) return 1
      if (b.uid === null) return -1
      return a.uid - b.uid
    })
  }
  console.log(`  OFAC with country alpha3: ${ofacWithCountry} across ${ofacByAlpha3.size} countries`)

  // 3. Compute candidate relations
  interface Candidate {
    fromClaimId: string
    toClaimId: string
    alpha3: string
    icsidExternalId: string | null
    ofacExternalId: string | null
    icsidYear: number | null
  }
  const candidates: Candidate[] = []
  const byCountryStats: Record<string, { icsid: number; ofacBucket: number; linked: number }> = {}

  for (const [alpha3, cases] of icsidByAlpha3.entries()) {
    const ofacBucket = ofacByAlpha3.get(alpha3) ?? []
    if (ofacBucket.length === 0) continue
    const linkedSlice = ofacBucket.slice(0, args.perCase)
    byCountryStats[alpha3] = {
      icsid: cases.length,
      ofacBucket: ofacBucket.length,
      linked: cases.length * linkedSlice.length,
    }
    for (const cs of cases) {
      for (const of of linkedSlice) {
        candidates.push({
          fromClaimId: cs.id,
          toClaimId: of.id,
          alpha3,
          icsidExternalId: cs.externalId,
          ofacExternalId: of.externalId,
          icsidYear: cs.claimEmergedAt ? cs.claimEmergedAt.getUTCFullYear() : null,
        })
      }
    }
  }
  console.log(`\n  Candidate SANCTION_CONTEXT relations: ${candidates.length}`)
  console.log(`  Countries with at least one match: ${Object.keys(byCountryStats).length}`)
  const topCountries = Object.entries(byCountryStats)
    .sort((a, b) => b[1].linked - a[1].linked)
    .slice(0, 10)
  for (const [a3, s] of topCountries) {
    console.log(`    ${a3}: ${s.icsid} ICSID × cap ${Math.min(args.perCase, s.ofacBucket)} OFAC = ${s.linked} edges (OFAC pool ${s.ofacBucket})`)
  }

  if (!isLive) {
    console.log(`\n  Sample first 5 candidates:`)
    for (const c of candidates.slice(0, 5)) {
      console.log(`    [${c.alpha3} | ${c.icsidYear ?? '?'}] ${c.icsidExternalId} → ${c.ofacExternalId}`)
    }
    console.log(`\n  Dry-run / ALLOW_EDITS not set — no writes`)
    await prisma.$disconnect()
    return
  }

  // 4. Insert ClaimRelations (skip duplicates via unique constraint)
  let inserted = 0
  let existed = 0
  let failed = 0
  for (const c of candidates) {
    const followUp = {
      country: c.alpha3,
      heuristic: 'country_match_within_window',
      window_years: args.years,
      icsid_filing_year: c.icsidYear,
      cap_per_case: args.perCase,
      pipeline_from: 'icsid_v1',
      pipeline_to: 'ofac_sdn_v1',
    }
    try {
      await prisma.claimRelation.create({
        data: {
          fromClaimId: c.fromClaimId,
          toClaimId: c.toClaimId,
          relationType: 'SANCTION_CONTEXT',
          year: c.icsidYear ?? undefined,
          followUpContext: followUp,
        },
      })
      inserted++
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') existed++
      else { failed++; if (failed <= 5) console.error(`  insert failed: ${(e as Error).message}`) }
    }
    if ((inserted + existed + failed) % 200 === 0) {
      console.log(`  Progress: inserted=${inserted} existed=${existed} failed=${failed}`)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`  Inserted : ${inserted}`)
  console.log(`  Existed  : ${existed}`)
  console.log(`  Failed   : ${failed}`)

  const dbCount = await prisma.claimRelation.count({
    where: { relationType: 'SANCTION_CONTEXT' },
  })
  console.log(`\n  DB count (SANCTION_CONTEXT relations): ${dbCount}`)

  const fs = await import('fs')
  fs.writeFileSync(LOG_PATH, [
    `ICSID→OFAC linker complete — ${new Date().toISOString()}`,
    `  Inserted: ${inserted} | Existed: ${existed} | Failed: ${failed}`,
    `  DB count (SANCTION_CONTEXT): ${dbCount}`,
  ].join('\n') + '\n')
  console.log(`  Log → ${LOG_PATH}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error('Fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
