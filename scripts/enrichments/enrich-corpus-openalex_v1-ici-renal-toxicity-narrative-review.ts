// Enrichment: epistemic trajectory for the claim
//   "Adverse Renal Effects of Immune Checkpoint Inhibitors: A Narrative Review"
//   Wanchoo et al., American Journal of Nephrology, 2017. DOI 10.1159/000455014.
//   OpenAlex W2572174216. Claim id cmply5din00n3saihqfwn969j.
//
// Baseline (fromAxis=null -> RECORDED at 2017 publication) already exists; do NOT duplicate it.
//
// Post-publication event: the review's descriptive account of immune-checkpoint-
// inhibitor (ICI) renal toxicity — acute interstitial nephritis as the dominant
// lesion, AKI as the principal manifestation — was empirically adjudicated and
// settled by the first large multicenter cohort of ICI-associated AKI (Cortazar
// et al., J Am Soc Nephrol 2020, 138 patients across 13 centers), which confirmed
// the clinical features, histopathology, and outcomes the narrative review had
// summarized. RECORDED -> SETTLED, EXPERT_LITERATURE.
//
// No retraction or expression of concern exists (Crossref updated-by: null).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-ici-renal-toxicity-narrative-review.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmply5din00n3saihqfwn969j'

async function main() {
  // ── RECORDED -> SETTLED: 2020 multicenter cohort adjudicates ICI-AKI ──
  const occurredAt = new Date('2020-01-02')
  const slug = `${claimId}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  const source = await prisma.source.upsert({
    where: { externalId: 'src:cortazar-2020-jasn-ici-aki-multicenter' },
    create: {
      externalId: 'src:cortazar-2020-jasn-ici-aki-multicenter',
      name: 'Cortazar FB, Kibbelaar ZA, Glezerman IG, et al. Clinical Features and Outcomes of Immune Checkpoint Inhibitor–Associated AKI: A Multicenter Study. J Am Soc Nephrol. 2020;31(2):435–446.',
      url: 'https://doi.org/10.1681/ASN.2019070676',
      publishedAt: occurredAt,
      methodologyType: 'primary',
      ingestedBy: 'enrichment',
      humanReviewed: true,
    },
    update: {
      name: 'Cortazar FB, Kibbelaar ZA, Glezerman IG, et al. Clinical Features and Outcomes of Immune Checkpoint Inhibitor–Associated AKI: A Multicenter Study. J Am Soc Nephrol. 2020;31(2):435–446.',
      url: 'https://doi.org/10.1681/ASN.2019070676',
      publishedAt: occurredAt,
      methodologyType: 'primary',
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'The first large multicenter cohort of ICI-associated AKI (138 patients across 13 centers) clinically adjudicated the entity the 2017 narrative review had characterized, confirming acute interstitial nephritis as the dominant histologic lesion and establishing the incidence, corticosteroid response, and outcomes of ICI nephrotoxicity. This vindicated and settled the review\'s descriptive account of adverse renal effects of checkpoint inhibitors in the expert nephrology/oncology literature.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'The first large multicenter cohort of ICI-associated AKI (138 patients across 13 centers) clinically adjudicated the entity the 2017 narrative review had characterized, confirming acute interstitial nephritis as the dominant histologic lesion and establishing the incidence, corticosteroid response, and outcomes of ICI nephrotoxicity. This vindicated and settled the review\'s descriptive account of adverse renal effects of checkpoint inhibitors in the expert nephrology/oncology literature.',
      sourceId: source.id,
    },
  })

  console.log(`Enriched claim ${claimId}: RECORDED -> SETTLED (${slug})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
