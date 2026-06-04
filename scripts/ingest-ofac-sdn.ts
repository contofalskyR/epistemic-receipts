// OFAC Specially Designated Nationals (SDN) ingester (ofac_sdn_v1)
// Source: https://ofac.treasury.gov/downloads/sdn.xml (redirects to sanctions list service)
// Scope: All active OFAC SDN entries — individuals, entities, vessels, aircraft.
//        One claim per SDN entry, keyed on OFAC uid.
//
// Run:
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-ofac-sdn.ts --dry-run [--limit N] [--program IRAN]
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-ofac-sdn.ts [--limit N] [--program IRAN] [--skip-existing]
//
// Flags:
//   --dry-run         Parse + preview without writing to DB
//   --program <name>  Only ingest entries from a specific OFAC program (e.g. IRAN, RUSSIA, CUBA)
//   --limit <N>       Cap number of records processed
//   --skip-existing   Skip records already in DB (by externalId)

import dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true })

import * as fs from 'fs'
import { XMLParser } from 'fast-xml-parser'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PIPELINE   = 'ofac_sdn_v1'
// Direct URL — ofac.treasury.gov/downloads/sdn.xml returns 404; canonical host is the sanctions list service
const SDN_URL    = 'https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/sdn.xml'
const SOURCE_URL = 'https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists'
const TX_TIMEOUT = 30_000
const LOG_PATH   = '/tmp/ofac-agent.log'

// ── Program → ISO 3166-1 alpha-3 ─────────────────────────────────────────────

const PROGRAM_ALPHA3: Record<string, string> = {
  IRAN: 'IRN', 'IRAN-TRA': 'IRN', IFSR: 'IRN', 'IRAN-EO13059': 'IRN',
  'IRAN-EO13871': 'IRN', 'IRAN-EO13902': 'IRN', 'IRAN-EO13846': 'IRN',
  'IRAN-HR': 'IRN', 'IRAN-CON': 'IRN', IRGC: 'IRN',
  VENEZUELA: 'VEN', 'VENEZUELA-EO13850': 'VEN', 'VENEZUELA-EO13884': 'VEN',
  RUSSIA: 'RUS',
  'UKRAINE-EO13685': 'RUS', 'UKRAINE-EO13660': 'RUS',
  'UKRAINE-EO13661': 'RUS', 'UKRAINE-EO13662': 'RUS',
  CUBA: 'CUB', 'CUBA-EO14404': 'CUB',
  SYRIA: 'SYR', 'SYRIA-EO13894': 'SYR',
  DPRK: 'PRK', 'DPRK-EO13382': 'PRK', DPRK2: 'PRK', DPRK3: 'PRK', DPRK4: 'PRK',
  BELARUS: 'BLR',
  MYANMAR: 'MMR', 'BURMA-EO14014': 'MMR',
  SUDAN: 'SDN',
  ZIMBABWE: 'ZWE',
  LIBYA: 'LBY',
  SOMALIA: 'SOM',
  MALI: 'MLI',
  NICARAGUA: 'NIC',
  IRAQ: 'IRQ', 'IRAQ-EO13303': 'IRQ', IRAQ2: 'IRQ', IRAQ3: 'IRQ',
  'CHINA-MILITARY': 'CHN', 'CMIC': 'CHN',
  ETHIOPIA: 'ETH',
  HAITI: 'HTI',
  BURUNDI: 'BDI',
  CAR: 'CAF',
  DRC: 'COD',
  'EO-13894': 'TUR',
  'SOUTH-SUDAN': 'SSD',
  MALDIVES: 'MDV',
  AFGHANISTAN: 'AFG',
  // Multi-country / thematic programs (SDGT, SDNT, FTO, TCO, GLOMAG, etc.) → no mapping
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SdnEntry {
  uid: number
  firstName: string | undefined
  lastName: string
  title: string | undefined
  sdnType: string
  programs: string[]
  aliases: string[]
  legalAuthority: string | undefined
  remarks: string | undefined
  addressCountries: string[]
}

// ── Args ──────────────────────────────────────────────────────────────────────

interface Args {
  dryRun: boolean
  program: string | null
  limit: number
  skipExisting: boolean
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const args: Args = {
    dryRun: false,
    program: null,
    limit: Number.MAX_SAFE_INTEGER,
    skipExisting: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') {
      args.dryRun = true
    } else if (a === '--program' && argv[i + 1]) {
      args.program = argv[++i].toUpperCase()
    } else if (a === '--limit' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10)
      if (!isNaN(n) && n > 0) args.limit = n
    } else if (a === '--skip-existing') {
      args.skipExisting = true
    }
  }

  return args
}

// ── XML fetch + parse ─────────────────────────────────────────────────────────

function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (val === undefined || val === null) return []
  return Array.isArray(val) ? val : [val]
}

async function fetchAndParse(): Promise<SdnEntry[]> {
  const cachePath = '/tmp/ofac-sdn.xml'

  let xml: string
  if (fs.existsSync(cachePath)) {
    console.log(`  Using cached XML at ${cachePath}`)
    xml = fs.readFileSync(cachePath, 'utf8')
  } else {
    console.log(`  Fetching ${SDN_URL} (~15MB) ...`)
    const res = await fetch(SDN_URL, {
      headers: { 'Accept': 'application/xml, text/xml, */*' },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching SDN XML from ${SDN_URL}`)
    xml = await res.text()
    if (!xml.includes('<sdnList')) throw new Error('Response does not appear to be SDN XML')
    fs.writeFileSync(cachePath, xml)
    console.log(`  Saved to ${cachePath} (${(xml.length / 1024).toFixed(0)} KB)`)
  }

  console.log('  Parsing XML ...')

  const parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    parseTagValue: true,
    isArray: (name) =>
      ['sdnEntry', 'program', 'aka', 'id', 'address',
       'dateOfBirthItem', 'placeOfBirthItem', 'nationality'].includes(name),
  })

  const doc = parser.parse(xml)
  const rawEntries: any[] = toArray(doc?.sdnList?.sdnEntry)
  console.log(`  Parsed ${rawEntries.length} SDN entries`)

  return rawEntries.map((e): SdnEntry => {
    const programs: string[] = toArray(e?.programList?.program).map(String)

    const akaList: any[] = toArray(e?.akaList?.aka)
    const aliases = akaList
      .map((a: any) => {
        const fn = a?.firstName ? `${a.firstName} ` : ''
        return `${fn}${a?.lastName ?? ''}`.trim()
      })
      .filter(Boolean)

    const idItems: any[] = toArray(e?.idList?.id)
    // Extract legal authority from "Secondary sanctions risk:" id type
    let legalAuthority: string | undefined
    for (const id of idItems) {
      const t = String(id?.idType ?? '')
      if (t.toLowerCase().includes('secondary sanctions risk')) {
        legalAuthority = String(id?.idNumber ?? '').trim() || undefined
        break
      }
    }

    const addressList: any[] = toArray(e?.addressList?.address)
    const addressCountries = addressList
      .map((a: any) => String(a?.country ?? '').trim())
      .filter(Boolean)

    const remarks = e?.remarks ? String(e.remarks).trim() : undefined

    return {
      uid: Number(e?.uid ?? 0),
      firstName: e?.firstName ? String(e.firstName).trim() : undefined,
      lastName: String(e?.lastName ?? '').trim(),
      title: e?.title ? String(e.title).trim() : undefined,
      sdnType: String(e?.sdnType ?? 'Entity').trim(),
      programs,
      aliases,
      legalAuthority,
      remarks,
      addressCountries,
    }
  }).filter(e => e.uid > 0 && e.lastName)
}

// ── Country resolution ────────────────────────────────────────────────────────

function resolveAlpha3(entry: SdnEntry): string | null {
  for (const prog of entry.programs) {
    const a3 = PROGRAM_ALPHA3[prog.toUpperCase()]
    if (a3) return a3
  }
  return null
}

// ── Polity cache ──────────────────────────────────────────────────────────────

const polityCache = new Map<string, string | null>()

async function findPolityId(alpha3: string): Promise<string | null> {
  if (polityCache.has(alpha3)) return polityCache.get(alpha3)!
  // Prefer current polity (endYear: null); fall back to any with that country code
  const polity = await prisma.polity.findFirst({
    where: { countryCode: alpha3, endYear: null },
    select: { id: true },
  }) ?? await prisma.polity.findFirst({
    where: { countryCode: alpha3 },
    select: { id: true },
  })
  const id = polity?.id ?? null
  polityCache.set(alpha3, id)
  return id
}

// ── Topic cache ───────────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    topicCache.set(slug, existing.id)
    return existing.id
  }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  topicCache.set(slug, created.id)
  return created.id
}

// ── Build claim text ──────────────────────────────────────────────────────────

function buildClaimText(entry: SdnEntry): string {
  const fullName = entry.firstName
    ? `${entry.firstName} ${entry.lastName}`
    : entry.lastName

  const programs = entry.programs.join(', ') || 'UNKNOWN'

  const authorityLine = entry.legalAuthority
    ? `Designated under authority of ${entry.legalAuthority}.`
    : `Listed under OFAC sanctions program ${programs}.`

  return `${entry.sdnType}: ${fullName} (OFAC SDN) — Specially Designated National under program ${programs}. ${authorityLine}`
}

// ── Write one entry ───────────────────────────────────────────────────────────

type WriteResult = 'ingested' | 'updated' | 'skipped' | 'failed'

async function writeEntry(
  entry: SdnEntry,
  topicId: string,
  skipExisting: boolean,
): Promise<WriteResult> {
  const externalId = `ofac_sdn_${entry.uid}`

  if (skipExisting) {
    const exists = await prisma.claim.findUnique({
      where: { externalId },
      select: { id: true },
    })
    if (exists) return 'skipped'
  }

  const existing = await prisma.claim.findUnique({
    where: { externalId },
    select: { id: true },
  })
  const isUpdate = !!existing

  const claimText = buildClaimText(entry)
  const alpha3 = resolveAlpha3(entry)
  const tags = [
    'sanctions',
    'ofac',
    ...entry.programs.map(p => p.toLowerCase()),
    entry.sdnType.toLowerCase(),
  ]

  const fullName = entry.firstName
    ? `${entry.firstName} ${entry.lastName}`
    : entry.lastName

  const metadata = {
    dataset: PIPELINE,
    tags,
    uid: entry.uid,
    sdn_type: entry.sdnType,
    programs: entry.programs,
    aliases: entry.aliases.length ? entry.aliases : undefined,
    address_countries: entry.addressCountries.length ? entry.addressCountries : undefined,
    title: entry.title ?? undefined,
    legal_authority: entry.legalAuthority ?? undefined,
    remarks: entry.remarks ?? undefined,
    alpha3: alpha3 ?? undefined,
  }

  // Look up polity before entering transaction (pure read, avoids tx overhead)
  const polityId = alpha3 ? await findPolityId(alpha3) : null

  await prisma.$transaction(async tx => {
    const source = await tx.source.upsert({
      where: { externalId },
      update: {
        name: `OFAC SDN — ${fullName}`,
        url: SOURCE_URL,
      },
      create: {
        externalId,
        name: `OFAC SDN — ${fullName}`,
        url: SOURCE_URL,
        methodologyType: 'primary',
        ingestedBy: PIPELINE,
        humanReviewed: false,
        autoApproved: true,
      },
    })

    const claim = await tx.claim.upsert({
      where: { externalId },
      update: {
        text: claimText,
        metadata,
      },
      create: {
        externalId,
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        ingestedBy: PIPELINE,
        humanReviewed: false,
        autoApproved: true,
        metadata,
      },
    })

    const edgeExists = await tx.edge.findFirst({
      where: { claimId: claim.id, sourceId: source.id, type: 'FOR' },
      select: { id: true },
    })
    if (!edgeExists) {
      await tx.edge.create({
        data: {
          claimId: claim.id,
          sourceId: source.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: PIPELINE,
          humanReviewed: false,
          autoApproved: true,
        },
      })
    }

    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })

    if (polityId) {
      await tx.polityClaim.upsert({
        where: { polityId_claimId: { polityId, claimId: claim.id } },
        update: {},
        create: { polityId, claimId: claim.id, matchMethod: 'auto_program' },
      })
    }
  }, { timeout: TX_TIMEOUT })

  return isUpdate ? 'updated' : 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs()

  console.log('\n=== OFAC SDN ingestion ===')
  console.log(`  Pipeline     : ${PIPELINE}`)
  console.log(`  Mode         : ${args.dryRun ? 'dry-run' : 'live'}`)
  if (args.program) console.log(`  Program      : ${args.program}`)
  if (args.limit < Number.MAX_SAFE_INTEGER) console.log(`  Limit        : ${args.limit}`)
  if (args.skipExisting) console.log(`  Skip-existing: yes`)

  console.log('\nFetching SDN list...')
  const allEntries = await fetchAndParse()

  const pool = args.program
    ? allEntries.filter(e => e.programs.map(p => p.toUpperCase()).includes(args.program!))
    : allEntries

  const batch = pool.slice(0, args.limit)
  console.log(`  Processing: ${batch.length} of ${allEntries.length} total entries`)

  if (args.dryRun) {
    console.log('\n── Sample (first 10) ──')
    for (const e of batch.slice(0, 10)) {
      const fullName = e.firstName ? `${e.firstName} ${e.lastName}` : e.lastName
      console.log(`  [uid=${e.uid}] ${e.sdnType}: ${fullName}`)
      console.log(`         programs : ${e.programs.join(', ')}`)
      console.log(`         alpha3   : ${resolveAlpha3(e) ?? 'n/a'}`)
      if (e.aliases.length) console.log(`         aliases  : ${e.aliases.slice(0, 3).join('; ')}`)
      console.log(`         text     : ${buildClaimText(e).slice(0, 120)}...`)
    }

    const byType: Record<string, number> = {}
    const byProgram: Record<string, number> = {}
    for (const e of batch) {
      byType[e.sdnType] = (byType[e.sdnType] ?? 0) + 1
      for (const p of e.programs) byProgram[p] = (byProgram[p] ?? 0) + 1
    }

    console.log('\n── Count by SDN type ──')
    for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${t}: ${n}`)
    }

    console.log('\n── Count by program (top 25) ──')
    for (const [p, n] of Object.entries(byProgram).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
      const a3 = PROGRAM_ALPHA3[p.toUpperCase()] ?? '—'
      console.log(`  ${p} (${a3}): ${n}`)
    }

    const withAlpha3 = batch.filter(e => resolveAlpha3(e) !== null).length
    console.log(`\n  Would ingest    : ${batch.length} entries`)
    console.log(`  Polity-linkable : ${withAlpha3} (${Math.round(100 * withAlpha3 / batch.length)}%)`)
    console.log('\nDry-run complete — no DB writes')

    await prisma.$disconnect()
    return
  }

  // Live run — guard against accidental full run
  if (!process.env.ALLOW_EDITS && args.limit === Number.MAX_SAFE_INTEGER) {
    console.error('\nERROR: Full run (no --limit) requires ALLOW_EDITS=true in environment.')
    console.error('  Test with --limit 100 first, then set ALLOW_EDITS=true for full run.')
    await prisma.$disconnect()
    process.exit(1)
  }

  const sanctionsTopicId = await ensureTopic('sanctions', 'Sanctions', 'government')

  let ingested = 0, updated = 0, skipped = 0, failed = 0
  let sampleText: string | null = null
  const errors: string[] = []

  for (let i = 0; i < batch.length; i++) {
    const e = batch[i]
    try {
      const result = await writeEntry(e, sanctionsTopicId, args.skipExisting)
      if (result === 'ingested') {
        ingested++
        if (!sampleText) sampleText = buildClaimText(e).slice(0, 100)
      } else if (result === 'updated') {
        updated++
      } else if (result === 'skipped') {
        skipped++
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      const errLine = `  [uid=${e.uid}] ${e.lastName}: ${msg}`
      errors.push(errLine)
      if (errors.length <= 5) console.error(errLine)
    }

    if ((i + 1) % 200 === 0) {
      console.log(
        `  Progress: ${i + 1}/${batch.length}` +
        ` (ingested=${ingested} updated=${updated} skipped=${skipped} failed=${failed})`
      )
    }
  }

  console.log('\n=== Summary ===')
  console.log(`  Ingested : ${ingested}`)
  console.log(`  Updated  : ${updated}`)
  console.log(`  Skipped  : ${skipped}`)
  console.log(`  Failed   : ${failed}`)
  if (sampleText) console.log(`  Sample   : "${sampleText}..."`)

  const dbCount = await prisma.claim.count({
    where: { ingestedBy: PIPELINE, deleted: false },
  })
  console.log(`\n  DB count (${PIPELINE}): ${dbCount} claims`)

  // Write log for openclaw message
  const logLines = [
    `OFAC SDN pipeline complete — ${new Date().toISOString()}`,
    `  Ingested: ${ingested} | Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed}`,
    `  DB count: ${dbCount} claims`,
    ...(sampleText ? [`  Sample: "${sampleText}..."`] : []),
    ...(errors.length > 0 ? [`  First errors: ${errors.slice(0, 3).join(' | ')}`] : []),
  ]
  fs.writeFileSync(LOG_PATH, logLines.join('\n') + '\n')
  console.log(`\n  Log written to ${LOG_PATH}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('Fatal error:', msg)
  fs.writeFileSync(LOG_PATH, `OFAC SDN pipeline FAILED: ${msg}\n`)
  await prisma.$disconnect()
  process.exit(1)
})
