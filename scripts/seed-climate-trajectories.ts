// Seed: Climate Science epistemic trajectories
//
// Domain-specific settling curves: each trajectory is a dateable climate
// science claim with a verifiable epistemic arc — from initial expert
// literature finding through institutional adoption, policy action,
// court judgments, or public recognition.
//
// Sources: IPCC reports, NOAA, NASA GISS, Nature, Science, Tellus,
// Philosophical Magazine, WHO, UN treaty databases, court records.
//
// Idempotent: upserts on externalId.
//
// Run:     npx tsx scripts/seed-climate-trajectories.ts
// Dry-run: npx tsx scripts/seed-climate-trajectories.ts --dry-run

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
  currentAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED'
  transitions: Transition[]
}

const TRAJECTORIES: Trajectory[] = [

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRE-INDUSTRIAL SCIENCE ERA (before 1900)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 1. Eunice Newton Foote — greenhouse effect experiment — 1856 ────────────
  {
    externalId: 'trajectory:foote-greenhouse-effect-1856',
    text: 'Eunice Newton Foote demonstrated in August 1856 that carbonic acid (CO₂) absorbs more solar heat than ordinary air and retains it longer, providing the first experimental evidence for the greenhouse effect of atmospheric gases.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1856-08-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1856-11-01',
        datePrecision: 'MONTH',
        reason: 'Foote\'s paper "Circumstances affecting the heat of the sun\'s rays" is read at the American Association for the Advancement of Science (AAAS) annual meeting in August 1856 by Professor Joseph Henry (she was not permitted to present herself) and published in the American Journal of Science and Arts in November 1856. The finding that CO₂-rich air heats more than ordinary air under sunlight is the first experimental greenhouse effect demonstration, though it remained largely unnoticed for over a century.',
        source: {
          externalId: 'src:foote-greenhouse-1856-ajs',
          name: 'Foote EN. Circumstances affecting the heat of the sun\'s rays. American Journal of Science and Arts. 1856;22(2nd series):382–383.',
          url: 'https://www.scientificamerican.com/article/the-woman-who-demonstrated-the-greenhouse-effect/',
          publishedAt: '1856-11-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2011-07-01',
        datePrecision: 'MONTH',
        reason: 'Raymond Sorenson\'s 2011 research note in the Proceedings of the American Philosophical Society and subsequent historical scholarship formally restore Foote\'s priority in the greenhouse effect discovery. The Smithsonian Institution and NOAA later feature her work prominently, cementing her historical recognition as the first to experimentally demonstrate CO₂\'s greenhouse properties.',
        source: {
          externalId: 'src:sorenson-foote-rediscovery-2011',
          name: 'Sorenson R. Eunice Newton Foote\'s pioneering research on CO2 and climate warming: Update. Proceedings of the American Philosophical Society. 2011;155(3).',
          url: 'https://www.aps.org/publications/apsnews/201907/foote.cfm',
          publishedAt: '2011-07-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 2. Svante Arrhenius — CO₂ warming calculation — 1896 ───────────────────
  {
    externalId: 'trajectory:arrhenius-co2-warming-1896',
    text: 'Svante Arrhenius calculated in 1896 that halving atmospheric CO₂ could cause an ice age, and that doubling it would raise global temperatures by approximately 5–6°C, providing the first quantitative prediction of anthropogenic climate forcing.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1896-04-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1896-04-01',
        datePrecision: 'MONTH',
        reason: 'Arrhenius publishes "On the influence of carbonic acid in the air upon the temperature of the ground" in the Philosophical Magazine and Journal of Science. Using Langley\'s lunar heat measurements, he performs months of hand calculations to produce the first quantitative estimate of CO₂\'s warming effect, predicting roughly 5–6°C warming per CO₂ doubling. The paper establishes that human industrial emissions could alter global climate over centuries.',
        source: {
          externalId: 'src:arrhenius-co2-1896',
          name: 'Arrhenius S. On the influence of carbonic acid in the air upon the temperature of the ground. Philosophical Magazine and Journal of Science. 1896;41(251):237–276.',
          url: 'https://www.rsc.org/publishing/journals/article/landing/?doi=10.1039/ct8966100237',
          publishedAt: '1896-04-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1979-07-01',
        datePrecision: 'MONTH',
        reason: 'The U.S. National Academy of Sciences Charney Report (1979) concludes that CO₂ doubling will produce 1.5–4.5°C warming (climate sensitivity), validating Arrhenius\'s order-of-magnitude estimate with modern GCMs. The report establishes climate sensitivity as a scientific quantity and Arrhenius\'s framework as foundational.',
        source: {
          externalId: 'src:charney-report-1979',
          name: 'Charney JG et al. Carbon Dioxide and Climate: A Scientific Assessment. National Academy of Sciences. 1979.',
          url: 'https://nap.nationalacademies.org/catalog/12181/carbon-dioxide-and-climate-a-scientific-assessment',
          publishedAt: '1979-07-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // INDUSTRIAL ERA & ENVIRONMENTAL AWAKENING (1900–1970)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 3. Revelle & Suess — CO₂ ocean absorption — 1957 ───────────────────────
  {
    externalId: 'trajectory:revelle-suess-co2-ocean-1957',
    text: 'Roger Revelle and Hans Suess published in February 1957 that the ocean cannot absorb anthropogenic CO₂ as fast as it is emitted — the "Revelle factor" — meaning CO₂ will accumulate in the atmosphere, making humanity a global geophysical experiment.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1957-02-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1957-02-01',
        datePrecision: 'MONTH',
        reason: 'Revelle and Suess publish "Carbon dioxide exchange between atmosphere and ocean and the question of an increase of atmospheric CO₂ during the past decades" in Tellus. Their key finding: ocean chemistry (the "Revelle buffer factor") limits oceanic CO₂ uptake to roughly 10% of emissions, meaning most anthropogenic CO₂ stays in the atmosphere. Their framing — "human beings are now carrying out a large scale geophysical experiment" — becomes one of the most quoted sentences in climate science.',
        source: {
          externalId: 'src:revelle-suess-tellus-1957',
          name: 'Revelle R, Suess HE. Carbon dioxide exchange between atmosphere and ocean and the question of an increase of atmospheric CO₂ during the past decades. Tellus. 1957;9(1):18–27.',
          url: 'https://doi.org/10.1111/j.2153-3490.1957.tb01849.x',
          publishedAt: '1957-02-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1965-11-05',
        datePrecision: 'DAY',
        reason: 'The President\'s Science Advisory Committee Report "Restoring the Quality of Our Environment" (1965), with a chapter on CO₂ by Revelle and colleagues, warns the U.S. President of potential CO₂-driven warming by 2000. This first formal government acknowledgment of the Revelle-Suess finding — eight years after publication — marks institutional uptake of the ocean-buffer limitation.',
        source: {
          externalId: 'src:psac-co2-report-1965',
          name: 'President\'s Science Advisory Committee. Restoring the Quality of Our Environment. The White House. November 5, 1965.',
          url: 'https://www.climatefiles.com/climate-change-evidence/presidents-science-advisory-committee-report/',
          publishedAt: '1965-11-05',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 4. Keeling Curve — first systematic CO₂ measurement — 1958 ─────────────
  {
    externalId: 'trajectory:keeling-curve-first-measurement-1958',
    text: 'Charles David Keeling made the first reliable baseline measurement of atmospheric CO₂ at Mauna Loa Observatory on March 31, 1958, recording 313 ppm, initiating the continuous Keeling Curve record that became the iconic empirical foundation of climate science.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1958-03-31',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1960-04-01',
        datePrecision: 'MONTH',
        reason: 'Keeling publishes "The Concentration and Isotopic Abundances of Carbon Dioxide in the Atmosphere" in Tellus in 1960, presenting two years of Mauna Loa data. The measurements establish the seasonal cycle (the "breathing of the Earth") and the clear upward trend, providing the first unambiguous evidence of rising atmospheric CO₂ due to fossil fuel burning. The Scripps Institution of Oceanography measurements begin March 31, 1958.',
        source: {
          externalId: 'src:keeling-co2-tellus-1960',
          name: 'Keeling CD. The concentration and isotopic abundances of carbon dioxide in the atmosphere. Tellus. 1960;12(2):200–203.',
          url: 'https://doi.org/10.1111/j.2153-3490.1960.tb01300.x',
          publishedAt: '1960-04-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2013-05-09',
        datePrecision: 'DAY',
        reason: 'NOAA and Scripps Institution announce on May 9, 2013 that daily average CO₂ at Mauna Loa has exceeded 400 ppm for the first time in the instrument record — a milestone that confirms 55 years of unbroken Keeling Curve data as the canonical measure of anthropogenic CO₂ accumulation. The curve is now managed jointly by NOAA and Scripps.',
        source: {
          externalId: 'src:noaa-keeling-400ppm-2013',
          name: 'NOAA Earth System Research Laboratory. Carbon dioxide at MAUNA LOA Observatory reaches new milestone: Tops 400 ppm. May 9, 2013.',
          url: 'https://gml.noaa.gov/ccgg/trends/',
          publishedAt: '2013-05-09',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // POLICY & CRISIS ERA (1970–2000)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 5. Joe Farman — ozone hole confirmed — 1985 ─────────────────────────────
  {
    externalId: 'trajectory:farman-ozone-hole-1985',
    text: 'Joe Farman, Brian Gardiner, and Jonathan Shanklin of the British Antarctic Survey confirmed in May 1985 that stratospheric ozone over Antarctica had declined by more than 40% since the late 1970s, establishing the existence of the ozone hole.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1985-05-16',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1985-05-16',
        datePrecision: 'DAY',
        reason: 'Farman, Gardiner, and Shanklin publish "Large losses of total ozone in Antarctica reveal seasonal ClOx/NOx interaction" in Nature on May 16, 1985. Using ground-based Dobson spectrophotometer data from Halley Bay, they report a 40%+ springtime ozone depletion over Antarctica correlating with CFC accumulation. The paper shocks the scientific community as NASA\'s satellite data had missed the depletion due to an algorithm filtering out extreme low values.',
        source: {
          externalId: 'src:farman-ozone-nature-1985',
          name: 'Farman JC, Gardiner BG, Shanklin JD. Large losses of total ozone in Antarctica reveal seasonal ClOx/NOx interaction. Nature. 1985;315:207–210.',
          url: 'https://doi.org/10.1038/315207a0',
          publishedAt: '1985-05-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1987-09-16',
        datePrecision: 'DAY',
        reason: 'The Montreal Protocol on Substances that Deplete the Ozone Layer is signed on September 16, 1987, by 24 countries and the European Community, committing to phase out CFCs. This is the fastest transition from scientific discovery to binding international treaty in environmental history — just two years — and institutionally settled the ozone depletion claim.',
        source: {
          externalId: 'src:montreal-protocol-1987',
          name: 'United Nations Environment Programme. Montreal Protocol on Substances that Deplete the Ozone Layer. September 16, 1987.',
          url: 'https://ozone.unep.org/treaties/montreal-protocol',
          publishedAt: '1987-09-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2023-01-09',
        datePrecision: 'DAY',
        reason: 'A WMO/UNEP Scientific Assessment Panel report published January 9, 2023 confirms the ozone layer is on track to recover to 1980 levels by approximately 2066 over Antarctica, marking the first confirmed partial recovery attributable to the Montreal Protocol. The ozone hole discovery claim has progressed from empirical recording to full institutional and scientific validation of both the problem and its remedy.',
        source: {
          externalId: 'src:wmo-ozone-recovery-2023',
          name: 'WMO/UNEP. Scientific Assessment of Ozone Depletion: 2022. GAW Report No. 278. January 9, 2023.',
          url: 'https://ozone.unep.org/science/assessment/sap',
          publishedAt: '2023-01-09',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 6. IPCC First Assessment Report — 1990 ──────────────────────────────────
  {
    externalId: 'trajectory:ipcc-first-assessment-report-1990',
    text: 'The IPCC First Assessment Report, released in August 1990, concluded that human activities are substantially increasing atmospheric concentrations of greenhouse gases and that enhanced greenhouse warming is expected to cause significant and potentially irreversible changes to climate.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1990-08-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1990-08-01',
        datePrecision: 'MONTH',
        reason: 'The IPCC Working Groups I, II, and III release the First Assessment Report in August 1990, synthesizing climate science from over 170 scientists across 25 countries. WGI concludes with "certainty" that greenhouse gases have increased due to human activities and projects a mean global temperature rise of 0.3°C per decade under a "business as usual" scenario. This is the first intergovernmental scientific consensus statement on anthropogenic climate change.',
        source: {
          externalId: 'src:ipcc-far-1990',
          name: 'IPCC. Climate Change: The IPCC Scientific Assessment (First Assessment Report). Cambridge University Press. August 1990.',
          url: 'https://www.ipcc.ch/report/ar1/wg1/',
          publishedAt: '1990-08-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1992-06-09',
        datePrecision: 'DAY',
        reason: 'The United Nations Framework Convention on Climate Change (UNFCCC) is opened for signature at the Rio Earth Summit on June 9, 1992, and enters into force in 1994. The treaty explicitly references the IPCC findings and commits signatory nations to stabilizing greenhouse gas concentrations. The FAR thus transitions from an expert assessment to the foundation of binding international climate law.',
        source: {
          externalId: 'src:unfccc-1992',
          name: 'United Nations. United Nations Framework Convention on Climate Change. FCCC/INFORMAL/84 GE.05-62220 (E) 200705. June 9, 1992.',
          url: 'https://unfccc.int/resource/docs/convkp/conveng.pdf',
          publishedAt: '1992-06-09',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 7. Kyoto Protocol — 1997 ─────────────────────────────────────────────────
  {
    externalId: 'trajectory:kyoto-protocol-signed-1997',
    text: 'The Kyoto Protocol, signed on December 11, 1997, was the first binding international agreement requiring developed countries to reduce greenhouse gas emissions by specified percentages below 1990 levels during the 2008–2012 commitment period.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1997-12-11',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1997-12-11',
        datePrecision: 'DAY',
        reason: 'The Kyoto Protocol is adopted at COP3 in Kyoto, Japan, on December 11, 1997. It establishes legally binding emission reduction targets for 37 industrialized countries and the European Community, averaging 5.2% below 1990 levels for the 2008–2012 period. It introduces market mechanisms (emissions trading, CDM, JI) and differentiates obligations between developed (Annex I) and developing nations.',
        source: {
          externalId: 'src:kyoto-protocol-1997',
          name: 'United Nations. Kyoto Protocol to the United Nations Framework Convention on Climate Change. December 11, 1997. U.N. Doc FCCC/CP/1997/7/Add.1.',
          url: 'https://unfccc.int/kyoto_protocol',
          publishedAt: '1997-12-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2005-02-16',
        datePrecision: 'DAY',
        reason: 'The Kyoto Protocol enters into force on February 16, 2005, after Russia\'s ratification in November 2004 brings the threshold (55 countries representing 55% of Annex I emissions) above the required minimum. 141 nations have ratified by entry into force. The U.S. withdrawal (2001) and Canada\'s withdrawal (2012) create a contested legacy, but the protocol\'s entry into force settles it as the first operational binding climate treaty.',
        source: {
          externalId: 'src:kyoto-entry-into-force-2005',
          name: 'United Nations Framework Convention on Climate Change. Kyoto Protocol — Status of Ratification. February 16, 2005.',
          url: 'https://unfccc.int/process/the-kyoto-protocol',
          publishedAt: '2005-02-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLIMATE ACTION ERA (2000–present)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 8. Paris Agreement — 2015 ───────────────────────────────────────────────
  {
    externalId: 'trajectory:paris-agreement-adopted-2015',
    text: 'The Paris Agreement, adopted on December 12, 2015, established the first universal, legally binding global climate framework committing all parties to limit warming to well below 2°C above pre-industrial levels, with efforts toward 1.5°C, through nationally determined contributions.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2015-12-12',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2015-12-12',
        datePrecision: 'DAY',
        reason: 'The Paris Agreement is adopted by consensus of 196 parties at COP21 in Le Bourget, France, on December 12, 2015. Unlike the Kyoto Protocol, it covers all nations (not just developed), requires Nationally Determined Contributions (NDCs) from each party, and includes a ratchet mechanism requiring progressively ambitious pledges every five years. The 1.5°C target responds to IPCC AR5 findings on avoiding dangerous climate tipping points.',
        source: {
          externalId: 'src:paris-agreement-2015',
          name: 'United Nations. Paris Agreement under the United Nations Framework Convention on Climate Change. FCCC/CP/2015/10/Add.1. December 12, 2015.',
          url: 'https://unfccc.int/process-and-meetings/the-paris-agreement',
          publishedAt: '2015-12-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-11-04',
        datePrecision: 'DAY',
        reason: 'The Paris Agreement enters into force on November 4, 2016 — the fastest entry into force of any major multilateral environmental agreement — after 55 parties representing 55% of global emissions ratify within a year of adoption. By 2023, 195 parties have ratified, making it effectively universal binding international climate law.',
        source: {
          externalId: 'src:paris-agreement-entry-into-force-2016',
          name: 'UNFCCC. Paris Agreement — Entry into force. November 4, 2016.',
          url: 'https://treaties.un.org/pages/ViewDetails.aspx?src=TREATY&mtdsg_no=XXVII-7-d&chapter=27',
          publishedAt: '2016-11-04',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 9. Montana Held v. Montana youth climate ruling — 2023 ─────────────────
  {
    externalId: 'trajectory:held-v-montana-climate-ruling-2023',
    text: 'On August 14, 2023, Montana First Judicial District Judge Kathy Seeley ruled in Held v. Montana that the Montana Environmental Policy Act\'s prohibition on considering climate impacts in energy permitting was unconstitutional, becoming the first U.S. court ruling that a state has a constitutional obligation to protect residents from climate harm.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2023-08-14',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'JUDICIAL',
        occurredAt: '2023-08-14',
        datePrecision: 'DAY',
        reason: 'Judge Kathy Seeley issues her decision in Held v. Montana, ruling that Montana\'s MEPA limitation — which barred state agencies from considering greenhouse gas emissions or climate impacts in environmental reviews — violates the Montana Constitution\'s right to "a clean and healthful environment." The case was brought by 16 young plaintiffs aged 5–22. Seeley found that climate science evidence, including expert testimony, established a direct causal link between Montana\'s fossil fuel permitting and climate harm to the plaintiffs.',
        source: {
          externalId: 'src:held-v-montana-decision-2023',
          name: 'Held et al. v. State of Montana. Cause No. CDV-2020-307. First Judicial District Court, Lewis and Clark County, Montana. August 14, 2023.',
          url: 'https://climatecasechart.com/case/held-v-state-of-montana/',
          publishedAt: '2023-08-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'JUDICIAL',
        occurredAt: '2024-11-01',
        datePrecision: 'MONTH',
        reason: 'Montana Attorney General Austin Knudsen appeals the ruling to the Montana Supreme Court. The state argues Seeley exceeded judicial authority and that MEPA limitations are a legislative policy choice. The case is under appellate review as of 2024, meaning the constitutional climate obligation ruling remains contested at the appellate level, though the trial court finding is a landmark in U.S. climate litigation history.',
        source: {
          externalId: 'src:held-v-montana-appeal-2024',
          name: 'State of Montana v. Held et al. Montana Supreme Court. Appeal filed 2023. Oral arguments scheduled 2024.',
          url: 'https://climatecasechart.com/case/held-v-state-of-montana/',
          publishedAt: '2024-11-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // OZONE SCIENCE (1930–present)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 10. Chapman cycle — stratospheric ozone photochemistry — 1930 ───────────
  {
    externalId: 'trajectory:chapman-ozone-photochemistry-1930',
    text: 'Sydney Chapman published in 1930 the first quantitative photochemical theory of how the stratospheric ozone layer forms and is maintained — solar ultraviolet splitting molecular oxygen into atoms that recombine into ozone — the mechanism still known as the Chapman cycle.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1930-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1930-01-01',
        datePrecision: 'YEAR',
        reason: 'Chapman published \'A theory of upper atmospheric ozone\' in the Memoirs of the Royal Meteorological Society (vol. 3, no. 26, pp. 103–125), developing the first quantitative photochemical model of ozone equilibrium in the upper atmosphere. It explained the existence and altitude distribution of the ozone layer as a pure-oxygen photochemical balance, a theoretical claim grounded in the Dobson-era column measurements then accumulating.',
        source: {
          externalId: 'src:chapman-ozone-theory-1930',
          name: 'Chapman S. A theory of upper atmospheric ozone. Memoirs of the Royal Meteorological Society. 1930;3(26):103–125.',
          url: 'https://www.rmets.org/sites/default/files/papers/chapman-memoirs.pdf',
          publishedAt: '1930-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1970-04-01',
        datePrecision: 'MONTH',
        reason: 'By 1970 the Chapman mechanism was the universally accepted foundation of stratospheric ozone chemistry: Crutzen\'s NOx work and, later, the Molina–Rowland ClOx work were explicitly framed as catalytic loss terms supplementing the Chapman production cycle, which had been found to overpredict ozone. The Chapman cycle remained settled as the foundational production mechanism even as catalytic destruction cycles were added to reconcile theory with the lower observed ozone.',
        source: {
          externalId: 'src:crutzen-nox-ozone-qjrms-1970',
          name: 'Crutzen PJ. The influence of nitrogen oxides on the atmospheric ozone content. Quarterly Journal of the Royal Meteorological Society. 1970;96(408):320–325.',
          url: 'https://rmets.onlinelibrary.wiley.com/doi/10.1002/qj.49709640815',
          publishedAt: '1970-04-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 11. Crutzen NOx catalytic ozone destruction — 1970 ─────────────────────
  {
    externalId: 'trajectory:crutzen-nox-ozone-destruction-1970',
    text: 'Paul Crutzen published in April 1970 the finding that catalytic cycles involving nitric oxide and nitrogen dioxide (NOx) are a dominant sink controlling stratospheric ozone, the first identification of a catalytic ozone-destruction mechanism.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1970-04-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1970-04-01',
        datePrecision: 'MONTH',
        reason: 'Crutzen published \'The influence of nitrogen oxides on the atmospheric ozone content\' in the Quarterly Journal of the Royal Meteorological Society, showing that NO and NO2 act as a catalytic chain destroying odd oxygen and reconciling the Chapman theory\'s overprediction with observed ozone. This was the first demonstration that trace catalysts, not just the pure-oxygen Chapman cycle, govern stratospheric ozone, and it laid the conceptual groundwork for the later halogen-catalysis discoveries.',
        source: {
          externalId: 'src:crutzen-nox-ozone-qjrms-1970',
          name: 'Crutzen PJ. The influence of nitrogen oxides on the atmospheric ozone content. Quarterly Journal of the Royal Meteorological Society. 1970;96(408):320–325.',
          url: 'https://rmets.onlinelibrary.wiley.com/doi/10.1002/qj.49709640815',
          publishedAt: '1970-04-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1995-10-11',
        datePrecision: 'DAY',
        reason: 'The Royal Swedish Academy of Sciences awarded the 1995 Nobel Prize in Chemistry to Crutzen, Molina, and Rowland \'for their work in atmospheric chemistry, particularly concerning the formation and decomposition of ozone,\' with Crutzen specifically cited for the NOx catalytic mechanism. The award ratified catalytic ozone destruction as settled science, with Crutzen\'s 1970 NOx result recognized as the founding case of the catalytic paradigm.',
        source: {
          externalId: 'src:nobel-chemistry-1995-crutzen',
          name: 'The Nobel Prize in Chemistry 1995: Paul J. Crutzen, Mario J. Molina, F. Sherwood Rowland. Royal Swedish Academy of Sciences. 11 October 1995.',
          url: 'https://www.nobelprize.org/prizes/chemistry/1995/summary/',
          publishedAt: '1995-10-11',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 12. Vienna Convention for the Protection of the Ozone Layer — 1985 ─────
  {
    externalId: 'trajectory:vienna-convention-ozone-layer-1985',
    text: 'On 22 March 1985 governments adopted the Vienna Convention for the Protection of the Ozone Layer, the first global framework treaty committing nations to cooperate on research and monitoring of stratospheric ozone depletion ahead of binding controls.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1985-03-22',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1985-03-22',
        datePrecision: 'DAY',
        reason: 'Under UNEP auspices, 20 nations adopted and opened for signature the Vienna Convention in Vienna, Austria. As a precautionary framework convention it created no binding emissions controls but obligated parties to cooperate on systematic observation, research, and information exchange on ozone-modifying substances — the institutional scaffolding adopted two months before the Antarctic ozone hole was publicly reported.',
        source: {
          externalId: 'src:vienna-convention-text-1985',
          name: 'United Nations Environment Programme. Vienna Convention for the Protection of the Ozone Layer. Adopted 22 March 1985.',
          url: 'https://treaties.un.org/doc/Treaties/1988/09/19880922%2003-14%20AM/Ch_XXVII_02p.pdf',
          publishedAt: '1985-03-22',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1988-09-22',
        datePrecision: 'DAY',
        reason: 'The Vienna Convention entered into force on 22 September 1988 after the twentieth instrument of ratification, becoming binding international law and the legal parent instrument of the 1987 Montreal Protocol. It subsequently achieved universal ratification, institutionally settling the framework for coordinated international action on ozone protection.',
        source: {
          externalId: 'src:unep-vienna-convention-introduction',
          name: 'Ozone Secretariat, UNEP. Vienna Convention for the Protection of the Ozone Layer — Introduction (entry into force 22 September 1988).',
          url: 'https://ozone.unep.org/treaties/vienna-convention/introduction',
          publishedAt: '1988-09-22',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 13. Antarctic ozone healing emergence — 2016 ────────────────────────────
  {
    externalId: 'trajectory:antarctic-ozone-healing-emergence-2016',
    text: 'Susan Solomon and colleagues reported in Science on 30 June 2016 the first detection of statistically significant healing of the Antarctic ozone hole — a September ozone-column recovery of more than 4 million square kilometres since 2000 — attributable to declining stratospheric chlorine under the Montreal Protocol.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2016-06-30',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2016-06-30',
        datePrecision: 'DAY',
        reason: 'Solomon, Ivy, Kinnison, Mills, Neely, and Schmidt published \'Emergence of healing in the Antarctic ozone layer\' in Science, using fingerprinting of September ozone, temperature, and aerosol trends to show the ozone hole had begun to shrink and that the recovery was chemically attributable to declining chlorine from the Montreal Protocol rather than meteorological variability. This was the first peer-reviewed claim that healing had emerged from the noise.',
        source: {
          externalId: 'src:solomon-ozone-healing-science-2016',
          name: 'Solomon S, Ivy DJ, Kinnison D, Mills MJ, Neely RR III, Schmidt A. Emergence of healing in the Antarctic ozone layer. Science. 2016;353(6296):269–274.',
          url: 'https://www.science.org/doi/10.1126/science.aae0061',
          publishedAt: '2016-06-30',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-01-09',
        datePrecision: 'DAY',
        reason: 'The WMO/UNEP Scientific Assessment Panel\'s 2022 report, released 9 January 2023, officially confirmed that the ozone layer is on track to recover to 1980 levels — around 2066 over Antarctica — institutionally endorsing the emergence-of-healing finding as established. The expert detection of 2016 became the consensus institutional position on Montreal Protocol-driven recovery.',
        source: {
          externalId: 'src:wmo-ozone-assessment-2022',
          name: 'WMO/UNEP. Scientific Assessment of Ozone Depletion: 2022. GAW Report No. 278. 9 January 2023.',
          url: 'https://ozone.unep.org/science/assessment/sap',
          publishedAt: '2023-01-09',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 14. Montzka CFC-11 unexpected emissions — 2018 ──────────────────────────
  {
    externalId: 'trajectory:cfc11-unexpected-emissions-2018',
    text: 'Stephen Montzka and colleagues reported in Nature on 16 May 2018 that the atmospheric decline of ozone-depleting CFC-11 had slowed by about 50% after 2012, implying unreported new production in violation of the Montreal Protocol.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2018-05-16',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-05-16',
        datePrecision: 'DAY',
        reason: 'Montzka et al. published \'An unexpected and persistent increase in global emissions of ozone-depleting CFC-11\' in Nature, showing that the steady post-Montreal decline in atmospheric CFC-11 had slowed sharply after 2012. The finding contested the settled assumption of full Montreal Protocol compliance, indicating roughly 13 Gg/yr of new unreported emissions from an unidentified source.',
        source: {
          externalId: 'src:montzka-cfc11-nature-2018',
          name: 'Montzka SA, et al. An unexpected and persistent increase in global emissions of ozone-depleting CFC-11. Nature. 2018;557(7705):413–417.',
          url: 'https://www.nature.com/articles/s41586-018-0106-2',
          publishedAt: '2018-05-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2019-05-23',
        datePrecision: 'DAY',
        reason: 'Rigby et al. published \'Increase in CFC-11 emissions from eastern China based on atmospheric observations\' in Nature, using regional monitoring stations to localize 40–60% of the global rise to the eastern Chinese provinces of Shandong and Hebei. By identifying the source and confirming new production of the banned compound, the study resolved the anomaly and re-settled the picture as an enforcement failure, prompting Chinese crackdowns and a subsequent renewed emissions decline.',
        source: {
          externalId: 'src:rigby-cfc11-china-nature-2019',
          name: 'Rigby M, Park S, Saito T, et al. Increase in CFC-11 emissions from eastern China based on atmospheric observations. Nature. 2019;569(7757):546–550.',
          url: 'https://www.nature.com/articles/s41586-019-1193-4',
          publishedAt: '2019-05-23',
          methodologyType: 'primary',
        },
      },
    ],
  },


  // ═══════════════════════════════════════════════════════════════════════════════
  // OCEAN & CRYOSPHERE SCIENCE (1978–present)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 15. Mercer — West Antarctic Ice Sheet collapse risk — 1978 ───────────────
  {
    externalId: 'trajectory:mercer-west-antarctic-ice-sheet-disaster-1978',
    text: 'John Mercer warned in Nature on 26 January 1978 that CO₂ greenhouse warming could trigger rapid, irreversible deglaciation of the marine-based West Antarctic Ice Sheet and a roughly 5-metre sea-level rise — the first identification of WAIS collapse as a specific climate threat.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1978-01-26',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1978-01-26',
        datePrecision: 'DAY',
        reason: "Mercer published 'West Antarctic ice sheet and CO2 greenhouse effect: a threat of disaster' in Nature (271:321–325), arguing that because the WAIS rests on a bed far below sea level it is uniquely vulnerable: a polar warming signal could initiate self-sustaining grounding-line retreat and collapse, raising global sea level by ~5 m. The hypothesis was widely regarded as alarmist and remained contested for decades.",
        source: {
          externalId: 'src:mercer-wais-disaster-nature-1978',
          name: 'Mercer JH. West Antarctic ice sheet and CO2 greenhouse effect: a threat of disaster. Nature. 1978;271(5643):321–325.',
          url: 'https://ui.adsabs.harvard.edu/abs/1978Natur.271..321M/abstract',
          publishedAt: '1978-01-26',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2014-05-16',
        datePrecision: 'DAY',
        reason: "Joughin, Smith, and Medley published 'Marine ice sheet collapse potentially under way for the Thwaites Glacier Basin, West Antarctica' in Science (344:735–738) on 16 May 2014, combining a numerical model with observed glacier geometry to conclude that early-stage collapse of the Amundsen Sea sector had begun and that eventual collapse was likely irreversible. Alongside Rignot et al.'s companion observational study, it vindicated Mercer's marine-ice-sheet-instability mechanism, moving the once-fringe warning to mainstream scientific acceptance.",
        source: {
          externalId: 'src:joughin-thwaites-collapse-science-2014',
          name: 'Joughin I, Smith BE, Medley B. Marine ice sheet collapse potentially under way for the Thwaites Glacier Basin, West Antarctica. Science. 2014;344(6185):735–738.',
          url: 'https://www.science.org/doi/10.1126/science.1249055',
          publishedAt: '2014-05-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 16. Caldeira & Wickett — ocean acidification coined — 2003 ──────────────
  {
    externalId: 'trajectory:ocean-acidification-caldeira-wickett-2003',
    text: "Ken Caldeira and Michael Wickett reported in Nature on 25 September 2003 that ocean absorption of fossil-fuel CO₂ would drive a surface-seawater pH decline larger and faster than any in the past 300 million years, coining the modern framing of 'ocean acidification.'",
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2003-09-25',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2003-09-25',
        datePrecision: 'DAY',
        reason: "Caldeira and Wickett published the brief communication 'Anthropogenic carbon and ocean pH' in Nature (425:365), using an ocean carbon-cycle model to show that continued fossil-fuel CO₂ uptake could lower surface ocean pH by ~0.5 units by 2100 — a rate of chemical change unprecedented over hundreds of millennia and exceeding anything in the geological record short of bolide impacts. The paper crystallized ocean acidification as a distinct anthropogenic threat separate from warming.",
        source: {
          externalId: 'src:caldeira-wickett-ocean-ph-nature-2003',
          name: 'Caldeira K, Wickett ME. Anthropogenic carbon and ocean pH. Nature. 2003;425(6956):365.',
          url: 'https://www.nature.com/articles/425365a',
          publishedAt: '2003-09-25',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2005-06-30',
        datePrecision: 'DAY',
        reason: "The Royal Society published the policy document 'Ocean acidification due to increasing atmospheric carbon dioxide' (Policy Document 12/05) on 30 June 2005, the first major national-academy assessment to adopt the term and conclude that oceans had already fallen ~0.1 pH units and faced irreversible damage absent CO₂ cuts. A learned-society consensus assessment co-authored by Caldeira and leading marine scientists, it moved the 2003 finding from a single model result to institutionally endorsed science.",
        source: {
          externalId: 'src:royal-society-ocean-acidification-2005',
          name: 'Royal Society. Ocean acidification due to increasing atmospheric carbon dioxide. Policy Document 12/05. 30 June 2005.',
          url: 'https://royalsociety.org/-/media/policy/publications/2005/9634.pdf',
          publishedAt: '2005-06-30',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 17. Stroeve — Arctic sea ice faster than forecast — 2007 ────────────────
  {
    externalId: 'trajectory:arctic-sea-ice-faster-than-forecast-2007',
    text: 'Julienne Stroeve and colleagues reported in Geophysical Research Letters on 1 May 2007 that observed September Arctic sea-ice decline was outpacing the projections of nearly all IPCC AR4 climate models, establishing that real-world Arctic ice loss was faster than forecast.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2007-05-01',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2007-05-01',
        datePrecision: 'DAY',
        reason: "Stroeve, Holland, Meier, Scambos, and Serreze published 'Arctic sea ice decline: Faster than forecast' in GRL (34:L09501), comparing the 1953–2006 observed September ice-extent trend against the IPCC AR4 multi-model ensemble and finding that none or very few model runs declined as fast as observations. The result documented that models were under-predicting the pace of Arctic ice loss — a claim that reframed the Arctic as warming faster than expected.",
        source: {
          externalId: 'src:stroeve-arctic-faster-grl-2007',
          name: 'Stroeve J, Holland MM, Meier W, Scambos T, Serreze M. Arctic sea ice decline: Faster than forecast. Geophysical Research Letters. 2007;34:L09501.',
          url: 'https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2007GL029703',
          publishedAt: '2007-05-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2012-09-19',
        datePrecision: 'DAY',
        reason: "On 19 September 2012 the U.S. National Snow and Ice Data Center announced that Arctic sea ice had reached a record seasonal minimum of 3.41 million km², shattering the prior 2007 record by 760,000 km² and confirming the accelerated downward trend Stroeve had flagged. The authoritative cryosphere monitoring body's record-low declaration moved the 'faster than forecast' finding from a single study to the established institutional baseline for Arctic change.",
        source: {
          externalId: 'src:nsidc-arctic-record-minimum-2012',
          name: 'National Snow and Ice Data Center. Arctic sea ice extent settles at record seasonal minimum. 19 September 2012.',
          url: 'https://nsidc.org/sea-ice-today/analyses/arctic-sea-ice-extent-settles-record-seasonal-minimum',
          publishedAt: '2012-09-19',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 18. Hoegh-Guldberg — coral bleaching projection — 1999 ──────────────────
  {
    externalId: 'trajectory:hoegh-guldberg-coral-bleaching-projection-1999',
    text: 'Ove Hoegh-Guldberg projected in Marine and Freshwater Research in 1999 that rising sea-surface temperatures would make mass coral bleaching an annual-to-frequent event within decades, threatening the survival of the world\'s coral reefs.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1999-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1999-01-01',
        datePrecision: 'YEAR',
        reason: "Hoegh-Guldberg published 'Climate change, coral bleaching and the future of the world's coral reefs' in Marine and Freshwater Research (50:839–866), synthesizing the thermal-tolerance physiology of corals and their zooxanthellae with SST projections to forecast that bleaching events would become near-annual in many regions within 30–50 years. The projection was influential but criticized by some reef scientists as overly pessimistic, leaving it contested for over a decade.",
        source: {
          externalId: 'src:hoegh-guldberg-coral-bleaching-mfr-1999',
          name: 'Hoegh-Guldberg O. Climate change, coral bleaching and the future of the world\'s coral reefs. Marine and Freshwater Research. 1999;50(8):839–866.',
          url: 'https://www.publish.csiro.au/mf/mf99078',
          publishedAt: '1999-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-03-16',
        datePrecision: 'DAY',
        reason: "Hughes and colleagues published 'Global warming and recurrent mass bleaching of corals' in Nature (543:373–377) on 16 March 2017, documenting the record 2015–2016 pan-tropical bleaching — the third global event — and showing that past bleaching and local protection afforded little resistance to extreme heat. The empirical record of recurrent, temperature-driven mass bleaching on the Great Barrier Reef vindicated Hoegh-Guldberg's once-contested projection, settling it as observed reality.",
        source: {
          externalId: 'src:hughes-recurrent-bleaching-nature-2017',
          name: 'Hughes TP, et al. Global warming and recurrent mass bleaching of corals. Nature. 2017;543(7645):373–377.',
          url: 'https://www.nature.com/articles/nature21707',
          publishedAt: '2017-03-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 19. Dobson — atmospheric ozone spectrophotometry — 1926 ────────────────
  {
    externalId: 'trajectory:dobson-ozone-spectrophotometry-1926',
    text: 'G. M. B. Dobson and D. N. Harrison reported in 1926, in the Proceedings of the Royal Society A, the first systematic spectrophotometric measurements of the atmospheric ozone column, showing that total ozone varies markedly day-to-day, seasonally, and with latitude.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1926-01-14',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1926-01-14',
        datePrecision: 'MONTH',
        reason: 'Dobson and Harrison published \'Measurements of the amount of ozone in the earth\'s atmosphere and its relation to other geophysical conditions\' (Proc. R. Soc. A 110:660–693), reporting results from a custom spectrophotometer operated at Oxford since 1924. They demonstrated that total-column ozone was measurable from the ground and fluctuated far more than previously supposed, establishing the empirical baseline against which all later ozone depletion would be detected.',
        source: {
          externalId: 'src:dobson-harrison-rspa-1926',
          name: 'Dobson GMB, Harrison DN. Measurements of the amount of ozone in the earth\'s atmosphere and its relation to other geophysical conditions. Proceedings of the Royal Society A. 1926;110(756):660–693.',
          url: 'https://royalsocietypublishing.org/doi/10.1098/rspa.1926.0040',
          publishedAt: '1926-04-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1957-07-01',
        datePrecision: 'YEAR',
        reason: 'During the International Geophysical Year (1957–58), Dobson\'s instrument design and calibration were adopted as the world standard and a coordinated global ozone-monitoring network (later the WMO Global Ozone Observing System) was established, with the total-ozone unit named the \'Dobson Unit\' in his honour. Systematic spectrophotometric measurement of the ozone column became the institutionalized standard, creating the continuous record (including the Halley Bay series) that made the 1985 ozone hole detectable.',
        source: {
          externalId: 'src:dobson-forty-years-applied-optics-1968',
          name: 'Dobson GMB. Forty years\' research on atmospheric ozone at Oxford: a history. Applied Optics. 1968;7(3):387–405.',
          url: 'https://opg.optica.org/ao/abstract.cfm?uri=ao-7-3-387',
          publishedAt: '1968-03-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 20. Stolarski & Cicerone — chlorine as catalytic ozone sink — 1974 ──────
  {
    externalId: 'trajectory:stolarski-cicerone-chlorine-ozone-sink-1974',
    text: 'Richard Stolarski and Ralph Cicerone proposed in April 1974, in the Canadian Journal of Chemistry, that chlorine atoms could act as an efficient catalytic sink destroying stratospheric ozone (the ClOx cycle), independently of any specific chlorine source.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1974-04-15',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1974-04-15',
        datePrecision: 'MONTH',
        reason: 'Stolarski and Cicerone published \'Stratospheric Chlorine: a Possible Sink for Ozone\' (Can. J. Chem. 52(8):1610–1615), devising a photochemical scheme in which ClOx catalytic cycles destroy odd oxygen far more efficiently per atom than the NOx cycles already known. This was the first identification of chlorine as a potent catalytic ozone sink — published months before Molina and Rowland linked that mechanism specifically to chlorofluorocarbons.',
        source: {
          externalId: 'src:stolarski-cicerone-cjc-1974',
          name: 'Stolarski RS, Cicerone RJ. Stratospheric chlorine: a possible sink for ozone. Canadian Journal of Chemistry. 1974;52(8):1610–1615.',
          url: 'https://cdnsciencepub.com/doi/10.1139/v74-233',
          publishedAt: '1974-04-15',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1987-09-22',
        datePrecision: 'MONTH',
        reason: 'In-situ ER-2 aircraft flights during the Airborne Antarctic Ozone Experiment (August–September 1987) measured a sharp inverse correlation between chlorine monoxide (ClO) and ozone inside the Antarctic vortex, demonstrating that halogen-catalyzed recombination was destroying ozone in real time. This \'smoking gun\' confirmed the chlorine catalytic-sink mechanism proposed in 1974 and settled chlorine catalysis as established stratospheric chemistry (later ratified by the 1995 Nobel Prize in Chemistry).',
        source: {
          externalId: 'src:anderson-clo-ozone-jgr-1989',
          name: 'Anderson JG, Brune WH, Proffitt MH. Ozone destruction by chlorine radicals within the Antarctic vortex: the spatial and temporal evolution of ClO–O3 anticorrelation based on in situ ER-2 data. Journal of Geophysical Research. 1989;94(D9):11465–11479.',
          url: 'https://ntrs.nasa.gov/citations/19890066536',
          publishedAt: '1989-08-30',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 21. Solomon — PSC heterogeneous chemistry & Antarctic ozone — 1986 ──────
  {
    externalId: 'trajectory:solomon-psc-antarctic-ozone-1986',
    text: 'Susan Solomon, Rolando Garcia, F. Sherwood Rowland, and Donald Wuebbles proposed in June 1986, in Nature, that heterogeneous reactions on polar stratospheric cloud surfaces (HCl + ClONO2) drive the springtime Antarctic ozone hole, explaining why the depletion is unique to Antarctica.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1986-06-19',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1986-06-19',
        datePrecision: 'MONTH',
        reason: 'Solomon, Garcia, Rowland, and Wuebbles published \'On the depletion of Antarctic ozone\' (Nature 321:755–758), showing that homogeneous gas-phase chemistry as then understood could not explain the observed springtime losses, and proposing that the high frequency of polar stratospheric clouds over Antarctica provides reaction surfaces for heterogeneous HCl + ClONO2 chemistry that liberates ozone-destroying chlorine. This supplied the mechanism explaining the geographic specificity of the Farman ozone hole.',
        source: {
          externalId: 'src:solomon-antarctic-ozone-nature-1986',
          name: 'Solomon S, Garcia RR, Rowland FS, Wuebbles DJ. On the depletion of Antarctic ozone. Nature. 1986;321(6072):755–758.',
          url: 'https://www.nature.com/articles/321755a0',
          publishedAt: '1986-06-19',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1987-09-22',
        datePrecision: 'MONTH',
        reason: 'The Airborne Antarctic Ozone Experiment (August–October 1987) measured greatly elevated ClO and a ClO–ozone anticorrelation inside the vortex, and subsequent laboratory studies confirmed that the HCl + ClONO2 reaction proceeds rapidly on polar stratospheric cloud surfaces. The heterogeneous-chemistry mechanism Solomon proposed became the accepted explanation for Antarctic ozone loss, displacing competing dynamical and solar-cycle hypotheses.',
        source: {
          externalId: 'src:noaa-aaoe-overview-1987',
          name: 'NOAA Chemical Sciences Laboratory. The Airborne Antarctic Ozone Experiment (AAOE) — Research Overview (ER-2/DC-8 mission, Punta Arenas, 1987).',
          url: 'https://csl.noaa.gov/projects/aaoe/overview.html',
          publishedAt: '1987-10-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 22. US EPA/FDA/CPSC — CFC aerosol ban — 1978 ────────────────────────────
  {
    externalId: 'trajectory:epa-cfc-aerosol-ban-1978',
    text: 'On 17 March 1978 the US FDA, EPA, and CPSC issued federal rules banning chlorofluorocarbons as propellants in non-essential aerosol products, the first major national regulatory action treating CFC-driven ozone depletion as established enough to compel a ban.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1978-03-17',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1977-05-11',
        datePrecision: 'MONTH',
        reason: 'Acting on the Molina–Rowland chlorine-ozone hypothesis, the Consumer Product Safety Commission, FDA, and EPA jointly announced in 1977 a phaseout of \'non-essential\' chlorofluorocarbon uses in spray products. This was a precautionary regulatory commitment adopted nearly a decade before international consensus and before the ozone hole was discovered.',
        source: {
          externalId: 'src:cpsc-fda-epa-cfc-phaseout-1977',
          name: 'U.S. Consumer Product Safety Commission. CPSC/FDA/EPA Announce Phase Out of Chlorofluorocarbons. News release, 1977.',
          url: 'https://www.cpsc.gov/Newsroom/News-Releases/1977/CPSCFDAEPA-Announce-Phase-Out-Of-Chlorofluorocarbons',
          publishedAt: '1977-05-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1978-10-15',
        datePrecision: 'DAY',
        reason: 'The federal rule issued 17 March 1978 (43 FR 11301) took binding effect on 15 October 1978, when manufacturers could no longer produce CFCs for most aerosol uses; manufacturing of CFC spray products ended 15 December 1978 and interstate shipment ended 15 April 1979. The United States thereby made ozone-protective CFC restriction enforceable national law years ahead of the 1985 Vienna Convention and 1987 Montreal Protocol.',
        source: {
          externalId: 'src:epa-cfc-aerosol-ban-1978',
          name: 'U.S. EPA. Government Ban on Fluorocarbon Gases in Aerosol Products Begins October 15 [1978]. EPA press release (FDA/EPA/CPSC rule, 43 FR 11301, 17 March 1978).',
          url: 'https://www.epa.gov/archive/epa/aboutepa/government-ban-fluorocarbon-gases-aerosol-products-begins-october-15-1978.html',
          publishedAt: '1978-10-15',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 23. Nerem — sea-level rise acceleration detected — 2018 ─────────────────
  {
    externalId: 'trajectory:nerem-sea-level-acceleration-detected-2018',
    text: 'R. Steven Nerem and colleagues reported in PNAS on 12 February 2018 that 25 years of satellite altimetry revealed a statistically significant climate-change-driven acceleration of global mean sea-level rise of 0.084 mm/yr², the first detection of acceleration in the precise altimeter record.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2018-02-12',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2018-02-12',
        datePrecision: 'DAY',
        reason: "Nerem, Beckley, Fasullo, Hamlington, Masters, and Mitchum published 'Climate-change–driven accelerated sea-level rise detected in the altimeter era' in PNAS (115(9):2022–2025), using TOPEX/Poseidon and the Jason series and correcting for volcanic and ENSO variability to isolate an acceleration of 0.084 ± 0.025 mm/yr², implying ~65 cm of rise by 2100. It was the first detection of the long-predicted acceleration within the high-precision satellite record.",
        source: {
          externalId: 'src:nerem-sea-level-acceleration-pnas-2018',
          name: 'Nerem RS, Beckley BD, Fasullo JT, Hamlington BD, Masters D, Mitchum GT. Climate-change–driven accelerated sea-level rise detected in the altimeter era. PNAS. 2018;115(9):2022–2025.',
          url: 'https://www.pnas.org/doi/10.1073/pnas.1717312115',
          publishedAt: '2018-02-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2019-09-25',
        datePrecision: 'DAY',
        reason: 'The IPCC Special Report on the Ocean and Cryosphere in a Changing Climate (SROCC), approved at IPCC-51 in Monaco and released on 25 September 2019, concluded with high confidence that the previously predicted acceleration of sea-level rise is now observed, citing a 2006–2015 rate of 3.6 mm/yr unprecedented over the prior century. The intergovernmental assessment elevated the altimeter-era detection from a single study to settled institutional consensus.',
        source: {
          externalId: 'src:ipcc-srocc-sea-level-2019',
          name: 'IPCC. Special Report on the Ocean and Cryosphere in a Changing Climate (SROCC), Summary for Policymakers. 25 September 2019.',
          url: 'https://www.ipcc.ch/srocc/',
          publishedAt: '2019-09-25',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 24. Hays, Imbrie & Shackleton — orbital pacing of ice ages — 1976 ───────
  {
    externalId: 'trajectory:hays-imbrie-shackleton-pacemaker-ice-ages-1976',
    text: 'James Hays, John Imbrie, and Nicholas Shackleton reported in Science on 10 December 1976 that oxygen-isotope and microfossil records from Southern Ocean deep-sea sediment cores show climatic variance concentrated at the ~23,000-, ~42,000-, and ~100,000-year periods of Earth\'s orbital cycles, establishing orbital variation as the \'pacemaker\' of the Pleistocene ice ages.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1976-12-10',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1976-12-10',
        datePrecision: 'DAY',
        reason: 'Hays, Imbrie, and Shackleton published \'Variations in the Earth\'s Orbit: Pacemaker of the Ice Ages\' in Science (194:1121–1132), using two Indian Ocean cores (RC11-120, E49-18) to extract a 450,000-year record of δ¹⁸O, radiolarian assemblages, and sea-surface temperature. Spectral analysis showed climate variance concentrated at the precession (~23 kyr), obliquity (~42 kyr), and eccentricity (~100 kyr) frequencies predicted by Milankovitch, converting a long-contested astronomical theory into a quantitatively testable, data-grounded claim about the ocean-ice system\'s response to orbital forcing.',
        source: {
          externalId: 'src:hays-imbrie-shackleton-pacemaker-science-1976',
          name: 'Hays JD, Imbrie J, Shackleton NJ. Variations in the Earth\'s orbit: pacemaker of the ice ages. Science. 1976;194(4270):1121–1132.',
          url: 'https://www.science.org/doi/10.1126/science.194.4270.1121',
          publishedAt: '1976-12-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1984-01-01',
        datePrecision: 'YEAR',
        reason: 'The SPECMAP project\'s Imbrie et al. (1984) study, \'The orbital theory of Pleistocene climate: support from a revised chronology of the marine δ¹⁸O record,\' stacked five planktonic-foraminifer isotope records and orbitally tuned them, demonstrating that the amplitude and phase of the marine ice-volume signal track orbital insolation across the late Pleistocene. By independently corroborating the 1976 spectral result with a global stacked chronology, it moved orbital pacing of the ice ages from a striking single-core finding to the accepted foundation of Quaternary climate chronology.',
        source: {
          externalId: 'src:imbrie-specmap-orbital-theory-1984',
          name: 'Imbrie J, Hays JD, Martinson DG, et al. The orbital theory of Pleistocene climate: support from a revised chronology of the marine δ¹⁸O record. In: Berger A, et al., eds. Milankovitch and Climate, Part 1. Dordrecht: D. Reidel; 1984:269–305.',
          url: 'https://epic.awi.de/41839/1/Imbrie-etal_1984.pdf',
          publishedAt: '1984-01-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 25. Manabe & Wetherald — climate sensitivity radiative-convective model — 1967 ─
  {
    externalId: 'trajectory:manabe-wetherald-climate-sensitivity-1967',
    text: 'Syukuro Manabe and Richard Wetherald reported in May 1967, in the Journal of the Atmospheric Sciences, the first physically realistic radiative-convective model calculation showing that doubling atmospheric CO₂ would warm Earth\'s surface by about 2.4°C while cooling the stratosphere, with water-vapor feedback roughly doubling the sensitivity.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1967-05-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1967-05-01',
        datePrecision: 'MONTH',
        reason: 'Manabe and Wetherald published \'Thermal Equilibrium of the Atmosphere with a Given Distribution of Relative Humidity\' in the Journal of the Atmospheric Sciences (24(3):241–259). Their one-dimensional radiative-convective model held relative humidity (rather than absolute humidity) fixed, correctly captured CO₂, ozone, and water-vapor spectroscopy plus convective adjustment, and found ~2.36°C surface warming for doubled CO₂ with stratospheric cooling. It was the first calculation to treat the key physical feedbacks credibly, transforming Arrhenius-era estimates into a modern, mechanistic climate-sensitivity result.',
        source: {
          externalId: 'src:manabe-wetherald-jas-1967',
          name: 'Manabe S, Wetherald RT. Thermal equilibrium of the atmosphere with a given distribution of relative humidity. Journal of the Atmospheric Sciences. 1967;24(3):241–259.',
          url: 'https://journals.ametsoc.org/view/journals/atsc/24/3/1520-0469_1967_024_0241_teotaw_2_0_co_2.xml',
          publishedAt: '1967-05-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1979-07-01',
        datePrecision: 'MONTH',
        reason: 'The U.S. National Academy of Sciences \'Charney Report\' (Carbon Dioxide and Climate: A Scientific Assessment, 1979) evaluated the leading general-circulation models — including Manabe\'s — and concluded that doubling CO₂ would most probably warm the globe by 1.5–4.5°C. By adopting a formal climate-sensitivity range anchored on the radiative-convective and GCM approach Manabe and Wetherald pioneered, the assessment institutionally settled their result as the basis of climate projection.',
        source: {
          externalId: 'src:charney-report-1979',
          name: 'Charney JG et al. Carbon Dioxide and Climate: A Scientific Assessment. National Academy of Sciences. 1979.',
          url: 'https://nap.nationalacademies.org/catalog/12181/carbon-dioxide-and-climate-a-scientific-assessment',
          publishedAt: '1979-07-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 26. Likens & Bormann — acid rain as North American regional problem — 1974 ──
  {
    externalId: 'trajectory:likens-bormann-acid-rain-1974',
    text: 'Gene Likens and F. Herbert Bormann reported in Science on 14 June 1974 that precipitation across the northeastern United States had become strongly acidic (averaging about pH 4, with individual storms as low as pH 2.1), establishing acid rain as a serious regional environmental problem in North America.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1974-06-14',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1974-06-14',
        datePrecision: 'DAY',
        reason: 'Likens and Bormann published \'Acid Rain: A Serious Regional Environmental Problem\' in Science (184(4142):1176–1179), drawing on Hubbard Brook Experimental Forest precipitation chemistry to show that rain and snow over most of the northeastern U.S. averaged near pH 4 and had apparently acidified over the prior two decades, plausibly linked to fossil-fuel SO₂ and NOx emissions dispersed by tall stacks. It brought European acid-deposition findings to North America and framed acid rain as a measurable, large-scale regional phenomenon.',
        source: {
          externalId: 'src:likens-bormann-acid-rain-science-1974',
          name: 'Likens GE, Bormann FH. Acid rain: a serious regional environmental problem. Science. 1974;184(4142):1176–1179.',
          url: 'https://www.science.org/doi/10.1126/science.184.4142.1176',
          publishedAt: '1974-06-14',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1990-11-15',
        datePrecision: 'DAY',
        reason: 'Title IV of the Clean Air Act Amendments of 1990, signed 15 November 1990, created the Acid Rain Program — the world\'s first large-scale pollutant cap-and-trade system — mandating a 10-million-ton cut in annual SO₂ emissions below 1980 levels from fossil-fuel power plants. Federal statutory action accepting acid deposition as a causally established, regulable harm institutionally settled the Likens–Bormann finding, sixteen years after its publication.',
        source: {
          externalId: 'src:caaa-1990-title-iv-acid-rain',
          name: 'U.S. EPA. 1990 Clean Air Act Amendment Summary: Title IV (Acid Deposition Control / Acid Rain Program).',
          url: 'https://www.epa.gov/clean-air-act-overview/1990-clean-air-act-amendment-summary-title-iv',
          publishedAt: '1990-11-15',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 27. Hansen Senate greenhouse testimony — 1988 ────────────────────────────
  {
    externalId: 'trajectory:hansen-senate-greenhouse-testimony-1988',
    text: 'On 23 June 1988 NASA scientist James Hansen testified to the U.S. Senate Committee on Energy and Natural Resources that global warming had reached a level where its cause-and-effect link to the greenhouse effect could be ascribed with about 99% confidence, declaring that \'the greenhouse effect has been detected and it is changing our climate now.\'',
    claimType: 'HYBRID',
    claimEmergedAt: '1988-06-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'PUBLIC',
        occurredAt: '1988-06-23',
        datePrecision: 'DAY',
        reason: 'At a hearing organized by Senator Tim Wirth, Hansen, director of the NASA Goddard Institute for Space Studies, testified that 1988 was the warmest year in the instrumental record, that there was a ~99% probability the warming was anthropogenic rather than natural variability, and that greenhouse warming was already detectable. Front-page coverage (notably the New York Times) carried the detection claim from expert literature into the public and policy record, making it the canonical moment global warming entered mainstream U.S. political consciousness.',
        source: {
          externalId: 'src:hansen-senate-testimony-1988',
          name: 'Statement of Dr. James Hansen, Director, NASA GISS. Greenhouse Effect and Global Climate Change: Hearings Before the Committee on Energy and Natural Resources, U.S. Senate, 100th Cong. (June 23, 1988). S. HRG. 100-461.',
          url: 'https://www.sealevel.info/1988_Hansen_Senate_Testimony.html',
          publishedAt: '1988-06-23',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1995-12-01',
        datePrecision: 'MONTH',
        reason: 'The IPCC Second Assessment Report, finalized at the Madrid plenary in late 1995, concluded that \'the balance of evidence suggests a discernible human influence on global climate\' — the first intergovernmental endorsement of detected anthropogenic warming, supported by climate-fingerprinting studies. Reversing the 1990 First Assessment Report\'s judgment that detection was \'not likely for a decade or more,\' it institutionally settled the detection claim Hansen had asserted in 1988.',
        source: {
          externalId: 'src:ipcc-sar-discernible-human-influence-1995',
          name: 'IPCC. Climate Change 1995: The Science of Climate Change (Second Assessment Report, WGI Summary for Policymakers). 1995.',
          url: 'https://archive.ipcc.ch/pdf/climate-changes-1995/ipcc-2nd-assessment/2nd-assessment-en.pdf',
          publishedAt: '1995-12-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 29. Molina & Rowland — CFC-to-ozone-destruction hypothesis — 1974 ────────
  {
    externalId: 'trajectory:molina-rowland-cfc-ozone-1974',
    text: 'Mario Molina and F. Sherwood Rowland reported on 28 June 1974, in Nature, that chlorofluoromethanes (CFCs) drifting into the stratosphere would be photodissociated by ultraviolet light, releasing chlorine atoms that catalytically destroy ozone, predicting significant depletion of the ozone layer from continued CFC release.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1974-06-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1974-06-28',
        datePrecision: 'DAY',
        reason: 'Molina and Rowland published \'Stratospheric sink for chlorofluoromethanes: chlorine atom-catalysed destruction of ozone\' in Nature (249:810–812). They showed that inert CFCs accumulate in the atmosphere for 40–150 years, eventually reach the stratosphere, and there release chlorine atoms that catalytically destroy ozone. This was the first identification of CFCs specifically as the source feeding chlorine catalysis, transforming the abstract chlorine-sink chemistry into a concrete, policy-relevant threat tied to a named industrial product.',
        source: {
          externalId: 'src:molina-rowland-nature-1974',
          name: 'Molina MJ, Rowland FS. Stratospheric sink for chlorofluoromethanes: chlorine atom-catalysed destruction of ozone. Nature. 1974;249(5460):810–812.',
          url: 'https://www.nature.com/articles/249810a0',
          publishedAt: '1974-06-28',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1995-10-11',
        datePrecision: 'DAY',
        reason: 'The Royal Swedish Academy of Sciences awarded the 1995 Nobel Prize in Chemistry to Crutzen, Molina, and Rowland \'for their work in atmospheric chemistry, particularly concerning the formation and decomposition of ozone.\' Following the 1985 ozone hole, the 1986 Solomon heterogeneous-chemistry mechanism, and direct in-situ ClO–ozone measurements, the Nobel ratified the Molina–Rowland CFC-to-ozone-destruction hypothesis as settled science.',
        source: {
          externalId: 'src:nobel-chemistry-1995-ozone',
          name: 'The Nobel Prize in Chemistry 1995: Paul J. Crutzen, Mario J. Molina, F. Sherwood Rowland. Royal Swedish Academy of Sciences. 11 October 1995.',
          url: 'https://www.nobelprize.org/prizes/chemistry/1995/summary/',
          publishedAt: '1995-10-11',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 30. Lovelock — CFC global atmospheric detection — 1973 ──────────────────
  {
    externalId: 'trajectory:lovelock-cfc-global-detection-1973',
    text: 'James Lovelock, Robert Maggs, and Robert Wade reported in January 1973, in Nature, that chlorofluorocarbons (CCl₃F and CCl₂F₂) were detectable by electron-capture gas chromatography in air over the Atlantic far from any source, establishing that these inert industrial gases were accumulating and globally distributed throughout the atmosphere.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1973-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1973-01',
        datePrecision: 'MONTH',
        reason: 'Lovelock, Maggs, and Wade published \'Halogenated Hydrocarbons in and over the Atlantic\' in Nature (241:194–196), reporting electron-capture detector measurements of CFC-11 and CFC-12 in remote marine air during an Atlantic cruise on RRS Shackleton. The finding that chemically inert CFCs were measurable everywhere — even far from industrial sources — empirically established their atmospheric persistence and global accumulation, the observational premise that Molina and Rowland built their depletion theory on the following year.',
        source: {
          externalId: 'src:lovelock-maggs-wade-nature-1973',
          name: 'Lovelock JE, Maggs RJ, Wade RJ. Halogenated Hydrocarbons in and over the Atlantic. Nature. 1973;241(5386):194–196.',
          url: 'https://www.nature.com/articles/241194a0',
          publishedAt: '1973-01-19',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1978',
        datePrecision: 'YEAR',
        reason: 'The global accumulation of CFCs that Lovelock first detected became the foundation of permanent institutional monitoring: NOAA\'s Halocarbons program (begun 1977–78, now LOGOS/HATS) and the ALE/GAGE/AGAGE network established continuous, calibrated global measurement of CFC abundances. The atmospheric persistence and steadily rising global background of CFCs is now a routinely tracked, settled empirical fact underpinning Montreal Protocol compliance assessments.',
        source: {
          externalId: 'src:noaa-gml-halocarbons',
          name: 'NOAA Global Monitoring Laboratory. Halocarbons and other Atmospheric Trace Species (HATS/LOGOS) — global flask and in-situ monitoring of CFCs and ozone-depleting substances.',
          url: 'https://gml.noaa.gov/hats/',
          publishedAt: '2024-01-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 31. Stolarski et al. — Nimbus-7 satellite ozone-hole confirmation — 1986 ─
  {
    externalId: 'trajectory:stolarski-nimbus7-ozone-hole-confirmation-1986',
    text: 'Richard Stolarski, Arlin Krueger, and colleagues reported in August 1986, in Nature, that reprocessed Nimbus-7 satellite TOMS and SBUV measurements independently confirmed the springtime Antarctic ozone decline reported by Farman and showed the depletion to be a large, continent-scale regional phenomenon.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1986-08',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1986-08',
        datePrecision: 'MONTH',
        reason: 'Stolarski, Krueger, Schoeberl, McPeters, Newman, and Alpert published \'Nimbus 7 satellite measurements of the springtime Antarctic ozone decrease\' in Nature (322:808–811). After NASA\'s automated algorithm had originally flagged the record-low Antarctic values as erroneous and discarded them, the data were reprocessed and confirmed the Halley Bay ground-based decline, mapping the depletion\'s full spatial extent across the Antarctic continent. This satellite confirmation removed doubt that the Farman result was a local instrument artifact.',
        source: {
          externalId: 'src:stolarski-nimbus7-nature-1986',
          name: 'Stolarski RS, Krueger AJ, Schoeberl MR, McPeters RD, Newman PA, Alpert JC. Nimbus 7 satellite measurements of the springtime Antarctic ozone decrease. Nature. 1986;322(6082):808–811.',
          url: 'https://www.nature.com/articles/322808a0',
          publishedAt: '1986-08-28',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1987-09-16',
        datePrecision: 'DAY',
        reason: 'Ground-based (Farman), satellite (Nimbus-7 TOMS/SBUV), and in-situ aircraft (Airborne Antarctic Ozone Experiment, 1987) measurements converged on a confirmed, large-scale Antarctic ozone hole. This multi-platform observational consensus underpinned the signing of the Montreal Protocol on 16 September 1987, institutionally settling the reality and severity of Antarctic ozone depletion as the basis for binding international controls.',
        source: {
          externalId: 'src:montreal-protocol-unep-1987',
          name: 'United Nations Environment Programme. Montreal Protocol on Substances that Deplete the Ozone Layer. Adopted 16 September 1987.',
          url: 'https://ozone.unep.org/treaties/montreal-protocol',
          publishedAt: '1987-09-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 32. London Amendment to the Montreal Protocol — 1990 ────────────────────
  {
    externalId: 'trajectory:london-amendment-montreal-protocol-1990',
    text: 'On 29 June 1990 the parties to the Montreal Protocol adopted the London Amendment, accelerating ozone-depleting-substance controls by mandating a total phaseout of all CFCs, halons, carbon tetrachloride and methyl chloroform, and establishing the Multilateral Fund to finance compliance by developing countries.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1990-06-29',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1990-06-29',
        datePrecision: 'DAY',
        reason: 'At the Second Meeting of the Parties in London (27–29 June 1990), governments adopted the first amendment to the Montreal Protocol, replacing the original partial CFC cuts with a complete phaseout of all fully halogenated CFCs, halons, carbon tetrachloride, and methyl chloroform (new Annex B), and creating the Multilateral Fund to cover the incremental costs of developing-country compliance. The amendment marked the shift from the 1987 Protocol\'s modest reductions to total elimination, responding to the strengthened ozone-hole evidence.',
        source: {
          externalId: 'src:london-amendment-unep-1990',
          name: 'United Nations Environment Programme, Ozone Secretariat. The London Amendment (1990): the amendment to the Montreal Protocol agreed by the Second Meeting of the Parties (London, 27–29 June 1990).',
          url: 'https://ozone.unep.org/treaties/montreal-protocol/amendments/london-amendment-1990-amendment-montreal-protocol-agreed',
          publishedAt: '1990-06-29',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1992-08-10',
        datePrecision: 'DAY',
        reason: 'The London Amendment entered into force on 10 August 1992 after the required ratifications, making the total-phaseout schedule and Multilateral Fund binding international law. Its near-universal ratification institutionally settled the strengthened control regime, and the Multilateral Fund went on to support more than 8,600 developing-country projects, cementing the amendment as a working pillar of the ozone treaty system.',
        source: {
          externalId: 'src:london-amendment-eif-unep',
          name: 'UNEP Ozone Secretariat. London Amendment to the Montreal Protocol — entry into force 10 August 1992; Multilateral Fund established.',
          url: 'https://ozone.unep.org/treaties/montreal-protocol/amendments/london-amendment-1990-amendment-montreal-protocol-agreed',
          publishedAt: '1992-08-10',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 33. Stott, Stone & Allen — European heatwave attribution — 2004 ──────────
  {
    externalId: 'trajectory:stott-european-heatwave-attribution-2004',
    text: 'Peter Stott, Dáithí Stone, and Myles Allen reported in Nature on 2 December 2004 that human influence had at least doubled the risk of the extreme 2003 European summer heatwave, the first formal probabilistic attribution of an individual extreme weather event to anthropogenic climate change.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2004-12-02',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2004-12-02',
        datePrecision: 'DAY',
        reason: 'Stott, Stone, and Allen published \'Human contribution to the European heatwave of 2003\' in Nature (432:610–614), using a coupled climate model to estimate the fraction of attributable risk and concluding it was very likely (>90% confidence) that human influence had at least doubled the risk of a summer as hot as 2003. This was the founding demonstration that the probability of a specific extreme event could be formally partitioned between natural variability and anthropogenic forcing, launching the field of extreme-event attribution.',
        source: {
          externalId: 'src:stott-heatwave-attribution-nature-2004',
          name: 'Stott PA, Stone DA, Allen MR. Human contribution to the European heatwave of 2003. Nature. 2004;432(7017):610–614.',
          url: 'https://doi.org/10.1038/nature03089',
          publishedAt: '2004-12-02',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-03-11',
        datePrecision: 'DAY',
        reason: 'The U.S. National Academies of Sciences, Engineering, and Medicine released \'Attribution of Extreme Weather Events in the Context of Climate Change\' on 11 March 2016, concluding that the science of event attribution had matured to the point where confident, quantitative statements about the human influence on many individual events — especially heat extremes — were scientifically defensible. The intergovernmental-caliber assessment validated the probabilistic method Stott pioneered, moving single-event attribution from a novel single result to an accepted discipline.',
        source: {
          externalId: 'src:nas-extreme-event-attribution-2016',
          name: 'National Academies of Sciences, Engineering, and Medicine. Attribution of Extreme Weather Events in the Context of Climate Change. Washington, DC: The National Academies Press. March 11, 2016.',
          url: 'https://nap.nationalacademies.org/catalog/21852/attribution-of-extreme-weather-events-in-the-context-of-climate-change',
          publishedAt: '2016-03-11',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 34. Emanuel — hurricane intensity and climate change — 1987 ───────────────
  {
    externalId: 'trajectory:emanuel-hurricane-intensity-climate-1987',
    text: 'Kerry Emanuel reported in Nature on 2 April 1987 that a Carnot-cycle model of tropical cyclones predicts hurricane maximum potential intensity will rise with greenhouse warming, estimating a 40–50% increase in destructive potential for a doubling of atmospheric CO₂ — the first physically-grounded prediction of hurricane intensification under climate change.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1987-04-02',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1987-04-02',
        datePrecision: 'DAY',
        reason: 'Emanuel published \'The dependence of hurricane intensity on climate\' in Nature (326:483–485), applying a thermodynamic (Carnot-engine) theory of tropical cyclone maximum potential intensity to GCM-projected doubled-CO₂ sea-surface temperatures and deriving a 40–50% increase in the destructive potential of hurricanes. It was the first mechanistic claim that a warming climate would produce measurably more intense tropical cyclones, converting a qualitative expectation into a quantitative, testable prediction.',
        source: {
          externalId: 'src:emanuel-hurricane-intensity-nature-1987',
          name: 'Emanuel KA. The dependence of hurricane intensity on climate. Nature. 1987;326(6112):483–485.',
          url: 'https://doi.org/10.1038/326483a0',
          publishedAt: '1987-04-02',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2021-08-09',
        datePrecision: 'DAY',
        reason: 'The IPCC Sixth Assessment Report Working Group I, released 9 August 2021, concluded with high confidence that the proportion of intense (Category 3–5) tropical cyclones has increased over the past four decades and that peak tropical-cyclone intensities and heavy-rainfall rates will rise with further warming. The intergovernmental assessment endorsed the intensity–warming relationship Emanuel first derived in 1987, settling it as established climate science even as tropical-cyclone frequency remains uncertain.',
        source: {
          externalId: 'src:ipcc-ar6-wg1-2021',
          name: 'IPCC. Climate Change 2021: The Physical Science Basis (AR6 WGI), Summary for Policymakers and Ch. 11 (Weather and climate extreme events). August 9, 2021.',
          url: 'https://www.ipcc.ch/report/ar6/wg1/',
          publishedAt: '2021-08-09',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 35. Emanuel — tropical cyclone destructiveness — 2005 ────────────────────
  {
    externalId: 'trajectory:emanuel-tropical-cyclone-destructiveness-2005',
    text: 'Kerry Emanuel reported in Nature on 31 July 2005 that the observed power dissipation of tropical cyclones had nearly doubled over the previous ~30 years in the North Atlantic and western North Pacific, closely tracking rising tropical sea-surface temperatures, presenting this as observational evidence that hurricanes had already grown more destructive.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2005-07-31',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2005-07-31',
        datePrecision: 'DAY',
        reason: 'Emanuel published \'Increasing destructiveness of tropical cyclones over the past 30 years\' in Nature (436:686–688), introducing the Power Dissipation Index (PDI) and showing it had roughly doubled since the mid-1970s in step with tropical SST. Appearing weeks before Hurricane Katrina, it was the first claim that the intensification predicted from theory was already detectable in the historical record.',
        source: {
          externalId: 'src:emanuel-destructiveness-nature-2005',
          name: 'Emanuel K. Increasing destructiveness of tropical cyclones over the past 30 years. Nature. 2005;436(7051):686–688.',
          url: 'https://doi.org/10.1038/nature03906',
          publishedAt: '2005-07-31',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2005-12-22',
        datePrecision: 'DAY',
        reason: 'In a formal Brief Communications Arising in Nature (438:E11–E12) on 22 December 2005, Christopher Landsea argued that Emanuel\'s result was an artifact of the analysis: the smoothing was flawed, the Atlantic bias-removal correction was too aggressive, and a longer U.S. landfall record showed no comparable trend, with intensities as high in the mid-20th century. Together with Pielke\'s parallel critique, this launched a durable dispute over the homogeneity of the tropical-cyclone data and the magnitude of the observed trend that remains unresolved, even as the broader intensity–warming link firmed up.',
        source: {
          externalId: 'src:landsea-hurricanes-warming-nature-2005',
          name: 'Landsea CW. Hurricanes and global warming. Nature. 2005;438(7071):E11–E12.',
          url: 'https://doi.org/10.1038/nature04477',
          publishedAt: '2005-12-22',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 36. Kelley et al. — Syrian drought and climate change — 2015 ─────────────
  {
    externalId: 'trajectory:kelley-syrian-drought-climate-2015',
    text: 'Colin Kelley and colleagues reported in PNAS on 2 March 2015 that anthropogenic climate change had made the record 2007–2010 Fertile Crescent drought two-to-three times more likely and that this drought contributed to the unrest preceding the Syrian civil war, the most prominent claim linking a specific drought\'s human-driven severity to societal conflict.',
    claimType: 'HYBRID',
    claimEmergedAt: '2015-03-02',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2015-03-02',
        datePrecision: 'DAY',
        reason: 'Kelley, Mohtadi, Cane, Seager, and Kushnir published \'Climate change in the Fertile Crescent and implications of the recent Syrian drought\' in PNAS (112(11):3241–3246), attributing a long-term drying and warming trend in the region to anthropogenic forcing, estimating it made the severe 2007–2010 drought 2–3 times more likely, and arguing the drought\'s agricultural collapse and displacement helped catalyze the 2011 uprising. It became the flagship empirical case for climate change as a contributing driver of a specific armed conflict.',
        source: {
          externalId: 'src:kelley-syrian-drought-pnas-2015',
          name: 'Kelley CP, Mohtadi S, Cane MA, Seager R, Kushnir Y. Climate change in the Fertile Crescent and implications of the recent Syrian drought. PNAS. 2015;112(11):3241–3246.',
          url: 'https://doi.org/10.1073/pnas.1421533112',
          publishedAt: '2015-03-02',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-09-01',
        datePrecision: 'MONTH',
        reason: 'Jan Selby, Omar Dahi, Christiane Fröhlich, and Mike Hulme published \'Climate change and the Syrian civil war revisited\' in Political Geography (60:232–244), arguing there is no sound evidence that the drought was necessarily anthropogenic or that it was a significant driver of the war, and challenging the migration and causal-chain figures Kelley relied on. Published in a special section with responses and a rejoinder, it moved the drought-to-conflict attribution from an influential finding to an openly contested claim in the climate-security literature.',
        source: {
          externalId: 'src:selby-syria-revisited-polgeo-2017',
          name: 'Selby J, Dahi OS, Fröhlich C, Hulme M. Climate change and the Syrian civil war revisited. Political Geography. 2017;60:232–244.',
          url: 'https://doi.org/10.1016/j.polgeo.2017.05.007',
          publishedAt: '2017-09-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 37. NAS — extreme event attribution report — 2016 ───────────────────────
  {
    externalId: 'trajectory:nas-extreme-event-attribution-2016',
    text: 'The U.S. National Academies of Sciences, Engineering, and Medicine concluded on 11 March 2016, in \'Attribution of Extreme Weather Events in the Context of Climate Change,\' that the science of attributing individual extreme weather events to human-caused climate change had matured into a credible discipline capable of quantitative, event-specific statements.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2016-03-11',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2016-03-11',
        datePrecision: 'DAY',
        reason: 'The National Academies released the consensus study report \'Attribution of Extreme Weather Events in the Context of Climate Change,\' the first authoritative U.S. assessment to conclude that confidence in event attribution is highest for temperature-related extremes (heat and cold), growing for drought and heavy precipitation, and lowest for phenomena like tropical cyclones. By formally grading attribution confidence by event type, it established the field\'s legitimacy and its methodological frontier in one document.',
        source: {
          externalId: 'src:nas-extreme-event-attribution-2016',
          name: 'National Academies of Sciences, Engineering, and Medicine. Attribution of Extreme Weather Events in the Context of Climate Change. Washington, DC: The National Academies Press. March 11, 2016.',
          url: 'https://nap.nationalacademies.org/catalog/21852/attribution-of-extreme-weather-events-in-the-context-of-climate-change',
          publishedAt: '2016-03-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2021-08-09',
        datePrecision: 'DAY',
        reason: 'The IPCC Sixth Assessment Report Working Group I (9 August 2021) incorporated extreme-event attribution as a standard element of its assessment, devoting Chapter 11 to attributable changes in weather and climate extremes and stating that human influence on many observed extremes — including heatwaves, heavy precipitation, and droughts — is now well established. The intergovernmental adoption of event attribution as routine assessment practice settled the discipline\'s scientific standing that the 2016 National Academies report had recorded.',
        source: {
          externalId: 'src:ipcc-ar6-wg1-2021',
          name: 'IPCC. Climate Change 2021: The Physical Science Basis (AR6 WGI), Ch. 11 (Weather and climate extreme events in a changing climate). August 9, 2021.',
          url: 'https://www.ipcc.ch/report/ar6/wg1/',
          publishedAt: '2021-08-09',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 38. Parmesan & Yohe — species fingerprint of climate change — 2003 ────────
  {
    externalId: 'trajectory:parmesan-yohe-species-fingerprint-2003',
    text: 'Camille Parmesan and Gary Yohe reported in Nature on 2 January 2003 that a meta-analysis of more than 1,700 species revealed a globally coherent biological fingerprint of climate change — species ranges shifting poleward and upward by about 6.1 km per decade and spring events advancing by about 2.3 days per decade.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2003-01-02',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2003-01-02',
        datePrecision: 'DAY',
        reason: 'Parmesan and Yohe published \'A globally coherent fingerprint of climate change impacts across natural systems\' in Nature (421:37–42), applying meta-analyses to over 1,700 species and finding significant poleward/upward range shifts averaging 6.1 km per decade and spring phenological events advancing 2.3 days per decade. By defining a diagnostic \'sign-switching\' fingerprint uniquely predicted by twentieth-century warming, it was the first quantitative demonstration that climate change was already reshaping the geography and timing of life across taxa worldwide.',
        source: {
          externalId: 'src:parmesan-yohe-fingerprint-nature-2003',
          name: 'Parmesan C, Yohe G. A globally coherent fingerprint of climate change impacts across natural systems. Nature. 2003;421(6918):37–42.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/12511946/',
          publishedAt: '2003-01-02',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2007-04-06',
        datePrecision: 'DAY',
        reason: 'The IPCC Fourth Assessment Report Working Group II Summary for Policymakers, approved in Brussels on 6 April 2007, concluded with very high confidence that recent warming is strongly affecting terrestrial biological systems, citing poleward and upward shifts in species ranges and the earlier timing of spring events. By synthesizing this evidence into an intergovernmental consensus, the assessment elevated the Parmesan–Yohe fingerprint from a single meta-analysis to settled institutional science on observed ecological impacts of warming.',
        source: {
          externalId: 'src:ipcc-ar4-wg2-spm-2007',
          name: 'IPCC. Climate Change 2007: Impacts, Adaptation and Vulnerability (AR4 WGII), Summary for Policymakers. April 6, 2007.',
          url: 'https://www.ipcc.ch/report/ar4/wg2/',
          publishedAt: '2007-04-06',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 39. Thomas et al. — extinction risk from climate change — 2004 ──────────
  {
    externalId: 'trajectory:thomas-extinction-risk-climate-2004',
    text: 'Chris Thomas and colleagues reported in Nature on 8 January 2004 that, under mid-range warming scenarios for 2050, 15–37% of species in sampled regions covering roughly 20% of Earth\'s land surface would be \'committed to extinction\' from climate change.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2004-01-08',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2004-01-08',
        datePrecision: 'DAY',
        reason: 'Thomas, Cameron, Green and 16 co-authors published \'Extinction risk from climate change\' in Nature (427:145–148), using species–area relationships applied to projected climate-driven range contractions across sample regions on every vegetated continent. They estimated that 15–37% of species would be committed to extinction by 2050 under mid-range warming (~24% average), the first global, multi-taxon quantitative projection of climate-driven extinction and one of the most-cited biodiversity results of the decade.',
        source: {
          externalId: 'src:thomas-extinction-risk-nature-2004',
          name: 'Thomas CD, Cameron A, Green RE, et al. Extinction risk from climate change. Nature. 2004;427(6970):145–148.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/14712274/',
          publishedAt: '2004-01-08',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2004-07-01',
        datePrecision: 'MONTH',
        reason: 'In a set of Brief Communications Arising in Nature (430:33–34, 1 July 2004), Thuiller et al. (\'Uncertainty in predictions of extinction risk\'), Buckley & Roughgarden, and Harte et al. (\'Climate change and extinction risk\') argued that the species–area method, dispersal assumptions, and scenario handling made the 15–37% figures highly uncertain and likely misleading. Thomas et al.\'s reply defended the broad conclusion while conceding wide error bars, leaving the specific extinction percentages an openly contested benchmark in conservation biology.',
        source: {
          externalId: 'src:extinction-risk-critiques-nature-2004',
          name: 'Thuiller W, et al.; Buckley LB, Roughgarden J; Harte J, et al.; with reply by Thomas CD, et al. Biodiversity conservation: Uncertainty in predictions of extinction risk / Climate change and extinction risk. Nature. 2004;430:33–34.',
          url: 'https://www.nature.com/articles/nature02716',
          publishedAt: '2004-07-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 40. Pounds et al. — amphibian chytrid warming hypothesis — 2006 ─────────
  {
    externalId: 'trajectory:pounds-amphibian-chytrid-warming-2006',
    text: 'J. Alan Pounds and colleagues reported in Nature on 12 January 2006 that a wave of harlequin frog (Atelopus) extinctions in the American tropics — including the Monteverde harlequin frog and golden toad — was driven by global-warming-enhanced outbreaks of the chytrid fungus Batrachochytrium dendrobatidis, the \'climate-linked epidemic\' hypothesis.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2006-01-12',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-01-12',
        datePrecision: 'DAY',
        reason: 'Pounds and colleagues published \'Widespread amphibian extinctions from epidemic disease driven by global warming\' in Nature (439:161–167), reporting that about 67% of the ~110 endemic Atelopus species had vanished and analysing the timing of losses against sea-surface and air temperatures to conclude with >99% confidence that large-scale warming was a key factor. They proposed that warming shifts highland temperatures toward the growth optimum of the chytrid fungus, encouraging lethal outbreaks — the founding statement of the climate-linked-epidemic hypothesis for amphibian declines.',
        source: {
          externalId: 'src:pounds-amphibian-chytrid-nature-2006',
          name: 'Pounds JA, Bustamante MR, Coloma LA, et al. Widespread amphibian extinctions from epidemic disease driven by global warming. Nature. 2006;439(7073):161–167.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16407945/',
          publishedAt: '2006-01-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2008-03-25',
        datePrecision: 'DAY',
        reason: 'Lips, Diffendorfer, Mendelson, and Sears published \'Riding the wave: reconciling the roles of disease and climate change in amphibian declines\' in PLoS Biology (6(3):e72) on 25 March 2008, finding no evidence that climate change was driving chytridiomycosis outbreaks and showing that Central and South American declines were better explained by the spatiotemporal spread of Batrachochytrium as an introduced pathogen. Together with Rohr et al.\'s parallel PNAS critique, it directly challenged the climate-linked-epidemic hypothesis, moving Pounds\'s warming-driven-extinction claim into open scientific dispute.',
        source: {
          externalId: 'src:lips-riding-the-wave-plosbio-2008',
          name: 'Lips KR, Diffendorfer J, Mendelson JR III, Sears MW. Riding the wave: reconciling the roles of disease and climate change in amphibian declines. PLoS Biology. 2008;6(3):e72.',
          url: 'https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.0060072',
          publishedAt: '2008-03-25',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 41. U.S. FWS — polar bear ESA threatened listing — 2008 ─────────────────
  {
    externalId: 'trajectory:polar-bear-esa-threatened-listing-2008',
    text: 'On 15 May 2008 the U.S. Fish and Wildlife Service listed the polar bear (Ursus maritimus) as threatened throughout its range under the Endangered Species Act, citing the ongoing and projected loss of sea-ice habitat from climate change — the first species listed primarily because of anthropogenic global warming.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2008-05-15',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2008-05-15',
        datePrecision: 'DAY',
        reason: 'The U.S. Fish and Wildlife Service published its final rule \'Determination of Threatened Status for the Polar Bear (Ursus maritimus) Throughout Its Range\' in the Federal Register (73 FR 28212) on 15 May 2008, finding that the best available science showed sea-ice habitat was declining and would continue to decline due to climate change, rendering the species likely to become endangered within the foreseeable future (defined as 45 years). It was the first ESA listing to rest on climate-model projections of greenhouse-driven habitat loss, formally entering climate change into U.S. endangered-species law.',
        source: {
          externalId: 'src:fws-polar-bear-listing-fr-2008',
          name: 'U.S. Fish and Wildlife Service. Endangered and Threatened Wildlife and Plants; Determination of Threatened Status for the Polar Bear (Ursus maritimus) Throughout Its Range. 73 FR 28212. May 15, 2008.',
          url: 'https://www.federalregister.gov/documents/2008/05/15/E8-11105/endangered-and-threatened-wildlife-and-plants-determination-of-threatened-status-for-the-polar-bear',
          publishedAt: '2008-05-15',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'JUDICIAL',
        occurredAt: '2013-03-01',
        datePrecision: 'DAY',
        reason: 'In In re Polar Bear Endangered Species Act Listing and § 4(d) Rule Litigation (709 F.3d 1), the U.S. Court of Appeals for the D.C. Circuit unanimously affirmed the listing on 1 March 2013, rejecting challenges from industry, states, and environmental groups and holding that the Service\'s conclusion that the polar bear is threatened by climate-driven sea-ice loss was reasonable and adequately supported by the record. Appellate affirmation settled the climate-based listing as legally durable federal policy.',
        source: {
          externalId: 'src:dc-circuit-polar-bear-listing-2013',
          name: 'In re Polar Bear Endangered Species Act Listing and § 4(d) Rule Litigation, 709 F.3d 1 (D.C. Cir. 2013). Decided March 1, 2013.',
          url: 'https://www.biologicaldiversity.org/species/mammals/polar_bear/pdfs/Appellate_Court_Decision_Upholding_Polar_Bear_Endangered_Species_Act_Listing_3_1_2013.pdf',
          publishedAt: '2013-03-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 42. Walter et al. — permafrost thaw lake methane — 2006 ─────────────────
  {
    externalId: 'trajectory:walter-permafrost-thaw-lake-methane-2006',
    text: 'Katey Walter and colleagues reported in Nature on 7 September 2006 that ebullition (bubbling) of methane from thawing permafrost lakes in North Siberia is a large, previously underestimated source that constitutes a positive feedback to climate warming, with fluxes up to five times prior estimates.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2006-09-07',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2006-09-07',
        datePrecision: 'DAY',
        reason: 'Walter, Zimov, Chanton, Verbyla, and Chapin published \'Methane bubbling from Siberian thaw lakes as a positive feedback to climate warming\' in Nature (443:71–75), using new bubble-trap measurements to show that ebullition accounts for ~95% of methane emissions from these thaw lakes and that regional fluxes may be five times higher than previously estimated — raising estimates of northern-wetland emissions by 10–63%. Because thawing Pleistocene-carbon-rich permafrost fuels the bubbling, expanding thaw lakes represent a self-amplifying carbon feedback, one of the first field quantifications of the permafrost-carbon–climate feedback.',
        source: {
          externalId: 'src:walter-thaw-lake-methane-nature-2006',
          name: 'Walter KM, Zimov SA, Chanton JP, Verbyla D, Chapin FS III. Methane bubbling from Siberian thaw lakes as a positive feedback to climate warming. Nature. 2006;443(7107):71–75.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/16957728/',
          publishedAt: '2006-09-07',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2015-04-09',
        datePrecision: 'DAY',
        reason: 'Schuur and 49 co-authors of the Permafrost Carbon Network published \'Climate change and the permafrost carbon feedback\' in Nature (520:171–179) on 9 April 2015, synthesizing field and modeling evidence to conclude that permafrost thaw will release large amounts of carbon as CO₂ and methane, amplifying warming as a positive feedback. This community-wide expert consensus established the permafrost-carbon feedback — of which thaw-lake methane ebullition is a component — as settled science, moving the mechanism Walter quantified in 2006 from a striking single-region finding to an accepted element of the global carbon cycle.',
        source: {
          externalId: 'src:schuur-permafrost-carbon-feedback-nature-2015',
          name: 'Schuur EAG, McGuire AD, Schädel C, et al. Climate change and the permafrost carbon feedback. Nature. 2015;520(7546):171–179.',
          url: 'https://www.nature.com/articles/nature14338',
          publishedAt: '2015-04-09',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 43. IEA — solar PV cheapest electricity in history — 2020 ──────────────
  {
    externalId: 'trajectory:iea-solar-cheapest-electricity-2020',
    text: 'The International Energy Agency declared in its World Energy Outlook 2020, published on 13 October 2020, that in regions with good resources and access to low-cost financing solar photovoltaic power had become the cheapest source of electricity in history.',
    claimType: 'HYBRID',
    claimEmergedAt: '2020-10-13',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2020-10-13',
        datePrecision: 'DAY',
        reason: 'In the World Energy Outlook 2020, the IEA reported that revised cost and financing assumptions made new utility-scale solar PV the cheapest electricity ever seen in the best locations, stating solar was 20–50% cheaper than it had estimated a year earlier. Coming from the world\'s leading intergovernmental energy authority — long regarded as conservative on renewables — this placed the \'solar is cheapest\' claim onto the authoritative institutional record for the first time.',
        source: {
          externalId: 'src:iea-weo-2020',
          name: 'International Energy Agency. World Energy Outlook 2020. Paris: IEA, 13 October 2020.',
          url: 'https://www.iea.org/reports/world-energy-outlook-2020',
          publishedAt: '2020-10-13',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'MARKET',
        occurredAt: '2024-09-24',
        datePrecision: 'MONTH',
        reason: 'IRENA\'s Renewable Power Generation Costs in 2023 (September 2024) found that 81% (382 GW) of the 473 GW of utility-scale renewable capacity commissioned in 2023 produced electricity more cheaply than the cheapest fossil-fuel alternative, with solar PV and onshore wind the lowest-cost options. Independent global cost data from the sector\'s dedicated agency confirmed the cost-crossover as an established market fact rather than a one-off IEA projection.',
        source: {
          externalId: 'src:irena-power-costs-2023',
          name: 'International Renewable Energy Agency. Renewable Power Generation Costs in 2023 (Executive Summary). Abu Dhabi: IRENA, September 2024.',
          url: 'https://www.irena.org/-/media/Files/IRENA/Agency/Publication/2024/Sep/IRENA_Renewable_power_generation_costs_in_2023_executive_summary.pdf',
          publishedAt: '2024-09-24',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 44. UK — first major economy to enshrine net-zero in law — 2019 ─────────
  {
    externalId: 'trajectory:uk-net-zero-2050-law-2019',
    text: 'The United Kingdom became the first major economy to enshrine a net-zero greenhouse gas emissions target in law when the Climate Change Act 2008 (2050 Target Amendment) Order came into force on 27 June 2019, committing the UK to at least a 100% reduction in emissions relative to 1990 levels by 2050.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2019-06-27',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'RECORDED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2019-06-27',
        datePrecision: 'DAY',
        reason: 'Acting on the Committee on Climate Change\'s May 2019 advice, the UK government amended the Climate Change Act 2008 to replace its 80%-reduction target with a legally binding net-zero-by-2050 obligation, and announced it as the first such law passed by a major economy. This converted net zero from an aspirational policy goal into a statutory duty, setting the template subsequently followed by the EU and dozens of other states.',
        source: {
          externalId: 'src:uk-gov-net-zero-law-2019',
          name: 'UK Government (BEIS). Press release: UK becomes first major economy to pass net zero emissions law. GOV.UK, 27 June 2019.',
          url: 'https://www.gov.uk/government/news/uk-becomes-first-major-economy-to-pass-net-zero-emissions-law',
          publishedAt: '2019-06-27',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 45. Boundary Dam 3 — first commercial coal-plant CCS — 2014 ─────────────
  {
    externalId: 'trajectory:boundary-dam-first-coal-ccs-2014',
    text: 'SaskPower launched Boundary Dam Unit 3 in Estevan, Saskatchewan on 2 October 2014 as the world\'s first commercial-scale post-combustion carbon capture and storage facility on a coal-fired power plant, designed to capture up to one million tonnes of CO₂ per year.',
    claimType: 'HYBRID',
    claimEmergedAt: '2014-10-02',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2014-10-02',
        datePrecision: 'DAY',
        reason: 'SaskPower and the Government of Canada announced the launch of the CAD 1.4 billion Boundary Dam 3 retrofit as the world\'s first commercial-scale post-combustion CCS project on a coal plant, capable of capturing up to one million tonnes of CO₂ annually. The event established coal-plant CCS as a demonstrated, operating technology rather than a laboratory concept.',
        source: {
          externalId: 'src:canada-boundary-dam-launch-2014',
          name: 'Government of Canada. Harper Government Celebrates World-First Commercial Carbon Capture and Storage. Canada.ca news archive, 2 October 2014.',
          url: 'https://www.canada.ca/en/news/archive/2014/10/harper-government-celebrates-world-first-commercial-carbon-capture-storage.html',
          publishedAt: '2014-10-02',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2024-04-30',
        datePrecision: 'DAY',
        reason: 'Analysing SaskPower\'s own operating data, IEEFA reported on 30 April 2024 that Boundary Dam 3\'s long-term capture rate through end-2023 was only about 57% — far below the promised 90% — because the capture unit was available for only ~80% of operating hours and processed only part of the flue gas. The persistent shortfall, with no comparable coal-CCS plant following at scale, contested the founding claim that commercial coal-plant CCS was a viable, at-scale mitigation pathway.',
        source: {
          externalId: 'src:ieefa-boundary-dam-underperforming-2024',
          name: 'Schlissel D, Kalegha M. Carbon Capture at Boundary Dam 3 Still an Underperforming Failure. Institute for Energy Economics and Financial Analysis (IEEFA), 30 April 2024.',
          url: 'https://ieefa.org/resources/carbon-capture-boundary-dam-3-still-underperforming-failure',
          publishedAt: '2024-04-30',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 46. IEA — net-zero 2050 roadmap, no new fossil expansion — 2021 ─────────
  {
    externalId: 'trajectory:iea-net-zero-2050-roadmap-2021',
    text: 'The International Energy Agency published \'Net Zero by 2050: A Roadmap for the Global Energy Sector\' on 18 May 2021, concluding that a 1.5°C-aligned pathway requires no new oil and gas fields approved for development, and no new coal mines or unabated coal plants, beyond projects already committed as of 2021.',
    claimType: 'HYBRID',
    claimEmergedAt: '2021-05-18',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2021-05-18',
        datePrecision: 'DAY',
        reason: 'In its first comprehensive net-zero roadmap, the IEA — historically seen as sympathetic to fossil-fuel producers — modelled 400+ milestones and concluded there is no need for new oil and gas fields or new coal mines beyond already-committed projects on a 1.5°C path. This marked a striking reversal of the agency\'s institutional posture and put the \'no new fossil expansion\' finding onto the authoritative energy-analysis record.',
        source: {
          externalId: 'src:iea-net-zero-2050-2021',
          name: 'International Energy Agency. Net Zero by 2050: A Roadmap for the Global Energy Sector. Paris: IEA, 18 May 2021.',
          url: 'https://www.iea.org/reports/net-zero-by-2050',
          publishedAt: '2021-05-18',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2023-09-26',
        datePrecision: 'DAY',
        reason: 'In its 2023 update, \'Net Zero Roadmap: A Global Pathway to Keep the 1.5°C Goal in Reach\' (26 September 2023), the IEA reaffirmed with updated data that no new long-lead-time upstream oil and gas projects and no new unabated coal are needed on the 1.5°C pathway. The restatement two years on, against sustained pushback from OPEC and fossil producers, cemented the finding as the agency\'s standing analytical position rather than a one-off scenario.',
        source: {
          externalId: 'src:iea-net-zero-roadmap-2023-update',
          name: 'International Energy Agency. Net Zero Roadmap: A Global Pathway to Keep the 1.5 °C Goal in Reach — 2023 Update. Paris: IEA, 26 September 2023.',
          url: 'https://www.iea.org/reports/net-zero-roadmap-a-global-pathway-to-keep-the-15-c-goal-in-reach',
          publishedAt: '2023-09-26',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 47. UK — coal power phaseout completed — 2024 ───────────────────────────
  {
    externalId: 'trajectory:uk-coal-power-phaseout-2024',
    text: 'The United Kingdom pledged in November 2015 to phase out unabated coal-fired electricity and completed the phase-out when Ratcliffe-on-Soar power station closed on 30 September 2024, making the UK the first G7 nation to end coal power, 142 years after the world\'s first coal-fired public power station opened in London.',
    claimType: 'HYBRID',
    claimEmergedAt: '2015-11-18',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2015-11-18',
        datePrecision: 'DAY',
        reason: 'In an \'energy policy reset\' speech on 18 November 2015, Energy and Climate Change Secretary Amber Rudd committed the UK to closing all unabated coal-fired power stations by 2025, the first such national coal phase-out pledge by a major economy. The commitment converted coal exit from analytical possibility into declared government policy.',
        source: {
          externalId: 'src:uk-coal-phaseout-pledge-2015',
          name: 'Carbon Brief. In-depth: UK pledges coal phase-out by 2025, but uncertainty remains (Amber Rudd energy policy reset speech). 18 November 2015.',
          url: 'https://www.carbonbrief.org/in-depth-uk-pledges-coal-phase-out-by-2025-but-uncertainty-remains/',
          publishedAt: '2015-11-18',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'MARKET',
        occurredAt: '2024-09-30',
        datePrecision: 'DAY',
        reason: 'Ratcliffe-on-Soar, the UK\'s last coal-fired power station, ceased generation on 30 September 2024, ending 142 years of coal power and making the UK the first G7 nation to eliminate coal from its grid — coal had still supplied ~40% of UK electricity in 2012. The physical closure realised the 2015 pledge, converting the phase-out from policy target into an accomplished, effectively irreversible energy-system fact.',
        source: {
          externalId: 'src:uk-ratcliffe-coal-closure-2024',
          name: 'ABC News. UK\'s last coal-fired power plant officially closes as energy transition takes hold. 30 September 2024.',
          url: 'https://www.abc.net.au/news/2024-09-30/last-coal-fired-power-plant-in-uk-officially-closes/104378430',
          publishedAt: '2024-09-30',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 28. Gornitz, Lebedeff & Hansen — global sea-level trend — 1982 ───────────
  {
    externalId: 'trajectory:gornitz-lebedeff-hansen-sea-level-trend-1982',
    text: 'Vivien Gornitz, Sergej Lebedeff, and James Hansen reported in Science on 26 March 1982 that worldwide tide-gauge records show global mean sea level rose about 12 centimetres over the past century, correlated with rising global surface air temperature and attributable largely to thermal expansion of the upper ocean.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1982-03-26',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1982-03-26',
        datePrecision: 'DAY',
        reason: 'Gornitz, Lebedeff, and Hansen published \'Global Sea Level Trend in the Past Century\' in Science (215(4540):1611–1614), compiling tide-gauge stations worldwide to derive a ~12 cm twentieth-century rise that correlated strongly with the global temperature trend. They attributed much of it to thermal expansion of the upper ocean with weaker indirect evidence of ice-sheet melt, producing the first modern observational estimate linking sea-level rise to greenhouse warming and seeding the first statistical projections of future rise.',
        source: {
          externalId: 'src:gornitz-lebedeff-hansen-sea-level-science-1982',
          name: 'Gornitz V, Lebedeff S, Hansen J. Global sea level trend in the past century. Science. 1982;215(4540):1611–1614.',
          url: 'https://www.giss.nasa.gov/pubs/abs/go05100g.html',
          publishedAt: '1982-03-26',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1990-08-01',
        datePrecision: 'MONTH',
        reason: 'The IPCC First Assessment Report (WGI, 1990) concluded that global mean sea level had risen roughly 10–20 cm over the previous 100 years and projected continued rise driven by thermal expansion and glacier melt under greenhouse warming. By adopting a century-scale observational sea-level rise consistent with the Gornitz–Lebedeff–Hansen estimate, the first intergovernmental assessment elevated the tide-gauge finding from a single study to settled institutional baseline.',
        source: {
          externalId: 'src:ipcc-far-sea-level-1990',
          name: 'IPCC. Climate Change: The IPCC Scientific Assessment (First Assessment Report, WGI). Cambridge University Press. 1990.',
          url: 'https://www.ipcc.ch/report/ar1/wg1/',
          publishedAt: '1990-08-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Fourier — atmospheric greenhouse mechanism — 1824 ───────────────────────
  {
    externalId: 'trajectory:fourier-atmospheric-greenhouse-1824',
    text: 'Joseph Fourier proposed in 1824, in \'Remarques générales sur les températures du globe terrestre et des espaces planétaires\' (Annales de Chimie et de Physique), that the Earth\'s atmosphere retains heat by being more transparent to incoming visible solar radiation than to the outgoing radiant (infrared) heat of the surface, the first scientific articulation of what is now called the greenhouse effect.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1824-10-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1824-10-01',
        datePrecision: 'MONTH',
        reason: 'Fourier published his general remarks on terrestrial temperatures in the Annales de Chimie et de Physique (Ser. 2, vol. 27, pp. 136–167), arguing by analogy to a heated box covered with glass that the atmosphere admits solar light but impedes the escape of the ground\'s radiant heat, warming the planet. This placed the greenhouse-warming mechanism onto the scientific record for the first time, laying the foundation of climate physics.',
        source: {
          externalId: 'src:fourier-temperatures-globe-1824',
          name: 'Fourier J-B J. Remarques générales sur les températures du globe terrestre et des espaces planétaires. Annales de Chimie et de Physique, Ser. 2. 1824;27:136–167. (English translation, R.T. Pierrehumbert, of the 1827 Mémoires version.)',
          url: 'https://geosci.uchicago.edu/~rtp1/papers/Fourier1827Trans.pdf',
          publishedAt: '1824-10-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1861-02-07',
        datePrecision: 'DAY',
        reason: 'Fourier\'s qualitative mechanism was placed on firm experimental footing when John Tyndall\'s 1861 Bakerian Lecture demonstrated in the laboratory that atmospheric gases such as water vapour and carbonic acid actually absorb radiant heat, supplying the physical agent Fourier had only inferred. The greenhouse-warming principle thereby became a settled foundation of atmospheric physics, later quantified by Arrhenius (1896).',
        source: {
          externalId: 'src:tyndall-bakerian-absorption-1861',
          name: 'Tyndall J. The Bakerian Lecture: On the Absorption and Radiation of Heat by Gases and Vapours, and on the Physical Connexion of Radiation, Absorption, and Conduction. Philosophical Transactions of the Royal Society of London. 1861;151:1–36.',
          url: 'https://royalsocietypublishing.org/doi/10.1098/rstl.1861.0001',
          publishedAt: '1861-01-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Tyndall — gas heat absorption experiments — 1861 ────────────────────────
  {
    externalId: 'trajectory:tyndall-gas-heat-absorption-1861',
    text: 'John Tyndall reported in his 1861 Bakerian Lecture to the Royal Society (Philosophical Transactions vol. 151) the first experimental measurements showing that water vapour, carbonic acid (CO₂), and other polyatomic gases strongly absorb and radiate infrared heat while the main atmospheric gases nitrogen and oxygen do not, identifying the specific gases responsible for the atmosphere\'s heat-trapping effect.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1861-02-07',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1861-02-07',
        datePrecision: 'DAY',
        reason: 'Tyndall\'s paper — received 10 January and read 7 February 1861 — reported ratio-spectrophotometer experiments demonstrating that \'perfectly colourless and invisible gases and vapours\' such as aqueous vapour and carbonic acid absorb radiant heat far more strongly than dry air, whereas oxygen and nitrogen are nearly transparent to it. This put the identity of the atmosphere\'s radiatively active gases onto the scientific record.',
        source: {
          externalId: 'src:tyndall-bakerian-absorption-phil-trans-1861',
          name: 'Tyndall J. The Bakerian Lecture: On the Absorption and Radiation of Heat by Gases and Vapours. Philosophical Transactions of the Royal Society of London. 1861;151:1–36.',
          url: 'https://royalsocietypublishing.org/doi/10.1098/rstl.1861.0001',
          publishedAt: '1861-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1896-04-01',
        datePrecision: 'MONTH',
        reason: 'Tyndall\'s identification of water vapour and CO₂ as the atmosphere\'s infrared absorbers was consolidated into settled quantitative theory when Svante Arrhenius (1896) used gas-absorption data to compute the surface-temperature response to changes in atmospheric carbonic acid, making the radiative role of these gases a durable foundation of climate science confirmed by all later spectroscopy.',
        source: {
          externalId: 'src:arrhenius-carbonic-acid-1896',
          name: 'Arrhenius S. On the Influence of Carbonic Acid in the Air upon the Temperature of the Ground. Philosophical Magazine and Journal of Science, Ser. 5. 1896;41(251):237–276.',
          url: 'https://www.tandfonline.com/doi/abs/10.1080/14786449608620846',
          publishedAt: '1896-04-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── UNFCCC — framework convention adopted — 1992 ────────────────────────────
  {
    externalId: 'trajectory:unfccc-framework-convention-adopted-1992',
    text: 'The United Nations Framework Convention on Climate Change (UNFCCC) was adopted in New York on 9 May 1992, establishing the first global treaty framework whose objective is the stabilization of atmospheric greenhouse-gas concentrations at a level that would prevent dangerous anthropogenic interference with the climate system.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1992-05-09',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1992-05-09',
        datePrecision: 'DAY',
        reason: 'The Intergovernmental Negotiating Committee adopted the text of the Framework Convention at the close of its fifth session in New York on 9 May 1992; it was then opened for signature at the Rio Earth Summit in June 1992. This created the foundational institutional record and negotiating architecture (the Conference of the Parties) under which all subsequent climate treaties — Kyoto and Paris — were concluded.',
        source: {
          externalId: 'src:un-treaty-collection-unfccc',
          name: 'United Nations Treaty Collection. United Nations Framework Convention on Climate Change, adopted New York 9 May 1992 (Chapter XXVII.7; UNTS vol. 1771, No. 30822).',
          url: 'https://treaties.un.org/pages/ViewDetailsIII.aspx?src=IND&mtdsg_no=XXVII-7&chapter=27&clang=_en',
          publishedAt: '1992-05-09',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1994-03-21',
        datePrecision: 'DAY',
        reason: 'The Convention entered into force on 21 March 1994, ninety days after the 50th ratification, becoming binding international law. Its near-universal membership (198 parties) and its role as the standing legal basis for the annual COP process establish it as settled, foundational climate-governance infrastructure rather than a contested proposal.',
        source: {
          externalId: 'src:unfccc-entry-into-force-1994',
          name: 'United Nations Treaty Collection. UNFCCC — entry into force 21 March 1994 in accordance with Article 23(1).',
          url: 'https://treaties.un.org/pages/ViewDetailsIII.aspx?src=IND&mtdsg_no=XXVII-7&chapter=27&clang=_en',
          publishedAt: '1994-03-21',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Copenhagen Accord — COP15 non-adoption — 2009 ───────────────────────────
  {
    externalId: 'trajectory:copenhagen-accord-cop15-2009',
    text: 'At the COP15 climate conference in Copenhagen on 18 December 2009, the Conference of the Parties merely \'took note of\' the Copenhagen Accord — a three-page political statement negotiated by a small group of heads of state that recognized the 2°C goal but set no binding emission targets — rather than formally adopting it, marking the collapse of expectations for a legally binding successor to the Kyoto Protocol.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2009-12-18',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2009-12-18',
        datePrecision: 'DAY',
        reason: 'Facing opposition from several parties, the COP15 plenary declined to adopt the accord as a formal decision and instead issued decision 2/CP.15, under which the Conference \'takes note of the Copenhagen Accord.\' The \'take note\' formulation deliberately signalled that the accord carried no legal force, recording on the institutional record that the attempt to secure a binding global deal had failed and that international climate ambition was politically contested.',
        source: {
          externalId: 'src:unfccc-decision-2cp15-copenhagen-accord',
          name: 'UNFCCC. Decision 2/CP.15, Copenhagen Accord. FCCC/CP/2009/11/Add.1, 30 March 2010.',
          url: 'https://unfccc.int/resource/docs/2009/cop15/eng/11a01.pdf',
          publishedAt: '2010-03-30',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Callendar — fossil CO₂ warming — 1938 ───────────────────────────────────
  {
    externalId: 'trajectory:callendar-fossil-co2-warming-1938',
    text: 'Guy Stewart Callendar argued in the Quarterly Journal of the Royal Meteorological Society in 1938 that human fossil-fuel combustion had measurably raised atmospheric CO₂ and was warming global temperatures, quantifying the effect at roughly 0.003 °C per year.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1938-04-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1938-04-01',
        datePrecision: 'MONTH',
        reason: 'Callendar, a steam engineer and amateur meteorologist, compiled world temperature records and CO₂ measurements and, using radiation absorption coefficients, argued that fossil-fuel CO₂ was accumulating in the atmosphere and warming the planet. Read to the Royal Meteorological Society on 16 February 1938 and published in its Quarterly Journal, the paper was the first to link observed 20th-century warming to industrial CO₂, but it was met with skepticism from professional meteorologists who doubted CO₂ absorption was unsaturated and dismissed the temperature trend as natural variability.',
        source: {
          externalId: 'src:callendar-qjrms-1938',
          name: 'Callendar GS. The artificial production of carbon dioxide and its influence on temperature. Quarterly Journal of the Royal Meteorological Society. 1938;64(275):223–240.',
          url: 'https://rmets.onlinelibrary.wiley.com/doi/abs/10.1002/qj.49706427503',
          publishedAt: '1938-04-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1990-08-01',
        datePrecision: 'MONTH',
        reason: 'After Keeling\'s continuous Mauna Loa record (from 1958) confirmed the year-on-year CO₂ rise Callendar had inferred, the IPCC First Assessment Report (1990) treated rising anthropogenic CO₂ and its warming influence as established science. What had been dismissed as an amateur\'s speculation in 1938 — sometimes called the \'Callendar effect\' — was institutionally settled as the foundation of modern climate assessment.',
        source: {
          externalId: 'src:ipcc-far-wg1-1990',
          name: 'IPCC. Climate Change: The IPCC Scientific Assessment (First Assessment Report, Working Group I). 1990.',
          url: 'https://www.ipcc.ch/report/ar1/wg1/',
          publishedAt: '1990-08-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Supran, Rahmstorf & Oreskes — ExxonMobil knew — 2015/2023 ───────────────
  {
    externalId: 'trajectory:supran-oreskes-exxon-knew-2023',
    text: 'Investigative journalism (2015) and peer-reviewed analysis by Supran, Rahmstorf and Oreskes (Science, 2023) established that ExxonMobil\'s own scientists accurately projected the magnitude and timing of human-caused global warming from the late 1970s onward while the company publicly manufactured doubt about climate science.',
    claimType: 'HYBRID',
    claimEmergedAt: '2015-09-16',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'PUBLIC',
        occurredAt: '2015-09-16',
        datePrecision: 'DAY',
        reason: 'InsideClimate News published \'Exxon: The Road Not Taken,\' a document-based investigation showing that Exxon\'s in-house scientists (e.g., James Black\'s 1977 warning to management and a 1982 internal projection) had understood CO₂-driven warming decades earlier, even as the company later funded doubt campaigns. A parallel Los Angeles Times/Columbia investigation followed. The reporting put the \'Exxon knew\' claim onto the public record from primary corporate documents.',
        source: {
          externalId: 'src:insideclimate-exxon-road-not-taken-2015',
          name: 'Banerjee N, Song L, Hasemyer D. Exxon: The Road Not Taken. InsideClimate News. 2015-09-16.',
          url: 'https://insideclimatenews.org/news/16092015/exxons-own-research-confirmed-fossil-fuels-role-in-global-warming/',
          publishedAt: '2015-09-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2023-01-13',
        datePrecision: 'DAY',
        reason: 'Supran, Rahmstorf and Oreskes published \'Assessing ExxonMobil\'s global warming projections\' in Science, quantitatively evaluating every warming projection Exxon and ExxonMobil scientists documented between 1977 and 2003. They found 63–83% of the projections accurate and at least as skillful as independent academic and government models, moving the \'Exxon knew\' finding from journalistic claim to peer-reviewed scientific record and directly contradicting the company\'s public doubt-casting — a documented parallel to the tobacco industry\'s playbook.',
        source: {
          externalId: 'src:supran-oreskes-exxon-science-2023',
          name: 'Supran G, Rahmstorf S, Oreskes N. Assessing ExxonMobil\'s global warming projections. Science. 2023;379(6628):eabk0063.',
          url: 'https://www.science.org/doi/10.1126/science.abk0063',
          publishedAt: '2023-01-13',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Santer — fingerprint detection contested — 1996 ─────────────────────────
  {
    externalId: 'trajectory:santer-fingerprint-detection-contested-1996',
    text: 'Santer and colleagues reported in Nature on 4 July 1996 that the observed vertical pattern of atmospheric temperature change matched the \'fingerprint\' predicted by models including greenhouse gases and sulfate aerosols, providing detection-level evidence of human influence on climate.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1996-07-04',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1996-07-04',
        datePrecision: 'DAY',
        reason: 'Santer et al. published \'A search for human influences on the thermal structure of the atmosphere\' in Nature, showing that the spatial pattern of 1963–1987 temperature change matched model predictions incorporating CO₂, sulfate aerosols and stratospheric ozone, with the model–observation agreement strengthening over time. The pattern-based \'fingerprint\' detection provided the empirical backbone for the IPCC Second Assessment Report\'s conclusion of a \'discernible human influence\' on climate.',
        source: {
          externalId: 'src:santer-fingerprint-nature-1996',
          name: 'Santer BD, Taylor KE, Wigley TML, et al. A search for human influences on the thermal structure of the atmosphere. Nature. 1996;382(6586):39–46.',
          url: 'https://www.nature.com/articles/382039a0',
          publishedAt: '1996-07-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'PUBLIC',
        occurredAt: '1996-07-11',
        datePrecision: 'DAY',
        reason: 'Frederick Seitz, a former National Academy of Sciences president with no climate expertise, published \'A Major Deception on Global Warming\' in the Wall Street Journal (12 June 1996), accusing Santer of improperly altering the IPCC detection chapter; the fossil-fuel-funded Global Climate Coalition amplified the charge as \'scientific cleansing.\' A sustained public campaign through July 1996 (including further WSJ exchanges) sought to discredit the detection finding, mirroring the tobacco industry\'s manufactured-doubt tactics rather than engaging the science.',
        source: {
          externalId: 'src:seitz-wsj-major-deception-1996',
          name: 'Seitz F. A Major Deception on Global Warming (op-ed). The Wall Street Journal. 1996-06-12.',
          url: 'https://stephenschneider.stanford.edu/Publications/PDF_Papers/WSJ_July11_96.pdf',
          publishedAt: '1996-06-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2013-11-05',
        datePrecision: 'DAY',
        reason: 'Santer et al. revisited the fingerprint analysis in PNAS with an additional ~17 years of observations, confirming and strengthening the 1996 detection of a human-caused signal in atmospheric temperature structure and refuting the claim that natural variability could explain it. The peer-reviewed literature re-settled the detection finding the 1996 doubt campaign had tried to discredit.',
        source: {
          externalId: 'src:santer-thermal-structure-pnas-2013',
          name: 'Santer BD, et al. Human and natural influences on the changing thermal structure of the atmosphere. PNAS. 2013;110(43):17235–17240.',
          url: 'https://www.pnas.org/doi/10.1073/pnas.1305332110',
          publishedAt: '2013-11-05',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Massachusetts v. EPA — GHGs as air pollutants — 2007 ────────────────────
  {
    externalId: 'trajectory:massachusetts-v-epa-ghg-air-pollutant-2007',
    text: 'The U.S. Supreme Court held on 2 April 2007 in Massachusetts v. EPA that greenhouse gases fit the Clean Air Act\'s definition of \'air pollutant\' and that the EPA has statutory authority to regulate them from new motor vehicles.',
    claimType: 'HYBRID',
    claimEmergedAt: '2007-04-02',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'JUDICIAL',
        occurredAt: '2007-04-02',
        datePrecision: 'DAY',
        reason: 'By a 5–4 vote (Stevens, J.), the Court ruled that Massachusetts had standing to sue and that the Clean Air Act\'s sweeping definition of \'air pollutant\' encompasses carbon dioxide and other greenhouse gases, so the EPA could not decline to regulate them for reasons unrelated to whether they endanger public health. The decision — the Supreme Court\'s first on climate change — judicially settled that GHGs are regulable pollutants and compelled the EPA to make a science-based endangerment determination.',
        source: {
          externalId: 'src:mass-v-epa-scotus-2007',
          name: 'Massachusetts v. Environmental Protection Agency, 549 U.S. 497 (2007).',
          url: 'https://supreme.justia.com/cases/federal/us/549/497/',
          publishedAt: '2007-04-02',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── EPA GHG Endangerment Finding — 2009 / rescinded 2026 ────────────────────
  {
    externalId: 'trajectory:epa-ghg-endangerment-finding-2009',
    text: 'On 7 December 2009 the U.S. EPA Administrator signed the Endangerment Finding determining that atmospheric concentrations of six greenhouse gases threaten the public health and welfare of current and future generations under Clean Air Act Section 202(a).',
    claimType: 'HYBRID',
    claimEmergedAt: '2009-12-07',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'REVERSED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2009-12-15',
        datePrecision: 'DAY',
        reason: 'Responding to the Supreme Court\'s mandate in Massachusetts v. EPA, the EPA signed the Endangerment Finding on 7 December 2009 and published it in the Federal Register on 15 December 2009 (74 FR 66496), finding that CO₂, methane, nitrous oxide, HFCs, PFCs and SF₆ endanger public health and welfare. It became the legal foundation for all subsequent U.S. federal greenhouse-gas regulation and was upheld by the D.C. Circuit in 2012.',
        source: {
          externalId: 'src:epa-endangerment-finding-2009',
          name: 'EPA. Endangerment and Cause or Contribute Findings for Greenhouse Gases Under Section 202(a) of the Clean Air Act. 74 FR 66496. 2009-12-15.',
          url: 'https://www.epa.gov/climate-change/endangerment-and-cause-or-contribute-findings-greenhouse-gases-under-section-202a',
          publishedAt: '2009-12-15',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '2026-02-18',
        datePrecision: 'DAY',
        reason: 'After proposing reconsideration in mid-2025, the EPA finalized a rule rescinding the 2009 Endangerment Finding and repealing all greenhouse-gas emission standards for motor vehicles, published in the Federal Register on 18 February 2026. The agency argued Section 202(a) does not authorize regulating emissions to address global climate change — a regulatory reversal of the finding that had anchored U.S. climate policy for sixteen years, and a landmark instance of policy rollback despite unchanged underlying science.',
        source: {
          externalId: 'src:epa-endangerment-rescission-fr-2026',
          name: 'EPA. Rescission of the Greenhouse Gas Endangerment Finding and Motor Vehicle Greenhouse Gas Emission Standards Under the Clean Air Act (Final Rule). Federal Register. 2026-02-18.',
          url: 'https://www.federalregister.gov/documents/2026/02/18/2026-03157/rescission-of-the-greenhouse-gas-endangerment-finding-and-motor-vehicle-greenhouse-gas-emission',
          publishedAt: '2026-02-18',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Glasgow Climate Pact — coal phase-down — 2021 ────────────────────────────
  {
    externalId: 'trajectory:glasgow-climate-pact-coal-phasedown-2021',
    text: 'The Glasgow Climate Pact, adopted by consensus of nearly 200 parties at COP26 on 13 November 2021, became the first decision in the UNFCCC process to explicitly call for accelerating efforts toward the \'phase-down of unabated coal power and phase-out of inefficient fossil fuel subsidies,\' naming fossil fuels in a formal climate-treaty outcome for the first time.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2021-11-13',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2021-11-13',
        datePrecision: 'DAY',
        reason: 'After a last-minute intervention by India and China that changed the language from \'phase-out\' to \'phase-down,\' the COP26 plenary adopted decision 1/CP.26 (the Glasgow Climate Pact) by consensus. For the first time in nearly three decades of UNFCCC decisions, an agreed outcome text explicitly identified unabated coal power and fossil-fuel subsidies as targets for reduction, placing fossil fuels formally onto the treaty record.',
        source: {
          externalId: 'src:unfccc-decision-1cp26-glasgow-pact',
          name: 'UNFCCC. Decision 1/CP.26, Glasgow Climate Pact. FCCC/CP/2021/12/Add.1, 13 November 2021.',
          url: 'https://unfccc.int/sites/default/files/resource/cp2021_12_add1E.pdf',
          publishedAt: '2021-11-13',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── Neftel et al. — Siple ice-core pre-industrial CO₂ baseline — 1985 ──────
  {
    externalId: 'trajectory:neftel-siple-ice-core-preindustrial-co2-1985',
    text: 'Neftel, Moor, Oeschger, and Stauffer reported in Nature in May 1985 that air occluded in the Siple Station (West Antarctica) ice core showed atmospheric CO₂ rose from a pre-industrial level of roughly 280 ppmv to about 345 ppmv over the past two centuries, directly linking the rise to industrial fossil-fuel emissions.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1985-05-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1985-05-01',
        datePrecision: 'MONTH',
        reason: 'Neftel and colleagues published the first high-resolution ice-core CO₂ record spanning the industrial transition, showing pre-industrial concentrations near 280 ppmv rising smoothly into the instrumental Mauna Loa record. This provided the first direct, gas-in-ice evidence that the modern CO₂ rise is anthropogenic and established the pre-industrial baseline used in radiative-forcing calculations.',
        source: {
          externalId: 'src:neftel-nature-siple-co2-1985',
          name: 'Neftel A, Moor E, Oeschger H, Stauffer B. Evidence from polar ice cores for the increase in atmospheric CO2 in the past two centuries. Nature. 1985;315:45–47.',
          url: 'https://www.nature.com/articles/315045a0',
          publishedAt: '1985-05-02',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1996-02-20',
        datePrecision: 'DAY',
        reason: 'Etheridge and colleagues used three high-accumulation Law Dome (East Antarctica) ice cores to reconstruct atmospheric CO₂ from 1006 AD to 1978 with unparalleled age resolution, confirming the stable ~280 ppmv pre-industrial level and its smooth splice to the Mauna Loa record. The independent replication settled the pre-industrial baseline and the anthropogenic attribution of the industrial-era rise.',
        source: {
          externalId: 'src:etheridge-law-dome-co2-1996',
          name: 'Etheridge DM, Steele LP, Langenfelds RL, Francey RJ, Barnola JM, Morgan VI. Natural and anthropogenic changes in atmospheric CO2 over the last 1000 years from air in Antarctic ice and firn. J Geophys Res Atmos. 1996;101(D2):4115–4128.',
          url: 'https://agupubs.onlinelibrary.wiley.com/doi/10.1029/95JD03410',
          publishedAt: '1996-02-20',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Barnola et al. — Vostok CO₂–temperature coupling — 1987 ────────────────
  {
    externalId: 'trajectory:barnola-vostok-co2-temperature-coupling-1987',
    text: 'Barnola, Raynaud, Korotkevich, and Lorius reported in Nature in October 1987 that the Vostok (East Antarctica) ice core yielded a 160,000-year record of atmospheric CO₂ that correlated closely with Antarctic temperature across the last two full glacial–interglacial cycles.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1987-10-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1987-10-01',
        datePrecision: 'MONTH',
        reason: 'The Vostok record extended direct measurement of past atmospheric CO₂ to 160,000 years, revealing that CO₂ tracked Antarctic air temperature through the ~100,000-year glacial cycles with a secondary ~21,000-year component. This established the empirical CO₂–temperature coupling over glacial-interglacial time and implicated CO₂ as an amplifier of orbital climate forcing.',
        source: {
          externalId: 'src:barnola-vostok-co2-nature-1987',
          name: 'Barnola JM, Raynaud D, Korotkevich YS, Lorius C. Vostok ice core provides 160,000-year record of atmospheric CO2. Nature. 1987;329:408–414.',
          url: 'https://www.nature.com/articles/329408a0',
          publishedAt: '1987-10-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1999-06-03',
        datePrecision: 'DAY',
        reason: 'Petit and colleagues extended the Vostok record to 420,000 years across four glacial cycles, confirming the tight CO₂/CH₄–temperature correlation found in 1987 and showing that present-day greenhouse-gas burdens are unprecedented over that span. The extension across additional independent cycles settled the glacial-interglacial CO₂–climate coupling as a robust paleoclimate constraint.',
        source: {
          externalId: 'src:petit-vostok-420kyr-nature-1999',
          name: 'Petit JR, Jouzel J, Raynaud D, et al. Climate and atmospheric history of the past 420,000 years from the Vostok ice core, Antarctica. Nature. 1999;399:429–436.',
          url: 'https://www.nature.com/articles/20859',
          publishedAt: '1999-06-03',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Blake & Rowland — global tropospheric methane increase — 1988 ───────────
  {
    externalId: 'trajectory:blake-rowland-global-methane-increase-1988',
    text: 'Blake and Rowland reported in Science in March 1988 that the average worldwide tropospheric methane mixing ratio rose about 11%, from 1.52 ppmv in January 1978 to 1.684 ppmv in September 1987, an increase of roughly 0.016 ppmv (~1%) per year measured across a global latitude network.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1988-03-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1988-03-04',
        datePrecision: 'DAY',
        reason: 'Blake and Rowland documented a sustained, spatially coherent worldwide rise in tropospheric methane from nearly a decade of systematic flask sampling across latitudes. This established quantitatively that atmospheric methane — a potent greenhouse gas — was increasing globally at about 1% per year, elevating CH₄ to a first-order concern alongside CO₂.',
        source: {
          externalId: 'src:blake-rowland-methane-science-1988',
          name: 'Blake DR, Rowland FS. Continuing worldwide increase in tropospheric methane, 1978 to 1987. Science. 1988;239(4844):1129–1131.',
          url: 'https://www.science.org/doi/10.1126/science.239.4844.1129',
          publishedAt: '1988-03-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1994-08-20',
        datePrecision: 'DAY',
        reason: 'Dlugokencky and colleagues at NOAA independently quantified the global methane growth rate and latitudinal distribution from a dedicated 1983–1992 cooperative flask network referenced to a single calibration scale. The independent, calibration-controlled global record confirmed the worldwide methane rise, settling it as a monitored, institutionally tracked greenhouse-gas trend.',
        source: {
          externalId: 'src:dlugokencky-methane-growth-jgr-1994',
          name: 'Dlugokencky EJ, Steele LP, Lang PM, Masarie KA. The growth rate and distribution of atmospheric methane. J Geophys Res Atmos. 1994;99(D8):17021–17043.',
          url: 'https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/94JD01245',
          publishedAt: '1994-08-20',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── Weiss — tropospheric N₂O increase — 1981 ────────────────────────────────
  {
    externalId: 'trajectory:weiss-tropospheric-n2o-increase-1981',
    text: 'R.F. Weiss reported in the Journal of Geophysical Research in 1981 that precise measurements of tropospheric nitrous oxide (N₂O) collected 1976–1980 across the major oceans showed a global concentration of about 300 ppb rising at roughly 0.2% per year, with the Northern Hemisphere higher than the Southern.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1981-08-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1981-08-20',
        datePrecision: 'DAY',
        reason: 'Weiss provided the first high-precision, globally distributed determination of the tropospheric N₂O burden and its temporal trend, demonstrating a measurable secular increase and a north–south gradient consistent with anthropogenic (largely surface) sources. This recorded N₂O as a rising long-lived greenhouse and ozone-relevant gas rather than a fixed background constituent.',
        source: {
          externalId: 'src:weiss-n2o-distribution-jgr-1981',
          name: 'Weiss RF. The temporal and spatial distribution of tropospheric nitrous oxide. J Geophys Res Oceans. 1981;86(C8):7185–7195.',
          url: 'https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/JC086iC08p07185',
          publishedAt: '1981-08-20',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1990-10-20',
        datePrecision: 'DAY',
        reason: 'Prinn and colleagues deduced N₂O emissions and trends from ten years of the globally distributed ALE-GAGE monitoring network, confirming a sustained rise of about 0.25% per year and a ~110–180-year atmospheric lifetime of largely anthropogenic origin. The multi-station, decade-long calibrated network settled the global N₂O increase first indicated by Weiss.',
        source: {
          externalId: 'src:prinn-n2o-ale-gage-jgr-1990',
          name: 'Prinn R, Cunnold D, Rasmussen R, et al. Atmospheric emissions and trends of nitrous oxide deduced from 10 years of ALE-GAGE data. J Geophys Res Atmos. 1990;95(D11):18369–18385.',
          url: 'https://www.academia.edu/8418906/Atmospheric_emissions_and_trends_of_nitrous_oxide_deduced_from_10_years_of_ALE_GAGE_data',
          publishedAt: '1990-10-20',
          methodologyType: 'derivative',
        },
      },
    ],
  },

]

// ── Seeder (identical to medicine script) ───────────────────────────────────

async function upsertTrajectory(t: Trajectory) {
  const claim = await prisma.claim.upsert({
    where: { externalId: t.externalId },
    create: {
      externalId: t.externalId,
      text: t.text,
      claimType: t.claimType,
      claimEmergedAt: new Date(t.claimEmergedAt),
      claimEmergedPrecision: t.claimEmergedPrecision,
      epistemicAxis: t.currentAxis,
      ingestedBy: 'seed:climate-trajectories',
      deleted: false,
    },
    update: {
      text: t.text,
      claimType: t.claimType,
      claimEmergedAt: new Date(t.claimEmergedAt),
      claimEmergedPrecision: t.claimEmergedPrecision,
      epistemicAxis: t.currentAxis,
    },
  })

  for (let i = 0; i < t.transitions.length; i++) {
    const tr = t.transitions[i]

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: claim.id, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: claim.id, sourceId: source.id, type: 'FOR' } })
    }
  }

  console.log(`  ✓ ${t.externalId} (${t.transitions.length} transitions)`)
}

async function main() {
  console.log(`Seeding ${TRAJECTORIES.length} climate trajectories${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  if (!DRY_RUN) {
    for (const t of TRAJECTORIES) {
      await upsertTrajectory(t)
    }
  } else {
    for (const t of TRAJECTORIES) {
      console.log(`  [dry] ${t.externalId} — ${t.transitions.length} transitions`)
    }
  }

  console.log(`\nDone. ${TRAJECTORIES.length} climate trajectories seeded.`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
