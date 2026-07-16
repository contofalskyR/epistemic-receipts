import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm11e1q0qyjsat0zvjyojyi'

// Post-publication trajectory for Pfeffer et al. (1992), the SAVE trial
// (Survival And Ventricular Enlargement), "Effect of captopril on mortality and
// morbidity in patients with left ventricular dysfunction after myocardial
// infarction," N Engl J Med 327(10):669-677.
// DOI 10.1056/nejm199209033271001 / OpenAlex W2312388685 / PMID 1386652.
//
// Baseline RECORDED row (fromAxis=null -> RECORDED @ 1992-09-03) already exists; not duplicated here.
//
// No retraction, expression of concern, or failed replication was found. The finding
// that ACE-inhibitor therapy reduces mortality/morbidity in patients with LV dysfunction
// after MI was vindicated and became field consensus. The adjudicating event is a
// systematic overview of individual-patient data.
//
// Verified adjudicating event:
//   RECORDED -> SETTLED @ 2000-05-06 — Flather, Yusuf, Køber, Pfeffer et al. for the
//   ACE-Inhibitor Myocardial Infarction Collaborative Group (2000), "Long-term
//   ACE-inhibitor therapy in patients with heart failure or left-ventricular dysfunction:
//   a systematic overview of data from individual patients," Lancet 355(9215):1575-1581
//   (PMID 10821360, DOI 10.1016/S0140-6736(00)02212-1). This prospective individual-patient
//   meta-analysis pooled the three major post-MI LV-dysfunction trials — SAVE, AIRE, and
//   TRACE (n=5,966 of the pooled cohort) — and confirmed significant reductions in
//   mortality, reinfarction, and heart-failure hospitalization. It adjudicated the SAVE
//   finding in favor of the original claim and consolidated ACE inhibition after MI with
//   LV dysfunction as standard-of-care consensus. Community: EXPERT_LITERATURE, DAY
//   precision (Lancet issue dated 6 May 2000). URL verified 200.

async function main() {
  const source = await prisma.source.upsert({
    where: { externalId: 'src:flather-2000-ace-inhibitor-mi-collaborative' },
    create: {
      externalId: 'src:flather-2000-ace-inhibitor-mi-collaborative',
      name: 'Flather MD, Yusuf S, Køber L, Pfeffer M, et al. (ACE-Inhibitor Myocardial Infarction Collaborative Group) (2000), "Long-term ACE-inhibitor therapy in patients with heart failure or left-ventricular dysfunction: a systematic overview of data from individual patients," Lancet 355(9215):1575-1581',
      url: 'https://pubmed.ncbi.nlm.nih.gov/10821360/',
      publishedAt: new Date('2000-05-06'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:save-captopril-lv-dysfunction-pfeffer-1992',
    },
    update: {
      name: 'Flather MD, Yusuf S, Køber L, Pfeffer M, et al. (ACE-Inhibitor Myocardial Infarction Collaborative Group) (2000), "Long-term ACE-inhibitor therapy in patients with heart failure or left-ventricular dysfunction: a systematic overview of data from individual patients," Lancet 355(9215):1575-1581',
      url: 'https://pubmed.ncbi.nlm.nih.gov/10821360/',
      publishedAt: new Date('2000-05-06'),
    },
  })

  const slug = `${CLAIM_ID}-SETTLED-2000-05-06`
  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2000-05-06'),
      datePrecision: 'DAY',
      reason:
        'The ACE-Inhibitor Myocardial Infarction Collaborative Group (Flather, Yusuf, Køber, Pfeffer et al., Lancet 2000;355:1575-1581) conducted a prospective systematic overview of individual-patient data pooling the three major post-MI LV-dysfunction trials — SAVE, AIRE, and TRACE — and confirmed that long-term ACE-inhibitor therapy significantly reduces mortality, reinfarction, and hospitalization for heart failure. This meta-analysis adjudicated the SAVE finding in favor of the original claim and consolidated ACE inhibition after myocardial infarction with LV dysfunction as established standard of care.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2000-05-06'),
      datePrecision: 'DAY',
      reason:
        'The ACE-Inhibitor Myocardial Infarction Collaborative Group (Flather, Yusuf, Køber, Pfeffer et al., Lancet 2000;355:1575-1581) conducted a prospective systematic overview of individual-patient data pooling the three major post-MI LV-dysfunction trials — SAVE, AIRE, and TRACE — and confirmed that long-term ACE-inhibitor therapy significantly reduces mortality, reinfarction, and hospitalization for heart failure. This meta-analysis adjudicated the SAVE finding in favor of the original claim and consolidated ACE inhibition after myocardial infarction with LV dysfunction as established standard of care.',
      sourceId: source.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: RECORDED -> SETTLED (Flather et al. 2000 collaborative meta-analysis)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
