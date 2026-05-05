// NCBI / GenBank nucleotide sequence ingestion — genetic sequence layer
// No CITES cross-references — ingesters produce facts, humans curate connections
// Docs: https://www.ncbi.nlm.nih.gov/books/NBK25500/
// Run: npx tsx scripts/ingest-genbank.ts --bucket [pandemic|pathogens|reference|genes] --limit N

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NCBISummaryDoc {
  uid: string
  caption: string           // base accession without version suffix
  accessionversion: string  // full accession e.g. MN908947.3
  title: string
  organism: string
  slen: number              // sequence length in bp
  createdate: string        // YYYY/MM/DD
  biomol: string
}

interface AccessionDef {
  accession: string
  extraTopics: string[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts      = { ingested: number; skipped: number; errors: number }

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { bucket: string; limit: number } {
  const args = process.argv.slice(2)
  const bi = args.indexOf('--bucket')
  const li = args.indexOf('--limit')
  return {
    bucket: bi !== -1 ? (args[bi + 1] ?? 'pandemic') : 'pandemic',
    limit:  li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
  }
}

// ── Rate limiting — 3 req/sec without API key ─────────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 350  // ms → ~2.8 req/sec

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

// ── HTTP with retry ───────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  let delay = 1000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url)
    if ([502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    return res
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── NCBI E-utilities ──────────────────────────────────────────────────────────

async function fetchSummary(accession: string): Promise<NCBISummaryDoc | null> {
  const url = `${NCBI_BASE}/esummary.fcgi?db=nuccore&id=${encodeURIComponent(accession)}&retmode=json`
  const res = await fetchWithRetry(url)
  if (!res.ok) { console.warn(`  NCBI ${res.status}: ${accession}`); return null }
  const data = await res.json() as { result?: Record<string, unknown> }
  const result = data.result
  if (!result) return null
  const uids = result['uids'] as string[] | undefined
  if (!uids?.length) { console.warn(`  No record found: ${accession}`); return null }
  const doc = result[uids[0]] as NCBISummaryDoc | undefined
  if (!doc || typeof doc !== 'object' || !doc.accessionversion) {
    console.warn(`  Invalid NCBI response: ${accession}`)
    return null
  }
  return doc
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseNCBIDate(s: string): Date | null {
  if (!s) return null
  const parts = s.split('/')
  const iso = parts.length >= 3 ? `${parts[0]}-${parts[1]}-${parts[2]}`
    : parts.length === 2 ? `${parts[0]}-${parts[1]}-01`
    : `${parts[0]}-01-01`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function formatNCBIDate(ncbiDate: string): string {
  const parts = ncbiDate.split('/')
  if (parts.length >= 2) {
    const m = parseInt(parts[1], 10)
    if (m >= 1 && m <= 12) return `${MONTHS[m - 1]} ${parts[0]}`
  }
  return parts[0] ?? ncbiDate
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

async function ensureCoreTopics() {
  const genetics   = await ensureTopic('genetics', 'Genetics', 'genetics')
  const genomeSeqs = await ensureTopic('genome-sequences', 'Genome Sequences', 'genetics', 'genetics')
  const pathogens  = await ensureTopic('pathogens', 'Pathogens', 'genetics', 'genetics')
  return { genetics, genomeSeqs, pathogens }
}

async function findTopic(slug: string): Promise<string | null> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const t = await prisma.topic.findUnique({ where: { slug } })
  if (t) { topicCache.set(slug, t.id); return t.id }
  return null
}

async function tagClaim(claimId: string, topicIds: string[]): Promise<void> {
  for (const topicId of topicIds) {
    await prisma.claimTopic.upsert({
      where:  { claimId_topicId: { claimId, topicId } },
      update: {},
      create: { claimId, topicId },
    })
  }
}

// ── Core: ingest one GenBank record ──────────────────────────────────────────

async function ingestAccession(
  accession: string,
  extraTopicIds: string[],
  coreTopicIds: string[],
): Promise<IngestResult> {
  const baseAccession = accession.split('.')[0]
  const externalId    = `genbank_${baseAccession}`

  const existing = await prisma.claim.findUnique({ where: { externalId } })
  if (existing) { console.log(`  Skipped (exists): ${baseAccession}`); return 'skipped' }

  const doc = await fetchSummary(accession)
  if (!doc) return 'skipped'

  if (!doc.organism?.trim()) {
    console.warn(`  Skipped (no organism): ${accession}`)
    return 'skipped'
  }
  if (!doc.slen || doc.slen <= 0) {
    console.warn(`  Skipped (zero length): ${accession}`)
    return 'skipped'
  }
  const submittedDate = parseNCBIDate(doc.createdate)
  if (!submittedDate) {
    console.warn(`  Skipped (bad date): ${accession} — "${doc.createdate}"`)
    return 'skipped'
  }

  const accVersion  = doc.accessionversion
  const bpFormatted = doc.slen.toLocaleString()
  const claimText   = `GenBank record ${accVersion} deposits the genome sequence of ${doc.organism}, sequence length ${bpFormatted} base pairs, submitted ${formatNCBIDate(doc.createdate)}.`

  try {
    const { claimId } = await prisma.$transaction(async tx => {
      const source = await tx.source.create({
        data: {
          name:            `GenBank ${accVersion}`,
          url:             `https://www.ncbi.nlm.nih.gov/nuccore/${baseAccession}`,
          publishedAt:     submittedDate,
          methodologyType: 'primary',
          ingestedBy:      'genbank_v1',
          humanReviewed:   false,
          autoApproved:    true,
          externalId:      `genbank_source_${baseAccession}`,
        },
      })

      const claim = await tx.claim.create({
        data: {
          text:                  claimText,
          claimType:             'EMPIRICAL',
          currentStatus:         'HARD_FACT',
          claimEmergedAt:        submittedDate,
          claimEmergedPrecision: 'DAY',
          ingestedBy:            'genbank_v1',
          humanReviewed:         false,
          autoApproved:          true,
          externalId,
        },
      })

      const edge = await tx.edge.create({
        data: {
          sourceId:      source.id,
          claimId:       claim.id,
          type:          'FOR',
          evidenceType:  'EVIDENTIARY',
          ingestedBy:    'genbank_v1',
          humanReviewed: false,
          autoApproved:  true,
        },
      })

      await tx.edgeRevision.create({
        data: {
          edgeId:     edge.id,
          priorScore: null,
          newScore:   95,
          reason:     'GenBank institutional record — nucleotide sequence as physical HARD_FACT',
          changedAt:  submittedDate,
        },
      })

      return { claimId: claim.id }
    })

    await tagClaim(claimId, [...coreTopicIds, ...extraTopicIds])
    console.log(`  Ingested: ${accVersion} — ${doc.organism} (${bpFormatted} bp)`)
    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: ${accession} — ${msg}`)
    return 'failed'
  }
}

// ── Bucket runner ─────────────────────────────────────────────────────────────

async function runBucket(defs: AccessionDef[], limit: number, coreTopicIds: string[]): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const pool = limit > 0 ? defs.slice(0, limit) : defs
  const seen = new Set<string>()

  for (const def of pool) {
    const base = def.accession.split('.')[0]
    if (seen.has(base)) continue
    seen.add(base)

    const extraIds: string[] = []
    for (const slug of def.extraTopics) {
      const id = await findTopic(slug)
      if (id) extraIds.push(id)
      else console.warn(`  Warning: topic '${slug}' not found — skipping tag`)
    }

    const result = await ingestAccession(def.accession, extraIds, coreTopicIds)
    if (result === 'ingested') counts.ingested++
    else if (result === 'skipped') counts.skipped++
    else counts.errors++
  }

  return counts
}

// ── Bucket data ───────────────────────────────────────────────────────────────

// pandemic: SARS-CoV-2 reference, bat sarbecoviruses central to lab-leak debate,
// SARS-CoV-1, MERS-CoV, and common cold coronaviruses as comparison baseline
const PANDEMIC_SEQS: AccessionDef[] = [
  { accession: 'MN908947',  extraTopics: ['pandemic-origins'] }, // SARS-CoV-2 Wuhan-Hu-1 reference
  { accession: 'MT019529',  extraTopics: ['pandemic-origins'] }, // SARS-CoV-2 USA-WA1/2020 (first US case)
  { accession: 'MT012098',  extraTopics: ['pandemic-origins'] }, // early Wuhan isolate
  { accession: 'MN996532',  extraTopics: ['pandemic-origins'] }, // RaTG13 (WIV; 96.2% identity to SARS-CoV-2)
  { accession: 'MZ937000',  extraTopics: ['pandemic-origins'] }, // BANAL-52 (Pasteur/Laos; 96.8% identity)
  { accession: 'MZ937001',  extraTopics: ['pandemic-origins'] }, // BANAL-103
  { accession: 'MZ937002',  extraTopics: ['pandemic-origins'] }, // BANAL-236
  { accession: 'KT444582',  extraTopics: ['pandemic-origins'] }, // WIV16 bat sarbecovirus (Shi lab)
  { accession: 'KF367457',  extraTopics: ['pandemic-origins'] }, // WIV1 bat coronavirus (Shi lab)
  { accession: 'MG772933',  extraTopics: ['pandemic-origins'] }, // ZC45 bat betacoronavirus
  { accession: 'MG772934',  extraTopics: ['pandemic-origins'] }, // ZXC21 bat betacoronavirus
  { accession: 'KC881005',  extraTopics: ['pandemic-origins'] }, // SHC014 (UNC/Baric chimeric backbone)
  { accession: 'NC_004718', extraTopics: ['pandemic-origins'] }, // SARS-CoV-1 reference (2003)
  { accession: 'AY278741',  extraTopics: ['pandemic-origins'] }, // SARS-CoV Urbani isolate 2003
  { accession: 'NC_019843', extraTopics: ['pandemic-origins'] }, // MERS-CoV reference
  { accession: 'AF304460',  extraTopics: [] },                   // HCoV-229E common cold
  { accession: 'AY567487',  extraTopics: [] },                   // HCoV-NL63 common cold
  { accession: 'AY391777',  extraTopics: [] },                   // HCoV-OC43 common cold
  { accession: 'NC_006577', extraTopics: [] },                   // HCoV-HKU1 common cold
]

// pathogens: HIV, influenza, filoviruses, flaviviruses, poxviruses, hepatitis,
// bacterial pathogens, and historically significant viruses
const PATHOGEN_SEQS: AccessionDef[] = [
  { accession: 'K03455',    extraTopics: ['epidemiology'] }, // HIV-1 HXB2 reference
  { accession: 'M30502',    extraTopics: ['epidemiology'] }, // HIV-2
  { accession: 'NC_001436', extraTopics: ['epidemiology'] }, // HTLV-1
  { accession: 'AF117241',  extraTopics: ['epidemiology'] }, // Influenza H1N1 1918 hemagglutinin (Spanish flu)
  { accession: 'CY083972',  extraTopics: ['epidemiology'] }, // Influenza H1N1 2009 pandemic
  { accession: 'CY018920',  extraTopics: ['epidemiology'] }, // Influenza A H3N2
  { accession: 'DQ497692',  extraTopics: ['epidemiology'] }, // Influenza H5N1 avian
  { accession: 'AF086833',  extraTopics: ['epidemiology'] }, // Ebola Zaire 1976 (first outbreak)
  { accession: 'NC_006432', extraTopics: ['epidemiology'] }, // Sudan ebolavirus
  { accession: 'NC_001608', extraTopics: ['epidemiology'] }, // Marburg virus
  { accession: 'KU321639',  extraTopics: ['epidemiology'] }, // Zika virus (2015 outbreak)
  { accession: 'NC_001477', extraTopics: ['epidemiology'] }, // Dengue serotype 1
  { accession: 'NC_001474', extraTopics: ['epidemiology'] }, // Dengue serotype 2
  { accession: 'NC_002031', extraTopics: ['epidemiology'] }, // Yellow fever virus
  { accession: 'NC_009942', extraTopics: ['epidemiology'] }, // West Nile virus
  { accession: 'NC_004162', extraTopics: ['epidemiology'] }, // Chikungunya virus
  { accession: 'NC_001611', extraTopics: ['epidemiology'] }, // Variola major (smallpox)
  { accession: 'NC_003310', extraTopics: ['epidemiology'] }, // Monkeypox (mpox)
  { accession: 'V01149',    extraTopics: ['epidemiology'] }, // Poliovirus type 1 Mahoney
  { accession: 'NC_001489', extraTopics: ['epidemiology'] }, // Hepatitis A
  { accession: 'NC_003977', extraTopics: ['epidemiology'] }, // Hepatitis B
  { accession: 'NC_004102', extraTopics: ['epidemiology'] }, // Hepatitis C
  { accession: 'NC_001434', extraTopics: ['epidemiology'] }, // Hepatitis E
  { accession: 'NC_001498', extraTopics: ['epidemiology'] }, // Measles virus
  { accession: 'NC_002200', extraTopics: ['epidemiology'] }, // Mumps virus
  { accession: 'NC_001545', extraTopics: ['epidemiology'] }, // Rubella virus
  { accession: 'NC_001542', extraTopics: ['epidemiology'] }, // Rabies virus
  { accession: 'AL123456',  extraTopics: ['epidemiology'] }, // M. tuberculosis H37Rv (Cole et al. 1998)
  { accession: 'AE016879',  extraTopics: ['epidemiology'] }, // Bacillus anthracis Ames (anthrax)
  { accession: 'AL590842',  extraTopics: ['epidemiology'] }, // Yersinia pestis CO92 (plague)
  { accession: 'AE003852',  extraTopics: ['epidemiology'] }, // Vibrio cholerae O1 El Tor
  { accession: 'BX571856',  extraTopics: ['epidemiology'] }, // S. aureus MRSA252
  { accession: 'AM180355',  extraTopics: ['epidemiology'] }, // Clostridioides difficile 630
  { accession: 'NC_004325', extraTopics: ['epidemiology'] }, // Plasmodium falciparum chr 1 (malaria)
  { accession: 'NC_001367', extraTopics: [] },               // Tobacco mosaic virus (first virus discovered, 1892)
]

// reference: key model organisms, selected human genome chromosomes,
// agricultural species, and molecular biology workhorses
const REFERENCE_SEQS: AccessionDef[] = [
  { accession: 'NC_000001', extraTopics: [] }, // Homo sapiens chr 1 (GRCh38)
  { accession: 'NC_000007', extraTopics: [] }, // Homo sapiens chr 7 (CFTR locus)
  { accession: 'NC_000013', extraTopics: [] }, // Homo sapiens chr 13 (BRCA2, RB1)
  { accession: 'NC_000017', extraTopics: [] }, // Homo sapiens chr 17 (BRCA1, TP53, HER2)
  { accession: 'NC_000023', extraTopics: [] }, // Homo sapiens chr X
  { accession: 'NC_000024', extraTopics: [] }, // Homo sapiens chr Y
  { accession: 'NC_012920', extraTopics: [] }, // Homo sapiens mitochondrial genome (rCRS)
  { accession: 'U00096',    extraTopics: [] }, // E. coli K-12 MG1655 complete genome (Blattner 1997)
  { accession: 'BK006935',  extraTopics: [] }, // S. cerevisiae chr I (first eukaryote chromosome sequenced)
  { accession: 'BX284601',  extraTopics: [] }, // C. elegans chr I (Nobel organism)
  { accession: 'AE014134',  extraTopics: [] }, // D. melanogaster chr 2L
  { accession: 'NC_000086', extraTopics: [] }, // Mus musculus chr X
  { accession: 'NC_007112', extraTopics: [] }, // Danio rerio (zebrafish) chr 1
  { accession: 'NC_003070', extraTopics: [] }, // Arabidopsis thaliana chr 1 (model plant)
  { accession: 'NC_008394', extraTopics: [] }, // Oryza sativa (rice) chr 1
  { accession: 'NC_000964', extraTopics: [] }, // Bacillus subtilis 168 (model gram-positive)
  { accession: 'AE000657',  extraTopics: [] }, // Helicobacter pylori 26695 (Nobel 2005 — ulcers)
  { accession: 'NC_001416', extraTopics: [] }, // Lambda phage (ubiquitous cloning vector)
  { accession: 'NC_001401', extraTopics: [] }, // Adeno-associated virus 2 (AAV2 — gene therapy)
]

// genes: pharmacologically and case-study relevant mRNA / gene sequences
const GENE_SEQS: AccessionDef[] = [
  { accession: 'NM_021804', extraTopics: ['pandemic-origins'] },                // ACE2 (SARS-CoV-2 receptor)
  { accession: 'NM_002062', extraTopics: ['drug-approval', 'medicine'] },       // GLP1R (Ozempic/semaglutide target)
  { accession: 'NM_000546', extraTopics: ['epidemiology'] },                    // TP53 (most-mutated cancer gene)
  { accession: 'NM_007294', extraTopics: ['drug-approval', 'epidemiology'] },   // BRCA1
  { accession: 'NM_000059', extraTopics: ['drug-approval', 'epidemiology'] },   // BRCA2
  { accession: 'NM_000314', extraTopics: ['epidemiology'] },                    // PTEN (tumor suppressor)
  { accession: 'NM_004333', extraTopics: ['drug-approval'] },                   // BRAF (melanoma — vemurafenib)
  { accession: 'NM_004985', extraTopics: ['drug-approval'] },                   // KRAS (lung/pancreatic cancer)
  { accession: 'NM_005228', extraTopics: ['drug-approval'] },                   // EGFR (lung cancer — erlotinib)
  { accession: 'NM_004448', extraTopics: ['drug-approval'] },                   // HER2/ERBB2 (breast cancer — trastuzumab)
  { accession: 'NM_000633', extraTopics: ['drug-approval'] },                   // BCL2 (venetoclax target)
  { accession: 'NM_005157', extraTopics: ['drug-approval'] },                   // ABL1 (CML — imatinib target)
  { accession: 'NM_000321', extraTopics: ['epidemiology'] },                    // RB1 (retinoblastoma)
  { accession: 'NM_017460', extraTopics: ['drug-approval', 'medicine'] },       // CYP3A4 (metabolizes ~50% of drugs)
  { accession: 'NM_000106', extraTopics: ['drug-approval', 'medicine'] },       // CYP2D6 (codeine/opioid metabolism)
  { accession: 'NM_000771', extraTopics: ['drug-approval', 'medicine'] },       // CYP2C9 (warfarin metabolism)
  { accession: 'NM_000769', extraTopics: ['drug-approval', 'medicine'] },       // CYP2C19 (omeprazole metabolism)
  { accession: 'NM_174936', extraTopics: ['drug-approval', 'medicine'] },       // PCSK9 (evolocumab target)
  { accession: 'NM_000041', extraTopics: ['medicine'] },                        // APOE (Alzheimer's risk)
  { accession: 'NM_000492', extraTopics: ['drug-approval'] },                   // CFTR (cystic fibrosis — ivacaftor)
  { accession: 'NM_002111', extraTopics: ['epidemiology'] },                    // HTT (Huntington's disease)
  { accession: 'NM_002024', extraTopics: ['epidemiology'] },                    // FMR1 (Fragile X syndrome)
  { accession: 'NM_006920', extraTopics: ['drug-approval'] },                   // SCN1A (Dravet syndrome)
  { accession: 'NM_004006', extraTopics: ['drug-approval'] },                   // DMD (Duchenne muscular dystrophy)
  { accession: 'NM_000594', extraTopics: ['medicine'] },                        // TNF (RA — adalimumab target)
  { accession: 'NM_000600', extraTopics: ['medicine'] },                        // IL6 (tocilizumab target)
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { bucket, limit } = parseArgs()
  console.log(`\n=== GenBank Ingestion — bucket: ${bucket}, limit: ${limit || 'all'} ===\n`)

  const { genetics, genomeSeqs, pathogens: pathogensTopic } = await ensureCoreTopics()

  let defs: AccessionDef[]
  let coreTopicIds: string[]

  switch (bucket) {
    case 'pandemic':
      defs = PANDEMIC_SEQS
      // pandemic bucket: core genetics + pathogens (pandemic-origins tagged per-record)
      coreTopicIds = [genetics, genomeSeqs, pathogensTopic]
      break
    case 'pathogens':
      defs = PATHOGEN_SEQS
      // pathogen bucket: core genetics + pathogens (epidemiology tagged per-record)
      coreTopicIds = [genetics, genomeSeqs, pathogensTopic]
      break
    case 'reference':
      defs = REFERENCE_SEQS
      // reference organisms: core genetics only (no pathogens tag)
      coreTopicIds = [genetics, genomeSeqs]
      break
    case 'genes':
      defs = GENE_SEQS
      // genes bucket: core genetics (additional topics tagged per-record)
      coreTopicIds = [genetics, genomeSeqs]
      break
    default:
      console.error(`Unknown bucket: ${bucket}. Use: pandemic | pathogens | reference | genes`)
      await prisma.$disconnect()
      process.exit(1)
  }

  console.log(`Processing ${limit > 0 ? Math.min(limit, defs.length) : defs.length} accessions…\n`)
  const result = await runBucket(defs, limit, coreTopicIds)

  console.log(`\n=== Summary ===`)
  console.log(`  Ingested : ${result.ingested}`)
  console.log(`  Skipped  : ${result.skipped}`)
  console.log(`  Errors   : ${result.errors}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
