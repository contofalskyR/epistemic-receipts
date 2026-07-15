import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Hart PE, Nilsson NJ, Raphael B. "A Formal Basis for the Heuristic
 *   Determination of Minimum Cost Paths." IEEE Transactions on Systems Science
 *   and Cybernetics, 1968. DOI 10.1109/tssc.1968.300136.
 *   Claim id: cmq2w4cx30083sa8hfrfrbzce  (OpenAlex W1969483458)
 *
 * The paper introduced the A* graph-search algorithm and a formal theory of
 * heuristically guided minimum-cost path finding, including the admissibility
 * result and an "optimality" theorem claiming A* expands no more nodes than any
 * other admissible algorithm using the same heuristic.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1968-01-01) already exists; not duplicated.
 *
 * Post-publication assessment:
 *   - No retraction / expression of concern. Crossref returns the original DOI
 *     with empty `update-to` / `updated-by` fields (verified; doi.org resolves 302).
 *   - CONTESTED (1972-12): The three original authors published a formal
 *     "Correction to 'A Formal Basis for the Heuristic Determination of Minimum
 *     Cost Paths'" in ACM SIGART Bulletin (Issue 37, Dec 1972). DOI
 *     10.1145/1056777.1056779 (verified: Crossref confirms title/authors/date/
 *     venue; doi.org resolves 302). The correction acknowledged that the original
 *     node-expansion "optimality" theorem did not hold as stated and had to be
 *     restricted to consistent (monotone) heuristics — a self-published
 *     methodological correction that contested the strongest form of the result.
 *   - SETTLED (1985-07): Dechter R, Pearl J. "Generalized best-first search
 *     strategies and the optimality of A*." Journal of the ACM 32(3):505-536,
 *     July 1985. DOI 10.1145/3828.3830 (verified: Crossref confirms metadata;
 *     doi.org resolves 302). This paper gave the definitive treatment of the
 *     optimality question opened by the correction, establishing precisely the
 *     conditions under which A* is optimal over admissible best-first algorithms
 *     and thereby settling the long-running dispute in the expert literature.
 *
 * Arc: RECORDED -> CONTESTED (1972-12) -> SETTLED (1985-07).
 * Community: EXPERT_LITERATURE. Date precision: MONTH.
 */

const claimId = 'cmq2w4cx30083sa8hfrfrbzce';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (1972-12), authors' own correction ---
  const correctionSource = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1145/1056777.1056779' },
    update: {},
    create: {
      externalId: 'src:doi:10.1145/1056777.1056779',
      name:
        'Hart PE, Nilsson NJ, Raphael B (1972), "Correction to \'A Formal Basis ' +
        'for the Heuristic Determination of Minimum Cost Paths\'," ACM SIGART Bulletin, Issue 37',
      url: 'https://doi.org/10.1145/1056777.1056779',
      publishedAt: new Date('1972-12-01'),
      methodologyType: 'primary',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('1972-12-01');
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
        sourceId: correctionSource.id,
        reason:
          "In December 1972 the three original authors published a formal correction " +
          "in ACM SIGART Bulletin acknowledging that the 1968 paper's node-expansion " +
          '"optimality" theorem — that A* expands no more nodes than any other ' +
          'admissible algorithm using the same heuristic — did not hold as stated and ' +
          'had to be restricted to consistent (monotone) heuristics. This self-published ' +
          'methodological correction contested the strongest form of the original result.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> SETTLED (1985-07), Dechter & Pearl adjudication ---
  const dechterPearlSource = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1145/3828.3830' },
    update: {},
    create: {
      externalId: 'src:doi:10.1145/3828.3830',
      name:
        'Dechter R, Pearl J (1985), "Generalized best-first search strategies and ' +
        'the optimality of A*," Journal of the ACM 32(3):505-536',
      url: 'https://doi.org/10.1145/3828.3830',
      publishedAt: new Date('1985-07-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('1985-07-01');
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
        sourceId: dechterPearlSource.id,
        reason:
          'Dechter and Pearl (Journal of the ACM, July 1985) gave the definitive ' +
          'treatment of the optimality question left open by the 1972 correction, ' +
          'rigorously establishing the precise conditions under which A* is optimal ' +
          'over admissible best-first search algorithms. This adjudication in the ' +
          "expert literature settled the long-running dispute over A*'s optimality " +
          'claim, ratifying a corrected and delimited form of the original theorem.',
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
