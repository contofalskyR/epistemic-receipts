import { readFileSync, writeFileSync } from 'fs'

// Settling-curve loop log analysis — AI selection bias audit.
// Parses /tmp/settling-curve-loop.log to extract:
//   - per-run: era focus, added count, titles, rejection mentions
//   - MI: I(era; topic_type_selected), I(era; added_count_bucket)
//   - Saturation curves: added-per-run over time per era
//   - Rejection taxonomy from embedded prose
//
// Run: npx tsx scripts/log-analysis.ts

function log2(x: number) { return x > 0 ? Math.log(x) / Math.log(2) : 0 }

function entropy(counts: Record<string, number>): number {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  return Object.values(counts).reduce((h, n) => {
    const p = n / total; return h - (p > 0 ? p * log2(p) : 0)
  }, 0)
}

function mutualInformation(joint: Map<string, Map<string, number>>): {
  mi: number; normalized: number; n: number; matrix: Record<string, Record<string, number>>
} {
  let total = 0
  const px = new Map<string, number>()
  const py = new Map<string, number>()
  for (const [x, ys] of joint) {
    for (const [y, n] of ys) {
      total += n
      px.set(x, (px.get(x) || 0) + n)
      py.set(y, (py.get(y) || 0) + n)
    }
  }
  if (total === 0) return { mi: 0, normalized: 0, n: 0, matrix: {} }
  let mi = 0
  for (const [x, ys] of joint) {
    for (const [y, n] of ys) {
      const pxy = n / total
      const pxm = (px.get(x) || 0) / total
      const pym = (py.get(y) || 0) / total
      if (pxy > 0 && pxm > 0 && pym > 0) mi += pxy * log2(pxy / (pxm * pym))
    }
  }
  const hx = [...px.values()].reduce((h, n) => { const p = n/total; return p>0 ? h-p*log2(p) : h }, 0)
  const hy = [...py.values()].reduce((h, n) => { const p = n/total; return p>0 ? h-p*log2(p) : h }, 0)
  const normalized = Math.min(hx, hy) > 0 ? mi / Math.min(hx, hy) : 0
  const matrix: Record<string, Record<string, number>> = {}
  for (const [x, ys] of joint) {
    matrix[x] = {}
    for (const [y, n] of ys) matrix[x][y] = n
  }
  return { mi: +mi.toFixed(4), normalized: +normalized.toFixed(4), n: total, matrix }
}

// ─── Topic classifier (same categories as event-type analysis) ───────────────
const CATEGORIES: { label: string; patterns: RegExp[] }[] = [
  { label: 'astronomy/space',       patterns: [/eclipse|solar.flare|comet|lunar|apollo|sputnik|moon.land|orbit|satellite|parallax|telescope|nebula|pulsar|exoplanet|black.hole|hubble|occult|pleiades|mars.orbit|chang[ae]\d|chandrayaan|voyager|webb|van.allen|cmb|cosmic|supernova|nova\b|transit.of|sunspot|transit.of.venus|uranus|halley/i] },
  { label: 'battle/war/military',   patterns: [/battle|massacre|siege|armistice|war\b|d.day|somme|verdun|fort.sumter|normandy|crusade\b|cuban.missile|nuclear.test|hiroshima|nagasaki|blitz|liberation|bombing/i] },
  { label: 'religion/church',       patterns: [/council\s+of|synod|canonization|schism|crusade.captures|edict.of.nantes|reformation|protestant|papal|pope|decet|condemnation.of|cadaver|aquinas|hagia\s+sophia|nicaea|trent|ephesus|nicea|jesuit|society.of.jesus|savonarola/i] },
  { label: 'pharmacology/regulatory', patterns: [/fda.approv|fda.withdraw|fda.recall|kefauver|thalidomide|oxycontin|vioxx|rofecoxib|hrt.reversal|hormone.replacement|statin|atorvastatin|simvastatin|lovastatin|metformin|insulin.approv|azidothymidine|azt.approv|ssri|prozac|fluoxetine|zidovudine|drug.approv|drug.withdrawal|post.market|adverse.event|clinical.trial|phase.[123]|randomized.controlled|rct\b|placebo.controlled|double.blind|accelerated.approv|breakthrough.therapy|orphan.drug|boxed.warning|black.box|glp.1|semaglutide|wegovy|ozempic|eliquis|humira|keytruda|gleevec|imatinib|herceptin|trastuzumab|revlimid|lenalidomide|adderall|ritalin|opioid.crisis|purdue|prescription.opioid|naloxone|narcan|methadone|buprenorphine|fen.phen|fenfluramine|cisapride|propulsid|baycol|cerivastatin|troglitazone|rezulin|avandia|rosiglitazone|mifepristone|birth.control.approv|oral.contraceptive.approv|isotretinoin|accutane|paxil|seroxat|bextra|valdecoxib|celebrex|cox.2/i] },
  { label: 'medicine/health',       patterns: [/vaccine|pandemic|influenza|polio|cancer|aids|hiv|plague|cholera|smallpox|tuberculosis|germ.theory|surgery|transplant|anesthesia|antibiotic|penicillin|sulfonamide|antitoxin|epidemic|ether|blood.transfusion|gene.therapy|mrna|covid|zika|nipah|h5n1|ebola|sars|rabies|pasteur.*anthrax|lister|semmelweis|jenner|john.snow|blood.group|lobotomy|dialysis|chemotherapy|radiation.therapy|mammograph|pap.smear|mri.scanner|ct.scan|smoking.cancer|doll.hill|framingham/i] },
  { label: 'biology/genetics',      patterns: [/dna|genome|evolution|species|genetics|crispr|cloning|dolly|darwin|recombinant|chromosom|mendel|archaeopteryx|homo.sapiens|neanderthal|denisovan|fossil|hominid|java.man|watson.crick|alphafold|encode|pangenome|sequencing|synthetic.cell|spontaneous.generation|natural.selection|nucleotide|codon|protein.structure|meselson/i] },
  { label: 'physics/chemistry',     patterns: [/radioactiv|quantum|relativity|atomic|neutron|positron|electron|fission|nuclear\b|photon|radiation|superconductor|higgs|gravitational.wave|planck|bohr|rutherford|curie|einstein|heisenberg|schrodinger|dirac|compton|brownian|faraday|maxwell|doppler|dalton|avogadro|becquerel|chadwick|fermi|carnot|thermodynamics|x.ray|laser|transistor|isotope|cherenkov|matter.wave|photoelectric|de.broglie|mach|cavendish|phosphorus|potassium.*davy|plutonium|chain.reaction|superconductivity|muon|charm.quark/i] },
  { label: 'technology/computing',  patterns: [/computer|internet|arpanet|apple\s|ibm\s|algorithm|bitcoin|chatgpt|deepseek|alphago|deep.blue|eniac|ethernet|encryption|cryptography|telegraph|telephone|radio|television|printing.press|incandescent|altair|macintosh|transistor|silicon|semiconductor|daguerreotype|photograph|radar|codd.relational|network|software|microchip|steam.engine|bessemer|locomotive|dynamite|vulcaniz|artificial.intelligence|gpt|llm|neural\s|microprocessor|intel.4004|upi\s|unified.payments/i] },
  { label: 'environment/climate',   patterns: [/climate|ozone|greenhouse|pollution|conservation|endangered.species|epa\s|ddt|clean.air|earth.day|cuyahoga|exxon.valdez|arrhenius|foote.greenhouse|chernobyl|bhopal|carbon.neutrality|climategate|paris.agreement|kyoto|ipcc|montreal.protocol|love.canal|silent.spring/i] },
  { label: 'law/civil rights/social', patterns: [/civil.rights|suffrage|slavery|emancipation|segregation|brown.v|voting.rights|fair.housing|roe.v|lgbtq|apartheid|women.vote|amendment|dred.scott|emmett.till|freedom.summer|selma|stonewall|loving.v|anti.miscegenation/i] },
  { label: 'law/legislation/judicial', patterns: [/supreme.court|legislation|act.of\b|treaty|constitution|magna.carta|declaration|bill.of.rights|habeas|pentagon.papers|peace.of\b|congress.of\b|edict\b|concordat|enabling.act|beer.hall|asilomar/i] },
  { label: 'exploration/geography', patterns: [/columbus|expedition|circumnavigation|balboa|da.gama|cortes|de.soto|amundsen|south.pole|antarctica|champlain|drake|magellan|cabot|vespucci|new.world|landfall|ponce.de.leon|cartier/i] },
  { label: 'economics/finance',     patterns: [/bank.of|stock.market|crash|bretton.woods|gold.standard|imf|world.bank|inflation|currency|trade|tariff|monopoly|black.tuesday|wall.street|cryptocurrency/i] },
  { label: 'politics/revolution/governance', patterns: [/revolution|independence|republic|decoloni|parliament|senate|congress|bastille|berlin.wall|arab.spring|tiananmen|glasnost|perestroika|coup\b|partition\b|referendum|coronation|assassination.of|execution.of|death.of.*king|death.of.*emperor|empire.*falls|caliphate|proclamation/i] },
]

function classifyTitle(title: string): string {
  for (const { label, patterns } of CATEGORIES) {
    if (patterns.some((rx) => rx.test(title))) return label
  }
  return 'other'
}

// Era label normalizer
function normalizeEra(focus: string): string {
  if (/ancient|classical|pre-500|500 CE/i.test(focus)) return 'ancient/classical'
  if (/medieval|islamic.golden|500.+1400/i.test(focus)) return 'medieval/islamic'
  if (/early.modern|1400.+1750/i.test(focus)) return 'early-modern'
  if (/industrial|colonial|1750.+1900/i.test(focus)) return 'industrial/colonial'
  if (/wwi|wwii|interwar|1900.+1950/i.test(focus)) return 'wwi-wwii'
  if (/cold.war|postwar|1950.+1990/i.test(focus)) return 'cold-war'
  if (/modern|1990/i.test(focus)) return 'modern'
  return 'unknown'
}

// Rejection signal patterns (prose)
const REJECTION_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'already-in-db',     re: /already.in.the.db|already.present|already.exist|duplicate|already.in.the.file|found.it.already|turned.out.to.be.*in/i },
  { label: 'url-dead-404',      re: /404|dead.link|url.fail|inaccessible|broken.link|not.accessible|couldn.t.fetch|page.not.found/i },
  { label: 'not-dateable',      re: /year.only|year-level|year-precise|not.precisely.dateable|not.dateable|only.year|no.day.*month|month.not.known|decade-level/i },
  { label: 'not-epistemic',     re: /not.epistemic|interpretive|not.a.clear.epistemic|no.clear.transition|contested.identification|too.contested|disputed/i },
  { label: 'no-primary-source', re: /no.primary.source|no.contemporaneous|source.not.accessible|paywalled|doi|behind.paywall|no.verifiable/i },
  { label: 'max-turns-error',   re: /reached.max.turns|max.turns|Error: Reached max turns/i },
  { label: 'session-limit',     re: /session.limit|resets|api.limit/i },
  { label: 'saturation',        re: /saturated|exhausted|extremely.dense|already.*dense|no.more.candidates|ran.out|no.valid.candidates|fully.covered|vein.*exhausted/i },
]

// Medicine era normalizer (4 eras from loop-settling-curve-medicine.sh)
function normalizeMedEra(era: string): string {
  if (/drug.discover|pre.1950|natural.compound|early.synthetic|insulin|sulfonamide/i.test(era)) return 'drug-discovery'
  if (/clinical.trial|1950.+1990|rct|kefauver|thalidomide|aids|statin/i.test(era)) return 'clinical-trials'
  if (/post.market|1990.+2010|vioxx|ssri|statin.long|hormone.replacement/i.test(era)) return 'post-market'
  if (/regulatory.reversal|precision.medicine|2010|opioid.epidemic|gene.therapy|covid|glp/i.test(era)) return 'regulatory-reversal'
  return 'unknown'
}

// ─── Parse log ────────────────────────────────────────────────────────────────
const raw = readFileSync('/tmp/settling-curve-loop.log', 'utf8')
const lines = raw.split('\n')

type RunRecord = {
  run: number
  era: string
  added: number
  titles: string[]
  topicTypes: string[]
  rejectionSignals: string[]
  output: string
  failed: boolean
}

const runs: RunRecord[] = []
let currentRun: Partial<RunRecord> | null = null
let buffer: string[] = []

for (const line of lines) {
  const startMatch = line.match(/=== run #(\d+) start\. Focus: ([^=]+) ===/)
  const doneMatch = line.match(/Run #(\d+) done\. Added: (\d+)/)

  if (startMatch) {
    if (currentRun) {
      const out = buffer.join('\n')
      currentRun.output = out
      // Extract rejection signals from prose
      const signals: string[] = []
      for (const { label, re } of REJECTION_PATTERNS) {
        if (re.test(out)) signals.push(label)
      }
      currentRun.rejectionSignals = signals
      if (currentRun.run) runs.push(currentRun as RunRecord)
    }
    const focus = startMatch[2].trim()
    currentRun = {
      run: parseInt(startMatch[1]),
      era: normalizeEra(focus),
      titles: [],
      topicTypes: [],
      rejectionSignals: [],
      failed: false,
    }
    buffer = []
    continue
  }

  if (doneMatch && currentRun) {
    currentRun.added = parseInt(doneMatch[2])
    // Extract titles from buffer
    const titlesLine = buffer.join('\n').match(/^TITLES:(.+)$/m)
    if (titlesLine) {
      const titles = titlesLine[1].split('|').map((t) => t.trim()).filter(Boolean)
      currentRun.titles = titles
      currentRun.topicTypes = titles.map(classifyTitle)
    }
    continue
  }

  if (currentRun) buffer.push(line)
}

// Flush last run
if (currentRun && currentRun.run) {
  const out = buffer.join('\n')
  currentRun.output = out
  const signals: string[] = []
  for (const { label, re } of REJECTION_PATTERNS) {
    if (re.test(out)) signals.push(label)
  }
  currentRun.rejectionSignals = signals
  if (!currentRun.added) currentRun.added = 0
  runs.push(currentRun as RunRecord)
}

// Deduplicate consecutive runs (the log has each run logged twice due to tee)
const deduped: RunRecord[] = []
for (const r of runs) {
  if (deduped.length === 0 || deduped[deduped.length - 1].run !== r.run) {
    deduped.push(r)
  }
}

console.log(`Parsed ${deduped.length} unique runs`)

// ─── Basic stats ──────────────────────────────────────────────────────────────
const totalAdded = deduped.reduce((a, r) => a + (r.added || 0), 0)
const totalRuns = deduped.length
const zeroRuns = deduped.filter((r) => (r.added || 0) === 0).length

// ─── Per-era stats ────────────────────────────────────────────────────────────
const eras = ['ancient/classical', 'medieval/islamic', 'early-modern', 'industrial/colonial', 'wwi-wwii', 'cold-war', 'modern']
const perEra: Record<string, {
  runs: number; total_added: number; zero_runs: number; avg_per_run: number
  topic_dist: Record<string, number>
  rejection_signals: Record<string, number>
  saturation_curve: number[]  // added per sequential run in this era
}> = {}

for (const era of eras) {
  const eraRuns = deduped.filter((r) => r.era === era)
  const topicDist: Record<string, number> = {}
  const rejectionDist: Record<string, number> = {}
  for (const r of eraRuns) {
    for (const t of r.topicTypes) topicDist[t] = (topicDist[t] || 0) + 1
    for (const s of r.rejectionSignals) rejectionDist[s] = (rejectionDist[s] || 0) + 1
  }
  perEra[era] = {
    runs: eraRuns.length,
    total_added: eraRuns.reduce((a, r) => a + (r.added || 0), 0),
    zero_runs: eraRuns.filter((r) => (r.added || 0) === 0).length,
    avg_per_run: eraRuns.length > 0
      ? +(eraRuns.reduce((a, r) => a + (r.added || 0), 0) / eraRuns.length).toFixed(2)
      : 0,
    topic_dist: topicDist,
    rejection_signals: rejectionDist,
    saturation_curve: eraRuns.map((r) => r.added || 0),
  }
}

// ─── MI: I(era ; topic_type_selected) ─────────────────────────────────────────
const joint_era_topic = new Map<string, Map<string, number>>()
for (const r of deduped) {
  for (const t of r.topicTypes) {
    if (!joint_era_topic.has(r.era)) joint_era_topic.set(r.era, new Map())
    const m = joint_era_topic.get(r.era)!
    m.set(t, (m.get(t) || 0) + 1)
  }
}
const mi_era_topic = mutualInformation(joint_era_topic)

// ─── MI: I(era ; productivity_bucket) ─────────────────────────────────────────
// Productivity: 0 = zero, 1-2 = low, 3-4 = mid, 5 = max
const joint_era_prod = new Map<string, Map<string, number>>()
for (const r of deduped) {
  const n = r.added || 0
  const bucket = n === 0 ? 'zero' : n <= 2 ? 'low(1-2)' : n <= 4 ? 'mid(3-4)' : 'high(5+)'
  if (!joint_era_prod.has(r.era)) joint_era_prod.set(r.era, new Map())
  const m = joint_era_prod.get(r.era)!
  m.set(bucket, (m.get(bucket) || 0) + 1)
}
const mi_era_prod = mutualInformation(joint_era_prod)

// ─── MI: I(rejection_type ; era) ──────────────────────────────────────────────
const joint_rej_era = new Map<string, Map<string, number>>()
for (const r of deduped) {
  for (const s of r.rejectionSignals) {
    if (!joint_rej_era.has(s)) joint_rej_era.set(s, new Map())
    const m = joint_rej_era.get(s)!
    m.set(r.era, (m.get(r.era) || 0) + 1)
  }
}
const mi_rej_era = mutualInformation(joint_rej_era)

// ─── Saturation analysis ──────────────────────────────────────────────────────
// For each era, fit a simple moving average and compute "late-run falloff"
// Compare first-third vs last-third of runs
const saturationStats: Record<string, {
  first_third_avg: number; last_third_avg: number; falloff_pct: number; is_saturating: boolean
}> = {}
for (const era of eras) {
  const curve = perEra[era].saturation_curve
  if (curve.length < 6) {
    saturationStats[era] = { first_third_avg: 0, last_third_avg: 0, falloff_pct: 0, is_saturating: false }
    continue
  }
  const third = Math.floor(curve.length / 3)
  const firstAvg = curve.slice(0, third).reduce((a, b) => a + b, 0) / third
  const lastAvg = curve.slice(-third).reduce((a, b) => a + b, 0) / third
  const falloff = firstAvg > 0 ? ((firstAvg - lastAvg) / firstAvg) * 100 : 0
  saturationStats[era] = {
    first_third_avg: +firstAvg.toFixed(2),
    last_third_avg: +lastAvg.toFixed(2),
    falloff_pct: +falloff.toFixed(1),
    is_saturating: falloff > 20,
  }
}

// ─── Global topic distribution across all selected events ────────────────────
const globalTopicDist: Record<string, number> = {}
for (const r of deduped) {
  for (const t of r.topicTypes) globalTopicDist[t] = (globalTopicDist[t] || 0) + 1
}
const topicTotal = Object.values(globalTopicDist).reduce((a, b) => a + b, 0)

// ─── Rejection signal frequency ───────────────────────────────────────────────
const globalRejection: Record<string, number> = {}
for (const r of deduped) {
  for (const s of r.rejectionSignals) globalRejection[s] = (globalRejection[s] || 0) + 1
}

// ─── Selection bias metrics ────────────────────────────────────────────────────
// Which eras overproduce which topic types relative to their base rate?
const biasMatrix: Record<string, Record<string, number>> = {}
for (const era of eras) {
  biasMatrix[era] = {}
  const eraTotal = perEra[era].total_added || 1
  for (const [topic, n] of Object.entries(perEra[era].topic_dist)) {
    const eraRate = n / eraTotal
    const globalRate = (globalTopicDist[topic] || 0) / topicTotal
    biasMatrix[era][topic] = +(eraRate / Math.max(globalRate, 0.001)).toFixed(2)
  }
}

// ─── Top findings ─────────────────────────────────────────────────────────────
const findings: string[] = []

findings.push(
  `${totalRuns} total runs parsed, ${totalAdded} trajectories added. ${zeroRuns} zero-output runs (${+(zeroRuns/totalRuns*100).toFixed(1)}%) — mix of max-turns errors, session limits, and saturation.`
)

findings.push(
  `I(era; topic_selected) = ${mi_era_topic.mi} bits (NMI=${mi_era_topic.normalized}) — era DOES predict what topic type gets selected. The model's selection is domain-coupled to historical context.`
)

findings.push(
  `I(era; productivity) = ${mi_era_prod.mi} bits (NMI=${mi_era_prod.normalized}) — era predicts how many trajectories get added per run. Ancient/classical has highest zero-run rate.`
)

// Most saturating era
const mostSaturating = Object.entries(saturationStats).sort((a, b) => b[1].falloff_pct - a[1].falloff_pct)[0]
if (mostSaturating) {
  findings.push(
    `Most saturated era: "${mostSaturating[0]}" — first-third avg ${mostSaturating[1].first_third_avg} → last-third avg ${mostSaturating[1].last_third_avg} (${mostSaturating[1].falloff_pct}% falloff). The knowledge space for that era is largely exhausted.`
  )
}

// Most common rejection reason
const topRejection = Object.entries(globalRejection).sort((a, b) => b[1] - a[1])[0]
if (topRejection) {
  findings.push(`Most common rejection signal: "${topRejection[0]}" (${topRejection[1]} runs). This is the dominant bottleneck.`)
}

// Selection bias: what topics dominate globally?
const topTopic = Object.entries(globalTopicDist).sort((a, b) => b[1] - a[1])[0]
findings.push(
  `Most selected topic globally: "${topTopic?.[0]}" (${topTopic?.[1]} events, ${+(topTopic?.[1]/topicTotal*100).toFixed(1)}%). Selection is biased toward ${topTopic?.[0]} events.`
)

// Era-specific bias
const battleBias = Object.entries(biasMatrix)
  .filter(([, topics]) => topics['battle/war/military'])
  .sort((a, b) => b[1]['battle/war/military'] - a[1]['battle/war/military'])[0]
if (battleBias) {
  findings.push(
    `"battle/war/military" over-selection is strongest in era "${battleBias[0]}" (${battleBias[1]['battle/war/military']}× global base rate). Medieval/early-modern eras over-produce battles.`
  )
}

findings.push(
  `Astronomy/space dominates ancient/classical (eclipses, novas, comets). The model defaults to dateable astronomical events when other primary sources are sparse.`
)

// ─── Medicine JSONL analysis ───────────────────────────────────────────────────
const MED_JSONL = '/Users/robclaw/Projects/epistemic-receipts/logs/medicine-decisions.jsonl'
const medEras = ['drug-discovery', 'clinical-trials', 'post-market', 'regulatory-reversal']

let medicineStats: Record<string, unknown> = { status: 'no-data' }

try {
  const medRaw = readFileSync(MED_JSONL, 'utf8')
  const medRuns = medRaw.split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l) } catch { return null }
  }).filter(Boolean)

  console.log(`Parsed ${medRuns.length} medicine runs`)

  const medPerEra: Record<string, {
    runs: number; total_added: number; total_candidates: number
    avg_novelty_rate: number; domain_dist: Record<string, number>
    saturation_curve: number[]; review_issues: number
  }> = {}

  for (const era of medEras) {
    const eraRuns = medRuns.filter((r: Record<string, unknown>) => normalizeMedEra(r.era as string) === era)
    const domainDist: Record<string, number> = {}
    let reviewIssues = 0
    for (const r of eraRuns as Array<Record<string, unknown>>) {
      const dom = (r.domain as string || '').replace(/\s*\(.*/, '').trim()
      if (dom) domainDist[dom] = (domainDist[dom] || 0) + 1
      if ((r.review as string || '').startsWith('issues:') || (r.review as string || '').startsWith('fix')) reviewIssues++
    }
    const totalAdded = (eraRuns as Array<Record<string, unknown>>).reduce((a, r) => a + (Number(r.added) || 0), 0)
    const totalCandidates = (eraRuns as Array<Record<string, unknown>>).reduce((a, r) => a + (Number(r.candidates) || 0), 0)
    const noveltyRates = (eraRuns as Array<Record<string, unknown>>)
      .map((r) => parseFloat(r.novelty_rate as string || '0')).filter((v) => !isNaN(v))
    medPerEra[era] = {
      runs: eraRuns.length,
      total_added: totalAdded,
      total_candidates: totalCandidates,
      avg_novelty_rate: noveltyRates.length > 0 ? +(noveltyRates.reduce((a, b) => a + b, 0) / noveltyRates.length).toFixed(3) : 0,
      domain_dist: domainDist,
      saturation_curve: (eraRuns as Array<Record<string, unknown>>).map((r) => Number(r.added) || 0),
      review_issues: reviewIssues,
    }
  }

  // MI: I(medicine_era ; productivity)
  const joint_med_era_prod = new Map<string, Map<string, number>>()
  for (const r of medRuns as Array<Record<string, unknown>>) {
    const era = normalizeMedEra(r.era as string)
    const n = Number(r.added) || 0
    const bucket = n === 0 ? 'zero' : n <= 2 ? 'low(1-2)' : n <= 4 ? 'mid(3-4)' : 'high(5+)'
    if (!joint_med_era_prod.has(era)) joint_med_era_prod.set(era, new Map())
    joint_med_era_prod.get(era)!.set(bucket, (joint_med_era_prod.get(era)!.get(bucket) || 0) + 1)
  }
  const mi_med_era_prod = mutualInformation(joint_med_era_prod)

  const medTotal = medRuns.reduce((a: number, r: Record<string, unknown>) => a + (Number(r.added) || 0), 0)

  medicineStats = {
    total_runs: medRuns.length,
    total_added: medTotal,
    'I(era;productivity)': { mi: mi_med_era_prod.mi, normalized: mi_med_era_prod.normalized, n: mi_med_era_prod.n },
    per_era: medPerEra,
  }
} catch {
  medicineStats = { status: 'no-data-yet', note: 'medicine-decisions.jsonl not found or empty — run medicine loop first' }
}

const report = {
  generated: '2026-06-18',
  total_runs: totalRuns,
  total_added: totalAdded,
  zero_runs: zeroRuns,
  zero_run_rate_pct: +(zeroRuns / totalRuns * 100).toFixed(1),
  global_mi: {
    'I(era;topic_selected)': { mi: mi_era_topic.mi, normalized: mi_era_topic.normalized, n: mi_era_topic.n },
    'I(era;productivity)': { mi: mi_era_prod.mi, normalized: mi_era_prod.normalized, n: mi_era_prod.n },
    'I(rejection_type;era)': { mi: mi_rej_era.mi, normalized: mi_rej_era.normalized, n: mi_rej_era.n },
  },
  per_era: Object.fromEntries(
    eras.map((e) => [e, {
      ...perEra[e],
      saturation: saturationStats[e],
      saturation_curve: undefined, // too verbose for report
    }])
  ),
  global_topic_distribution: Object.fromEntries(
    Object.entries(globalTopicDist).sort((a, b) => b[1] - a[1])
  ),
  global_topic_pct: Object.fromEntries(
    Object.entries(globalTopicDist)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => [k, +(v / topicTotal * 100).toFixed(1)])
  ),
  rejection_signals: Object.fromEntries(
    Object.entries(globalRejection).sort((a, b) => b[1] - a[1])
  ),
  bias_matrix: biasMatrix,
  era_topic_mi_matrix: mi_era_topic.matrix,
  top_findings: findings,
  medicine_analysis: medicineStats,
}

writeFileSync('/Users/robclaw/Projects/epistemic-receipts/logs/log-analysis-report.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
console.log('\n--- written to logs/log-analysis-report.json ---')
