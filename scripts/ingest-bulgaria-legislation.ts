// Pipeline 106 — Bulgaria National Assembly Acts (bulgaria_legislation_v1)
//
// BLOCKER — DO NOT RUN IN FULL MODE UNTIL RESOLVED
//
// Source: parliament.bg (National Assembly) / lex.bg (State Gazette)
// Intended dataset: Laws enacted by the National Assembly (~2,500+ laws since 1991)
//
// Access attempts (2026-05-20):
//   https://parliament.bg/bg/laws/index
//     → HTTP 200 but page is a Vue.js SPA (F5 LTM load balancer). The HTML shell
//       contains no data. All legislation listings are fetched via internal XHR
//       calls that require a session token from the SPA bootstrap.
//   https://parliament.bg/api/v1/laws, /api/v1/acts, /api/v1/legislation
//     → All return the SPA HTML shell (no JSON). The `parliament.bg/api/v1`
//       string appears in app.js but all attempted API paths return 200 HTML,
//       not JSON. The actual API base path could not be determined without
//       browser DevTools network inspection.
//   https://parliament.bg/feed/laws
//     → RSS feed accessible (HTTP 200) but contains 0 <item> elements; appears
//       to be a stale/unfilled feed stub.
//   https://lex.bg/laws/ldoc/{id}
//     → Cloudflare challenge (JS challenge / HTTP 403). Cannot be bypassed with
//       standard HTTP clients.
//   https://dv.parliament.bg/ (State Gazette)
//     → Accessible but no structured API; requires full HTML parsing of
//       PDF-linked gazette issues with no stable enumeration endpoint.
//
// Possible unblocking paths:
//   1. Browser DevTools inspection: open parliament.bg/bg/laws/index in a browser,
//      capture the network tab, identify the internal API path and auth headers,
//      then replicate in the ingester.
//   2. Use parliament.bg official data portal (if/when launched) at data.parliament.bg
//   3. Contact parliament.bg IT for a bulk data export (it@parliament.bg)
//   4. Use the Wayback Machine CDX API to enumerate archived lex.bg law pages
//      that were captured before Cloudflare was enabled
//
// Run: npx tsx scripts/ingest-bulgaria-legislation.ts --dry-run
//      (returns 0 candidates — blocked)

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'bulgaria_legislation_v1'
const PIPELINE = 'Pipeline 106'

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

  console.log(`\n── ${PIPELINE}: Bulgaria National Assembly Acts (BLOCKED) ──────────────────────────────`)
  console.log(`Mode: ${mode}`)
  console.log()
  console.log('BLOCKER: parliament.bg is a Vue.js SPA with no accessible REST API.')
  console.log('RSS feed exists but is empty. lex.bg is blocked by Cloudflare.')
  console.log('See script header for unblocking paths.')
  console.log()
  console.log('Returning 0 candidates — no DB writes performed.')

  if (mode === 'dry-run') {
    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      status: 'BLOCKED',
      blocker: 'parliament.bg Vue.js SPA (no accessible API); lex.bg blocked by Cloudflare; RSS feed empty',
      totalCandidates: 0,
      sample: [],
    }
    fs.writeFileSync('pipeline-106-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('Written: pipeline-106-dry-run-sample.json')
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
