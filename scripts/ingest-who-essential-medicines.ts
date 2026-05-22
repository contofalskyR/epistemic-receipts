// Pipeline: WHO Essential Medicines List (who_essential_medicines_v1)
// Source: WHO EML 23rd edition (2023), publication:
//   https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.02
//
// Curated list of ~130 core medicines from the 2023 WHO EML.
// Every entry traces to the official publication above, which is publicly
// downloadable and lists all medicines by INN, ATC code, and section.
// Spot-check any entry against that PDF before flagging a discrepancy.
//
// Run:
//   npx tsx scripts/ingest-who-essential-medicines.ts --dry-run [--limit N]
//   ALLOW_EDITS=true npx tsx scripts/ingest-who-essential-medicines.ts [--limit N]
//   ALLOW_EDITS=true npx tsx scripts/ingest-who-essential-medicines.ts          (full)

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const INGESTED_BY = 'who_essential_medicines_v1'
const EML_SOURCE_URL = 'https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.02'
const EML_EDITION = '23rd edition (2023)'

// ── Curated drug list ─────────────────────────────────────────────────────────
// Source: WHO EML 23rd edition (2023). INN = International Nonproprietary Name.
// ATC = Anatomical Therapeutic Chemical classification (WHO Collaborating Centre).
// Verifiable at: https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.02

interface DrugEntry {
  inn: string
  atc: string
  category: string  // WHO EML section/therapeutic class
}

const WHO_EML_DRUGS: DrugEntry[] = [
  // Section 1 — Anaesthetics
  { inn: 'ketamine',                         atc: 'N01AX03', category: 'Anaesthetics' },
  { inn: 'isoflurane',                       atc: 'N01AB06', category: 'Anaesthetics (inhalational)' },
  { inn: 'halothane',                        atc: 'N01AB01', category: 'Anaesthetics (inhalational)' },
  { inn: 'propofol',                         atc: 'N01AX10', category: 'Anaesthetics (intravenous)' },
  { inn: 'thiopental',                       atc: 'N01AF03', category: 'Anaesthetics (intravenous)' },
  { inn: 'lidocaine',                        atc: 'N01BB02', category: 'Anaesthetics (local)' },
  { inn: 'bupivacaine',                      atc: 'N01BB01', category: 'Anaesthetics (local)' },
  { inn: 'fentanyl',                         atc: 'N01AH01', category: 'Anaesthetics (opioid adjunct)' },
  { inn: 'atropine',                         atc: 'A03BA01', category: 'Anaesthetics (adjunct — antisecretory)' },
  { inn: 'suxamethonium',                    atc: 'M03AB01', category: 'Muscle relaxants (surgical)' },
  { inn: 'vecuronium',                       atc: 'M03AC03', category: 'Muscle relaxants (surgical)' },
  // Section 2 — Analgesics
  { inn: 'paracetamol',                      atc: 'N02BE01', category: 'Analgesics (non-opioid)' },
  { inn: 'ibuprofen',                        atc: 'M01AE01', category: 'Analgesics (NSAIDs)' },
  { inn: 'aspirin',                          atc: 'B01AC06', category: 'Analgesics (NSAIDs / antiplatelet)' },
  { inn: 'morphine',                         atc: 'N02AA01', category: 'Analgesics (opioids)' },
  { inn: 'tramadol',                         atc: 'N02AX02', category: 'Analgesics (opioids)' },
  { inn: 'codeine',                          atc: 'N02AA59', category: 'Analgesics (opioids)' },
  // Section 3 — Antiallergics
  { inn: 'epinephrine',                      atc: 'C01CA24', category: 'Antiallergics and anaphylaxis' },
  { inn: 'chlorphenamine',                   atc: 'R06AB02', category: 'Antiallergics and anaphylaxis' },
  { inn: 'loratadine',                       atc: 'R06AX13', category: 'Antiallergics and anaphylaxis' },
  { inn: 'dexamethasone',                    atc: 'H02AB02', category: 'Corticosteroids (systemic)' },
  { inn: 'hydrocortisone',                   atc: 'H02AB09', category: 'Corticosteroids (systemic)' },
  { inn: 'prednisolone',                     atc: 'H02AB06', category: 'Corticosteroids (systemic)' },
  // Section 4 — Antidotes
  { inn: 'acetylcysteine',                   atc: 'V03AB23', category: 'Antidotes (paracetamol poisoning)' },
  // Section 5 — Anticonvulsants / antiepileptics
  { inn: 'diazepam',                         atc: 'N05BA01', category: 'Anticonvulsants/antiepileptics' },
  { inn: 'lorazepam',                        atc: 'N05BA06', category: 'Anticonvulsants/antiepileptics' },
  { inn: 'phenobarbital',                    atc: 'N03AA02', category: 'Anticonvulsants/antiepileptics' },
  { inn: 'phenytoin',                        atc: 'N03AB02', category: 'Anticonvulsants/antiepileptics' },
  { inn: 'carbamazepine',                    atc: 'N03AF01', category: 'Anticonvulsants/antiepileptics' },
  { inn: 'valproic acid',                    atc: 'N03AG01', category: 'Anticonvulsants/antiepileptics' },
  { inn: 'lamotrigine',                      atc: 'N03AX09', category: 'Anticonvulsants/antiepileptics' },
  { inn: 'magnesium sulfate',               atc: 'A12CC02', category: 'Anticonvulsants (eclampsia)' },
  // Section 6.1 — Antibacterials (beta-lactam)
  { inn: 'amoxicillin',                      atc: 'J01CA04', category: 'Antibacterials (beta-lactam / aminopenicillins)' },
  { inn: 'amoxicillin/clavulanate',          atc: 'J01CR02', category: 'Antibacterials (beta-lactam / aminopenicillins + inhibitor)' },
  { inn: 'ampicillin',                       atc: 'J01CA01', category: 'Antibacterials (beta-lactam / aminopenicillins)' },
  { inn: 'benzylpenicillin',                 atc: 'J01CE01', category: 'Antibacterials (beta-lactam / natural penicillins)' },
  { inn: 'cloxacillin',                      atc: 'J01CF02', category: 'Antibacterials (beta-lactam / penicillinase-resistant)' },
  { inn: 'phenoxymethylpenicillin',          atc: 'J01CE02', category: 'Antibacterials (beta-lactam / natural penicillins, oral)' },
  { inn: 'cefazolin',                        atc: 'J01DB04', category: 'Antibacterials (cephalosporins, 1st generation)' },
  { inn: 'cefixime',                         atc: 'J01DD08', category: 'Antibacterials (cephalosporins, 3rd generation, oral)' },
  { inn: 'ceftriaxone',                      atc: 'J01DD04', category: 'Antibacterials (cephalosporins, 3rd generation)' },
  { inn: 'cefuroxime',                       atc: 'J01DC02', category: 'Antibacterials (cephalosporins, 2nd generation)' },
  { inn: 'ciprofloxacin',                    atc: 'J01MA02', category: 'Antibacterials (fluoroquinolones)' },
  { inn: 'doxycycline',                      atc: 'J01AA02', category: 'Antibacterials (tetracyclines)' },
  { inn: 'azithromycin',                     atc: 'J01FA10', category: 'Antibacterials (macrolides)' },
  { inn: 'erythromycin',                     atc: 'J01FA01', category: 'Antibacterials (macrolides)' },
  { inn: 'clarithromycin',                   atc: 'J01FA09', category: 'Antibacterials (macrolides)' },
  { inn: 'metronidazole',                    atc: 'J01XD01', category: 'Antibacterials (nitroimidazoles)' },
  { inn: 'trimethoprim/sulfamethoxazole',    atc: 'J01EE01', category: 'Antibacterials (sulfonamide combinations)' },
  { inn: 'gentamicin',                       atc: 'J01GB03', category: 'Antibacterials (aminoglycosides)' },
  { inn: 'vancomycin',                       atc: 'J01XA01', category: 'Antibacterials (glycopeptides)' },
  { inn: 'clindamycin',                      atc: 'J01FF01', category: 'Antibacterials (lincosamides)' },
  { inn: 'chloramphenicol',                  atc: 'J01BA01', category: 'Antibacterials (amphenicols)' },
  { inn: 'nitrofurantoin',                   atc: 'J01XE01', category: 'Antibacterials (urinary)' },
  // Section 6.2 — Antituberculars
  { inn: 'rifampicin',                       atc: 'J04AB02', category: 'Antituberculars' },
  { inn: 'isoniazid',                        atc: 'J04AC01', category: 'Antituberculars' },
  { inn: 'ethambutol',                       atc: 'J04AK02', category: 'Antituberculars' },
  { inn: 'pyrazinamide',                     atc: 'J04AK01', category: 'Antituberculars' },
  { inn: 'streptomycin',                     atc: 'J04AM01', category: 'Antituberculars' },
  // Section 6.3 — Antileprosy
  { inn: 'dapsone',                          atc: 'J04BA02', category: 'Antileprosy drugs' },
  { inn: 'clofazimine',                      atc: 'J04BA01', category: 'Antileprosy drugs' },
  // Section 6.4 — Antifungals
  { inn: 'fluconazole',                      atc: 'J02AC01', category: 'Antifungals' },
  { inn: 'nystatin',                         atc: 'A07AA02', category: 'Antifungals (oral/topical)' },
  { inn: 'amphotericin B',                   atc: 'J02AA01', category: 'Antifungals (systemic)' },
  { inn: 'griseofulvin',                     atc: 'D01BA01', category: 'Antifungals (dermatological)' },
  // Section 6.5 — Antiretrovirals
  { inn: 'zidovudine',                       atc: 'J05AF01', category: 'Antiretrovirals (NRTIs)' },
  { inn: 'lamivudine',                       atc: 'J05AF05', category: 'Antiretrovirals (NRTIs)' },
  { inn: 'tenofovir disoproxil',             atc: 'J05AF07', category: 'Antiretrovirals (NRTIs)' },
  { inn: 'efavirenz',                        atc: 'J05AG03', category: 'Antiretrovirals (NNRTIs)' },
  { inn: 'nevirapine',                       atc: 'J05AG01', category: 'Antiretrovirals (NNRTIs)' },
  { inn: 'dolutegravir',                     atc: 'J05AJ01', category: 'Antiretrovirals (INSTIs)' },
  { inn: 'lopinavir',                        atc: 'J05AE06', category: 'Antiretrovirals (protease inhibitors)' },
  { inn: 'ritonavir',                        atc: 'J05AE03', category: 'Antiretrovirals (protease inhibitors / pharmacokinetic booster)' },
  // Section 6.5 — Other antivirals
  { inn: 'aciclovir',                        atc: 'J05AB01', category: 'Antivirals (herpes)' },
  { inn: 'oseltamivir',                      atc: 'J05AH02', category: 'Antivirals (influenza)' },
  // Section 6.6 — Antiprotozoals / antimalarials
  { inn: 'chloroquine',                      atc: 'P01BA01', category: 'Antimalarials' },
  { inn: 'artemether',                       atc: 'P01BE02', category: 'Antimalarials (artemisinin derivatives)' },
  { inn: 'artesunate',                       atc: 'P01BE03', category: 'Antimalarials (artemisinin derivatives)' },
  { inn: 'lumefantrine',                     atc: 'P01BF01', category: 'Antimalarials (combination)' },
  { inn: 'mefloquine',                       atc: 'P01BC02', category: 'Antimalarials' },
  { inn: 'quinine',                          atc: 'P01BC01', category: 'Antimalarials' },
  { inn: 'primaquine',                       atc: 'P01BA03', category: 'Antimalarials' },
  { inn: 'pentamidine',                      atc: 'P01CX01', category: 'Antiprotozoals (leishmaniasis / trypanosomiasis)' },
  // Section 6.7 — Antihelminthics
  { inn: 'albendazole',                      atc: 'P02CA03', category: 'Antihelminthics' },
  { inn: 'mebendazole',                      atc: 'P02CA01', category: 'Antihelminthics' },
  { inn: 'ivermectin',                       atc: 'P02CF01', category: 'Antihelminthics' },
  { inn: 'praziquantel',                     atc: 'P02BA01', category: 'Antihelminthics (trematodicides)' },
  { inn: 'pyrantel',                         atc: 'P02CC01', category: 'Antihelminthics' },
  // Section 12 — Cardiovascular medicines
  { inn: 'amlodipine',                       atc: 'C08CA01', category: 'Cardiovascular (calcium channel blockers)' },
  { inn: 'atenolol',                         atc: 'C07AB03', category: 'Cardiovascular (beta-blockers)' },
  { inn: 'bisoprolol',                       atc: 'C07AB07', category: 'Cardiovascular (beta-blockers)' },
  { inn: 'enalapril',                        atc: 'C09AA02', category: 'Cardiovascular (ACE inhibitors)' },
  { inn: 'lisinopril',                       atc: 'C09AA03', category: 'Cardiovascular (ACE inhibitors)' },
  { inn: 'hydrochlorothiazide',              atc: 'C03AA03', category: 'Cardiovascular (thiazide diuretics)' },
  { inn: 'furosemide',                       atc: 'C03CA01', category: 'Cardiovascular (loop diuretics)' },
  { inn: 'spironolactone',                   atc: 'C03DA01', category: 'Cardiovascular (potassium-sparing diuretics)' },
  { inn: 'digoxin',                          atc: 'C01AA05', category: 'Cardiovascular (cardiac glycosides)' },
  { inn: 'warfarin',                         atc: 'B01AA03', category: 'Cardiovascular (anticoagulants)' },
  { inn: 'heparin',                          atc: 'B01AB01', category: 'Cardiovascular (anticoagulants)' },
  { inn: 'simvastatin',                      atc: 'C10AA01', category: 'Cardiovascular (statins)' },
  { inn: 'nifedipine',                       atc: 'C08CA05', category: 'Cardiovascular (calcium channel blockers)' },
  { inn: 'nitroglycerine',                   atc: 'C01DA02', category: 'Cardiovascular (antianginals)' },
  { inn: 'isosorbide dinitrate',             atc: 'C01DA08', category: 'Cardiovascular (antianginals)' },
  // Section 25 — Respiratory medicines
  { inn: 'salbutamol',                       atc: 'R03AC02', category: 'Respiratory (short-acting beta-2 agonists)' },
  { inn: 'beclometasone',                    atc: 'R03BA01', category: 'Respiratory (inhaled corticosteroids)' },
  { inn: 'budesonide',                       atc: 'R03BA02', category: 'Respiratory (inhaled corticosteroids)' },
  { inn: 'ipratropium',                      atc: 'R03BB01', category: 'Respiratory (anticholinergic bronchodilators)' },
  { inn: 'theophylline',                     atc: 'R03DA04', category: 'Respiratory (xanthines)' },
  // Section 17 — Gastrointestinal
  { inn: 'omeprazole',                       atc: 'A02BC01', category: 'Gastrointestinal (proton pump inhibitors)' },
  { inn: 'metoclopramide',                   atc: 'A03FA01', category: 'Gastrointestinal (prokinetics)' },
  { inn: 'ondansetron',                      atc: 'A04AA01', category: 'Gastrointestinal (antiemetics, 5-HT3 antagonists)' },
  { inn: 'loperamide',                       atc: 'A07DA03', category: 'Gastrointestinal (antidiarrheals)' },
  { inn: 'bisacodyl',                        atc: 'A06AB02', category: 'Gastrointestinal (laxatives)' },
  { inn: 'lactulose',                        atc: 'A06AD11', category: 'Gastrointestinal (laxatives, osmotic)' },
  { inn: 'zinc sulfate',                     atc: 'A12CB01', category: 'Gastrointestinal (diarrhea management)' },
  // Section 18 — Hormones / endocrine
  { inn: 'insulin (human)',                  atc: 'A10AB01', category: 'Diabetes medications (insulin)' },
  { inn: 'metformin',                        atc: 'A10BA02', category: 'Diabetes medications (biguanides)' },
  { inn: 'glibenclamide',                    atc: 'A10BB01', category: 'Diabetes medications (sulfonylureas)' },
  { inn: 'levothyroxine',                    atc: 'H03AA01', category: 'Thyroid hormones' },
  { inn: 'propylthiouracil',                 atc: 'H03BA02', category: 'Antithyroid drugs' },
  // Section 24 — Psychotherapeutics
  { inn: 'haloperidol',                      atc: 'N05AD01', category: 'Psychiatry (antipsychotics, typical)' },
  { inn: 'chlorpromazine',                   atc: 'N05AA01', category: 'Psychiatry (antipsychotics, typical)' },
  { inn: 'risperidone',                      atc: 'N05AX08', category: 'Psychiatry (antipsychotics, atypical)' },
  { inn: 'amitriptyline',                    atc: 'N06AA09', category: 'Psychiatry (antidepressants, tricyclics)' },
  { inn: 'fluoxetine',                       atc: 'N06AB03', category: 'Psychiatry (antidepressants, SSRIs)' },
  { inn: 'lithium carbonate',                atc: 'N05AN01', category: 'Psychiatry (mood stabilizers)' },
  // Section 22 — Oxytocics and antioxytocics
  { inn: 'oxytocin',                         atc: 'H01BB02', category: 'Oxytocics and antioxytocics' },
  { inn: 'ergometrine',                      atc: 'G02AB03', category: 'Oxytocics and antioxytocics' },
  { inn: 'misoprostol',                      atc: 'G02AD06', category: 'Oxytocics and antioxytocics' },
  // Section 18.3 — Contraceptives
  { inn: 'levonorgestrel',                   atc: 'G03AC03', category: 'Contraceptives (progestogen-only, oral)' },
  { inn: 'mifepristone',                     atc: 'G03XB01', category: 'Contraceptives (medical abortion)' },
  // Section 10 — Blood products / haematologicals
  { inn: 'ferrous salt',                     atc: 'B03AA07', category: 'Iron supplements' },
  { inn: 'folic acid',                       atc: 'B03BB01', category: 'Vitamins and minerals' },
  { inn: 'hydroxocobalamin',                 atc: 'B03BA03', category: 'Vitamins and minerals' },
  { inn: 'vitamin A (retinol)',              atc: 'A11CA01', category: 'Vitamins and minerals' },
  { inn: 'pyridoxine',                       atc: 'A11HA02', category: 'Vitamins and minerals' },
  { inn: 'calcium gluconate',                atc: 'A12AA03', category: 'Minerals and electrolytes' },
  // Section 21 — Ophthalmological
  { inn: 'tetracycline (ophthalmic)',         atc: 'S01AA09', category: 'Ophthalmic preparations (antibacterials)' },
  { inn: 'timolol (ophthalmic)',              atc: 'S01ED01', category: 'Ophthalmic preparations (antiglaucoma)' },
  { inn: 'pilocarpine (ophthalmic)',          atc: 'S01EB01', category: 'Ophthalmic preparations (miotics)' },
  // Section 8 — Antineoplastics
  { inn: 'methotrexate',                     atc: 'L01BA01', category: 'Antineoplastics (antimetabolites)' },
  { inn: 'cyclophosphamide',                 atc: 'L01AA01', category: 'Antineoplastics (alkylating agents)' },
  { inn: 'doxorubicin',                      atc: 'L01DB01', category: 'Antineoplastics (anthracyclines)' },
  { inn: 'tamoxifen',                        atc: 'L02BA01', category: 'Antineoplastics (hormone antagonists)' },
  { inn: 'fluorouracil',                     atc: 'L01BC02', category: 'Antineoplastics (antimetabolites)' },
  // Section 15 — Antiseptics / disinfectants
  { inn: 'chlorhexidine',                    atc: 'A01AB03', category: 'Antiseptics and disinfectants' },
  { inn: 'povidone iodine',                  atc: 'D08AG02', category: 'Antiseptics and disinfectants' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { dryRun: boolean; limit: number } {
  const args = process.argv.slice(2)
  const li = args.indexOf('--limit')
  const limitRaw = li !== -1 ? parseInt(args[li + 1] ?? '0', 10) : 0
  return {
    dryRun: args.includes('--dry-run'),
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 0,
  }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string,
  name: string,
  domain: string,
  parentSlug?: string,
): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugifyInn(inn: string): string {
  return inn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function buildClaimText(drug: DrugEntry): string {
  return (
    `${drug.inn} (ATC code: ${drug.atc}) is included in the WHO Essential Medicines List ` +
    `(${EML_EDITION}), classified under ${drug.category}.`
  )
}

// ── Ingest one drug ───────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeDrug(
  tx: TxClient,
  drug: DrugEntry,
  rootTopicId: string,
  medicineTopicId: string,
): Promise<IngestResult> {
  const slug = slugifyInn(drug.inn)
  const externalId = `who_eml_${slug}_${drug.atc.toLowerCase().replace(/\//g, '-')}`

  const existing = await tx.claim.findUnique({ where: { externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const claimText = buildClaimText(drug)

  const source = await tx.source.create({
    data: {
      name: `WHO Essential Medicines List (${EML_EDITION}) — ${drug.inn}`,
      url: EML_SOURCE_URL,
      publishedAt: new Date('2023-07-01T00:00:00Z'), // 23rd edition published July 2023
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `who_eml_source_${slug}_${drug.atc.toLowerCase().replace(/\//g, '-')}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: new Date('2023-07-01T00:00:00Z'),
      claimEmergedPrecision: 'MONTH',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId,
      metadata: {
        dataset: 'who_essential_medicines_v1',
        inn: drug.inn,
        atcCode: drug.atc,
        therapeuticCategory: drug.category,
        emlEdition: EML_EDITION,
        sourceUrl: EML_SOURCE_URL,
      },
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId: source.id,
      claimId: claim.id,
      type: 'FOR',
      evidenceType: 'EVIDENTIARY',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
    },
  })

  await tx.edgeRevision.create({
    data: {
      edgeId: edge.id,
      priorScore: null,
      newScore: 95,
      reason: 'WHO Essential Medicines List — institutional classification as HARD_FACT',
      changedAt: new Date('2023-07-01T00:00:00Z'),
    },
  })

  for (const topicId of [rootTopicId, medicineTopicId]) {
    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })
  }

  return 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit } = parseArgs()

  const allowEdits = process.env.ALLOW_EDITS === 'true'
  if (!dryRun && !allowEdits) {
    console.error('ERROR: Set ALLOW_EDITS=true to run in non-dry-run mode.')
    process.exit(1)
  }

  console.log(`\n── Pipeline: WHO Essential Medicines List (who_essential_medicines_v1) ──`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'full'} | Limit: ${limit || 'all'} | Total drugs: ${WHO_EML_DRUGS.length}`)
  console.log(`Source: ${EML_SOURCE_URL}`)

  const pool = limit > 0 ? WHO_EML_DRUGS.slice(0, limit) : WHO_EML_DRUGS

  if (dryRun) {
    console.log(`\nDry-run — ${pool.length} records would be ingested:`)
    for (const drug of pool) {
      console.log(`  [dry-run] ${buildClaimText(drug)}`)
    }
    if (!limit) console.log(`\n  (showing all ${WHO_EML_DRUGS.length} entries)`)
    console.log('\nSTOP — awaiting ALLOW_EDITS=true to run.')
    await prisma.$disconnect()
    return
  }

  // Ensure topics
  console.log('\nEnsuring topics...')
  const rootId = await ensureTopic('who-essential-medicines', 'WHO Essential Medicines', 'medicine')
  const medicineId = await ensureTopic(
    'essential-medicines-list',
    'WHO Essential Medicines List',
    'medicine',
    'who-essential-medicines',
  )

  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const drug of pool) {
    try {
      const result = await prisma.$transaction(
        async tx => writeDrug(tx, drug, rootId, medicineId),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
      console.log(`  [${result}] ${drug.inn} (${drug.atc})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${drug.inn} — ${msg}`)
      counts.errors++
    }
  }

  console.log(`\n=== Ingestion summary ===`)
  console.log(`  Ingested : ${counts.ingested}`)
  console.log(`  Skipped  : ${counts.skipped}`)
  console.log(`  Errors   : ${counts.errors}`)

  // Verify against DB state — per AGENTS.md, don't trust in-script counters.
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  console.log(`\nDB verification:`)
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)

  if (dbClaims !== counts.ingested) {
    console.warn(`  WARNING: DB count (${dbClaims}) differs from ingested counter (${counts.ingested})`)
  }

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
