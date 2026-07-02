// Enrich the epistemic arc for the Prostin VR Pediatric (ALPROSTADIL) FDA-label
// claim (openfda_labels_v1).
//
// Claim: cmpiycr6a8s2cplo7zb6kc4vm — "PROSTIN VR PEDIATRIC (ALPROSTADIL):
// INDICATIONS AND USAGE ... indicated for palliative ... therapy to temporarily
// maintain the patency of the ductus arteriosus until corrective or palliative
// surgery can be performed in neonates who have congenital heart defects and who
// depend upon the patent ductus for survival."
//
// Alprostadil is prostaglandin E1 (PGE1). The therapeutic idea — that an E-type
// prostaglandin can hold the ductus arteriosus open and rescue neonates with
// ductal-dependent congenital heart defects until surgery — moved from bench
// pharmacology (Coceani & Olley) to emergency clinical use, to a multicenter
// standard of care, and later acquired a recognized iatrogenic complication of
// prolonged infusion.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1976-04  first published clinical use of E-type PGE to
//                                  rescue cyanotic ductal-dependent neonates (Olley,
//                                  Coceani & Bodach, Circulation)
//   RECORDED -> SETTLED   1981-11  multicenter cooperative study of PGE1 in 492
//                                  ductus-dependent infants codifies standard of
//                                  care (Freed et al., Circulation), coincident with
//                                  FDA approval of Prostin VR Pediatric
//   SETTLED  -> CONTESTED 1992-11  NEJM reports gastric-outlet obstruction / antral
//                                  foveolar hyperplasia from prolonged PGE infusion —
//                                  a serious post-market complication that qualifies,
//                                  but does not reverse, the indication
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-alprostadil-prostin-vr-ductus-arteriosus.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-alprostadil-prostin-vr-ductus-arteriosus.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiycr6a8s2cplo7zb6kc4vm'

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
  // ── OPEN -> RECORDED: first published clinical use of E-type PGE in cyanotic ductal-dependent neonates (1976) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1976-04-01',
    datePrecision: 'MONTH',
    reason:
      'Olley, Coceani and Bodach reported that infusing an E-type prostaglandin (PGE1/PGE2) reopened and maintained the ductus arteriosus in neonates with cyanotic ductal-dependent congenital heart malformations, restoring oxygenation as an emergency bridge to surgery (Circulation, 1976). Building on Coceani and Olley\'s bench demonstration that E-type prostaglandins relax ductal smooth muscle, this was among the first published clinical evidence that alprostadil (PGE1) could temporarily preserve ductal patency — exactly the mechanism the Prostin VR Pediatric label records.',
    source: {
      externalId: 'src:alprostadil-olley-coceani-etype-pge-1976',
      name: 'Olley PM, Coceani F, Bodach E. E-type prostaglandins: a new emergency therapy for certain cyanotic congenital heart malformations. Circulation. 1976;53(4):728–731.',
      url: 'https://doi.org/10.1161/01.CIR.53.4.728',
      publishedAt: '1976-04-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: multicenter cooperative study codifies standard of care, coincident with FDA approval (1981) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1981-11-01',
    datePrecision: 'MONTH',
    reason:
      'The multicenter cooperative study by Freed, Heymann, Lewis and colleagues reported prostaglandin E1 infusion in 492 infants with ductus-arteriosus-dependent congenital heart disease, demonstrating consistent improvement in oxygenation and systemic perfusion and establishing PGE1 as the standard temporizing therapy before corrective or palliative surgery (Circulation, 1981). Published the same year the FDA approved Prostin VR Pediatric (alprostadil injection), it codified the palliative indication across institutions into an accepted standard of care.',
    source: {
      externalId: 'src:alprostadil-freed-multicenter-pge1-1981',
      name: 'Freed MD, Heymann MA, Lewis AB, Roehl SL, Kensey RC. Prostaglandin E1 in infants with ductus arteriosus-dependent congenital heart disease. Circulation. 1981;64(5):899–905.',
      url: 'https://doi.org/10.1161/01.CIR.64.5.899',
      publishedAt: '1981-11-01',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: NEJM reports gastric-outlet obstruction from prolonged PGE infusion (1992) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1992-11-19',
    datePrecision: 'DAY',
    reason:
      'Peled and colleagues reported in the New England Journal of Medicine that prolonged prostaglandin E1 infusion in neonates induced antral foveolar hyperplasia and gastric-outlet obstruction, a dose- and duration-dependent iatrogenic complication that reversed on stopping the drug. Together with the label\'s established apnea and cortical-hyperostosis warnings, the finding contested alprostadil\'s tolerability during extended ductal maintenance and reinforced that Prostin VR is palliative and time-limited — qualifying, but not reversing, the ductal-patency indication.',
    source: {
      externalId: 'src:alprostadil-peled-gastric-outlet-obstruction-1992',
      name: 'Peled N, Dagan O, Babyn P, et al. Gastric-outlet obstruction induced by prostaglandin therapy in neonates. N Engl J Med. 1992;327(21):1505–1510.',
      url: 'https://doi.org/10.1056/NEJM199211193272107',
      publishedAt: '1992-11-19',
      methodologyType: 'primary',
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
