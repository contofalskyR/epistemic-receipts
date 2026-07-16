import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   O'Keefe J, Nadel L. "The Hippocampus as a Cognitive Map."
 *   Oxford: Clarendon Press / Oxford University Press, 1978.
 *   Claim id: cmplxl5u800a1sa7fq2xhubuh  (OpenAlex W2103692957)
 *   No DOI (monograph). Identity confirmed via chapter-title match against the
 *   book's table of contents (Ch.1 "Remembrance of places past" … Ch.9
 *   "Operants: the limited role of the locale system" …) and OpenAlex ID.
 *
 * The book proposed the "cognitive map" theory of hippocampal function: that
 * the hippocampus builds an allocentric spatial map of the environment (the
 * "locale system"), grounded in O'Keefe's 1971 discovery of place cells.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1978-01-01) already exists; not duplicated.
 * No retraction or expression of concern exists for this monograph.
 *
 * Post-publication arc (one verified transition):
 *
 *   (1) RECORDED -> SETTLED @ 2014-10-06 (INSTITUTIONAL)
 *       The Nobel Prize in Physiology or Medicine 2014 was awarded, one half to
 *       John O'Keefe (the other half jointly to May-Britt Moser and Edvard I.
 *       Moser), "for their discoveries of cells that constitute a positioning
 *       system in the brain." The Nobel Assembly at Karolinska Institutet thereby
 *       ratified the hippocampal spatial-mapping theory articulated in this book
 *       as established science — a field-consensus institutional settling.
 *       Verified: https://www.nobelprize.org/prizes/medicine/2014/summary/ (200).
 *
 * A specific, dated, verifiable adjudicating event; a single high-confidence
 * transition is preferred over padding with a speculative earlier "contest."
 */

const claimId = 'cmplxl5u800a1sa7fq2xhubuh';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2014-10-06), Nobel Prize vindication ---
  const sourceNobel = await prisma.source.upsert({
    where: { externalId: 'src:nobel-prize-medicine-2014' },
    update: {},
    create: {
      externalId: 'src:nobel-prize-medicine-2014',
      name:
        'The Nobel Prize in Physiology or Medicine 2014 — John O\'Keefe, ' +
        'May-Britt Moser and Edvard I. Moser, "for their discoveries of cells ' +
        'that constitute a positioning system in the brain." Nobel Assembly, ' +
        'Karolinska Institutet.',
      url: 'https://www.nobelprize.org/prizes/medicine/2014/summary/',
      publishedAt: new Date('2014-10-06'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2014-10-06');
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
        community: 'INSTITUTIONAL',
        occurredAt,
        datePrecision: 'DAY',
        sourceId: sourceNobel.id,
        reason:
          "O'Keefe & Nadel's cognitive-map theory of the hippocampus was ratified " +
          'as established science by the 2014 Nobel Prize in Physiology or Medicine, ' +
          'awarded half to John O\'Keefe "for the discovery of cells that constitute ' +
          'a positioning system in the brain" (shared with the Mosers, discoverers of ' +
          'grid cells). The Nobel Assembly at Karolinska Institutet\'s recognition ' +
          'marks the institutional settling of the hippocampal spatial-mapping account ' +
          'advanced in this 1978 monograph.',
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
