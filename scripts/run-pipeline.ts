#!/usr/bin/env node
// CLI entry point for the ingest harness.
// Usage: npx tsx scripts/run-pipeline.ts --tag <tag> [--full] [--dry-run]
//
// Requires ALLOW_EDITS=true for --full runs.
// Example:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/run-pipeline.ts --tag congress_v1 --dry-run
//   npx dotenv-cli -e .env.local -- npx tsx scripts/run-pipeline.ts --tag paclii_legislation_v1 --full

import 'dotenv/config'
import { runPipeline } from '@/lib/ingest'
import { prisma } from '@/lib/prisma'

const PIPELINE_REGISTRY: Record<string, string> = {
  congress_v1: '../pipelines/congress_v1',
  paclii_legislation_v1: '../pipelines/paclii_legislation_v1',
  doj_fara_v1: '../pipelines/doj_fara_v1',
}

function parseArgs() {
  const args = process.argv.slice(2)
  const tagIdx = args.indexOf('--tag')
  const tag = tagIdx !== -1 ? args[tagIdx + 1] : undefined
  const full = args.includes('--full')
  const dryRun = args.includes('--dry-run')

  if (!tag) {
    console.error('Usage: --tag <tag> [--full | --dry-run]')
    console.error('Known tags:', Object.keys(PIPELINE_REGISTRY).join(', '))
    process.exit(1)
  }
  if (!full && !dryRun) {
    console.error('ERROR: Must specify --full or --dry-run')
    process.exit(1)
  }
  if (full && dryRun) {
    console.error('ERROR: --full and --dry-run are mutually exclusive')
    process.exit(1)
  }
  if (full && process.env.ALLOW_EDITS !== 'true') {
    console.error('ERROR: --full requires ALLOW_EDITS=true')
    process.exit(1)
  }
  return { tag, full, dryRun }
}

async function main() {
  const { tag, full, dryRun } = parseArgs()

  const modulePath = PIPELINE_REGISTRY[tag]
  if (!modulePath) {
    console.error(`Unknown tag: ${tag}`)
    console.error('Known tags:', Object.keys(PIPELINE_REGISTRY).join(', '))
    process.exit(1)
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(modulePath) as {
    pipeline: Parameters<typeof runPipeline>[0]
    setup?: () => Promise<void>
  }

  if (mod.setup && full) {
    console.log(`[${tag}] Running pipeline setup...`)
    await mod.setup()
  }

  console.log(`[${tag}] Starting pipeline (${dryRun ? 'dry-run' : 'full'})...`)
  const result = await runPipeline(mod.pipeline, { full, dryRun })
  console.log(JSON.stringify(result, null, 2))

  if (result.status === 'error') process.exit(1)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
