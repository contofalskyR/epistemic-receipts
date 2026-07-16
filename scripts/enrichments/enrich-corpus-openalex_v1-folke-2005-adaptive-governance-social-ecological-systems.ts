import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Folke C, Hahn T, Olsson P, Norberg J. "Adaptive Governance of
 *   Social-Ecological Systems." Annual Review of Environment and Resources,
 *   30:441-473, 2005. DOI 10.1146/annurev.energy.30.050504.144511.
 *   Claim id: cmplyowxq00rtsaqkhebm605z  (OpenAlex W1976759885)
 *
 * The review synthesized case experiences of adaptive governance of
 * social-ecological systems during periods of abrupt change (crisis),
 * identifying social sources of renewal and reorganization: leadership,
 * trust, vision, cross-level social networks, and key individuals who help
 * transform management. It became the foundational reference for the
 * "adaptive governance" framework.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2005-07-25) already exists; not duplicated.
 *
 * Post-publication assessment:
 *   - No retraction / expression of concern. Crossref/doi.org resolve the
 *     original DOI (verified: doi.org 302 -> publisher 200); no Retraction
 *     Watch or Annual Reviews notice.
 *   - CONTESTED (2016-03): Karpouzoglou T, Dewulf A, Clark J. "Advancing
 *     adaptive governance of social-ecological systems through theoretical
 *     multiplicity." Environmental Science & Policy 57:1-9. DOI
 *     10.1016/j.envsci.2015.11.011 (verified: Crossref confirms title/authors/
 *     venue/date; doi.org 302 -> 200). A critical review arguing the adaptive
 *     governance framework, as established by Folke et al. 2005, has important
 *     conceptual and practical gaps — especially weak connection between its
 *     theoretical claims and real-world application — and calls for "theoretical
 *     multiplicity" to give the field greater analytical rigour. This
 *     methodological critique contested the sufficiency of the framework.
 *   - SETTLED (2018-09-15): Sharma-Wallace L, Velarde SJ, Wreford A. "Adaptive
 *     governance good practice: Show me the evidence!" Journal of Environmental
 *     Management 222:174-184. DOI 10.1016/j.jenvman.2018.05.067 (verified:
 *     PubMed 29843090; Crossref confirms metadata; doi.org 302 -> 200). A
 *     systematic literature review that responded directly to the empirical
 *     challenge, analysing the body of adaptive-governance case evidence. It
 *     found that the methods empirically driving successful adaptive governance
 *     across cases "resemble the design recommendations outlined in previous
 *     adaptive governance scholarship" — meaningful collaboration across actors
 *     and scales, cross-level coordination, building social capital, community
 *     empowerment, capacity development, linking knowledge to decision-making,
 *     and promoting leadership capacity. This is precisely the set of social
 *     sources of renewal Folke et al. 2005 identified, vindicating the
 *     framework's core empirical claims in the expert literature.
 *
 * Arc: RECORDED -> CONTESTED (2016-03) -> SETTLED (2018-09-15).
 * Community: EXPERT_LITERATURE.
 */

const claimId = 'cmplyowxq00rtsaqkhebm605z';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (2016-03), Karpouzoglou et al. critical review ---
  const karpouzoglouSource = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1016/j.envsci.2015.11.011' },
    update: {},
    create: {
      externalId: 'src:doi:10.1016/j.envsci.2015.11.011',
      name:
        'Karpouzoglou T, Dewulf A, Clark J (2016), "Advancing adaptive governance of ' +
        'social-ecological systems through theoretical multiplicity," Environmental ' +
        'Science & Policy 57:1-9',
      url: 'https://doi.org/10.1016/j.envsci.2015.11.011',
      publishedAt: new Date('2016-03-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2016-03-01');
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
        sourceId: karpouzoglouSource.id,
        reason:
          'Karpouzoglou, Dewulf and Clark (Environmental Science & Policy, March 2016) ' +
          'published a critical review of the adaptive governance framework established by ' +
          'Folke et al. 2005, arguing it suffers from important conceptual and practical ' +
          'gaps — notably a weak link between its theoretical claims and real-world ' +
          'application — and calling for "theoretical multiplicity" to give the field ' +
          'greater analytical rigour. This methodological critique in the expert literature ' +
          'contested the sufficiency of the original framework.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> SETTLED (2018-09-15), Sharma-Wallace et al. systematic review ---
  const sharmaWallaceSource = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1016/j.jenvman.2018.05.067' },
    update: {},
    create: {
      externalId: 'src:doi:10.1016/j.jenvman.2018.05.067',
      name:
        'Sharma-Wallace L, Velarde SJ, Wreford A (2018), "Adaptive governance good ' +
        'practice: Show me the evidence!," Journal of Environmental Management 222:174-184',
      url: 'https://doi.org/10.1016/j.jenvman.2018.05.067',
      publishedAt: new Date('2018-09-15'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2018-09-15');
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
        sourceId: sharmaWallaceSource.id,
        reason:
          'Sharma-Wallace, Velarde and Wreford (Journal of Environmental Management, ' +
          'September 2018) conducted a systematic literature review of the empirical ' +
          'adaptive-governance case evidence, responding directly to the earlier charge ' +
          'that the framework lacked evidentiary grounding. They found that the methods ' +
          'empirically driving successful adaptive governance across cases resemble the ' +
          'design recommendations of prior adaptive-governance scholarship — collaboration ' +
          'across actors and scales, cross-level coordination, social capital, community ' +
          'empowerment, capacity development, knowledge-to-decision linkage, and leadership ' +
          'capacity — precisely the social sources of renewal Folke et al. 2005 identified. ' +
          'This adjudication settled the contested evidence base by vindicating the ' +
          "framework's core empirical claims.",
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
