// Seed: Curated case studies — Lab Leak, Ozempic, Pluto, Japan Surrender, Korematsu
// Reconstructed from SQLite backup (prisma/dev.db.backup-20260503).
// Does NOT include tobacco/smoking (covered by seed-smoking-cancer.ts).
// Run: npx tsx scripts/seed-case-studies.ts

import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/client'

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

// CITES edges get a two-step revision: original score → 60 (uniform for citations)
async function citesEdge(
  sourceId: string,
  claimId: string,
  initialScore: number,
  initialReason: string,
) {
  const e = await prisma.edge.create({
    data: { sourceId, claimId, type: 'CITES', evidenceType: 'EVIDENTIARY', ...REVIEW },
  })
  await prisma.edgeRevision.create({
    data: { edgeId: e.id, priorScore: null, newScore: initialScore, reason: initialReason },
  })
  await prisma.edgeRevision.create({
    data: { edgeId: e.id, priorScore: initialScore, newScore: 60,
      reason: 'CITES edges are reference citations, not positional arguments — uniform score 60' },
  })
  return e
}

async function topic(slug: string) {
  const t = await prisma.topic.findUniqueOrThrow({ where: { slug } })
  return t.id
}

async function tagClaim(claimId: string, ...slugs: string[]) {
  for (const slug of slugs) {
    const topicId = await topic(slug)
    await prisma.claimTopic.create({ data: { claimId, topicId } })
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function seedLabLeak() {
  console.log('\n── Lab Leak (SARS-CoV-2 Origin) ──')

  const parent = await prisma.claim.create({ data: {
    text:                  'SARS-CoV-2 originated from a laboratory rather than a natural zoonotic spillover',
    claimType:             'EMPIRICAL',
    claimEmergedAt:        new Date(1580515200000),
    claimEmergedPrecision: 'MONTH',
    currentStatus:         'DISPUTED',
    ...REVIEW,
  }})

  const child = await prisma.claim.create({ data: {
    text:                  'SARS-CoV-2 originated specifically from the Wuhan Institute of Virology, via a research-related incident',
    claimType:             'EMPIRICAL',
    currentStatus:         'DISPUTED',
    parentClaimId:         parent.id,
    ...REVIEW,
  }})

  const lancet = await prisma.source.create({ data: {
    name:            'Lancet Statement — Calisher et al. (Feb 2020)',
    url:             'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(20)30418-9/fulltext',
    publishedAt:     new Date(1582070400000),
    methodologyType: 'opinion',
    ...REVIEW,
  }})

  const proximalOrigin = await prisma.source.create({ data: {
    name:            'Proximal Origin — Andersen et al., Nature Medicine (Mar 2020)',
    url:             'https://www.nature.com/articles/s41591-020-0820-9',
    publishedAt:     new Date(1584403200000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const andersenSlack = await prisma.source.create({ data: {
    name:            'Andersen et al. Slack messages (written Feb 2020, released 2023)',
    publishedAt:     new Date(1580515200000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const doeFbi = await prisma.source.create({ data: {
    name:            'DOE and FBI assessments — low/moderate confidence lab origin (2023)',
    publishedAt:     new Date(1677542400000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  await edge(lancet.id,         parent.id, 'AGAINST', 'EVIDENTIARY', 70,
    'High institutional authority at time of publication; 27 signatories including Daszak — conflicts not yet public')
  await edge(proximalOrigin.id, parent.id, 'AGAINST', 'EVIDENTIARY', 75,
    'Peer-reviewed primary genomic analysis; most-cited AGAINST source in 2020')
  await edge(andersenSlack.id,  parent.id, 'FOR',     'EVIDENTIARY', 65,
    'Private communications show authors considered lab origin credible while publicly arguing against — contradiction is the signal')
  await edge(doeFbi.id,         parent.id, 'FOR',     'EVIDENTIARY', 65,
    'Government intelligence assessments; low/moderate confidence stated — different authority type than scientific literature')

  await tagClaim(parent.id, 'pandemic-origins')
  await tagClaim(child.id,  'pandemic-origins')

  console.log(`  parent=${parent.id} child=${child.id} sources=4 edges=4`)
}

async function seedOzempic() {
  console.log('\n── Ozempic (Semaglutide FDA Approval) ──')

  const claim = await prisma.claim.create({ data: {
    text:                  'Semaglutide demonstrated sufficient efficacy and safety in submitted clinical trials to meet FDA approval standards for Type 2 diabetes treatment.',
    claimType:             'EMPIRICAL',
    claimEmergedAt:        new Date(1325376000000),
    claimEmergedPrecision: 'YEAR',
    currentStatus:         'HARD_FACT',
    ...REVIEW,
  }})

  const sustain1 = await prisma.source.create({ data: {
    name:            'SUSTAIN-1 — Sorli et al., Lancet Diabetes & Endocrinology (2017)',
    publishedAt:     new Date(1491004800000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const sustain6 = await prisma.source.create({ data: {
    name:            'SUSTAIN-6 cardiovascular outcomes — Marso et al., NEJM (2016)',
    publishedAt:     new Date(1473897600000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const fdaLetter = await prisma.source.create({ data: {
    name:            'FDA approval letter — Ozempic (semaglutide), NDA 209637',
    url:             'https://www.accessdata.fda.gov/drugsatfda_docs/appletter/2017/209637Orig1s000ltr.pdf',
    publishedAt:     new Date(1512432000000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const fdaAdvisory = await prisma.source.create({ data: {
    name:            'FDA advisory committee briefing document — semaglutide NDA 209637',
    publishedAt:     new Date(1506816000000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const e1 = await edge(sustain1.id,    claim.id, 'FOR', 'EVIDENTIARY', 75,
    'Pivotal Phase 3 efficacy trial — primary evidence submitted for NDA')
  const e2 = await edge(sustain6.id,    claim.id, 'FOR', 'EVIDENTIARY', 70,
    'Required cardiovascular safety outcomes data — established non-inferiority')
  const e3 = await edge(fdaLetter.id,   claim.id, 'FOR', 'EVIDENTIARY', 85,
    'The institutional resolution itself — FDA determined submitted evidence met approval threshold')
  const e4 = await edge(fdaAdvisory.id, claim.id, 'FOR', 'EVIDENTIARY', 75,
    'Advisory committee reasoning underlying the approval — auditable rationale')

  await prisma.thresholdEvent.create({ data: {
    claimId:             claim.id,
    triggeredBy:         'FDA NDA 209637 approval',
    triggeredBySourceId: fdaLetter.id,
    confirmedBy:         'manual',
    note:                'FDA approved Ozempic (semaglutide) for adult Type 2 diabetes on 2017-12-05 based on SUSTAIN program data. NDA 209637.',
    evidenceSnapshot:    JSON.stringify({ edges: [
      { id: e1.id, score: 75 },
      { id: e2.id, score: 70 },
      { id: e3.id, score: 85 },
      { id: e4.id, score: 75 },
    ]}),
    createdAt: new Date(1512432000000),
    ...REVIEW,
  }})

  await tagClaim(claim.id, 'drug-approval', 'diabetes-treatment')

  console.log(`  claim=${claim.id} sources=4 edges=4 thresholdEvents=1`)
}

async function seedPluto() {
  console.log('\n── Pluto (Planetary Classification) ──')

  const claim = await prisma.claim.create({ data: {
    text:                  'Pluto is a planet',
    claimType:             'INTERPRETIVE',
    claimEmergedAt:        new Date(-1258156800000),
    claimEmergedPrecision: 'DAY',
    currentStatus:         'NEVER_RESOLVES',
    ...REVIEW,
  }})

  const iau = await prisma.source.create({ data: {
    name:            'IAU Resolution B5 (2006)',
    url:             'https://www.iau.org/news/pressreleases/detail/iau0603/',
    publishedAt:     new Date(1156377600000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const stern = await prisma.source.create({ data: {
    name:            'Alan Stern — Geophysical Planet Definition (2018)',
    publishedAt:     new Date(1536278400000),
    methodologyType: 'opinion',
    ...REVIEW,
  }})

  await edge(iau.id,   claim.id, 'AGAINST', 'ARGUMENTATIVE', 72,
    'IAU 2006 definition requires orbital dominance; Pluto shares its zone with Kuiper Belt objects')
  await edge(stern.id, claim.id, 'FOR',     'ARGUMENTATIVE', 58,
    'Geophysical definition: any round body in hydrostatic equilibrium qualifies; 150+ objects in our solar system would be planets')

  await tagClaim(claim.id, 'planetary-classification')

  console.log(`  claim=${claim.id} sources=2 edges=2`)
}

async function seedJapanSurrender() {
  console.log('\n── Japan Surrender (August 1945) ──')

  const parent = await prisma.claim.create({ data: {
    text:                  'Japanese surrender in August 1945 was caused primarily by external pressure, but the dominant cause is contested',
    claimType:             'HYBRID',
    claimEmergedAt:        new Date(-769392000000),
    claimEmergedPrecision: 'DAY',
    currentStatus:         'DISPUTED',
    ...REVIEW,
  }})

  const childA = await prisma.claim.create({ data: {
    text:                  'The atomic bombings of Hiroshima and Nagasaki were the primary cause of Japanese surrender',
    claimType:             'INTERPRETIVE',
    claimEmergedAt:        new Date(-769392000000),
    claimEmergedPrecision: 'DAY',
    currentStatus:         'DISPUTED',
    parentClaimId:         parent.id,
    ...REVIEW,
  }})

  const childB = await prisma.claim.create({ data: {
    text:                  'Soviet entry into the war on August 8, 1945 was the primary cause of Japanese surrender',
    claimType:             'INTERPRETIVE',
    claimEmergedAt:        new Date(-769392000000),
    claimEmergedPrecision: 'DAY',
    currentStatus:         'DISPUTED',
    parentClaimId:         parent.id,
    ...REVIEW,
  }})

  const childC = await prisma.claim.create({ data: {
    text:                  'Atomic bombings and Soviet entry were jointly necessary; neither alone would have produced surrender',
    claimType:             'INTERPRETIVE',
    claimEmergedAt:        new Date(-769392000000),
    claimEmergedPrecision: 'DAY',
    currentStatus:         'DISPUTED',
    parentClaimId:         parent.id,
    ...REVIEW,
  }})

  const childD = await prisma.claim.create({ data: {
    text:                  "Internal regime dynamics and the Emperor's intervention were the primary cause; external pressure was secondary",
    claimType:             'INTERPRETIVE',
    claimEmergedAt:        new Date(-769392000000),
    claimEmergedPrecision: 'DAY',
    currentStatus:         'DISPUTED',
    parentClaimId:         parent.id,
    ...REVIEW,
  }})

  const frank = await prisma.source.create({ data: {
    name:            'Frank — Downfall: The End of the Imperial Japanese Empire (1999)',
    publishedAt:     new Date(922924800000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const hasegawa = await prisma.source.create({ data: {
    name:            'Hasegawa — Racing the Enemy: Stalin, Truman, and the Surrender of Japan (2005)',
    publishedAt:     new Date(1112313600000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const asada = await prisma.source.create({ data: {
    name:            'Asada — The Shock of the Atomic Bomb and Japan\'s Decision to Surrender (1998)',
    publishedAt:     new Date(909878400000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const bernstein = await prisma.source.create({ data: {
    name:            'Bernstein — Understanding the Atomic Bomb and the Japanese Surrender (1995)',
    publishedAt:     new Date(796694400000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const pape = await prisma.source.create({ data: {
    name:            'Pape — Why Japan Surrendered (1993)',
    publishedAt:     new Date(746841600000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const imperialConf = await prisma.source.create({ data: {
    name:            'Imperial Conference minutes — August 9-10, 1945',
    publishedAt:     new Date(-769824000000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const hirohito = await prisma.source.create({ data: {
    name:            "Hirohito's surrender broadcast (Gyokuon-hōsō) text",
    publishedAt:     new Date(-769392000000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const togo = await prisma.source.create({ data: {
    name:            'Togo-Sato diplomatic cables (Moscow channel), July-August 1945',
    publishedAt:     new Date(-772329600000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const sovietArchives = await prisma.source.create({ data: {
    name:            'Soviet archive releases on August 1945 invasion planning (declassified 1990s)',
    publishedAt:     new Date(694224000000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  // Argumentative edges
  await edge(frank.id,    childA.id, 'FOR', 'ARGUMENTATIVE', 70,
    "Frank's operational history argues atomic shock was the decisive break; Soviet entry was secondary")
  await edge(asada.id,    childA.id, 'FOR', 'ARGUMENTATIVE', 65,
    'Asada emphasises the psychological shock of atomic bombing on the military leadership')
  await edge(hasegawa.id, childB.id, 'FOR', 'ARGUMENTATIVE', 75,
    "Hasegawa's Racing the Enemy: Soviet entry shattered the last diplomatic hope and triggered the surrender decision")
  await edge(pape.id,     childB.id, 'FOR', 'ARGUMENTATIVE', 65,
    "Pape's strategic bombing analysis: conventional blockade + Soviet entry, not atomic bombs, drove capitulation")
  await edge(bernstein.id, childC.id, 'FOR', 'ARGUMENTATIVE', 60,
    "Bernstein's synthesis position: both shocks were jointly necessary; historians overstate single-cause explanations")

  // CITES edges — primary documents cited by all frames
  await citesEdge(imperialConf.id, childA.id, 80,
    'Primary record of the imperial conference where surrender was decided — all frames cite this')
  await citesEdge(imperialConf.id, childB.id, 80,
    'Minutes show Soviet entry was discussed alongside atomic bombs — key for the Soviet-primary frame')
  await citesEdge(imperialConf.id, childC.id, 80,
    'Both pressures appear in the record; supports the joint-necessity interpretation')
  await citesEdge(imperialConf.id, childD.id, 80,
    "Shows Hirohito's personal intervention — directly supports the internal-dynamics frame")

  await citesEdge(hirohito.id, childA.id, 70,
    "Broadcast mentions 'cruel bombs' — cited by atomic-primary historians")
  await citesEdge(hirohito.id, childB.id, 65,
    'Broadcast is silent on Soviet entry, which Hasegawa reads as court politics, not causal omission')
  await citesEdge(hirohito.id, childC.id, 70,
    'Neither cause is foregrounded exclusively — consistent with joint-necessity reading')
  await citesEdge(hirohito.id, childD.id, 75,
    "The Emperor's direct address was itself the decisive act — supports regime-dynamics frame")

  await citesEdge(togo.id, childA.id, 55,
    'Cables show diplomatic hope predated atomic bombs; their failure is background to atomic-shock thesis')
  await citesEdge(togo.id, childB.id, 85,
    'Key evidence for Soviet-primary: cables reveal Japan was banking on Soviet mediation; Soviet entry destroyed this plan')
  await citesEdge(togo.id, childC.id, 70,
    'Cables show pre-existing diplomatic desperation; Soviet entry ended it — supports joint pressure reading')
  await citesEdge(togo.id, childD.id, 60,
    "Togo's channel shows factional leadership dynamics; relevant to the internal-politics frame")

  await citesEdge(sovietArchives.id, childA.id, 45,
    'Soviet invasion planning shows Stalin\'s intent regardless of bombs; weakens atomic-primary monocause')
  await citesEdge(sovietArchives.id, childB.id, 90,
    "Hasegawa's primary source base; declassified planning docs show the scale and speed of Soviet operation")
  await citesEdge(sovietArchives.id, childC.id, 75,
    'Soviet operational capacity documented — confirms the pressure was credible and decisive alongside bombs')
  await citesEdge(sovietArchives.id, childD.id, 50,
    'Soviet archives provide context on external pressure, secondary to the internal-dynamics argument')

  await tagClaim(childA.id, 'world-war-ii', 'pacific-theater', 'atomic-bombings')
  await tagClaim(childC.id, 'world-war-ii', 'pacific-theater', 'atomic-bombings')

  console.log(`  parent=${parent.id} children=4 sources=9 edges=21`)
}

async function seedKorematsu() {
  console.log('\n── Korematsu v. United States ──')

  const parent = await prisma.claim.create({ data: {
    text:                  "The U.S. Supreme Court's 1944 ruling in Korematsu v. United States, which upheld the constitutionality of Japanese-American internment, was institutionally maintained for decades despite documented evidentiary suppression at the time of the ruling",
    claimType:             'HYBRID',
    claimEmergedAt:        new Date(-790128000000),
    claimEmergedPrecision: 'DAY',
    currentStatus:         'DISPUTED',
    ...REVIEW,
  }})

  const childA = await prisma.claim.create({ data: {
    text:                  'Korematsu v. United States (1944) held the wartime exclusion of Japanese-Americans constitutional',
    claimType:             'INSTITUTIONAL',
    claimEmergedAt:        new Date(-790128000000),
    claimEmergedPrecision: 'DAY',
    currentStatus:         'HARD_FACT',
    parentClaimId:         parent.id,
    ...REVIEW,
  }})

  const childB = await prisma.claim.create({ data: {
    text:                  "Fred Korematsu's conviction was vacated via writ of coram nobis in 1983 after revealed evidentiary suppression",
    claimType:             'INSTITUTIONAL',
    claimEmergedAt:        new Date(437270400000),
    claimEmergedPrecision: 'DAY',
    currentStatus:         'HARD_FACT',
    parentClaimId:         parent.id,
    ...REVIEW,
  }})

  const childC = await prisma.claim.create({ data: {
    text:                  'The Civil Liberties Act of 1988 formally acknowledged the internment as wrong and provided reparations',
    claimType:             'INSTITUTIONAL',
    claimEmergedAt:        new Date(587174400000),
    claimEmergedPrecision: 'DAY',
    currentStatus:         'HARD_FACT',
    parentClaimId:         parent.id,
    ...REVIEW,
  }})

  const childD = await prisma.claim.create({ data: {
    text:                  "Chief Justice Roberts in Trump v. Hawaii (2018) declared Korematsu 'gravely wrong the day it was decided' in dicta, effectively overruling without a direct case",
    claimType:             'INSTITUTIONAL',
    claimEmergedAt:        new Date(1529971200000),
    claimEmergedPrecision: 'DAY',
    currentStatus:         'HARD_FACT',
    parentClaimId:         parent.id,
    ...REVIEW,
  }})

  // Sources
  const murphyDissent = await prisma.source.create({ data: {
    name:            'Murphy dissent in Korematsu (1944)',
    publishedAt:     new Date(-790128000000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const majority = await prisma.source.create({ data: {
    name:            'Korematsu v. United States, 323 U.S. 214 (1944) — majority opinion (Black, J.)',
    url:             'https://supreme.justia.com/cases/federal/us/323/214/',
    publishedAt:     new Date(-790128000000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const hooversReport = await prisma.source.create({ data: {
    name:            'FBI report by J. Edgar Hoover (1942) — concluded Japanese-American mass evacuation unjustified',
    publishedAt:     new Date(-880934400000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const jacksonDissent = await prisma.source.create({ data: {
    name:            'Jackson dissent in Korematsu (1944)',
    publishedAt:     new Date(-790128000000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const ringleReport = await prisma.source.create({ data: {
    name:            'The Ringle Report — Office of Naval Intelligence assessment (1942)',
    publishedAt:     new Date(-881452800000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const coramNobis1983 = await prisma.source.create({ data: {
    name:            'Korematsu v. United States, 584 F.Supp. 1406 (N.D. Cal. 1983) — coram nobis ruling',
    publishedAt:     new Date(437270400000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const fahyBrief = await prisma.source.create({ data: {
    name:            "Solicitor General Charles Fahy's brief in Korematsu (1944)",
    publishedAt:     new Date(-796867200000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const civilLibertiesAct = await prisma.source.create({ data: {
    name:            'Civil Liberties Act of 1988, Public Law 100-383',
    url:             'https://www.congress.gov/bill/100th-congress/house-bill/442',
    publishedAt:     new Date(587174400000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const trumpVHawaii = await prisma.source.create({ data: {
    name:            'Trump v. Hawaii, 585 U.S. ___ (2018) — Roberts opinion',
    url:             'https://supreme.justia.com/cases/federal/us/585/17-965/',
    publishedAt:     new Date(1529971200000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const katalyConfession = await prisma.source.create({ data: {
    name:            "Acting Solicitor General Neal Katyal — official 'confession of error' (May 24, 2011)",
    url:             'https://www.justice.gov/archives/opa/blog/confession-error-solicitor-generals-mistakes-during-japanese-american-internment-cases',
    publishedAt:     new Date(1306195200000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const personalJusticeDenied = await prisma.source.create({ data: {
    name:            'Commission on Wartime Relocation and Internment of Civilians — Personal Justice Denied (1982/1983)',
    publishedAt:     new Date(414892800000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const peterIrons = await prisma.source.create({ data: {
    name:            'Peter Irons — Justice at War: The Story of the Japanese American Internment Cases (1983)',
    publishedAt:     new Date(410227200000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const gressman = await prisma.source.create({ data: {
    name:            'Eugene Gressman — The Japanese-American Cases: A Constitutional Tragedy (1945)',
    publishedAt:     new Date(-775872000000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  const jamalGreene = await prisma.source.create({ data: {
    name:            'Jamal Greene — Is Korematsu Good Law? (Yale Law Journal, 2011)',
    publishedAt:     new Date(1301616000000),
    methodologyType: 'primary',
    ...REVIEW,
  }})

  // Edges
  const eMurphy  = await edge(murphyDissent.id,  childA.id, 'AGAINST', 'EVIDENTIARY', 70, 'Contemporaneous judicial dissent')
  const eJackson = await edge(jacksonDissent.id, childA.id, 'AGAINST', 'EVIDENTIARY', 70, 'Contemporaneous judicial dissent')
  const eMajority = await edge(majority.id,      childA.id, 'FOR',     'EVIDENTIARY', 85, 'The institutional resolution itself — the ruling was issued and binding')

  await citesEdge(ringleReport.id, childB.id, 60, 'Cited as the suppressed evidence basis for vacatur')
  await edge(peterIrons.id,            childB.id, 'FOR', 'ARGUMENTATIVE', 75, "Irons's archival work made the coram nobis case possible")
  const eCoram = await edge(coramNobis1983.id, childB.id, 'FOR', 'EVIDENTIARY', 85, '')

  const ePersonalJustice = await edge(personalJusticeDenied.id, childC.id, 'FOR', 'EVIDENTIARY',  80, 'The Congressional finding underlying the Act')
  const eCLA             = await edge(civilLibertiesAct.id,     childC.id, 'FOR', 'PROCEDURAL',   90, 'The institutional resolution itself')

  const eTrump   = await edge(trumpVHawaii.id, childD.id, 'FOR', 'PROCEDURAL',   85, '')
  await edge(jamalGreene.id, childD.id, 'FOR', 'ARGUMENTATIVE', 65, 'Anticipated the formal overruling')

  // ThresholdEvents
  await prisma.thresholdEvent.create({ data: {
    claimId:             childA.id,
    triggeredBy:         'Supreme Court ruling (6-3 majority)',
    triggeredBySourceId: majority.id,
    confirmedBy:         'manual',
    note:                'Korematsu v. United States decided 6-3 upholding the wartime exclusion as constitutional. Three dissents (Murphy, Jackson, Roberts).',
    evidenceSnapshot:    JSON.stringify({ edges: [
      { id: eMajority.id, score: 85 },
      { id: eMurphy.id,   score: 70 },
      { id: eJackson.id,  score: 70 },
    ]}),
    createdAt: new Date(-790128000000),
    ...REVIEW,
  }})

  await prisma.thresholdEvent.create({ data: {
    claimId:             childB.id,
    triggeredBy:         'Federal District Court coram nobis writ',
    triggeredBySourceId: coramNobis1983.id,
    confirmedBy:         'manual',
    note:                "Judge Marilyn Hall Patel granted writ of coram nobis vacating Fred Korematsu's conviction based on revealed government suppression of Ringle Report and FBI findings during the original case.",
    evidenceSnapshot:    JSON.stringify({ edges: [
      { id: eCoram.id, score: 85 },
    ]}),
    createdAt: new Date(437270400000),
    ...REVIEW,
  }})

  await prisma.thresholdEvent.create({ data: {
    claimId:             childC.id,
    triggeredBy:         'Public Law 100-383 signed into law',
    triggeredBySourceId: civilLibertiesAct.id,
    confirmedBy:         'manual',
    note:                'President Reagan signed the Civil Liberties Act of 1988, formally acknowledging internment as wrong, providing $20,000 to each surviving internee, and establishing a public education fund.',
    evidenceSnapshot:    JSON.stringify({ edges: [
      { id: eCLA.id,             score: 90 },
      { id: ePersonalJustice.id, score: 80 },
    ]}),
    createdAt: new Date(587174400000),
    ...REVIEW,
  }})

  await prisma.thresholdEvent.create({ data: {
    claimId:             childD.id,
    triggeredBy:         'Supreme Court majority opinion (Roberts) in Trump v. Hawaii',
    triggeredBySourceId: trumpVHawaii.id,
    confirmedBy:         'manual',
    note:                "Chief Justice Roberts: 'Korematsu was gravely wrong the day it was decided, has been overruled in the court of history, and—to be clear—has no place in law under the Constitution.' Stated in dicta within Trump v. Hawaii (travel ban case); not a direct overruling via case on the original facts.",
    evidenceSnapshot:    JSON.stringify({ edges: [
      { id: eTrump.id, score: 85 },
    ]}),
    createdAt: new Date(1529971200000),
    ...REVIEW,
  }})

  // MetaEdge — Fahy brief suppressed the majority-opinion edge on childA
  await prisma.metaEdge.create({ data: {
    actorSourceId: fahyBrief.id,
    targetEdgeId:  eMajority.id,
    claimId:       childA.id,
    type:          'SUPPRESSED',
    reason:        "Solicitor General Charles Fahy filed a brief that omitted the Ringle Report (Source 4) and Hoover's FBI assessment (Source 5), both of which concluded the security justification for mass exclusion was unfounded. The Court ruled without seeing this evidence. Documented in Personal Justice Denied (1983) and acknowledged formally by Acting Solicitor General Neal Katyal's 2011 'confession of error'.",
    createdAt:     new Date(-790128000000),
    ...REVIEW,
  }})

  await tagClaim(parent.id, 'equal-protection', 'wartime-powers', 'judicial-review')
  await tagClaim(childA.id, 'equal-protection', 'wartime-powers', 'judicial-review')
  await tagClaim(childB.id, 'equal-protection', 'wartime-powers', 'judicial-review')
  await tagClaim(childD.id, 'equal-protection', 'wartime-powers', 'judicial-review')

  // Note: katalyConfession, hooversReport, and gressman created but not yet wired to edges —
  // they existed in the original DB as sources attached to this case study.
  void katalyConfession; void hooversReport; void gressman

  console.log(`  parent=${parent.id} children=4 sources=14 edges=10 thresholdEvents=4 metaEdges=1`)
}

// ─── ENTRY POINT ────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Case Studies Seed ===')
  console.log('(Lab Leak · Ozempic · Pluto · Japan Surrender · Korematsu)\n')

  await seedLabLeak()
  await seedOzempic()
  await seedPluto()
  await seedJapanSurrender()
  await seedKorematsu()

  console.log('\n=== Seed complete ===')
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
