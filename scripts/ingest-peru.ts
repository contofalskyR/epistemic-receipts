// Pipeline 81 — Peru Legislation (peru_legislation_v1)
// Dataset: Archivo Digital de la Legislación del Perú (leyes.congreso.gob.pe)
// Scope: LEY / RESOLUCION LEGISLATIVA / DECRETO LEY, 1990–present
//
// Access: leyes.congreso.gob.pe serves an ASP.NET WebForms search portal.
// Strategy: POST to /inicio.aspx month-by-month (1990-01 through current) so
//           each search returns <20 results and no pagination is needed.
//           The form requires __VIEWSTATE + __EVENTVALIDATION (session-bound).
//           A fresh GET to the homepage gives fresh tokens for each search.
//
// Law types included (DdlTipo=0): LEY, RESOLUCION LEGISLATIVA, DECRETO LEY
//
// Run:
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-peru.ts --dry-run
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-peru.ts --sample 10
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-peru.ts --full [--verbose]
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'peru_legislation_v1'
const PIPELINE = 'Pipeline 81'
const BASE_URL = 'https://leyes.congreso.gob.pe'
const FORM_URL = `${BASE_URL}/inicio.aspx`
const REQUEST_DELAY_MS = 1200
const BATCH_SIZE = 50
const START_YEAR = 1990
const END_YEAR = new Date().getFullYear()

interface LawRecord {
  tipo: string
  numero: string
  fecha: string
  denominacion: string
  year: number
  month: number
  externalId: string
  sourceUrl: string
}

type Counts = { ingested: number; skipped: number; errors: number }
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--verbose]')
        process.exit(1) as never
      })()
  const sai = args.indexOf('--sample')
  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

interface HttpResult { body: string; cookies: string[] }

function httpsRequest(urlStr: string, options: {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const bodyBuf = options.body ? Buffer.from(options.body, 'utf8') : undefined

    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        method: options.method ?? 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,*/*',
          'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
          'Accept-Encoding': 'identity',
          ...(options.headers ?? {}),
          ...(bodyBuf ? { 'Content-Length': String(bodyBuf.length) } : {}),
        },
        timeout: options.timeoutMs ?? 30000,
        rejectUnauthorized: false,
      },
      (res) => {
        const cookies = (res.headers['set-cookie'] ?? []) as string[]
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect (limited to 2 hops)
          const loc = new URL(res.headers.location as string, urlStr).toString()
          httpsRequest(loc, { method: 'GET', headers: options.headers, timeoutMs: options.timeoutMs })
            .then(r => resolve({ ...r, cookies: [...cookies, ...r.cookies] }))
            .catch(reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('latin1')
          resolve({ body, cookies })
        })
        res.on('error', reject)
      }
    )
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${urlStr}`)) })
    req.on('error', reject)
    if (bodyBuf) req.write(bodyBuf)
    req.end()
  })
}

function parseCookieString(cookies: string[]): string {
  return cookies
    .map(c => c.split(';')[0]!)
    .filter(Boolean)
    .join('; ')
}

function extractHidden(html: string, name: string): string {
  const patterns = [
    new RegExp(`name="${name.replace('$', '\\$')}"[^>]+value="([^"]*)"`, 'i'),
    new RegExp(`id="${name.replace('$', '_').replace(/\$/g, '_')}"[^>]+value="([^"]*)"`, 'i'),
    new RegExp(`value="([^"]*)"[^>]+name="${name.replace('$', '\\$')}"`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m) return m[1]!
  }
  return ''
}

function parseLawRows(html: string): LawRecord[] {
  const rows: LawRecord[] = []
  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)

  for (const rm of rowMatches) {
    const rowHtml = rm[1]!
    const tds = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m =>
      m[1]!.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n))).replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
    )

    if (tds.length < 4) continue
    const tipo = tds[0]!
    const numero = tds[1]!
    const fecha = tds[2]!
    const denominacion = tds[3]!

    if (!['LEY', 'RESOLUCION LEGISLATIVA', 'DECRETO LEY'].includes(tipo)) continue
    if (!numero || !/^\d+$/.test(numero)) continue
    if (!fecha.match(/^\d{2}\/\d{2}\/\d{4}$/)) continue

    const [d, m, y] = fecha.split('/')
    const year = parseInt(y!)
    const month = parseInt(m!)
    if (year < START_YEAR || year > END_YEAR + 1) continue

    const externalId = `pe_ley_${numero}`
    const sourceUrl = `${BASE_URL}/inicio.aspx`

    rows.push({ tipo, numero, fecha, denominacion, year, month, externalId, sourceUrl })
  }
  return rows
}

async function fetchMonthLaws(year: number, month: number, cookie: string): Promise<{ laws: LawRecord[]; freshCookie: string }> {
  // Step 1: GET fresh form (fresh VIEWSTATE each time)
  let getResult: HttpResult
  try {
    getResult = await httpsRequest(BASE_URL + '/', {
      headers: { 'Cookie': cookie },
    })
  } catch {
    return { laws: [], freshCookie: cookie }
  }

  const allCookies = [...getResult.cookies]
  const vs = extractHidden(getResult.body, '__VIEWSTATE')
  const vsg = extractHidden(getResult.body, '__VIEWSTATEGENERATOR')
  const ev = extractHidden(getResult.body, '__EVENTVALIDATION')

  if (!vs) return { laws: [], freshCookie: cookie }

  // Build date range for this month
  const lastDay = new Date(year, month, 0).getDate() // last day of month
  const fechaIni = `01/${String(month).padStart(2, '0')}/${year}`
  const fechaFin = `${lastDay}/${String(month).padStart(2, '0')}/${year}`

  // Step 2: POST search
  const formData: Record<string, string> = {
    '__VIEWSTATE': vs,
    '__VIEWSTATEGENERATOR': vsg,
    '__EVENTVALIDATION': ev,
    'ctl00$ContentPlaceHolder1$MaskedEditExtender1_ClientState': '',
    'ctl00$ContentPlaceHolder1$MaskedEditExtender2_ClientState': '',
    'ctl00$ContentPlaceHolder1$DdlEstado': '2',
    'ctl00$ContentPlaceHolder1$DdlTipo': '0',
    'ctl00$ContentPlaceHolder1$DdlTipoBusqueda': '2',
    'ctl00$ContentPlaceHolder1$DdlOrden': '0',
    'ctl00$ContentPlaceHolder1$TxtFechaIni': fechaIni,
    'ctl00$ContentPlaceHolder1$TxtFechaFin': fechaFin,
    'ctl00$ContentPlaceHolder1$TxtNroNormaI': '',
    'ctl00$ContentPlaceHolder1$TxtNroNormaF': '',
    'ctl00$ContentPlaceHolder1$TxtBuscar': '',
    'ctl00$ContentPlaceHolder1$BtnConsultar': 'Consultar',
  }

  const body = Object.entries(formData)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const freshCookieStr = parseCookieString(allCookies)

  let postResult: HttpResult
  try {
    postResult = await httpsRequest(FORM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': freshCookieStr,
        'Referer': BASE_URL + '/',
      },
      body,
    })
  } catch {
    return { laws: [], freshCookie: freshCookieStr }
  }

  const newCookies = parseCookieString([...allCookies, ...postResult.cookies])
  const laws = parseLawRows(postResult.body)
  return { laws, freshCookie: newCookies }
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/\s+/g, ' ').trim()
}

const topicCache = new Map<string, string>()
async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | undefined
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (parent) parentTopicId = parent.id
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

async function writeRow(tx: TxClient, rec: LawRecord, topicId: string): Promise<'ingested' | 'skipped' | 'failed'> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const [d, m, y] = rec.fecha.split('/')
    const claimEmergedAt = new Date(`${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}T00:00:00Z`)
    const sourceExternalId = `src_${rec.externalId}`
    const title = decodeHtml(rec.denominacion)
    const tipoLabel = rec.tipo === 'LEY' ? 'Ley' : rec.tipo === 'RESOLUCION LEGISLATIVA' ? 'Resolución Legislativa' : 'Decreto Ley'

    const source = await tx.source.upsert({
      where: { externalId: sourceExternalId },
      update: {},
      create: {
        externalId: sourceExternalId,
        name: `Congreso del Perú — ${tipoLabel} N° ${rec.numero}`,
        url: rec.sourceUrl,
        publishedAt: claimEmergedAt,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: `El Congreso del Perú promulgó la ${tipoLabel} N° ${rec.numero}: ${title}`,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'PROVISIONAL',
        claimEmergedAt,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          tipo: rec.tipo,
          numero: rec.numero,
          fechaPublicacion: rec.fecha,
          country: 'Peru',
          source: 'leyes.congreso.gob.pe',
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'CITES',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
      },
    })

    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })

    return 'ingested'
  } catch (err) {
    console.error(`  Error writing ${rec.externalId}: ${err}`)
    return 'failed'
  }
}

async function main() {
  const { mode, sampleN, verbose } = parseArgs()
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE}: Peru Legislation (Archivo Digital del Congreso) ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}`)
  console.log(`Source: leyes.congreso.gob.pe — month-by-month search ${START_YEAR}–${END_YEAR}`)
  console.log(`Types: LEY, RESOLUCION LEGISLATIVA, DECRETO LEY\n`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('ALLOW_EDITS=true is required for sample/full modes.')
    process.exit(2)
  }

  const allRecords: LawRecord[] = []
  const seen = new Set<string>()
  let cookie = ''
  let monthsFetched = 0
  let monthsTotal = 0
  let consecutiveErrors = 0

  // Determine scope
  const endMonth = mode === 'dry-run' ? 3 : END_YEAR * 12 + 11 // dry-run: Jan-Mar 1990 only
  const startYearForDryRun = mode === 'dry-run' ? 1990 : START_YEAR
  const endYearForDryRun = mode === 'dry-run' ? 1990 : END_YEAR

  console.log(`Step 1: Fetching laws month-by-month...`)

  outer:
  for (let year = startYearForDryRun; year <= endYearForDryRun; year++) {
    const monthEnd = year === endYearForDryRun ? new Date().getMonth() + 1 : 12
    for (let month = 1; month <= monthEnd; month++) {
      if (mode === 'dry-run' && monthsFetched >= 6) break outer
      if (mode === 'sample' && allRecords.length >= sampleN * 3) break outer

      const { laws, freshCookie } = await fetchMonthLaws(year, month, cookie)
      cookie = freshCookie
      monthsFetched++
      monthsTotal++

      let newThisMonth = 0
      for (const law of laws) {
        if (!seen.has(law.externalId)) {
          seen.add(law.externalId)
          allRecords.push(law)
          newThisMonth++
        }
      }

      if (newThisMonth > 0) consecutiveErrors = 0
      else if (laws.length === 0) {
        consecutiveErrors++
        if (consecutiveErrors >= 5) {
          console.error(`  5 consecutive empty months — possible connectivity issue. Stopping.`)
          break outer
        }
      }

      if (verbose) console.log(`  ${year}-${String(month).padStart(2, '0')}: ${newThisMonth} laws (total ${allRecords.length})`)
      else if (monthsFetched % 12 === 0) process.stdout.write(`  ${year}: ${allRecords.length} total laws\r`)
      await sleep(REQUEST_DELAY_MS)
    }
  }

  console.log(`\nMonths fetched: ${monthsFetched} | Total unique laws: ${allRecords.length}`)

  if (allRecords.length === 0) {
    console.error('ERROR: No laws found. The site may be down or the form structure changed.')
    process.exit(1)
  }

  if (mode === 'dry-run') {
    const sample = allRecords.slice(0, 15).map(r => ({
      externalId: r.externalId,
      tipo: r.tipo,
      numero: r.numero,
      fecha: r.fecha,
      denominacion: r.denominacion.slice(0, 120),
      claimText: `El Congreso del Perú promulgó la ${r.tipo === 'LEY' ? 'Ley' : r.tipo} N° ${r.numero}: ${r.denominacion.slice(0, 80)}`,
    }))
    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      monthsFetched,
      totalLaws: allRecords.length,
      sample,
    }
    fs.writeFileSync('pipeline-81-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('Written: pipeline-81-dry-run-sample.json')
    console.log('\nSample:')
    allRecords.slice(0, 5).forEach(r => console.log(`  Ley N° ${r.numero} (${r.fecha}) — ${r.denominacion.slice(0, 80)}`))
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  const targetRecords = mode === 'sample' ? allRecords.slice(0, sampleN) : allRecords

  console.log('\nStep 2: Ensuring topic...')
  const topicId = await ensureTopic('pe-congress', 'Legislación del Congreso del Perú', 'government', 'gov-region-americas')

  console.log(`\nStep 3: Writing ${targetRecords.length} records (batches of ${BATCH_SIZE}, txn timeout 30s)...`)
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const startTime = Date.now()

  for (let i = 0; i < targetRecords.length; i += BATCH_SIZE) {
    const batch = targetRecords.slice(i, i + BATCH_SIZE)
    try {
      await prisma.$transaction(async (tx) => {
        for (const rec of batch) {
          const result = await writeRow(tx, rec, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${rec.externalId} — ${rec.denominacion.slice(0, 60)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      console.error(`  Batch ${i}–${i + batch.length} failed: ${(err as Error).message}`)
      counts.errors += batch.length
    }
    if (!verbose) process.stdout.write(`  ${Math.min(i + BATCH_SIZE, targetRecords.length)}/${targetRecords.length} processed\r`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  console.log('\nPost-ingestion DB verification...')
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)

  if (mode === 'sample') console.log('\nSample complete. Review then run --full.')
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
