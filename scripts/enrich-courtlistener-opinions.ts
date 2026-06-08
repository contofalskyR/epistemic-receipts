/**
 * enrich-courtlistener-opinions.ts
 *
 * Fetches full opinion body text from CourtListener for each existing
 * courtlistener_* claim and stores it in metadata.opinion_body.
 * Also captures statutes_cited from the cluster endpoint.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-courtlistener-opinions.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-courtlistener-opinions.ts
 *   ALLOW_EDITS=true ... --limit 100        # process at most 100 claims this run
 *   ALLOW_EDITS=true ... --pipeline scotus  # only courtlistener_scotus_v1
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4'

const ALLOW_EDITS = process.env.ALLOW_EDITS === 'true'
const DRY_RUN = !ALLOW_EDITS || process.argv.includes('--dry-run')

// CourtListener recommends ≤5 req/s for authenticated users
const REQUEST_DELAY_MS = 300

function parseLimit(): number {
  const idx = process.argv.indexOf('--limit')
  if (idx !== -1 && process.argv[idx + 1]) {
    const n = parseInt(process.argv[idx + 1], 10)
    if (!isNaN(n) && n > 0) return n
  }
  return 500
}

function parsePipeline(): string | null {
  const idx = process.argv.indexOf('--pipeline')
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1]
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// Max chars of opinion body to store — full text can be megabytes
const MAX_BODY_CHARS = 50_000

// Strip HTML tags for plain-text storage
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

interface CLOpinion {
  id: number
  plain_text?: string | null
  html_with_citations?: string | null
  html?: string | null
  html_lawbox?: string | null
  type?: string
}

interface CLOpinionPage {
  count: number
  next: string | null
  results: CLOpinion[]
}

interface CLCluster {
  id: number
  statutes_cited?: string[] | null
  case_name?: string | null
}

async function clFetch(path: string, token: string): Promise<unknown> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
  const MAX_RETRIES = 5

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 30_000)
    let res: Response
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Token ${token}`,
          Accept: 'application/json',
        },
        signal: ctrl.signal,
      })
      clearTimeout(timer)
    } catch (err) {
      clearTimeout(timer)
      if (attempt > MAX_RETRIES) throw err
      const reason = (err as Error)?.name === 'AbortError' ? 'fetch timeout' : 'network error'
      console.log(`  Retry after ${reason} (attempt ${attempt}/${MAX_RETRIES})…`)
      await sleep(2 ** attempt * 1000)
      continue
    }

    if (res.status === 401) throw new Error('CL returned 401 — check COURTLISTENER_API_KEY / COURTLISTENER_TOKEN in .env')

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10)
      const wait = isNaN(retryAfter) ? 60_000 : retryAfter * 1000
      const secs = Math.ceil(wait / 1000)
      console.log(`  Rate limited (429) — waiting ${secs}s (${(secs / 3600).toFixed(1)}h)…`)
      await sleep(wait)
      continue
    }

    if ([502, 503, 504].includes(res.status)) {
      if (attempt > MAX_RETRIES) throw new Error(`CL ${res.status} — ${url}`)
      console.log(`  Retry after ${res.status} (attempt ${attempt}/${MAX_RETRIES})…`)
      await sleep(2 ** attempt * 1000)
      continue
    }

    if (!res.ok) throw new Error(`CL ${res.status} — ${url}`)
    return res.json()
  }

  throw new Error('clFetch: exhausted retries')
}

function extractOpinionText(opinion: CLOpinion): string | null {
  // Prefer pre-stripped plain text
  if (opinion.plain_text?.trim()) return opinion.plain_text.trim()
  // Fall back to stripping HTML variants
  for (const field of ['html_with_citations', 'html', 'html_lawbox'] as const) {
    const raw = opinion[field]
    if (raw?.trim()) return stripHtml(raw)
  }
  return null
}

async function main() {
  const token = process.env.COURTLISTENER_API_KEY ?? process.env.COURTLISTENER_TOKEN
  if (!token) {
    console.error(
      '\nError: set COURTLISTENER_API_KEY (or COURTLISTENER_TOKEN) in .env.local\n' +
      'Free account at: https://www.courtlistener.com/sign-in/\n'
    )
    process.exit(1)
  }

  const limit = parseLimit()
  const pipelineFilter = parsePipeline()

  const pipelineLike = pipelineFilter
    ? `courtlistener_${pipelineFilter.replace(/^courtlistener_/, '')}`
    : undefined

  console.log(`\nenrich-courtlistener-opinions — ${DRY_RUN ? 'DRY RUN' : 'LIVE'} · limit=${limit}${pipelineLike ? ` · pipeline=${pipelineLike}` : ''}\n`)

  // Load claims that haven't been enriched yet
  const claims = await prisma.claim.findMany({
    where: {
      ingestedBy: pipelineLike
        ? { startsWith: pipelineLike }
        : { startsWith: 'courtlistener_' },
      deleted: false,
      NOT: [
        { ingestedBy: 'courtlistener_disclosures_v1' }, // disclosures have no opinion bodies
      ],
    },
    select: { id: true, externalId: true, text: true, ingestedBy: true, metadata: true },
    orderBy: { createdAt: 'asc' },
  })

  // Filter out claims that already have opinion_body in metadata
  const pending = claims.filter(c => {
    if (!c.metadata) return true
    const m = c.metadata as Record<string, unknown>
    return !m.opinion_body
  })

  const toProcess = pending.slice(0, limit)
  console.log(`Total CL claims: ${claims.length} · already enriched: ${claims.length - pending.length} · to process: ${toProcess.length}\n`)

  let enriched = 0
  let noText = 0
  let errors = 0

  for (let i = 0; i < toProcess.length; i++) {
    const claim = toProcess[i]
    // externalId pattern: cl-cluster-{id}
    const match = claim.externalId?.match(/^cl-cluster-(\d+)$/)
    if (!match) {
      console.log(`  Skip (no cluster id): ${claim.id} externalId=${claim.externalId}`)
      noText++
      continue
    }
    const clusterId = match[1]

    if ((i + 1) % 50 === 0) {
      console.log(`  Progress: ${i + 1}/${toProcess.length} · enriched=${enriched} noText=${noText} errors=${errors}`)
    }

    await sleep(REQUEST_DELAY_MS)

    let opinionText: string | null = null
    let statutesCited: string[] = []

    try {
      // 1. Fetch opinions for this cluster
      const opinionPage = (await clFetch(
        `/opinions/?cluster=${clusterId}&page_size=5`,
        token
      )) as CLOpinionPage

      for (const op of opinionPage.results ?? []) {
        const text = extractOpinionText(op)
        if (text && text.length > 500) {
          opinionText = text.slice(0, MAX_BODY_CHARS)
          break
        }
      }

      await sleep(REQUEST_DELAY_MS)

      // 2. Fetch cluster to get statutes_cited
      const cluster = (await clFetch(`/clusters/${clusterId}/`, token)) as CLCluster
      statutesCited = (cluster.statutes_cited ?? []).filter(Boolean)

    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      // On rate limit error the fetch already waited — just log and stop
      if (msg.includes('429') || msg.includes('throttled')) {
        console.error(`\n  Hit rate limit at claim ${i + 1}/${toProcess.length} — stopping. Re-run when limit resets.`)
        break
      }
      console.error(`  Error on cluster ${clusterId}: ${msg}`)
      errors++
      continue
    }

    if (!opinionText && statutesCited.length === 0) {
      if (DRY_RUN) {
        console.log(`  [DRY] No text: cluster ${clusterId} — ${claim.text.slice(0, 60)}`)
      }
      noText++
      continue
    }

    const existingMeta = (claim.metadata as Record<string, unknown>) ?? {}
    const newMeta = {
      ...existingMeta,
      ...(opinionText ? { opinion_body: opinionText } : {}),
      ...(statutesCited.length > 0 ? { statutes_cited: statutesCited } : {}),
    }

    if (DRY_RUN) {
      console.log(
        `  [DRY] Would update cluster ${clusterId}: ` +
        `opinion_body=${opinionText ? opinionText.length + ' chars' : 'none'}, ` +
        `statutes_cited=${statutesCited.length}`
      )
      enriched++
      continue
    }

    try {
      await prisma.claim.update({
        where: { id: claim.id },
        data: { metadata: newMeta },
      })
      enriched++
    } catch (err) {
      console.error(`  DB update failed for ${claim.id}: ${(err as Error).message}`)
      errors++
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Enriched : ${enriched}`)
  console.log(`  No text  : ${noText}`)
  console.log(`  Errors   : ${errors}`)
  console.log(`  Mode     : ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`)

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
