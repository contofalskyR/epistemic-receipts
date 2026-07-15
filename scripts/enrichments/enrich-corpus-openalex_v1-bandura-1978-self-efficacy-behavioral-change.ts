import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Bandura A.
 *   "Self-efficacy: Toward a unifying theory of behavioral change."
 *   Advances in Behaviour Research and Therapy, 1978, 1(4):139-161.
 *   DOI 10.1016/0146-6402(78)90002-4.
 *   Claim id: cmplxwqty05tpsa7fu94nvfi0  (OpenAlex W2179683524)
 *
 * Bandura's foundational paper proposed that perceived self-efficacy — a person's
 * belief in their capability to execute a behavior — is a common cognitive mechanism
 * mediating behavioral change across treatments, and predicts effort and performance.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1978-01-01) already exists; not duplicated.
 * Identity confirmed via Crossref: title/author (Bandura) / journal (Advances in
 * Behaviour Research and Therapy) / 1978 / 1(4):139-161 all match the DOI and OpenAlex ID.
 * No retraction or expression of concern (Crossref returns empty update-to).
 *
 * Post-publication arc (two verified transitions):
 *
 *   (1) RECORDED -> SETTLED @ 1998-09 (EXPERT_LITERATURE)
 *       Stajkovic AD, Luthans F.
 *       "Self-efficacy and work-related performance: A meta-analysis."
 *       Psychological Bulletin, 1998, 124(2):240-261. DOI 10.1037/0033-2909.124.2.240.
 *       This adjudicating meta-analysis pooled 114 studies (N=21,616) and found a
 *       significant weighted average correlation of G(r)=.38 between self-efficacy and
 *       work-related performance, quantitatively vindicating the core predictive claim
 *       of Bandura's theory in the between-person literature.
 *
 *   (2) SETTLED -> CONTESTED @ 2001 (EXPERT_LITERATURE)
 *       Vancouver JB, Thompson CM, Williams AA.
 *       "The changing signs in the relationships among self-efficacy, personal goals,
 *       and performance." Journal of Applied Psychology, 2001, 86(4):605-620.
 *       DOI 10.1037/0021-9010.86.4.605.
 *       Vancouver and colleagues reported that, analyzed within-person, higher
 *       self-efficacy could be NEGATIVELY related to subsequent performance, directly
 *       challenging the presumed universally positive causal effect. This opened a
 *       still-live methodological debate (Bandura & Locke, "Negative self-efficacy and
 *       goal effects revisited," JAP 2003, 88(1):87-99, DOI 10.1037/0021-9010.88.1.87),
 *       so the claim's current axis is CONTESTED rather than settled.
 */

const claimId = 'cmplxwqty05tpsa7fu94nvfi0';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (1998-09), Stajkovic & Luthans meta-analysis ---
  const sourceMeta = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1037/0033-2909.124.2.240' },
    update: {},
    create: {
      externalId: 'src:doi:10.1037/0033-2909.124.2.240',
      name:
        'Stajkovic AD, Luthans F (1998), "Self-efficacy and work-related ' +
        'performance: A meta-analysis," Psychological Bulletin 124(2):240-261',
      url: 'https://doi.org/10.1037/0033-2909.124.2.240',
      publishedAt: new Date('1998-09-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('1998-09-01');
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
        sourceId: sourceMeta.id,
        reason:
          'The meta-analysis by Stajkovic & Luthans (1998, Psychological Bulletin) ' +
          'pooled 114 studies (N=21,616) and found a significant weighted average ' +
          'correlation of G(r)=.38 between self-efficacy and work-related performance. ' +
          'This adjudicating quantitative synthesis vindicated the core predictive ' +
          'claim of Bandura\'s self-efficacy theory in the between-person literature, ' +
          'moving the finding RECORDED -> SETTLED.',
      },
    });
  }

  // --- Transition 2: SETTLED -> CONTESTED (2001), Vancouver et al. negative within-person effect ---
  const sourceVancouver = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1037/0021-9010.86.4.605' },
    update: {},
    create: {
      externalId: 'src:doi:10.1037/0021-9010.86.4.605',
      name:
        'Vancouver JB, Thompson CM, Williams AA (2001), "The changing signs in the ' +
        'relationships among self-efficacy, personal goals, and performance," ' +
        'Journal of Applied Psychology 86(4):605-620',
      url: 'https://doi.org/10.1037/0021-9010.86.4.605',
      publishedAt: new Date('2001-01-01'),
      methodologyType: 'primary',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2001-01-01');
    const toAxis = 'CONTESTED';
    const slug = `${claimId}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`;
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      update: {},
      create: {
        id: slug,
        claimId,
        fromAxis: 'SETTLED',
        toAxis,
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'YEAR',
        sourceId: sourceVancouver.id,
        reason:
          'Vancouver, Thompson & Williams (2001, Journal of Applied Psychology) ' +
          'reported that, analyzed within-person, higher self-efficacy could be ' +
          'NEGATIVELY related to subsequent performance, directly challenging the ' +
          'presumed universally positive causal effect central to the theory. This ' +
          'opened a substantive, still-unresolved methodological debate (Bandura & ' +
          'Locke replied in JAP 2003), moving the finding SETTLED -> CONTESTED.',
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
