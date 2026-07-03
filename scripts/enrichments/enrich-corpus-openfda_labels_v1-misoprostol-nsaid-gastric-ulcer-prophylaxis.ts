// Enrichment: epistemic trajectory for the FDA drug-label claim covering
// MISOPROSTOL indicated for reducing the risk of NSAID-induced gastric ulcers in
// patients at high risk of ulcer complications.
//
// The subject fact is misoprostol (a synthetic prostaglandin E1 analog, marketed
// as Cytotec by Searle and FDA-approved December 1988) as gastroprotective
// prophylaxis for NSAID-induced gastric ulcers. The pivotal supporting trial was
// Graham DY, Agrawal NM, Roth SH. "Prevention of NSAID-induced gastric ulcer with
// misoprostol: multicentre, double-blind, placebo-controlled trial." Lancet.
// 1988;2(8623):1277-1280 — the endoscopic-endpoint evidence behind the approval.
//
// The claim already carries its null -> RECORDED first entry (the drug approval /
// first published clinical evidence that misoprostol prevents NSAID gastric
// ulcers). This script adds the downstream arc:
//
//   RECORDED -> SETTLED (1995): The MUCOSA trial (Silverstein et al., Annals of
//     Internal Medicine) moved the evidence from surrogate endoscopic endpoints to
//     a hard clinical outcome, demonstrating that misoprostol reduced serious upper
//     gastrointestinal complications by ~40% in NSAID-treated rheumatoid arthritis
//     patients. This outcomes trial anchored gastroenterology and rheumatology
//     guideline recommendations and established misoprostol as standard-of-care
//     gastroprotection for high-risk NSAID users.
//
//   SETTLED -> CONTESTED (1998): The OMNIUM randomized trial (Hawkey et al., NEJM)
//     showed the proton-pump inhibitor omeprazole was better tolerated than and at
//     least as effective as misoprostol for healing and preventing NSAID-associated
//     ulcers. Combined with misoprostol's dose-limiting diarrhea/abdominal cramping,
//     its four-times-daily dosing, and its abortifacient boxed warning, PPIs rapidly
//     displaced misoprostol as first-line gastroprotection — contesting its
//     standard-of-care status for this indication.
//
// Only high-confidence, DOI-anchored arcs are encoded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-misoprostol-nsaid-gastric-ulcer-prophylaxis.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-misoprostol-nsaid-gastric-ulcer-prophylaxis.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyhizq8xmiplo7xtjo741x'

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

// Do NOT duplicate the existing null -> RECORDED first entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1995-08-15',
    datePrecision: 'DAY',
    reason:
      "Misoprostol's gastroprotective benefit graduated from surrogate endoscopic endpoints to a hard clinical outcome with the MUCOSA trial. This large randomized, double-blind, placebo-controlled trial (~8,800 rheumatoid arthritis patients on NSAIDs) found misoprostol reduced serious upper gastrointestinal complications — perforation, obstruction, and bleeding — by about 40%. The outcomes evidence anchored gastroenterology and rheumatology guideline recommendations and settled misoprostol as standard-of-care prophylaxis for high-risk NSAID users.",
    source: {
      externalId: 'src:mucosa-misoprostol-annals-1995',
      name:
        'Silverstein FE, Graham DY, Senior JR, Davies HW, Struthers BJ, Bittman RM, Geis GS. Misoprostol reduces serious gastrointestinal complications in patients with rheumatoid arthritis receiving nonsteroidal anti-inflammatory drugs. A randomized, double-blind, placebo-controlled trial. Ann Intern Med. 1995;123(4):241-249.',
      url: 'https://doi.org/10.7326/0003-4819-123-4-199508150-00001',
      publishedAt: '1995-08-15',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1998-03-12',
    datePrecision: 'DAY',
    reason:
      "Misoprostol's standing as first-line NSAID gastroprotection was contested by the emergence of proton-pump inhibitors. The OMNIUM randomized trial found omeprazole was better tolerated than, and at least as effective as, misoprostol for healing NSAID-associated ulcers and preventing relapse. Combined with misoprostol's dose-limiting diarrhea and cramping, its four-times-daily dosing, and its abortifacient boxed warning, this signal drove PPIs to rapidly displace misoprostol as the preferred gastroprotective agent for this indication.",
    source: {
      externalId: 'src:omnium-omeprazole-misoprostol-nejm-1998',
      name:
        'Hawkey CJ, Karrasch JA, Szczepanski L, Walker DG, Barkun A, Swannell AJ, Yeomans ND. Omeprazole compared with misoprostol for ulcers associated with nonsteroidal antiinflammatory drugs. Omeprazole versus Misoprostol for NSAID-induced Ulcer Management (OMNIUM) Study Group. N Engl J Med. 1998;338(11):727-734.',
      url: 'https://doi.org/10.1056/NEJM199803123381105',
      publishedAt: '1998-03-12',
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
