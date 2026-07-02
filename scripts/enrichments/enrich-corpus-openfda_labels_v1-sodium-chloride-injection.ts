// Enrichment: epistemic arc for the Sodium Chloride Injection, USP claim
// (openfda_labels_v1, claim cmpiye57n8tqiplo793oblfp4).
//
// Adds ClaimStatusHistory rows tracing normal saline's arc as a parenteral
// fluid / diluent:
//   OPEN    -> RECORDED  (1832)  first clinical intravenous saline (Latta, cholera)
//   RECORDED-> SETTLED   (1977)  WHO Essential Medicines listing / global standard of care
//   SETTLED -> CONTESTED (2018)  SMART trial signals harm vs. balanced crystalloids
//
// Does NOT create or modify the Claim (id already exists). Idempotent: upserts
// Source on externalId and ClaimStatusHistory on a deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-sodium-chloride-injection.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiye57n8tqiplo793oblfp4'

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
  occurredAt: string // full YYYY-MM-DD (used for slug + Date)
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  // ── 1832: first clinical intravenous saline (Thomas Latta, cholera epidemic) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1832-06-01',
    datePrecision: 'YEAR',
    reason:
      'During the 1832 cholera epidemic Thomas Latta reported infusing an aqueous saline solution directly into the veins of collapsing patients, the first documented clinical use of intravenous sodium chloride for fluid and electrolyte replenishment, communicated to The Lancet. This established the empirical basis for parenteral saline as a fluid-replacement therapy. The composition later standardized as "normal"/0.9% saline, whose history is reviewed by Awad, Allison and Lobo.',
    source: {
      externalId: 'src:saline-history-awad-2008',
      name: 'Awad S, Allison SP, Lobo DN. The history of 0.9% saline. Clinical Nutrition. 2008;27(2):179-188.',
      url: 'https://doi.org/10.1016/j.clnu.2008.01.008',
      publishedAt: '2008-04-01',
      methodologyType: 'derivative',
    },
  },

  // ── 1977: WHO Essential Medicines listing — global standard-of-care fluid ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1977-10-01',
    datePrecision: 'YEAR',
    reason:
      'Sodium chloride injectable solution has been carried on the WHO Model List of Essential Medicines since the first list in 1977, formalizing intravenous saline as a globally endorsed standard-of-care agent for parenteral fluid and electrolyte replacement and as a diluent. Its inclusion reflects settled institutional consensus on the indication captured in the FDA label. The medicine remains on the current WHO Model List.',
    source: {
      externalId: 'src:who-eml-sodium-chloride',
      name: 'WHO Model Lists of Essential Medicines — sodium chloride, injectable solution (parenteral fluid replacement).',
      url: 'https://www.who.int/groups/expert-committee-on-selection-and-use-of-essential-medicines/essential-medicines-lists',
      publishedAt: '1977-10-01',
      methodologyType: 'derivative',
    },
  },

  // ── 2018: SMART trial — safety signal vs. balanced crystalloids ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2018-03-01',
    datePrecision: 'MONTH',
    reason:
      'The SMART trial (Semler et al., NEJM 2018) randomized 15,802 critically ill adults and found that 0.9% saline was associated with a higher rate of major adverse kidney events than balanced crystalloids, attributed in part to hyperchloremic acidosis. Together with the companion SALT-ED trial, it turned saline\'s default status into an active clinical controversy over whether normal saline should remain the standard replacement fluid. The indication itself is unchanged, but the choice of saline versus balanced solutions is now contested in the critical-care literature.',
    source: {
      externalId: 'src:smart-trial-nejm-2018',
      name: 'Semler MW, Self WH, Wanderer JP, et al. Balanced Crystalloids versus Saline in Critically Ill Adults. N Engl J Med. 2018;378:829-839.',
      url: 'https://doi.org/10.1056/NEJMoa1711584',
      publishedAt: '2018-03-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    const src = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        externalId: t.source.externalId,
        ingestedBy: 'enrich-openfda_labels_v1',
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

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
        sourceId: src.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: src.id,
      },
    })

    console.log(`upserted ${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt} (${slug})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
