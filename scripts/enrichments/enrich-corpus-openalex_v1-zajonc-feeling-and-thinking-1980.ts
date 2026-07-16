import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Zajonc, R. B. "Feeling and thinking: Preferences need no inferences."
 *   American Psychologist 1980;35(2):151–175.
 *   DOI: 10.1037/0003-066x.35.2.151   (OpenAlex W2042276900)
 *   Claim id: cmplxrrym03hdsa7f2juumq27
 *
 * Identity confirmed via Crossref: DOI 10.1037/0003-066x.35.2.151 resolves to
 * "Feeling and thinking: Preferences need no inferences." by Zajonc, American
 * Psychologist, Feb 1980 — matching the given OpenAlex ID and DOI.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1980-02-01) already exists; not duplicated.
 * No retraction or expression of concern exists (Crossref shows no update-to record;
 * this is a theoretical claim, not subject to replication/retraction pathways).
 *
 * Post-publication arc (one verified transition):
 *
 *   (1) RECORDED -> CONTESTED @ 1982-09 (EXPERT_LITERATURE)
 *       Zajonc's central thesis — that affect is primary and can precede/operate
 *       independently of cognition — was directly and famously challenged by
 *       Richard S. Lazarus, "Thoughts on the relations between emotion and
 *       cognition," American Psychologist 1982;37(9):1019–1024
 *       (DOI 10.1037/0003-066x.37.9.1019). Lazarus argued cognitive appraisal is
 *       a necessary precondition for emotion, opening the well-documented
 *       Zajonc–Lazarus "affective vs. cognitive primacy" debate (continued in
 *       Zajonc 1984 and Lazarus 1984). This is the specific, dated adjudicating
 *       challenge; the debate was never resolved to a single settled consensus,
 *       so no SETTLED/REVERSED transition is asserted.
 *       Verified: Crossref metadata for DOI 10.1037/0003-066x.37.9.1019.
 */

const claimId = 'cmplxrrym03hdsa7f2juumq27';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (1982-09), Lazarus rebuttal ---
  const sourceLazarus = await prisma.source.upsert({
    where: { externalId: 'src:lazarus-emotion-cognition-1982' },
    update: {},
    create: {
      externalId: 'src:lazarus-emotion-cognition-1982',
      name:
        'Lazarus, R. S. "Thoughts on the relations between emotion and cognition." ' +
        'American Psychologist 1982;37(9):1019–1024.',
      url: 'https://doi.org/10.1037/0003-066x.37.9.1019',
      publishedAt: new Date('1982-09-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('1982-09-01');
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
        sourceId: sourceLazarus.id,
        reason:
          "Zajonc's thesis of affective primacy — that affect can precede and operate " +
          'independently of cognition — was directly contested by Richard S. Lazarus in ' +
          '"Thoughts on the relations between emotion and cognition" (American Psychologist, ' +
          'Sept 1982), which argued that cognitive appraisal is a necessary precondition ' +
          'for emotion. This rebuttal opened the well-known Zajonc–Lazarus primacy debate; ' +
          'the finding entered a contested state that the field never adjudicated to a ' +
          'single settled consensus.',
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
