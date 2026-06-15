// Seed: historical epistemic trajectories — political, institutional, social events.
//
// Complements seed-trajectories.ts (which focuses on science).
// These trajectories illustrate instantaneous announcement events, slow political
// consensus, reversals, and the "fact created live on TV" pattern (Schabowski effect).
//
// Idempotent: upserts on externalId.
//
// Run:     npx tsx scripts/seed-historical-trajectories.ts
// Dry-run: npx tsx scripts/seed-historical-trajectories.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

type FactStatus = 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

interface Trajectory {
  externalId: string
  text: string
  claimType: 'EMPIRICAL' | 'INSTITUTIONAL' | 'INTERPRETIVE' | 'HYBRID'
  claimEmergedAt: string
  claimEmergedPrecision: DatePrecision
  currentAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE'
  transitions: Transition[]
}

const TRAJECTORIES: Trajectory[] = [

  // ── 1. Berlin Wall opens (Schabowski Effect) ────────────────────────────────
  // The canonical "fact created live on TV" — a bureaucratic error became reality
  // in real-time. Fastest possible settling curve: null → SETTLED in ~3 hours.
  {
    externalId: 'trajectory:berlin-wall-fall-1989',
    text: 'East Germany opened the Berlin Wall, permitting free passage for all citizens, effective immediately.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1989-11-09',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'PUBLIC',
        occurredAt: '1989-11-09',
        datePrecision: 'DAY',
        reason: 'Günter Schabowski, East German party spokesman, reads a note at a live press conference announcing free travel, and when asked "when does this take effect?" replies: "Immediately, without delay." The announcement — a bureaucratic accident — is broadcast live on East and West German television, creating the fact in the act of announcing it.',
        source: {
          externalId: 'src:schabowski-pressconf-1989',
          name: 'Schabowski press conference, East Berlin, November 9, 1989 (live broadcast recording)',
          url: 'https://www.youtube.com/watch?v=xnqBTVfTZf4',
          publishedAt: '1989-11-09',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'PUBLIC',
        occurredAt: '1989-11-09',
        datePrecision: 'DAY',
        reason: 'Within hours of the broadcast, crowds gather at Berlin Wall checkpoints. Guards, with no orders to stop them and watching the same news broadcast, stand aside. Thousands cross freely. The physical breach of the wall that night settles the claim beyond any institutional reversal.',
        source: {
          externalId: 'src:berlin-wall-crowds-1989',
          name: 'Associated Press wire reports, November 9–10, 1989: crowds at Bornholmer Strasse checkpoint',
          url: 'https://apnews.com/article/berlin-wall-anniversary-fall-1989-7fad4de3e2ea30a5e78eb7cc96c90e84',
          publishedAt: '1989-11-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1990-10-03',
        datePrecision: 'DAY',
        reason: 'German reunification (Deutsche Einheit) formally incorporates East Germany into the Federal Republic, providing the institutional ratification of what public reality had already settled eleven months earlier.',
        source: {
          externalId: 'src:german-reunification-1990',
          name: 'Treaty on the Final Settlement with Respect to Germany (Two Plus Four Treaty), September 12, 1990',
          url: 'https://2009-2017.state.gov/p/eur/rls/or/129676.htm',
          publishedAt: '1990-09-12',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 2. HIV causes AIDS ───────────────────────────────────────────────────────
  {
    externalId: 'trajectory:hiv-causes-aids',
    text: 'Human immunodeficiency virus (HIV) is the cause of acquired immune deficiency syndrome (AIDS).',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1981-06-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'OPEN',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1981-06-05',
        datePrecision: 'DAY',
        reason: 'CDC Morbidity and Mortality Weekly Report describes five cases of Pneumocystis pneumonia in young gay men in Los Angeles — the first published report of what will become known as AIDS. Cause unknown.',
        source: {
          externalId: 'src:cdc-mmwr-1981-aids',
          name: 'CDC MMWR: Pneumocystis Pneumonia — Los Angeles, June 5, 1981',
          url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/june_5.htm',
          publishedAt: '1981-06-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'OPEN',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1984-04-23',
        datePrecision: 'DAY',
        reason: 'Robert Gallo (NCI) and Luc Montagnier (Pasteur Institute) independently identify HTLV-III/LAV as the likely cause. U.S. Health Secretary Margaret Heckler announces the discovery. Priority dispute between labs and early evidence contested.',
        source: {
          externalId: 'src:gallo-hiv-science-1984',
          name: 'Gallo RC et al. Isolation of human T-lymphotropic retrovirus from a patient at risk for acquired immune deficiency syndrome. Science 1984;224(4648):500-503.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6200936',
          publishedAt: '1984-04-23',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1986-05-01',
        datePrecision: 'MONTH',
        reason: 'International Committee on Taxonomy of Viruses adopts unified name "HIV." Subsequent Koch\'s postulate-satisfying studies, seroconversion evidence, and successful antiretroviral drug development converge to settle causality.',
        source: {
          externalId: 'src:ictv-hiv-name-1986',
          name: 'Coffin J et al. Human immunodeficiency viruses. Science 1986;232(4751):697.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/3008335',
          publishedAt: '1986-05-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 3. Human-caused climate change ──────────────────────────────────────────
  {
    externalId: 'trajectory:human-caused-climate-change',
    text: 'Human greenhouse gas emissions are the dominant cause of observed global warming since the mid-20th century.',
    claimType: 'HYBRID',
    claimEmergedAt: '1988-06-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'OPEN',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1896-01-01',
        datePrecision: 'YEAR',
        reason: 'Svante Arrhenius calculates that doubling atmospheric CO₂ would raise global temperatures ~5–6°C, establishing the theoretical basis, but framed as a long-horizon hypothesis.',
        source: {
          externalId: 'src:arrhenius-co2-1896',
          name: 'Arrhenius S. On the influence of carbonic acid in the air upon the temperature of the ground. Philosophical Magazine 1896;41:237-276.',
          url: 'https://www.rsc.org/images/Arrhenius1896_tcm18-173546.pdf',
          publishedAt: '1896-04-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'OPEN',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1988-06-23',
        datePrecision: 'DAY',
        reason: 'James Hansen testifies before the U.S. Senate that global warming has already begun and is causally linked to human CO₂ emissions. Marks the transition from theoretical possibility to active scientific and public debate.',
        source: {
          externalId: 'src:hansen-senate-1988',
          name: 'Hansen J. Testimony before the U.S. Senate Committee on Energy and Natural Resources, June 23, 1988.',
          url: 'https://climate.nasa.gov/news/2680/james-hansens-climate-warning-30-years-later/',
          publishedAt: '1988-06-23',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2013-09-27',
        datePrecision: 'DAY',
        reason: 'IPCC Fifth Assessment Report (AR5) states with ≥95% confidence that human influence has been the dominant cause of observed warming since 1950. Multiple independent lines of evidence converge; institutional consensus of 195 governments.',
        source: {
          externalId: 'src:ipcc-ar5-2013',
          name: 'IPCC Fifth Assessment Report: Climate Change 2013 — The Physical Science Basis. Summary for Policymakers.',
          url: 'https://www.ipcc.ch/report/ar5/wg1/',
          publishedAt: '2013-09-27',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 4. Apollo 11 Moon landing ────────────────────────────────────────────────
  {
    externalId: 'trajectory:apollo11-moon-landing',
    text: 'Humans first set foot on the Moon on July 20, 1969, when Apollo 11 astronauts Neil Armstrong and Buzz Aldrin landed in the Sea of Tranquility.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1969-07-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'PUBLIC',
        occurredAt: '1969-07-20',
        datePrecision: 'DAY',
        reason: 'Apollo 11 lands at 20:17 UTC. Neil Armstrong steps onto the lunar surface at 02:56 UTC July 21. Live television broadcast watched by approximately 600 million people worldwide. NASA Mission Control confirmation and Armstrong\'s "one small step" transmission create immediate global RECORDED status.',
        source: {
          externalId: 'src:apollo11-landing-nasa-1969',
          name: 'NASA Mission Control audio transcript and live CBS broadcast, July 20–21, 1969',
          url: 'https://www.nasa.gov/mission_pages/apollo/apollo11.html',
          publishedAt: '1969-07-20',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1969-07-24',
        datePrecision: 'DAY',
        reason: 'Apollo 11 crew returns to Earth with 21.5 kg of lunar samples. Subsequent independent analysis by scientists in the US, USSR, and other nations — including adversaries with every incentive to expose a hoax — confirms lunar origin of samples. Soviet lunar tracking stations independently tracked the mission.',
        source: {
          externalId: 'src:apollo11-splashdown-1969',
          name: 'NASA Apollo 11 Mission Report (1971) — including lunar sample analysis and independent international verification',
          url: 'https://www.hq.nasa.gov/alsj/a11/A11_MissionReport.pdf',
          publishedAt: '1969-07-24',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'PUBLIC',
        occurredAt: '1976-01-01',
        datePrecision: 'YEAR',
        reason: 'Bill Kaysing\'s self-published "We Never Went to the Moon" (1976) launches a persistent conspiracy theory. CONTESTED here reflects durable public skepticism (~6% of Americans per polling), not scientific dispute — the expert community remains entirely settled.',
        source: {
          externalId: 'src:kaysing-moon-hoax-1976',
          name: 'Kaysing B. We Never Went to the Moon: America\'s Thirty Billion Dollar Swindle. 1976.',
          url: 'https://www.hq.nasa.gov/alsj/ApolloHoaxDebunked.pdf',
          publishedAt: '1976-01-01',
          methodologyType: 'opinion',
        },
      },
    ],
  },

  // ── 5. Handwashing prevents infection transmission ────────────────────────────
  {
    externalId: 'trajectory:handwashing-prevents-infection',
    text: 'Hand hygiene (handwashing with soap or antiseptic) significantly reduces transmission of infectious disease.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1847-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1847-01-01',
        datePrecision: 'YEAR',
        reason: 'Ignaz Semmelweis demonstrates that chlorinated lime handwashing by physicians reduces puerperal fever mortality from ~10% to ~1% at Vienna General Hospital. Despite robust empirical data, the medical establishment rejects his findings — germ theory does not yet exist, and the implication that doctors are killing patients is socially unacceptable.',
        source: {
          externalId: 'src:semmelweis-handwashing-1847',
          name: 'Semmelweis IP. Etiology, Concept and Prophylaxis of Childbed Fever. Vienna, 1861. (Data collected from 1847)',
          url: 'https://collections.nlm.nih.gov/catalog/nlm:nlmuid-66830030R-bk',
          publishedAt: '1861-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1865-01-01',
        datePrecision: 'YEAR',
        reason: 'Louis Pasteur\'s germ theory (1857–1865) and Joseph Lister\'s antiseptic surgical technique (1865) provide the mechanistic explanation Semmelweis lacked. The theoretical framework retroactively validates the handwashing finding. Semmelweis dies in 1865, the same year his view is vindicated.',
        source: {
          externalId: 'src:lister-antiseptic-1867',
          name: 'Lister J. On the antiseptic principle in the practice of surgery. Lancet 1867;2:353-356.',
          url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(02)18079-2/fulltext',
          publishedAt: '1867-09-21',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2009-05-05',
        datePrecision: 'DAY',
        reason: 'WHO launches "SAVE LIVES: Clean Your Hands" global campaign. Handwashing is enshrined in WHO patient safety guidelines as one of the most evidence-backed interventions in medicine, 162 years after Semmelweis\'s data.',
        source: {
          externalId: 'src:who-hand-hygiene-2009',
          name: 'WHO Guidelines on Hand Hygiene in Health Care. World Health Organization, 2009.',
          url: 'https://www.who.int/publications/i/item/9789241597906',
          publishedAt: '2009-05-05',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 6. The Earth is approximately 4.5 billion years old ──────────────────────
  {
    externalId: 'trajectory:earth-age-4-5-billion',
    text: 'The Earth is approximately 4.5 billion years old.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1956-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1862-01-01',
        datePrecision: 'YEAR',
        reason: 'Lord Kelvin estimates Earth is 20–400 million years old based on cooling rates, directly contradicting geologists who infer vast age from rock strata. Creates major conflict between physics and geology/biology (Darwin requires hundreds of millions of years for evolution).',
        source: {
          externalId: 'src:kelvin-earth-age-1862',
          name: 'Thomson W (Lord Kelvin). On the secular cooling of the Earth. Transactions of the Royal Society of Edinburgh. 1862;23:157-169.',
          url: 'https://www.cambridge.org/core/journals/earth-and-environmental-science-transactions-of-royal-society-of-edinburgh/article/abs/i-on-the-secular-cooling-of-the-earth/8B88F32B1ABAEABE04E4697756F4F3C2',
          publishedAt: '1862-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'OPEN',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1904-01-01',
        datePrecision: 'YEAR',
        reason: 'Ernest Rutherford demonstrates radioactive decay as a heat source Kelvin had not accounted for, invalidating Kelvin\'s estimate. Age becomes an open question pending radiometric dating methods.',
        source: {
          externalId: 'src:rutherford-radioactivity-1904',
          name: 'Rutherford E. Radio-activity. Cambridge University Press, 1904.',
          url: 'https://www.cambridge.org/core/books/radioactivity/2C3E32F85E30697CC23B0F9A5B10C5F5',
          publishedAt: '1904-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'OPEN',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1956-01-01',
        datePrecision: 'YEAR',
        reason: 'Clair Patterson uses uranium-lead radiometric dating on Canyon Diablo meteorite to establish Earth\'s age at 4.55 ± 0.07 billion years. Independent confirmation via multiple isotope systems across subsequent decades cements this value.',
        source: {
          externalId: 'src:patterson-earth-age-1956',
          name: 'Patterson C. Age of meteorites and the earth. Geochimica et Cosmochimica Acta 1956;10(4):230-237.',
          url: 'https://www.sciencedirect.com/science/article/abs/pii/0016703756900366',
          publishedAt: '1956-10-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 7. Thalidomide causes birth defects ────────────────────────────────────────
  {
    externalId: 'trajectory:thalidomide-birth-defects',
    text: 'Thalidomide, when taken during pregnancy, causes severe limb malformations (phocomelia) and other birth defects in newborns.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1959-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1959-01-01',
        datePrecision: 'YEAR',
        reason: 'German pediatrician Widukind Lenz privately alerts Grünenthal (thalidomide manufacturer) to a cluster of phocomelia cases he suspects are drug-related. The company denies any link. Formal causal claim begins as contested suspicion against commercial denial.',
        source: {
          externalId: 'src:lenz-thalidomide-1961',
          name: 'Lenz W. Kindliche Missbildungen nach Medikament-Einnahme während der Gravidität? Deutsche Medizinische Wochenschrift 1961;86:2555-2556.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13875378',
          publishedAt: '1961-11-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1961-11-26',
        datePrecision: 'DAY',
        reason: 'Grünenthal voluntarily withdraws thalidomide from the German market (November 26, 1961) after Lenz\'s public presentation. The UK follows. Withdrawal constitutes institutional acknowledgment. Frances Kelsey (FDA) had already blocked U.S. approval on safety grounds.',
        source: {
          externalId: 'src:thalidomide-withdrawal-1961',
          name: 'McBride WG. Thalidomide and congenital abnormalities. Lancet 1961;2(7216):1358.',
          url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(61)90927-8/fulltext',
          publishedAt: '1961-12-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'JUDICIAL',
        occurredAt: '1970-01-01',
        datePrecision: 'YEAR',
        reason: 'German court proceedings (1968–1970) and UK settlements establish legal causation. Subsequent mechanistic research identifies R-enantiomer as teratogenic. The case directly drives global tightening of drug testing requirements for pregnant women.',
        source: {
          externalId: 'src:thalidomide-legal-settlement-1970',
          name: 'Sunday Times v. United Kingdom (thalidomide litigation background); Distillers Company settlement 1973.',
          url: 'https://www.thalidomide.ca/the-thalidomide-tragedy/',
          publishedAt: '1973-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 8. End of apartheid in South Africa ──────────────────────────────────────
  {
    externalId: 'trajectory:south-africa-apartheid-end',
    text: 'Apartheid — the system of institutionalized racial segregation and discrimination in South Africa — ended with the first fully democratic elections on April 27, 1994.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1990-02-02',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'OPEN',
        community: 'PUBLIC',
        occurredAt: '1990-02-02',
        datePrecision: 'DAY',
        reason: 'President F.W. de Klerk announces unbanning of the ANC and other liberation movements, and commits to releasing Nelson Mandela. Future of apartheid becomes a live political question rather than settled status quo.',
        source: {
          externalId: 'src:deklerk-speech-1990',
          name: 'F.W. de Klerk, Opening of Parliament Address, February 2, 1990 (live broadcast)',
          url: 'https://www.gov.za/speeches/president-fw-de-klerk-opening-parliament-february-2-1990',
          publishedAt: '1990-02-02',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'OPEN',
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1991-06-17',
        datePrecision: 'DAY',
        reason: 'South African parliament repeals the Population Registration Act — the legal cornerstone of apartheid. Constitutional negotiations begin.',
        source: {
          externalId: 'src:population-registration-repeal-1991',
          name: 'Repeal of Population Registration Act, South Africa, June 17, 1991',
          url: 'https://www.sahistory.org.za/dated-event/population-registration-act-repealed',
          publishedAt: '1991-06-17',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'PUBLIC',
        occurredAt: '1994-04-27',
        datePrecision: 'DAY',
        reason: 'First fully democratic elections. Nelson Mandela elected President. Over 19 million South Africans — including Black citizens voting for the first time — participate. International observers confirm free and fair election. The public act of voting settles the claim in a way no legislative act could.',
        source: {
          externalId: 'src:sa-elections-1994',
          name: 'Independent Electoral Commission of South Africa: Results of the 1994 General Election',
          url: 'https://www.elections.org.za/NPEResults/npe_report.aspx',
          publishedAt: '1994-04-27',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 9. Opioids: Purdue's "less than 1% addiction" claim ──────────────────────
  // A claim that went from RECORDED (official, endorsed) to REVERSED.
  {
    externalId: 'trajectory:opioids-less-than-1pct-addiction',
    text: 'Prescription opioids prescribed for chronic pain carry less than a 1% risk of addiction in patients with no prior substance abuse history.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1980-01-10',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'UNRESOLVABLE',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1980-01-10',
        datePrecision: 'MONTH',
        reason: 'A 101-word letter to the New England Journal of Medicine by Porter & Jick (1980) reports low addiction rates in hospitalized patients given opioids. The letter — not a controlled study — is later cited hundreds of times as evidence that prescribed opioids rarely cause addiction.',
        source: {
          externalId: 'src:porter-jick-1980-nejm',
          name: 'Porter J, Jick H. Addiction rare in patients treated with narcotics. N Engl J Med 1980;302(2):123.',
          url: 'https://www.nejm.org/doi/10.1056/NEJM198001103020221',
          publishedAt: '1980-01-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1996-12-01',
        datePrecision: 'MONTH',
        reason: 'Purdue Pharma launches OxyContin with aggressive marketing citing the Porter & Jick letter. American Pain Society promotes "pain as the 5th vital sign." FDA approvals and prescribing guidelines embed the low-addiction narrative into clinical practice.',
        source: {
          externalId: 'src:oxycontin-launch-1996',
          name: 'Van Zee A. The promotion and marketing of OxyContin: commercial triumph, public health tragedy. Am J Public Health 2009;99(2):221-227.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/18799767',
          publishedAt: '2009-02-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'JUDICIAL',
        occurredAt: '2007-05-10',
        datePrecision: 'DAY',
        reason: 'Purdue Pharma pleads guilty to federal charges of fraudulently misrepresenting the addiction risk of OxyContin, paying $634.5M. The Porter & Jick letter is formally identified as misrepresented; opioid overdose death toll reaches 18,000/year in the US. The original "less than 1%" claim is judicially reversed as commercially motivated misinformation.',
        source: {
          externalId: 'src:purdue-plea-2007',
          name: 'United States v. Purdue Frederick Co., W.D. Va. 2007. Guilty plea agreement, May 10, 2007.',
          url: 'https://www.justice.gov/archive/usao/vaw/press_releases/2007/may/purdue_05_10_07.html',
          publishedAt: '2007-05-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 10. Dissolution of the Soviet Union ──────────────────────────────────────
  {
    externalId: 'trajectory:soviet-union-dissolution-1991',
    text: 'The Union of Soviet Socialist Republics (USSR) ceased to exist as a sovereign state on December 25, 1991.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1991-12-08',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'CONTESTED',
        community: 'INSTITUTIONAL',
        occurredAt: '1991-08-19',
        datePrecision: 'DAY',
        reason: 'August Coup attempt by hardline communists against Gorbachev. Fails within three days but signals terminal crisis of Soviet authority. Whether the USSR can survive becomes an active, contested question.',
        source: {
          externalId: 'src:soviet-coup-1991',
          name: 'State Committee for the State of Emergency declaration, August 19, 1991; coup collapse August 22, 1991.',
          url: 'https://www.wilsoncenter.org/publication/the-attempted-coup-against-gorbachev-august-1991',
          publishedAt: '1991-08-22',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1991-12-08',
        datePrecision: 'DAY',
        reason: 'Leaders of Russia, Ukraine, and Belarus sign the Belavezha Accords declaring the USSR dissolved and founding the Commonwealth of Independent States (CIS). The legal act of dissolution is recorded before it is publicly accepted.',
        source: {
          externalId: 'src:belavezha-accords-1991',
          name: 'Agreement on the Creation of the Commonwealth of Independent States (Belavezha Accords), December 8, 1991.',
          url: 'https://www.nato.int/acad/fellow/94-96/kantor/04.htm',
          publishedAt: '1991-12-08',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'PUBLIC',
        occurredAt: '1991-12-25',
        datePrecision: 'DAY',
        reason: 'Mikhail Gorbachev resigns as President of the USSR in a live television address. The Soviet flag over the Kremlin is lowered and replaced by the Russian tricolor. The act of public resignation and flag replacement — broadcast globally — settles the dissolution as observable historical fact.',
        source: {
          externalId: 'src:gorbachev-resignation-1991',
          name: 'Gorbachev M. Resignation address, December 25, 1991 (live broadcast, CNN international feed)',
          url: 'https://www.youtube.com/watch?v=ybxr1lFNFnY',
          publishedAt: '1991-12-25',
          methodologyType: 'primary',
        },
      },
    ],
  },

]

// ── Upsert logic (identical to seed-trajectories.ts) ─────────────────────────
async function upsertTrajectory(t: Trajectory) {
  // Upsert the root Claim
  const claim = await prisma.claim.upsert({
    where: { externalId: t.externalId },
    create: {
      externalId: t.externalId,
      text: t.text,
      claimType: t.claimType,
      claimEmergedAt: new Date(t.claimEmergedAt),
      claimEmergedPrecision: t.claimEmergedPrecision,
      epistemicAxis: t.currentAxis,
      currentStatus: 'DISPUTED',
      ingestedBy: 'seed:historical-trajectories',
      autoApproved: true,
    },
    update: {
      text: t.text,
      epistemicAxis: t.currentAxis,
      claimType: t.claimType,
      claimEmergedAt: new Date(t.claimEmergedAt),
      claimEmergedPrecision: t.claimEmergedPrecision,
    },
  })

  // Upsert transitions
  for (let i = 0; i < t.transitions.length; i++) {
    const tr = t.transitions[i]

    // Upsert source
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'seed:historical-trajectories',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    // Upsert ClaimStatusHistory
    const histId = `csh:${t.externalId}:${i}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: claim.id,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    // Ensure Edge (claim ↔ source) exists
    const existingEdge = await prisma.edge.findFirst({ where: { claimId: claim.id, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: claim.id, sourceId: source.id, type: 'FOR' } })
    }
  }

  console.log(`  ✓ ${t.externalId} (${t.transitions.length} transitions)`)
}

async function main() {
  console.log(`Seeding ${TRAJECTORIES.length} historical trajectories${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  if (!DRY_RUN) {
    for (const t of TRAJECTORIES) {
      await upsertTrajectory(t)
    }
  } else {
    for (const t of TRAJECTORIES) {
      console.log(`  [dry] ${t.externalId} — ${t.transitions.length} transitions`)
    }
  }

  console.log(`\nDone. ${TRAJECTORIES.length} trajectories seeded.`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
