import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Oliver RL. "A Cognitive Model of the Antecedents and Consequences of
 *   Satisfaction Decisions." Journal of Marketing Research 17(4):460–469,
 *   November 1980. DOI 10.2307/3150499.
 *   Claim id: cmplxlall00c1sa7fobpn65z0  (OpenAlex W2028184439)
 *
 * This is the founding paper of the expectation–disconfirmation model (EDM) of
 * consumer satisfaction: satisfaction is a function of a prior expectation
 * (adaptation level) and the disconfirmation of that expectation by perceived
 * performance, and satisfaction in turn drives attitude change and repurchase
 * intention.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1980-11-01) already exists; not duplicated.
 *
 * Post-publication assessment (identity + status verified 2026-07-15 via Crossref):
 *   - No retraction / expression of concern. Crossref returns HTTP 200 for the DOI
 *     with null `update-to` / `updated-by`. Not flagged retracted.
 *
 *   - RECORDED -> CONTESTED (1982-11):
 *     Churchill GA, Surprenant C (1982). "An Investigation into the Determinants
 *     of Customer Satisfaction." Journal of Marketing Research 19(4):491–504.
 *     DOI 10.2307/3151722 (Crossref HTTP 200, verified 2026-07-15). This early,
 *     highly cited empirical test of the disconfirmation paradigm found that for a
 *     durable good, expectation and disconfirmation effects on satisfaction were
 *     weak or absent and perceived performance dominated — directly challenging
 *     the antecedent structure Oliver's cognitive model proposed and opening a
 *     methodological contest ("does disconfirmation matter, or just performance?")
 *     that ran through the satisfaction literature of the 1980s–90s.
 *
 *   - CONTESTED -> SETTLED (2001-12):
 *     Szymanski DM, Henard DH (2001). "Customer Satisfaction: A Meta-Analysis of
 *     the Empirical Evidence." Journal of the Academy of Marketing Science
 *     29(1):16–35. DOI 10.1177/0092070301291002 (doi.org HTTP 200, verified
 *     2026-07-15). This meta-analysis of the accumulated empirical evidence found
 *     both expectations and, most strongly, disconfirmation to be robust,
 *     significant antecedents of customer satisfaction, adjudicating the earlier
 *     contest in favor of the expectation–disconfirmation structure and settling
 *     it as the standard paradigm of satisfaction research in the expert literature.
 *
 * Two transitions: RECORDED -> CONTESTED (1982-11) and CONTESTED -> SETTLED
 * (2001-12). Community: EXPERT_LITERATURE. Date precision: MONTH.
 */

const claimId = 'cmplxlall00c1sa7fobpn65z0';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (1982-11) — Churchill & Surprenant ---
  const contestSource = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.2307/3151722' },
    update: {},
    create: {
      externalId: 'src:doi:10.2307/3151722',
      name:
        'Churchill GA, Surprenant C (1982), "An Investigation into the ' +
        'Determinants of Customer Satisfaction," Journal of Marketing Research ' +
        '19(4):491–504',
      url: 'https://doi.org/10.2307/3151722',
      publishedAt: new Date('1982-11-01'),
      methodologyType: 'primary',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('1982-11-01');
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
        datePrecision: 'MONTH',
        sourceId: contestSource.id,
        reason:
          'Churchill & Surprenant (1982, Journal of Marketing Research) ran an ' +
          'early empirical test of the disconfirmation paradigm and found that ' +
          'for a durable good the expectation and disconfirmation effects Oliver ' +
          'posited were weak or absent while perceived performance dominated the ' +
          'satisfaction judgment. The result directly challenged the antecedent ' +
          'structure of the cognitive model and opened a methodological contest ' +
          '("performance-only vs. disconfirmation") that persisted through the ' +
          '1980s–90s satisfaction literature.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> SETTLED (2001-12) — Szymanski & Henard meta-analysis ---
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1177/0092070301291002' },
    update: {},
    create: {
      externalId: 'src:doi:10.1177/0092070301291002',
      name:
        'Szymanski DM, Henard DH (2001), "Customer Satisfaction: A Meta-Analysis ' +
        'of the Empirical Evidence," Journal of the Academy of Marketing Science ' +
        '29(1):16–35',
      url: 'https://doi.org/10.1177/0092070301291002',
      publishedAt: new Date('2001-12-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2001-12-01');
    const toAxis = 'SETTLED';
    const slug = `${claimId}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`;
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      update: {},
      create: {
        id: slug,
        claimId,
        fromAxis: 'CONTESTED',
        toAxis,
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        sourceId: settleSource.id,
        reason:
          'Szymanski & Henard (2001, Journal of the Academy of Marketing Science) ' +
          'meta-analyzed the accumulated empirical evidence on customer ' +
          'satisfaction and found both expectations and, most strongly, ' +
          'disconfirmation to be robust and significant antecedents of ' +
          'satisfaction. The meta-analysis adjudicated the earlier ' +
          'performance-vs-disconfirmation contest in favor of Oliver\'s ' +
          'expectation–disconfirmation structure, settling it as the standard ' +
          'paradigm of satisfaction research in the expert literature.',
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
