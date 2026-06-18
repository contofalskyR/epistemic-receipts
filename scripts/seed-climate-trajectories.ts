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
  currentAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE'
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
