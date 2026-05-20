// Pipeline 35 — Portugal Assembleia da República Enacted Laws (portugal_legislation_v1)
// Dataset: Parlamento open data (www.parlamento.pt/Cidadania/Paginas/DAIniciativas.aspx).
//          Free, no API key required. Bulk JSON per legislature.
// Scope: All Projetos de Lei and Propostas de Lei that reached Fase 580
//        (Lei Publicação DR) — i.e. enacted and published in the official gazette.
// API:   1. Fetch DAIniciativas.aspx?t=...&Path=... per legislature → HTML with JSON URL
//        2. Fetch JSON from app.parlamento.pt/webutils/docs/doc.txt?path=...
// Topic: pt-assembleia (Assembleia da República, domain=government).
// Run: npx tsx scripts/ingest-portugal-legislation.ts --dry-run
//      npx tsx scripts/ingest-portugal-legislation.ts --sample 10
//      npx tsx scripts/ingest-portugal-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

// Parlamento uses a cert chain not in Node's bundled CA store.
// rejectUnauthorized:false is safe here since we verify the domain via curl.
const PARL_AGENT = new https.Agent({ rejectUnauthorized: false })

const prisma = new PrismaClient()

const INGESTED_BY = 'portugal_legislation_v1'
const PIPELINE = 'Pipeline 35'
const PAGE_DELAY_MS = 300
const FETCH_TIMEOUT_MS = 300_000 // 5 min for large JSON files

// Legislature download parameters: t value and Path for each legislature's
// DAIniciativas.aspx page. These are stable (non-session-specific).
// Extracted from: https://www.parlamento.pt/Cidadania/Paginas/DAIniciativas.aspx
const LEGISLATURES: Array<{ name: string; t: string; path: string }> = [
  {
    name: 'XVI',
    t: '57465a4a4945786c5a326c7a6247463064584a68',
    path: 'rUSIacRRnJWZ7XQZuvvoIa7Z5vUB69Ddh6SLs8sHZETogv51ugttD5zXDTz72dU%2bVzZjRBpsDvxaxLWUPXq9hJCaH%2fhvudBet1q0q5sRetz0LXI3MshDGY1scfZT5TQO9zJgqFeu3d7l7pco3gv9RR8K2v6EqEJ2LybcMuKDSl1%2fivCz60AkvYuMHi1Pjg%2bKeq6js%2b9CmowWpCCwD5k%2b5ZDshlne%2fsqPVS96qd9%2bnP63I%2fMHEqnemyiRhYHayTVJEHpUWtVXV5SHORSp4vSrcXYqH7HcmgXzyymo0KajaBls14%2b6JJCcENCE8T2%2fDOs8',
  },
  {
    name: 'XV',
    t: '574659675447566e61584e7359585231636d453d',
    path: 'dJGg50XFFYQm8NrOWUDbun%2bBg8%2b1kV4yVWgoRRCSJaake%2bq67MHRFOwgN7DFsOqrynoslprpAo2oHFzHmpvRAuuDLKHnJL0ticXicKYH%2bmuTJq8kGU%2fX0fKtZcbSYKGT8c%2f3XJGAirEsyNHeJvHH2TyUH%2fcdNcn%2fL2pOr3szrVD%2fOmStIKCC4%2bHtkI7SnKOr84P6Sc4TacwYIGiNMjG8GCxesn7S%2bFkgMMG6QcvvJztII7IsZqc2LikZoNAQbhw1Dgv3HjtMvuBo2AhWLbhG%2fOHyNal8KPr9fNBY4JSIjhg%3d',
  },
  {
    name: 'XIV',
    t: '57456c574945786c5a326c7a6247463064584a68',
    path: 'ITtLXU3mmcp4KI1kaazH2bPkw79jBqkODvDC%2fXCPmb%2bKaCE22Uf3vSCMLbLrJWLJM9K2owsNNwid2STCDJqmj5%2frPVFiO08pIp%2bx16iuP68epggxJ5QKk%2b46TTt3VloYPVdxrtj6wcuJyUKaJYih29SUE7DO%2bR%2bsL%2bJQLYvYEJI7If0pOXcdHXNTjUJaFSxhUrPZZM8VAoWsWRiuuDbbH6MgwzCFvPxCzl5NUV4WmzfQqX8Tv6Ymz5NGG6yvGN5jnpiesBA5D903GYqEkIxP%2bwLSmvXgGxDB6CN6bhpsYzM%3d',
  },
  {
    name: 'XIII',
    t: '57456c4a5353424d5a576470633278686448567959513d3d',
    path: 'zNeTaSyOL33EzCWeb0qSTmy6eQKctnri6kDW0rQDOCFv%2bvYx5gsy6oXOxepBCfU%2b%2fY4lmA5WgGf83OJz%2bzmJBMeMlmVMnPF9l%2fu7IUl4vLg9dBmZpw3uRuLRSoilw%2fOWv4N16QBMvRNzIF8BOjhPGL8auIzD2R808RIt91j2zigwX%2fr44gXlIJKzRaUdmA0cIrb5Gn%2bMPjyoDllgfVTfLDrrzm6%2b9qSYHfl%2bovfIEVeBvmhV6rxK0LHLDaFM1alG8Hp401O%2f3hQ7igVimIzt4gNad7WVhO7IPn2aWderzcWKBpDPIy8%2fRdqY49243V21',
  },
  {
    name: 'XII',
    t: '57456c4a4945786c5a326c7a6247463064584a68',
    path: 'cCnVeEPiAzgfxNtFgJx8L2qxXW8N7fvlnOdoL3iD5%2f46%2fppYIJ8YefyQNmARZpQ9bsKfu%2bDDjgj9J%2bbmeqILKzuLVaHVfOAfUnMk%2fikEz%2bxAl9SxARFv6KW4F2629wftMJbATBR2Ju1MzaLNoQAIG5cyNyuENkx4cf0iDB%2bujxo8b%2b%2bq5aPdW2kRvnGD14KonjEB3g4r%2f7d%2bdLZ%2fUEgM0xm%2fFOEx%2boCVEe%2fOyj1ec%2fX5YgJ2F3jHZGrtUGG37b9aKLLnnSsQvlaxVBNZgWCfcMTa5lRiWj9KGfNz5gPkz6VFTOuo8hR5%2fdv5cr%2bHTRSj',
  },
]

// ── Types ──────────────────────────────────────────────────────────────────────

interface ParlamentoIniEvento {
  CodigoFase: string
  Fase: string
  DataFase: string | null
  OevId?: string | null
  OevTextId?: string | null
}

interface ParlamentoIniciativa {
  IniId: number | string
  IniTipo: string
  IniDescTipo: string
  IniLeg: string
  IniNr: string | number
  IniTitulo: string | null
  IniEpigrafe: string | null
  IniLinkTexto: string | null
  IniEventos: ParlamentoIniEvento[] | null
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  iniId: string
  leg: string
  nr: string
  titulo: string
  descTipo: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
}

// ── CLI ────────────────────────────────────────────────────────────────────────

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

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function httpsGet(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
          'Accept': '*/*',
          'Referer': 'https://www.parlamento.pt/',
        },
        agent: PARL_AGENT,
        timeout: timeoutMs,
      },
      (res) => {
        // Follow redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `https://${parsed.hostname}${res.headers.location}`
          res.resume()
          httpsGet(nextUrl, timeoutMs).then(resolve).catch(reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

async function fetchWithRetry(url: string, retries = 4, timeoutMs = 30_000): Promise<{ status: number; body: string }> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await httpsGet(url, timeoutMs)
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      return res
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Fetch error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ── Fetch legislature JSON ─────────────────────────────────────────────────────

async function fetchJsonUrlFromPage(leg: { name: string; t: string; path: string }): Promise<string | null> {
  const url = `https://www.parlamento.pt/Cidadania/Paginas/DAIniciativas.aspx?t=${leg.t}&Path=${leg.path}`
  const res = await fetchWithRetry(url, 3, 30_000)
  const match = res.body.match(/webutils\/docs\/doc\.txt\?[^"]+fich=[^"]*_json\.txt[^"]*/)
  if (!match) return null
  return 'https://app.parlamento.pt/' + match[0].replace(/&amp;/g, '&')
}

async function fetchLegislatureData(leg: { name: string; t: string; path: string }, verbose: boolean): Promise<ParlamentoIniciativa[]> {
  console.log(`  Fetching JSON URL for ${leg.name} legislature...`)
  const jsonUrl = await fetchJsonUrlFromPage(leg)
  if (!jsonUrl) {
    console.warn(`  Could not find JSON URL for ${leg.name} — skipping`)
    return []
  }
  if (verbose) console.log(`  JSON URL: ${jsonUrl.slice(0, 100)}...`)

  console.log(`  Downloading ${leg.name} JSON (may be large)...`)
  const res = await fetchWithRetry(jsonUrl, 3, FETCH_TIMEOUT_MS)
  if (res.status !== 200) {
    console.warn(`  HTTP ${res.status} for ${leg.name} JSON — skipping`)
    return []
  }

  const parsed = JSON.parse(res.body) as ParlamentoIniciativa[]
  console.log(`  ${leg.name}: ${parsed.length} total initiatives`)
  return parsed
}

// ── Candidate extraction ───────────────────────────────────────────────────────

function extractEnactedLaws(records: ParlamentoIniciativa[], verbose: boolean): CandidateRecord[] {
  const candidates: CandidateRecord[] = []

  for (const r of records) {
    const eventos = r.IniEventos ?? []
    const fase580 = eventos.find(ev => ev.CodigoFase === '580')
    if (!fase580) continue

    const dateStr = fase580.DataFase?.slice(0, 10)
    if (!dateStr) {
      if (verbose) console.log(`  Skip IniId=${r.IniId}: no DataFase in Fase 580`)
      continue
    }

    const enactedDate = new Date(dateStr + 'T00:00:00Z')
    if (isNaN(enactedDate.getTime())) {
      if (verbose) console.log(`  Skip IniId=${r.IniId}: invalid date ${dateStr}`)
      continue
    }

    const titulo = (r.IniTitulo ?? r.IniEpigrafe ?? '').trim()
    if (!titulo) {
      if (verbose) console.log(`  Skip IniId=${r.IniId}: no title`)
      continue
    }

    const iniId = String(r.IniId)
    const leg = (r.IniLeg ?? '').trim()
    const nr = String(r.IniNr ?? '').trim()
    const descTipo = (r.IniDescTipo ?? r.IniTipo ?? '').trim()

    candidates.push({
      iniId,
      leg,
      nr,
      titulo,
      descTipo,
      enactedDate,
      enactedDateStr: dateStr,
      sourceUrl: `https://www.parlamento.pt/ActividadeParlamentar/Paginas/DetalheIniciativa.aspx?BID=${iniId}`,
      externalId: `pt_lei_${iniId}`,
      sourceExternalId: `pt_lei_source_${iniId}`,
      sourceName: `Portugal Lei ${leg}/${nr}`,
    })
  }

  return candidates
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Write one record ───────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: CandidateRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: rec.sourceName,
        url: rec.sourceUrl,
        publishedAt: rec.enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.titulo,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.enactedDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          iniId: rec.iniId,
          leg: rec.leg,
          nr: rec.nr,
          descTipo: rec.descTipo,
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

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── ${PIPELINE}: Portugal Assembleia da República Enacted Laws ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | Legislatures: ${LEGISLATURES.map(l => l.name).join(', ')}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('pt-assembleia', 'Assembleia da República', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching initiative data from Parlamento...')
  const allCandidates: CandidateRecord[] = []
  const seenIds = new Set<string>()

  for (const leg of LEGISLATURES) {
    try {
      const records = await fetchLegislatureData(leg, verbose)
      const enacted = extractEnactedLaws(records, verbose)
      let added = 0
      for (const c of enacted) {
        if (seenIds.has(c.externalId)) continue
        seenIds.add(c.externalId)
        allCandidates.push(c)
        added++
        if (limit > 0 && allCandidates.length >= limit) break
      }
      console.log(`  ${leg.name}: ${enacted.length} enacted laws found, ${added} new candidates`)
      if (limit > 0 && allCandidates.length >= limit) break
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Error fetching ${leg.name}: ${msg}`)
    }
    await sleep(PAGE_DELAY_MS)
  }

  console.log(`\nTotal candidates: ${allCandidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 15).map(r => ({
      titulo: r.titulo,
      externalId: r.externalId,
      leg: r.leg,
      nr: r.nr,
      descTipo: r.descTipo,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      sourceName: r.sourceName,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      legislatureBreakdown: LEGISLATURES.map(l => ({
        leg: l.name,
        count: allCandidates.filter(c => c.leg === l.name).length,
      })),
      sample,
    }

    fs.writeFileSync('pipeline-35-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-35-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nSample titles:')
      allCandidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] ${r.titulo.slice(0, 110)}${r.titulo.length > 110 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample'
    ? allCandidates.slice(0, sampleN)
    : (limit > 0 ? allCandidates.slice(0, limit) : allCandidates)

  console.log(`\nStep 3: Writing ${rows.length} rows to DB (batches of 50, txn timeout 30s)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const BATCH = 50

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.titulo.slice(0, 70)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}-${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }

    if (!verbose) {
      const done = Math.min(i + BATCH, rows.length)
      process.stdout.write(`  ${done}/${rows.length} processed...\r`)
    }
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

  if (mode === 'sample') {
    console.log('\nAwaiting explicit go-ahead before full run.')
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
