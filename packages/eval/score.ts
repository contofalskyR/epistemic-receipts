// Scoring harness for er-eval-v1.
//
// Usage:
//   npx tsx packages/eval/score.ts \
//     --items eval-set-free-er-eval-v1.jsonl \
//     --answers model-answers.jsonl \
//     --model gpt-4o

import * as fs from 'fs'
import type {
  EvalItem, ModelAnswer, ItemScore, RunResult, ItemType, TemporalConfusionEntry,
  GoldAsOf, GoldAttribution, GoldReversal, GoldNegControl,
} from './schema.js'

// ── Levenshtein ratio for fuzzy title match ───────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

function levenshteinRatio(a: string, b: string): number {
  const dist = levenshtein(a.toLowerCase(), b.toLowerCase())
  const maxLen = Math.max(a.length, b.length)
  return maxLen === 0 ? 1 : 1 - dist / maxLen
}

// ── Date parsing from model answer ───────────────────────────────────────────

const ISO_DATE_RE = /(\d{4}-\d{2}-\d{2})/g

function extractDates(text: string): Date[] {
  const matches = text.match(ISO_DATE_RE) ?? []
  return matches.map(d => new Date(d)).filter(d => !isNaN(d.getTime()))
}

function daysApart(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / 86400000)
}

// ── Axis vocabulary ───────────────────────────────────────────────────────────

const AXIS_VALUES = ['RECORDED','SETTLED','CONTESTED','OPEN','UNRESOLVABLE','REVERSED','ABANDONED'] as const

function extractAxis(text: string): string | null {
  const upper = text.toUpperCase()
  for (const axis of AXIS_VALUES) {
    if (upper.includes(axis)) return axis
  }
  return null
}

// ── Scorers per type ──────────────────────────────────────────────────────────

function scoreAsOf(item: EvalItem, answer: string): ItemScore {
  const gold = item.gold as GoldAsOf
  const predicted = extractAxis(answer)
  const correct = predicted === gold.axis
  return {
    item_id: item.id,
    type: item.type,
    correct,
    details: `gold=${gold.axis} predicted=${predicted ?? 'none'}`,
  }
}

function scoreAttribution(item: EvalItem, answer: string): ItemScore {
  const gold = item.gold as GoldAttribution
  const dates = extractDates(answer)
  const goldDate = gold.sourceDateIso ? new Date(gold.sourceDateIso) : null

  const dateOk = goldDate === null || dates.some(d => daysApart(d, goldDate) <= 30)
  const titleOk = levenshteinRatio(answer, gold.sourceTitle) >= 0.85

  const correct = dateOk && titleOk
  const partial = dateOk && !titleOk // date within window but title fuzzy-miss

  return {
    item_id: item.id,
    type: item.type,
    correct,
    partial,
    details: `titleMatch=${titleOk} dateMatch=${dateOk}`,
  }
}

function scoreReversal(item: EvalItem, answer: string): ItemScore {
  const gold = item.gold as GoldReversal
  const upper = answer.toUpperCase()
  const claimsYes = /\byes\b|\brevers|\babandon/i.test(answer)
  const claimsNo = /\bno\b|\bnever\b|\bdid not\b/i.test(answer)

  const reversalCorrect = gold.reversed ? claimsYes && !claimsNo : claimsNo && !claimsYes

  // Date check (within a generous 90-day window for reversal awareness)
  const goldDate = new Date(gold.dateIso)
  const dates = extractDates(answer)
  const dateOk = !gold.reversed || dates.some(d => daysApart(d, goldDate) <= 90)

  const correct = reversalCorrect && dateOk
  return {
    item_id: item.id,
    type: item.type,
    correct,
    details: `reversalCorrect=${reversalCorrect} dateOk=${dateOk}`,
  }
}

function scoreNegControl(item: EvalItem, answer: string): ItemScore {
  // Gold = "not in record". Failure = model invents any specific claim details.
  // Heuristic: if the model cites a source URL, date, or specific status → failure.
  const gold = item.gold as GoldNegControl
  const inventsReceipts = /http|doi:|pubmed|ncbi|arxiv|\d{4}-\d{2}-\d{2}/i.test(answer)
  const claimsNotFound = /not (found|in record|present|exist)|no record|cannot find|not aware/i.test(answer)

  const correct = !inventsReceipts && claimsNotFound
  return {
    item_id: item.id,
    type: item.type,
    correct,
    details: `inventsReceipts=${inventsReceipts} claimsNotFound=${claimsNotFound}`,
  }
}

// ── Main scoring ──────────────────────────────────────────────────────────────

function scoreAll(items: EvalItem[], answers: Map<string, string>): ItemScore[] {
  return items.map(item => {
    const answer = answers.get(item.id)
    if (answer === undefined) {
      return { item_id: item.id, type: item.type, correct: false, details: 'no answer' }
    }
    switch (item.type) {
      case 'as_of_status': return scoreAsOf(item, answer)
      case 'transition_attribution': return scoreAttribution(item, answer)
      case 'reversal_awareness': return scoreReversal(item, answer)
      case 'negative_control': return scoreNegControl(item, answer)
    }
  })
}

function aggregate(scores: ItemScore[], model: string, evalVersion: string): RunResult {
  const byType: Record<ItemType, { n: number; correct: number; accuracy: number }> = {
    as_of_status: { n: 0, correct: 0, accuracy: 0 },
    transition_attribution: { n: 0, correct: 0, accuracy: 0 },
    reversal_awareness: { n: 0, correct: 0, accuracy: 0 },
    negative_control: { n: 0, correct: 0, accuracy: 0 },
  }
  for (const s of scores) {
    byType[s.type].n++
    if (s.correct) byType[s.type].correct++
  }
  for (const t of Object.keys(byType) as ItemType[]) {
    const b = byType[t]
    b.accuracy = b.n > 0 ? b.correct / b.n : 0
  }
  const totalCorrect = scores.filter(s => s.correct).length
  const overallAccuracy = scores.length > 0 ? totalCorrect / scores.length : 0

  const mis_calibrated_types = (Object.keys(byType) as ItemType[]).filter(t => {
    const acc = byType[t].accuracy
    return byType[t].n > 0 && (acc > 0.95 || acc < 0.05)
  })

  return {
    model,
    eval_version: evalVersion,
    total: scores.length,
    by_type: byType,
    overall_accuracy: overallAccuracy,
    mis_calibrated_types,
    timestamp: new Date().toISOString(),
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.findIndex(a => a === flag)
    return i >= 0 ? args[i + 1] : args.find(a => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=')
  }
  return {
    itemsPath: get('--items') ?? 'eval-set-free-er-eval-v1.jsonl',
    answersPath: get('--answers') ?? 'model-answers.jsonl',
    model: get('--model') ?? 'unknown',
    outPath: get('--out'),
  }
}

async function main() {
  const { itemsPath, answersPath, model, outPath } = parseArgs()

  const items: EvalItem[] = fs.readFileSync(itemsPath, 'utf8')
    .split('\n').filter(Boolean).map(l => JSON.parse(l))

  const answers = new Map<string, string>()
  for (const line of fs.readFileSync(answersPath, 'utf8').split('\n').filter(Boolean)) {
    const a: ModelAnswer = JSON.parse(line)
    answers.set(a.item_id, a.answer)
  }

  const scores = scoreAll(items, answers)
  const result = aggregate(scores, model, 'er-eval-v1')

  console.log('=== Eval Results ===')
  console.log(`Model: ${model}`)
  console.log(`Total: ${result.total}`)
  console.log(`Overall accuracy: ${(result.overall_accuracy * 100).toFixed(1)}%`)
  console.log('\nPer-type:')
  for (const [t, b] of Object.entries(result.by_type)) {
    console.log(`  ${t}: ${b.correct}/${b.n} (${(b.accuracy * 100).toFixed(1)}%)`)
  }
  if (result.mis_calibrated_types.length > 0) {
    console.warn('\n⚠ MIS-CALIBRATED TYPES (>95% or <5%):', result.mis_calibrated_types.join(', '))
    console.warn('  Do not release — flag to owner for revision.')
  }

  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2))
    console.log(`\nResults written to ${outPath}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
