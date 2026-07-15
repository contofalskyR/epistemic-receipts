import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Baker SR, Bloom N, Davis SJ. "Measuring Economic Policy Uncertainty."
 *   The Quarterly Journal of Economics, 2016;131(4):1593-1636.
 *   DOI 10.1093/qje/qjw024.
 *   Claim id: cmplyncmw0005saqkrm5ck5mw  (OpenAlex W3126081245)
 *
 * The paper introduced the newspaper-coverage-based Economic Policy Uncertainty
 * (EPU) index, argued it proxies for policy-related economic uncertainty, and used
 * firm-level data to show that policy-uncertainty shocks are associated with
 * reduced investment and employment in policy-sensitive sectors.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2016-07-11) already exists; not duplicated.
 * Identity confirmed via Crossref: title "Measuring Economic Policy Uncertainty",
 * authors Baker SR, Bloom N, Davis SJ, QJE 131(4):1593-1636, published 2016-07-11 —
 * matches the DOI and OpenAlex ID. No retraction or expression of concern (Crossref
 * returns no update-to/updated-by; no Retraction Watch entry).
 *
 * Post-publication arc (one verified transition):
 *
 *   (1) RECORDED -> CONTESTED @ 2025-01-26 (EXPERT_LITERATURE)
 *       Bae S, Jo S, Shim M. "Does Economic Policy Uncertainty differ from other
 *       uncertainty measures? Replication of Baker, Bloom, and Davis (2016)."
 *       Canadian Journal of Economics, 2025;58(1):40-74. DOI 10.1111/caje.12757.
 *       This peer-reviewed replication re-examines the paper's macro/firm-level
 *       result that EPU shocks depress economic activity. It finds those shocks do
 *       NOT significantly affect the economy over the September 2008 – December 2019
 *       sample — a feature specific to the EPU index, since other popular uncertainty
 *       measures retain their contractionary effects across the same subsamples. This
 *       is a specific, dated, citable challenge to the robustness of the paper's
 *       headline economic-effects claim, moving it from RECORDED to CONTESTED.
 */

const claimId = 'cmplyncmw0005saqkrm5ck5mw';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (2025-01-26), Bae-Jo-Shim replication ---
  const sourceBaeJoShim = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1111/caje.12757' },
    update: {},
    create: {
      externalId: 'src:doi:10.1111/caje.12757',
      name:
        'Bae S, Jo S, Shim M. (2025), "Does Economic Policy Uncertainty differ from ' +
        'other uncertainty measures? Replication of Baker, Bloom, and Davis (2016)," ' +
        'Canadian Journal of Economics 58(1):40-74',
      url: 'https://doi.org/10.1111/caje.12757',
      publishedAt: new Date('2025-01-26'),
      methodologyType: 'replication',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2025-01-26');
    const toAxis = 'CONTESTED';
    const slug = `${claimId}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`;
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      update: {},
      create: {
        id: slug,
        claimId,
        fromAxis: 'RECORDED',
        toAxis,
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'DAY',
        sourceId: sourceBaeJoShim.id,
        reason:
          'Bae, Jo & Shim (Canadian Journal of Economics, 2025) published a peer-reviewed ' +
          'replication of Baker-Bloom-Davis (2016). They find EPU-index shocks do not ' +
          'significantly affect the economy over the Sep-2008–Dec-2019 sample, in contrast ' +
          'to the significant contractionary effects found in the original earlier sample — ' +
          'and that this weakening is specific to the EPU index, since other uncertainty ' +
          'measures retain their effects across subsamples. This dated, citable replication ' +
          'challenges the robustness of the paper\'s economic-effects result, moving it to CONTESTED.',
      },
    });
  }

  console.log('Enrichment complete for claim', claimId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
