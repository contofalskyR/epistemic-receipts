// Enrichment: epistemic arc for the FDA drug-label claim on OXYBUTYNIN CHLORIDE.
//
// Claim: cmpiyehaf8u4cplo7mikv19jw (openfda_labels_v1)
//   "Oxybutynin chloride is a muscarinic antagonist indicated for the treatment
//    of overactive bladder ... extended-release tablets ... pediatric patients
//    aged 6 years and older with detrusor overactivity associated with a
//    neurological condition (e.g., spina bifida)."
//
// Adds ClaimStatusHistory rows for the drug's epistemic trajectory:
//   OPEN    -> RECORDED  (1972) first clinical report of oxybutynin's
//                        anticholinergic/antispasmodic action on the bladder
//   RECORDED-> SETTLED   (2012) AUA/SUFU guideline makes antimuscarinics
//                        (incl. oxybutynin) standard OAB pharmacotherapy
//   SETTLED -> CONTESTED (2015) strong-anticholinergic dementia signal (Gray
//                        et al., JAMA Internal Medicine) puts its safety in
//                        older adults under active contest
//
// The existing fromAxis=null -> toAxis=OPEN row is NOT recreated here.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-oxybutynin-chloride.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiyehaf8u4cplo7mikv19jw'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
    occurredAt: '1972-09-01',
    datePrecision: 'MONTH',
    reason:
      'Oxybutynin\'s use for detrusor overactivity entered the clinical record with Diokno and Lapides\' 1972 report in The Journal of Urology, "Oxybutynin: a new drug with analgesic and anticholinergic properties," which described its antispasmodic and anticholinergic action on the bladder detrusor. This founding clinical evidence supported the U.S. introduction of oxybutynin (Ditropan) for bladder instability in 1975. The muscarinic-antagonist mechanism the FDA label now states was first placed on the scientific register here.',
    source: {
      externalId: 'src:oxybutynin-diokno-lapides-1972',
      name: 'Diokno AC, Lapides J. Oxybutynin: a new drug with analgesic and anticholinergic properties. J Urol. 1972;108(2):307–309 — as documented in the Oxybutynin drug monograph.',
      url: 'https://en.wikipedia.org/wiki/Oxybutynin',
      publishedAt: '1972-09-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2012-05-01',
    datePrecision: 'MONTH',
    reason:
      'The 2012 American Urological Association / Society of Urodynamics, Female Pelvic Medicine & Urogenital Reconstruction (AUA/SUFU) guideline "Diagnosis and Treatment of Overactive Bladder (Non-Neurogenic) in Adults" established oral antimuscarinics — with oxybutynin as the prototypical agent — as standard second-line pharmacotherapy for overactive bladder. Guideline endorsement by the field\'s primary professional body settled oxybutynin\'s status as an accepted standard-of-care treatment for the indication the FDA label states.',
    source: {
      externalId: 'src:oxybutynin-aua-sufu-oab-guideline-2012',
      name: 'Gormley EA, Lightner DJ, Burgio KL, et al. Diagnosis and Treatment of Overactive Bladder (Non-Neurogenic) in Adults: AUA/SUFU Guideline. J Urol. 2012;188(6 Suppl):2455–2463.',
      url: 'https://doi.org/10.1016/j.juro.2012.09.079',
      publishedAt: '2012-05-01',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-01-26',
    datePrecision: 'DAY',
    reason:
      'Gray et al.\'s prospective cohort study "Cumulative Use of Strong Anticholinergics and Incident Dementia," published in JAMA Internal Medicine on 26 January 2015, found a dose-dependent association between cumulative strong-anticholinergic exposure and incident dementia — with oxybutynin among the strong anticholinergics driving the signal. This evidence, reinforced by the drug\'s listing in the AGS Beers Criteria as potentially inappropriate in older adults, moved oxybutynin\'s safety profile in the elderly from settled acceptance into active contest, prompting guideline shifts toward lower-anticholinergic alternatives.',
    source: {
      externalId: 'src:oxybutynin-anticholinergic-dementia-gray-2015',
      name: 'Gray SL, Anderson ML, Dublin S, et al. Cumulative Use of Strong Anticholinergics and Incident Dementia: A Prospective Cohort Study. JAMA Intern Med. 2015;175(3):401–407.',
      url: 'https://doi.org/10.1001/jamainternmed.2014.7663',
      publishedAt: '2015-01-26',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1-oxybutynin-chloride',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const id = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id },
      create: {
        id,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${id})`)
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
