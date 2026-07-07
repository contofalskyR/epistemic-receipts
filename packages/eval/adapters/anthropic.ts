// Reference adapter: Anthropic API (native SDK)
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-... \
//   npx tsx packages/eval/adapters/anthropic.ts \
//     --items eval-set-free-er-eval-v1.jsonl \
//     --model claude-sonnet-5 \
//     --out model-answers-sonnet5.jsonl

import * as fs from 'fs'
import Anthropic from '@anthropic-ai/sdk'
import type { EvalItem, ModelAnswer } from '../schema.js'

const SYSTEM_PROMPT = `You are an expert at temporal reasoning about scientific and institutional knowledge.
Answer the user's question about epistemic status precisely.
For axis labels use exactly one of: RECORDED, SETTLED, CONTESTED, OPEN, UNRESOLVABLE, REVERSED, ABANDONED.
For "not in record" claims say clearly "not in record" or "no record found".
Keep answers concise. Include ISO dates (YYYY-MM-DD) when relevant.`

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.findIndex(a => a === flag)
    return i >= 0 ? args[i + 1] : args.find(a => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=')
  }
  return {
    itemsPath: get('--items') ?? 'eval-set-free-er-eval-v1.jsonl',
    model: get('--model') ?? 'claude-sonnet-4-6',
    outPath: get('--out') ?? 'model-answers.jsonl',
    concurrency: parseInt(get('--concurrency') ?? '3', 10),
  }
}

async function main() {
  const { itemsPath, model, outPath, concurrency } = parseArgs()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY env var required')

  const client = new Anthropic({ apiKey })

  const items: EvalItem[] = fs.readFileSync(itemsPath, 'utf8')
    .split('\n').filter(Boolean).map(l => JSON.parse(l))

  const out = fs.createWriteStream(outPath, { flags: 'w' })
  let done = 0

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const results = await Promise.allSettled(
      batch.map(item =>
        client.messages.create({
          model,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: item.prompt }],
          max_tokens: 256,
        }).then(r => r.content[0]?.type === 'text' ? r.content[0].text : '')
      )
    )
    for (let j = 0; j < batch.length; j++) {
      const r = results[j]
      const answer: ModelAnswer = {
        item_id: batch[j].id,
        answer: r.status === 'fulfilled' ? r.value : `ERROR: ${(r.reason as Error).message}`,
      }
      out.write(JSON.stringify(answer) + '\n')
      done++
    }
    process.stderr.write(`\r${done}/${items.length} answered`)
  }
  out.end()
  process.stderr.write('\nDone.\n')
  console.log(`Answers written to ${outPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
