// Enrichment: post-publication epistemic trajectory for Bandura's social cognitive
// theory of self-regulation (Bandura A. "Social cognitive theory of self-regulation."
// Organizational Behavior and Human Decision Processes 1991;50(2):248–287,
// DOI 10.1016/0749-5978(91)90022-l, OpenAlex W2062121040).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 1991-12-01 publication date) already exists — do NOT duplicate it.
//
// Post-publication events (verified via Crossref / PubMed / Semantic Scholar):
//   No retraction or expression of concern exists. The theory's CENTRAL self-
//   regulatory mechanism — that self-efficacy beliefs causally raise the goals
//   people set and the performance they self-regulate toward — became the subject
//   of a genuine, dated scientific contest:
//
//   1) CONTEST (2001): Vancouver, Thompson & Williams, "The changing signs in the
//      relationships among self-efficacy, personal goals, and performance"
//      (J. Appl. Psychol. 2001;86(4):605–620, PMID 11519645), with companion
//      studies in Vancouver, Thompson, Tischner & Putka (2002;87(3):506–516),
//      showed self-efficacy can NEGATIVELY predict subsequent effort and
//      performance at the within-person level — reversing the sign Bandura's
//      theory predicts and opening a sustained debate (Bandura & Locke rebutted
//      in 2003;88(1):87–99, PMID 12675397). RECORDED -> CONTESTED.
//
//   2) ADJUDICATION (2013): Sitzmann & Yeo's meta-analysis, "A Meta-Analytic
//      Investigation of the Within-Person Self-Efficacy Domain: Is Self-Efficacy
//      a Product of Past Performance or a Driver of Future Performance?"
//      (Personnel Psychology 2013;66(3):531–568, DOI 10.1111/peps.12035),
//      pooled within-person data and found self-efficacy is BOTH shaped by past
//      performance AND a genuine positive predictor of future performance — a real
//      driver, not merely an epiphenomenon — reaffirming the reciprocal causal
//      structure at the heart of Bandura's self-regulation theory while absorbing
//      the Vancouver critique. CONTESTED -> SETTLED. Community: EXPERT_LITERATURE.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bandura-social-cognitive-self-regulation-1991.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bandura-social-cognitive-self-regulation-1991.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxkxsh005psa7ffuecw5fo'

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
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  edgeType: 'FOR' | 'AGAINST'
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2001-01-01',
    datePrecision: 'YEAR',
    reason:
      "Bandura's social cognitive theory of self-regulation holds that self-efficacy beliefs are a central self-regulatory mechanism that causally raises the goals people set and the performance they self-regulate toward. Vancouver, Thompson & Williams (J. Appl. Psychol. 2001;86(4):605-620) directly contested this: using within-person analyses they found self-efficacy can NEGATIVELY predict subsequent effort and performance (high efficacy breeding complacency), reversing the sign the theory predicts. With the companion Vancouver, Thompson, Tischner & Putka (2002) studies, this opened a sustained methodological debate — Bandura & Locke rebutted in 2003 — over whether self-efficacy is a genuine driver of self-regulated performance or partly an epiphenomenon of past performance. RECORDED -> CONTESTED.",
    edgeType: 'AGAINST',
    source: {
      externalId: 'src:vancouver-2001-changing-signs-self-efficacy',
      name: 'Vancouver JB, Thompson CM, Williams AA. The changing signs in the relationships among self-efficacy, personal goals, and performance. Journal of Applied Psychology 2001;86(4):605-620. PMID 11519645; DOI 10.1037/0021-9010.86.4.605.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/11519645/',
      publishedAt: '2001-01-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2013-05-23',
    datePrecision: 'DAY',
    reason:
      "The within-person self-efficacy debate was adjudicated by Sitzmann & Yeo's meta-analysis, 'A Meta-Analytic Investigation of the Within-Person Self-Efficacy Domain: Is Self-Efficacy a Product of Past Performance or a Driver of Future Performance?' (Personnel Psychology 2013;66(3):531-568). Pooling within-person data, they found self-efficacy is BOTH shaped by past performance AND a genuine positive predictor of future performance — a real driver, not merely an epiphenomenon of prior success — thereby reaffirming the reciprocal causal structure at the heart of Bandura's self-regulation theory while integrating the Vancouver critique's insight about performance feedback. This meta-analytic adjudication vindicates the contested mechanism: CONTESTED -> SETTLED.",
    edgeType: 'FOR',
    source: {
      externalId: 'src:sitzmann-yeo-2013-self-efficacy-meta-analysis',
      name: 'Sitzmann T, Yeo G. A Meta-Analytic Investigation of the Within-Person Self-Efficacy Domain: Is Self-Efficacy a Product of Past Performance or a Driver of Future Performance? Personnel Psychology 2013;66(3):531-568. DOI 10.1111/peps.12035.',
      url: 'https://doi.org/10.1111/peps.12035',
      publishedAt: '2013-05-23',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} — ${TRANSITIONS.length} post-publication transition(s)${DRY_RUN ? ' (dry-run)' : ''}`)

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry-run] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.datePrecision}) | ${slug}`)
      console.log(`            source: ${tr.source.externalId} -> ${tr.source.url}`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
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
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: tr.edgeType } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
