import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Claim: Farrar JT, Young JP Jr, LaMoreaux L, Werth JL, Poole RM.
// "Clinical importance of changes in chronic pain intensity measured on an
// 11-point numerical pain rating scale." Pain. 2001 Nov;94(2):149-158.
// DOI 10.1016/S0304-3959(01)00349-9  | OpenAlex W2132309748 | PubMed 11690728
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED, 2001-11) already
// exists. This script adds the single, verified post-publication transition:
//
// RECORDED -> SETTLED (2008-02): The IMMPACT (Initiative on Methods, Measurement,
// and Pain Assessment in Clinical Trials) consensus panel formally adopted and
// codified Farrar's data-driven thresholds — a ~30% reduction as a "moderately
// important" improvement and ~50% as "substantial" — as the recommended standard
// for interpreting the clinical importance of treatment outcomes in chronic-pain
// trials. Farrar is a named co-author of the recommendations. The finding was never
// contested; it moved from an empirical proposal to expert-consensus standard.

const CLAIM_ID = 'cmply5sbz00ufsaih8u6fhwb6'

async function main() {
  // Adjudicating source: IMMPACT consensus recommendations (Dworkin et al. 2008)
  const immpact = await prisma.source.upsert({
    where: { externalId: 'src:immpact-dworkin-2008-clinical-importance' },
    update: {},
    create: {
      externalId: 'src:immpact-dworkin-2008-clinical-importance',
      name:
        'Dworkin RH, Turk DC, Wyrwich KW, Beaton D, Cleeland CS, Farrar JT, et al. ' +
        '"Interpreting the clinical importance of treatment outcomes in chronic pain ' +
        'clinical trials: IMMPACT recommendations." J Pain. 2008 Feb;9(2):105-121.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/18055266/',
      publishedAt: new Date('2008-02-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-corpus-openalex_v1',
      humanReviewed: false,
      autoApproved: true,
    },
  })

  const occurredAt = new Date('2008-02-01')
  const histId = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    update: {},
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      reason:
        'The IMMPACT expert-consensus panel formally adopted Farrar et al.\'s data-driven ' +
        'thresholds — an approximately 30% reduction on the PI-NRS as a moderately important ' +
        'improvement and approximately 50% as substantial — as the recommended standard for ' +
        'interpreting clinically important pain reduction in chronic-pain clinical trials ' +
        '(Farrar was a co-author of the recommendations). The estimate moved from an empirical ' +
        'proposal to a settled methodological standard for the field.',
      sourceId: immpact.id,
    },
  })

  console.log(`Upserted SETTLED transition ${histId} with source ${immpact.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
