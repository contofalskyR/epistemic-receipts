import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Bendsøe MP, Kikuchi N. "Generating optimal topologies in structural design
 *   using a homogenization method." Computer Methods in Applied Mechanics and
 *   Engineering, 1988. DOI 10.1016/0045-7825(88)90086-2.
 *   Claim id: cmq2w4x2800kfsa8hnu37nk0d  (OpenAlex W2069697210)
 *
 * This is the founding paper of the field of structural topology optimization,
 * introducing the material-distribution / homogenization approach to generating
 * optimal continuum topologies.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1988-11-01) already exists; not duplicated.
 *
 * Post-publication assessment:
 *   - No retraction / expression of concern. Crossref returns HTTP 200 for the DOI
 *     with a null `update-to` field (verified). No Retraction Watch entry.
 *   - This is a computational method, not an empirical finding, so there is no
 *     failed replication or clinical meta-analysis to record. (The later shift from
 *     the original homogenization scheme to the simpler SIMP density interpolation,
 *     Bendsøe 1989, is a methodological refinement of the same material-distribution
 *     paradigm, not an overturning of the core claim — so no CONTESTED/REVERSED
 *     event is warranted.)
 *   - FIELD CONSENSUS SHIFT (canonization): Eschenauer HA, Olhoff N (2001),
 *     "Topology optimization of continuum structures: A review," Applied Mechanics
 *     Reviews 54(4):331-390, DOI 10.1115/1.1388075 (verified resolves, Crossref 200).
 *     This comprehensive review consolidated topology optimization — the field
 *     launched by Bendsøe & Kikuchi (1988) — as an established, mature methodology
 *     for continuum structural design, ratifying the founding approach in the
 *     expert literature roughly thirteen years after its introduction.
 *
 * Single RECORDED -> SETTLED transition at the canonizing review's publication year.
 * Community: EXPERT_LITERATURE. Date precision: YEAR.
 */

const claimId = 'cmq2w4x2800kfsa8hnu37nk0d';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2001), canonization as established field ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1115/1.1388075' },
    update: {},
    create: {
      externalId: 'src:doi:10.1115/1.1388075',
      name:
        'Eschenauer HA, Olhoff N (2001), "Topology optimization of continuum ' +
        'structures: A review," Applied Mechanics Reviews 54(4):331-390',
      url: 'https://doi.org/10.1115/1.1388075',
      publishedAt: new Date('2001-01-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2001-01-01');
  const toAxis = 'SETTLED';
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
      datePrecision: 'YEAR',
      sourceId: source.id,
      reason:
        'Bendsøe & Kikuchi\'s 1988 homogenization method founded the field of ' +
        'structural topology optimization. Eschenauer & Olhoff\'s 2001 review ' +
        '"Topology optimization of continuum structures" in Applied Mechanics ' +
        'Reviews consolidated the approach as an established, mature methodology ' +
        'for continuum structural design, ratifying the founding material-' +
        'distribution paradigm in the expert literature as settled practice ' +
        'rather than an experimental proposal.',
    },
  });

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
