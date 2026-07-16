// Epistemic-receipt enrichment: "Structural racism and health inequities in the
// USA: evidence and interventions" (Bailey, Krieger, Agénor, Graves, Linos &
// Bassett, 2017), The Lancet.
// DOI: 10.1016/S0140-6736(17)30569-X | OpenAlex: W2604748569
//
// Baseline row (fromAxis=null -> RECORDED @ 2017-04-01) already exists — NOT duplicated.
//
// Post-publication sweep:
//   - Retraction / expression of concern: NONE (Crossref update-to = null;
//     Retraction Watch negative).
//   - Failed replication / methodological reversal: NONE.
//   - Systematic review / meta-analysis adjudicating the finding: none singular.
//   - Field consensus shift: YES. This framework paper argued that structural
//     racism is a fundamental driver of US racial health inequities requiring
//     intervention. On 2020-11-16 the American Medical Association House of
//     Delegates adopted policy formally recognizing racism — including structural
//     racism — as a public health threat, directing the AMA to act against it.
//     This institutional codification of the paper's central thesis marks a
//     RECORDED -> SETTLED transition (community INSTITUTIONAL). The same consensus
//     was reinforced by the CDC (Apr 2021) and APHA, and extended in the authors'
//     own NEJM follow-up "How Structural Racism Works" (2021-02-25, PMID 33326717).
//
// One verified transition written.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-structural-racism-health-inequities-usa-2017.ts
// Idempotent: upserts on externalId / deterministic history id.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm1gc7h06x8safwl9e5yf5y'

async function main() {
  // ── RECORDED -> SETTLED (AMA recognizes racism as a public health threat) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:ama-racism-public-health-threat-2020' },
    create: {
      externalId: 'src:ama-racism-public-health-threat-2020',
      name: 'American Medical Association. New AMA policy recognizes racism as a public health threat. AMA House of Delegates Special Meeting, adopted Nov 16, 2020.',
      url: 'https://www.ama-assn.org/press-center/press-releases/new-ama-policy-recognizes-racism-public-health-threat',
      publishedAt: new Date('2020-11-16'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-structural-racism-2017',
    },
    update: {
      name: 'American Medical Association. New AMA policy recognizes racism as a public health threat. AMA House of Delegates Special Meeting, adopted Nov 16, 2020.',
      url: 'https://www.ama-assn.org/press-center/press-releases/new-ama-policy-recognizes-racism-public-health-threat',
      publishedAt: new Date('2020-11-16'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-2020-11-16`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2020-11-16'),
      datePrecision: 'DAY',
      reason: 'Bailey et al. argued that structural racism is a fundamental driver of US racial health inequities and a legitimate target for public-health intervention. On 2020-11-16 the American Medical Association House of Delegates adopted policy formally recognizing racism — including structural racism — as a public health threat and directing the AMA to work against it. This institutional codification of the paper\'s central thesis by the largest US physicians\' organization settles the finding within the field; it was reinforced by the CDC\'s April 2021 declaration and the authors\' own NEJM follow-up (2021).',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2020-11-16'),
      datePrecision: 'DAY',
      reason: 'Bailey et al. argued that structural racism is a fundamental driver of US racial health inequities and a legitimate target for public-health intervention. On 2020-11-16 the American Medical Association House of Delegates adopted policy formally recognizing racism — including structural racism — as a public health threat and directing the AMA to work against it. This institutional codification of the paper\'s central thesis by the largest US physicians\' organization settles the finding within the field; it was reinforced by the CDC\'s April 2021 declaration and the authors\' own NEJM follow-up (2021).',
      sourceId: source.id,
    },
  })

  console.log(`Upserted transition ${histId} (source ${source.id})`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
