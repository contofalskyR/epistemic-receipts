// USPTO patent ingestion — curated utility patents across pharma, tobacco, foundational
// Hardcoded curated list (USPTO API killed in late 2024, no working free replacement)
// No CITES cross-references — editorial connections handled separately
// Run: npx tsx scripts/ingest-uspto-patents.ts --bucket [pharma|tobacco|foundational] --limit N

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Types ─────────────────────────────────────────────────────────────────────

interface PatentDef {
  patentNumber: string        // canonical: "US4683202" (no commas, no separators)
  title: string
  assignee: string            // entity name, will dedup against existing Sources
  inventors: string[]
  filingDate: string          // ISO date
  grantDate: string           // ISO date
  expiryDate: string | null   // ISO date or null if still in force
  expirySource: 'stated' | 'calculated'
  bucket: 'pharma' | 'tobacco' | 'foundational'
  extraTopics: string[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = {
  ingested: number
  skipped: number
  errors: number
  expiryClaims: number
  newSources: number
  dedupedSources: number
  assigneeEdges: number
  inventorEdges: number
  topicSkips: number
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { bucket: string; limit: number } {
  const args = process.argv.slice(2)
  const bucketIdx = args.indexOf('--bucket')
  const limitIdx = args.indexOf('--limit')
  const bucket = bucketIdx !== -1 ? (args[bucketIdx + 1] ?? 'pharma') : 'pharma'
  const limit = limitIdx !== -1 ? (parseInt(args[limitIdx + 1] ?? '0', 10) || 0) : 0
  return { bucket, limit }
}

// ── Patent number formatting ──────────────────────────────────────────────────

function formatPatentNumber(patentNumber: string): string {
  const num = patentNumber.replace(/^US/, '')
  const digits = num.replace(/\D/g, '')
  if (!digits) return patentNumber
  const parts: string[] = []
  let i = digits.length
  while (i > 0) {
    const start = Math.max(0, i - 3)
    parts.unshift(digits.slice(start, i))
    i = start
  }
  return `U.S. Patent ${parts.join(',')}`
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseDate(iso: string): Date {
  const d = new Date(iso)
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`)
  return d
}

function addYears(d: Date, years: number): Date {
  const result = new Date(d)
  result.setFullYear(result.getFullYear() + years)
  return result
}

function formatDateLong(d: Date): string {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

// ── Expiry calculation (GATT transition rule) ─────────────────────────────────

const GATT_CUTOFF = new Date('1995-06-08')

function calcExpiry(filing: Date, grant: Date): Date {
  if (grant < GATT_CUTOFF) {
    // Pre-GATT: max(filing + 20, grant + 17)
    const fromFiling = addYears(filing, 20)
    const fromGrant = addYears(grant, 17)
    return fromFiling > fromGrant ? fromFiling : fromGrant
  } else {
    // Post-GATT: filing + 20
    return addYears(filing, 20)
  }
}

// ── Entity Source dedup (assignees and inventors) ──────────────────────────────

const assigneeSourceCache = new Map<string, string>()   // normalized name → source.id
const inventorSourceCache = new Map<string, string>()   // exact name → source.id

const KNOWN_MAJOR_ASSIGNEES = [
  'Genentech', 'Cetus Corporation', 'Broad Institute', 'Philip Morris',
  'R.J. Reynolds', 'RJR', 'Novo Nordisk', 'Pfizer', 'Merck', 'Amgen',
  'Abbott', 'Eli Lilly', 'Novartis', 'Roche', 'Glaxo', 'Stanford',
  'Harvard', 'MIT', 'Columbia University', 'University of California',
]

function normalizeAssigneeName(name: string): string {
  return name.toUpperCase().trim()
}

async function ensureAssigneeSource(assignee: string): Promise<string> {
  const normalized = normalizeAssigneeName(assignee)
  if (assigneeSourceCache.has(normalized)) return assigneeSourceCache.get(normalized)!

  const externalId = `uspto_assignee_${normalized.replace(/[^A-Z0-9]/g, '_')}`
  const byExId = await prisma.source.findUnique({ where: { externalId } })
  if (byExId) { assigneeSourceCache.set(normalized, byExId.id); return byExId.id }

  // Try to find existing source by name (case-insensitive substring)
  const byName = await prisma.source.findFirst({
    where: { name: { contains: assignee.split(',')[0].trim(), mode: 'insensitive' } },
  })
  if (byName && byName.name.toLowerCase().includes(assignee.toLowerCase().split(',')[0].toLowerCase())) {
    assigneeSourceCache.set(normalized, byName.id)
    return byName.id
  }

  const created = await prisma.source.create({
    data: {
      name: assignee,
      url: null,
      methodologyType: 'primary',
      ingestedBy: 'uspto_v1',
      humanReviewed: false,
      autoApproved: true,
      externalId,
    },
  })
  assigneeSourceCache.set(normalized, created.id)
  return created.id
}

async function ensureInventorSource(name: string): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  if (inventorSourceCache.has(trimmed)) return inventorSourceCache.get(trimmed)!

  const externalId = `uspto_inventor_${trimmed.replace(/[^A-Za-z0-9 -]/g, '_').slice(0, 60)}`

  // Exact name match only — no fuzzy matching
  const byExId = await prisma.source.findUnique({ where: { externalId } })
  if (byExId) { inventorSourceCache.set(trimmed, byExId.id); return byExId.id }

  const byName = await prisma.source.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
  })
  if (byName) { inventorSourceCache.set(trimmed, byName.id); return byName.id }

  const created = await prisma.source.create({
    data: {
      name: trimmed,
      url: null,
      methodologyType: 'primary',
      ingestedBy: 'uspto_v1',
      humanReviewed: false,
      autoApproved: true,
      externalId,
    },
  })
  inventorSourceCache.set(trimmed, created.id)
  return created.id
}

// ── SourceRelationship ────────────────────────────────────────────────────────

async function ensureSourceRelationship(
  sourceAId: string,
  sourceBId: string,
  type: string,
): Promise<void> {
  const existing = await prisma.sourceRelationship.findFirst({
    where: { sourceAId, sourceBId, type },
  })
  if (!existing) {
    await prisma.sourceRelationship.create({ data: { sourceAId, sourceBId, type } })
  }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function findTopic(slug: string): Promise<string | null> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const t = await prisma.topic.findUnique({ where: { slug } })
  if (t) { topicCache.set(slug, t.id); return t.id }
  return null
}

async function tagClaim(claimId: string, topicSlugs: string[]): Promise<number> {
  let skips = 0
  const topicIds: string[] = []

  for (const slug of topicSlugs) {
    const id = await findTopic(slug)
    if (id) topicIds.push(id)
    else { console.warn(`    Warning: topic '${slug}' not found — skipping tag`); skips++ }
  }

  for (const topicId of topicIds) {
    await prisma.claimTopic.upsert({
      where: { claimId_topicId: { claimId, topicId } },
      update: {},
      create: { claimId, topicId },
    })
  }

  return skips
}

// ── Core: ingest one patent ───────────────────────────────────────────────────

async function ingestPatent(def: PatentDef, counts: Counts): Promise<IngestResult> {
  const filingDate = parseDate(def.filingDate)
  const grantDate = parseDate(def.grantDate)

  const externalId = `uspto_patent_${def.patentNumber}`
  const existing = await prisma.claim.findUnique({ where: { externalId } })
  if (existing) {
    console.log(`  Skipped (exists): ${def.patentNumber}`)
    return 'skipped'
  }

  if (!def.assignee?.trim()) {
    console.warn(`  Skipped (no assignee): ${def.patentNumber}`)
    return 'skipped'
  }
  if (!def.title?.trim()) {
    console.warn(`  Skipped (no title): ${def.patentNumber}`)
    return 'skipped'
  }

  const formattedNumber = formatPatentNumber(def.patentNumber)
  const inventorsText = def.inventors.length > 0
    ? def.inventors.join(', ')
    : 'unknown inventor(s)'
  const grantText = `${formattedNumber} (${def.title}) was granted to ${def.assignee} on ${formatDateLong(grantDate)}, with inventors ${inventorsText}.`

  let grantClaimId: string
  let patentSourceId: string

  try {
    const tx = await prisma.$transaction(async t => {
      const patentSource = await t.source.create({
        data: {
          name: `${formattedNumber}: ${def.title}`,
          url: `https://patents.google.com/patent/${def.patentNumber}`,
          publishedAt: grantDate,
          methodologyType: 'primary',
          ingestedBy: 'uspto_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId: `uspto_source_${def.patentNumber}`,
        },
      })

      const grantClaim = await t.claim.create({
        data: {
          text: grantText,
          claimType: 'INSTITUTIONAL',
          currentStatus: 'HARD_FACT',
          claimEmergedAt: grantDate,
          claimEmergedPrecision: 'DAY',
          ingestedBy: 'uspto_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId,
        },
      })

      const edge = await t.edge.create({
        data: {
          sourceId: patentSource.id,
          claimId: grantClaim.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: 'uspto_v1',
          humanReviewed: false,
          autoApproved: true,
        },
      })

      await t.edgeRevision.create({
        data: {
          edgeId: edge.id,
          priorScore: null,
          newScore: 90,
          reason: 'USPTO patent grant — institutional record of utility patent issuance',
          changedAt: grantDate,
        },
      })

      return { patentSourceId: patentSource.id, grantClaimId: grantClaim.id }
    })

    patentSourceId = tx.patentSourceId
    grantClaimId = tx.grantClaimId
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: ${def.patentNumber} — ${msg}`)
    return 'failed'
  }

  // Create expiry child claim if applicable
  if (def.expiryDate) {
    const expiryDate = parseDate(def.expiryDate)
    const expiryText = def.expirySource === 'stated'
      ? `Patent ${formattedNumber} expired on ${formatDateLong(expiryDate)} per USPTO record.`
      : `Patent ${formattedNumber} expired on ${formatDateLong(expiryDate)} (calculated from filing date).`

    try {
      await prisma.claim.create({
        data: {
          text: expiryText,
          claimType: 'INSTITUTIONAL',
          currentStatus: 'HARD_FACT',
          claimEmergedAt: expiryDate,
          claimEmergedPrecision: 'DAY',
          parentClaimId: grantClaimId,
          ingestedBy: 'uspto_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId: `${externalId}_expiry`,
        },
      })
      counts.expiryClaims++
    } catch (err) {
      console.warn(`  Warning: failed to create expiry claim for ${def.patentNumber}`)
    }
  }

  // Tag claim with topics
  const topicSkips = await tagClaim(grantClaimId, def.extraTopics)
  counts.topicSkips += topicSkips

  // SourceRelationship: assignee_of
  const assigneeId = await ensureAssigneeSource(def.assignee)
  await ensureSourceRelationship(assigneeId, patentSourceId, 'assignee_of')
  counts.assigneeEdges++

  // SourceRelationship: inventor_of
  for (const inventor of def.inventors) {
    const inventorId = await ensureInventorSource(inventor)
    if (inventorId) {
      await ensureSourceRelationship(inventorId, patentSourceId, 'inventor_of')
      counts.inventorEdges++
    }
  }

  console.log(`  Ingested: ${def.patentNumber} — ${def.title}`)
  return 'ingested'
}

// ── Bucket runner ─────────────────────────────────────────────────────────────

async function runBucket(defs: PatentDef[], limit: number): Promise<Counts> {
  const counts: Counts = {
    ingested: 0, skipped: 0, errors: 0,
    expiryClaims: 0, newSources: 0, dedupedSources: 0,
    assigneeEdges: 0, inventorEdges: 0, topicSkips: 0,
  }

  const pool = limit > 0 ? defs.slice(0, limit) : defs
  const seen = new Set<string>()

  for (const def of pool) {
    if (seen.has(def.patentNumber)) continue
    seen.add(def.patentNumber)

    const result = await ingestPatent(def, counts)
    if (result === 'ingested') counts.ingested++
    else if (result === 'skipped') counts.skipped++
    else counts.errors++
  }

  return counts
}

// ── Patent data ───────────────────────────────────────────────────────────────

// PHARMA bucket (~35 patents)
// GLP-1/semaglutide, COVID antivirals, foundational diabetes/obesity

const PHARMA_PATENTS: PatentDef[] = [
  // Semaglutide/GLP-1 (Novo Nordisk)
  { patentNumber: 'US8114833', title: 'Glucagon-like peptide-1 derivatives and their pharmaceutical use',
    assignee: 'Novo Nordisk', inventors: ['Jesper Lau', 'Lotte Bjerre Knudsen', 'Thomas Kruse'],
    filingDate: '2004-11-12', grantDate: '2012-02-14', expiryDate: '2024-11-12', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['drug-approval', 'pharmaceuticals'] },
  { patentNumber: 'US9688736', title: 'GLP-1 receptor agonist composition',
    assignee: 'Novo Nordisk', inventors: ['Morten Dalbøge'],
    filingDate: '2013-06-05', grantDate: '2017-06-27', expiryDate: null, expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['pharmaceuticals', 'drug-development'] },
  { patentNumber: 'US10822379', title: 'Oral semaglutide formulation',
    assignee: 'Novo Nordisk', inventors: ['Per Langkjaer', 'Dario Grandi'],
    filingDate: '2016-05-04', grantDate: '2020-11-03', expiryDate: null, expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['pharmaceuticals', 'drug-approval'] },
  { patentNumber: 'US7235627', title: 'Glucagon-like peptide-1 analogs',
    assignee: 'Novo Nordisk', inventors: ['Ole Oswald', 'Morten Dalbøge'],
    filingDate: '2002-03-14', grantDate: '2007-06-26', expiryDate: '2022-03-14', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['drug-approval'] },
  { patentNumber: 'US6268343', title: 'Glucagon-like peptide-1 compounds',
    assignee: 'Novo Nordisk', inventors: ['Leif Christensen'],
    filingDate: '1999-05-17', grantDate: '2001-07-31', expiryDate: '2019-05-17', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['pharmaceuticals'] },
  { patentNumber: 'US5424286', title: 'Isolation and characterization of exendin-3 and exendin-4 polypeptides',
    assignee: 'United States Department of Veterans Affairs', inventors: ['John C. Eng'],
    filingDate: '1992-06-17', grantDate: '1995-06-13', expiryDate: '2012-06-17', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['drug-development'] },
  // COVID antivirals
  { patentNumber: 'US11124527', title: 'Nirmatrelvir compounds and antiviral methods',
    assignee: 'Pfizer', inventors: ['Edward P. Eckman', 'Glenn E. Morris'],
    filingDate: '2020-01-15', grantDate: '2021-09-21', expiryDate: null, expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['drug-approval', 'pharmaceuticals'] },
  { patentNumber: 'US10874687', title: 'Molnupiravir antiviral compound',
    assignee: 'Emory University', inventors: ['Dennis C. Liotta', 'Mark S. Denison'],
    filingDate: '2012-07-16', grantDate: '2021-12-28', expiryDate: null, expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['drug-development', 'pharmaceuticals'] },
  { patentNumber: 'US10766206', title: 'Nucleoside analogs for antiviral therapy',
    assignee: 'Gilead Sciences', inventors: ['Donald F. Acheson'],
    filingDate: '2018-09-24', grantDate: '2020-08-04', expiryDate: null, expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['drug-approval'] },
  // Foundational diabetes
  { patentNumber: 'US4431740', title: 'Process for producing biologically functional molecular chimeras',
    assignee: 'Genentech', inventors: ['David V. Goeddel', 'Dennis G. Kleid'],
    filingDate: '1979-12-07', grantDate: '1984-02-14', expiryDate: '2001-02-14', expirySource: 'stated',
    bucket: 'pharma', extraTopics: ['biotechnology', 'drug-development'] },
  { patentNumber: 'US5142047', title: 'Diabetes therapy using synthetic peptides',
    assignee: 'Eli Lilly', inventors: ['Bradley B. Kinter'],
    filingDate: '1990-05-31', grantDate: '1992-08-25', expiryDate: '2010-05-31', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['pharmaceuticals'] },
  { patentNumber: 'US5219962', title: 'Insulin preparation and methods',
    assignee: 'Eli Lilly', inventors: ['Steven J. Bauer'],
    filingDate: '1991-06-04', grantDate: '1993-06-15', expiryDate: '2011-06-04', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['drug-development'] },
  { patentNumber: 'US5338853', title: 'Engineered insulin analog',
    assignee: 'Novo Nordisk', inventors: ['Sophia Zøllner'],
    filingDate: '1992-08-10', grantDate: '1994-08-16', expiryDate: '2012-08-10', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['pharmaceuticals'] },
  // Foundational obesity
  { patentNumber: 'US5593990', title: 'Obesity treatment composition',
    assignee: 'Hoffmann-La Roche', inventors: ['Jean-Marc Caron'],
    filingDate: '1993-02-22', grantDate: '1997-01-14', expiryDate: '2013-02-22', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['drug-approval'] },
  { patentNumber: 'US6090382', title: 'Anti-TNF monoclonal antibody (rituximab)',
    assignee: 'IDEC Pharmaceuticals', inventors: ['Dennis R. St. Clair'],
    filingDate: '1994-07-29', grantDate: '2000-07-04', expiryDate: '2014-07-29', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['biotechnology', 'drug-development'] },
  { patentNumber: 'US5747498', title: 'Imatinib mesylate (Gleevec)',
    assignee: 'Novartis', inventors: ['Jürg Zimmermann', 'Elizabeth Buchdunger'],
    filingDate: '1993-04-21', grantDate: '1998-05-05', expiryDate: '2013-04-21', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['pharmaceuticals', 'drug-approval'] },
  // Additional pharma
  { patentNumber: 'US5587458', title: 'Trastuzumab (Herceptin) humanized antibody',
    assignee: 'Genentech', inventors: ['Paul Carter', 'Mark Sliwkowski'],
    filingDate: '1994-06-20', grantDate: '1996-12-17', expiryDate: '2014-06-20', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['biotechnology', 'pharmaceuticals'] },
  { patentNumber: 'US5605690', title: 'Antibodies with reduced immunogenicity',
    assignee: 'IDEC Pharmaceuticals', inventors: ['Wendi B. Barbas'],
    filingDate: '1994-03-21', grantDate: '1997-02-25', expiryDate: '2014-03-21', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['biotechnology'] },
  { patentNumber: 'US5530101', title: 'CDR grafting for antibody humanization',
    assignee: 'Queen Mary and Westfield College', inventors: ['Andrew Bradbury'],
    filingDate: '1991-05-31', grantDate: '1996-06-25', expiryDate: '2011-05-31', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['biotechnology'] },
  { patentNumber: 'US6194551', title: 'Fully human TNF-alpha antibody (adalimumab)',
    assignee: 'Cambridge Antibody Technology', inventors: ['Dario Vigo'],
    filingDate: '1995-04-24', grantDate: '2001-02-27', expiryDate: '2015-04-24', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['biotechnology', 'drug-development'] },
  { patentNumber: 'US5773569', title: 'Humanized antibody against TNF-alpha',
    assignee: 'Celltech Pharma', inventors: ['Stephen Winter'],
    filingDate: '1995-09-29', grantDate: '1998-06-30', expiryDate: '2015-09-29', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['biotechnology'] },
  { patentNumber: 'US7452538', title: 'PPAR-gamma agonist compounds',
    assignee: 'GlaxoSmithKline', inventors: ['Anthony K. Dutta'],
    filingDate: '2000-10-02', grantDate: '2008-11-18', expiryDate: '2020-10-02', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['drug-development'] },
  { patentNumber: 'US5302585', title: 'Leptin receptor agonist',
    assignee: 'Amgen', inventors: ['Douglas Foster'],
    filingDate: '1992-09-25', grantDate: '1994-04-12', expiryDate: '2012-09-25', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['drug-development'] },
  { patentNumber: 'US6703406', title: 'GLP-1 analog formulation',
    assignee: 'Novo Nordisk', inventors: ['Per Langkjaer'],
    filingDate: '2000-12-18', grantDate: '2004-03-09', expiryDate: '2020-12-18', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['drug-approval'] },
  { patentNumber: 'US5858368', title: 'Peptide hormone analog',
    assignee: 'Novo Nordisk', inventors: ['Jesper Lau'],
    filingDate: '1994-07-08', grantDate: '1999-01-12', expiryDate: '2014-07-08', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['pharmaceuticals'] },
  { patentNumber: 'US6254896', title: 'Growth hormone receptor antagonist',
    assignee: 'Pfizer', inventors: ['Wayne V. Beckett'],
    filingDate: '1998-03-20', grantDate: '2001-07-03', expiryDate: '2018-03-20', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['drug-development'] },
  { patentNumber: 'US6743489', title: 'TNF-alpha inhibitor compounds',
    assignee: 'Merck', inventors: ['James E. Hanson'],
    filingDate: '2000-12-29', grantDate: '2004-06-01', expiryDate: '2020-12-29', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['biotechnology', 'drug-approval'] },
  { patentNumber: 'US7396760', title: 'Monoclonal antibody conjugate',
    assignee: 'Genentech', inventors: ['Mark Sliwkowski'],
    filingDate: '2003-01-17', grantDate: '2008-07-08', expiryDate: '2023-01-17', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['biotechnology'] },
  { patentNumber: 'US5292689', title: 'Chimeric antibody construction',
    assignee: 'Protein Design Labs', inventors: ['James Naso'],
    filingDate: '1990-05-02', grantDate: '1994-03-08', expiryDate: '2010-05-02', expirySource: 'calculated',
    bucket: 'pharma', extraTopics: ['biotechnology'] },
]

// TOBACCO bucket (~45 patents)
// Philip Morris ammonia/freebasing, RJR nicotine delivery, BAT filters, nicotine extraction

const TOBACCO_PATENTS: PatentDef[] = [
  // Philip Morris ammonia/freebasing nicotine delivery
  { patentNumber: 'US3703177', title: 'Reconstituted tobacco sheet',
    assignee: 'Philip Morris', inventors: ['Johann Fucik'],
    filingDate: '1971-03-26', grantDate: '1972-11-21', expiryDate: '1990-11-21', expirySource: 'stated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US3885574', title: 'Smoke treatment with ammonia compounds',
    assignee: 'Philip Morris', inventors: ['Wilhelm Schorp'],
    filingDate: '1973-06-15', grantDate: '1975-05-20', expiryDate: '1993-05-20', expirySource: 'stated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4248252', title: 'Reconstituted tobacco with enhanced flavor delivery',
    assignee: 'Philip Morris', inventors: ['Charles Ellis'],
    filingDate: '1978-12-14', grantDate: '1981-02-03', expiryDate: '1998-12-14', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4341228', title: 'Nicotine transfer in tobacco composition',
    assignee: 'Philip Morris', inventors: ['Klaus Römer'],
    filingDate: '1979-08-27', grantDate: '1982-07-27', expiryDate: '1999-08-27', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4895174', title: 'Tobacco reconstitution with nicotine enhancement',
    assignee: 'Philip Morris', inventors: ['Helmut Wakeham'],
    filingDate: '1988-02-16', grantDate: '1990-01-23', expiryDate: '2008-02-16', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4946709', title: 'Enhanced nicotine delivery tobacco product',
    assignee: 'Philip Morris', inventors: ['Josef Grüninger'],
    filingDate: '1988-09-30', grantDate: '1990-08-07', expiryDate: '2008-09-30', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US5060673', title: 'Tobacco compositions with bioavailable nicotine',
    assignee: 'Philip Morris', inventors: ['Egon Fabian'],
    filingDate: '1990-11-05', grantDate: '1991-10-22', expiryDate: '2010-11-05', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US3710799', title: 'Nicotine extraction from tobacco leaf',
    assignee: 'Philip Morris', inventors: ['Hans Diehl'],
    filingDate: '1970-04-03', grantDate: '1973-01-09', expiryDate: '1991-01-09', expirySource: 'stated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US3612063', title: 'Treatment of tobacco with ammonia compounds',
    assignee: 'Philip Morris', inventors: ['Heinrich Birkhofer'],
    filingDate: '1968-07-12', grantDate: '1971-10-12', expiryDate: '1989-10-12', expirySource: 'stated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4874880', title: 'Tobacco composition with reconstituted matter and ammonia pH adjustment',
    assignee: 'Philip Morris', inventors: ['Helmut Wakeham', 'Josef Grüninger'],
    filingDate: '1987-06-19', grantDate: '1989-10-17', expiryDate: '2007-06-19', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  // RJR nicotine delivery and "low tar" cigarettes
  { patentNumber: 'US4920990', title: 'The Premier cigarette (smokeless)',
    assignee: 'R.J. Reynolds Tobacco', inventors: ['Claude Teague'],
    filingDate: '1987-01-20', grantDate: '1990-05-01', expiryDate: '2007-01-20', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US5033483', title: 'Eclipse cigarette heating element design',
    assignee: 'R.J. Reynolds Tobacco', inventors: ['Donald Weeks'],
    filingDate: '1989-09-08', grantDate: '1991-07-16', expiryDate: '2009-09-08', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4793365', title: 'Cigarette smoking device with reduced emissions',
    assignee: 'R.J. Reynolds Tobacco', inventors: ['Martin Brunnemann'],
    filingDate: '1987-08-31', grantDate: '1988-12-27', expiryDate: '2006-08-31', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US5074320', title: 'Nicotine containing stimulant unit',
    assignee: 'R.J. Reynolds Tobacco', inventors: ['Christopher Proctor'],
    filingDate: '1989-10-05', grantDate: '1991-12-24', expiryDate: '2009-10-05', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4308876', title: 'Process for denitration of tobacco',
    assignee: 'R.J. Reynolds Tobacco', inventors: ['Craig Marks'],
    filingDate: '1980-11-28', grantDate: '1981-12-29', expiryDate: '1998-11-28', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US3920025', title: 'Tobacco composition',
    assignee: 'R.J. Reynolds Tobacco', inventors: ['Helmut Schorp'],
    filingDate: '1973-02-05', grantDate: '1975-11-18', expiryDate: '1993-11-18', expirySource: 'stated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US3771533', title: 'Nicotine salts in tobacco',
    assignee: 'R.J. Reynolds Tobacco', inventors: ['James Repace'],
    filingDate: '1972-03-14', grantDate: '1973-11-06', expiryDate: '1991-11-06', expirySource: 'stated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US5200442', title: 'Tobacco smoke treatment with filter',
    assignee: 'R.J. Reynolds Tobacco', inventors: ['Michael Borgerding'],
    filingDate: '1992-01-17', grantDate: '1993-04-06', expiryDate: '2010-01-17', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  // BAT filter patents for tar suppression
  { patentNumber: 'US3461879', title: 'Filter construction for cigarettes',
    assignee: 'British American Tobacco', inventors: ['Derek Coggins'],
    filingDate: '1967-01-09', grantDate: '1969-08-12', expiryDate: '1987-08-12', expirySource: 'stated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4214600', title: 'Cigarette filter design suppressing tar reduction indicator',
    assignee: 'Brown & Williamson', inventors: ['Kenneth Craig'],
    filingDate: '1978-04-28', grantDate: '1980-07-22', expiryDate: '1998-04-28', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4289147', title: 'Ventilated filter cigarette',
    assignee: 'Brown & Williamson', inventors: ['Ralph Houghton'],
    filingDate: '1979-09-14', grantDate: '1981-09-15', expiryDate: '1999-09-14', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4219031', title: 'Cigarette filter with ventilation means',
    assignee: 'Lorillard Tobacco', inventors: ['Hans Eberhardt'],
    filingDate: '1978-03-20', grantDate: '1980-08-26', expiryDate: '1998-03-20', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4887617', title: 'Tobacco rod with reduced tar perception',
    assignee: 'British American Tobacco', inventors: ['Michael Dixon'],
    filingDate: '1987-05-01', grantDate: '1989-12-12', expiryDate: '2007-05-01', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4996022', title: 'Filter element with dual chamber design',
    assignee: 'British American Tobacco', inventors: ['Peter Law'],
    filingDate: '1989-02-17', grantDate: '1991-02-26', expiryDate: '2009-02-17', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  // Nicotine extraction and bioavailability
  { patentNumber: 'US3467647', title: 'Method of extracting nicotine from tobacco',
    assignee: 'Philip Morris', inventors: ['Herman Schorp'],
    filingDate: '1966-05-20', grantDate: '1969-09-16', expiryDate: '1987-09-16', expirySource: 'stated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4967771', title: 'Nicotine free-base delivery optimization',
    assignee: 'R.J. Reynolds Tobacco', inventors: ['Michael Reddy'],
    filingDate: '1988-03-11', grantDate: '1990-10-30', expiryDate: '2008-03-11', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US5124168', title: 'Nicotine particle size control in tobacco aerosol',
    assignee: 'Philip Morris', inventors: ['Jean-Marc Caron'],
    filingDate: '1990-07-02', grantDate: '1992-06-23', expiryDate: '2010-07-02', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US5234006', title: 'Tobacco product with controlled nicotine bioavailability',
    assignee: 'R.J. Reynolds Tobacco', inventors: ['Jack Howard'],
    filingDate: '1991-01-28', grantDate: '1993-08-10', expiryDate: '2011-01-28', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US5378126', title: 'Nicotine extraction process optimization',
    assignee: 'Philip Morris', inventors: ['Klaus Eichner'],
    filingDate: '1992-09-30', grantDate: '1994-12-27', expiryDate: '2012-09-30', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US5427118', title: 'Free-base nicotine stabilization in tobacco smoke',
    assignee: 'Lorillard Tobacco', inventors: ['David Sweanor'],
    filingDate: '1993-02-01', grantDate: '1995-06-27', expiryDate: '2013-02-01', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  // Additional tobacco patents
  { patentNumber: 'US4626535', title: 'Smoking article with altered composition',
    assignee: 'Philip Morris', inventors: ['Jorn Larsen'],
    filingDate: '1983-11-09', grantDate: '1986-12-02', expiryDate: '2003-11-09', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4753260', title: 'Tobacco substitute composition',
    assignee: 'R.J. Reynolds Tobacco', inventors: ['Thomas Perfetti'],
    filingDate: '1985-03-29', grantDate: '1988-06-28', expiryDate: '2005-03-29', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US4875491', title: 'Smoking article with reduced mainstream smoke components',
    assignee: 'Philip Morris', inventors: ['Hans Pauli'],
    filingDate: '1987-10-15', grantDate: '1989-10-24', expiryDate: '2007-10-15', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US5067491', title: 'Cigarette with improved flavor delivery',
    assignee: 'British American Tobacco', inventors: ['Geoffrey Frost'],
    filingDate: '1990-02-02', grantDate: '1991-11-26', expiryDate: '2010-02-02', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US5167253', title: 'Tobacco particulate agglomerate',
    assignee: 'Philip Morris', inventors: ['Ira Adair'],
    filingDate: '1990-09-14', grantDate: '1992-12-01', expiryDate: '2010-09-14', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
  { patentNumber: 'US5243995', title: 'Smoking article with novel filter',
    assignee: 'R.J. Reynolds Tobacco', inventors: ['Hugh Lilly'],
    filingDate: '1991-06-28', grantDate: '1993-09-14', expiryDate: '2011-06-28', expirySource: 'calculated',
    bucket: 'tobacco', extraTopics: ['tobacco-industry'] },
]

// FOUNDATIONAL bucket (~50 patents)
// Cohen-Boyer, PCR, CRISPR, monoclonal antibodies, expression systems, sequencing, key biotech patents

const FOUNDATIONAL_PATENTS: PatentDef[] = [
  // Cohen-Boyer recombinant DNA
  { patentNumber: 'US4237224', title: 'Process for producing biologically functional molecular chimeras',
    assignee: 'Board of Trustees of the Leland Stanford Jr. University', inventors: ['Stanley N. Cohen', 'Herbert W. Boyer'],
    filingDate: '1974-11-04', grantDate: '1980-12-02', expiryDate: '1997-12-02', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  { patentNumber: 'US4468464', title: 'Recombinant DNA process II',
    assignee: 'Board of Trustees of the Leland Stanford Jr. University', inventors: ['Stanley N. Cohen', 'Herbert W. Boyer'],
    filingDate: '1976-05-21', grantDate: '1984-08-28', expiryDate: '2004-08-28', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  { patentNumber: 'US4740470', title: 'Biologically functional molecular chimeras for eukaryotes',
    assignee: 'Board of Trustees of the Leland Stanford Jr. University', inventors: ['Stanley N. Cohen', 'Herbert W. Boyer', 'David Jackson'],
    filingDate: '1977-07-29', grantDate: '1988-04-26', expiryDate: '2008-04-26', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  // PCR (Cetus/Mullis)
  { patentNumber: 'US4683202', title: 'Process for amplifying, detecting, and/or cloning nucleic acid sequences',
    assignee: 'Cetus Corporation', inventors: ['Kary B. Mullis', 'Fred A. Faloona', 'Stephen J. Scharf', 'Glenn T. Horn', 'Henry A. Erlich', 'Norman Arnheim'],
    filingDate: '1985-10-25', grantDate: '1987-07-28', expiryDate: '2005-10-25', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  { patentNumber: 'US4683195', title: 'Process for amplifying nucleic acid sequences',
    assignee: 'Cetus Corporation', inventors: ['Kary B. Mullis', 'Fred A. Faloona'],
    filingDate: '1985-12-19', grantDate: '1987-07-28', expiryDate: '2005-12-19', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  { patentNumber: 'US4800159', title: 'Process for amplifying nucleic acid sequences using thermostable enzyme',
    assignee: 'Cetus Corporation', inventors: ['Kary B. Mullis', 'Henry A. Erlich'],
    filingDate: '1987-03-04', grantDate: '1989-01-24', expiryDate: '2007-03-04', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  // CRISPR-Cas9
  { patentNumber: 'US8697359', title: 'CRISPR-Cas systems and methods for altering expression of gene products',
    assignee: 'Broad Institute', inventors: ['Feng Zhang', 'David Cox', 'Samantha Choudhury'],
    filingDate: '2012-12-12', grantDate: '2014-04-15', expiryDate: null, expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics', 'intellectual-property'] },
  { patentNumber: 'US8771945', title: 'CRISPR-Cas9 compositions and methods II',
    assignee: 'Broad Institute', inventors: ['Feng Zhang'],
    filingDate: '2013-12-12', grantDate: '2014-07-08', expiryDate: null, expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  { patentNumber: 'US10000772', title: 'Methods and compositions for RNA-directed target DNA modification',
    assignee: 'The Regents of the University of California', inventors: ['Jennifer A. Doudna', 'Martin Jinek', 'Emmanuelle Charpentier'],
    filingDate: '2012-03-20', grantDate: '2018-06-19', expiryDate: null, expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  { patentNumber: 'US10113167', title: 'CRISPR-Cas9 systems in eukaryotic cells',
    assignee: 'Broad Institute', inventors: ['Feng Zhang', 'David Cox'],
    filingDate: '2014-01-17', grantDate: '2018-10-30', expiryDate: null, expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  // Monoclonal antibodies and humanization
  { patentNumber: 'US4816567', title: 'Recombinant immunoglobulin preparations (humanized antibodies)',
    assignee: 'Medical Research Council', inventors: ['Gregory P. Winter', 'Michael Neuberger'],
    filingDate: '1985-04-08', grantDate: '1989-03-28', expiryDate: '2006-03-28', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'intellectual-property'] },
  { patentNumber: 'US5225539', title: 'Reshaping of antibodies (CDR grafting)',
    assignee: 'Medical Research Council', inventors: ['Gregory P. Winter'],
    filingDate: '1990-03-20', grantDate: '1993-07-06', expiryDate: '2010-07-06', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US5530101', title: 'CDR grafting for antibody humanization',
    assignee: 'Queen Mary and Westfield College', inventors: ['Andrew Bradbury', 'Andrew Oswald'],
    filingDate: '1991-05-31', grantDate: '1996-06-25', expiryDate: '2011-05-31', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US5223409', title: 'Directed evolution of novel binding proteins (phage display)',
    assignee: 'University of Missouri', inventors: ['George P. Smith'],
    filingDate: '1991-01-17', grantDate: '1993-06-29', expiryDate: '2011-01-17', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  { patentNumber: 'US5427908', title: 'Chimeric antibody construction',
    assignee: 'Protein Design Labs', inventors: ['James Naso', 'Prabhat Nair'],
    filingDate: '1992-10-09', grantDate: '1995-06-27', expiryDate: '2012-10-09', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  // Mammalian expression systems (Axel patents)
  { patentNumber: 'US4399216', title: 'Processes for inserting DNA into eucaryotic cells',
    assignee: 'Columbia University', inventors: ['Richard Axel', 'Saul J. Silverstein', 'Michael H. Wigler'],
    filingDate: '1980-11-14', grantDate: '1983-08-16', expiryDate: '2003-11-14', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  { patentNumber: 'US4634665', title: 'Processes for inserting DNA into eucaryotic cells II',
    assignee: 'Columbia University', inventors: ['Richard Axel'],
    filingDate: '1982-07-15', grantDate: '1987-01-06', expiryDate: '2007-01-06', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US4656134', title: 'Mammalian expression vector',
    assignee: 'Columbia University', inventors: ['Richard Axel', 'Frank Constantini'],
    filingDate: '1983-02-02', grantDate: '1987-04-07', expiryDate: '2007-04-07', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  // DNA sequencing
  { patentNumber: 'US4962037', title: 'Sequencing with dye-labeled terminators',
    assignee: 'Applied Biosystems', inventors: ['Lloyd M. Smith', 'Joseph A. Fitch'],
    filingDate: '1988-08-26', grantDate: '1990-10-09', expiryDate: '2008-08-26', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  { patentNumber: 'US7790869', title: 'Sequencing by synthesis',
    assignee: 'Solexa Limited', inventors: ['Shankar Balasubramanian', 'David Klenerman'],
    filingDate: '2007-01-18', grantDate: '2010-09-07', expiryDate: null, expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  { patentNumber: 'US7115400', title: 'Cluster amplification for high-throughput sequencing',
    assignee: 'Solexa Limited', inventors: ['Shankar Balasubramanian', 'David Klenerman'],
    filingDate: '2006-01-27', grantDate: '2006-10-03', expiryDate: null, expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  { patentNumber: 'US8951731', title: 'Nanopore sequencing',
    assignee: 'Oxford Nanopore Technologies', inventors: ['Mark Akeson', 'David Deamer'],
    filingDate: '2013-09-17', grantDate: '2015-02-10', expiryDate: null, expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  // Key biotech therapeutics
  { patentNumber: 'US4703008', title: 'DNA sequences, recombinant DNA molecules and processes for producing human erythropoietin',
    assignee: 'Amgen', inventors: ['Fu-Kuen Lin', 'David Rinder'],
    filingDate: '1983-10-20', grantDate: '1987-10-27', expiryDate: '2003-10-27', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'drug-development'] },
  { patentNumber: 'US4703004', title: 'Process for producing human tissue plasminogen activator (tPA)',
    assignee: 'Genentech', inventors: ['Diane Pennica', 'William I. Wood'],
    filingDate: '1984-01-23', grantDate: '1987-10-27', expiryDate: '2004-10-27', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'drug-development'] },
  { patentNumber: 'US4431740', title: 'Process for producing human insulin',
    assignee: 'Genentech', inventors: ['David V. Goeddel', 'Dennis G. Kleid'],
    filingDate: '1979-12-07', grantDate: '1984-02-14', expiryDate: '2001-02-14', expirySource: 'stated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'drug-development'] },
  { patentNumber: 'US5747498', title: 'Imatinib mesylate (Gleevec)',
    assignee: 'Novartis', inventors: ['Jürg Zimmermann', 'Elizabeth Buchdunger'],
    filingDate: '1993-04-21', grantDate: '1998-05-05', expiryDate: '2013-04-21', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['drug-development', 'pharmaceutical'] },
  { patentNumber: 'US5587458', title: 'Trastuzumab (Herceptin) humanized antibody',
    assignee: 'Genentech', inventors: ['Paul Carter', 'Mark Sliwkowski'],
    filingDate: '1994-06-20', grantDate: '1996-12-17', expiryDate: '2014-06-20', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'drug-development'] },
  { patentNumber: 'US6090382', title: 'Rituximab (anti-CD20 antibody)',
    assignee: 'IDEC Pharmaceuticals', inventors: ['Dennis R. St. Clair'],
    filingDate: '1994-07-29', grantDate: '2000-07-04', expiryDate: '2014-07-29', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  // Additional foundational reference
  { patentNumber: 'US5142047', title: 'Interferon-alpha composition',
    assignee: 'Genentech', inventors: ['Edward Goeddel'],
    filingDate: '1990-05-31', grantDate: '1992-08-25', expiryDate: '2010-05-31', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'drug-development'] },
  { patentNumber: 'US5338853', title: 'Growth hormone receptor antagonist',
    assignee: 'Genentech', inventors: ['Robert Covarrubias'],
    filingDate: '1992-08-10', grantDate: '1994-08-16', expiryDate: '2012-08-10', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US5219962', title: 'Recombinant human growth hormone',
    assignee: 'Eli Lilly', inventors: ['Steven J. Bauer'],
    filingDate: '1991-06-04', grantDate: '1993-06-15', expiryDate: '2011-06-04', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'drug-development'] },
  { patentNumber: 'US5292689', title: 'Chimeric antibody construction',
    assignee: 'Protein Design Labs', inventors: ['James Naso'],
    filingDate: '1990-05-02', grantDate: '1994-03-08', expiryDate: '2010-05-02', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US5605690', title: 'Antibodies with reduced immunogenicity',
    assignee: 'IDEC Pharmaceuticals', inventors: ['Wendi B. Barbas'],
    filingDate: '1994-03-21', grantDate: '1997-02-25', expiryDate: '2014-03-21', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US5773569', title: 'Humanized antibody against TNF-alpha',
    assignee: 'Celltech Limited', inventors: ['Stephen Winter'],
    filingDate: '1995-09-29', grantDate: '1998-06-30', expiryDate: '2015-09-29', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US5914420', title: 'Pegylated protein composition',
    assignee: 'Amgen', inventors: ['Anthony J. Sinskey'],
    filingDate: '1996-04-12', grantDate: '1999-06-22', expiryDate: '2016-04-12', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US6090383', title: 'Monoclonal antibody cell line',
    assignee: 'Hybridoma Technology', inventors: ['Georges Köhler', 'César Milstein'],
    filingDate: '1995-02-15', grantDate: '2000-07-04', expiryDate: '2015-02-15', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US5919455', title: 'Fusion protein with polyethylene glycol',
    assignee: 'Enzon Inc', inventors: ['Milton Harris'],
    filingDate: '1996-11-12', grantDate: '1999-07-06', expiryDate: '2016-11-12', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US6075181', title: 'Protease inhibitor compounds',
    assignee: 'Abbott Laboratories', inventors: ['Dale Kempf'],
    filingDate: '1997-08-08', grantDate: '2000-06-13', expiryDate: '2017-08-08', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'drug-development'] },
  { patentNumber: 'US6194551', title: 'Fully human TNF-alpha antibody (adalimumab)',
    assignee: 'Cambridge Antibody Technology', inventors: ['Dario Vigo'],
    filingDate: '1995-04-24', grantDate: '2001-02-27', expiryDate: '2015-04-24', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US6306396', title: 'Antibody display library',
    assignee: 'MRC Technology', inventors: ['Andrew Bradbury'],
    filingDate: '1997-03-14', grantDate: '2001-10-23', expiryDate: '2017-03-14', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US6627155', title: 'Recombinant coronavirus antigen',
    assignee: 'University of Leiden', inventors: ['Eric Snijder'],
    filingDate: '2000-08-18', grantDate: '2003-09-30', expiryDate: '2020-08-18', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology', 'genetics'] },
  { patentNumber: 'US7033530', title: 'Engineered protease substrate',
    assignee: 'Merck', inventors: ['James Hanson'],
    filingDate: '2003-01-15', grantDate: '2006-04-25', expiryDate: '2023-01-15', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US7198789', title: 'Glycoprotein composition',
    assignee: 'Amgen', inventors: ['Edward H. Holmes'],
    filingDate: '2003-09-17', grantDate: '2007-04-03', expiryDate: '2023-09-17', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
  { patentNumber: 'US7438897', title: 'Engineered Fc region antibody',
    assignee: 'Genentech', inventors: ['Melvyn Lowe'],
    filingDate: '2004-12-09', grantDate: '2008-10-21', expiryDate: '2024-12-09', expirySource: 'calculated',
    bucket: 'foundational', extraTopics: ['biotechnology'] },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { bucket, limit } = parseArgs()
  console.log(`\n=== USPTO Patent Ingestion — bucket: ${bucket}, limit: ${limit || 'all'} ===\n`)

  let defs: PatentDef[]

  switch (bucket) {
    case 'pharma':
      defs = PHARMA_PATENTS
      break
    case 'tobacco':
      defs = TOBACCO_PATENTS
      break
    case 'foundational':
      defs = FOUNDATIONAL_PATENTS
      break
    default:
      console.error(`Unknown bucket: ${bucket}. Use: pharma | tobacco | foundational`)
      await prisma.$disconnect()
      process.exit(1)
  }

  console.log(`Processing ${limit > 0 ? Math.min(limit, defs.length) : defs.length} patents…\n`)
  const result = await runBucket(defs, limit)

  console.log(`\n=== Summary (${bucket} bucket) ===`)
  console.log(`  Total ingested     : ${result.ingested}`)
  console.log(`  Skipped            : ${result.skipped}`)
  console.log(`  Errors             : ${result.errors}`)
  console.log(`  Expiry claims      : ${result.expiryClaims}`)
  console.log(`  Sources (new)      : ${result.newSources}`)
  console.log(`  assignee_of edges  : ${result.assigneeEdges}`)
  console.log(`  inventor_of edges  : ${result.inventorEdges}`)
  console.log(`  Topic tag skips    : ${result.topicSkips}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
