// Enrich the epistemic arc for the Pantoprazole Sodium FDA-label claim
// (openfda_labels_v1).
//
// Claim: cmpiydac08spoplo727hb7wrb — Pantoprazole sodium delayed-release tablets,
// a proton pump inhibitor (PPI) indicated for short-term treatment and maintenance
// of healing of erosive esophagitis associated with GERD, and for pathological
// hypersecretory conditions including Zollinger-Ellison syndrome.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1995  first major published Phase III trial establishing
//                               pantoprazole heals reflux/erosive oesophagitis
//   RECORDED -> SETTLED   2013  ACG GERD practice guideline positions PPIs as the
//                               standard-of-care treatment of choice for erosive
//                               esophagitis healing
//   SETTLED  -> CONTESTED 2016  large observational cohorts link long-term PPI use
//                               to serious harms (chronic kidney disease et al.),
//                               contesting unrestricted use without withdrawal
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-pantoprazole-sodium-ppi-erosive-esophagitis.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-pantoprazole-sodium-ppi-erosive-esophagitis.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiydac08spoplo727hb7wrb'

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
  // ── OPEN -> RECORDED: first major published Phase III pantoprazole trial (1995) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1995-01-01',
    datePrecision: 'YEAR',
    reason:
      'Pantoprazole, a benzimidazole proton pump inhibitor developed by Byk Gulden, entered clinical evaluation in the early 1990s. Mössner and colleagues\' 1995 multicentre double-blind trial in Alimentary Pharmacology & Therapeutics compared pantoprazole against omeprazole for healing reflux oesophagitis, providing the first major published controlled evidence that pantoprazole heals erosive esophagitis at rates comparable to the established reference PPI. This primary clinical evidence underlies the erosive-esophagitis and GERD indications later recorded verbatim in the current FDA label.',
    source: {
      externalId: 'src:pantoprazole-mossner-apt-1995',
      name: 'Mössner J, Hölscher AH, Herz R, Schneider A. A double-blind study of pantoprazole and omeprazole in the treatment of reflux oesophagitis: a multicentre trial. Aliment Pharmacol Ther. 1995;9(3):321–326.',
      url: 'https://doi.org/10.1111/j.1365-2036.1995.tb00387.x',
      publishedAt: '1995-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: ACG GERD guideline names PPIs standard of care (2013) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2013-03-01',
    datePrecision: 'MONTH',
    reason:
      'Through the 2000s proton pump inhibitors became first-line therapy for erosive esophagitis, and the American College of Gastroenterology\'s 2013 "Guidelines for the Diagnosis and Management of Gastroesophageal Reflux Disease" (Katz, Gerson, Vela) recommended an 8-week course of PPIs as the treatment of choice for symptom relief and healing of erosive esophagitis, with maintenance PPI therapy for patients who relapse. This guideline inclusion ratified pantoprazole\'s drug class as standard of care for precisely the indications enumerated in the label — short-term treatment and maintenance of healing of erosive esophagitis associated with GERD.',
    source: {
      externalId: 'src:pantoprazole-acg-gerd-guideline-2013',
      name: 'Katz PO, Gerson LB, Vela MF. Guidelines for the Diagnosis and Management of Gastroesophageal Reflux Disease. Am J Gastroenterol. 2013;108(3):308–328.',
      url: 'https://doi.org/10.1038/ajg.2012.444',
      publishedAt: '2013-03-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: observational cohorts tie long-term PPI use to harm (2016) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2016-02-01',
    datePrecision: 'MONTH',
    reason:
      'After a decade as standard therapy, large observational cohorts began linking long-term PPI use to serious harms. Lazarus and colleagues\' 2016 analysis in JAMA Internal Medicine reported that PPI use (the class that includes pantoprazole) was independently associated with a higher risk of incident chronic kidney disease. It was part of a wave of post-marketing safety signals — alongside FDA warnings on hypomagnesemia and fracture and reports of C. difficile infection — that contested unrestricted long-term PPI use and prompted deprescribing guidance without withdrawing the approved erosive-esophagitis and hypersecretory indications.',
    source: {
      externalId: 'src:pantoprazole-ppi-ckd-jama-2016',
      name: 'Lazarus B, Chen Y, Wilson FP, et al. Proton Pump Inhibitor Use and the Risk of Chronic Kidney Disease. JAMA Intern Med. 2016;176(2):238–246.',
      url: 'https://doi.org/10.1001/jamainternmed.2015.7193',
      publishedAt: '2016-02-01',
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
