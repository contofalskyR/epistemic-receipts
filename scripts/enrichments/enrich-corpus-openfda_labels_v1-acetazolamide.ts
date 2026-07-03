// Enrichment: epistemic arc for the acetazolamide FDA-label claim
// (openfda_labels_v1, claim cmpixrswa83s6plo7eoxhvok4).
//
// Adds ClaimStatusHistory rows for acetazolamide's clinical trajectory as a
// carbonic anhydrase inhibitor (acute mountain sickness / glaucoma threads):
//   OPEN     -> RECORDED   Forwand et al. controlled AMS trial (NEJM, 1968)
//   RECORDED -> SETTLED    Wilderness Medical Society altitude-illness guideline (2019)
//   SETTLED  -> CONTESTED  Post-market sulfonamide blood-dyscrasia safety signal (1985)
//
// Idempotent: upserts Sources on externalId and ClaimStatusHistory rows on a
// deterministic `${claimId}-${toAxis}-${occurredAt}` slug id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-acetazolamide.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-acetazolamide.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpixrswa83s6plo7eoxhvok4'

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
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // ── OPEN -> RECORDED: first controlled clinical trial of acetazolamide (AMS) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1968-10-17',
    datePrecision: 'DAY',
    reason:
      'Forwand and colleagues published the first double-blind, placebo-controlled trial of acetazolamide for acute mountain sickness in the New England Journal of Medicine in October 1968, showing that the drug significantly reduced AMS symptom scores in men rapidly ascending to high altitude. This provided the first rigorous clinical evidence for acetazolamide\'s labeled indication in the prevention and amelioration of acute mountain-sickness symptoms. It moved acetazolamide from an open hypothesis about carbonic-anhydrase inhibition to a recorded, trial-supported therapy.',
    source: {
      externalId: 'src:forwand-acetazolamide-ams-nejm-1968',
      name: 'Forwand SA, Landowne M, Follansbee JN, Hansen JE. Effect of acetazolamide on acute mountain sickness. N Engl J Med. 1968;279(16):839–845.',
      url: 'https://doi.org/10.1056/NEJM196810172791601',
      publishedAt: '1968-10-17',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: professional-society guideline standard-of-care status ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2019-12-01',
    datePrecision: 'MONTH',
    reason:
      'The Wilderness Medical Society Clinical Practice Guidelines for the Prevention and Treatment of Acute Altitude Illness (2019 update) give acetazolamide a strong recommendation as first-line chemoprophylaxis and treatment for acute mountain sickness. By this point acetazolamide was entrenched standard of care for altitude illness and a long-standing carbonic-anhydrase inhibitor for glaucoma, and it appears on the WHO Model List of Essential Medicines. Its efficacy for the labeled indications was settled clinical consensus rather than an open research question.',
    source: {
      externalId: 'src:wms-acute-altitude-illness-guideline-2019',
      name: 'Luks AM, Auerbach PS, Freer L, et al. Wilderness Medical Society Clinical Practice Guidelines for the Prevention and Treatment of Acute Altitude Illness: 2019 Update. Wilderness Environ Med. 2019;30(4S):S3–S18.',
      url: 'https://doi.org/10.1016/j.wem.2019.04.006',
      publishedAt: '2019-12-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: post-market sulfonamide blood-dyscrasia safety signal ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1985-07-01',
    datePrecision: 'MONTH',
    reason:
      'Post-marketing surveillance identified rare but fatal idiosyncratic reactions to acetazolamide as a sulfonamide derivative. Fraunfelder and colleagues (1985) documented a case series of blood dyscrasias — including fatal aplastic anemia — attributed to carbonic anhydrase inhibitors, and the FDA-approved label warns that fatalities have occurred from Stevens–Johnson syndrome, toxic epidermal necrolysis, fulminant hepatic necrosis, agranulocytosis, and aplastic anemia. These signals contested the safety of a long-settled drug and drove hematologic-monitoring recommendations, though the labeled indications were not withdrawn.',
    source: {
      externalId: 'src:fraunfelder-cai-hematologic-reactions-1985',
      name: 'Fraunfelder FT, Meyer SM, Bagby GC Jr, Dreis MW. Hematologic reactions to carbonic anhydrase inhibitors. Am J Ophthalmol. 1985;100(1):79–81.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/4014377/',
      publishedAt: '1985-07-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(
        `[dry-run] ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${t.datePrecision})  src=${t.source.externalId}  id=${slug}`,
      )
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-openfda_labels_v1',
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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

    console.log(`upserted ${slug}  (${t.fromAxis ?? 'null'} -> ${t.toAxis})`)
  }

  console.log(DRY_RUN ? 'dry-run complete' : 'enrichment complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
