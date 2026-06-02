/**
 * link-congress-relations.ts
 *
 * Builds ClaimRelation rows tied to the congress_votes_v1 corpus.
 *
 *   OUTCOME (Pass A, in-DB only)
 *     vote claim (congress_votes_v1) → matching enacted-law claim (congress_v1)
 *     keyed on congress + billType + billNumber. No API call.
 *
 *   SUPERSEDED_BY (Pass B, Congress.gov /relatedbills API)
 *     law-claim ↔ law-claim, when Congress.gov flags an amend/supersede/replace
 *     relationship between two bills and BOTH bills exist as congress_v1 claims.
 *     Direction: earlier enactedDate → later enactedDate (or earlier congress).
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-congress-relations.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-congress-relations.ts
 *
 * Flags:
 *   --dry-run        no DB writes
 *   --limit N        process only first N unique bills (API budget)
 *   --verbose        per-bill progress logs
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ALLOW_EDITS = process.env.ALLOW_EDITS === 'true'
const DRY_RUN = !ALLOW_EDITS || process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')
const limitIdx = process.argv.indexOf('--limit')
const LIMIT = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1] ?? '0', 10) : 0

const CONGRESS_BASE = 'https://api.congress.gov/v3'
const PAGE_SIZE = 250

// ─── HTTP + throttle ─────────────────────────────────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 250

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function congressGet<T>(url: string, retries = 3): Promise<T> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) {
      const safe = url.replace(/api_key=[^&]+/, 'api_key=REDACTED')
      throw new Error(`Congress API ${res.status} at ${safe}`)
    }
    return res.json() as Promise<T>
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface RelatedBill {
  congress: number
  number: string
  type: string
  title?: string
  relationshipDetails?: Array<{ type: string; identifiedBy: string }>
  latestAction?: { actionDate: string; text: string }
  url?: string
}

interface RelatedBillsResponse {
  relatedBills?: RelatedBill[]
  pagination?: { count?: number; next?: string }
}

interface LawClaimRow {
  id: string
  enactedDate: string | null
}

// ─── Keys + classifiers ──────────────────────────────────────────────────────

function billKey(congress: number, billType: string, billNumber: string): string {
  return `${congress}_${billType.toLowerCase()}_${billNumber}`
}

/**
 * Whitelist supersede/amend signals based on observed Congress.gov /relatedbills
 * relationship types. The CRS-curated vocabulary is sparse — most relationships
 * collapse to "Related bill" (too generic) or "Identical bill" / "Companion"
 * (parallel introduction, not supersession). The reliable supersede signals are:
 *
 *   "Public law contains the text"  — the other bill's text was absorbed into a
 *                                     public law; the older bill is effectively
 *                                     superseded by that law's bill.
 *   "Text similarities"             — substantive text overlap, weaker but
 *                                     usable signal of reuse/replacement.
 *
 * Anything containing amend/supersede/replace/repeal keywords also passes, in
 * case the vocabulary expands.
 */
function relIsSupersede(relType: string): boolean {
  const t = relType.toLowerCase()
  if (/companion|identical|procedurally|see also|crs source|related document/.test(t)) return false
  if (/^related bill$/.test(t)) return false
  if (/public law contains|contains the text|text similarities/.test(t)) return true
  return /amend|supersed|replac|incorporat|includes provisions|provisions included|repeal/.test(t)
}

async function fetchRelatedBills(
  congress: number,
  billType: string,
  number: string,
  apiKey: string,
): Promise<RelatedBill[]> {
  const all: RelatedBill[] = []
  let offset = 0
  for (;;) {
    const url = `${CONGRESS_BASE}/bill/${congress}/${billType}/${number}/relatedbills?api_key=${encodeURIComponent(apiKey)}&limit=${PAGE_SIZE}&offset=${offset}&format=json`
    const data = await congressGet<RelatedBillsResponse>(url)
    const list = data.relatedBills ?? []
    all.push(...list)
    if (!data.pagination?.next || list.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return all
}

async function upsertRelation(
  fromClaimId: string,
  toClaimId: string,
  relationType: 'OUTCOME' | 'SUPERSEDED_BY',
  followUpContext: Record<string, unknown>,
): Promise<'inserted' | 'skipped'> {
  if (DRY_RUN) return 'inserted'
  try {
    await prisma.claimRelation.create({
      data: { fromClaimId, toClaimId, relationType, followUpContext },
    })
    return 'inserted'
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2002') return 'skipped'
    throw e
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.CONGRESS_API_KEY
  if (!apiKey) {
    console.error('Missing CONGRESS_API_KEY in env. Add to .env.local before running.')
    process.exit(1)
  }

  console.log(`\nlink-congress-relations.ts — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${LIMIT ? ` (limit=${LIMIT})` : ''}\n`)

  // ── Pre-load lookup tables ────────────────────────────────────────────────

  const lawRows = await prisma.claim.findMany({
    where: { ingestedBy: 'congress_v1', deleted: false },
    select: { id: true, metadata: true },
  })

  const lawByKey = new Map<string, LawClaimRow>()
  for (const c of lawRows) {
    const md = c.metadata as Record<string, unknown> | null
    if (!md) continue
    const congress = md.congress as number | undefined
    const billType = md.billType as string | undefined
    const billNumber = md.billNumber as string | undefined
    if (congress === undefined || !billType || !billNumber) continue
    const enactedDate = (md.enactedDate as string | undefined) ?? null
    lawByKey.set(billKey(congress, billType, billNumber), { id: c.id, enactedDate })
  }
  console.log(`Loaded ${lawRows.length} congress_v1 claims (${lawByKey.size} keyed)`)

  const voteRows = await prisma.claim.findMany({
    where: { ingestedBy: 'congress_votes_v1', deleted: false },
    select: { id: true, metadata: true },
  })
  console.log(`Loaded ${voteRows.length} congress_votes_v1 claims`)

  // ── Pass A: OUTCOME (vote → law) ──────────────────────────────────────────

  console.log('\n--- Pass A: OUTCOME (vote → enacted law) ---')
  let outInserted = 0
  let outSkipped = 0
  let outMissed = 0
  for (const vote of voteRows) {
    const md = vote.metadata as Record<string, unknown> | null
    if (!md) { outMissed++; continue }
    const congress = md.congress as number | undefined
    const billType = md.billType as string | undefined
    const billNumber = md.billNumber as string | undefined
    if (congress === undefined || !billType || !billNumber) { outMissed++; continue }
    const law = lawByKey.get(billKey(congress, billType, billNumber))
    if (!law) { outMissed++; continue }

    const ctx = {
      outcomeType: 'enacted_law',
      pipeline_from: 'congress_votes_v1',
      pipeline_to: 'congress_v1',
      congress,
      billType: billType.toUpperCase(),
      billNumber,
      heuristic: 'congress_vote_to_law_match',
      confidence: 'high',
    }
    const r = await upsertRelation(vote.id, law.id, 'OUTCOME', ctx)
    if (r === 'inserted') outInserted++
    else outSkipped++
  }
  console.log(`  inserted=${outInserted} skipped(existing)=${outSkipped} unmatched=${outMissed}`)

  // ── Pass B: SUPERSEDED_BY (law ↔ law, via API) ────────────────────────────

  console.log('\n--- Pass B: SUPERSEDED_BY (Congress.gov /relatedbills) ---')

  // Dedupe by bill — many bills have both House + Senate votes
  const billMap = new Map<string, { congress: number; billType: string; billNumber: string }>()
  for (const v of voteRows) {
    const md = v.metadata as Record<string, unknown> | null
    if (!md) continue
    const congress = md.congress as number | undefined
    const billType = md.billType as string | undefined
    const billNumber = md.billNumber as string | undefined
    if (congress === undefined || !billType || !billNumber) continue
    billMap.set(billKey(congress, billType, billNumber), { congress, billType, billNumber })
  }
  let bills = Array.from(billMap.values())
  if (LIMIT > 0) bills = bills.slice(0, LIMIT)
  console.log(`  ${bills.length} unique bills to query`)

  const relTypeCounts = new Map<string, number>()
  let billsProcessed = 0
  let billsErrored = 0
  let totalRelated = 0
  let supersedeMatches = 0
  let bothSidesHaveLawClaim = 0
  let supInserted = 0
  let supSkipped = 0

  for (const bill of bills) {
    const selfKey = billKey(bill.congress, bill.billType, bill.billNumber)
    const selfLaw = lawByKey.get(selfKey)
    // If this bill has no congress_v1 law claim, we can't anchor the from/to side.
    if (!selfLaw) { billsProcessed++; continue }

    let related: RelatedBill[]
    try {
      related = await fetchRelatedBills(bill.congress, bill.billType, bill.billNumber, apiKey)
    } catch (err) {
      console.error(`  Failed related-bills for ${bill.congress}/${bill.billType}/${bill.billNumber}: ${(err as Error).message}`)
      billsErrored++
      billsProcessed++
      continue
    }
    totalRelated += related.length

    for (const rel of related) {
      const details = rel.relationshipDetails ?? []
      for (const d of details) {
        relTypeCounts.set(d.type, (relTypeCounts.get(d.type) ?? 0) + 1)
      }
      if (!details.some(d => relIsSupersede(d.type))) continue
      supersedeMatches++

      const relLaw = lawByKey.get(billKey(rel.congress, rel.type, rel.number))
      if (!relLaw) continue
      if (relLaw.id === selfLaw.id) continue
      bothSidesHaveLawClaim++

      // Determine direction: earlier → later
      const selfDate = selfLaw.enactedDate ?? ''
      const relDate = relLaw.enactedDate ?? rel.latestAction?.actionDate ?? ''
      let fromId: string
      let toId: string
      if (selfDate && relDate && selfDate < relDate) {
        fromId = selfLaw.id; toId = relLaw.id
      } else if (selfDate && relDate && selfDate > relDate) {
        fromId = relLaw.id; toId = selfLaw.id
      } else if (bill.congress < rel.congress) {
        fromId = selfLaw.id; toId = relLaw.id
      } else if (bill.congress > rel.congress) {
        fromId = relLaw.id; toId = selfLaw.id
      } else {
        // Same congress + indistinguishable date — skip to avoid arbitrary direction
        continue
      }

      const ctx = {
        amendmentType: details.map(d => d.type).join(','),
        thisBill: `${bill.congress}/${bill.billType.toUpperCase()}/${bill.billNumber}`,
        relatedBill: `${rel.congress}/${rel.type.toUpperCase()}/${rel.number}`,
        identifiedBy: details[0]?.identifiedBy ?? 'unknown',
        heuristic: 'congress_related_bills_api',
        confidence: 'medium',
      }
      const r = await upsertRelation(fromId, toId, 'SUPERSEDED_BY', ctx)
      if (r === 'inserted') supInserted++
      else supSkipped++
    }

    billsProcessed++
    if (VERBOSE && related.length > 0) {
      console.log(`  ${bill.congress}/${bill.billType}/${bill.billNumber} → ${related.length} related`)
    }
    if (!VERBOSE && billsProcessed % 25 === 0) {
      process.stdout.write(`  ${billsProcessed}/${bills.length} bills · ${supInserted} inserted\r`)
    }
  }

  console.log(`\n  Bills queried: ${billsProcessed} (errors: ${billsErrored})`)
  console.log(`  Related bills returned (raw): ${totalRelated}`)
  console.log(`  Supersede-type matches: ${supersedeMatches}`)
  console.log(`  Both sides have law claim: ${bothSidesHaveLawClaim}`)
  console.log(`  Inserted: ${supInserted} · Skipped (existing): ${supSkipped}`)

  console.log('\n  Relationship type counts (top 20):')
  const sorted = Array.from(relTypeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20)
  for (const [t, n] of sorted) {
    console.log(`    ${n.toString().padStart(5)}  ${t}  ${relIsSupersede(t) ? '← MATCH' : ''}`)
  }

  console.log(`\nTotal inserted: ${outInserted + supInserted} (mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'})`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
