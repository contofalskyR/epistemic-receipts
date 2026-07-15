import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Judea Pearl. "Causality: Models, Reasoning, and Inference" (2nd edition).
 *   Cambridge University Press, 2009. DOI 10.1017/cbo9780511803161.
 *   Claim id: cmplxlmjo00h1sa7fmn8e25ua  (OpenAlex W2143891888)
 *
 * Pearl's book presents and unifies the probabilistic, manipulative,
 * counterfactual, and structural approaches to causation, arguing that
 * causality had grown from a nebulous concept into a mathematical theory.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2009-09-14) already exists; not
 * duplicated. Identity confirmed via DOI resolution (10.1017/cbo9780511803161
 * -> Cambridge University Press page, HTTP 200) and OpenAlex W2143891888.
 * No retraction or expression of concern (it is a scholarly monograph, not a
 * primary empirical paper; no update-to/updated-by markers exist).
 *
 * Post-publication arc (one verified transition):
 *
 *   RECORDED -> SETTLED @ 2012-03-15 (INSTITUTIONAL)
 *       Judea Pearl received the 2011 ACM A.M. Turing Award, announced
 *       March 15, 2012, "for fundamental contributions to artificial
 *       intelligence through the development of a calculus for probabilistic
 *       and causal reasoning." The Turing-Award citation names precisely the
 *       framework this book presents and unifies. Computing's highest
 *       institutional honour formally ratified the book's central thesis —
 *       that causal reasoning had become a rigorous mathematical theory —
 *       marking a field-consensus settling of the finding.
 *
 * NOTE: A high citation count alone is NOT treated as a settling event; the
 * transition rests on the specific, dated ACM award, not on citation volume.
 */

const claimId = 'cmplxlmjo00h1sa7fmn8e25ua';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2012-03-15), ACM Turing Award ratification ---
  const sourceTuring = await prisma.source.upsert({
    where: { externalId: 'src:acm-turing-award-2011-judea-pearl' },
    update: {},
    create: {
      externalId: 'src:acm-turing-award-2011-judea-pearl',
      name:
        'ACM A.M. Turing Award 2011 — Judea Pearl, "for fundamental contributions ' +
        'to artificial intelligence through the development of a calculus for ' +
        'probabilistic and causal reasoning" (announced March 15, 2012)',
      url: 'https://en.wikipedia.org/wiki/Judea_Pearl',
      publishedAt: new Date('2012-03-15'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2012-03-15');
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
        sourceId: sourceTuring.id,
        reason:
          'On March 15, 2012 the ACM announced Judea Pearl as recipient of the 2011 ' +
          'A.M. Turing Award "for fundamental contributions to artificial intelligence ' +
          'through the development of a calculus for probabilistic and causal reasoning" ' +
          "— the exact framework this book presents and unifies. Computing's highest " +
          "institutional honour ratified the book's central thesis that causality had " +
          'become a rigorous mathematical theory, a field-consensus settling of the finding.',
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
