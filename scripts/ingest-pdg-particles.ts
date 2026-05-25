// Pipeline: pdg_particles_v1
// Source: Particle Data Group — Review of Particle Physics 2024 edition
//   https://pdg.lbl.gov/2024/tables/contents_tables.html
//   Machine-readable mass/width file: https://pdg.lbl.gov/2024/mcdata/mass_width_2024.mcd
// Run:
//   npx tsx scripts/ingest-pdg-particles.ts --dry-run
//   ALLOW_EDITS=true npx tsx scripts/ingest-pdg-particles.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'pdg_particles_v1'
const SOURCE_URL = 'https://pdg.lbl.gov/2024/tables/contents_tables.html'
const DATA_URL = 'https://pdg.lbl.gov/2024/mcdata/mass_width_2024.mcd'

interface Particle {
  mcIds: number[]
  mass: number | null
  massErrPos: number | null
  massErrNeg: number | null
  width: number | null
  widthErrPos: number | null
  widthErrNeg: number | null
  name: string
  charge: string
  externalId: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

function parseArgs() {
  const args = process.argv.slice(2)
  return { dryRun: args.includes('--dry-run') }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null
  const t = s.trim()
  if (!t) return null
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : null
}

async function fetchMcd(): Promise<string> {
  const res = await fetch(DATA_URL, { headers: { 'User-Agent': 'epistemic-receipts/1.0 (research)' } })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  return res.text()
}

function parseMcd(text: string): Particle[] {
  const particles: Particle[] = []
  const seenSlugs = new Map<string, number>()
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('*')) continue
    if (line.length < 70) continue

    // Fixed columns per file documentation:
    // 1-8, 9-16, 17-24, 25-32: MC IDs (4×8 chars)
    // 33: blank
    // 34-51: mass (18 chars)
    // 52: blank
    // 53-60: +mass err (8)
    // 61: blank
    // 62-69: -mass err (8)
    // 70: blank
    // 71-88: width (18)
    // 89: blank
    // 90-97: +width err (8)
    // 98: blank
    // 99-106: -width err (8)
    // 107: blank
    // 108-128: name (21)
    // After: charge state(s)
    const id1 = parseNum(line.substring(0, 8))
    const id2 = parseNum(line.substring(8, 16))
    const id3 = parseNum(line.substring(16, 24))
    const id4 = parseNum(line.substring(24, 32))
    const mass = parseNum(line.substring(34, 52))
    const massErrPos = parseNum(line.substring(53, 61))
    const massErrNeg = parseNum(line.substring(62, 70))
    const width = parseNum(line.substring(71, 89))
    const widthErrPos = parseNum(line.substring(90, 98))
    const widthErrNeg = parseNum(line.substring(99, 107))
    const nameField = (line.substring(107, 128) ?? '').trimEnd()
    // The 21-char name field embeds the charge on the right: e.g. "gamma               0",
    // "Sigma(b)*           -", "u                +2/3". Split on the last whitespace run.
    const nameMatch = nameField.match(/^(\S+(?:\s\S+)*?)\s+(\S+)$/)
    const name = nameMatch ? nameMatch[1].trim() : nameField.trim()
    const charge = nameMatch ? nameMatch[2].trim() : ''

    if (!name) continue

    const mcIds = [id1, id2, id3, id4].filter((n): n is number => n != null && n !== 0)
    if (mcIds.length === 0) continue

    const slugBase = `${slugify(name)}_${charge ? slugify(charge) : 'q' + mcIds[0]}`
    const count = (seenSlugs.get(slugBase) ?? 0) + 1
    seenSlugs.set(slugBase, count)
    const slug = count > 1 ? `${slugBase}-${count}` : slugBase

    particles.push({
      mcIds,
      mass,
      massErrPos,
      massErrNeg,
      width,
      widthErrPos,
      widthErrNeg,
      name,
      charge,
      externalId: `pdg_${slug}`,
    })
  }
  return particles
}

function buildClaimText(p: Particle): string {
  const parts: string[] = []
  const chargeLabel = p.charge ? ` (charge ${p.charge})` : ''
  parts.push(`${p.name}${chargeLabel} is a particle catalogued by the Particle Data Group (MC ID ${p.mcIds.join('/')})`)
  if (p.mass != null) {
    const err = p.massErrPos != null ? ` ± ${p.massErrPos}` : ''
    parts.push(`with mass ${p.mass}${err} GeV/c²`)
  }
  if (p.width != null && p.width > 0) {
    const err = p.widthErrPos != null ? ` ± ${p.widthErrPos}` : ''
    parts.push(`width ${p.width}${err} GeV`)
  }
  return parts.join(', ') + '.'
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

async function writeParticle(tx: TxClient, p: Particle, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: p.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: `PDG Review of Particle Physics 2024 — ${p.name}${p.charge ? ` (${p.charge})` : ''}`,
      url: SOURCE_URL,
      publishedAt: new Date('2024-05-31'),
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `pdg_source_${p.externalId.replace(/^pdg_/, '')}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: buildClaimText(p),
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: p.externalId,
      metadata: {
        dataset: INGESTED_BY,
        name: p.name,
        charge: p.charge,
        mcIds: p.mcIds,
        massGeV: p.mass,
        massErrPos: p.massErrPos,
        massErrNeg: p.massErrNeg,
        widthGeV: p.width,
        widthErrPos: p.widthErrPos,
        widthErrNeg: p.widthErrNeg,
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
    data: { edgeId: edge.id, priorScore: null, newScore: 100, reason: 'PDG Review of Particle Physics — particle properties as HARD_FACT', changedAt: new Date() },
  })

  await tx.claimTopic.upsert({
    where: { claimId_topicId: { claimId: claim.id, topicId } },
    update: {},
    create: { claimId: claim.id, topicId },
  })

  return 'ingested'
}

async function main() {
  const { dryRun } = parseArgs()
  console.log(`\n── Pipeline: PDG Particles (${INGESTED_BY}) ──`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'full'}`)
  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to enable DB writes.')
    process.exit(1)
  }
  console.log(`\nFetching: ${DATA_URL}`)
  const text = await fetchMcd()
  console.log(`  ${text.length} chars`)
  const particles = parseMcd(text)
  console.log(`  Parsed ${particles.length} particles`)

  if (dryRun) {
    const sample = particles.slice(0, 15)
    const outFile = 'pdg-particles-dry-run-sample.json'
    fs.writeFileSync(outFile, JSON.stringify({ total: particles.length, sample }, null, 2))
    for (const p of sample) {
      console.log(`  ${p.name}(${p.charge}) m=${p.mass} GeV  w=${p.width}  mcId=${p.mcIds[0]}`)
    }
    console.log(`\n  Written: ${outFile}`)
    await prisma.$disconnect()
    return
  }

  const topicId = await ensureTopic('particle-physics', 'Particle Physics', 'physics')
  const counts = { ingested: 0, skipped: 0, errors: 0 }
  for (const p of particles) {
    try {
      const r = await prisma.$transaction(tx => writeParticle(tx, p, topicId), { timeout: 30000 })
      if (r === 'ingested') counts.ingested++
      else if (r === 'skipped') counts.skipped++
      else counts.errors++
    } catch (err) {
      console.error(`  Failed ${p.name}(${p.charge}): ${err instanceof Error ? err.message : err}`)
      counts.errors++
    }
  }
  console.log(`\nIngestion complete. Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)
  const db = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  console.log(`DB claims: ${db}`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
