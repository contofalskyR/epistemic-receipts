import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Charles Darwin. "The Descent of Man, and Selection in Relation to Sex."
 *   (This corpus record is the 1907 Japanese translation by Tanaka Shigeho in
 *   the Journal of the Anthropological Society of Tokyo / Tokyo Jinrui Gakkai
 *   zasshi, vol. 22, no. 258, pp. 495-514.)
 *   DOI 10.1537/ase1887.22.495.  Claim id cmq2w4fnx009rsa8hazcmrumf
 *   (OpenAlex W2161899020).
 *
 * Identity confirmed via OpenAlex W2161899020 (title "The descent of man and
 * selection in relation to sex", author ダーウィン チャールス = Charles Darwin,
 * translator 田中 茂穂 = Tanaka Shigeho) and DOI 10.1537/ase1887.22.495.
 * is_retracted = false; no expression of concern (it is a translated reprint of
 * a foundational 19th-century monograph, not a primary empirical paper).
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1907-01-01) already exists; not
 * duplicated. The distinctive thesis of THIS book — the second half named in
 * its title, "selection in relation to sex," i.e. sexual selection driven by
 * female mate choice — has a well-documented CONTESTED -> SETTLED arc in the
 * expert literature. (Human common descent, the book's other thesis, was
 * accepted rapidly by biologists; sexual selection is the part that was first
 * eclipsed and later experimentally vindicated, so it is the tractable arc.)
 *
 * Post-publication arc (two verified transitions, both after the 1907 baseline):
 *
 *   RECORDED -> CONTESTED @ 1938-09 (EXPERT_LITERATURE)
 *       Julian S. Huxley, "Darwin's Theory of Sexual Selection and the Data
 *       Subsumed by It, in the Light of Recent Research," The American
 *       Naturalist 72(742):416-433 (Sept 1938). Huxley's paper is the
 *       emblematic statement of the early-20th-century "eclipse of sexual
 *       selection": it doubted Darwinian female choice and argued much of
 *       sexual selection reduced to natural selection. DOI 10.1086/280795.
 *
 *   CONTESTED -> SETTLED @ 1982-10-28 (EXPERT_LITERATURE)
 *       Malte Andersson, "Female choice selects for extreme tail length in a
 *       widowbird," Nature 299:818-820 (28 Oct 1982). The first clean
 *       experimental demonstration that female choice drives the evolution of
 *       an exaggerated male ornament — directly vindicating Darwin's
 *       sexual-selection-by-female-choice mechanism. Its reference #1 is
 *       Darwin's Descent of Man. DOI 10.1038/299818a0.
 *
 * NOTE: The 11,008 citation count is NOT treated as a settling event; each
 * transition rests on a specific, dated, DOI-resolvable adjudicating document.
 */

const claimId = 'cmq2w4fnx009rsa8hazcmrumf';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (1938-09), Huxley's eclipse-era critique ---
  const sourceHuxley = await prisma.source.upsert({
    where: { externalId: 'src:huxley-1938-sexual-selection-american-naturalist' },
    update: {},
    create: {
      externalId: 'src:huxley-1938-sexual-selection-american-naturalist',
      name:
        'Julian S. Huxley, "Darwin\'s Theory of Sexual Selection and the Data ' +
        'Subsumed by It, in the Light of Recent Research." The American ' +
        'Naturalist 72(742):416-433 (September 1938).',
      url: 'https://doi.org/10.1086/280795',
      publishedAt: new Date('1938-09-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('1938-09-01');
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
        sourceId: sourceHuxley.id,
        reason:
          "Julian Huxley's 1938 American Naturalist paper is the emblematic statement " +
          'of the early-20th-century "eclipse of sexual selection." Huxley doubted ' +
          "Darwin's mechanism of female mate choice and argued that much of sexual " +
          'selection could be reduced to ordinary natural selection, marking the point ' +
          "at which the book's distinctive thesis became actively contested in the " +
          'expert literature.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> SETTLED (1982-10-28), Andersson's widowbird experiment ---
  const sourceAndersson = await prisma.source.upsert({
    where: { externalId: 'src:andersson-1982-widowbird-female-choice-nature' },
    update: {},
    create: {
      externalId: 'src:andersson-1982-widowbird-female-choice-nature',
      name:
        'Malte Andersson, "Female choice selects for extreme tail length in a ' +
        'widowbird." Nature 299:818-820 (28 October 1982).',
      url: 'https://doi.org/10.1038/299818a0',
      publishedAt: new Date('1982-10-28'),
      methodologyType: 'experimental',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('1982-10-28');
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
        sourceId: sourceAndersson.id,
        reason:
          "Andersson's 1982 widowbird field experiment provided the first clean " +
          'experimental demonstration that female choice drives the evolution of an ' +
          'exaggerated male ornament — males with artificially lengthened tails won ' +
          "more mates — directly vindicating Darwin's sexual-selection-by-female-choice " +
          'mechanism. It cites Darwin\'s Descent of Man as reference #1 and is universally ' +
          'treated as the empirical settling of the century-long dispute.',
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
