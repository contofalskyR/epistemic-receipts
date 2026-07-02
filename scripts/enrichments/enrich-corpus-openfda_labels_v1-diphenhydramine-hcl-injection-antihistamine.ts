// Enrich the epistemic arc for the Diphenhydramine Hydrochloride injection
// FDA-label claim (openfda_labels_v1).
//
// Claim: cmpiyd2c38sfoplo71i92v0kk — Diphenhydramine hydrochloride injectable
// indicated as an antihistamine for amelioration of allergic reactions to blood
// or plasma and, in anaphylaxis, as an adjunct to epinephrine when the oral form
// is impractical.
//
// Arc (chronological, monotonic):
//   OPEN     -> RECORDED  1947  first published pharmacology establishing Benadryl
//                               (diphenhydramine) as an effective H1 antihistamine
//   RECORDED -> SETTLED   2015  antihistamines endorsed as adjunctive therapy in
//                               the Joint Task Force anaphylaxis practice parameter
//   SETTLED  -> CONTESTED 2020  FDA safety communication on serious cardiac harm /
//                               deaths from high-dose diphenhydramine ("Benadryl Challenge")
//
// Does NOT create a new Claim; only adds ClaimStatusHistory rows + marker Sources.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-diphenhydramine-hcl-injection-antihistamine.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-diphenhydramine-hcl-injection-antihistamine.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyd2c38sfoplo71i92v0kk'

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
  // ── OPEN -> RECORDED: first published pharmacology of Benadryl as an H1 antihistamine (1947) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1947-01-01',
    datePrecision: 'YEAR',
    reason:
      'Diphenhydramine (Benadryl) was synthesized by George Rieveschl in 1943, and by the mid-1940s Emanuel R. Loew and colleagues had published the pharmacology establishing that it blocks the actions of histamine and protects animals against otherwise fatal histamine challenge. Loew\'s review of the antihistamine compounds in Physiological Reviews (1947) consolidated this primary evidence, fixing diphenhydramine as the prototype H1-receptor antagonist whose antihistaminic action underlies the injectable label indication.',
    source: {
      externalId: 'src:diphenhydramine-loew-physrev-1947',
      name: 'Loew ER. Pharmacology of antihistamine compounds. Physiological Reviews. 1947;27(4):542–573.',
      url: 'https://doi.org/10.1152/physrev.1947.27.4.542',
      publishedAt: '1947-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: antihistamines endorsed as anaphylaxis adjunct in practice parameter (2015) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2015-11-01',
    datePrecision: 'MONTH',
    reason:
      'Diphenhydramine had been standard of care as a first-generation antihistamine for decades, and the Joint Task Force on Practice Parameters (AAAAI/ACAAI) "Anaphylaxis—a practice parameter update 2015" formally positioned H1 antihistamines as adjunctive therapy after epinephrine for allergic reactions and anaphylaxis. This guideline inclusion ratified the injectable-antihistamine role captured verbatim in the current openFDA label as an adjunct to epinephrine once acute anaphylactic symptoms have been controlled.',
    source: {
      externalId: 'src:diphenhydramine-anaphylaxis-parameter-2015',
      name: 'Lieberman P, Nicklas RA, Randolph C, et al. Anaphylaxis—a practice parameter update 2015. Ann Allergy Asthma Immunol. 2015;115(5):341–384.',
      url: 'https://doi.org/10.1016/j.anai.2015.07.019',
      publishedAt: '2015-11-01',
      methodologyType: 'derivative',
    },
  },

  // ── SETTLED -> CONTESTED: FDA high-dose diphenhydramine safety communication (2020) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '2020-09-24',
    datePrecision: 'DAY',
    reason:
      'On 24 September 2020 the FDA issued a Drug Safety Communication warning that taking higher-than-recommended doses of diphenhydramine (Benadryl) can cause serious heart problems, seizures, coma, and death, prompted by reported cases and a social-media "Benadryl Challenge." The communication contested unqualified use of the drug and reinforced strict dosing limits without withdrawing the approved antihistaminic and anaphylaxis-adjunct indications.',
    source: {
      externalId: 'src:diphenhydramine-fda-safety-2020',
      name: 'FDA Drug Safety Communication: FDA warns about serious problems with high doses of the allergy medicine diphenhydramine (Benadryl). 24 September 2020.',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-warns-about-serious-problems-high-doses-allergy-medicine-diphenhydramine-benadryl',
      publishedAt: '2020-09-24',
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
