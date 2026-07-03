// Enrichment: epistemic arc for the FDA PROSTIN VR PEDIATRIC (alprostadil) label claim.
//
// Claim: cmpiykeg290woplo7qjwb8tag (openfda_labels_v1)
//   PROSTIN VR PEDIATRIC (ALPROSTADIL / prostaglandin E1) — indicated for
//   palliative therapy to temporarily maintain patency of the ductus arteriosus
//   until corrective or palliative surgery in neonates with ductal-dependent
//   congenital heart defects (pulmonary atresia, pulmonary stenosis, tricuspid
//   atresia, tetralogy of Fallot, interruption of the aortic arch, etc.).
//
// Arc (extends the existing fromAxis=null -> OPEN entry; do not duplicate it):
//   OPEN     -> RECORDED (1976-04) Olley, Coceani & Bodach, Circulation — the
//                         first published clinical demonstration that E-type
//                         prostaglandins reopen and maintain the ductus
//                         arteriosus in neonates with cyanotic ductal-dependent
//                         malformations. Ratified by EXPERT_LITERATURE.
//   RECORDED -> SETTLED  (1981-11) Freed, Heymann, Lewis et al., Circulation —
//                         the multicenter collaborative study of 492 infants
//                         that established PGE1 efficacy across the full range of
//                         ductus-dependent defects, driving broad clinical
//                         adoption as the standard temporizing therapy the same
//                         year PROSTIN VR PEDIATRIC received FDA approval.
//
// NO SETTLED -> CONTESTED / REVERSED transition is included. Alprostadil for
// maintaining ductal patency remains the neonatal standard of care and has never
// been withdrawn. The well-known apnea boxed warning (~10-12% of treated
// neonates) has been present on the label since the 1981 approval — it is an
// intrinsic caution recognized at the time of adoption, not a later post-market
// safety signal that overturns or contests the efficacy indication. Per the
// AGENTS.md hard-fact principles, no safety transition is fabricated beyond what
// the cited record supports.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-prostin-vr-pediatric-alprostadil.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiykeg290woplo7qjwb8tag'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1976-04-01',
    datePrecision: 'MONTH',
    reason:
      'Olley, Coceani and Bodach reported the first clinical use of E-type prostaglandins as emergency therapy to reopen and maintain patency of the ductus arteriosus in neonates with cyanotic, ductus-dependent congenital heart malformations. This was the first authoritative published clinical evidence for the exact mechanism the PROSTIN VR PEDIATRIC label rests on — pharmacologically sustaining the ductus in newborns who depend on it for survival — transforming an open therapeutic idea into a recorded clinical observation.',
    source: {
      externalId: 'src:prostin-alprostadil-olley-coceani-1976',
      name: 'Olley PM, Coceani F, Bodach E. "E-type prostaglandins: a new emergency therapy for certain cyanotic congenital heart malformations." Circulation 1976;53(4):728-731.',
      url: 'https://doi.org/10.1161/01.CIR.53.4.728',
      publishedAt: '1976-04-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1981-11-01',
    datePrecision: 'MONTH',
    reason:
      'The multicenter collaborative study by Freed, Heymann, Lewis and colleagues evaluated prostaglandin E1 in 492 infants with ductus arteriosus-dependent congenital heart disease and documented reliable improvement in oxygenation and systemic perfusion across the full range of ductal-dependent lesions. This large collaborative evaluation established PGE1 as the accepted standard temporizing therapy pending corrective or palliative surgery and coincided with the 1981 FDA approval of PROSTIN VR PEDIATRIC, settling the therapeutic consensus behind the labeled indication.',
    source: {
      externalId: 'src:prostin-alprostadil-freed-1981',
      name: 'Freed MD, Heymann MA, Lewis AB, Roehl SL, Kensey RC. "Prostaglandin E1 in infants with ductus arteriosus-dependent congenital heart disease." Circulation 1981;64(5):899-905.',
      url: 'https://doi.org/10.1161/01.CIR.64.5.899',
      publishedAt: '1981-11-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const occurredAt = new Date(t.occurredAt)
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
    })

    console.log(`upserted ${slug} (${t.fromAxis} -> ${t.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
