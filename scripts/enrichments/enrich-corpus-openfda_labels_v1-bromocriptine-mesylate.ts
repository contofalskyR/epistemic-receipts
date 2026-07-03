// Epistemic-arc enrichment for the FDA drug-label claim:
//   Bromocriptine Mesylate — Hyperprolactinemia-Associated Dysfunctions
//   Claim id: cmpiykbsw90suplo7ai7ouvzj  (ingestedBy: openfda_labels_v1)
//
// Adds ClaimStatusHistory rows tracing the drug's epistemic arc:
//   OPEN    -> RECORDED  first published clinical evidence (del Pozo 1974)
//   RECORDED-> SETTLED   established as primary therapy (Molitch multicenter 1985)
//   SETTLED -> CONTESTED post-market safety signal / FDA withdrawal of the
//                        postpartum lactation-suppression indication (1994)
//
// Does NOT create a new Claim — it attaches history to the existing claim.
// The existing first entry (fromAxis=null -> RECORDED at label ingest) is left
// untouched; these rows carry the dateable historical arc.
//
// Idempotent: upserts sources and status-history rows.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-bromocriptine-mesylate.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpiykbsw90suplo7ai7ouvzj'

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
  // ── OPEN -> RECORDED : first published clinical evidence ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1974-07-01',
    datePrecision: 'MONTH',
    reason:
      'Del Pozo and colleagues published the first systematic clinical and hormonal study of the ergot dopamine agonist bromocriptine (CB-154) in women with the galactorrhea–amenorrhea syndromes, showing that it suppressed elevated serum prolactin and restored menses and ovulation. This established, in the peer-reviewed literature, the core mechanism underlying the modern indication: lowering prolactin reverses hyperprolactinemia-associated dysfunctions.',
    source: {
      externalId: 'src:bromocriptine-delpozo-1974',
      name: 'del Pozo E, Varga L, Wyss H, et al. Clinical and hormonal response to bromocriptine (CB-154) in the galactorrhea syndromes. J Clin Endocrinol Metab. 1974;39(1):18–26.',
      url: 'https://doi.org/10.1210/jcem-39-1-18',
      publishedAt: '1974-07-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED : established as primary therapy ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1985-04-01',
    datePrecision: 'MONTH',
    reason:
      'Molitch and colleagues reported a prospective multicenter study demonstrating that bromocriptine reduced prolactin levels and shrank prolactin-secreting macroadenomas in the majority of patients, establishing medical therapy with the dopamine agonist as first-line treatment ahead of surgery. This consolidated bromocriptine as the standard-of-care primary therapy for hyperprolactinemia and prolactinomas across endocrine practice.',
    source: {
      externalId: 'src:bromocriptine-molitch-1985',
      name: 'Molitch ME, Elton RL, Blackwell RE, et al. Bromocriptine as primary therapy for prolactin-secreting macroadenomas: results of a prospective multicenter study. J Clin Endocrinol Metab. 1985;60(4):698–705.',
      url: 'https://doi.org/10.1210/jcem-60-4-698',
      publishedAt: '1985-04-01',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED : post-market safety signal / FDA indication withdrawal ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '1994-08-01',
    datePrecision: 'MONTH',
    reason:
      'After accumulating reports of serious cardiovascular and neurologic events — stroke, seizures, myocardial infarction, and severe hypertension — in otherwise healthy postpartum women, the FDA moved to withdraw approval of bromocriptine (Parlodel) for the prevention of physiological lactation, and the manufacturer stopped marketing it for that use in 1994. The safety signal did not revoke the hyperprolactinemia indication, but it contested the drug\'s benefit–risk profile and drove a lasting shift toward the better-tolerated agonist cabergoline for prolactin disorders.',
    source: {
      externalId: 'src:bromocriptine-fda-lactation-withdrawal-1994',
      name: 'U.S. FDA / Sandoz withdrawal of the postpartum lactation-suppression indication for bromocriptine mesylate (Parlodel) following reports of stroke, seizure, and myocardial infarction, 1994.',
      url: 'https://en.wikipedia.org/wiki/Bromocriptine',
      publishedAt: '1994-08-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  // Confirm the target claim exists — never create a new Claim here.
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script never creates claims).`)
  }

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openfda_labels_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`Done: ${TRANSITIONS.length} transitions upserted for claim ${CLAIM_ID}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
