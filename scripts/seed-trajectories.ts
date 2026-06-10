// Seed: curated epistemic trajectories — exercises the Task 7 trajectory model.
//
// This is a SEED script, not an ingestion pipeline. It writes a small, hand-curated
// set of Claims, each with a ClaimStatusHistory "trajectory" pinned to real Sources
// via the new ClaimStatusHistory.sourceId -> Source FK.
//
// The product measures fact-STATUS, not truth, so failure modes are first-class:
// trajectories deliberately include REVERSED (prior consensus overturned) and
// ABANDONED (claim dropped) outcomes alongside clean RECORDED/SETTLED progressions.
//
// Idempotent: Claims and Sources upsert on externalId; each ClaimStatusHistory row
// upserts on a deterministic id, so re-running converges rather than duplicating.
//
// Run:     npx tsx scripts/seed-trajectories.ts
// Dry-run: npx tsx scripts/seed-trajectories.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

// FactStatus vocabulary (kept as String in DB for additivity)
type FactStatus =
  | 'RECORDED'
  | 'SETTLED'
  | 'CONTESTED'
  | 'OPEN'
  | 'UNRESOLVABLE'
  | 'REVERSED'
  | 'ABANDONED'

type RatifyingCommunity =
  | 'EXPERT_LITERATURE'
  | 'INSTITUTIONAL'
  | 'JUDICIAL'
  | 'PUBLIC'
  | 'MARKET'

type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string // ISO date
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // ISO date — the historical date the transition happened
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
  // 5-way epistemicAxis snapshot of where the claim sits today (RECORDED|SETTLED|CONTESTED|OPEN|UNRESOLVABLE)
  currentAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE'
  transitions: Transition[]
}

const TRAJECTORIES: Trajectory[] = [
  // 1. Smoking → lung cancer: multi-community ratification over four decades.
  {
    externalId: 'trajectory:smoking-lung-cancer',
    text: 'Tobacco smoking is a primary cause of lung cancer in humans.',
    claimType: 'HYBRID',
    claimEmergedAt: '1950-09-30',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1950-09-30',
        datePrecision: 'MONTH',
        reason: 'Doll & Hill case-control study links smoking to lung carcinoma; contested by industry for decades.',
        source: {
          externalId: 'src:doll-hill-bmj-1950',
          name: 'Doll R, Hill AB. Smoking and Carcinoma of the Lung. BMJ 1950;2(4682):739-748.',
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2038856/',
          publishedAt: '1950-09-30',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1964-01-11',
        datePrecision: 'DAY',
        reason: 'U.S. Surgeon General Advisory Committee report officially establishes the causal link.',
        source: {
          externalId: 'src:surgeon-general-1964',
          name: 'Smoking and Health: Report of the Advisory Committee to the Surgeon General (1964).',
          url: 'https://profiles.nlm.nih.gov/spotlight/nn/catalog/nlm:nlmuid-101584932X202-doc',
          publishedAt: '1964-01-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'PUBLIC',
        occurredAt: '1998-11-23',
        datePrecision: 'DAY',
        reason: 'Tobacco Master Settlement Agreement marks broad public/legal acceptance of the harm.',
        source: {
          externalId: 'src:tobacco-msa-1998',
          name: 'Tobacco Master Settlement Agreement (1998).',
          url: 'https://www.naag.org/our-work/naag-center-for-tobacco-and-public-health/the-master-settlement-agreement/',
          publishedAt: '1998-11-23',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // 2. H. pylori → peptic ulcers: bacterial cause, ratified after initial skepticism.
  {
    externalId: 'trajectory:hpylori-ulcers',
    text: 'Helicobacter pylori infection is a primary cause of peptic ulcer disease.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1984-06-16',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1984-06-16',
        datePrecision: 'DAY',
        reason: 'Marshall & Warren report curved bacilli in gastric ulcer patients; widely doubted at first.',
        source: {
          externalId: 'src:marshall-warren-lancet-1984',
          name: 'Marshall BJ, Warren JR. Unidentified curved bacilli in the stomach of patients with gastritis and peptic ulceration. Lancet 1984;1(8390):1311-1315.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/6145023/',
          publishedAt: '1984-06-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1994-02-09',
        datePrecision: 'DAY',
        reason: 'NIH Consensus Development Conference endorses H. pylori as the cause and antibiotics as treatment.',
        source: {
          externalId: 'src:nih-consensus-hpylori-1994',
          name: 'NIH Consensus Statement: Helicobacter pylori in Peptic Ulcer Disease (1994).',
          url: 'https://consensus.nih.gov/1994/1994HelicobacterPyloriUlcer094html.htm',
          publishedAt: '1994-02-09',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2005-10-03',
        datePrecision: 'DAY',
        reason: 'Nobel Prize in Physiology or Medicine to Marshall & Warren cements expert consensus.',
        source: {
          externalId: 'src:nobel-2005-hpylori',
          name: 'Nobel Prize in Physiology or Medicine 2005 — Barry J. Marshall and J. Robin Warren.',
          url: 'https://www.nobelprize.org/prizes/medicine/2005/summary/',
          publishedAt: '2005-10-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // 3. Stress/acid theory of ulcers: SETTLED consensus later REVERSED. Failure mode.
  {
    externalId: 'trajectory:stress-acid-ulcers',
    text: 'Psychological stress and excess gastric acid are the primary cause of peptic ulcer disease.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1950-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1950-01-01',
        datePrecision: 'YEAR',
        reason: 'Mid-century gastroenterology consensus attributes ulcers to stress and acid hypersecretion.',
        source: {
          externalId: 'src:wolf-wolff-1947',
          name: 'Wolf S, Wolff HG. Human Gastric Function (1947) — stress/acid model of ulcer disease.',
          url: 'https://www.worldcat.org/title/human-gastric-function/oclc/1467570',
          publishedAt: '1947-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'INSTITUTIONAL',
        occurredAt: '1994-02-09',
        datePrecision: 'DAY',
        reason: 'NIH Consensus reverses prior stress/acid consensus in favor of the H. pylori bacterial cause.',
        source: {
          externalId: 'src:nih-consensus-hpylori-1994',
          name: 'NIH Consensus Statement: Helicobacter pylori in Peptic Ulcer Disease (1994).',
          url: 'https://consensus.nih.gov/1994/1994HelicobacterPyloriUlcer094html.htm',
          publishedAt: '1994-02-09',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // 4. Continental drift: ABANDONED in the 1920s, then REVERSED (revived) in the 1960s.
  {
    externalId: 'trajectory:continental-drift',
    text: 'The continents have drifted across the surface of the Earth over geological time.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1915-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1915-01-01',
        datePrecision: 'YEAR',
        reason: 'Wegener publishes the continental drift hypothesis; mechanism unknown, heavily debated.',
        source: {
          externalId: 'src:wegener-1915',
          name: 'Wegener A. Die Entstehung der Kontinente und Ozeane (1915).',
          url: 'https://www.loc.gov/item/19012737/',
          publishedAt: '1915-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'ABANDONED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1926-11-15',
        datePrecision: 'MONTH',
        reason: 'AAPG symposium rejects continental drift for lack of a plausible mechanism; mainstream geology abandons it.',
        source: {
          externalId: 'src:aapg-symposium-1928',
          name: 'van der Gracht WAJM van Waterschoot (ed.). Theory of Continental Drift: A Symposium (AAPG, 1928).',
          url: 'https://archive.org/details/theoryofcontinen0000unse',
          publishedAt: '1928-01-01',
          methodologyType: 'derivative',
        },
      },
      {
        fromAxis: 'ABANDONED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1963-09-07',
        datePrecision: 'DAY',
        reason: 'Vine & Matthews explain seafloor magnetic striping; plate tectonics revives and settles the idea.',
        source: {
          externalId: 'src:vine-matthews-1963',
          name: 'Vine FJ, Matthews DH. Magnetic Anomalies over Oceanic Ridges. Nature 1963;199:947-949.',
          url: 'https://www.nature.com/articles/199947a0',
          publishedAt: '1963-09-07',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // 5. Dietary saturated fat → heart disease: institutional consensus later re-contested.
  {
    externalId: 'trajectory:dietary-fat-heart',
    text: 'Dietary saturated fat is a primary cause of coronary heart disease.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1953-07-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1953-07-01',
        datePrecision: 'MONTH',
        reason: 'Keys advances the diet-heart hypothesis linking saturated fat to atherosclerosis.',
        source: {
          externalId: 'src:keys-1953',
          name: 'Keys A. Atherosclerosis: a problem in newer public health. J Mt Sinai Hosp 1953;20(2):118-139.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/13085148/',
          publishedAt: '1953-07-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1980-02-01',
        datePrecision: 'MONTH',
        reason: 'First Dietary Guidelines for Americans codify limiting saturated fat as official policy.',
        source: {
          externalId: 'src:dietary-guidelines-1980',
          name: 'Dietary Guidelines for Americans, 1st ed. (USDA/HHS, 1980).',
          url: 'https://www.dietaryguidelines.gov/about-dietary-guidelines/previous-editions/1980-dietary-guidelines',
          publishedAt: '1980-02-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2010-03-01',
        datePrecision: 'MONTH',
        reason: 'Meta-analysis finds no significant association between saturated fat and cardiovascular disease, reopening debate.',
        source: {
          externalId: 'src:siri-tarino-2010',
          name: 'Siri-Tarino PW et al. Meta-analysis of prospective cohort studies evaluating saturated fat and cardiovascular disease. Am J Clin Nutr 2010;91(3):535-546.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/20071648/',
          publishedAt: '2010-03-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // 6. Cold fusion: announced and then ABANDONED within the same year. Failure mode.
  {
    externalId: 'trajectory:cold-fusion',
    text: 'Nuclear fusion of deuterium can be induced electrochemically at room temperature ("cold fusion").',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1989-03-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1989-04-10',
        datePrecision: 'DAY',
        reason: 'Fleischmann & Pons report excess heat from electrolysis, claiming room-temperature fusion.',
        source: {
          externalId: 'src:fleischmann-pons-1989',
          name: 'Fleischmann M, Pons S. Electrochemically induced nuclear fusion of deuterium. J Electroanal Chem 1989;261(2A):301-308.',
          url: 'https://doi.org/10.1016/0022-0728(89)80006-3',
          publishedAt: '1989-04-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'ABANDONED',
        community: 'INSTITUTIONAL',
        occurredAt: '1989-11-01',
        datePrecision: 'MONTH',
        reason: 'U.S. DOE Energy Research Advisory Board finds no convincing evidence; mainstream science abandons the claim.',
        source: {
          externalId: 'src:doe-erab-1989',
          name: 'U.S. DOE Energy Research Advisory Board, Report on Cold Fusion Research (1989).',
          url: 'https://www.osti.gov/biblio/5645305',
          publishedAt: '1989-11-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // 7. Civil Rights Act of 1964: clean institutional fact, judicially affirmed.
  {
    externalId: 'trajectory:civil-rights-act-1964',
    text: 'The Civil Rights Act of 1964 prohibits discrimination on the basis of race, color, religion, sex, or national origin.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1964-07-02',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1964-07-02',
        datePrecision: 'DAY',
        reason: 'Signed into law as Pub. L. 88-352.',
        source: {
          externalId: 'src:civil-rights-act-1964-pl',
          name: 'Civil Rights Act of 1964, Pub. L. 88-352, 78 Stat. 241.',
          url: 'https://www.archives.gov/milestone-documents/civil-rights-act',
          publishedAt: '1964-07-02',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'JUDICIAL',
        occurredAt: '1964-12-14',
        datePrecision: 'DAY',
        reason: 'Supreme Court upholds the public-accommodations provisions in Heart of Atlanta Motel v. United States.',
        source: {
          externalId: 'src:heart-of-atlanta-1964',
          name: 'Heart of Atlanta Motel, Inc. v. United States, 379 U.S. 241 (1964).',
          url: 'https://supreme.justia.com/cases/federal/us/379/241/',
          publishedAt: '1964-12-14',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // 8. Clean Air Act of 1970: clean institutional fact, judicially affirmed decades later.
  {
    externalId: 'trajectory:clean-air-act-1970',
    text: 'The Clean Air Act of 1970 authorizes federal regulation of air pollutant emissions.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1970-12-31',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1970-12-31',
        datePrecision: 'DAY',
        reason: 'Signed into law as Pub. L. 91-604, greatly expanding federal air-quality authority.',
        source: {
          externalId: 'src:clean-air-act-1970-pl',
          name: 'Clean Air Amendments of 1970, Pub. L. 91-604, 84 Stat. 1676.',
          url: 'https://www.epa.gov/clean-air-act-overview/clean-air-act-text',
          publishedAt: '1970-12-31',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'JUDICIAL',
        occurredAt: '2007-04-02',
        datePrecision: 'DAY',
        reason: 'Supreme Court holds the Act authorizes EPA to regulate greenhouse gases in Massachusetts v. EPA.',
        source: {
          externalId: 'src:mass-v-epa-2007',
          name: 'Massachusetts v. Environmental Protection Agency, 549 U.S. 497 (2007).',
          url: 'https://supreme.justia.com/cases/federal/us/549/497/',
          publishedAt: '2007-04-02',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // 9. Voting Rights Act of 1965: institutional fact, affirmed then partially REVERSED judicially.
  {
    externalId: 'trajectory:voting-rights-act-1965',
    text: 'The Voting Rights Act of 1965 prohibits racial discrimination in voting and authorizes federal preclearance of election-law changes.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '1965-08-06',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '1965-08-06',
        datePrecision: 'DAY',
        reason: 'Signed into law as Pub. L. 89-110.',
        source: {
          externalId: 'src:voting-rights-act-1965-pl',
          name: 'Voting Rights Act of 1965, Pub. L. 89-110, 79 Stat. 437.',
          url: 'https://www.archives.gov/milestone-documents/voting-rights-act',
          publishedAt: '1965-08-06',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'JUDICIAL',
        occurredAt: '1966-03-07',
        datePrecision: 'DAY',
        reason: 'Supreme Court upholds the Act, including preclearance, in South Carolina v. Katzenbach.',
        source: {
          externalId: 'src:sc-v-katzenbach-1966',
          name: 'South Carolina v. Katzenbach, 383 U.S. 301 (1966).',
          url: 'https://supreme.justia.com/cases/federal/us/383/301/',
          publishedAt: '1966-03-07',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'REVERSED',
        community: 'JUDICIAL',
        occurredAt: '2013-06-25',
        datePrecision: 'DAY',
        reason: 'Supreme Court strikes the §4(b) coverage formula in Shelby County v. Holder, disabling preclearance.',
        source: {
          externalId: 'src:shelby-county-2013',
          name: 'Shelby County v. Holder, 570 U.S. 529 (2013).',
          url: 'https://supreme.justia.com/cases/federal/us/570/529/',
          publishedAt: '2013-06-25',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // 10. Semaglutide (GLP-1 agonist): compound discovery → Phase 1 → Phase 3 → multi-indication approval.
  {
    externalId: 'trajectory:semaglutide-glp1',
    text: 'Semaglutide (a GLP-1 receptor agonist) reduces blood glucose and body weight in humans.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2010-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1996-01-04',
        datePrecision: 'DAY',
        reason: 'Turton et al. show that ICV GLP-1 powerfully inhibits feeding in fasted rats and that the specific GLP-1 receptor antagonist exendin(9-39) blocks this effect — establishing GLP-1 receptor agonism as a viable target for appetite control.',
        source: {
          externalId: 'src:turton-1996-nature-glp1-feeding',
          name: 'Turton MD, et al. A role for glucagon-like peptide-1 in the central regulation of feeding. Nature. 1996;379(6560):69-72.',
          url: 'https://www.nature.com/articles/379069a0',
          publishedAt: '1996-01-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2001-11-01',
        datePrecision: 'MONTH',
        reason: 'Larsen et al. (Novo Nordisk) demonstrate that systemic administration of NN2211 — a C16 fatty-acid–conjugated GLP-1 analog (proto-liraglutide) — induces lasting, reversible weight loss in both normal and obese rats. First proof that a long-acting GLP-1 agonist works peripherally at therapeutic doses, directly motivating the semaglutide design.',
        source: {
          externalId: 'src:larsen-2001-diabetes-nn2211-rats',
          name: 'Larsen PJ, Fledelius C, Knudsen LB, Tang-Christensen M. Systemic administration of the long-acting GLP-1 derivative NN2211 induces lasting and reversible weight loss in both normal and obese rats. Diabetes. 2001;50(11):2530-9.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/11679426/',
          publishedAt: '2001-11-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2010-01-26',
        datePrecision: 'DAY',
        reason: 'First-in-human Phase 1 trial of semaglutide (NN9535) registered, establishing the compound as an active investigational drug.',
        source: {
          externalId: 'src:nct01262118-semaglutide-p1',
          name: 'NCT01262118 — A Trial Investigating the Safety, Tolerability and Pharmacokinetics of Semaglutide (Novo Nordisk, 2010).',
          url: 'https://clinicaltrials.gov/ct2/show/NCT01262118',
          publishedAt: '2010-01-26',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2015-09-24',
        datePrecision: 'DAY',
        reason: 'Lau et al. publish the first full discovery paper for semaglutide, describing the C18 fatty-diacid conjugate design that confers once-weekly half-life — compound mechanism now in the public record.',
        source: {
          externalId: 'src:lau-2015-jmedchem-semaglutide',
          name: 'Lau J, et al. Discovery of the Once-Weekly GLP-1 Analogue Semaglutide. J Med Chem. 2015;58(18):7370–80.',
          url: 'https://pubmed.ncbi.nlm.nih.gov/26308095/',
          publishedAt: '2015-09-24',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2017-12-05',
        datePrecision: 'DAY',
        reason: 'FDA approves Ozempic (semaglutide 1 mg injectable) under NDA 209637 for type 2 diabetes management.',
        source: {
          externalId: 'src:fda-nda209637-ozempic-2017',
          name: 'FDA Approval NDA 209637 — Ozempic (semaglutide injection) for Type 2 Diabetes (December 5, 2017).',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/appletter/2017/209637Orig1s000ltr.pdf',
          publishedAt: '2017-12-05',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2021-06-04',
        datePrecision: 'DAY',
        reason: 'FDA approves Wegovy (semaglutide 2.4 mg) under NDA 215256 for chronic weight management — the obesity indication extends the settled claim to a second population.',
        source: {
          externalId: 'src:fda-nda215256-wegovy-2021',
          name: 'FDA Approval NDA 215256 — Wegovy (semaglutide injection 2.4 mg) for Chronic Weight Management (June 4, 2021).',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/appletter/2021/215256Orig1s000ltr.pdf',
          publishedAt: '2021-06-04',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // 11. CFCs deplete stratospheric ozone: crosses expert, institutional, and MARKET communities.
  {
    externalId: 'trajectory:cfc-ozone-depletion',
    text: 'Chlorofluorocarbons (CFCs) deplete the stratospheric ozone layer.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1974-06-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1974-06-28',
        datePrecision: 'DAY',
        reason: 'Molina & Rowland predict CFCs catalytically destroy stratospheric ozone.',
        source: {
          externalId: 'src:molina-rowland-1974',
          name: 'Molina MJ, Rowland FS. Stratospheric sink for chlorofluoromethanes. Nature 1974;249:810-812.',
          url: 'https://www.nature.com/articles/249810a0',
          publishedAt: '1974-06-28',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1987-09-16',
        datePrecision: 'DAY',
        reason: 'Montreal Protocol commits nations to phasing out ozone-depleting substances.',
        source: {
          externalId: 'src:montreal-protocol-1987',
          name: 'Montreal Protocol on Substances that Deplete the Ozone Layer (1987).',
          url: 'https://www.unep.org/ozonaction/who-we-are/about-montreal-protocol',
          publishedAt: '1987-09-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'MARKET',
        occurredAt: '1995-12-31',
        datePrecision: 'YEAR',
        reason: 'Developed-country industry halts bulk CFC production, ratifying the science through the market.',
        source: {
          externalId: 'src:cfc-phaseout-1996',
          name: 'UNEP Ozone Secretariat: developed-country CFC production phase-out (effective 1 Jan 1996).',
          url: 'https://ozone.unep.org/treaties/montreal-protocol',
          publishedAt: '1996-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },
]

const REVIEW = {
  ingestedBy: 'seed-trajectories',
  humanReviewed: true,
  reviewConfidence: 'HIGH' as const,
  reviewedBy: 'robert',
}

async function upsertSource(def: SourceDef): Promise<string> {
  if (DRY_RUN) {
    console.log(`    [source] ${def.externalId} — ${def.name}`)
    return `dry:${def.externalId}`
  }
  const s = await prisma.source.upsert({
    where: { externalId: def.externalId },
    create: {
      externalId: def.externalId,
      name: def.name,
      url: def.url,
      publishedAt: new Date(def.publishedAt),
      methodologyType: def.methodologyType,
      ...REVIEW,
      reviewedAt: new Date(),
    },
    update: {
      name: def.name,
      url: def.url,
      publishedAt: new Date(def.publishedAt),
      methodologyType: def.methodologyType,
    },
  })
  return s.id
}

async function seedTrajectory(traj: Trajectory): Promise<void> {
  console.log(`\n▸ ${traj.externalId}`)
  console.log(`  "${traj.text}"`)

  let claimId = `dry:${traj.externalId}`
  if (!DRY_RUN) {
    const claim = await prisma.claim.upsert({
      where: { externalId: traj.externalId },
      create: {
        externalId: traj.externalId,
        text: traj.text,
        claimType: traj.claimType,
        claimEmergedAt: new Date(traj.claimEmergedAt),
        claimEmergedPrecision: traj.claimEmergedPrecision,
        epistemicAxis: traj.currentAxis,
        ...REVIEW,
        reviewedAt: new Date(),
      },
      update: {
        text: traj.text,
        claimType: traj.claimType,
        claimEmergedAt: new Date(traj.claimEmergedAt),
        claimEmergedPrecision: traj.claimEmergedPrecision,
        epistemicAxis: traj.currentAxis,
      },
    })
    claimId = claim.id
  }

  for (let i = 0; i < traj.transitions.length; i++) {
    const t = traj.transitions[i]
    const sourceId = await upsertSource(t.source)
    const historyId = `${traj.externalId}:${i}`
    console.log(
      `  [${i}] ${t.fromAxis ?? '∅'} → ${t.toAxis}  (${t.community}, ${t.occurredAt})`,
    )
    if (DRY_RUN) continue
    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
        claimId,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId,
      },
    })
  }
}

async function main() {
  console.log(`=== Seed Trajectories ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`)
  const transitionCount = TRAJECTORIES.reduce((n, t) => n + t.transitions.length, 0)
  console.log(`${TRAJECTORIES.length} trajectories, ${transitionCount} transitions`)

  for (const traj of TRAJECTORIES) {
    await seedTrajectory(traj)
  }

  console.log(`\n✓ Done${DRY_RUN ? ' (dry run)' : ''}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
