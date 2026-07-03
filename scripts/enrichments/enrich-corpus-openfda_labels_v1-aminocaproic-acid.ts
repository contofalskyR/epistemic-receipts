// Enrich the epistemic arc for the AMINOCAPROIC ACID FDA-label claim
// (openfda_labels_v1).
//
// Claim: cmpiyh7t08xacplo7wc4b2u81 — Aminocaproic acid (Amicar), a first-
// generation antifibrinolytic (epsilon-aminocaproic acid, EACA) indicated for
// enhancing hemostasis when fibrinolysis contributes to bleeding, including
// bleeding after cardiac/portacaval surgery and in hematologic disorders.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1964        FDA approval of Amicar (aminocaproic acid), NDA 015197 — first regulatory recording of EACA antifibrinolytic efficacy (Okamoto's EACA program, early-1960s clinical work)
//   RECORDED -> SETTLED   2011-03     STS/SCA 2011 blood conservation guideline recommends antifibrinolytic lysine analogues (incl. aminocaproic acid) for cardiac surgery — standard-of-care endorsement
//
// Step 3 (post-market safety signal / black box / withdrawal) is intentionally
// omitted: aminocaproic acid carries no FDA Drug Safety Communication, no boxed
// warning, and no withdrawal. There is no verifiable safety-signal event to cite,
// so none is fabricated (per HARD_FACT verifiability principles).
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-aminocaproic-acid.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-aminocaproic-acid.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyh7t08xacplo7wc4b2u81'

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
  // ── OPEN -> RECORDED: first regulatory recording of EACA antifibrinolytic efficacy (Amicar, mid-1960s) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1964-01-01',
    datePrecision: 'YEAR',
    reason:
      'The FDA approved Amicar (aminocaproic acid, NDA 015197), the first synthetic antifibrinolytic lysine analogue, recording epsilon-aminocaproic acid as effective for enhancing hemostasis when excessive fibrinolysis contributes to bleeding. The approval built on Shosuke Okamoto\u2019s early-1960s work characterizing EACA as a competitive inhibitor of plasminogen activation, establishing the antifibrinolytic mechanism carried into the indications captured in the openFDA label record.',
    source: {
      externalId: 'src:aminocaproic-fda-amicar-approval',
      name: 'Drugs@FDA \u2014 AMICAR (aminocaproic acid), NDA 015197 (original approval).',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=015197',
      publishedAt: '1964-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: guideline endorsement of antifibrinolytics as standard of care in cardiac surgery (2011) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2011-03-01',
    datePrecision: 'MONTH',
    reason:
      'The 2011 update to the Society of Thoracic Surgeons and Society of Cardiovascular Anesthesiologists blood conservation clinical practice guidelines recommended the antifibrinolytic lysine analogues \u2014 aminocaproic acid and tranexamic acid \u2014 to reduce perioperative bleeding and transfusion in cardiac surgery (a Class I recommendation). This codified the claim\u2019s core indication (enhancing hemostasis in fibrinolytic bleeding, notably after heart surgery) as accepted standard of care, settling the fact within the cardiac-surgical and hematologic community.',
    source: {
      externalId: 'src:aminocaproic-sts-sca-blood-conservation-2011',
      name: 'Ferraris VA, et al. 2011 Update to the STS and SCA Blood Conservation Clinical Practice Guidelines. Ann Thorac Surg. 2011;91(3):944\u2013982.',
      url: 'https://doi.org/10.1016/j.athoracsur.2010.11.078',
      publishedAt: '2011-03-01',
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
