import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Fredricks J.A., Blumenfeld P.C., Paris A.H. "School Engagement: Potential of the
 *   Concept, State of the Evidence." Review of Educational Research, 2004;74(1):59-109.
 *   DOI 10.3102/00346543074001059.
 *   Claim id: cmply0oq007odsa7flykoetk1  (OpenAlex W2169570446)
 *
 * This review consolidated "school engagement" as a multifaceted construct with three
 * components — behavioral, emotional, and cognitive engagement — presumed malleable and
 * predictive of academic achievement, and recommended studying engagement as a
 * multidimensional construct.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2004-03-01) already exists; not duplicated.
 * Identity confirmed via Crossref: title "School Engagement: Potential of the Concept,
 * State of the Evidence", authors Fredricks/Blumenfeld/Paris, Review of Educational
 * Research, 2004-03 — matches DOI and OpenAlex ID. No retraction or expression of
 * concern (Crossref returns no update-to/updated-by).
 *
 * Post-publication arc (two verified transitions):
 *
 *   (1) RECORDED -> CONTESTED @ 2011-10 (EXPERT_LITERATURE)
 *       Reeve J., Tseng C-M. "Agency as a fourth aspect of students' engagement during
 *       learning activities." Contemporary Educational Psychology, 2011;36(4):257-267.
 *       DOI 10.1016/j.cedpsych.2011.05.002. A dated methodological critique arguing the
 *       three-component (behavioral/emotional/cognitive) model is incomplete and omits
 *       students' constructive, proactive contribution, proposing "agentic engagement"
 *       as a fourth dimension — a direct challenge to the dimensional adequacy of the
 *       tripartite construct advanced by Fredricks et al.
 *
 *   (2) CONTESTED -> SETTLED @ 2018-03-25 (EXPERT_LITERATURE)
 *       Lei H., Cui Y., Zhou W. "Relationships between student engagement and academic
 *       achievement: A meta-analysis." Social Behavior and Personality, 2018;46(3):517-528.
 *       DOI 10.2224/sbp.7054. A meta-analysis pooling evidence across studies confirmed a
 *       significant positive relationship between engagement and academic achievement and
 *       examined the behavioral, emotional, and cognitive dimensions, reaffirming the
 *       empirical value of the tripartite construct. The three-component model remained the
 *       field's operational standard (agentic engagement an optional addition, not a
 *       replacement), settling the construct's evidentiary standing.
 */

const claimId = 'cmply0oq007odsa7flykoetk1';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (2011-10), Reeve & Tseng agentic-engagement critique ---
  const sourceReeveTseng = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1016/j.cedpsych.2011.05.002' },
    update: {},
    create: {
      externalId: 'src:doi:10.1016/j.cedpsych.2011.05.002',
      name:
        'Reeve J, Tseng C-M. (2011), "Agency as a fourth aspect of students\u2019 ' +
        'engagement during learning activities," Contemporary Educational Psychology ' +
        '36(4):257-267',
      url: 'https://doi.org/10.1016/j.cedpsych.2011.05.002',
      publishedAt: new Date('2011-10-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2011-10-01');
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
        sourceId: sourceReeveTseng.id,
        reason:
          'Reeve & Tseng (Contemporary Educational Psychology, 2011) argued the ' +
          'behavioral/emotional/cognitive model advanced by Fredricks et al. is ' +
          'incomplete — it omits students\u2019 constructive, proactive contribution — ' +
          'and proposed "agentic engagement" as a fourth dimension. This dated ' +
          'methodological critique directly challenged the dimensional adequacy of the ' +
          'tripartite engagement construct.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> SETTLED (2018-03-25), Lei/Cui/Zhou meta-analysis ---
  const sourceLeiCuiZhou = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.2224/sbp.7054' },
    update: {},
    create: {
      externalId: 'src:doi:10.2224/sbp.7054',
      name:
        'Lei H, Cui Y, Zhou W. (2018), "Relationships between student engagement and ' +
        'academic achievement: A meta-analysis," Social Behavior and Personality ' +
        '46(3):517-528 (DOI 10.2224/sbp.7054)',
      url: 'https://www.sbp-journal.com/index.php/sbp/article/view/7054',
      publishedAt: new Date('2018-03-25'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2018-03-25');
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
        datePrecision: 'DAY',
        sourceId: sourceLeiCuiZhou.id,
        reason:
          'Lei, Cui & Zhou (Social Behavior and Personality, 2018) meta-analyzed studies ' +
          'of engagement and academic achievement, confirming a significant positive ' +
          'relationship and examining the behavioral, emotional, and cognitive dimensions. ' +
          'The pooled evidence reaffirmed the empirical value of the tripartite construct, ' +
          'which remained the field\u2019s operational standard (agentic engagement an ' +
          'optional addition rather than a replacement), settling the construct\u2019s ' +
          'evidentiary standing.',
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
