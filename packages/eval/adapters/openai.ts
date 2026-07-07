// Reference adapter: OpenAI-compatible API
//
// Runs all items in the eval set through any OpenAI-compatible endpoint and
// writes answers to a JSONL file for scoring with packages/eval/score.ts.
//
// Usage:
//   OPENAI_API_KEY=sk-... \
//   npx tsx packages/eval/adapters/openai.ts \
//     --items eval-set-free-er-eval-v1.jsonl \
//     --model gpt-4o \
//     --out model-answers-gpt4o.jsonl
//
//   # Anthropic-compatible via OpenAI adapter:
//   OPENAI_API_KEY=... OPENAI_BASE_URL=https://api.anthropic.com/v1 \
//   npx tsx packages/eval/adapters/openai.ts --model claude-sonnet-5 ...

import * as fs from 'fs'
import type { EvalItem, ModelAnswer } from '../schema.js'

const SYSTEM_PROMPT = `You are an expert at temporal reasoning about scientific and institutional knowledge.
Answer the user's question about epistemic status precisely.
For axis labels use exactly one of: RECORDED, SETTLED, CONTESTED, OPEN, UNRESOLVABLE, REVERSED, ABANDONED.
For "not in record" claims say clearly "not in record" or "no record found".
Keep answers concise. Include ISO dates (YYYY-MM-DD) when relevant.`

async function callOpenAI(
  prompt: string,
  model: string,
  baseUrl: string,
  apiKey: string,
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 256,
      temperature: 0,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }
  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices[0]?.message?.content ?? ''
}

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.findIndex(a => a === flag)
    return i >= 0 ? args[i + 1] : args.find(a => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=')
  }
  return {
    itemsPath: get('--items') ?? 'eval-set-free-er-eval-v1.jsonl',
    model: get('--model') ?? 'gpt-4o',
    outPath: get('--out') ?? 'model-answers.jsonl',
    concurrency: parseInt(get('--concurrency') ?? '5', 10),
  }
}

async function main() {
  const { itemsPath, model, outPath, concurrency } = parseArgs()
  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  if (!apiKey) throw new Error('OPENAI_API_KEY env var required')

  const items: EvalItem[] = fs.readFileSync(itemsPath, 'utf8')
    .split('\n').filter(Boolean).map(l => JSON.parse(l))

  const out = fs.createWriteStream(outPath, { flags: 'w' })
  let done = 0

  // Batch with concurrency limit
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const results = await Promise.allSettled(
      batch.map(item => callOpenAI(item.prompt, model, baseUrl, apiKey))
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
