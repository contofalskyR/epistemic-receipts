/**
 * link-bills-to-court.ts
 *
 * Builds ClaimRelation rows linking enacted Congress bills (congress_v1) to
 * CourtListener opinions (courtlistener_*) that reference them by act name.
 *
 * Strategy:
 *   1. Load every enacted congress_v1 claim, extract the short title that
 *      follows "enacted —".
 *   2. Drop generic titles ("To amend …", "An Act to …", post-office naming
 *      bills, etc.) and any title shorter than 4 words.
 *   3. For each remaining act name, run an ILIKE search against Claim.text
 *      for any pipeline matching 'courtlistener_%'. Limit 10 matches per act
 *      to bound false positives on common phrases.
 *   4. Upsert one ClaimRelation per (court opinion → congress bill) pair with
 *      relationType='CITES' — the closest valid type for "this court opinion
 *      references/challenges this enacted law" (REFERENCED_BY is not in the
 *      existing vocabulary; see prisma/schema.prisma ClaimRelation.relationType).
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-bills-to-court.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-bills-to-court.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ALLOW_EDITS = process.env.ALLOW_EDITS === 'true'
const DRY_RUN = !ALLOW_EDITS || process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

const TITLE_RE = /enacted\s+[—\-]\s+(.+?)\s*$/
const PER_ACT_LIMIT = 10
const MIN_WORDS = 4

// Generic / boilerplate openings that don't yield a stable, court-searchable
// act name. "An Act to amend…", "A bill to amend…", "To designate the facility…"
// "To amend title 36, United States Code, to designate the bald eagle…".
const GENERIC_PREFIX_RE =
  /^(a\s+(?:bill|joint\s+resolution|resolution|concurrent\s+resolution|act)\s+|an\s+act\s+(?:to|making|for|providing)\s+|to\s+(?:amend|designate|make|provide|establish|authorize|reauthorize|extend|repeal|require|prohibit|direct|clarify|correct|remove|name|rename|redesignate|allow|modify|enact|reform|continue|carry|grant|recognize|express|reaffirm|appoint|reimburse|transfer|convey|exempt|adjust|increase|reduce|terminate|prevent|ensure|improve|preserve|implement|encourage|promote)\s+)/i

function extractTitle(text: string): string | null {
  const m = text.match(TITLE_RE)
  if (!m) return null
  return m[1]
    .replace(/^["“']|["”']$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isMatchableActName(title: string): boolean {
  if (GENERIC_PREFIX_RE.test(title)) return false
  const wordCount = title.split(/\s+/).filter(w => w.length > 0).length
  if (wordCount < MIN_WORDS) return false
  // Require the title to look like an act/law name — anchor on "Act",
  // "Resolution", "Amendments", or "Reauthorization". This eliminates
  // descriptive titles that wouldn't be cited by name in an opinion.
  if (!/\b(Act|Resolution|Amendments?|Reauthorization)\b/.test(title)) return false
  return true
}

// Escape % and _ for use inside an ILIKE pattern.
function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

interface Match {
  id: string
  ingestedBy: string
}

async function findCourtMatches(actName: string): Promise<Match[]> {
  const pattern = `%${escapeLike(actName)}%`
  // Search both the templated claim text AND the enriched opinion_body in metadata.
  // opinion_body is stored as a JSON string under metadata->>'opinion_body'.
  return prisma.$queryRaw<Match[]>`
    SELECT id, "ingestedBy"
    FROM "Claim"
    WHERE "ingestedBy" LIKE 'courtlistener_%'
      AND deleted = false
      AND (
        text ILIKE ${pattern}
        OR (metadata IS NOT NULL AND metadata->>'opinion_body' ILIKE ${pattern})
        OR (metadata IS NOT NULL AND metadata->>'statutes_cited' ILIKE ${pattern})
      )
    LIMIT ${PER_ACT_LIMIT}
  `
}

async function upsertRelation(
  fromClaimId: string,
  toClaimId: string,
  followUpContext: Record<string, unknown>,
): Promise<'inserted' | 'skipped'> {
  if (DRY_RUN) return 'inserted'
  try {
    await prisma.claimRelation.create({
      data: { fromClaimId, toClaimId, relationType: 'CITES', followUpContext },
    })
    return 'inserted'
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2002') return 'skipped'
    throw e
  }
}

async function main() {
  console.log(`\nlink-bills-to-court.ts — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`)

  const bills = await prisma.claim.findMany({
    where: { ingestedBy: 'congress_v1', deleted: false },
    select: { id: true, text: true },
  })
  console.log(`Loaded ${bills.length} congress_v1 claims`)

  // Dedupe by act name so two bills with the same title don't double-query.
  const actNameToBillId = new Map<string, string>()
  let skippedGeneric = 0
  let skippedNoTitle = 0
  for (const b of bills) {
    const title = extractTitle(b.text)
    if (!title) { skippedNoTitle++; continue }
    if (!isMatchableActName(title)) { skippedGeneric++; continue }
    if (!actNameToBillId.has(title)) actNameToBillId.set(title, b.id)
  }
  console.log(
    `Matchable act names: ${actNameToBillId.size} ` +
    `(skipped generic=${skippedGeneric}, skipped no-title=${skippedNoTitle})`
  )

  let actsSearched = 0
  let actsWithMatch = 0
  let inserted = 0
  let skipped = 0
  let pairsConsidered = 0

  for (const [actName, billId] of actNameToBillId) {
    actsSearched++
    const matches = await findCourtMatches(actName)
    if (matches.length === 0) {
      if (VERBOSE) console.log(`  no match: ${actName}`)
      continue
    }
    actsWithMatch++
    for (const m of matches) {
      pairsConsidered++
      const ctx = {
        heuristic: 'court_opinion_ilike_act_name',
        actName,
        pipeline_from: m.ingestedBy,
        pipeline_to: 'congress_v1',
        confidence: 'medium',
      }
      // Direction: court opinion (from) cites enacted law (to).
      const r = await upsertRelation(m.id, billId, ctx)
      if (r === 'inserted') inserted++
      else skipped++
    }
    if (VERBOSE) {
      console.log(`  +${matches.length}: ${actName}`)
    }
    if (!VERBOSE && actsSearched % 250 === 0) {
      process.stdout.write(`  ${actsSearched}/${actNameToBillId.size} acts · ${inserted} inserted\r`)
    }
  }

  console.log(`\nActs searched: ${actsSearched}`)
  console.log(`Acts with ≥1 court match: ${actsWithMatch}`)
  console.log(`Pairs considered: ${pairsConsidered}`)
  console.log(`Inserted: ${inserted} · Skipped (existing): ${skipped}`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`)

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
