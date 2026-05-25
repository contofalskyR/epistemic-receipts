// Generic Peach Jam (Laws.Africa) Legal Information Institute scraper.
// Usage:
//   npx tsx scripts/ingest-africa-lii.ts --country=ug --domain=ulii.org [--dry-run]
//   ALLOW_EDITS=true npx tsx scripts/ingest-africa-lii.ts --country=ug --domain=ulii.org
//
// Country tag pattern: <country>_legislation_v1.
// Verified-reachable LIIs: ug/ulii.org, gh/ghalii.org, tz/tanzlii.org, mw/malawilii.org,
// zm/zambialii.org, zw/zimlii.org, na/namiblii.org, sl/sierralii.org.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

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

const COUNTRY_NAMES: Record<string, string> = {
  ug: 'Uganda',
  gh: 'Ghana',
  tz: 'Tanzania',
  mw: 'Malawi',
  zm: 'Zambia',
  zw: 'Zimbabwe',
  na: 'Namibia',
  sl: 'Sierra Leone',
  ke: 'Kenya',
  za: 'South Africa',
  ng: 'Nigeria',
  rw: 'Rwanda',
  ls: 'Lesotho',
  bw: 'Botswana',
  sz: 'Eswatini',
  mz: 'Mozambique',
  et: 'Ethiopia',
  lr: 'Liberia',
  mu: 'Mauritius',
  ao: 'Angola',
}

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (k: string) => {
    const a = args.find(x => x.startsWith(`--${k}=`))
    return a ? a.split('=')[1] : null
  }
  const country = (get('country') ?? '').toLowerCase()
  const domain = get('domain')
  const dryRun = args.includes('--dry-run')
  if (!country || !domain) {
    console.error('Usage: --country=<cc> --domain=<lii.tld> [--dry-run]')
    process.exit(1)
  }
  return { country, domain: domain!, dryRun }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
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

async function fetchPage(listUrl: string, page: number): Promise<string | null> {
  const url = `${listUrl}?page=${page}`
  const res = await fetch(url, { headers: { 'User-Agent': 'epistemic-receipts/1.0 (research)' } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Fetch failed page ${page}: ${res.status}`)
  return res.text()
}

function parseListPage(html: string, country: string): Act[] {
  const acts: Act[] = []
  // Match any <a> linking to /akn/<cc>/act/... or /en/akn/<cc>/act/... — pull title from <a> text.
  const linkRegex = new RegExp(`<a\\s+href="((?:\\/[a-z]{2})?\\/akn\\/${country}\\/act\\/[^"]+)"[^>]*>([\\s\\S]*?)<\\/a>`, 'g')
  const actPathRegex = new RegExp(`\\/akn\\/${country}\\/act\\/(?:([a-z][a-z-]+)\\/)?([0-9]+)\\/([^/]+)\\/[a-z]+@([0-9-]+)`)
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = linkRegex.exec(html)) !== null) {
    const pathAkn = m[1].trim()
    const titleRaw = decodeHtml(m[2].replace(/<[^>]+>/g, '').trim())
    if (!titleRaw || titleRaw.length < 3) continue
    if (/^(view|read more|download|→|>)$/i.test(titleRaw)) continue

    const ap = pathAkn.match(actPathRegex)
    if (!ap) continue
    const subType = ap[1] ?? null
    const year = parseInt(ap[2], 10)
    const number = ap[3]
    const publicationDate = ap[4]

    const externalId = `${country}_${subType ? subType + '_' : ''}${year}_${number}`
    if (seen.has(externalId)) continue
    seen.add(externalId)

    acts.push({
      title: titleRaw,
      pathAkn,
      year: Number.isFinite(year) ? year : null,
      number,
      citation: null,
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

async function writeAct(tx: TxClient, act: Act, topicId: string, country: string, countryName: string, ingestedBy: string, base: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: act.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: `${countryName} Law — ${act.title}${act.year ? ` (${act.year})` : ''}`,
      url: `${base}${act.pathAkn}`,
      publishedAt: act.publicationDate ? new Date(act.publicationDate) : null,
      methodologyType: 'primary',
      ingestedBy,
      humanReviewed: false,
      autoApproved: true,
      externalId: `${country}_source_${act.externalId.replace(new RegExp(`^${country}_`), '')}`,
    },
  })

  const text = `${countryName} enacted ${act.title}${act.year ? ` in ${act.year}` : ''}${act.citation ? ` (${act.citation})` : ''}.`
  const claim = await tx.claim.create({
    data: {
      text,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: act.publicationDate ? new Date(act.publicationDate) : null,
      claimEmergedPrecision: act.publicationDate ? 'DAY' : null,
      ingestedBy,
      humanReviewed: false,
      autoApproved: true,
      externalId: act.externalId,
      metadata: {
        dataset: ingestedBy,
        country: countryName,
        countryCode: country,
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
      ingestedBy,
      humanReviewed: false,
      autoApproved: true,
    },
  })

  await tx.edgeRevision.create({
    data: { edgeId: edge.id, priorScore: null, newScore: 95, reason: `${countryName} LII (Peach Jam) — enacted legislation`, changedAt: new Date() },
  })

  await tx.claimTopic.upsert({
    where: { claimId_topicId: { claimId: claim.id, topicId } },
    update: {},
    create: { claimId: claim.id, topicId },
  })

  return 'ingested'
}

async function main() {
  const { country, domain, dryRun } = parseArgs()
  const countryName = COUNTRY_NAMES[country] ?? country.toUpperCase()
  const ingestedBy = `${countryName.toLowerCase().replace(/\s+/g, '_')}_legislation_v1`
  const base = `https://${domain}`
  const listUrl = `${base}/legislation/`

  console.log(`\n── Pipeline: ${countryName} Legislation (${ingestedBy}) ──`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'full'}`)
  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to enable DB writes.')
    process.exit(1)
  }

  console.log(`\nFetching pages from ${listUrl}…`)
  const all: Act[] = []
  const seen = new Set<string>()
  let p = 1
  while (true) {
    const html = await fetchPage(listUrl, p)
    if (html === null) break
    const acts = parseListPage(html, country)
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

  if (dryRun) {
    const sample = all.slice(0, 15)
    const outFile = `${country}-legislation-dry-run-sample.json`
    fs.writeFileSync(outFile, JSON.stringify({ country: countryName, total: all.length, sample }, null, 2))
    for (const a of sample) console.log(`  ${a.year ?? '----'} #${a.number ?? '?'}  ${a.title}`)
    console.log(`\n  Written: ${outFile}`)
    await prisma.$disconnect()
    return
  }

  const topicSlug = `${country}-legislation`
  const topicId = await ensureTopic(topicSlug, `${countryName} Legislation`, 'legislation')
  const counts = { ingested: 0, skipped: 0, errors: 0 }
  let n = 0
  for (const a of all) {
    try {
      const r = await prisma.$transaction(tx => writeAct(tx, a, topicId, country, countryName, ingestedBy, base), { timeout: 30000 })
      if (r === 'ingested') counts.ingested++
      else if (r === 'skipped') counts.skipped++
      else counts.errors++
    } catch (err) {
      console.error(`  Failed ${a.externalId}: ${err instanceof Error ? err.message : err}`)
      counts.errors++
    }
    n++
    if (n % 100 === 0) console.log(`  Progress: ${n}/${all.length} — ingested=${counts.ingested}`)
  }
  console.log(`\nIngestion complete. Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)
  const db = await prisma.claim.count({ where: { ingestedBy, deleted: false } })
  console.log(`DB claims (${ingestedBy}): ${db}`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
