// Spec 23 — Temporal-Knowledge Eval Set Builder
// Version stamp: er-eval-v1
//
// Run (dry-run / validation only, no DB needed):
//   npx tsx scripts/build-eval-set.ts --dry-run
//
// Run against production DB (requires DATABASE_URL in .env.local):
//   npx tsx scripts/build-eval-set.ts --free   --seed 42 --snapshot 2026-07-07
//   npx tsx scripts/build-eval-set.ts --full   --seed 42 --snapshot 2026-07-07
//
// Determinism: two runs with the same --seed + --snapshot against the same DB
// must produce identical output. Verify with:
//   sha256sum eval-set-free-er-eval-v1.jsonl
//
// BLOCKED acceptance criteria (require live DB):
//   - Actual item counts and distribution
//   - Determinism hash paste
//   - Leakage / ambiguity screen counts
//   - Negative-control collision check

import 'dotenv/config'
import * as fs from 'fs'
import * as crypto from 'crypto'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

// ── Constants ─────────────────────────────────────────────────────────────────

const PIPELINE_VERSION = 'er-eval-v1'
const FREE_TARGET = 500
const FULL_TARGET = 5000
const NEGATIVE_CONTROL_FRACTION = 0.10

// Leakage patterns: if any appear in the claim text (case-insensitive), flag item.
const LEAKAGE_PATTERNS = [
  /\bretract/i,
  /\brevers/i,
  /\babandon/i,
  /\bsettl/i,
  /\bcontest/i,
  /\bREVERSED\b/,
  /\bABANDONED\b/,
  /\bSETTLED\b/,
  /\bDISCredit/i,
  /\bcorrect/i,
  /\bwithdraw/i,
]

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemType = 'as_of_status' | 'transition_attribution' | 'reversal_awareness' | 'negative_control'

interface GoldAsOf {
  type: 'as_of_status'
  axis: string | 'RECORDED'
}
interface GoldAttribution {
  type: 'transition_attribution'
  sourceTitle: string
  sourceDateIso: string | null
}
interface GoldReversal {
  type: 'reversal_awareness'
  reversed: boolean
  dateIso: string
  datePrecision: string
}
interface GoldNegControl {
  type: 'negative_control'
  inRecord: false
}

type Gold = GoldAsOf | GoldAttribution | GoldReversal | GoldNegControl

interface EvalItem {
  id: string
  pipeline_version: string
  type: ItemType
  claim_id: string | null
  prompt: string
  gold: Gold
  receipts: string[]
  construction_method: string
  pipeline_provenance: {
    seed: number
    snapshot_date: string
    slot?: string
    transition_ids?: string[]
  }
}

interface TransitionRow {
  id: string
  claimId: string
  fromAxis: string | null
  toAxis: string
  community: string
  reason: string | null
  occurredAt: Date
  datePrecision: string | null
  sourceId: string | null
  sourceName: string | null
  sourceUrl: string | null
  sourcePublishedAt: Date | null
  claimText: string
  claimHumanReviewed: boolean
}

// ── PRNG (mulberry32 — deterministic, seedable) ───────────────────────────────

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function sameCalendarMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()
}

// ── Leakage check ─────────────────────────────────────────────────────────────

function leakageCheck(claimText: string): boolean {
  return LEAKAGE_PATTERNS.some(p => p.test(claimText))
}

// ── Offline TF-IDF similarity (for negative-control collision check) ──────────

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
}

function buildTfIdf(docs: string[]): Map<string, number[]>[] {
  const tokenized = docs.map(tokenize)
  const N = docs.length
  const df = new Map<string, number>()
  for (const tokens of tokenized) {
    for (const t of new Set(tokens)) df.set(t, (df.get(t) ?? 0) + 1)
  }
  return tokenized.map(tokens => {
    const tf = new Map<string, number>()
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
    const vec = new Map<string, number>()
    for (const [t, count] of tf) {
      const idf = Math.log((N + 1) / ((df.get(t) ?? 0) + 1))
      vec.set(t, (count / tokens.length) * idf)
    }
    return vec
  })
}

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, normA = 0, normB = 0
  for (const [t, v] of a) {
    dot += v * (b.get(t) ?? 0)
    normA += v * v
  }
  for (const [, v] of b) normB += v * v
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ── Negative control construction ─────────────────────────────────────────────

// Perturbation: swap a noun-phrase token from the claim with a plausible fake.
// We use a fixed substitution list to stay deterministic.
const FAKE_ENTITIES = [
  'Zylofaxine', 'Medroxalin', 'Protivolumab', 'Sintavax', 'Regulofen',
  'Nexaprex', 'Cortimadol', 'Trivastatine', 'Glucaverin', 'Phenomorph',
]

function perturbClaimText(text: string, rand: () => number, idx: number): string {
  const entity = FAKE_ENTITIES[idx % FAKE_ENTITIES.length]
  // Replace the first capitalized multi-char word (likely a named entity)
  const replaced = text.replace(/\b[A-Z][a-z]{3,}\b/, entity)
  if (replaced !== text) return replaced
  // Fallback: prepend a distinguishing qualifier
  return `[Hypothetical] ${text}`
}

// ── Item ID generation ────────────────────────────────────────────────────────

let itemCounter = 0
function nextItemId(type: ItemType, seed: number): string {
  itemCounter++
  const prefix = { as_of_status: 'aos', transition_attribution: 'ta', reversal_awareness: 'ra', negative_control: 'nc' }[type]
  return `${PIPELINE_VERSION}-${prefix}-${String(seed).padStart(4, '0')}-${String(itemCounter).padStart(6, '0')}`
}

// ── DB query ──────────────────────────────────────────────────────────────────

async function fetchEligibleTransitions(prisma: PrismaClient): Promise<TransitionRow[]> {
  // Raw query for efficiency and to ensure we get join fields not in Prisma types.
  const rows = await prisma.$queryRaw<TransitionRow[]>`
    SELECT
      csh.id,
      csh."claimId",
      csh."fromAxis",
      csh."toAxis",
      csh.community,
      csh.reason,
      csh."occurredAt",
      csh."datePrecision",
      csh."sourceId",
      s.name AS "sourceName",
      s.url  AS "sourceUrl",
      s."publishedAt" AS "sourcePublishedAt",
      c.text AS "claimText",
      c."humanReviewed" AS "claimHumanReviewed"
    FROM "ClaimStatusHistory" csh
    JOIN "Claim" c ON c.id = csh."claimId"
    LEFT JOIN "Source" s ON s.id = csh."sourceId"
    WHERE
      c.deleted = false
      AND (c."verificationStatus" IS NULL OR c."verificationStatus" != 'DEPRECATED')
      AND csh."sourceId" IS NOT NULL
      AND csh."datePrecision" IN ('DAY', 'MONTH', 'YEAR')
    ORDER BY csh."claimId", csh."occurredAt" ASC
  `
  return rows
}

// ── Item builders ──────────────────────────────────────────────────────────────

function buildAsOfItems(
  claimId: string,
  transitions: TransitionRow[],
  seed: number,
): EvalItem[] {
  const items: EvalItem[] = []

  for (let i = 0; i < transitions.length; i++) {
    const tr = transitions[i]
    const nextTr = transitions[i + 1] ?? null
    const precision = tr.datePrecision ?? 'DAY'

    // YEAR precision: as-of dates must be ≥365 days after occurredAt
    const isYear = precision === 'YEAR'
    const isMonth = precision === 'MONTH'

    const beforeOffset = isYear ? -400 : isMonth ? -20 : -1
    const afterOffset  = isYear ? 400  : isMonth ? 20  : 1

    const slots: { slot: string; date: Date }[] = [
      { slot: 'before', date: addDays(tr.occurredAt, beforeOffset) },
      { slot: 'after',  date: addDays(tr.occurredAt, afterOffset) },
    ]

    // stable: midpoint to next transition, or +180 days
    const stableBase = nextTr
      ? new Date((tr.occurredAt.getTime() + nextTr.occurredAt.getTime()) / 2)
      : addDays(tr.occurredAt, 180)
    slots.push({ slot: 'stable', date: stableBase })

    for (const { slot, date } of slots) {
      // Determine gold at this as-of date
      const priorTransitions = transitions.filter(t => t.occurredAt <= date)
      const goldAxis = priorTransitions.length > 0
        ? priorTransitions[priorTransitions.length - 1].toAxis
        : 'RECORDED'

      // Ambiguity exclusion: if winning transition is MONTH precision and
      // as-of date is in the same calendar month as that transition, exclude.
      const winningTr = priorTransitions[priorTransitions.length - 1]
      if (winningTr && winningTr.datePrecision === 'MONTH' && sameCalendarMonth(winningTr.occurredAt, date)) {
        continue
      }

      // Leakage check
      if (leakageCheck(tr.claimText)) continue

      const id = nextItemId('as_of_status', seed)
      items.push({
        id,
        pipeline_version: PIPELINE_VERSION,
        type: 'as_of_status',
        claim_id: claimId,
        prompt: `What was the epistemic status of the following claim as of ${isoDate(date)}?\n\nClaim: "${tr.claimText}"`,
        gold: { type: 'as_of_status', axis: goldAxis },
        receipts: tr.sourceUrl ? [tr.sourceUrl] : [],
        construction_method: `as_of_slot_${slot}`,
        pipeline_provenance: {
          seed,
          snapshot_date: new Date().toISOString().slice(0, 10),
          slot,
          transition_ids: [tr.id],
        },
      })
    }
  }

  return items
}

function buildAttributionItems(transitions: TransitionRow[], seed: number): EvalItem[] {
  return transitions
    .filter(tr => tr.sourceId !== null && tr.sourceName !== null)
    .filter(tr => !leakageCheck(tr.claimText))
    .map(tr => {
      const id = nextItemId('transition_attribution', seed)
      return {
        id,
        pipeline_version: PIPELINE_VERSION,
        type: 'transition_attribution' as ItemType,
        claim_id: tr.claimId,
        prompt: `What source or event caused the epistemic status of the following claim to change from ${tr.fromAxis ?? 'RECORDED'} to ${tr.toAxis}?\n\nClaim: "${tr.claimText}"`,
        gold: {
          type: 'transition_attribution' as const,
          sourceTitle: tr.sourceName!,
          sourceDateIso: tr.sourcePublishedAt ? isoDate(tr.sourcePublishedAt) : null,
        },
        receipts: tr.sourceUrl ? [tr.sourceUrl] : [],
        construction_method: 'transition_attribution_v1',
        pipeline_provenance: {
          seed,
          snapshot_date: new Date().toISOString().slice(0, 10),
          transition_ids: [tr.id],
        },
      }
    })
}

function buildReversalItems(
  claimId: string,
  transitions: TransitionRow[],
  seed: number,
): EvalItem[] {
  const reversals = transitions.filter(tr =>
    tr.toAxis === 'REVERSED' || tr.toAxis === 'ABANDONED'
  )
  if (reversals.length === 0) return []

  const first = reversals[0]
  if (leakageCheck(first.claimText)) return []

  const id = nextItemId('reversal_awareness', seed)
  return [{
    id,
    pipeline_version: PIPELINE_VERSION,
    type: 'reversal_awareness',
    claim_id: claimId,
    prompt: `Did the scientific or institutional consensus on the following claim ever reverse or get abandoned? If so, when?\n\nClaim: "${first.claimText}"`,
    gold: {
      type: 'reversal_awareness',
      reversed: true,
      dateIso: isoDate(first.occurredAt),
      datePrecision: first.datePrecision ?? 'DAY',
    },
    receipts: first.sourceUrl ? [first.sourceUrl] : [],
    construction_method: 'reversal_awareness_v1',
    pipeline_provenance: {
      seed,
      snapshot_date: new Date().toISOString().slice(0, 10),
      transition_ids: reversals.map(r => r.id),
    },
  }]
}

function buildNegativeControls(
  realClaims: { claimId: string; text: string }[],
  targetCount: number,
  rand: () => number,
  seed: number,
  realTexts: string[],
): EvalItem[] {
  const realVecs = buildTfIdf(realTexts)
  const items: EvalItem[] = []
  const shuffled = shuffleArray(realClaims, rand)
  let collisions = 0

  for (let i = 0; i < shuffled.length && items.length < targetCount; i++) {
    const { text } = shuffled[i]
    const perturbed = perturbClaimText(text, rand, i)

    // Collision check: cosine similarity against real claim texts
    const perturbedVec = buildTfIdf([perturbed])[0]
    const maxSim = Math.max(...realVecs.map(v => cosineSim(perturbedVec, v)))
    if (maxSim >= 0.85) {
      collisions++
      continue
    }

    const id = nextItemId('negative_control', seed)
    items.push({
      id,
      pipeline_version: PIPELINE_VERSION,
      type: 'negative_control',
      claim_id: null,
      prompt: `Is the following claim present in the epistemic record, and if so, what is its current status?\n\nClaim: "${perturbed}"`,
      gold: { type: 'negative_control', inRecord: false },
      receipts: [],
      construction_method: 'negcontrol_perturb_v1',
      pipeline_provenance: { seed, snapshot_date: new Date().toISOString().slice(0, 10) },
    })
  }

  console.error(`[negcontrol] ${items.length} generated, ${collisions} collision-rejected`)
  return items
}

// ── Validation: JSON Schema ───────────────────────────────────────────────────

function validateItem(item: EvalItem): string[] {
  const errors: string[] = []
  if (!item.id?.startsWith(PIPELINE_VERSION)) errors.push('bad id prefix')
  if (!item.type) errors.push('missing type')
  if (!item.prompt) errors.push('missing prompt')
  if (!item.gold?.type) errors.push('missing gold.type')
  if (!item.pipeline_version) errors.push('missing pipeline_version')
  if (item.type !== 'negative_control' && !item.claim_id) errors.push('missing claim_id')
  return errors
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--free') ? 'free'
    : args.includes('--full') ? 'full'
    : args.includes('--dry-run') ? 'dry-run'
    : 'dry-run'

  const getFlag = (flag: string): string | undefined => {
    const eqForm = args.find(a => a.startsWith(`${flag}=`))
    if (eqForm) return eqForm.slice(flag.length + 1)
    const idx = args.indexOf(flag)
    if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('-')) return args[idx + 1]
    return undefined
  }

  const seedStr = getFlag('--seed')
  const seed = seedStr ? parseInt(seedStr, 10) : 42
  const snapshotDate = getFlag('--snapshot') ?? new Date().toISOString().slice(0, 10)

  return { mode, seed, snapshotDate }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, seed, snapshotDate } = parseArgs()
  const rand = mulberry32(seed)
  itemCounter = 0

  if (mode === 'dry-run') {
    console.log('Dry-run mode: validating schema only (no DB access).')
    // Synthesize a small fixture item to verify schema pipeline.
    const fixture: EvalItem = {
      id: `${PIPELINE_VERSION}-aos-0042-000001`,
      pipeline_version: PIPELINE_VERSION,
      type: 'as_of_status',
      claim_id: 'fixture_claim_id',
      prompt: 'What was the epistemic status of the following claim as of 2024-01-01?\n\nClaim: "Drug X was approved by the FDA."',
      gold: { type: 'as_of_status', axis: 'SETTLED' },
      receipts: ['https://example.com/source'],
      construction_method: 'as_of_slot_before',
      pipeline_provenance: { seed, snapshot_date: snapshotDate, slot: 'before', transition_ids: ['fixture'] },
    }
    const errors = validateItem(fixture)
    if (errors.length > 0) {
      console.error('Fixture validation failed:', errors)
      process.exit(1)
    }
    console.log('Fixture item validates. Schema pipeline OK.')
    console.log(JSON.stringify(fixture, null, 2))
    return
  }

  const prisma = new PrismaClient()
  try {
    console.error(`[build-eval-set] mode=${mode} seed=${seed} snapshot=${snapshotDate}`)

    const rows = await fetchEligibleTransitions(prisma)
    console.error(`[build-eval-set] ${rows.length} eligible transitions fetched`)

    // Group by claimId, require ≥2 transitions
    const byClaimId = new Map<string, TransitionRow[]>()
    for (const row of rows) {
      const arr = byClaimId.get(row.claimId) ?? []
      arr.push(row)
      byClaimId.set(row.claimId, arr)
    }
    const eligibleClaims = [...byClaimId.entries()].filter(([, ts]) => ts.length >= 2)
    console.error(`[build-eval-set] ${eligibleClaims.length} claims with ≥2 transitions`)

    // Build positive items
    const asOfItems: EvalItem[] = []
    const attributionItems: EvalItem[] = []
    const reversalItems: EvalItem[] = []

    for (const [claimId, transitions] of eligibleClaims) {
      asOfItems.push(...buildAsOfItems(claimId, transitions, seed))
      attributionItems.push(...buildAttributionItems(transitions, seed))
      reversalItems.push(...buildReversalItems(claimId, transitions, seed))
    }

    console.error(`[build-eval-set] as_of_status: ${asOfItems.length}, attribution: ${attributionItems.length}, reversal: ${reversalItems.length}`)

    const target = mode === 'free' ? FREE_TARGET : FULL_TARGET
    const negTarget = Math.round(target * NEGATIVE_CONTROL_FRACTION)

    // Build negative controls from real claim texts
    const realClaims = eligibleClaims.map(([claimId, ts]) => ({ claimId, text: ts[0].claimText }))
    const realTexts = realClaims.map(c => c.text)
    const negItems = buildNegativeControls(realClaims, negTarget, rand, seed, realTexts)

    // Pool all positive items and sample to target - negTarget
    const positivePool = shuffleArray([...asOfItems, ...attributionItems, ...reversalItems], rand)
    const positiveTarget = target - negItems.length
    const positiveItems = positivePool.slice(0, positiveTarget)

    const allItems = shuffleArray([...positiveItems, ...negItems], rand)

    // Validate all items
    let validCount = 0, invalidCount = 0
    for (const item of allItems) {
      const errors = validateItem(item)
      if (errors.length > 0) {
        console.error(`[validate] FAIL ${item.id}: ${errors.join(', ')}`)
        invalidCount++
      } else {
        validCount++
      }
    }
    console.error(`[validate] ${validCount} valid, ${invalidCount} invalid`)
    if (invalidCount > 0) {
      console.error('Build failed: invalid items present.')
      process.exit(1)
    }

    // Leakage screen report
    const leakageFlagged = allItems.filter(i => i.type !== 'negative_control' && leakageCheck(i.prompt))
    if (leakageFlagged.length > 0) {
      const flagPath = `leakage-flagged-${mode}-${PIPELINE_VERSION}.jsonl`
      fs.writeFileSync(flagPath, leakageFlagged.map(i => JSON.stringify(i)).join('\n'))
      console.error(`[leakage] ${leakageFlagged.length} items flagged → ${flagPath}`)
    }

    // Write output
    const outPath = `eval-set-${mode}-${PIPELINE_VERSION}.jsonl`
    const lines = allItems.map(i => JSON.stringify(i))
    fs.writeFileSync(outPath, lines.join('\n'))

    // Compute and print determinism hash
    const hash = crypto.createHash('sha256').update(lines.join('\n')).digest('hex')
    console.log(`Output: ${outPath}`)
    console.log(`Items: ${allItems.length}`)
    console.log(`SHA256: ${hash}`)

    // Type distribution
    const dist: Record<string, number> = {}
    for (const i of allItems) dist[i.type] = (dist[i.type] ?? 0) + 1
    console.log('Distribution:', dist)

    // Construction stats to stderr for results doc
    console.error('[stats] eligible_transitions:', rows.length)
    console.error('[stats] eligible_claims:', eligibleClaims.length)
    console.error('[stats] total_items:', allItems.length)
    console.error('[stats] distribution:', JSON.stringify(dist))
    console.error('[stats] leakage_flagged:', leakageFlagged.length)

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
