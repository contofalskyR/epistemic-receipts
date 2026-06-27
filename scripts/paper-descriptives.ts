import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { writeFileSync, readFileSync, existsSync } from 'fs'

/**
 * Paper-ready descriptives for the settling-curve trajectory corpus.
 *
 * Restricted to claims with externalId prefix "trajectory:" and their
 * ClaimStatusHistory rows. Produces:
 *   logs/paper-descriptives-report.json  (machine-readable)
 *   logs/paper-descriptives-report.md    (Methods/Results draft)
 *
 * Run:
 *   npx ts-node --project tsconfig.scripts.json scripts/paper-descriptives.ts
 */

// ───────────────────────── stats helpers ─────────────────────────
function log2(x: number) { return Math.log(x) / Math.log(2) }

function describe(xs: number[]) {
  if (xs.length === 0) return { n: 0, min: null, max: null, mean: null, median: null, sd: null }
  const s = [...xs].sort((a, b) => a - b)
  const n = s.length
  const sum = s.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const variance = s.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  const mid = Math.floor(n / 2)
  const median = n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
  return {
    n,
    min: +s[0].toFixed(3),
    max: +s[n - 1].toFixed(3),
    mean: +mean.toFixed(3),
    median: +median.toFixed(3),
    sd: +Math.sqrt(variance).toFixed(3),
  }
}

function percentiles(xs: number[], qs: number[]) {
  if (xs.length === 0) return Object.fromEntries(qs.map((q) => [`p${Math.round(q * 100)}`, null]))
  const s = [...xs].sort((a, b) => a - b)
  const out: Record<string, number> = {}
  for (const q of qs) out[`p${Math.round(q * 100)}`] = +s[Math.floor(q * (s.length - 1))].toFixed(3)
  return out
}

function entropyBits(counts: number[]) {
  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  let h = 0
  for (const c of counts) { const p = c / total; if (p > 0) h -= p * log2(p) }
  return +h.toFixed(4)
}

const YEAR_MS = 365.25 * 24 * 3600 * 1000

// ───────────────────────── domain classifier (mirrors event-type-mi-analysis.ts) ─────────────────────────
const CATEGORIES: { label: string; patterns: RegExp[] }[] = [
  { label: 'astronomy/space', patterns: [/eclipse|solar.flare|comet|lunar|apollo|sputnik|moon.land|orbit|satellite|parallax|telescope|nebula|pulsar|exoplanet|black.hole|hubble|occult|pleiades|mars.orbit|chang[ae]\d|chandrayaan|voyager|beidou|webb|van.allen|explorer.1|first.exo|cmb|cosmic|hertzsprung|spectral.class|cepheid|supernova|white.dwarf|red.giant|main.sequence|h.r.diagram|dark.matter|dark.energy|accelerat.+expan|hubble.constant|big.bang|steady.state|cosmic.microwave|ligo|gravitational.lens|frame.drag|kerr|schwarzschild|event.horizon|eht|sagittarius.a|m87|neutrino.oscillat|standard.model|bell.test|decoherence|cassini|curiosity|perseverance|spirit.rover|opportunity.rover|new.horizons|juno|galileo.probe|kepler.mission|tess|gaia.mission|interferometr|adaptive.optics|radio.telescope|arecibo|alma|vla|neptune.discovery|uranus.discovery|pluto.reclassif|iau.vote|transit.of.venus|halley|copernicus|aristarchus|ptolemy|brahe|tycho/i] },
  { label: 'battle/war/military', patterns: [/^battle|massacre|siege|armistice|war\b|d.day|somme|verdun|fort.sumter|normandy|blitz|fall.of.kabul|fall.of.saigon|fall.of.acre|fall.of.tenochtitlan|fall.of.babylon|fall.of.granada|fall.of.constanti|fall.of.famagusta|first.crusade|fourth.crusade|cuban.missile|nuclear.test|hiroshima|nagasaki|operation/i] },
  { label: 'religion/church', patterns: [/council.of|council.clermont|council.ephesus|council.trent|council.nicea|council.florence|synod|canonization|schism|crusade|heresy|edict.of.nantes|edict.of.thessalonica|edict.of.worms|augsburg.confession|blackfriars|disputation|reformation|protestant|papal|pope|decree.of.canopus|decet.romanum|condemnation.of|cadaver.synod|aquinas|francis.assisi|huguenot/i] },
  { label: 'pharmacology/regulatory', patterns: [/fda.approv|fda.withdraw|fda.recall|nda.approv|kefauver|thalidomide|oxycontin|vioxx|rofecoxib|hrt.reversal|hormone.replacement|statins?|atorvastatin|simvastatin|lovastatin|metformin|insulin.approv|azidothymidine|azt.approv|ssri|prozac|fluoxetine|zidovudine|drug.approv|drug.withdrawal|post.market|adverse.event|clinical.trial|phase.[123]|randomized.controlled|rct|placebo.controlled|double.blind|accelerated.approv|breakthrough.therapy|orphan.drug|boxed.warning|black.box|glp.1|semaglutide|wegovy|ozempic|eliquis|humira|keytruda|gleevec|imatinib|herceptin|trastuzumab|revlimid|lenalidomide|adderall|ritalin|opioid.crisis|purdue|prescription.opioid|naloxone|narcan|methadone|buprenorphine|fen.phen|fenfluramine|cisapride|propulsid|baycol|cerivastatin|troglitazone|rezulin|avandia|rosiglitazone|mifepristone|roe.fda|birth.control.approv|oral.contraceptive.approv|dca|isotretinoin|accutane|paxil|seroxat|bextra|valdecoxib|celebrex|cox.2/i] },
  { label: 'medicine/health', patterns: [/vaccine|pandemic|influenza|polio|cancer|aids|hiv|plague|cholera|smallpox|tuberculosis|germ.theory|surgery|transplant|anesthesia|antibiotic|penicillin|sulfonamide|antitoxin|epidemic|ether.anesthesia|blood.transfusion|gene.therapy|mrna|covid|covaxin|delta.variant|ebola|sars|elixir.sulfanilamide|behring|barnard|pasteur|lister|semmelweis|jenner|snow.cholera|pfizer|moderna|oxford|lobotomy|dialysis|chemotherapy|radiation.therapy|mammograph|pap.smear|mri.scanner|ct.scan|x.ray.discovery|smoking.cancer|doll.hill|framingham/i] },
  { label: 'biology/genetics', patterns: [/dna|genome|evolution|species|genetics|crispr|cloning|dolly|darwin|recombinant|chromosom|mendel|archaeopteryx|homo.sapiens|neanderthal|denisovan|fossil|hominid|java.man|taung|avery|watson.crick|crick|alphafold|encode|pangenome|sequencing|cell.division|synthetic.cell|transcription/i] },
  { label: 'physics/chemistry', patterns: [/radioactiv|quantum|relativity|atomic|neutron|positron|electron|fission|nuclear|photon|radiation|superconductor|higgs|gravitational.wave|planck|bohr|rutherford|curie|einstein|heisenberg|schrodinger|dirac|compton|brownian|faraday|maxwell|doppler|dalton|avogadro|becquerel|chadwick|fermi|carnot|bernoulli|joule|thermodynamics|entropy|wavelength|ultraviolet|x.ray|laser|transistor|semiconductor|isotope|cherenkov|epr.paradox|matter.wave|photoelectric|de.broglie|mach|cavendish/i] },
  { label: 'technology/computing', patterns: [/computer|internet|arpanet|apple.|ibm|cpu|algorithm|bitcoin|chatgpt|deepseek|alphago|deep.blue|eniac|ethernet|diffie.hellman|encryption|cryptography|telegraph|telephone|radio|television|printing.press|incandescent|pearl.street|altair|macintosh|transistor|silicon|semiconductor|daguerreotype|photograph|radar|daventry|codd.relational|network|software|microchip|steam.engine|bessemer|locomotive|balloon|dynamite|vulcaniz|artificial.intelligence|gpt|llm|neural/i] },
  { label: 'nutrition/dietary', patterns: [/dietary|cholesterol.limit|saturated.fat|trans.fat|margarine|ancel.keys|seven.countries|mcgovern|food.pyramid|myplate|low.fat|atkins|mediterranean.diet|dash.diet|sugar.industry|yudkin|lustig|fructose|hfcs|high.fructose|vitamin.[a-e]|vitamin.d|scurvy|beriberi|pellagra|rickets|niacin|thiamine|folate|rda\b|recommended.daily|food.guide|school.lunch|fluorid|iodiz|fortif|nutrient.deficiency|essential.amino|protein.combining|plant.based.protein|bmi.adopt|set.point|calorie|obesity.epidem|bariatric|glp.1.appetite|ultra.processed|nova.classif|microbiome.diet|personalized.nutrition|french.paradox|j.curve.alcohol|no.safe.level.alcohol|msg.safety|aspartame|artificial.sweeten|bpa|glyphosate|roundup|pesticide.residue|organic.food/i] },
  { label: 'environment/climate', patterns: [/climate|ozone|greenhouse|pollution|conservation|endangered.species|epa|ddt|clean.air|earth.day|cuyahoga|exxon.valdez|arrhenius|foote.greenhouse|chernobyl|bhopal|carbon.neutrality|climategate|paris.agreement|kyoto|ipcc|keeling.curve|co2.milestone|400.?ppm|methane.measure|tyndall|callendar|montreal.protocol|cfc|chlorofluoro|ozone.hole|farman|acid.rain|sea.level|arctic.ice|ocean.acidif|coral.bleach|coral.die|permafrost|extreme.weather|heat.wave.attribu|hurricane.intensif|drought.attribu|wildfire.attribu|species.migration|biodiversity.loss|carbon.capture|solar.cost|wind.cost|coal.phase|net.zero|cop\d|unfccc|nationally.determined|climate.denial|exxon.knew|fossil.fuel.disinform|urgenda|juliana|carbon.tax|cap.and.trade|greta|extinction.rebellion|ipcc.ar[1-6]|wmo.record|hansen.testimony|al.gore|inconvenient/i] },
  { label: 'law/civil rights/social', patterns: [/civil.rights|suffrage|slavery|emancipation|segregation|brown.v.board|voting.rights|fair.housing|abortion|roe|lgbtq|apartheid|suffragette|women.vote|13th.amendment|14th.amendment|15th.amendment|civil.rights.act|fair.labor|labor.rights|dred.scott|emmett.till|birmingham|selma|stonewall/i] },
  { label: 'law/legislation/judicial', patterns: [/supreme.court|court\b|legislation|act.of\b|clean.water|endangered.species|chevron|loper|bowers|adkins|abood|janus|brown.v|roe.v|dred.scott|amistad|treaty|constitution|magna.carta|declaration|bill.of.rights|habeas|miranda|voting.rights.act|civil.rights.act|fair.housing.act|clean.air.act|epa.established|endangered.species.act|safe.drinking/i] },
  { label: 'exploration/geography', patterns: [/columbus|expedition|circumnavigation|balboa|cartier|cortes|de.soto|amundsen|south.pole|antarctica|first.sighting|champlain|drake|cabot|vespucci|magellan|silk.road|new.world|landfall|passage|explored/i] },
  { label: 'economics/finance', patterns: [/bank.of|stock.market|crash|depression|bretton.woods|gold.standard|imf|world.bank|inflation|currency|trade|tariff|monopoly|antitrust|black.tuesday|wall.street|cryptocurrency|bitcoin|economic.crisis|keynes|adam.smith|wealth.of.nations/i] },
  { label: 'politics/revolution/governance', patterns: [/revolution|independence|constitution|coup|republic|declaration|empire|colonialism|decoloni|elections?|parliament|senate|congress|treaty|peace.of|congress.of|armistice|mandate|partition|referendum|bastille|enabling.act|beer.hall|anschluss|appeasement|berlin.wall|arab.spring|tiananmen|glasnost|perestroika/i] },
  { label: 'mathematics/logic', patterns: [/theorem|proof|calculus|algebra|geometry|euclid|newton.laws|kepler|principia|incompleteness|godel|turing|boolean|probability|statistics|fourier|gauss|riemann|fermat|pythagoras/i] },
]
function classifySlug(slug: string): string {
  for (const { label, patterns } of CATEGORIES) if (patterns.some((rx) => rx.test(slug))) return label
  return 'other/political-event'
}
function eraBucket(year: number): string {
  if (year < 0) return 'ancient (pre-0)'
  if (year < 500) return 'late-antiquity (0-499)'
  if (year < 1000) return 'early-medieval (500-999)'
  if (year < 1500) return 'medieval (1000-1499)'
  if (year < 1700) return 'early-modern (1500-1699)'
  if (year < 1800) return '18th century'
  if (year < 1850) return '19th century (early)'
  if (year < 1900) return '19th century (late)'
  if (year < 1950) return '20th century (early)'
  if (year < 2000) return '20th century (late)'
  return '21st century'
}
function sortObjByVal(o: Record<string, number>) {
  return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]))
}

type Hist = { claimId: string; fromAxis: string | null; toAxis: string; community: string; occurredAt: Date }

async function main() {
  const p = new PrismaClient()

  // ── 1. trajectory claims ──
  const claims = await p.claim.findMany({
    where: { deleted: false, externalId: { startsWith: 'trajectory:' } },
    select: { id: true, externalId: true, epistemicAxis: true, claimEmergedAt: true, ingestedBy: true, createdAt: true },
  })
  const total = claims.length
  const claimById = new Map(claims.map((c) => [c.id, c]))
  const claimIds = claims.map((c) => c.id)

  // ── 2. their status history ──
  const history: Hist[] = []
  const CHUNK = 1000
  for (let i = 0; i < claimIds.length; i += CHUNK) {
    const rows = await p.claimStatusHistory.findMany({
      where: { claimId: { in: claimIds.slice(i, i + CHUNK) } },
      select: { claimId: true, fromAxis: true, toAxis: true, community: true, occurredAt: true },
    })
    history.push(...(rows as Hist[]))
  }
  const totalEvents = history.length
  const byClaim: Record<string, Hist[]> = {}
  for (const h of history) (byClaim[h.claimId] = byClaim[h.claimId] || []).push(h)
  for (const id of Object.keys(byClaim)) byClaim[id].sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt))

  // ── 3. geo coverage (ClaimLocation) ──
  let locRows = 0
  const geoCountry: Record<string, number> = {}
  const geoClaims = new Set<string>()
  for (let i = 0; i < claimIds.length; i += CHUNK) {
    const rows = await p.claimLocation.findMany({
      where: { claimId: { in: claimIds.slice(i, i + CHUNK) } },
      select: { claimId: true, countryCode: true },
    })
    locRows += rows.length
    for (const r of rows) { geoClaims.add(r.claimId); const k = r.countryCode || 'NULL'; geoCountry[k] = (geoCountry[k] || 0) + 1 }
  }

  // ══════════════════ CORPUS OVERVIEW ══════════════════
  const byIngest: Record<string, number> = {}
  for (const c of claims) byIngest[c.ingestedBy] = (byIngest[c.ingestedBy] || 0) + 1

  // date range of trajectories: earliest first-milestone .. latest last-milestone
  const firstMilestoneDates: number[] = []
  const lastMilestoneDates: number[] = []
  for (const id of Object.keys(byClaim)) {
    const hs = byClaim[id]
    firstMilestoneDates.push(+new Date(hs[0].occurredAt))
    lastMilestoneDates.push(+new Date(hs[hs.length - 1].occurredAt))
  }
  const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)
  const dateRange = {
    earliest_first_milestone: firstMilestoneDates.length ? isoDate(Math.min(...firstMilestoneDates)) : null,
    latest_last_milestone: lastMilestoneDates.length ? isoDate(Math.max(...lastMilestoneDates)) : null,
  }

  // ══════════════════ TRAJECTORY STRUCTURE ══════════════════
  const depthValues = claimIds.map((id) => (byClaim[id]?.length || 0))
  const depthStats = describe(depthValues)
  const depthHist: Record<number, number> = {}
  for (const d of depthValues) depthHist[d] = (depthHist[d] || 0) + 1

  // time span (years): first to last milestone, only claims with >=2 milestones
  const spanYears: number[] = []
  for (const id of Object.keys(byClaim)) {
    const hs = byClaim[id]
    if (hs.length < 2) continue
    const yrs = (+new Date(hs[hs.length - 1].occurredAt) - +new Date(hs[0].occurredAt)) / YEAR_MS
    if (yrs >= 0) spanYears.push(yrs)
  }
  const spanStats = describe(spanYears)
  const spanPct = percentiles(spanYears, [0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99])

  // settlement velocity: claimEmergedAt -> first RECORDED->SETTLED (matches corpus-analysis.ts)
  const velocityYears: number[] = []
  for (const id of Object.keys(byClaim)) {
    const c = claimById.get(id)
    if (!c?.claimEmergedAt) continue
    const settled = byClaim[id].filter((h) => h.fromAxis === 'RECORDED' && h.toAxis === 'SETTLED')[0]
    if (!settled) continue
    const yrs = (+new Date(settled.occurredAt) - +new Date(c.claimEmergedAt)) / YEAR_MS
    if (yrs >= 0) velocityYears.push(yrs)
  }
  const velocityStats = describe(velocityYears)
  const velocityPct = percentiles(velocityYears, [0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99])

  // endpoint distribution (epistemicAxis)
  const endpoint: Record<string, number> = {}
  for (const c of claims) { const k = c.epistemicAxis ?? 'NULL'; endpoint[k] = (endpoint[k] || 0) + 1 }
  const endpointPct = Object.fromEntries(Object.entries(endpoint).map(([k, v]) => [k, +((v / total) * 100).toFixed(2)]))
  const endpointEntropy = entropyBits(Object.values(endpoint))

  // detour rate: depth > 2
  const detourCount = depthValues.filter((d) => d > 2).length
  const detourRatePct = +((detourCount / total) * 100).toFixed(2)
  // contestation touch
  const everContested = new Set<string>()
  for (const id of Object.keys(byClaim)) if (byClaim[id].some((h) => h.toAxis === 'CONTESTED' || h.fromAxis === 'CONTESTED')) everContested.add(id)
  const contestationRatePct = +((everContested.size / total) * 100).toFixed(2)

  // ══════════════════ COMMUNITY ANALYSIS ══════════════════
  const firstRatifier: Record<string, number> = {}
  const communitySeq: Record<string, number> = {}
  const coOccur: Record<string, Record<string, number>> = {}
  let multiCommunity = 0
  const COMMS = ['EXPERT_LITERATURE', 'INSTITUTIONAL', 'JUDICIAL', 'PUBLIC', 'MARKET']
  for (const c of COMMS) { coOccur[c] = {}; for (const d of COMMS) coOccur[c][d] = 0 }
  for (const id of Object.keys(byClaim)) {
    const hs = byClaim[id]
    // first ratifier = community of earliest event
    firstRatifier[hs[0].community] = (firstRatifier[hs[0].community] || 0) + 1
    // ordered sequence of communities by first appearance
    const firstByComm: Record<string, number> = {}
    for (const h of hs) { const t = +new Date(h.occurredAt); if (!(h.community in firstByComm) || t < firstByComm[h.community]) firstByComm[h.community] = t }
    const comms = Object.keys(firstByComm)
    const ordered = comms.sort((a, b) => firstByComm[a] - firstByComm[b])
    communitySeq[ordered.join('→')] = (communitySeq[ordered.join('→')] || 0) + 1
    if (comms.length > 1) multiCommunity++
    // co-occurrence (unordered pairs within trajectory) + diagonal = appearances
    for (const a of comms) if (coOccur[a]) coOccur[a][a] = (coOccur[a][a] || 0) + 1
    for (let i = 0; i < comms.length; i++) for (let j = i + 1; j < comms.length; j++) {
      const a = comms[i], b = comms[j]
      if (coOccur[a] && coOccur[a][b] !== undefined) { coOccur[a][b]++; coOccur[b][a]++ }
    }
  }
  const topSequences = Object.entries(sortObjByVal(communitySeq)).slice(0, 10)
  const multiCommunityPct = +((multiCommunity / total) * 100).toFixed(2)
  // raw community event counts
  const communityEvents: Record<string, number> = {}
  for (const h of history) communityEvents[h.community] = (communityEvents[h.community] || 0) + 1

  // ══════════════════ DOMAIN / ERA ══════════════════
  const domainDist: Record<string, number> = {}
  const eraDist: Record<string, number> = {}
  const domainEra: Record<string, Record<string, number>> = {}
  let unknownEra = 0
  for (const c of claims) {
    const slug = c.externalId?.replace('trajectory:', '') ?? ''
    const domain = classifySlug(slug)
    const year = c.claimEmergedAt ? new Date(c.claimEmergedAt).getUTCFullYear() : null
    const era = year !== null ? eraBucket(year) : 'unknown'
    if (era === 'unknown') unknownEra++
    domainDist[domain] = (domainDist[domain] || 0) + 1
    eraDist[era] = (eraDist[era] || 0) + 1
    domainEra[domain] = domainEra[domain] || {}
    domainEra[domain][era] = (domainEra[domain][era] || 0) + 1
  }

  // ══════════════════ LOOP / GENERATION STATS ══════════════════
  let loopStats: any = { note: 'logs/log-analysis-report.json not found — run log-analysis.ts first' }
  if (existsSync('logs/log-analysis-report.json')) {
    const la = JSON.parse(readFileSync('logs/log-analysis-report.json', 'utf8'))
    loopStats = {
      total_loop_runs: la.total_runs,
      trajectories_added: la.total_added,
      zero_yield_runs: la.zero_runs,
      zero_yield_rate_pct: la.zero_run_rate_pct,
      yield_per_run: la.total_runs ? +(la.total_added / la.total_runs).toFixed(3) : null,
      rejection_signals: la.rejection_signals,
      per_domain_loops: {
        medicine: { runs: la.medicine_analysis?.total_runs, added: la.medicine_analysis?.total_added },
        climate: { runs: la.climate_analysis?.total_runs, added: la.climate_analysis?.total_added },
        astronomy: { runs: la.astronomy_analysis?.total_runs, added: la.astronomy_analysis?.total_added },
        nutrition: { runs: la.nutrition_analysis?.total_runs, added: la.nutrition_analysis?.total_added },
      },
    }
  }
  // candidate consideration: count decisions.jsonl lines if present
  const decisionFiles = ['settling-curve-decisions.jsonl', 'medicine-decisions.jsonl', 'astronomy-decisions.jsonl', 'climate-decisions.jsonl', 'nutrition-decisions.jsonl']
  const decisionCounts: Record<string, number> = {}
  let totalDecisionLines = 0
  for (const f of decisionFiles) {
    const path = `logs/${f}`
    if (!existsSync(path)) continue
    const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim()).length
    decisionCounts[f] = lines
    totalDecisionLines += lines
  }

  // ══════════════════ ASSEMBLE JSON ══════════════════
  const report = {
    generated_from_live_db: true,
    corpus_overview: {
      total_trajectories: total,
      total_transition_events: totalEvents,
      avg_events_per_trajectory: +(totalEvents / total).toFixed(3),
      date_range: dateRange,
      pipelines: sortObjByVal(byIngest),
      n_pipelines: Object.keys(byIngest).length,
    },
    trajectory_structure: {
      depth: { ...depthStats, histogram: depthHist },
      time_span_years: { ...spanStats, percentiles: spanPct, note: 'first→last milestone; claims with ≥2 milestones only' },
      settlement_velocity_years: { ...velocityStats, percentiles: velocityPct, note: 'claimEmergedAt→first RECORDED→SETTLED; right-skewed, prefer median' },
      endpoint_distribution: endpoint,
      endpoint_distribution_pct: endpointPct,
      endpoint_entropy_bits: endpointEntropy,
      detour_rate_pct: detourRatePct,
      detour_n: detourCount,
      ever_contested_pct: contestationRatePct,
      ever_contested_n: everContested.size,
    },
    community_analysis: {
      first_ratifier_distribution: sortObjByVal(firstRatifier),
      first_ratifier_pct: Object.fromEntries(Object.entries(sortObjByVal(firstRatifier)).map(([k, v]) => [k, +((v / total) * 100).toFixed(2)])),
      community_event_counts: sortObjByVal(communityEvents),
      top_sequences: topSequences,
      multi_community_n: multiCommunity,
      multi_community_pct: multiCommunityPct,
      cooccurrence_matrix: coOccur,
    },
    domain_era: {
      domain_distribution: sortObjByVal(domainDist),
      era_distribution: eraDist,
      unknown_era_n: unknownEra,
      domain_x_era: domainEra,
    },
    geographic_coverage: {
      claim_location_rows: locRows,
      trajectories_with_geo: geoClaims.size,
      trajectories_with_geo_pct: +((geoClaims.size / total) * 100).toFixed(2),
      country_distribution: sortObjByVal(geoCountry),
      note: geoClaims.size === 0
        ? 'NO geo tags exist on trajectory: claims. ClaimLocation geocoding (USGS/OpenAlex/ClinicalTrials/courts) covers other ingestion pipelines, not the seed trajectory corpus. Geographic analysis is not possible without a geotagging pass over trajectories.'
        : 'Partial geo coverage; see country_distribution.',
    },
    loop_generation_stats: { ...loopStats, decision_log_lines: decisionCounts, total_decision_log_lines: totalDecisionLines },
  }

  writeFileSync('logs/paper-descriptives-report.json', JSON.stringify(report, null, 2))

  // ══════════════════ MARKDOWN DRAFT ══════════════════
  const md = renderMarkdown(report)
  writeFileSync('logs/paper-descriptives-report.md', md)

  console.log(JSON.stringify(report, null, 2))
  console.log('\n--- written to logs/paper-descriptives-report.json + .md ---')
  await p.$disconnect()
}

function pctRow(o: Record<string, number>, total: number) {
  return Object.entries(o).map(([k, v]) => `${k}: ${v} (${((v / total) * 100).toFixed(1)}%)`).join(', ')
}

function renderMarkdown(r: any): string {
  const co = r.corpus_overview
  const ts = r.trajectory_structure
  const ca = r.community_analysis
  const de = r.domain_era
  const geo = r.geographic_coverage
  const loop = r.loop_generation_stats
  const N = co.total_trajectories

  const lines: string[] = []
  lines.push('# Settling-Curve Corpus — Descriptive Statistics (Methods/Results Draft)')
  lines.push('')
  lines.push('_Generated directly from the live database. Restricted to claims with `externalId` prefix `trajectory:` and their `ClaimStatusHistory` transition rows._')
  lines.push('')

  // Corpus overview
  lines.push('## 1. Corpus Overview')
  lines.push('')
  lines.push(`The corpus comprises **${N.toLocaleString()} epistemic trajectories**, each a claim whose status history records its passage across a five-state epistemic axis (RECORDED → SETTLED → CONTESTED → REVERSED / ABANDONED / OPEN / UNRESOLVABLE). Across these trajectories there are **${co.total_transition_events.toLocaleString()} ratified transition events** (milestones), a mean of **${co.avg_events_per_trajectory}** events per trajectory. The earliest recorded milestone dates to **${co.date_range.earliest_first_milestone}** and the latest to **${co.date_range.latest_last_milestone}**.`)
  lines.push('')
  lines.push(`Trajectories were produced by ${co.n_pipelines} seed/ingestion pipelines:`)
  lines.push('')
  lines.push('| Pipeline | N | % |')
  lines.push('|---|---:|---:|')
  for (const [k, v] of Object.entries(co.pipelines)) lines.push(`| ${k} | ${(v as number).toLocaleString()} | ${((v as number) / N * 100).toFixed(1)}% |`)
  lines.push('')

  // Trajectory structure
  lines.push('## 2. Trajectory Structure')
  lines.push('')
  lines.push(`**Depth (milestones per trajectory).** ${describeLine(ts.depth)} Most trajectories follow the minimal RECORDED→SETTLED arc; **${ts.detour_rate_pct}%** (n=${ts.detour_n}) take a *detour* (depth > 2: a contestation, reversal, or re-recording before settling), and **${ts.ever_contested_pct}%** (n=${ts.ever_contested_n}) touch CONTESTED at some point.`)
  lines.push('')
  lines.push('| Depth | N trajectories |')
  lines.push('|---:|---:|')
  for (const [d, n] of Object.entries(ts.depth.histogram).sort((a, b) => +a[0] - +b[0])) lines.push(`| ${d} | ${n} |`)
  lines.push('')
  lines.push(`**Milestone time span (years, first→last milestone).** ${describeLine(ts.time_span_years)} Percentiles: ${pctLine(ts.time_span_years.percentiles)}.`)
  lines.push('')
  lines.push(`**Settlement velocity (years, claim emergence→first SETTLED).** ${describeLine(ts.settlement_velocity_years)} The distribution is heavily right-skewed — ancient claims whose emergence predates their settlement marker by centuries inflate the mean, so the **median (${ts.settlement_velocity_years.median} y)** is the appropriate central estimate. Percentiles: ${pctLine(ts.settlement_velocity_years.percentiles)}.`)
  lines.push('')
  lines.push(`**Endpoint distribution.** Endpoint entropy is only **${ts.endpoint_entropy_bits} bits** — the corpus is strongly survivorship-biased toward settlement:`)
  lines.push('')
  lines.push('| Endpoint (epistemicAxis) | N | % |')
  lines.push('|---|---:|---:|')
  for (const [k, v] of Object.entries(ts.endpoint_distribution).sort((a, b) => (b[1] as number) - (a[1] as number))) lines.push(`| ${k} | ${v} | ${ts.endpoint_distribution_pct[k]}% |`)
  lines.push('')

  // Community
  lines.push('## 3. Community Analysis')
  lines.push('')
  lines.push(`Each transition is ratified by one of five communities. Unlike the broader Epistemic Receipts corpus (~94% EXPERT_LITERATURE), the trajectory corpus is **deliberately multi-community**: **${ca.multi_community_pct}%** (n=${ca.multi_community_n}) of trajectories involve more than one ratifying community.`)
  lines.push('')
  lines.push('**First ratifier (community of the earliest milestone):**')
  lines.push('')
  lines.push('| Community | N | % |')
  lines.push('|---|---:|---:|')
  for (const [k, v] of Object.entries(ca.first_ratifier_distribution)) lines.push(`| ${k} | ${v} | ${ca.first_ratifier_pct[k]}% |`)
  lines.push('')
  lines.push('**Top 10 community sequences** (communities ordered by first appearance):')
  lines.push('')
  lines.push('| Sequence | N |')
  lines.push('|---|---:|')
  for (const [seq, n] of ca.top_sequences) lines.push(`| ${seq} | ${n} |`)
  lines.push('')
  lines.push('**Community co-occurrence matrix** (diagonal = trajectories the community appears in; off-diagonal = trajectories sharing both):')
  lines.push('')
  const comms = Object.keys(ca.cooccurrence_matrix)
  lines.push('| | ' + comms.join(' | ') + ' |')
  lines.push('|---|' + comms.map(() => '---:').join('|') + '|')
  for (const a of comms) lines.push(`| **${a}** | ` + comms.map((b) => ca.cooccurrence_matrix[a][b]).join(' | ') + ' |')
  lines.push('')

  // Domain / era
  lines.push('## 4. Domain & Era Breakdown')
  lines.push('')
  lines.push('Domain is inferred from the trajectory slug via a rule-based classifier (15 categories + fallback); era is bucketed from `claimEmergedAt`.')
  lines.push('')
  lines.push('**Domain distribution:**')
  lines.push('')
  lines.push('| Domain | N | % |')
  lines.push('|---|---:|---:|')
  for (const [k, v] of Object.entries(de.domain_distribution)) lines.push(`| ${k} | ${v} | ${((v as number) / N * 100).toFixed(1)}% |`)
  lines.push('')
  lines.push('**Era distribution:**')
  lines.push('')
  lines.push('| Era | N |')
  lines.push('|---|---:|')
  const eraOrder = ['ancient (pre-0)', 'late-antiquity (0-499)', 'early-medieval (500-999)', 'medieval (1000-1499)', 'early-modern (1500-1699)', '18th century', '19th century (early)', '19th century (late)', '20th century (early)', '20th century (late)', '21st century', 'unknown']
  for (const k of eraOrder) if (de.era_distribution[k]) lines.push(`| ${k} | ${de.era_distribution[k]} |`)
  lines.push('')
  lines.push(`A full domain × era cross-tabulation is provided as a JSON table in the machine-readable report (\`domain_era.domain_x_era\`).`)
  lines.push('')

  // Geo
  lines.push('## 5. Geographic Coverage')
  lines.push('')
  if (geo.trajectories_with_geo === 0) {
    lines.push(`⚠️ **No geographic tags exist on the trajectory corpus.** Zero of ${N.toLocaleString()} trajectory claims have \`ClaimLocation\` rows. The platform's geocoding pipelines (USGS events, OpenAlex ROR, ClinicalTrials sites, court seats) cover *other* ingestion streams, not the seed trajectory claims. Geographic / Western-vs-non-Western analysis is **not currently possible** and would require a dedicated geotagging pass over trajectory slugs.`)
  } else {
    lines.push(`${geo.trajectories_with_geo} of ${N} trajectories (${geo.trajectories_with_geo_pct}%) carry geo tags across ${Object.keys(geo.country_distribution).length} countries.`)
  }
  lines.push('')

  // Loop
  lines.push('## 6. Loop / Generation Statistics (AI Audit Paper)')
  lines.push('')
  if (loop.total_loop_runs) {
    lines.push(`The corpus was assembled by autonomous AI generation loops. Across **${loop.total_loop_runs.toLocaleString()} loop runs**, ${loop.trajectories_added} trajectories were added in the analyzed window — a yield of **${loop.yield_per_run} per run** and a **${loop.zero_yield_rate_pct}% zero-yield rate** (${loop.zero_yield_runs.toLocaleString()} runs produced nothing new). This near-saturation is itself a primary finding: the loop has largely exhausted easily-discovered settled claims in its seeded domains.`)
    lines.push('')
    lines.push('| Domain loop | Runs | Added |')
    lines.push('|---|---:|---:|')
    for (const [k, v] of Object.entries(loop.per_domain_loops)) lines.push(`| ${k} | ${(v as any).runs ?? 0} | ${(v as any).added ?? 0} |`)
    lines.push('')
    const rejSig = loop.rejection_signals
    const rejStr = Array.isArray(rejSig) ? rejSig.join(', ') : rejSig && typeof rejSig === 'object' ? Object.entries(rejSig).map(([k, v]) => `${k}=${v}`).join(', ') : 'n/a'
    lines.push(`Rejection signals observed: ${rejStr}. Decision logs parsed: ${loop.total_decision_log_lines?.toLocaleString?.() ?? loop.total_decision_log_lines} entries across ${Object.keys(loop.decision_log_lines || {}).length} domain logs.`)
  } else {
    lines.push('_Loop statistics unavailable — run `log-analysis.ts` first._')
  }
  lines.push('')

  return lines.join('\n')
}

function describeLine(d: any): string {
  return `N=${d.n}, min=${d.min}, max=${d.max}, mean=${d.mean}, median=${d.median}, SD=${d.sd}.`
}
function pctLine(p: any): string {
  return Object.entries(p).map(([k, v]) => `${k}=${v}`).join(', ')
}

main().catch((e) => { console.error(e); process.exit(1) })
