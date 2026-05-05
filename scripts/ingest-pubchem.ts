// PubChem chemistry bedrock ingestion — Phase 2 hard-fact substrate
// Docs: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
// Run: npx tsx scripts/ingest-pubchem.ts --bucket [reference|pharma|case-study] --limit N

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const PUBCHEM_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PubChemProps {
  CID: number
  MolecularFormula: string
  IUPACName: string
  MolecularWeight: string
  InChIKey: string
}

interface CompoundDef {
  cid?: number     // hardcoded for reference bucket — avoids name-lookup ambiguity
  name: string     // common name used in claim text and for lookup if cid absent
  extraTopics?: string[]  // topic slugs beyond chemistry + chemical-compounds
}

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs(): { bucket: string; limit: number } {
  const args = process.argv.slice(2)
  const bucketIdx = args.indexOf('--bucket')
  const limitIdx  = args.indexOf('--limit')
  const bucket = bucketIdx !== -1 ? (args[bucketIdx + 1] ?? 'reference') : 'reference'
  const limit  = limitIdx  !== -1 ? (parseInt(args[limitIdx + 1] ?? '0', 10) || 0) : 0
  return { bucket, limit }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// PubChem allows 5 req/sec / 400 req/min. We target 4/sec to stay safe.

let lastReqAt = 0
const MIN_INTERVAL = 250  // ms

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

// ── HTTP with retry ───────────────────────────────────────────────────────────
// 502/503/504: exponential backoff, max 3 retries (same pattern as SCOTUS ingester)

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

// ── PubChem API ───────────────────────────────────────────────────────────────

async function fetchProperties(cid: number): Promise<PubChemProps | null> {
  const url = `${PUBCHEM_BASE}/compound/cid/${cid}/property/MolecularFormula,IUPACName,MolecularWeight,InChIKey/JSON`
  const res = await fetchWithRetry(url)
  if (!res.ok) return null
  const data = await res.json() as { PropertyTable?: { Properties?: PubChemProps[] } }
  return data.PropertyTable?.Properties?.[0] ?? null
}

async function fetchCAS(cid: number): Promise<string | null> {
  const url = `${PUBCHEM_BASE}/compound/cid/${cid}/xrefs/RegistryID/JSON`
  const res = await fetchWithRetry(url)
  if (!res.ok) return null
  const data = await res.json() as {
    InformationList?: { Information?: Array<{ RegistryID?: string[] }> }
  }
  const ids = data.InformationList?.Information?.[0]?.RegistryID ?? []
  return ids.find(id => /^\d{1,7}-\d{2}-\d$/.test(id)) ?? null
}

async function fetchDepositDate(cid: number): Promise<Date | null> {
  const url = `${PUBCHEM_BASE}/compound/cid/${cid}/dates/JSON`
  const res = await fetchWithRetry(url)
  if (!res.ok) return null
  const data = await res.json() as {
    InformationList?: { Information?: Array<{ DateDeposited?: string }> }
  }
  const raw = data.InformationList?.Information?.[0]?.DateDeposited
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

async function resolveName(name: string): Promise<number | null> {
  const url = `${PUBCHEM_BASE}/compound/name/${encodeURIComponent(name)}/cids/JSON`
  const res = await fetchWithRetry(url)
  if (!res.ok) return null
  const data = await res.json() as { IdentifierList?: { CID?: number[] } }
  return data.IdentifierList?.CID?.[0] ?? null
}

// ── Validation ────────────────────────────────────────────────────────────────

function isValidFormula(f: string): boolean {
  return /^[A-Za-z0-9()[\].+\-]+$/.test(f) && /[A-Z]/.test(f)
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache: Map<string, string> = new Map()

async function ensureTopic(
  slug: string, name: string, domain: string, parentSlug?: string
): Promise<string> {
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

async function ensureCoreTopics(): Promise<{ chemistry: string; compounds: string }> {
  const chemistry = await ensureTopic('chemistry', 'Chemistry', 'chemistry')
  const compounds = await ensureTopic('chemical-compounds', 'Chemical Compounds', 'chemistry', 'chemistry')
  return { chemistry, compounds }
}

async function tagClaim(claimId: string, topicIds: string[]): Promise<void> {
  for (const topicId of topicIds) {
    await prisma.claimTopic.upsert({
      where: { claimId_topicId: { claimId, topicId } },
      update: {},
      create: { claimId, topicId },
    })
  }
}

// ── Core: ingest one compound ─────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'

async function ingestCompound(
  cid: number,
  commonName: string,
  extraTopicIds: string[],
  coreTopicIds: string[],
): Promise<IngestResult> {
  const externalId = `pubchem_cid_${cid}`

  const existing = await prisma.claim.findUnique({ where: { externalId } })
  if (existing) {
    console.log(`  Skipped (exists): CID ${cid} — ${commonName}`)
    return 'skipped'
  }

  const props = await fetchProperties(cid)
  if (!props || !isValidFormula(props.MolecularFormula)) {
    console.warn(`  Skipped (invalid props): CID ${cid} — ${commonName}`)
    return 'skipped'
  }

  const cas  = await fetchCAS(cid)
  const date = await fetchDepositDate(cid)

  const casStr = cas ? ` (CAS ${cas})` : ''
  const claimText = `${commonName} has molecular formula ${props.MolecularFormula}${casStr}.`
  const sourceUrl = `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`

  try {
    await prisma.$transaction(async tx => {
      const source = await tx.source.create({
        data: {
          name: `PubChem CID ${cid}`,
          url: sourceUrl,
          publishedAt: date,
          methodologyType: 'primary',
          ingestedBy: 'pubchem_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId: `pubchem_source_${cid}`,
        },
      })

      const claim = await tx.claim.create({
        data: {
          text: claimText,
          claimType: 'EMPIRICAL',
          currentStatus: 'HARD_FACT',
          claimEmergedAt: date,
          claimEmergedPrecision: date ? 'DAY' : null,
          ingestedBy: 'pubchem_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId,
        },
      })

      const edge = await tx.edge.create({
        data: {
          sourceId: source.id,
          claimId: claim.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: 'pubchem_v1',
          humanReviewed: false,
          autoApproved: true,
        },
      })

      // Score 95 — PubChem is a direct primary source for a chemistry fact
      await tx.edgeRevision.create({
        data: {
          edgeId: edge.id,
          priorScore: null,
          newScore: 95,
          reason: 'PubChem institutional record — molecular formula as physical chemistry HARD_FACT',
          changedAt: date ?? new Date(),
        },
      })
    })

    const created = await prisma.claim.findUnique({ where: { externalId } })
    if (created) {
      await tagClaim(created.id, [...coreTopicIds, ...extraTopicIds])
    }

    console.log(`  Ingested: CID ${cid} — ${commonName} (${props.MolecularFormula})`)
    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: CID ${cid} — ${msg}`)
    return 'failed'
  }
}

// ── Pharma cross-reference ────────────────────────────────────────────────────
// For each FDA claim: look up the active ingredient in PubChem, ingest the
// chemistry HARD_FACT, and add a CITES edge from the FDA source to the new claim.

function extractGenericName(claimText: string): string | null {
  // "SEMAGLUTIDE (brand: OZEMPIC) demonstrated..." → "SEMAGLUTIDE"
  // "WARFARIN demonstrated sufficient..." → "WARFARIN"
  const m = claimText.match(/^(.+?)(?:\s*\(brand:|\s+demonstrated\s)/i)
  return m ? m[1].trim() : null
}

// openFDA generic names arrive ALL CAPS. Sentence-case for claim text readability.
// "SEMAGLUTIDE" → "Semaglutide", "SODIUM CHLORIDE" → "Sodium chloride"
function toSentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

async function runPharmaBucket(
  limit: number,
  coreTopicIds: string[],
  drugApprovalTopicId: string | null,
): Promise<{ ingested: number; skipped: number; errors: number }> {
  const counts = { ingested: 0, skipped: 0, errors: 0 }

  const fdaClaims = await prisma.claim.findMany({
    where: { ingestedBy: 'openfda_v1', deleted: false },
    include: {
      edges: { where: { ingestedBy: 'openfda_v1' }, include: { source: true }, take: 1 },
    },
    ...(limit > 0 ? { take: limit } : {}),
  })

  console.log(`  Found ${fdaClaims.length} FDA claims to cross-reference\n`)

  for (const fdaClaim of fdaClaims) {
    const genericName = await extractGenericName(fdaClaim.text)
    if (!genericName) {
      console.log(`  Skipped (no generic name): ${fdaClaim.id}`)
      counts.skipped++
      continue
    }

    const cid = await resolveName(genericName)
    if (!cid) {
      console.log(`  No PubChem match: ${genericName}`)
      counts.skipped++
      continue
    }

    const extraTopics = drugApprovalTopicId ? [drugApprovalTopicId] : []
    const result = await ingestCompound(cid, toSentenceCase(genericName), extraTopics, coreTopicIds)

    if (result === 'failed') { counts.errors++; continue }
    if (result === 'ingested') counts.ingested++
    else counts.skipped++

    // Wire CITES edge: FDA approval letter source → PubChem chemistry claim
    const fdaSource = fdaClaim.edges[0]?.source
    if (!fdaSource) continue

    const pubchemClaim = await prisma.claim.findUnique({
      where: { externalId: `pubchem_cid_${cid}` },
    })
    if (!pubchemClaim) continue

    // Check if CITES edge already exists
    const existingCites = await prisma.edge.findFirst({
      where: { sourceId: fdaSource.id, claimId: pubchemClaim.id, type: 'CITES' },
    })
    if (existingCites) continue

    try {
      const cites = await prisma.edge.create({
        data: {
          sourceId: fdaSource.id,
          claimId: pubchemClaim.id,
          type: 'CITES',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: 'pubchem_v1',
          humanReviewed: false,
          autoApproved: true,
        },
      })
      await prisma.edgeRevision.create({
        data: {
          edgeId: cites.id,
          priorScore: null,
          newScore: 80,
          reason: 'FDA approval document cites this compound as active pharmaceutical ingredient',
          changedAt: fdaSource.publishedAt ?? new Date(),
        },
      })
      console.log(`    + CITES edge: ${fdaSource.name} → CID ${cid}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`    Warning: failed to create CITES edge — ${msg}`)
    }
  }

  return counts
}

// ── Bucket data ───────────────────────────────────────────────────────────────

// Reference: ~200 textbook compounds. CIDs are hardcoded for lookup reliability.
// PubChem CIDs are stable unique identifiers.
const REFERENCE_COMPOUNDS: CompoundDef[] = [
  // Inorganic
  { cid: 962,     name: 'water' },
  { cid: 280,     name: 'carbon dioxide' },
  { cid: 977,     name: 'oxygen' },
  { cid: 947,     name: 'nitrogen' },
  { cid: 222,     name: 'ammonia' },
  { cid: 784,     name: 'hydrogen peroxide' },
  { cid: 5234,    name: 'sodium chloride' },
  { cid: 313,     name: 'hydrochloric acid' },
  { cid: 1118,    name: 'sulfuric acid' },
  { cid: 944,     name: 'nitric acid' },
  { cid: 14798,   name: 'sodium hydroxide' },
  { cid: 14797,   name: 'potassium hydroxide' },
  { cid: 10112,   name: 'calcium carbonate' },
  { cid: 516892,  name: 'sodium bicarbonate' },
  { cid: 281,     name: 'carbon monoxide' },
  { cid: 1100,    name: 'phosphoric acid' },
  { cid: 1086,    name: 'hydrogen sulfide' },
  { cid: 24978,   name: 'hydrogen fluoride' },
  { cid: 25398,   name: 'sulfur dioxide' },
  { cid: 3083522, name: 'potassium chloride' },
  // Common organics
  { cid: 297,     name: 'methane' },
  { cid: 6324,    name: 'ethane' },
  { cid: 6334,    name: 'propane' },
  { cid: 7843,    name: 'butane' },
  { cid: 8003,    name: 'pentane' },
  { cid: 8058,    name: 'hexane' },
  { cid: 8900,    name: 'heptane' },
  { cid: 9253,    name: 'cyclohexane' },
  { cid: 241,     name: 'benzene' },
  { cid: 1140,    name: 'toluene' },
  { cid: 7237,    name: 'o-xylene' },
  { cid: 931,     name: 'naphthalene' },
  { cid: 9231,    name: 'anthracene' },
  { cid: 995,     name: 'phenol' },
  { cid: 6115,    name: 'aniline' },
  { cid: 177,     name: 'acetaldehyde' },
  { cid: 180,     name: 'acetone' },
  { cid: 176,     name: 'acetic acid' },
  { cid: 284,     name: 'formic acid' },
  { cid: 887,     name: 'methanol' },
  { cid: 702,     name: 'ethanol' },
  { cid: 3776,    name: 'isopropanol' },
  { cid: 3283,    name: 'diethyl ether' },
  { cid: 6212,    name: 'chloroform' },
  { cid: 5943,    name: 'carbon tetrachloride' },
  { cid: 6344,    name: 'dichloromethane' },
  { cid: 7501,    name: 'styrene' },
  { cid: 7904,    name: 'acetonitrile' },
  { cid: 679,     name: 'dimethyl sulfoxide' },
  { cid: 6367,    name: 'tetrahydrofuran' },
  { cid: 6336,    name: 'formaldehyde' },
  { cid: 643461,  name: 'dimethylformamide' },
  // Carbohydrates
  { cid: 5793,    name: 'glucose' },
  { cid: 2723872, name: 'fructose' },
  { cid: 5988,    name: 'sucrose' },
  { cid: 83922,   name: 'lactose' },
  { cid: 439341,  name: 'maltose' },
  { cid: 5779,    name: 'ribose' },
  { cid: 65058,   name: 'deoxyribose' },
  { cid: 6036,    name: 'galactose' },
  { cid: 18950,   name: 'mannose' },
  // Amino acids (all 20 standard)
  { cid: 750,     name: 'glycine' },
  { cid: 5950,    name: 'L-alanine' },
  { cid: 6287,    name: 'L-valine' },
  { cid: 6106,    name: 'L-leucine' },
  { cid: 791,     name: 'L-isoleucine' },
  { cid: 145742,  name: 'L-proline' },
  { cid: 6140,    name: 'L-phenylalanine' },
  { cid: 6305,    name: 'L-tryptophan' },
  { cid: 6137,    name: 'L-methionine' },
  { cid: 5862,    name: 'L-cysteine' },
  { cid: 5951,    name: 'L-serine' },
  { cid: 6288,    name: 'L-threonine' },
  { cid: 6057,    name: 'L-tyrosine' },
  { cid: 9968,    name: 'L-histidine' },
  { cid: 5962,    name: 'L-lysine' },
  { cid: 6322,    name: 'L-arginine' },
  { cid: 5960,    name: 'L-aspartic acid' },
  { cid: 33032,   name: 'L-glutamic acid' },
  { cid: 6267,    name: 'L-asparagine' },
  { cid: 5961,    name: 'L-glutamine' },
  // Nucleobases
  { cid: 190,     name: 'adenine' },
  { cid: 764,     name: 'guanine' },
  { cid: 597,     name: 'cytosine' },
  { cid: 1135,    name: 'thymine' },
  { cid: 1174,    name: 'uracil' },
  // Nucleotides and energy
  { cid: 5957,    name: 'adenosine triphosphate' },
  { cid: 647994,  name: 'adenosine diphosphate' },
  { cid: 6083,    name: 'adenosine monophosphate' },
  { cid: 5893,    name: 'nicotinamide adenine dinucleotide' },
  { cid: 3037043, name: 'flavin adenine dinucleotide' },
  { cid: 439161,  name: 'coenzyme A' },
  // Lipids and fatty acids
  { cid: 5997,    name: 'cholesterol' },
  { cid: 985,     name: 'palmitic acid' },
  { cid: 5281,    name: 'stearic acid' },
  { cid: 445639,  name: 'oleic acid' },
  { cid: 5280450, name: 'linoleic acid' },
  { cid: 444899,  name: 'arachidonic acid' },
  { cid: 5460311, name: 'docosahexaenoic acid' },
  { cid: 446284,  name: 'eicosapentaenoic acid' },
  { cid: 24892,   name: 'glycerol' },
  // Vitamins
  { cid: 445354,   name: 'retinol (vitamin A)' },
  { cid: 1130,     name: 'thiamine (vitamin B1)' },
  { cid: 493570,   name: 'riboflavin (vitamin B2)' },
  { cid: 938,      name: 'niacin (vitamin B3)' },
  { cid: 6405,     name: 'pantothenic acid (vitamin B5)' },
  { cid: 1052,     name: 'pyridoxine (vitamin B6)' },
  { cid: 171548,   name: 'biotin (vitamin B7)' },
  { cid: 135398513, name: 'folic acid (vitamin B9)' },
  { cid: 54428122, name: 'cyanocobalamin (vitamin B12)' },
  { cid: 54670067, name: 'ascorbic acid (vitamin C)' },
  { cid: 5280795,  name: 'cholecalciferol (vitamin D3)' },
  { cid: 14985,    name: 'alpha-tocopherol (vitamin E)' },
  { cid: 5280494,  name: 'phylloquinone (vitamin K1)' },
  // Common bioactive / OTC drugs
  { cid: 2519,    name: 'caffeine' },
  { cid: 2244,    name: 'aspirin' },
  { cid: 3672,    name: 'ibuprofen' },
  { cid: 1983,    name: 'acetaminophen' },
  { cid: 5288826, name: 'morphine' },
  { cid: 5284371, name: 'codeine' },
  { cid: 4091,    name: 'metformin' },
  { cid: 9955743, name: 'atorvastatin' },
  { cid: 5743,    name: 'warfarin' },
  { cid: 60606,   name: 'omeprazole' },
  { cid: 5904,    name: 'penicillin G' },
  { cid: 33613,   name: 'amoxicillin' },
  { cid: 54675776, name: 'doxycycline' },
  { cid: 10204,   name: 'ciprofloxacin' },
  { cid: 4173,    name: 'metronidazole' },
  { cid: 2723949, name: 'azithromycin' },
  { cid: 447043,  name: 'erythromycin' },
  { cid: 5978,    name: 'chloroquine' },
  { cid: 122767,  name: 'ivermectin' },
  { cid: 5282411, name: 'hydroxychloroquine' },
  // Environmental and industrial
  { cid: 2336,    name: 'benzo[a]pyrene' },
  { cid: 3496,    name: 'glyphosate' },
  { cid: 2723,    name: 'atrazine' },
  { cid: 8795,    name: 'trichloroethylene' },
  { cid: 31423,   name: 'tetrachloroethylene' },
  { cid: 6579,    name: 'bisphenol A' },
  { cid: 24548,   name: 'vinyl chloride' },
  { cid: 3034034, name: 'DDT (4,4\'-dichlorodiphenyltrichloroethane)' },
  { cid: 9153,    name: 'chlorpyrifos' },
  { cid: 4116,    name: 'malathion' },
  // Food chemistry
  { cid: 311,     name: 'citric acid' },
  { cid: 222524,  name: 'malic acid' },
  { cid: 107689,  name: 'lactic acid' },
  { cid: 16666,   name: 'menthol' },
  { cid: 1183,    name: 'vanillin' },
  { cid: 517251,  name: 'sodium benzoate' },
  { cid: 14215,   name: 'monosodium glutamate' },
  { cid: 134601,  name: 'aspartame' },
  // Polymer precursors
  { cid: 6325,    name: 'ethylene' },
  { cid: 8252,    name: 'propylene' },
  { cid: 8082,    name: 'caprolactam' },
  { cid: 6569,    name: 'acrylonitrile' },
  // Hormones (CIDs verified against PubChem)
  { cid: 6013,    name: 'testosterone' },
  { cid: 5757,    name: 'estradiol' },
  { cid: 5994,    name: 'progesterone' },
  { cid: 5754,    name: 'cortisol' },
  { cid: 5819,    name: 'thyroxine' },
  { cid: 5816,    name: 'epinephrine' },
  { cid: 681,     name: 'dopamine' },
  { cid: 5202,    name: 'serotonin' },
  { cid: 896,     name: 'melatonin' },
  { cid: 439302,  name: 'oxytocin' },
  // Psychoactive compounds
  { cid: 89594,   name: 'nicotine' },
  { cid: 16078,   name: 'tetrahydrocannabinol' },
  { cid: 10624,   name: 'psilocybin' },
  { cid: 5765,    name: 'lysergic acid diethylamide' },
  { cid: 1615,    name: 'MDMA (methylenedioxymethamphetamine)' },
]

// Case-study: compounds tied to specific case studies — targeted name lookup
const CASE_STUDY_COMPOUNDS: CompoundDef[] = [
  // Ozempic / Wegovy
  { name: 'semaglutide',         extraTopics: ['drug-approval', 'medicine'] },
  { name: 'liraglutide',         extraTopics: ['drug-approval', 'medicine'] },
  { name: 'exenatide',           extraTopics: ['drug-approval', 'medicine'] },
  { name: 'tirzepatide',         extraTopics: ['drug-approval', 'medicine'] },
  // Tobacco carcinogens
  { name: 'benzo[a]pyrene',       extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: '4-(methylnitrosamino)-1-(3-pyridyl)-1-butanone', extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: "N'-nitrosonornicotine",  extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: 'acrolein',             extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: 'pyrene',               extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: 'chrysene',             extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: 'fluoranthene',         extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: 'benz[a]anthracene',    extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: '1,3-butadiene',        extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: 'acetaldehyde',         extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: 'nitrosamine',          extraTopics: ['tobacco-control', 'epidemiology'] },
  // Lab leak case study
  { name: 'remdesivir',           extraTopics: ['medicine', 'public-health'] },
  { name: 'molnupiravir',         extraTopics: ['medicine', 'drug-approval'] },
  // Korematsu / historical (pharmaceutical at the time)
  { name: 'penicillin',           extraTopics: ['medicine'] },
  // Smoking / epidemiology
  { name: 'cotinine',             extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: 'carbon monoxide',      extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: 'hydrogen cyanide',     extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: 'arsenic',              extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: 'cadmium',              extraTopics: ['tobacco-control', 'epidemiology'] },
  { name: 'polonium-210',         extraTopics: ['tobacco-control', 'epidemiology'] },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { bucket, limit } = parseArgs()
  console.log(`\n=== PubChem Ingestion — bucket: ${bucket}, limit: ${limit || 'all'} ===\n`)

  // Ensure core topics exist before any ingestion
  const { chemistry, compounds: compoundsTopic } = await ensureCoreTopics()
  const coreTopicIds = [chemistry, compoundsTopic]

  // Resolve extra topics used across buckets (best-effort — warn if missing)
  async function resolveExtraTopics(slugs: string[] = []): Promise<string[]> {
    const ids: string[] = []
    for (const slug of slugs) {
      const t = await prisma.topic.findUnique({ where: { slug } })
      if (t) ids.push(t.id)
      else console.warn(`  Warning: topic '${slug}' not found — skipping tag`)
    }
    return ids
  }

  const counts = { ingested: 0, skipped: 0, errors: 0 }

  if (bucket === 'reference') {
    const pool = limit > 0 ? REFERENCE_COMPOUNDS.slice(0, limit) : REFERENCE_COMPOUNDS
    console.log(`Processing ${pool.length} reference compounds…\n`)

    const seenCids = new Set<number>()
    for (const compound of pool) {
      const cid = await resolveName(compound.name)
      if (!cid) {
        console.warn(`  No PubChem match: ${compound.name}`)
        counts.skipped++
        continue
      }
      if (seenCids.has(cid)) {
        counts.skipped++
        continue
      }
      seenCids.add(cid)

      const result = await ingestCompound(cid, compound.name, [], coreTopicIds)
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
    }

  } else if (bucket === 'case-study') {
    const pool = limit > 0 ? CASE_STUDY_COMPOUNDS.slice(0, limit) : CASE_STUDY_COMPOUNDS
    console.log(`Processing ${pool.length} case-study compounds…\n`)

    for (const compound of pool) {
      // Resolve by name if no CID hardcoded
      let cid = compound.cid
      if (!cid) {
        cid = await resolveName(compound.name) ?? undefined
        if (!cid) {
          console.warn(`  No PubChem match: ${compound.name}`)
          counts.skipped++
          continue
        }
      }

      const extraIds = await resolveExtraTopics(compound.extraTopics)
      const result = await ingestCompound(cid, compound.name, extraIds, coreTopicIds)
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
    }

  } else if (bucket === 'pharma') {
    const drugApprovalTopic = await prisma.topic.findUnique({ where: { slug: 'drug-approval' } })
    if (!drugApprovalTopic) {
      console.warn("  Warning: topic 'drug-approval' not found — pharma compounds won't be tagged")
    }
    const result = await runPharmaBucket(limit, coreTopicIds, drugApprovalTopic?.id ?? null)
    counts.ingested += result.ingested
    counts.skipped  += result.skipped
    counts.errors   += result.errors

  } else {
    console.error(`Unknown bucket: ${bucket}. Use: reference | pharma | case-study`)
    process.exit(1)
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Ingested : ${counts.ingested}`)
  console.log(`  Skipped  : ${counts.skipped}`)
  console.log(`  Errors   : ${counts.errors}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
