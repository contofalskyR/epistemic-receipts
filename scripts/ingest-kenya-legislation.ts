// Pipeline: kenya_legislation_v1
// Source: Kenya Law (new.kenyalaw.org) — Peach Jam platform powered by Laws.Africa.
// Approach: HTML scrape of /legislation listing (~550 acts, 50/page × 11 pages).
// Scope: Bills with /akn/ke/act/YEAR/NUM (primary Acts of Parliament) and /akn/ke/act/ln/...
//   (Legal Notices / subsidiary legislation). Excludes constitution alias.
// Run:
//   npx tsx scripts/ingest-kenya-legislation.ts --dry-run
//   ALLOW_EDITS=true npx tsx scripts/ingest-kenya-legislation.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'kenya_legislation_v1'
const BASE = 'https://new.kenyalaw.org'
const LIST_URL = `${BASE}/legislation`

interface Act {
  title: string
  pathAkn: string
  year: number | null
  number: string | null
  citation: string | null
  publicationDate: string | null
  externalId: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

function parseArgs() {
  const args = process.argv.slice(2)
  const li = args.indexOf('--limit')
  const limit = li !== -1 ? parseInt(args[li + 1] ?? '0', 10) || 0 : 0
  return { dryRun: args.includes('--dry-run'), limit }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

async function fetchPage(page: number): Promise<string | null> {
  const url = `${LIST_URL}?page=${page}`
  const res = await fetch(url, { headers: { 'User-Agent': 'epistemic-receipts/1.0 (research)' } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Fetch failed page ${page}: ${res.status}`)
  return res.text()
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function parseListPage(html: string): Act[] {
  const acts: Act[] = []
  // Match patterns like:
  //   <td class="cell-title">
  //     <a href="/akn/ke/act/YYYY/NN/eng@DATE">Title</a>
  //   </td>
  //   <td class="cell-citation">Cap. XXX</td>
  const rowRegex = /<td class="cell-title">[\s\S]*?<a href="(\/akn\/ke\/act\/[^"]+)">([\s\S]*?)<\/a>[\s\S]*?<td class="cell-citation">([\s\S]*?)<\/td>/g
  let m: RegExpExecArray | null
  while ((m = rowRegex.exec(html)) !== null) {
    const pathAkn = m[1].trim()
    const title = decodeHtml(m[2].replace(/<[^>]+>/g, '').trim())
    const citation = decodeHtml(m[3].replace(/<[^>]+>/g, '').trim()) || null

    if (!title || title === 'Constitution of Kenya') continue

    // Extract year + number from path: /akn/ke/act/2016/31/eng@2022-12-31
    // or legal notice: /akn/ke/act/ln/2023/161/eng@2023-12-01
    const actPath = pathAkn.match(/\/akn\/ke\/act\/(?:(ln|by-law|si)\/)?([0-9]+)\/([^/]+)\/eng@([0-9-]+)/)
    if (!actPath) continue
    const isSubsidiary = actPath[1] != null
    const year = parseInt(actPath[2], 10)
    const number = actPath[3]
    const publicationDate = actPath[4]

    const externalId = `kenya_${isSubsidiary ? actPath[1] + '_' : ''}${year}_${number}`
    acts.push({
      title,
      pathAkn,
      year: Number.isFinite(year) ? year : null,
      number,
      citation,
      publicationDate,
      externalId,
    })
  }
  return acts
}

const topicCache = new Map<string, string>()
async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  topicCache.set(slug, created.id)
  return created.id
}

async function writeAct(tx: TxClient, act: Act, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: act.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: `Kenya Law — ${act.title}${act.year ? ` (${act.year})` : ''}`,
      url: `${BASE}${act.pathAkn}`,
      publishedAt: act.publicationDate ? new Date(act.publicationDate) : null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `kenya_source_${act.externalId.replace(/^kenya_/, '')}`,
    },
  })

  const text = `Kenya enacted ${act.title}${act.year ? ` in ${act.year}` : ''}${act.citation ? ` (${act.citation})` : ''}.`
  const claim = await tx.claim.create({
    data: {
      text,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: act.publicationDate ? new Date(act.publicationDate) : null,
      claimEmergedPrecision: act.publicationDate ? 'DAY' : null,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: act.externalId,
      metadata: {
        dataset: INGESTED_BY,
        country: 'Kenya',
        title: act.title,
        year: act.year,
        number: act.number,
        citation: act.citation,
        aknPath: act.pathAkn,
        publicationDate: act.publicationDate,
      },
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId: source.id,
      claimId: claim.id,
      type: 'FOR',
      evidenceType: 'EVIDENTIARY',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
    },
  })

  await tx.edgeRevision.create({
    data: { edgeId: edge.id, priorScore: null, newScore: 95, reason: 'Kenya Law (Laws.Africa Peach Jam) — enacted legislation', changedAt: new Date() },
  })

  await tx.claimTopic.upsert({
    where: { claimId_topicId: { claimId: claim.id, topicId } },
    update: {},
    create: { claimId: claim.id, topicId },
  })

  return 'ingested'
}

async function main() {
  const { dryRun, limit } = parseArgs()
  console.log(`\n── Pipeline: Kenya Legislation (${INGESTED_BY}) ──`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'full'} | Limit: ${limit || 'all'}`)
  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to enable DB writes.')
    process.exit(1)
  }

  console.log(`\nFetching all listing pages from ${LIST_URL}…`)
  const all: Act[] = []
  const seen = new Set<string>()
  let p = 1
  while (true) {
    const html = await fetchPage(p)
    if (html === null) break
    const acts = parseListPage(html)
    if (acts.length === 0) break
    let added = 0
    for (const a of acts) {
      if (seen.has(a.externalId)) continue
      seen.add(a.externalId)
      all.push(a)
      added++
    }
    console.log(`  page ${p}: ${acts.length} rows (${added} new)`)
    if (added === 0) break
    p++
    if (p > 50) break
    await new Promise(r => setTimeout(r, 200))
  }
  console.log(`  Total unique acts: ${all.length}`)
  const pool = limit > 0 ? all.slice(0, limit) : all

  if (dryRun) {
    const sample = pool.slice(0, 15)
    const outFile = 'kenya-legislation-dry-run-sample.json'
    fs.writeFileSync(outFile, JSON.stringify({ total: pool.length, sample }, null, 2))
    for (const a of sample) console.log(`  ${a.year ?? '----'} #${a.number ?? '?'}  ${a.title}`)
    console.log(`\n  Written: ${outFile}`)
    await prisma.$disconnect()
    return
  }

  const topicId = await ensureTopic('kenya-legislation', 'Kenya Legislation', 'legislation')
  const counts = { ingested: 0, skipped: 0, errors: 0 }
  let n = 0
  for (const a of pool) {
    try {
      const r = await prisma.$transaction(tx => writeAct(tx, a, topicId), { timeout: 30000 })
      if (r === 'ingested') counts.ingested++
      else if (r === 'skipped') counts.skipped++
      else counts.errors++
    } catch (err) {
      console.error(`  Failed ${a.externalId}: ${err instanceof Error ? err.message : err}`)
      counts.errors++
    }
    n++
    if (n % 100 === 0) console.log(`  Progress: ${n}/${pool.length} — ingested=${counts.ingested}`)
  }
  console.log(`\nIngestion complete. Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)
  const db = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  console.log(`DB claims (${INGESTED_BY}): ${db}`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
