// Pipeline: P130 — Academic Fields (reference table, not a HARD_FACT pipeline)
// Source: Wikipedia "Outline of academic disciplines"
//   https://en.wikipedia.org/wiki/Outline_of_academic_disciplines
// Writes to AcademicField table (not Claim). Hierarchy preserved via parentId.
// Run:
//   npx tsx scripts/ingest-academic-fields.ts --dry-run
//   ALLOW_EDITS=true npx tsx scripts/ingest-academic-fields.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const PAGE_URL = 'https://en.wikipedia.org/w/api.php?action=parse&page=Outline_of_academic_disciplines&prop=wikitext&format=json'
const HUMAN_URL = 'https://en.wikipedia.org/wiki/Outline_of_academic_disciplines'

interface ParsedNode {
  name: string
  slug: string
  level: number
  parentSlug: string | null
}

function parseArgs() {
  const args = process.argv.slice(2)
  return { dryRun: args.includes('--dry-run') }
}

async function fetchWikitext(): Promise<string> {
  const res = await fetch(PAGE_URL, { headers: { 'User-Agent': 'epistemic-receipts/1.0 (research)' } })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  const j = await res.json() as { parse: { wikitext: { '*': string } } }
  return j.parse.wikitext['*']
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function stripWikiLinks(s: string): string {
  return s
    .replace(/\[\[([^\[\]\|]+)\|([^\[\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\[\]]+)\]\]/g, '$1')
    .replace(/<!--.*?-->/g, '')
    .replace(/\(\[\[[^\]]+\]\]\)/g, '')
    .replace(/\(\s*outline\s*\)/gi, '')
    .replace(/\(\s*list\s*\)/gi, '')
    .trim()
}

function extractFirstLinkLabel(line: string): string | null {
  const m = line.match(/\[\[([^\[\]\|]+)(?:\|([^\[\]]+))?\]\]/)
  if (!m) return null
  const label = (m[2] ?? m[1]).trim()
  return label || null
}

function parseWikitext(wikitext: string): ParsedNode[] {
  const nodes: ParsedNode[] = []
  const slugCounts = new Map<string, number>()

  const allocSlug = (base: string): string => {
    let slug = base
    const n = (slugCounts.get(base) ?? 0) + 1
    slugCounts.set(base, n)
    if (n > 1) slug = `${base}-${n}`
    return slug
  }

  // Stop at "See also" and other tail sections
  const stopIdx = (() => {
    const candidates = ['== See also ==', '==See also==', '== References ==', '==References==', '== External links ==']
    let min = wikitext.length
    for (const c of candidates) {
      const i = wikitext.indexOf(c)
      if (i !== -1 && i < min) min = i
    }
    return min
  })()
  const body = wikitext.slice(0, stopIdx)

  const lines = body.split('\n')

  // sectionStack: stack of {level, slug} for == and === headings
  // bulletStack: parallel stack for bullet items (with depth = number of stars)
  const sectionStack: { level: number; slug: string }[] = []
  let bulletStack: { depth: number; slug: string; level: number }[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // == Heading ==
    const h2 = line.match(/^==\s*([^=].*?)\s*==$/)
    if (h2 && !line.startsWith('===')) {
      const name = stripWikiLinks(h2[1])
      if (!name) continue
      const slug = allocSlug(slugify(name))
      while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= 0) sectionStack.pop()
      sectionStack.push({ level: 0, slug })
      bulletStack = []
      nodes.push({ name, slug, level: 0, parentSlug: null })
      continue
    }

    // === Heading ===
    const h3 = line.match(/^===\s*([^=].*?)\s*===$/)
    if (h3) {
      const name = stripWikiLinks(h3[1])
      if (!name) continue
      while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= 1) sectionStack.pop()
      const parent = sectionStack[sectionStack.length - 1]
      if (!parent) continue
      const slug = allocSlug(`${parent.slug}--${slugify(name)}`)
      sectionStack.push({ level: 1, slug })
      bulletStack = []
      nodes.push({ name, slug, level: 1, parentSlug: parent.slug })
      continue
    }

    // ==== Heading ==== (rare)
    const h4 = line.match(/^====\s*([^=].*?)\s*====$/)
    if (h4) continue

    // Bullets: *, **, ***
    const b = line.match(/^(\*+)\s*(.*)$/)
    if (!b) continue
    const depth = b[1].length
    const content = b[2].trim()
    if (!content) continue

    // Extract field name from first [[link]] in the line
    let fieldName = extractFirstLinkLabel(content)
    if (!fieldName) {
      const plain = stripWikiLinks(content).split(/[,;.(]/)[0].trim()
      if (!plain || plain.length > 80) continue
      fieldName = plain
    }
    fieldName = fieldName.trim()
    if (!fieldName) continue
    // Filter out outline meta-entries
    if (/^Outline of /i.test(fieldName)) continue
    if (/^List of /i.test(fieldName)) continue

    // Pop bulletStack until top.depth < depth
    while (bulletStack.length > 0 && bulletStack[bulletStack.length - 1].depth >= depth) bulletStack.pop()
    const parent = bulletStack.length > 0
      ? bulletStack[bulletStack.length - 1]
      : sectionStack[sectionStack.length - 1]
    if (!parent) continue

    const level = parent.level + 1
    const slug = allocSlug(`${parent.slug}--${slugify(fieldName)}`)
    nodes.push({ name: fieldName, slug, level, parentSlug: parent.slug })
    bulletStack.push({ depth, slug, level })
  }

  return nodes
}

async function main() {
  const { dryRun } = parseArgs()
  console.log(`\n── Pipeline: Academic Fields (P130) ──`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'full'}`)
  console.log(`Source: ${HUMAN_URL}`)

  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to enable DB writes.')
    process.exit(1)
  }

  console.log(`\nFetching wikitext…`)
  const wt = await fetchWikitext()
  console.log(`  ${wt.length} chars`)

  console.log(`\nParsing hierarchy…`)
  const nodes = parseWikitext(wt)
  const byLevel = new Map<number, number>()
  for (const n of nodes) byLevel.set(n.level, (byLevel.get(n.level) ?? 0) + 1)
  console.log(`  Parsed ${nodes.length} fields`)
  for (const [lvl, count] of [...byLevel.entries()].sort()) {
    console.log(`    level ${lvl}: ${count}`)
  }

  if (dryRun) {
    const sample = nodes.slice(0, 30)
    const outFile = 'academic-fields-dry-run-sample.json'
    fs.writeFileSync(outFile, JSON.stringify({ totalFields: nodes.length, byLevel: Object.fromEntries(byLevel), sample }, null, 2))
    console.log(`\nSample:`)
    for (const n of sample) {
      console.log(`  L${n.level} ${'  '.repeat(n.level)}${n.name}  [${n.slug}]`)
    }
    console.log(`\n  Written: ${outFile}`)
    console.log('\nDry-run complete.')
    await prisma.$disconnect()
    return
  }

  console.log(`\nWriting to AcademicField table (level-by-level so parents exist)…`)
  const slugToId = new Map<string, number>()
  let inserted = 0
  let skipped = 0

  const maxLevel = Math.max(...nodes.map(n => n.level))
  for (let lvl = 0; lvl <= maxLevel; lvl++) {
    const batch = nodes.filter(n => n.level === lvl)
    for (const n of batch) {
      const existing = await prisma.academicField.findUnique({ where: { slug: n.slug }, select: { id: true } })
      if (existing) {
        slugToId.set(n.slug, existing.id)
        skipped++
        continue
      }
      const parentId = n.parentSlug ? slugToId.get(n.parentSlug) ?? null : null
      const created = await prisma.academicField.create({
        data: { name: n.name, slug: n.slug, level: n.level, parentId },
        select: { id: true },
      })
      slugToId.set(n.slug, created.id)
      inserted++
    }
    console.log(`  level ${lvl}: ${batch.length} processed (running total inserted=${inserted}, skipped=${skipped})`)
  }

  console.log(`\nIngestion complete. Inserted: ${inserted}, Skipped: ${skipped}`)
  const dbCount = await prisma.academicField.count()
  console.log(`DB total: ${dbCount}`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
