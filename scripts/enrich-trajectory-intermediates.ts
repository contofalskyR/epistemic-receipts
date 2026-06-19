// Enrich existing settling curves with a documented, missing intermediate
// CONTESTED phase.
//
// Each of these four curated trajectories was seeded as a clean two-step arc
// (SETTLED → REVERSED) that elides a well-documented intermediate period in
// which the prior consensus was openly contested before it was finally
// reversed. Each intermediate transition below traces to a single, canonical
// primary source verified against its publisher/court-reporter URL (per
// AGENTS.md: "the curated list itself becomes the verification surface").
//
// The script also repairs chain consistency: the downstream REVERSED
// transition's fromAxis is moved from SETTLED to CONTESTED so the arc reads
// SETTLED → CONTESTED → REVERSED rather than leaving two transitions both
// claiming a SETTLED origin.
//
// Idempotent: upserts the Source by externalId and the new ClaimStatusHistory
// row by a deterministic id; the downstream fromAxis update is a no-op on
// reruns.
//
// Run:     npx tsx scripts/enrich-trajectory-intermediates.ts
// Dry-run: npx tsx scripts/enrich-trajectory-intermediates.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

type FactStatus = 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'

interface Enrichment {
  claimId: string
  slug: string
  // the new intermediate transition
  fromAxis: FactStatus
  toAxis: FactStatus
  occurredAt: string
  community: RatifyingCommunity
  reason: string
  source: { externalId: string; name: string; url: string; publishedAt: string }
}

const ENRICHMENTS: Enrichment[] = [
  // ── Peptic ulcer: stress/acid consensus contested by H. pylori hypothesis ──
  {
    claimId: 'cmq7e9wfj0008sa8hnol1bkx7',
    slug: 'stress-acid-ulcers',
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    occurredAt: '1984-06-16',
    community: 'EXPERT_LITERATURE',
    reason:
      'Barry Marshall and Robin Warren publish "Unidentified curved bacilli in the stomach of patients with gastritis and peptic ulceration" in The Lancet, proposing that a bacterium (later Helicobacter pylori), not stress and acid, underlies peptic ulcer disease. The bacterial hypothesis is widely doubted and the stress/acid model openly contested for the next decade until the 1994 NIH consensus.',
    source: {
      externalId: 'src:marshall-warren-lancet-1984',
      name: 'Marshall BJ, Warren JR. Unidentified curved bacilli in the stomach of patients with gastritis and peptic ulceration. Lancet 1984;323(8390):1311–1315.',
      url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(84)91816-6/fulltext',
      publishedAt: '1984-06-16',
    },
  },

  // ── Plessy → Brown: "separate but equal" contested by Sweatt v. Painter ──
  {
    claimId: 'cmq7jlox70000sa7ebs5sx088',
    slug: 'plessy-brown',
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    occurredAt: '1950-06-05',
    community: 'JUDICIAL',
    reason:
      'Sweatt v. Painter (decided the same day as McLaurin v. Oklahoma) holds that a separate state law school for Black students is inherently unequal, ordering Heman Sweatt admitted to the University of Texas. The decision begins the Supreme Court\'s judicial erosion of the Plessy "separate but equal" doctrine that underpins school segregation, four years before Brown overturns it outright.',
    source: {
      externalId: 'src:sweatt-v-painter-1950',
      name: 'Sweatt v. Painter, 339 U.S. 629 (1950).',
      url: 'https://supreme.justia.com/cases/federal/us/339/629/',
      publishedAt: '1950-06-05',
    },
  },

  // ── Roe → Dobbs: abortion right reaffirmed-but-contested by Casey ──
  {
    claimId: 'cmq7jlpgl000esa7e26m6huqj',
    slug: 'roe-dobbs',
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    occurredAt: '1992-06-29',
    community: 'JUDICIAL',
    reason:
      'Planned Parenthood v. Casey reaffirms the central holding of Roe but discards its trimester framework and replaces strict scrutiny with the more permissive "undue burden" standard. The fractured plurality, decided over a vigorous four-Justice call to overrule Roe entirely, marks the constitutional abortion right as openly contested rather than settled — a status it holds until Dobbs reverses it in 2022.',
    source: {
      externalId: 'src:planned-parenthood-v-casey-1992',
      name: 'Planned Parenthood of Southeastern Pa. v. Casey, 505 U.S. 833 (1992).',
      url: 'https://supreme.justia.com/cases/federal/us/505/833/',
      publishedAt: '1992-06-29',
    },
  },

  // ── Bowers → Lawrence: sodomy-law validity contested by Romer v. Evans ──
  {
    claimId: 'cmq7jlp5o0006sa7eelhfxzt3',
    slug: 'bowers-lawrence',
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    occurredAt: '1996-05-20',
    community: 'JUDICIAL',
    reason:
      'Romer v. Evans strikes down Colorado\'s Amendment 2 on equal-protection grounds, the Court\'s first ruling that a law targeting gay people lacks a legitimate state interest. Read against Bowers v. Hardwick — as Justice Scalia\'s dissent expressly notes — Romer destabilizes the constitutional footing for criminalizing same-sex conduct, contesting Bowers seven years before Lawrence overrules it.',
    source: {
      externalId: 'src:romer-v-evans-1996',
      name: 'Romer v. Evans, 517 U.S. 620 (1996).',
      url: 'https://supreme.justia.com/cases/federal/us/517/620/',
      publishedAt: '1996-05-20',
    },
  },

  // ── Abood → Janus: agency-fee precedent contested by Harris v. Quinn ──
  {
    claimId: 'cmq7jlp8d0009sa7efoe0h2f1',
    slug: 'abood-janus',
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    occurredAt: '2014-06-30',
    community: 'JUDICIAL',
    reason:
      'Harris v. Quinn declines to extend Abood to home-care personal assistants and, in Justice Alito\'s majority opinion, holds that "the Abood Court\'s analysis is questionable on several grounds" — that it misread precedent and rested on unproven assumptions. The Court stops short of overruling Abood but narrows it and openly invites further challenge, marking the agency-fee precedent as contested four years before Janus overrules it outright in 2018.',
    source: {
      externalId: 'src:harris-v-quinn-2014',
      name: 'Harris v. Quinn, 573 U.S. 616 (2014).',
      url: 'https://supreme.justia.com/cases/federal/us/573/616/',
      publishedAt: '2014-06-30',
    },
  },

  // ── STAP cells: acid-bath pluripotency contested by co-author retraction call ──
  {
    claimId: 'cmqiraq7u02p6saxjw34mlch6',
    slug: 'stap-cells',
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    occurredAt: '2014-03-10',
    community: 'EXPERT_LITERATURE',
    reason:
      'Co-author Teruhiko Wakayama publicly requests that both Nature STAP papers be retracted, telling reporters "there is no more credibility when there are such crucial mistakes" after other laboratories fail to reproduce the acid-bath result and image irregularities surface. A senior co-author renouncing his own papers — alongside RIKEN\'s 14 March interim report documenting numerous problems — marks the claim as openly contested, months before the formal 2 July 2014 retraction reverses it.',
    source: {
      externalId: 'src:stap-wakayama-retraction-request-2014',
      name: 'Retraction Watch: "Co-author of controversial acid STAP stem cell papers in Nature requests retraction: report" (10 March 2014).',
      url: 'https://retractionwatch.com/2014/03/10/co-author-of-controversial-acid-stap-stem-cell-papers-in-nature-requests-retraction-report',
      publishedAt: '2014-03-10',
    },
  },

  // ── Voxelotor: accelerated-approval benefit contested by EMA Article-20 review ──
  {
    claimId: 'cmqkhpdfn018jsa81m1ncrxsh',
    slug: 'voxelotor-oxbryta',
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    occurredAt: '2024-07-29',
    community: 'INSTITUTIONAL',
    reason:
      'At the request of the European Commission, the EMA begins an Article-20 review of Oxbryta (voxelotor) after clinical-trial data showed a higher number of deaths on voxelotor than on placebo and registry studies showed more vaso-occlusive crises during treatment. The regulatory referral places the drug\'s benefit-risk balance — settled at the 2019 accelerated approval on a hemoglobin surrogate — formally in doubt, two months before Pfizer\'s 25 September 2024 worldwide withdrawal reverses the clinical-benefit claim.',
    source: {
      externalId: 'src:ema-oxbryta-article20-start-2024',
      name: 'EMA, "Oxbryta Article-20 procedure: EMA starts review of sickle cell disease medicine Oxbryta" (29 July 2024).',
      url: 'https://www.ema.europa.eu/en/documents/referral/oxbryta-article-20-procedure-ema-starts-review-sickle-cell-disease-medicine-oxbryta_en.pdf',
      publishedAt: '2024-07-29',
    },
  },

  // ── Bevacizumab breast cancer: contested accelerated approval finally revoked ──
  {
    claimId: 'cmqjyrzka00swsa5mx5getxuc',
    slug: 'bevacizumab-breast-cancer',
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    occurredAt: '2011-11-18',
    community: 'INSTITUTIONAL',
    reason:
      'FDA Commissioner Margaret Hamburg revokes the breast-cancer indication for Avastin (bevacizumab), concluding after the confirmatory AVADO and RIBBON-1 trials and a public hearing that the drug has not been shown to be safe and effective for metastatic HER2-negative breast cancer and exposes patients to life-threatening risks without demonstrated benefit. The decision reverses the 2008 accelerated approval; bevacizumab remains approved for colon, lung, kidney, and brain cancers.',
    source: {
      externalId: 'src:fda-avastin-breast-withdrawal-2011',
      name: 'FDA / Federal Register, "Final Decision on Withdrawal of Breast Cancer Indication for AVASTIN (Bevacizumab) Following Public Hearing" (Commissioner decision 18 November 2011).',
      url: 'https://www.federalregister.gov/documents/2012/02/27/2012-4424/final-decision-on-withdrawal-of-breast-cancer-indication-for-avastin-bevacizumab-following-public',
      publishedAt: '2011-11-18',
    },
  },
]

async function main() {
  let enriched = 0
  const details: string[] = []

  for (const e of ENRICHMENTS) {
    const claim = await prisma.claim.findUnique({ where: { id: e.claimId } })
    if (!claim) {
      console.warn(`SKIP ${e.slug}: claim ${e.claimId} not found`)
      continue
    }

    const history = await prisma.claimStatusHistory.findMany({
      where: { claimId: e.claimId },
      orderBy: { occurredAt: 'asc' },
    })

    // For a middle-insert, the downstream transition is the one whose origin we
    // are reinterpreting: it currently leaves `fromAxis` and must now leave
    // `toAxis` so the chain reads fromAxis → toAxis → (downstream). For a
    // terminal append (e.g. CONTESTED→REVERSED at the end of an arc) there is no
    // such downstream and none is required.
    const downstream = history.find(
      (h) => h.fromAxis === e.fromAxis && new Date(h.occurredAt) > new Date(e.occurredAt),
    )

    const cshId = `trajectory:${e.slug}:${e.toAxis.toLowerCase()}-${e.occurredAt.slice(0, 4)}`

    console.log(`\n${e.slug}`)
    console.log(`  + ${e.fromAxis}→${e.toAxis} @${e.occurredAt}  (${e.source.name})`)
    if (downstream) {
      console.log(`  ~ downstream ${downstream.id}: fromAxis ${downstream.fromAxis}→${e.toAxis}`)
    } else {
      console.log(`  (terminal append — no downstream transition to repair)`)
    }

    if (DRY_RUN) {
      details.push(`${e.claimId}: added ${e.fromAxis}→${e.toAxis} transition (${e.slug})`)
      enriched++
      continue
    }

    await prisma.$transaction(async (tx) => {
      const source = await tx.source.upsert({
        where: { externalId: e.source.externalId },
        update: {},
        create: {
          externalId: e.source.externalId,
          name: e.source.name,
          url: e.source.url,
          publishedAt: new Date(e.source.publishedAt),
          methodologyType: 'primary',
          ingestedBy: 'enrich:trajectory-intermediates',
          humanReviewed: false,
          autoApproved: true,
        },
      })

      await tx.claimStatusHistory.upsert({
        where: { id: cshId },
        update: {},
        create: {
          id: cshId,
          claimId: e.claimId,
          fromAxis: e.fromAxis,
          toAxis: e.toAxis,
          community: e.community,
          occurredAt: new Date(e.occurredAt),
          datePrecision: 'DAY',
          reason: e.reason,
          sourceId: source.id,
        },
      })

      // Repair chain consistency: downstream transition now leaves CONTESTED.
      if (downstream && downstream.fromAxis !== e.toAxis) {
        await tx.claimStatusHistory.update({
          where: { id: downstream.id },
          data: { fromAxis: e.toAxis },
        })
      }
    })

    details.push(`${e.claimId}: added ${e.fromAxis}→${e.toAxis} transition (${e.slug})`)
    enriched++
  }

  console.log(`\nENRICHED:${enriched}`)
  console.log(`DETAILS:${details.join(' | ')}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
