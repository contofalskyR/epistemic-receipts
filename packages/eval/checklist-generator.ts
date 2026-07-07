// Human-review checklist generator.
//
// Samples N random items from the eval set and renders them to a Markdown
// checklist document for owner sign-off before release.
//
// Usage:
//   npx tsx packages/eval/checklist-generator.ts \
//     --items eval-set-free-er-eval-v1.jsonl \
//     --n 100 \
//     --seed 42 \
//     --out docs/human-review-checklist-free.md

import * as fs from 'fs'
import type { EvalItem } from './schema.js'

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
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

function formatGold(item: EvalItem): string {
  const g = item.gold
  switch (g.type) {
    case 'as_of_status': return `axis = **${g.axis}**`
    case 'transition_attribution': return `source = "${g.sourceTitle}" (${g.sourceDateIso ?? 'date unknown'})`
    case 'reversal_awareness': return `reversed = ${g.reversed}, date ≈ ${g.dateIso}`
    case 'negative_control': return `NOT IN RECORD`
  }
}

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.findIndex(a => a === flag)
    return i >= 0 ? args[i + 1] : args.find(a => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=')
  }
  return {
    itemsPath: get('--items') ?? 'eval-set-free-er-eval-v1.jsonl',
    n: parseInt(get('--n') ?? '100', 10),
    seed: parseInt(get('--seed') ?? '42', 10),
    outPath: get('--out') ?? 'docs/human-review-checklist.md',
  }
}

async function main() {
  const { itemsPath, n, seed, outPath } = parseArgs()
  const rand = mulberry32(seed)

  const items: EvalItem[] = fs.readFileSync(itemsPath, 'utf8')
    .split('\n').filter(Boolean).map(l => JSON.parse(l))

  const sample = shuffleArray(items, rand).slice(0, n)

  const lines: string[] = [
    '# Human Review Checklist — er-eval-v1',
    '',
    `**Sampled:** ${sample.length} of ${items.length} items  `,
    `**Seed:** ${seed}  `,
    `**Source:** ${itemsPath}  `,
    `**Date generated:** ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## Instructions',
    '',
    'For each item below, verify:',
    '1. The **prompt** is unambiguous — a reader could answer it without guessing.',
    '2. The **gold label** is correct and traceable to a real source.',
    '3. The gold label is NOT derivable from the claim text alone (no leakage).',
    '4. Negative-control items are clearly fictitious.',
    '',
    'Mark each item **✅ PASS** or **❌ FAIL [reason]**.',
    'Sign off at the bottom when all items are reviewed.',
    '',
    '---',
    '',
  ]

  for (let i = 0; i < sample.length; i++) {
    const item = sample[i]
    lines.push(`### Item ${i + 1} — \`${item.id}\``)
    lines.push('')
    lines.push(`**Type:** ${item.type}  `)
    lines.push(`**Construction method:** ${item.construction_method}  `)
    if (item.claim_id) lines.push(`**Claim ID:** \`${item.claim_id}\`  `)
    lines.push('')
    lines.push('**Prompt:**')
    lines.push('```')
    lines.push(item.prompt)
    lines.push('```')
    lines.push('')
    lines.push(`**Gold label:** ${formatGold(item)}`)
    if (item.receipts.length > 0) {
      lines.push('')
      lines.push(`**Receipts:** ${item.receipts.map(r => `[link](${r})`).join(', ')}`)
    }
    lines.push('')
    lines.push('**Review:** _____________')
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  lines.push('## Sign-off')
  lines.push('')
  lines.push('- [ ] I have reviewed all items above and confirm the eval set is release-ready.')
  lines.push('- [ ] No mis-calibrated type (all per-type scores 5–95% after baseline run).')
  lines.push('- [ ] Leakage screen and ambiguity exclusion outputs attached.')
  lines.push('')
  lines.push('**Reviewer:** _____________  ')
  lines.push('**Date:** _____________')

  fs.mkdirSync(require('path').dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, lines.join('\n'))
  console.log(`Checklist written to ${outPath} (${sample.length} items)`)
}

main().catch(e => { console.error(e); process.exit(1) })
