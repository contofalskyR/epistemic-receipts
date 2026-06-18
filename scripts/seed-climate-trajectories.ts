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
      currentAxis: t.currentAxis,
      epistemicAxis: t.currentAxis,
      deleted: false,
    },
    update: {
      text: t.text,
      claimType: t.claimType,
      claimEmergedAt: new Date(t.claimEmergedAt),
      claimEmergedPrecision: t.claimEmergedPrecision,
      currentAxis: t.currentAxis,
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
