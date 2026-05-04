// Seed: Tobacco smoking causes lung cancer — flagship case study
// Order: parent → children → sources → edges+revisions → threshold events → meta-edges
// Run: npx tsx scripts/seed-smoking-cancer.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NOW = new Date()

const REVIEW = {
  ingestedBy:       'manual',
  humanReviewed:    true,
  reviewConfidence: 'HIGH' as const,
  reviewedBy:       'robert',
  reviewedAt:       NOW,
}

async function edge(
  sourceId: string,
  claimId: string,
  type: string,
  evidenceType: string,
  score: number,
  reason: string,
) {
  const e = await prisma.edge.create({
    data: { sourceId, claimId, type, evidenceType, ...REVIEW },
  })
  await prisma.edgeRevision.create({
    data: { edgeId: e.id, priorScore: null, newScore: score, reason },
  })
  return e
}

async function main() {
  console.log('=== Smoking-Causes-Cancer Seed ===\n')

  // ── Step 1: Parent claim ────────────────────────────────────────────────────
  const parent = await prisma.claim.create({
    data: {
      text:                  'Tobacco smoking is a primary cause of lung cancer in humans, established through convergent evidence accumulated over decades despite organized industry contestation',
      claimType:             'HYBRID',
      claimEmergedAt:        new Date('1950-09-01'),
      claimEmergedPrecision: 'MONTH',
      currentStatus:         'HARD_FACT',
      ...REVIEW,
    },
  })
  console.log(`Parent: ${parent.id}`)

  // ── Step 2: Child claims ────────────────────────────────────────────────────
  const childA = await prisma.claim.create({
    data: {
      text:                  'Tobacco smoke contains identified chemical carcinogens including polycyclic aromatic hydrocarbons, N-nitrosamines, and aromatic amines',
      claimType:             'EMPIRICAL',
      claimEmergedAt:        new Date('1953-12-01'),
      claimEmergedPrecision: 'MONTH',
      currentStatus:         'HARD_FACT',
      parentClaimId:         parent.id,
      ...REVIEW,
    },
  })

  const childB = await prisma.claim.create({
    data: {
      text:                  'Smokers have substantially elevated lung cancer rates compared to non-smokers in matched cohort studies',
      claimType:             'EMPIRICAL',
      claimEmergedAt:        new Date('1950-09-01'),
      claimEmergedPrecision: 'MONTH',
      currentStatus:         'HARD_FACT',
      parentClaimId:         parent.id,
      ...REVIEW,
    },
  })

  const childC = await prisma.claim.create({
    data: {
      text:                  'The relationship between smoking and lung cancer is dose-dependent: more smoking produces higher cancer risk',
      claimType:             'EMPIRICAL',
      claimEmergedAt:        new Date('1956-06-01'),
      claimEmergedPrecision: 'MONTH',
      currentStatus:         'HARD_FACT',
      parentClaimId:         parent.id,
      ...REVIEW,
    },
  })

  const childD = await prisma.claim.create({
    data: {
      text:                  'Smoking cessation reduces lung cancer risk over time, with risk approaching that of never-smokers after sufficient years',
      claimType:             'EMPIRICAL',
      claimEmergedAt:        new Date('1964-01-11'),
      claimEmergedPrecision: 'DAY',
      currentStatus:         'HARD_FACT',
      parentClaimId:         parent.id,
      ...REVIEW,
    },
  })

  const childE = await prisma.claim.create({
    data: {
      text:                  "The 1964 U.S. Surgeon General's report concluded smoking causes lung cancer based on accumulated evidence",
      claimType:             'INSTITUTIONAL',
      claimEmergedAt:        new Date('1964-01-11'),
      claimEmergedPrecision: 'DAY',
      currentStatus:         'HARD_FACT',
      parentClaimId:         parent.id,
      ...REVIEW,
    },
  })

  const childF = await prisma.claim.create({
    data: {
      text:                  'Tobacco industry executives and internal research staff knew of the cancer-causation evidence by the 1950s-1960s while publicly disputing it',
      claimType:             'EMPIRICAL',
      claimEmergedAt:        new Date('1953-12-15'),
      claimEmergedPrecision: 'DAY',
      currentStatus:         'HARD_FACT',
      parentClaimId:         parent.id,
      ...REVIEW,
    },
  })

  console.log(`Children: A=${childA.id} B=${childB.id} C=${childC.id} D=${childD.id} E=${childE.id} F=${childF.id}`)

  // ── Step 3: Sources ─────────────────────────────────────────────────────────

  // Evidentiary primary research
  const src1 = await prisma.source.create({ data: {
    name: 'Doll & Hill — Smoking and Carcinoma of the Lung, BMJ (1950)',
    url: 'https://www.bmj.com/content/2/4682/739',
    publishedAt: new Date('1950-09-30'),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const src2 = await prisma.source.create({ data: {
    name: 'Wynder & Graham — Tobacco Smoking as a Possible Etiologic Factor in Bronchiogenic Carcinoma, JAMA (1950)',
    publishedAt: new Date('1950-05-27'),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const src3 = await prisma.source.create({ data: {
    name: 'Wynder, Graham & Croninger — Experimental Production of Carcinoma with Cigarette Tar (1953)',
    publishedAt: new Date('1953-12-01'),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const src4 = await prisma.source.create({ data: {
    name: 'Doll & Hill — The Mortality of Doctors in Relation to their Smoking Habits, BMJ (1954)',
    publishedAt: new Date('1954-06-26'),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const src5 = await prisma.source.create({ data: {
    name: 'Hammond & Horn — Smoking and Death Rates, JAMA (1958)',
    publishedAt: new Date('1958-03-15'),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const src6 = await prisma.source.create({ data: {
    name: "Doll & Hill — Mortality in Relation to Smoking: Ten Years' Observations of British Doctors (1964)",
    publishedAt: new Date('1964-05-30'),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const src7 = await prisma.source.create({ data: {
    name: 'U.S. Surgeon General Luther Terry — Smoking and Health: Report of the Advisory Committee (1964)',
    url: 'https://profiles.nlm.nih.gov/spotlight/nn/catalog/nlm:nlmuid-101584932X202-doc',
    publishedAt: new Date('1964-01-11'),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  // Procedural sources
  const src8 = await prisma.source.create({ data: {
    name: 'Master Settlement Agreement (1998) — settlement between 46 state AGs and major tobacco companies',
    url: 'https://www.naag.org/our-work/naag-center-for-tobacco-and-public-health/the-master-settlement-agreement/',
    publishedAt: new Date('1998-11-23'),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const src9 = await prisma.source.create({ data: {
    name: 'United States v. Philip Morris USA — RICO ruling, Judge Gladys Kessler (2006)',
    publishedAt: new Date('2006-08-17'),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  // Argumentative / scholarly synthesis
  const src10 = await prisma.source.create({ data: {
    name: 'Brandt — The Cigarette Century: The Rise, Fall, and Deadly Persistence of the Product That Defined America (2007)',
    publishedAt: new Date('2007-03-06'),
    methodologyType: 'derivative',
    ...REVIEW,
  }})

  const src11 = await prisma.source.create({ data: {
    name: 'Proctor — Golden Holocaust: Origins of the Cigarette Catastrophe and the Case for Abolition (2011)',
    publishedAt: new Date('2011-09-13'),
    methodologyType: 'derivative',
    ...REVIEW,
  }})

  const src12 = await prisma.source.create({ data: {
    name: 'Oreskes & Conway — Merchants of Doubt (2010), chapter on tobacco',
    publishedAt: new Date('2010-05-25'),
    methodologyType: 'derivative',
    ...REVIEW,
  }})

  // Industry counter-sources
  const src13 = await prisma.source.create({ data: {
    name: 'A Frank Statement to Cigarette Smokers — paid advertisement, January 1954',
    publishedAt: new Date('1954-01-04'),
    methodologyType: 'opinion',
    ...REVIEW,
  }})

  const src14 = await prisma.source.create({ data: {
    name: 'Tobacco Industry Research Committee (TIRC) — Scientific Research Reports, 1954-1965',
    publishedAt: new Date('1954-04-01'),
    methodologyType: 'derivative',
    ...REVIEW,
  }})

  await prisma.source.create({ data: {
    name: 'Council for Tobacco Research — Annual Reports (1964-1995)',
    publishedAt: new Date('1964-01-01'),
    methodologyType: 'derivative',
    ...REVIEW,
  }})

  // Internal industry documents (released via 1998 MSA)
  const src16 = await prisma.source.create({ data: {
    name: "Brown & Williamson — 'Doubt is Our Product' memo, Smoking and Health Proposal (1969)",
    url: 'https://www.industrydocuments.ucsf.edu/tobacco/docs/#id=psdw0147',
    publishedAt: new Date('1969-08-21'),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const src17 = await prisma.source.create({ data: {
    name: 'Philip Morris internal research memo on biological activity of smoke (1962)',
    publishedAt: new Date('1962-06-15'),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const src18 = await prisma.source.create({ data: {
    name: 'Liggett & Myers internal memo acknowledging cancer link (1963)',
    publishedAt: new Date('1963-04-15'),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  console.log('Sources: 18 created')

  // ── Step 4: Edges + EdgeRevisions ──────────────────────────────────────────

  // Child A — chemical carcinogens
  const eA1 = await edge(src3.id, childA.id, 'FOR', 'EVIDENTIARY', 80,
    'first experimental demonstration of carcinogenic activity of tobacco tar in mammals')

  // Child B — epidemiological correlation
  const eB1 = await edge(src1.id, childB.id, 'FOR', 'EVIDENTIARY', 75,
    'foundational case-control study establishing correlation')
  const eB2 = await edge(src2.id, childB.id, 'FOR', 'EVIDENTIARY', 75,
    'contemporaneous independent confirmation')
  const eB3 = await edge(src5.id, childB.id, 'FOR', 'EVIDENTIARY', 85,
    'large prospective cohort confirming case-control findings')
  await edge(src13.id, childB.id, 'AGAINST', 'ARGUMENTATIVE', 30,
    'industry PR positioning the cancer link as unsettled; later proven to be deliberately misleading')
  await edge(src14.id, childB.id, 'AGAINST', 'ARGUMENTATIVE', 25,
    'industry-funded research designed to produce contesting findings')

  // Child C — dose dependence
  await edge(src4.id, childC.id, 'FOR', 'EVIDENTIARY', 80,
    'dose-response relationship established in physician cohort')
  await edge(src6.id, childC.id, 'FOR', 'EVIDENTIARY', 85,
    'ten-year follow-up confirms dose-response')

  // Child D — cessation reverses risk
  await edge(src6.id, childD.id, 'FOR', 'EVIDENTIARY', 75,
    'ex-smokers showed declining risk over time')
  await edge(src7.id, childD.id, 'FOR', 'EVIDENTIARY', 80,
    'cessation finding stated as conclusion')

  // Child E — 1964 Surgeon General resolution
  const eE1 = await edge(src7.id, childE.id, 'FOR', 'PROCEDURAL', 90,
    'the institutional resolution itself')

  // Child F — industry knew internally
  const eF1 = await edge(src16.id, childF.id, 'FOR', 'EVIDENTIARY', 90,
    "internal memo explicitly states industry strategy of manufacturing doubt despite knowing the science")
  const eF4 = await edge(src8.id,  childF.id, 'FOR', 'PROCEDURAL',  85,
    'legal resolution that forced document release')
  const eF5 = await edge(src9.id,  childF.id, 'FOR', 'PROCEDURAL',  90,
    'federal court found tobacco companies engaged in 50-year fraud and racketeering scheme')
  await edge(src17.id, childF.id, 'FOR', 'EVIDENTIARY', 80,
    'Philip Morris internal research acknowledging biological activity of smoke (1962)')
  await edge(src18.id, childF.id, 'FOR', 'EVIDENTIARY', 75,
    'Liggett & Myers internal memo acknowledging cancer link (1963)')
  await edge(src10.id, childF.id, 'FOR', 'ARGUMENTATIVE', 80,
    'Brandt 2007 scholarly history of tobacco industry and cancer science')
  await edge(src11.id, childF.id, 'FOR', 'ARGUMENTATIVE', 80,
    'Proctor 2011 comprehensive analysis of tobacco industry deception')
  await edge(src12.id, childF.id, 'FOR', 'ARGUMENTATIVE', 75,
    'Oreskes & Conway on tobacco industry as model for doubt manufacturing')

  console.log('Edges: 19 created')

  // ── Step 5: ThresholdEvents ─────────────────────────────────────────────────

  // TE1 — Child E: 1964 Surgeon General (first institutional resolution)
  await prisma.thresholdEvent.create({ data: {
    claimId:            childE.id,
    triggeredBy:        "U.S. Surgeon General's Advisory Committee on Smoking and Health",
    triggeredBySourceId: src7.id,
    confirmedBy:        'manual',
    note:               "Surgeon General Luther Terry's advisory committee concluded smoking is a cause of lung cancer in men and a probable cause in women, based on accumulated epidemiological and experimental evidence. First major institutional resolution. The report explicitly stated the evidence was 'sufficient to warrant appropriate remedial action.'",
    evidenceSnapshot:   JSON.stringify({
      edges: [{ id: eE1.id, type: 'FOR', evidenceType: 'PROCEDURAL', score: 90,
        source: 'U.S. Surgeon General Luther Terry — Smoking and Health (1964)',
        note: 'the institutional resolution itself' }],
      atDate: '1964-01-11',
    }),
    createdAt: new Date('1964-01-11'),
    ...REVIEW,
  }})

  // TE2 — Child F: 1998 Master Settlement (document release)
  await prisma.thresholdEvent.create({ data: {
    claimId:            childF.id,
    triggeredBy:        'Master Settlement Agreement (1998) — forced public release of industry documents',
    triggeredBySourceId: src8.id,
    confirmedBy:        'manual',
    note:               'The Master Settlement Agreement between 46 state attorneys general and the major tobacco companies forced the public release of millions of internal industry documents (now archived at the UCSF Truth Tobacco Industry Documents library), revealing decades of internal acknowledgment of cancer causation while public statements maintained doubt.',
    evidenceSnapshot:   JSON.stringify({
      edges: [
        { id: eF4.id, type: 'FOR', evidenceType: 'PROCEDURAL',  score: 85,
          source: 'Master Settlement Agreement (1998)', note: 'legal resolution that forced document release' },
        { id: eF1.id, type: 'FOR', evidenceType: 'EVIDENTIARY', score: 90,
          source: "Brown & Williamson 'Doubt is Our Product' memo (1969)",
          note: 'internal memo explicitly states industry strategy of manufacturing doubt' },
      ],
      atDate: '1998-11-23',
    }),
    createdAt: new Date('1998-11-23'),
    ...REVIEW,
  }})

  // TE3 — Child F: 2006 RICO ruling
  await prisma.thresholdEvent.create({ data: {
    claimId:            childF.id,
    triggeredBy:        'U.S. v. Philip Morris USA — RICO ruling by Judge Gladys Kessler',
    triggeredBySourceId: src9.id,
    confirmedBy:        'manual',
    note:               "Judge Gladys Kessler ruled tobacco companies had engaged in a 50-year racketeering conspiracy to deceive the public about smoking's health effects, finding 'overwhelming evidence' that defendants 'knew that smoking caused diseases' while publicly denying it. 1,683-page ruling.",
    evidenceSnapshot:   JSON.stringify({
      edges: [
        { id: eF5.id, type: 'FOR', evidenceType: 'PROCEDURAL', score: 90,
          source: 'United States v. Philip Morris USA — RICO ruling (2006)',
          note: 'federal court found tobacco companies engaged in 50-year fraud and racketeering scheme' },
      ],
      atDate: '2006-08-17',
    }),
    createdAt: new Date('2006-08-17'),
    ...REVIEW,
  }})

  console.log('ThresholdEvents: 3 created')

  // ── Step 6: MetaEdges ───────────────────────────────────────────────────────

  // MetaEdge 1 — Frank Statement suppressed Doll & Hill 1950 → Child B
  await prisma.metaEdge.create({ data: {
    actorSourceId: src13.id,
    targetEdgeId:  eB1.id,
    claimId:       childB.id,
    type:          'SUPPRESSED',
    reason:        "The Frank Statement coordinated tobacco industry response positioning Doll & Hill's findings as one side of an unsettled scientific question, deliberately manufacturing public doubt about evidence the industry's own research staff acknowledged internally. Source: Brown & Williamson 'Doubt is Our Product' memo (1969) makes this strategy explicit: 'Doubt is our product since it is the best means of competing with the body of fact that exists in the mind of the general public.'",
    createdAt:     new Date('1954-01-04'),
    ...REVIEW,
  }})

  // MetaEdge 2 — TIRC suppressed Hammond & Horn 1958 → Child B
  await prisma.metaEdge.create({ data: {
    actorSourceId: src14.id,
    targetEdgeId:  eB3.id,
    claimId:       childB.id,
    type:          'SUPPRESSED',
    reason:        "TIRC funded research designed to contest the prospective cohort findings, providing industry spokesmen with citations to argue the science was unsettled. Internal industry documents subsequently revealed TIRC's research agenda was designed to produce doubt rather than discover truth (per RICO ruling and Master Settlement document releases).",
    createdAt:     new Date('1958-04-01'),
    ...REVIEW,
  }})

  // MetaEdge 3 — TIRC suppressed Surgeon General 1964 → Child E
  await prisma.metaEdge.create({ data: {
    actorSourceId: src14.id,
    targetEdgeId:  eE1.id,
    claimId:       childE.id,
    type:          'SUPPRESSED',
    reason:        "Industry response to the Surgeon General's report continued the strategy of contesting individual findings rather than the conclusion. TIRC and successor organizations funded researchers willing to publicly contest the report through the 1990s.",
    createdAt:     new Date('1964-01-12'),
    ...REVIEW,
  }})

  console.log('MetaEdges: 3 created')

  console.log('\n=== Seed complete ===')
  console.log('  1 parent claim')
  console.log('  6 child claims  (A–F)')
  console.log('  18 sources      (7 primary research, 2 procedural, 3 scholarly synthesis, 3 industry counter, 3 internal documents)')
  console.log('  19 edges        (with EdgeRevision per edge)')
  console.log('  3 threshold events  (1964 Surgeon General, 1998 MSA, 2006 RICO)')
  console.log('  3 meta-edges    (SUPPRESSED)')

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
