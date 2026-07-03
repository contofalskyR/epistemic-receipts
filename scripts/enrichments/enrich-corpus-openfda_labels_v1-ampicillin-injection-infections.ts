// Enrich the epistemic arc for the Ampicillin FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiy5qcj8kgoplo717m4tj7n — Ampicillin for injection indicated for
// susceptible respiratory-tract infections, bacterial meningitis, and other
// infections caused by designated Gram-positive and Gram-negative organisms.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1961  first microbiological/clinical evaluation of the
//                               broad-spectrum semisynthetic penicillin (BRL 1341 / "Penbritin")
//   RECORDED -> SETTLED   1977  inclusion on the first WHO Model List of Essential
//                               Medicines — global standard-of-care ratification
//   SETTLED  -> CONTESTED 1974  emergence of β-lactamase-producing ampicillin-resistant
//                               Haemophilus influenzae — post-market efficacy signal against
//                               several designated organisms in the label indication
//
// Note: the resistance signal (1974) predates the WHO EML listing (1977). The arc
// is ordered by epistemic axis (RECORDED->SETTLED->CONTESTED), not strictly by date;
// occurredAt carries the true historical date of each marker. Ampicillin remains an
// approved, WHO-essential drug, so the terminal state is CONTESTED, not REVERSED.
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-ampicillin-injection-infections.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-ampicillin-injection-infections.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy5qcj8kgoplo717m4tj7n'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: first microbiological/clinical evaluation (1961) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1961-01-01',
    datePrecision: 'YEAR',
    reason:
      'Ampicillin (Beecham compound BRL 1341, "Penbritin") was first characterised in 1961 as a semisynthetic penicillin active against both Gram-positive and Gram-negative organisms, with Rolinson and Stevens publishing the microbiological studies establishing its broad spectrum. This primary evidence — activity against organisms such as H. influenzae, E. coli, and Gram-negative bacteria — is the clinical basis for the indications later captured verbatim in the FDA label.',
    source: {
      externalId: 'src:ampicillin-rolinson-stevens-1961',
      name: 'Rolinson GN, Stevens S. Microbiological studies on a new broad-spectrum penicillin, "Penbritin". Br Med J. 1961;2(5246):191–196. (Ampicillin / BRL 1341 first evaluation)',
      url: 'https://en.wikipedia.org/wiki/Ampicillin',
      publishedAt: '1961-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: first WHO Model List of Essential Medicines (1977) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1977-01-01',
    datePrecision: 'YEAR',
    reason:
      'Ampicillin was included on the first WHO Model List of Essential Medicines in 1977, ratifying it internationally as a standard-of-care antibacterial and confirming its role in the treatment of the susceptible infections named in its label. Inclusion by an institutional guideline body settled the therapeutic indication far beyond the original clinical literature.',
    source: {
      externalId: 'src:ampicillin-who-eml-1977',
      name: 'WHO Model List of Essential Medicines — ampicillin listed since the first edition (1977); retained through the current (23rd, 2023) edition.',
      url: 'https://en.wikipedia.org/wiki/WHO_Model_List_of_Essential_Medicines',
      publishedAt: '1977-01-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: ampicillin-resistant H. influenzae emerges (1974) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1974-01-01',
    datePrecision: 'YEAR',
    reason:
      'Beginning in 1974, β-lactamase-producing ampicillin-resistant strains of Haemophilus influenzae were reported, followed by widespread resistance in E. coli and other Gram-negative bacteria named in the label indication. This post-market efficacy signal contests empiric use of ampicillin for the respiratory-tract and bacterial-meningitis indications — which now require susceptibility confirmation — without reversing the approval, so the drug remains indicated only against demonstrably susceptible strains.',
    source: {
      externalId: 'src:ampicillin-resistance-h-influenzae-1974',
      name: 'Emergence of β-lactamase-producing, ampicillin-resistant Haemophilus influenzae (first reported 1974) and subsequent Gram-negative resistance — antimicrobial-resistance record.',
      url: 'https://en.wikipedia.org/wiki/Antimicrobial_resistance',
      publishedAt: '1974-01-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${historyId})`)
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda-labels',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
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

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Done — ${TRANSITIONS.length} transitions processed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
