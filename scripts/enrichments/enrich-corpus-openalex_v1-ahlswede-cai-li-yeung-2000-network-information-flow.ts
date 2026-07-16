import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Ahlswede R, Cai N, Li S-Y R, Yeung R W. "Network Information Flow."
 *   IEEE Transactions on Information Theory, 46(4):1204-1216, July 2000.
 *   DOI: 10.1109/18.850663
 *   Claim id: cmq2w4tin00i9sa8hlwrk2haz  (OpenAlex W2105831729)
 *   Identity confirmed via Crossref: title "Network information flow",
 *   authors Ahlswede/Cai/Li/Yeung, IEEE Trans. Inf. Theory, 2000-07.
 *
 * The paper founded the field of *network coding*. Its central result is a
 * max-flow min-cut theorem for single-source multicast: intermediate network
 * nodes may CODE (not merely forward/route) their inputs, and by doing so the
 * multicast rate can reach the min-cut bound — characterizing the admissible
 * coding rate region and subsuming prior routing-only models.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2000-07-01) already exists; not duplicated.
 * No retraction or expression of concern exists (isRetracted=false).
 *
 * Post-publication arc (one verified transition):
 *
 *   (1) RECORDED -> SETTLED @ 2003-02 (EXPERT_LITERATURE)
 *       Li S-Y R, Yeung R W, Cai N. "Linear Network Coding." IEEE Trans. Inf.
 *       Theory 49(2):371-381, Feb 2003 (DOI 10.1109/TIT.2002.807285) proved
 *       that LINEAR network codes suffice to achieve the max-flow bound that
 *       Ahlswede-Cai-Li-Yeung (2000) established for single-source multicast.
 *       This constructive result — reinforced the same year by Koetter & Medard's
 *       algebraic framework — confirmed and consolidated the 2000 achievability
 *       theorem, settling network coding as an established subfield of
 *       information theory. Verified: https://doi.org/10.1109/TIT.2002.807285
 *       (302 -> IEEE Xplore document 1176612).
 *
 * The 2000 theorem was never contested (it is a proven result), so the arc goes
 * RECORDED -> SETTLED directly. A single, dated, DOI-verifiable adjudicating
 * document is preferred over padding with speculative transitions.
 */

const claimId = 'cmq2w4tin00i9sa8hlwrk2haz';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2003-02), linear-coding achievability proof ---
  const sourceLNC = await prisma.source.upsert({
    where: { externalId: 'src:doi-10.1109-TIT.2002.807285' },
    update: {},
    create: {
      externalId: 'src:doi-10.1109-TIT.2002.807285',
      name:
        'Li S-Y R, Yeung R W, Cai N. "Linear Network Coding." IEEE Transactions ' +
        'on Information Theory, 49(2):371-381, February 2003. Proves that linear ' +
        'network codes achieve the single-source multicast max-flow bound of ' +
        'Ahlswede-Cai-Li-Yeung (2000).',
      url: 'https://doi.org/10.1109/TIT.2002.807285',
      publishedAt: new Date('2003-02-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2003-02-01');
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
        datePrecision: 'MONTH',
        sourceId: sourceLNC.id,
        reason:
          'The max-flow min-cut achievability theorem for single-source multicast ' +
          'introduced by Ahlswede-Cai-Li-Yeung (2000) was constructively confirmed ' +
          'by Li, Yeung & Cai, "Linear Network Coding" (IEEE Trans. Inf. Theory, ' +
          'Feb 2003), which proved that linear codes over a finite field suffice to ' +
          'attain the bound. Together with Koetter & Medard\'s algebraic framework ' +
          'the same year, this consolidated network coding as an established ' +
          'subfield, settling the 2000 result in the expert literature.',
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
