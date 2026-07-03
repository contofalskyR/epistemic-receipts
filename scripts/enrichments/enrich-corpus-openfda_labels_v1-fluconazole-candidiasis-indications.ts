// Enrichment: epistemic trajectory for the openFDA-label claim asserting the
// FDA-approved INDICATIONS AND USAGE of fluconazole — a triazole antifungal
// (Pfizer UK-49,858, marketed as Diflucan) indicated for vaginal, oropharyngeal,
// and esophageal candidiasis, systemic Candida infections, and cryptococcal
// meningitis.
//
// Claim (openfda_labels_v1): "Fluconazole (FLUCONAZOLE): INDICATIONS AND USAGE
// Fluconazole tablets are indicated for the treatment of: Vaginal candidiasis ...
// Oropharyngeal and esophageal candidiasis ... Cryptococcal ..."
//
// The claim already carries its emergence entry (fromAxis=null). This script
// adds the downstream historical arc for fluconazole as a therapeutic agent:
//
//   OPEN -> RECORDED (1992): The efficacy of fluconazole entered the peer-
//     reviewed clinical record via the NIAID Mycoses Study Group / ACTG
//     multicenter comparative trial of fluconazole versus amphotericin B for
//     acute AIDS-associated cryptococcal meningitis (Saag et al., NEJM 1992) —
//     the landmark randomized Phase III evidence for an oral agent active
//     against the systemic and cryptococcal infections named on the label.
//
//   RECORDED -> SETTLED (2016): The IDSA Clinical Practice Guideline for the
//     Management of Candidiasis (Pappas et al., Clin Infect Dis 2016) codified
//     fluconazole as a recommended first-line agent for oropharyngeal,
//     esophageal, and vaginal candidiasis and for step-down therapy of
//     candidemia — settling its standard-of-care role for the label's primary
//     indications.
//
//   SETTLED -> CONTESTED (2011): The FDA issued a Drug Safety Communication
//     warning that chronic, high-dose (400-800 mg/day) fluconazole use in the
//     first trimester of pregnancy may be associated with a distinct pattern of
//     birth defects, and changed the pregnancy category for high-dose use from
//     C to D — an official post-market safety signal contesting the safety
//     framing of an established use.
//
// Only high-confidence, DOI-anchored / FDA.gov-anchored arcs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-fluconazole-candidiasis-indications.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-fluconazole-candidiasis-indications.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy5pwx8kg6plo7lavlwiyp'

type FactStatus =
  | 'OPEN'
  | 'RECORDED'
  | 'SETTLED'
  | 'CONTESTED'
  | 'REVERSED'
  | 'ABANDONED'
  | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE'
  | 'INSTITUTIONAL'
  | 'JUDICIAL'
  | 'PUBLIC'
  | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// Do NOT duplicate the existing null -> <first> emergence entry; start at OPEN -> RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1992-01-09',
    datePrecision: 'DAY',
    reason:
      'The clinical efficacy of fluconazole against the systemic and cryptococcal infections named on the label entered the peer-reviewed record through a landmark NIAID Mycoses Study Group / AIDS Clinical Trials Group randomized multicenter comparison of fluconazole with amphotericin B for acute AIDS-associated cryptococcal meningitis (Saag et al., New England Journal of Medicine 1992). The trial established that oral fluconazole was a viable treatment for a life-threatening invasive mycosis, recording the drug as a genuinely effective antifungal in controlled human evidence rather than in vitro or animal data alone. This is the primary Phase III publication that placed fluconazole on the clinical scientific record.',
    source: {
      externalId: 'src:saag-fluconazole-amphotericin-cryptococcal-nejm-1992',
      name:
        'Saag MS, Powderly WG, Cloud GA, et al.; NIAID Mycoses Study Group and the AIDS Clinical Trials Group. Comparison of amphotericin B with fluconazole in the treatment of acute AIDS-associated cryptococcal meningitis. New England Journal of Medicine. 1992;326(2):83-89.',
      url: 'https://doi.org/10.1056/NEJM199201093260202',
      publishedAt: '1992-01-09',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-02-15',
    datePrecision: 'DAY',
    reason:
      'The therapeutic role of fluconazole moved from recorded to settled as it became the standard-of-care azole across its labeled candidal indications. The Infectious Diseases Society of America Clinical Practice Guideline for the Management of Candidiasis: 2016 Update (Pappas et al., Clinical Infectious Diseases 2016) recommends fluconazole as a first-line agent for oropharyngeal, esophageal, and uncomplicated vaginal candidiasis and as step-down therapy for candidemia. Its entrenchment in a major professional-society guideline exemplifies the broad clinical adoption that settled fluconazole as a mainstay antifungal for the label’s primary indications.',
    source: {
      externalId: 'src:idsa-candidiasis-guideline-pappas-cid-2016',
      name:
        'Pappas PG, Kauffman CA, Andes DR, et al. Clinical Practice Guideline for the Management of Candidiasis: 2016 Update by the Infectious Diseases Society of America. Clinical Infectious Diseases. 2016;62(4):e1-e50.',
      url: 'https://doi.org/10.1093/cid/civ933',
      publishedAt: '2016-02-15',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2011-08-03',
    datePrecision: 'DAY',
    reason:
      'The FDA issued a Drug Safety Communication warning that chronic, high-dose (400-800 mg/day) use of oral fluconazole in the first trimester of pregnancy may be associated with a rare and distinctive set of birth defects, and it changed the pregnancy category for these high-dose uses from C to D. A single low 150 mg dose for vaginal candidiasis was not implicated, but the communication introduced an official post-market safety signal that contested the safety framing of an established use. The action moved a settled indication into active safety contestation and prompted revised labeling.',
    source: {
      externalId: 'src:fda-dsc-fluconazole-pregnancy-birth-defects-2011',
      name:
        'U.S. Food and Drug Administration. FDA Drug Safety Communication: Use of long-term, high-dose Diflucan (fluconazole) during pregnancy may be associated with birth defects in infants. August 3, 2011.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-use-long-term-high-dose-diflucan-fluconazole-during-pregnancy-may-be',
      publishedAt: '2011-08-03',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${
      DRY_RUN ? ' (DRY RUN)' : ''
    }`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`)
  }

  for (const t of TRANSITIONS) {
    const s = t.source
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    console.log(
      `  ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${s.externalId})`,
    )
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: s.externalId },
      create: {
        externalId: s.externalId,
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1',
        autoApproved: true,
      },
      update: {
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
