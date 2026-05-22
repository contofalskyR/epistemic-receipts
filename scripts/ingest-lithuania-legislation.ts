// Pipeline 105 — Lithuania Seimas Acts (lithuania_legislation_v1)
//
// BLOCKER — DO NOT RUN IN FULL MODE UNTIL RESOLVED
//
// Source: e-seimas.lrs.lt (Seimas legislative database) / e-tar.lt (Official Gazette)
// Intended dataset: Laws enacted by the Seimas (~3,000+ laws since 1990)
//
// Access attempts (2026-05-20):
//   https://e-seimas.lrs.lt/portal/legalAct/lt/search
//     → Responds with HTTP 200 but requires JSF PrimeFaces 5.2.3 form state.
//       All search submissions require a serialized javax.faces.ViewState token
//       obtained from an initial page load. The ViewState is large (~8KB base64)
//       and session-bound; form POST without it returns an empty result set or
//       redirects to an error page.
//   https://e-tar.lt/portal/lt/legalAct/start
//     → Cloudflare challenge page (HTTP 403 / JS challenge). Cannot be bypassed
//       with curl or standard fetch.
//   https://lrs.lt/sip/portal.show?p_r=119&p_k=1
//     → Accessible HTML but no JSON API; data requires full HTML parsing of
//       paginated session-by-session tables with no stable URL structure.
//
// Neither portal offers a public REST or JSON API. The JSF ViewState approach
// is theoretically possible but fragile (session-bound, requires full cookie
// and ViewState lifecycle management across requests).
//
// Possible unblocking paths:
//   1. JSF session scraping:
//      (a) Fetch session cookie + ViewState from the initial page load
//      (b) POST search form with ViewState, parse results
//      (c) Repeat with pagination — fragile, but doable with Playwright/Puppeteer
//   2. Use lrs.lt direct URL enumeration (laws have stable IDs like /I-1234)
//      Example: https://www.e-seimas.lrs.lt/portal/legalAct/lt/TAD/TABD0010370
//   3. Contact the Seimas IT department for a bulk data export
//      (it@lrs.lt or infocentras@lrs.lt)
//
// Run: npx tsx scripts/ingest-lithuania-legislation.ts --dry-run
//      (returns 0 candidates — blocked)

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'lithuania_legislation_v1'
const PIPELINE = 'Pipeline 105'

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

  console.log(`\n── ${PIPELINE}: Lithuania Seimas Acts (BLOCKED) ──────────────────────────────`)
  console.log(`Mode: ${mode}`)
  console.log()
  console.log('BLOCKER: e-seimas.lrs.lt requires JSF ViewState session tokens for search.')
  console.log('e-tar.lt (Official Gazette) is behind Cloudflare challenge (HTTP 403).')
  console.log('No public REST/JSON API found. See script header for unblocking paths.')
  console.log()
  console.log('Returning 0 candidates — no DB writes performed.')

  if (mode === 'dry-run') {
    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      status: 'BLOCKED',
      blocker: 'e-seimas.lrs.lt requires JSF ViewState; e-tar.lt blocked by Cloudflare; no JSON API',
      totalCandidates: 0,
      sample: [],
    }
    fs.writeFileSync('pipeline-105-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('Written: pipeline-105-dry-run-sample.json')
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
