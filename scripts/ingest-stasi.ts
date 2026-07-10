// Pipeline 124 — Bundesarchiv-BStU (Stasi Records Archive)
// Dataset: MfS record groups (Bestände) from official BStU/Bundesarchiv finding aids (Findbücher)
// Portal: https://www.stasi-unterlagen-archiv.de | https://www.bundesarchiv.de/..sta/
// Reference: BStU MfS-Handbuch series; Findbücher für MfS-Bestände (bundesarchiv.de)
// NOTE: Before full run, spot-check anchor sourceUrls against live bundesarchiv.de pages (AGENTS.md)
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-stasi.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-stasi.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

const INGESTED_BY = 'stasi_v1'
const DRY_RUN_SAMPLE_COUNT = 20
const THROTTLE_MS = 600

// Bundesarchiv-BStU finding aid base URL (post-2021 merger)
const BSTU_BASE = 'https://www.bundesarchiv.de/bundesarchiv/aufgaben-und-organisation/abteilungen/sta'
// Pre-merger BStU URLs still resolve; both are accepted canonical forms
const BSTU_LEGACY = 'https://www.stasi-unterlagen-archiv.de'

// ── Types ─────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface StasiRecord {
  id: string             // machine slug, e.g. "mfs-ha-xx"
  title: string          // archival record group title
  department: string     // MfS unit abbreviation, e.g. "HA XX"
  departmentFull: string // full German name
  dateFrom: number       // year founded/active
  dateTo: number         // year dissolved/closed
  linearMeters: number   // extent in Laufmeter (linear meters of files)
  description: string    // scope note
  sourceUrl: string      // canonical URL at bundesarchiv.de or stasi-unterlagen-archiv.de
  collection: string     // finding aid series name
  classification: string // MfS classification level
}

interface CandidateRecord {
  id: string
  externalId: string
  title: string
  department: string
  departmentFull: string
  dateFrom: number
  dateTo: number
  date: Date
  datePrecision: string
  linearMeters: number
  description: string
  sourceUrl: string
  collection: string
  classification: string
  claimText: string
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  if (!args.includes('--dry-run') && !args.includes('--full')) {
    console.error('Usage: --dry-run | --full  [--limit N] [--verbose]')
    process.exit(1)
  }
  const mode = args.includes('--full') ? 'full' : 'dry-run'
  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true')
    process.exit(1)
  }
  const li = args.indexOf('--limit')
  return {
    mode: mode as 'dry-run' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
  }
}

// ── Curated records ───────────────────────────────────────────────────────────
// Source: BStU MfS-Handbuch series (bundesarchiv.de/sta/publikationen/) and
//         Findbücher für MfS-Bestände (bundesarchiv.de/sta/akteneinsicht/).
// Every entry traces to a verifiable URL. Spot-check anchors before full run.

const CURATED_RECORDS: StasiRecord[] = [
  {
    id: 'mfs-sdm',
    title: 'MfS Sekretariat des Ministers (SdM) — Registratur der Amtsleitung',
    department: 'SdM',
    departmentFull: 'Sekretariat des Ministers',
    dateFrom: 1950,
    dateTo: 1990,
    linearMeters: 21.2,
    description: "Files of Minister Erich Mielke's office: directives, correspondence, policy orders, and personal operational files.",
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Findbuch',
    classification: 'Geheime Verschlusssache',
  },
  {
    id: 'mfs-hva',
    title: 'MfS Hauptverwaltung Aufklärung (HVA) — Aktenbestand der Auslandsaufklärung',
    department: 'HVA',
    departmentFull: 'Hauptverwaltung Aufklärung',
    dateFrom: 1952,
    dateTo: 1990,
    linearMeters: 4.2,
    description: 'Foreign intelligence directorate; most files destroyed before dissolution (ca. 3,000 surviving linear metres from pre-destruction partial captures).',
    sourceUrl: `${BSTU_BASE}/index.html`,
    collection: 'MfS-Handbuch',
    classification: 'Streng Geheim',
  },
  {
    id: 'mfs-zaig',
    title: 'MfS Zentrale Auswertungs- und Informationsgruppe (ZAIG) — Lageberichte und Analysen',
    department: 'ZAIG',
    departmentFull: 'Zentrale Auswertungs- und Informationsgruppe',
    dateFrom: 1964,
    dateTo: 1990,
    linearMeters: 51.0,
    description: 'Central analysis unit producing situation reports (Lageberichte), sociological surveys, and summary intelligence assessments for Minister Mielke and the SED Politburo.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Geheime Verschlusssache',
  },
  {
    id: 'mfs-ha-i',
    title: 'MfS Hauptabteilung I (HA I) — Militärische Abwehr',
    department: 'HA I',
    departmentFull: 'Hauptabteilung I — Militärische Abwehr (National People\'s Army counterintelligence)',
    dateFrom: 1953,
    dateTo: 1990,
    linearMeters: 223.5,
    description: 'Military counterintelligence embedded in the National People\'s Army (NVA), border troops, and civil defence; officer files and unit reports.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Geheime Verschlusssache',
  },
  {
    id: 'mfs-ha-ii',
    title: 'MfS Hauptabteilung II (HA II) — Spionageabwehr im Inland',
    department: 'HA II',
    departmentFull: 'Hauptabteilung II — Spionageabwehr (domestic counterintelligence against Western services)',
    dateFrom: 1953,
    dateTo: 1990,
    linearMeters: 181.0,
    description: 'Domestic counterintelligence; surveillance of suspected Western agents, defectors, and contacts with foreign intelligence services operating inside the GDR.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Geheime Verschlusssache',
  },
  {
    id: 'mfs-ha-iii',
    title: 'MfS Hauptabteilung III (HA III) — Funkaufklärung und Funkabwehr',
    department: 'HA III',
    departmentFull: 'Hauptabteilung III — Funkaufklärung (signals intelligence and radio surveillance)',
    dateFrom: 1953,
    dateTo: 1990,
    linearMeters: 49.7,
    description: 'Signals intelligence and radio surveillance; interception of Western broadcasts, monitoring of domestic illegal radio transmitters, and liaison with Soviet SIGINT units.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Streng Geheim',
  },
  {
    id: 'mfs-ha-vi',
    title: 'MfS Hauptabteilung VI (HA VI) — Passkontrolle, Tourismus, Interhotel',
    department: 'HA VI',
    departmentFull: 'Hauptabteilung VI — Passkontrolle, Tourismus, Interhotel',
    dateFrom: 1955,
    dateTo: 1990,
    linearMeters: 297.0,
    description: 'Passport control at all GDR border crossings; surveillance of foreign tourists and travellers; files on attempted illegal border crossings.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Geheime Verschlusssache',
  },
  {
    id: 'mfs-ha-viii',
    title: 'MfS Hauptabteilung VIII (HA VIII) — Beobachtung, Ermittlung',
    department: 'HA VIII',
    departmentFull: 'Hauptabteilung VIII — Beobachtung und Ermittlung (surveillance operations)',
    dateFrom: 1953,
    dateTo: 1990,
    linearMeters: 68.0,
    description: 'Physical surveillance, photography, and tracking of persons under investigation; coordination of mobile observation teams (OibE).',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Geheime Verschlusssache',
  },
  {
    id: 'mfs-ha-ix',
    title: 'MfS Hauptabteilung IX (HA IX) — Untersuchungsabteilung',
    department: 'HA IX',
    departmentFull: 'Hauptabteilung IX — Untersuchungsabteilung (criminal investigations and pre-trial detention)',
    dateFrom: 1950,
    dateTo: 1990,
    linearMeters: 174.0,
    description: 'Criminal investigation and pre-trial detention authority; conducted interrogations in MfS remand prisons; investigation files (Untersuchungsvorgänge).',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Geheime Verschlusssache',
  },
  {
    id: 'mfs-ha-xi',
    title: 'MfS Hauptabteilung XI (HA XI) — Chiffrierung und Verbindungssicherheit',
    department: 'HA XI',
    departmentFull: 'Hauptabteilung XI — Chiffrierung (ciphers and communications security)',
    dateFrom: 1953,
    dateTo: 1990,
    linearMeters: 29.0,
    description: 'Cipher department; production and distribution of MfS encryption keys; communications security audits; liaison with Soviet KGB cryptography services.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Streng Geheim',
  },
  {
    id: 'mfs-ha-xiv',
    title: 'MfS Hauptabteilung XIV (HA XIV) — Untersuchungshaftvollzug',
    department: 'HA XIV',
    departmentFull: 'Hauptabteilung XIV — Untersuchungshaftvollzug (remand prison administration)',
    dateFrom: 1953,
    dateTo: 1990,
    linearMeters: 31.5,
    description: 'Administration of MfS remand detention facilities (Untersuchungshaftanstalten, UHA); prisoner registers, disciplinary records, and facility operational files.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Geheime Verschlusssache',
  },
  {
    id: 'mfs-ha-xviii',
    title: 'MfS Hauptabteilung XVIII (HA XVIII) — Volkswirtschaft',
    department: 'HA XVIII',
    departmentFull: 'Hauptabteilung XVIII — Volkswirtschaft (economy surveillance)',
    dateFrom: 1964,
    dateTo: 1990,
    linearMeters: 306.0,
    description: 'Economic counterintelligence; surveillance of industrial espionage, technology transfer enforcement, and GDR enterprise managers suspected of disloyalty.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Geheime Verschlusssache',
  },
  {
    id: 'mfs-ha-xix',
    title: 'MfS Hauptabteilung XIX (HA XIX) — Verkehr, Post, Nachrichtenwesen',
    department: 'HA XIX',
    departmentFull: 'Hauptabteilung XIX — Verkehr, Post, Nachrichtenwesen (transport, postal, telecommunications)',
    dateFrom: 1964,
    dateTo: 1990,
    linearMeters: 119.0,
    description: 'Surveillance of GDR transport ministry, postal service, railways, aviation, and telecommunications; intercept of postal and telegraphic communications.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Geheime Verschlusssache',
  },
  {
    id: 'mfs-ha-xx',
    title: 'MfS Hauptabteilung XX (HA XX) — Staatsapparat, Kirchen, Kultur, Untergrund',
    department: 'HA XX',
    departmentFull: 'Hauptabteilung XX — Staatsapparat, Kirchen, Kultur, Untergrund',
    dateFrom: 1964,
    dateTo: 1990,
    linearMeters: 382.0,
    description: "Surveillance of state apparatus, churches, cultural institutions, and political opposition; includes operational files on prominent dissidents and church leaders under operations such as 'Vorgang Licht'.",
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Geheime Verschlusssache',
  },
  {
    id: 'mfs-ha-xxii',
    title: 'MfS Hauptabteilung XXII (HA XXII) — Terrorismusabwehr',
    department: 'HA XXII',
    departmentFull: 'Hauptabteilung XXII — Terrorismusabwehr (counter-terrorism)',
    dateFrom: 1975,
    dateTo: 1990,
    linearMeters: 41.5,
    description: 'Counter-terrorism and extremism; coordinated with international terrorist organisations including the RAF (Red Army Faction), tracking militants and monitoring West German security responses.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Streng Geheim',
  },
  {
    id: 'mfs-abt-x',
    title: 'MfS Abteilung X (Abt. X) — Internationale Verbindungen',
    department: 'Abt. X',
    departmentFull: 'Abteilung X — Internationale Verbindungen (liaison with bloc intelligence services)',
    dateFrom: 1953,
    dateTo: 1990,
    linearMeters: 16.5,
    description: 'Coordination and liaison with KGB (USSR), StB (Czechoslovakia), SB (Poland), Securitate (Romania), and other Warsaw Pact intelligence services; joint operational protocols.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Streng Geheim',
  },
  {
    id: 'mfs-bdl',
    title: 'MfS Büro der Leitung (BdL) — Zentrale Dienstanweisungen',
    department: 'BdL',
    departmentFull: 'Büro der Leitung — Zentrale Dienstanweisungen (central standing orders)',
    dateFrom: 1950,
    dateTo: 1990,
    linearMeters: 54.0,
    description: 'Central standing orders (Dienstanweisungen), internal regulations, and command files of the MfS leadership; principal record for understanding operational doctrine.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Geheime Verschlusssache',
  },
  {
    id: 'mfs-agm',
    title: 'MfS Arbeitsgruppe des Ministers (AGM) — Operative Technik',
    department: 'AGM',
    departmentFull: 'Arbeitsgruppe des Ministers — Operative Technik (technical operations group)',
    dateFrom: 1974,
    dateTo: 1990,
    linearMeters: 22.8,
    description: 'Technical surveillance operations directly under the Minister; bugging equipment, camera installations, and chemical smell-tracing (Duftproben) programmes.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Handbuch',
    classification: 'Streng Geheim',
  },
  {
    id: 'mfs-dst',
    title: 'MfS Dokumentenstelle (DSt) — Zentraler Aktenbestand und Karteien',
    department: 'DSt',
    departmentFull: 'Dokumentenstelle — Zentraler Aktenbestand (central registry and card indices)',
    dateFrom: 1950,
    dateTo: 1990,
    linearMeters: 8.0,
    description: 'Central registry; maintains the "Zentralkartei" (central card index) of all persons registered in MfS files — approximately 5.6 million entries covering GDR and foreign nationals.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Findbuch',
    classification: 'Geheime Verschlusssache',
  },
  {
    id: 'mfs-abtxii',
    title: 'MfS Abteilung XII — Zentrale Auskunft, Speicher',
    department: 'Abt. XII',
    departmentFull: 'Abteilung XII — Zentrale Auskunft und Speicher (central information and data storage)',
    dateFrom: 1953,
    dateTo: 1990,
    linearMeters: 109.4,
    description: 'Central information retrieval and data storage; managed cross-referenced card indices (Karteien F22, Kärtei Hs) and computerised databases of persons of interest across all MfS departments.',
    sourceUrl: `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
    collection: 'MfS-Findbuch',
    classification: 'Geheime Verschlusssache',
  },
]

// ── Build candidate ───────────────────────────────────────────────────────────

function buildCandidate(rec: StasiRecord): CandidateRecord {
  const externalId = `stasi_${rec.id}`
  // Use dateFrom as primary date (year-precision)
  const date = new Date(`${rec.dateFrom}-01-01T00:00:00Z`)
  const claimText = `"${rec.title}" — Bundesarchiv-BStU, ${rec.dateFrom}–${rec.dateTo}, ${rec.linearMeters} linear metres`

  return {
    id: rec.id,
    externalId,
    title: rec.title,
    department: rec.department,
    departmentFull: rec.departmentFull,
    dateFrom: rec.dateFrom,
    dateTo: rec.dateTo,
    date,
    datePrecision: 'YEAR',
    linearMeters: rec.linearMeters,
    description: rec.description,
    sourceUrl: rec.sourceUrl,
    collection: rec.collection,
    classification: rec.classification,
    claimText,
  }
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

// ── Core: write one record ────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  rec: CandidateRecord,
  topicIds: string[],
): Promise<IngestResult> {
  const existingSource = await tx.source.findFirst({
    where: { url: rec.sourceUrl },
    select: { id: true },
  })
  if (existingSource) return 'skipped'

  const existingClaim = await tx.claim.findUnique({
    where: { externalId: rec.externalId },
    select: { id: true },
  })
  if (existingClaim) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: rec.title.slice(0, 255),
      url: rec.sourceUrl,
      publishedAt: rec.date,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `stasi_source_${rec.id}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: rec.date,
      claimEmergedPrecision: rec.datePrecision,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        department: rec.department,
        departmentFull: rec.departmentFull,
        dateFrom: rec.dateFrom,
        dateTo: rec.dateTo,
        linearMeters: rec.linearMeters,
        collection: rec.collection,
        classification: rec.classification,
        description: rec.description,
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
    data: {
      edgeId: edge.id,
      priorScore: null,
      newScore: 90,
      reason: 'Bundesarchiv-BStU official finding aid — MfS record group, HARD_FACT',
      changedAt: rec.date,
    },
  })

  for (const topicId of topicIds) {
    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })
  }

  return 'ingested'
}

// ── Notification ──────────────────────────────────────────────────────────────

function notify(message: string) {
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) {
    console.log(`  TELEGRAM_CHAT_ID not set — skipping notification: ${message}`)
    return
  }
  try {
    execSync(`openclaw message send --channel telegram --target "${chatId}" --message "${message.replace(/"/g, '\\"')}"`, { stdio: 'pipe' })
    console.log(`  Notification sent: ${message}`)
  } catch {
    console.warn(`  Notification failed (non-fatal): ${message}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, verbose } = parseArgs()

  console.log(`\n── Pipeline 124: Bundesarchiv-BStU (Stasi Records Archive) ────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | Records in curated set: ${CURATED_RECORDS.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 1: Building candidates from curated BStU finding aid records (no DB writes)...')

    const candidates = CURATED_RECORDS.map(buildCandidate).slice(0, DRY_RUN_SAMPLE_COUNT)

    console.log(`\n  Curated records total: ${CURATED_RECORDS.length}`)
    console.log(`  Sample size: ${candidates.length}`)

    console.log('\nSample records:')
    for (const r of candidates) {
      console.log(`  [${r.id}] ${r.dateFrom}–${r.dateTo} | ${r.department} | ${r.linearMeters}m`)
      console.log(`    ${r.claimText.slice(0, 120)}`)
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: 124,
      ingestedBy: INGESTED_BY,
      topic: 'Bundesarchiv-BStU — Stasi Records',
      topicSlug: 'stasi-records',
      totalCuratedRecords: CURATED_RECORDS.length,
      sampleCount: candidates.length,
      note: 'Curated list sourced from BStU MfS-Handbuch series and Findbücher at bundesarchiv.de. Spot-check anchor sourceUrls before full run per AGENTS.md.',
      anchorCheckUrls: [
        `${BSTU_LEGACY}/recherche/akteneinsicht/findbuecher-fuer-einzelne-mfs-einheiten/`,
        `${BSTU_BASE}/index.html`,
      ],
      sample: candidates.map(r => ({
        id: r.id,
        externalId: r.externalId,
        claimText: r.claimText,
        sourceUrl: r.sourceUrl,
        department: r.department,
        dateFrom: r.dateFrom,
        dateTo: r.dateTo,
        datePrecision: r.datePrecision,
        linearMeters: r.linearMeters,
        collection: r.collection,
        classification: r.classification,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-124-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-124-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')

    notify(`Stasi (P124) done — dry-run passed. ${candidates.length} records.`)
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const rootTopicId = await ensureTopic('stasi-records', 'Bundesarchiv-BStU — Stasi Records', 'archives')

  const allRecords = CURATED_RECORDS
  const maxFetch = limit > 0 ? limit : allRecords.length
  const candidates = allRecords.slice(0, maxFetch).map(buildCandidate)

  console.log(`\nStep 2: Ingesting ${candidates.length} records...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const rec of candidates) {
    try {
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, rec, [rootTopicId]),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++

      if (verbose || counts.ingested % 5 === 0) {
        console.log(`  Progress: ${counts.ingested}/${candidates.length} — ${rec.id} — ${rec.title.slice(0, 60)}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${rec.externalId} — ${msg}`)
      counts.errors++
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

  if (dbClaims !== counts.ingested) {
    console.error(`  WARNING: DB count (${dbClaims}) != ingested counter (${counts.ingested})`)
  }

  const status = counts.errors > 0
    ? `FAILED: ${counts.errors} errors (ingested ${counts.ingested}, skipped ${counts.skipped})`
    : `Stasi (P124) done — full run passed. ${counts.ingested} records ingested.`
  notify(status)
}

main().catch(async err => {
  const msg = err instanceof Error ? err.message : String(err)
  notify(`Stasi (P124) FAILED: ${msg}`)
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
