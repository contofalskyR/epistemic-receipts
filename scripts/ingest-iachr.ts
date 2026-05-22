// Pipeline 95 — Inter-American Court of Human Rights Judgments (iachr_judgments_v1)
//
// BLOCKER — DO NOT RUN IN FULL MODE UNTIL RESOLVED
//
// Source: Inter-American Court of Human Rights (corteidh.or.cr)
// Intended dataset: Contentious case judgments (~600+ cases since 1979)
//
// Access attempts (2026-05-20):
//   https://www.corteidh.or.cr/casos_en.cfm          → HTTP 404
//   https://www.corteidh.or.cr/jurisprudencia.cfm     → HTTP 404
//   https://www.corteidh.or.cr/datos_en.cfm           → HTTP 404
//   https://www.corteidh.or.cr/lista_casos_supervisados.cfm → HTTP 404
//   https://www.corteidh.or.cr/jurisprudencia2/index.cfm   → HTTP 404
//   https://www.corteidh.or.cr/index.cfm              → HTTP 200 (homepage OK)
//
// The legacy ColdFusion (.cfm) case database URLs are entirely inaccessible.
// The court relaunched its case portal as a JavaScript SPA at:
//   https://jurisprudence.corteidh.or.cr/
// This portal requires client-side JS execution for all case listings and cannot
// be scraped with curl/fetch. No REST or JSON API is exposed.
//
// Possible unblocking paths:
//   1. Contact IACHR directly for a data export (databank@corteidh.or.cr)
//   2. Use the IACHR annual reports (PDF) as a source for a curated list
//   3. Use the Wayback Machine CDX API to enumerate archived .cfm URLs
//      and extract case data from snapshots
//   4. Use the OXIO API (https://api.oxio.law) if it gains IACHR coverage
//
// Run: npx tsx scripts/ingest-iachr.ts --dry-run
//      (returns 0 candidates — blocked)

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'iachr_judgments_v1'
const PIPELINE = 'Pipeline 95'

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--limit N] [--verbose]')
        process.exit(1) as never
      })()
  const li = args.indexOf('--limit')
  const sai = args.indexOf('--sample')
  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

async function main() {
  const { mode } = parseArgs()

  console.log(`\n── ${PIPELINE}: IACHR Judgments (BLOCKED) ──────────────────────────────`)
  console.log(`Mode: ${mode}`)
  console.log()
  console.log('BLOCKER: All corteidh.or.cr ColdFusion case listing URLs return HTTP 404.')
  console.log('The new JS portal at jurisprudence.corteidh.or.cr requires client-side rendering.')
  console.log('No REST/JSON API is exposed. See script header for unblocking paths.')
  console.log()
  console.log('Returning 0 candidates — no DB writes performed.')

  if (mode === 'dry-run') {
    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      status: 'BLOCKED',
      blocker: 'corteidh.or.cr ColdFusion case database returns 404; new JS portal not scrapeable',
      totalCandidates: 0,
      sample: [],
    }
    fs.writeFileSync('pipeline-95-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('Written: pipeline-95-dry-run-sample.json')
  }

  if (mode === 'full') {
    console.error('\nFull run blocked — resolve API access first.')
    process.exit(1)
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
