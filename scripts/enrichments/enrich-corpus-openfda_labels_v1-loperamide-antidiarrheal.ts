// Enrich the epistemic arc for the Loperamide HCl anti-diarrheal FDA-label claim
// (openfda_labels_v1).
//
// Claim: cmpiycf5z8ro6plo7sk8jdlno — "Anti-Diarrheal (LOPERAMIDE HCL): Purpose
// Anti-diarrheal". Loperamide is the mu-opioid-receptor agonist antimotility
// agent (Janssen R-18553) that became the reference OTC anti-diarrheal.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1976-06  first published clinical efficacy in chronic diarrhea
//   RECORDED -> SETTLED   2016-05  codified as standard-of-care in the ACG acute-diarrhea guideline
//   SETTLED  -> CONTESTED 2016-06  FDA safety communication: serious cardiac events at high/abuse doses
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-loperamide-antidiarrheal.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-loperamide-antidiarrheal.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiycf5z8ro6plo7sk8jdlno'

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
  // ── OPEN -> RECORDED: first published clinical efficacy in chronic diarrhea (1976) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1976-06-01',
    datePrecision: 'MONTH',
    reason:
      'Galambos and colleagues published one of the first controlled clinical evaluations of loperamide (R-18553) in the treatment of chronic diarrhea (Gastroenterology, 1976), reporting effective reduction of stool frequency with the novel synthetic antimotility agent. This established the primary clinical evidence that loperamide is an effective anti-diarrheal — the exact purpose recorded in the current openFDA monograph label.',
    source: {
      externalId: 'src:loperamide-galambos-chronic-diarrhea-1976',
      name: 'Galambos JT, Hersh T, Schroder S, Wenger J. Loperamide: a new antidiarrheal agent in the treatment of chronic diarrhea. Gastroenterology. 1976;70(6):1026–1029.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/770212/',
      publishedAt: '1976-06-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: codified as standard-of-care in the ACG acute-diarrhea guideline (2016) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-05-01',
    datePrecision: 'MONTH',
    reason:
      'The American College of Gastroenterology Clinical Guideline on the diagnosis, treatment, and prevention of acute diarrheal infections in adults (Riddle, DuPont, Connor; Am J Gastroenterol 2016) recommends loperamide as adjunctive antimotility therapy for acute diarrhea, codifying decades of routine use into a formal standard of care. By this point loperamide was also the reference over-the-counter anti-diarrheal and a WHO essential medicine, settling the anti-diarrheal indication the openFDA label reproduces.',
    source: {
      externalId: 'src:loperamide-acg-acute-diarrhea-guideline-2016',
      name: 'Riddle MS, DuPont HL, Connor BA. ACG Clinical Guideline: Diagnosis, Treatment, and Prevention of Acute Diarrheal Infections in Adults. Am J Gastroenterol. 2016;111(5):602–622.',
      url: 'https://doi.org/10.1038/ajg.2016.126',
      publishedAt: '2016-05-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: FDA safety communication, serious cardiac events at high/abuse doses (2016) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2016-06-07',
    datePrecision: 'DAY',
    reason:
      'On 7 June 2016 the FDA issued a Drug Safety Communication warning that high doses of loperamide (Imodium), including from abuse and misuse, can cause serious cardiac events — QT prolongation, torsades de pointes, syncope, and death. The signal contested the drug\'s unqualified safety-at-any-dose profile, driving subsequent packaging and dosing-limit actions, while leaving the standard anti-diarrheal indication itself intact rather than reversed.',
    source: {
      externalId: 'src:loperamide-fda-dsc-cardiac-2016',
      name: 'FDA Drug Safety Communication: FDA warns about serious heart problems with high doses of the antidiarrheal medicine loperamide (Imodium), including from abuse and misuse (2016-06-07).',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-fda-warns-about-serious-heart-problems-high-doses-antidiarrheal',
      publishedAt: '2016-06-07',
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
