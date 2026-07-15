import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   NHLBI Obesity Education Initiative Expert Panel.
 *   "Clinical Guidelines on the Identification, Evaluation, and Treatment of
 *   Overweight and Obesity in Adults: The Evidence Report."
 *   National Heart, Lung, and Blood Institute / NIH, 1998.
 *   DOI 10.1037/e565682010-001 (APA deposit).
 *   Claim id: cmply4abi003rsaihnfswctfh  (OpenAlex W3172478362)
 *
 * The 1998 NHLBI evidence report codified the BMI-based classification of
 * overweight (BMI >=25) and obesity (BMI >=30) for U.S. clinical practice and
 * established a risk-stratified evaluation-and-treatment framework for adults.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1998-01-01) already exists; not duplicated.
 * Identity confirmed via Crossref: title / American Psychological Association deposit /
 * 1998 match the DOI and OpenAlex ID. No retraction or expression of concern
 * (Crossref returns no update-to/updated-by for the record).
 *
 * Post-publication arc (two verified transitions):
 *
 *   (1) RECORDED -> CONTESTED @ 2013-01 (EXPERT_LITERATURE)
 *       Flegal KM, Kit BK, Orpana H, Graubard BI.
 *       "Association of All-Cause Mortality With Overweight and Obesity Using
 *       Standard Body Mass Index Categories: A Systematic Review and Meta-analysis."
 *       JAMA 2013;309(1):71-82. PMID 23280227. DOI 10.1001/jama.2012.113905.
 *       This highly-cited meta-analysis (97 studies, ~2.88M individuals) found that
 *       the overweight category (BMI 25-<30) codified by the 1998 report was
 *       associated with significantly LOWER all-cause mortality (pooled HR ~0.94),
 *       directly challenging the report's premise that overweight uniformly
 *       elevates mortality risk. A specific, dated, peer-reviewed contest.
 *
 *   (2) CONTESTED -> SETTLED @ 2013-11 (INSTITUTIONAL)
 *       Jensen MD, Ryan DH, Apovian CM, et al. (AHA/ACC/TOS)
 *       "2013 AHA/ACC/TOS Guideline for the Management of Overweight and Obesity
 *       in Adults." Circulation 2014;129(25 Suppl 2):S102-138. PMID 24222017.
 *       The evidence-based successor guideline retained and reaffirmed the
 *       BMI-based classification (overweight >=25, obesity >=30) and the
 *       risk-stratified treatment approach established by the 1998 report,
 *       institutionalizing the framework as clinical consensus despite the
 *       mortality-paradox debate above — a field-consensus settling of the finding.
 */

const claimId = 'cmply4abi003rsaihnfswctfh';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (2013-01), Flegal mortality meta-analysis ---
  const sourceFlegal = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1001/jama.2012.113905' },
    update: {},
    create: {
      externalId: 'src:doi:10.1001/jama.2012.113905',
      name:
        'Flegal KM, et al. (2013), "Association of All-Cause Mortality With ' +
        'Overweight and Obesity Using Standard Body Mass Index Categories: A ' +
        'Systematic Review and Meta-analysis," JAMA 309(1):71-82',
      url: 'https://pubmed.ncbi.nlm.nih.gov/23280227/',
      publishedAt: new Date('2013-01-02'),
      methodologyType: 'meta-analysis',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2013-01-02');
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
        datePrecision: 'DAY',
        sourceId: sourceFlegal.id,
        reason:
          'Flegal et al. (2013), a systematic review and meta-analysis of 97 studies ' +
          '(~2.88M individuals) in JAMA, found that the overweight category (BMI 25-<30) ' +
          'codified by the 1998 NHLBI report was associated with significantly LOWER ' +
          "all-cause mortality (pooled HR ~0.94), directly challenging the report's " +
          'premise that overweight uniformly elevates mortality risk. This widely-cited, ' +
          'dated peer-reviewed contest marked the risk framing as actively disputed.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> SETTLED (2013-11), AHA/ACC/TOS successor guideline ---
  const sourceJensen = await prisma.source.upsert({
    where: { externalId: 'src:pmid:24222017' },
    update: {},
    create: {
      externalId: 'src:pmid:24222017',
      name:
        'Jensen MD, et al. (AHA/ACC/TOS, 2013), "2013 AHA/ACC/TOS Guideline for the ' +
        'Management of Overweight and Obesity in Adults," Circulation 129(25 Suppl 2):S102-138',
      url: 'https://pubmed.ncbi.nlm.nih.gov/24222017/',
      publishedAt: new Date('2013-11-01'),
      methodologyType: 'guideline',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2013-11-01');
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
        community: 'INSTITUTIONAL',
        occurredAt,
        datePrecision: 'MONTH',
        sourceId: sourceJensen.id,
        reason:
          'The 2013 AHA/ACC/TOS guideline (Jensen et al.), the evidence-based successor to ' +
          'the 1998 NHLBI report, retained and reaffirmed its BMI-based classification ' +
          '(overweight >=25, obesity >=30) and risk-stratified treatment framework as the ' +
          'standard of care for U.S. adults. Despite the mortality-paradox debate, this ' +
          'institutional consensus settled the report\'s classification-and-treatment ' +
          'framework as clinical doctrine.',
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
