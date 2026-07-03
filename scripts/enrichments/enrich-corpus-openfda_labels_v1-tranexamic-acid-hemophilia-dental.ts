// Enrichment: epistemic trajectory for an openFDA-label-ingested claim asserting
// the indication of tranexamic acid injection (an antifibrinolytic) in patients
// with hemophilia for short-term use to reduce/prevent hemorrhage and reduce the
// need for replacement therapy during and following tooth extraction.
//
// Underlying record: openFDA structured product label for Tranexamic Acid
// injection, INDICATIONS & USAGE section (openfda_labels_v1).
//
// The claim already has its OPEN/null -> RECORDED first entry (the FDA label /
// ingest). This script adds the downstream epistemic arc that predates and
// surrounds the label indication:
//
//   OPEN -> RECORDED (1972): The first controlled clinical evidence that
//     tranexamic acid controls post-extraction hemorrhage in haemophilia and
//     Christmas disease (Forbes et al., BMJ 1972) — the primary trial that put
//     the dental-extraction indication on the record.
//
//   RECORDED -> SETTLED (2020): Antifibrinolytics (tranexamic acid) for dental
//     and mucosal procedures in persons with hemophilia became codified standard
//     of care in the World Federation of Hemophilia (WFH) Guidelines for the
//     Management of Hemophilia, 3rd edition (Srivastava et al., 2020).
//
//   SETTLED -> CONTESTED (2012): A post-market mechanistic safety signal — the
//     demonstration that clinically relevant tranexamic acid concentrations
//     inhibit inhibitory glycine (and GABA_A) receptors, the molecular basis of
//     TXA-associated seizures (Lecker et al., JCI 2012) — contested the safety
//     framing of injectable tranexamic acid without overturning the indication.
//
// Only high-confidence, DOI-anchored arcs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-tranexamic-acid-hemophilia-dental.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-tranexamic-acid-hemophilia-dental.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiy2xfk8hsiplo7rabmmugu'

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

// The existing null -> RECORDED entry (the FDA label ingest, dated 2026-05-12)
// is left untouched. Because the recorded evidence for the dental-extraction
// indication long predates the label, this arc adds an EARLIER RECORDED marker
// (the 1972 primary trial) plus the downstream SETTLED and CONTESTED events.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1972-05-06',
    datePrecision: 'DAY',
    reason:
      "The proposition that the antifibrinolytic tranexamic acid controls bleeding after tooth extraction in bleeding-disorder patients was first put on the clinical record by a controlled trial in the British Medical Journal. Forbes and colleagues studied tranexamic acid in patients with haemophilia and Christmas disease (haemophilia B) undergoing dental extraction and found it markedly reduced post-extraction haemorrhage and the requirement for replacement clotting-factor therapy. This established the primary evidence base for the dental-extraction indication that the FDA product label later codified.",
    source: {
      externalId: 'src:forbes-txa-dental-haemophilia-bmj-1972',
      name:
        'Forbes CD, Barr RD, Reid G, Thomson C, Prentice CRM, McNicol GP, Douglas AS. Tranexamic acid in control of haemorrhage after dental extraction in haemophilia and Christmas disease. British Medical Journal. 1972;2(5809):311-313.',
      url: 'https://doi.org/10.1136/bmj.2.5809.311',
      publishedAt: '1972-05-06',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-08-01',
    datePrecision: 'MONTH',
    reason:
      "Use of antifibrinolytics — tranexamic acid specifically — to cover dental extractions and other mucosal procedures in persons with hemophilia became codified standard of care in the World Federation of Hemophilia (WFH) Guidelines for the Management of Hemophilia, 3rd edition. The guideline recommends antifibrinolytic agents, alone or with reduced replacement therapy, to prevent or control oral/mucosal bleeding, settling the short-term dental-extraction indication as consensus best practice across the hemophilia treatment community.",
    source: {
      externalId: 'src:wfh-guidelines-hemophilia-3rd-ed-2020',
      name:
        'Srivastava A, Santagostino E, Dougall A, et al. WFH Guidelines for the Management of Hemophilia, 3rd edition. Haemophilia. 2020;26(Suppl 6):1-158.',
      url: 'https://doi.org/10.1111/hae.14046',
      publishedAt: '2020-08-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2012-11-19',
    datePrecision: 'DAY',
    reason:
      "A post-market mechanistic safety signal contested the favorable safety framing of injectable tranexamic acid. Lecker and colleagues showed that tranexamic acid, at concentrations reached clinically, inhibits inhibitory glycine receptors (and GABA_A receptors) in the central nervous system — providing the molecular explanation for TXA-associated seizures reported after high-dose intravenous use. The finding did not overturn the antifibrinolytic indication but reopened debate over the injectable formulation's convulsant risk, dosing, and route-of-administration errors, moving the safety proposition from settled into active contestation.",
    source: {
      externalId: 'src:lecker-txa-glycine-receptor-seizures-jci-2012',
      name:
        'Lecker I, Wang DS, Romaschin AD, Peterson M, Mazer CD, Orser BA. Tranexamic acid concentrations associated with human seizures inhibit glycine receptors. Journal of Clinical Investigation. 2012;122(12):4654-4666.',
      url: 'https://doi.org/10.1172/JCI63375',
      publishedAt: '2012-11-19',
      methodologyType: 'primary',
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
