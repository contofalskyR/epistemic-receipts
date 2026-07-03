// Enrichment: epistemic arc for the OTC nighttime sleep-aid claim for
// diphenhydramine HCl, FDA label claim cmpiyi9x98yd6plo7unmonep8
// (openfda_labels_v1).
//
// Diphenhydramine's sedating property was first-generation-antihistamine folk
// knowledge, but the "nighttime sleep-aid" indication became an established fact
// when the FDA's final OTC drug monograph (codified at 21 CFR part 338)
// classified diphenhydramine as Category I — generally recognized as safe and
// effective — for that use (RECORDED, 1989). Placebo-controlled trial evidence
// then confirmed its modest hypnotic efficacy and cemented it as the reference
// OTC sleep aid / standard comparator (SETTLED, Morin et al., Sleep 2005). That
// settlement was thrown into genuine contest by prospective cohort evidence
// linking cumulative strong-anticholinergic exposure (diphenhydramine being a
// canonical example) to incident dementia (CONTESTED, Gray et al., JAMA Intern
// Med 2015) — the basis for AGS Beers-Criteria and specialty-guideline advice
// against using it as a routine hypnotic, especially in older adults.
//
// The existing first ClaimStatusHistory row (fromAxis=null -> OPEN) is left
// untouched; this script adds the three subsequent transitions.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-nighttime-sleep-aid-diphenhydramine.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-nighttime-sleep-aid-diphenhydramine.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpiyi9x98yd6plo7unmonep8'

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

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
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
  // ── OPEN -> RECORDED: FDA final OTC monograph classifies diphenhydramine
  //    as a Category I nighttime sleep-aid (1989, codified at 21 CFR 338) ──
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1989-01-01',
    datePrecision: 'YEAR',
    reason:
      "In its final over-the-counter drug monograph, codified at 21 CFR part 338 (Nighttime Sleep-Aid Drug Products), the FDA classified diphenhydramine hydrochloride as a Category I active ingredient — generally recognized as safe and effective for the temporary relief of occasional sleeplessness. That determination converted the antihistamine's long-observed sedating effect into a formally recorded, monographed indication and is the regulatory basis on which the current label states 'Purpose: Nighttime sleep-aid.'",
    source: {
      externalId: 'src:diphenhydramine-otc-sleepaid-monograph-21cfr338',
      name: '21 CFR Part 338 — Nighttime Sleep-Aid Drug Products for Over-the-Counter Human Use (§338.10 permitted active ingredients: diphenhydramine hydrochloride, diphenhydramine citrate, doxylamine succinate). eCFR.',
      url: 'https://www.ecfr.gov/current/title-21/part-338',
      publishedAt: '1989-01-01',
      methodologyType: 'primary',
    },
  },

  // ── RECORDED -> SETTLED: placebo-controlled RCT confirms hypnotic efficacy;
  //    diphenhydramine becomes the reference OTC sleep aid (2005) ──
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2005-11-01',
    datePrecision: 'MONTH',
    reason:
      "A randomized, double-blind, placebo-controlled trial (Morin et al., Sleep 2005) tested diphenhydramine 50 mg against placebo in patients with mild insomnia, confirming its modest but real hypnotic effect and its role as the standard active comparator among nonprescription sleep aids. By this point diphenhydramine was the dominant single-ingredient OTC sleep aid, and the settled clinical understanding was that it provided short-term relief of occasional sleeplessness as the monograph indicated.",
    source: {
      externalId: 'src:morin-diphenhydramine-insomnia-rct-sleep-2005',
      name: 'Morin CM, Koetter U, Bastien C, Ware JC, Wooten V. Valerian-hops combination and diphenhydramine for treating insomnia: a randomized placebo-controlled clinical trial. Sleep. 2005;28(11):1465-1471.',
      url: 'https://doi.org/10.1093/sleep/28.11.1465',
      publishedAt: '2005-11-01',
      methodologyType: 'primary',
    },
  },

  // ── SETTLED -> CONTESTED: cumulative anticholinergic exposure linked to
  //    incident dementia; basis for guideline advice against routine use (2015) ──
  {
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-01-26',
    datePrecision: 'DAY',
    reason:
      "A prospective cohort study (Gray et al., JAMA Internal Medicine 2015) found that higher cumulative use of strong anticholinergic medications — with diphenhydramine cited as a canonical over-the-counter example — was associated with a significantly increased risk of incident dementia. Together with the American Geriatrics Society Beers Criteria and sleep-medicine guidance that discourage first-generation antihistamines as hypnotics, this put the risk-benefit of diphenhydramine's routine sleep-aid use into active, unresolved contest, particularly in older adults.",
    source: {
      externalId: 'src:gray-anticholinergic-dementia-jamaim-2015',
      name: 'Gray SL, Anderson ML, Dublin S, et al. Cumulative use of strong anticholinergics and incident dementia: a prospective cohort study. JAMA Intern Med. 2015;175(3):401-407.',
      url: 'https://doi.org/10.1001/jamainternmed.2014.7663',
      publishedAt: '2015-01-26',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  // Guard: make sure the claim exists and we are enriching, not creating.
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (this script must not create a Claim).`)
  }

  for (const t of TRANSITIONS) {
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source ${t.source.externalId}`)
      console.log(`[dry-run] history ${historyId} (${t.fromAxis} -> ${t.toAxis} @ ${t.occurredAt})`)
      continue
    }

    // 1) Upsert the marker Source first.
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
        ingestedBy: 'openfda_labels_v1-enrichment',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    // 2) Upsert the ClaimStatusHistory row, linking the marker Source.
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

    console.log(`upserted ${historyId} (${t.fromAxis} -> ${t.toAxis})`)
  }

  console.log(DRY_RUN ? 'Dry run complete.' : 'Enrichment complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
