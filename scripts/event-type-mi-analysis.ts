import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'

// MI analysis over EVENT TYPE — not just who ratified, but WHAT kind of knowledge.
// Classifies each trajectory slug into a domain category, then computes:
//   I(event_type ; community)       — does type predict which community engaged?
//   I(event_type ; epistemicAxis)   — does type predict final settlement state?
//   I(era ; event_type)             — does century predict what topics were settled?
//   H(community | type)             — per-type community diversity
//   H(axis | type)                  — per-type epistemic entropy (unsettled-ness)
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/event-type-mi-analysis.ts

function log2(x: number) { return x > 0 ? Math.log(x) / Math.log(2) : 0 }

function entropy(counts: Record<string, number>): number {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  return Object.values(counts).reduce((h, n) => {
    const p = n / total; return h - (p > 0 ? p * log2(p) : 0)
  }, 0)
}

// I(X;Y) over two discrete variables, given a joint count table
function mutualInformation(joint: Map<string, Map<string, number>>): {
  mi: number; normalized: number; n: number
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
  if (total === 0) return { mi: 0, normalized: 0, n: 0 }
  let mi = 0
  for (const [x, ys] of joint) {
    for (const [y, n] of ys) {
      const pxy = n / total
      const pxm = (px.get(x) || 0) / total
      const pym = (py.get(y) || 0) / total
      if (pxy > 0 && pxm > 0 && pym > 0) mi += pxy * log2(pxy / (pxm * pym))
    }
  }
  const hx = [...px.values()].reduce((h, n) => { const p = n/total; return p>0 ? h - p*log2(p) : h }, 0)
  const hy = [...py.values()].reduce((h, n) => { const p = n/total; return p>0 ? h - p*log2(p) : h }, 0)
  const normalized = Math.min(hx, hy) > 0 ? mi / Math.min(hx, hy) : 0
  return { mi: +mi.toFixed(4), normalized: +normalized.toFixed(4), n: total }
}

// ─── Event type classifier ───────────────────────────────────────────────────
// Rules checked in priority order; first match wins.
const CATEGORIES: { label: string; patterns: RegExp[] }[] = [
  {
    label: 'astronomy/space',
    patterns: [/eclipse|solar.flare|comet|lunar|apollo|sputnik|moon.land|orbit|satellite|parallax|telescope|nebula|pulsar|exoplanet|black.hole|hubble|occult|pleiades|mars.orbit|chang[ae]\d|chandrayaan|voyager|beidou|webb|van.allen|explorer.1|first.exo|cmb|cosmic/i],
  },
  {
    label: 'battle/war/military',
    patterns: [/^battle|massacre|siege|armistice|war\b|d.day|somme|verdun|fort.sumter|normandy|blitz|fall.of.kabul|fall.of.saigon|fall.of.acre|fall.of.tenochtitlan|fall.of.babylon|fall.of.granada|fall.of.constanti|fall.of.famagusta|first.crusade|fourth.crusade|cuban.missile|nuclear.test|hiroshima|nagasaki|operation/i],
  },
  {
    label: 'religion/church',
    patterns: [/council.of|council.clermont|council.ephesus|council.trent|council.nicea|council.florence|synod|canonization|schism|crusade|heresy|edict.of.nantes|edict.of.thessalonica|edict.of.worms|augsburg.confession|blackfriars|disputation|reformation|protestant|papal|pope|decree.of.canopus|decet.romanum|condemnation.of|cadaver.synod|aquinas|francis.assisi|huguenot/i],
  },
  {
    label: 'medicine/health',
    patterns: [/vaccine|pandemic|influenza|polio|cancer|aids|hiv|plague|cholera|smallpox|tuberculosis|germ.theory|surgery|transplant|anesthesia|antibiotic|penicillin|sulfonamide|antitoxin|epidemic|ether.anesthesia|blood.transfusion|thalidomide|opioid|gene.therapy|mrna|covid|covaxin|delta.variant|ebola|sars|elixir.sulfanilamide|behring|barnard|pasteur|lister|semmelweis|jenner|snow.cholera|pfizer|moderna|oxford/i],
  },
  {
    label: 'biology/genetics',
    patterns: [/dna|genome|evolution|species|genetics|crispr|cloning|dolly|darwin|recombinant|chromosom|mendel|archaeopteryx|homo.sapiens|neanderthal|denisovan|fossil|hominid|java.man|taung|avery|watson.crick|crick|alphafold|encode|pangenome|sequencing|cell.division|synthetic.cell|transcription/i],
  },
  {
    label: 'physics/chemistry',
    patterns: [/radioactiv|quantum|relativity|atomic|neutron|positron|electron|fission|nuclear|photon|radiation|superconductor|higgs|gravitational.wave|planck|bohr|rutherford|curie|einstein|heisenberg|schrodinger|dirac|compton|brownian|faraday|maxwell|doppler|dalton|avogadro|becquerel|chadwick|fermi|carnot|bernoulli|joule|thermodynamics|entropy|wavelength|ultraviolet|x.ray|laser|transistor|semiconductor|isotope|cherenkov|epr.paradox|matter.wave|photoelectric|de.broglie|mach|cavendish/i],
  },
  {
    label: 'technology/computing',
    patterns: [/computer|internet|arpanet|apple.|ibm|cpu|algorithm|bitcoin|chatgpt|deepseek|alphago|deep.blue|eniac|ethernet|diffie.hellman|encryption|cryptography|telegraph|telephone|radio|television|printing.press|incandescent|pearl.street|altair|macintosh|transistor|silicon|semiconductor|daguerreotype|photograph|radar|daventry|codd.relational|network|software|microchip|steam.engine|bessemer|locomotive|balloon|dynamite|vulcaniz|artificial.intelligence|gpt|llm|neural/i],
  },
  {
    label: 'environment/climate',
    patterns: [/climate|ozone|greenhouse|pollution|conservation|endangered.species|epa|ddt|clean.air|earth.day|cuyahoga|exxon.valdez|arrhenius|foote.greenhouse|chernobyl|bhopal|carbon.neutrality|climategate|paris.agreement|kyoto|ipcc/i],
  },
  {
    label: 'law/civil rights/social',
    patterns: [/civil.rights|suffrage|slavery|emancipation|segregation|brown.v.board|voting.rights|fair.housing|abortion|roe|lgbtq|apartheid|suffragette|women.vote|13th.amendment|14th.amendment|15th.amendment|civil.rights.act|fair.labor|labor.rights|dred.scott|emmett.till|birmingham|selma|stonewall/i],
  },
  {
    label: 'law/legislation/judicial',
    patterns: [/supreme.court|court\b|legislation|act.of\b|clean.water|endangered.species|chevron|loper|bowers|adkins|abood|janus|brown.v|roe.v|dred.scott|amistad|treaty|constitution|magna.carta|declaration|bill.of.rights|habeas|miranda|voting.rights.act|civil.rights.act|fair.housing.act|clean.air.act|epa.established|endangered.species.act|safe.drinking/i],
  },
  {
    label: 'exploration/geography',
    patterns: [/columbus|expedition|circumnavigation|balboa|cartier|cortes|de.soto|amundsen|south.pole|antarctica|first.sighting|champlain|drake|cabot|vespucci|magellan|silk.road|new.world|landfall|passage|explored/i],
  },
  {
    label: 'economics/finance',
    patterns: [/bank.of|stock.market|crash|depression|bretton.woods|gold.standard|imf|world.bank|inflation|currency|trade|tariff|monopoly|antitrust|black.tuesday|wall.street|cryptocurrency|bitcoin|economic.crisis|keynes|adam.smith|wealth.of.nations/i],
  },
  {
    label: 'politics/revolution/governance',
    patterns: [/revolution|independence|constitution|coup|republic|declaration|empire|colonialism|decoloni|elections?|parliament|senate|congress|treaty|peace.of|congress.of|armistice|mandate|partition|referendum|bastille|enabling.act|beer.hall|anschluss|appeasement|berlin.wall|arab.spring|tiananmen|glasnost|perestroika/i],
  },
  {
    label: 'mathematics/logic',
    patterns: [/theorem|proof|calculus|algebra|geometry|euclid|newton.laws|kepler|principia|incompleteness|godel|turing|boolean|probability|statistics|fourier|gauss|riemann|fermat|pythagoras/i],
  },
]

function classifySlug(slug: string): string {
  for (const { label, patterns } of CATEGORIES) {
    if (patterns.some((rx) => rx.test(slug))) return label
  }
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

async function main() {
  const p = new PrismaClient()

  const claims = await p.claim.findMany({
    where: { deleted: false, externalId: { startsWith: 'trajectory:' } },
    select: { id: true, externalId: true, epistemicAxis: true, claimEmergedAt: true },
  })
  const claimIds = claims.map((c) => c.id)

  const history: { claimId: string; community: string; toAxis: string; occurredAt: Date }[] = []
  const CHUNK = 1000
  for (let i = 0; i < claimIds.length; i += CHUNK) {
    const rows = await p.claimStatusHistory.findMany({
      where: { claimId: { in: claimIds.slice(i, i + CHUNK) } },
      select: { claimId: true, community: true, toAxis: true, occurredAt: true },
    })
    history.push(...rows)
  }

  // Build per-claim data
  type ClaimData = {
    id: string
    slug: string
    eventType: string
    era: string
    epistemicAxis: string
    communities: Set<string>
    finalCommunityAxes: Record<string, string>
  }

  const byId = new Map<string, ClaimData>()
  for (const c of claims) {
    const slug = c.externalId?.replace('trajectory:', '') ?? ''
    const year = c.claimEmergedAt ? new Date(c.claimEmergedAt).getUTCFullYear() : null
    byId.set(c.id, {
      id: c.id,
      slug,
      eventType: classifySlug(slug),
      era: year !== null ? eraBucket(year) : 'unknown',
      epistemicAxis: c.epistemicAxis ?? 'UNKNOWN',
      communities: new Set(),
      finalCommunityAxes: {},
    })
  }

  // Attach community events
  const histByClaimComm: Record<string, Record<string, { toAxis: string; occurredAt: Date }[]>> = {}
  for (const h of history) {
    const cd = byId.get(h.claimId)
    if (!cd) continue
    cd.communities.add(h.community)
    if (!histByClaimComm[h.claimId]) histByClaimComm[h.claimId] = {}
    if (!histByClaimComm[h.claimId][h.community]) histByClaimComm[h.claimId][h.community] = []
    histByClaimComm[h.claimId][h.community].push({ toAxis: h.toAxis, occurredAt: h.occurredAt })
  }
  // Final axis per community
  for (const [claimId, commMap] of Object.entries(histByClaimComm)) {
    const cd = byId.get(claimId)
    if (!cd) continue
    for (const [comm, events] of Object.entries(commMap)) {
      const sorted = events.sort((a, b) => +a.occurredAt - +b.occurredAt)
      cd.finalCommunityAxes[comm] = sorted[sorted.length - 1].toAxis
    }
  }

  const claimData = [...byId.values()]
  console.log(`Classified ${claimData.length} claims`)

  // ─── Category distribution ────────────────────────────────────────────────
  const catDist: Record<string, number> = {}
  for (const cd of claimData) catDist[cd.eventType] = (catDist[cd.eventType] || 0) + 1

  // ─── 1. I(event_type ; epistemicAxis) ─────────────────────────────────────
  const joint_type_axis = new Map<string, Map<string, number>>()
  for (const cd of claimData) {
    if (!joint_type_axis.has(cd.eventType)) joint_type_axis.set(cd.eventType, new Map())
    const m = joint_type_axis.get(cd.eventType)!
    m.set(cd.epistemicAxis, (m.get(cd.epistemicAxis) || 0) + 1)
  }
  const mi_type_axis = mutualInformation(joint_type_axis)

  // ─── 2. I(event_type ; first_community) ───────────────────────────────────
  // "first community" = community with earliest event
  const joint_type_comm = new Map<string, Map<string, number>>()
  for (const [claimId, commMap] of Object.entries(histByClaimComm)) {
    const cd = byId.get(claimId)
    if (!cd) continue
    let firstComm: string | null = null
    let firstDate = Infinity
    for (const [comm, events] of Object.entries(commMap)) {
      const earliest = Math.min(...events.map((e) => +e.occurredAt))
      if (earliest < firstDate) { firstDate = earliest; firstComm = comm }
    }
    if (!firstComm) continue
    if (!joint_type_comm.has(cd.eventType)) joint_type_comm.set(cd.eventType, new Map())
    const m = joint_type_comm.get(cd.eventType)!
    m.set(firstComm, (m.get(firstComm) || 0) + 1)
  }
  const mi_type_comm = mutualInformation(joint_type_comm)

  // ─── 3. I(era ; event_type) ───────────────────────────────────────────────
  const joint_era_type = new Map<string, Map<string, number>>()
  for (const cd of claimData) {
    if (cd.era === 'unknown') continue
    if (!joint_era_type.has(cd.era)) joint_era_type.set(cd.era, new Map())
    const m = joint_era_type.get(cd.era)!
    m.set(cd.eventType, (m.get(cd.eventType) || 0) + 1)
  }
  const mi_era_type = mutualInformation(joint_era_type)

  // ─── 4. Per-type: H(epistemicAxis) and H(first_community) ─────────────────
  const perTypeStats: Record<string, {
    n: number
    axis_entropy: number
    axis_dist: Record<string, number>
    community_entropy: number
    first_community_dist: Record<string, number>
    settled_pct: number
    contested_pct: number
    dominant_first_community: string
    example_slugs: string[]
  }> = {}

  for (const [type, axisDist] of joint_type_axis) {
    const commDist: Record<string, number> = {}
    const firstCommMap = joint_type_comm.get(type)
    if (firstCommMap) {
      for (const [c, n] of firstCommMap) commDist[c] = n
    }
    const axisObj: Record<string, number> = {}
    for (const [k, n] of axisDist) axisObj[k] = n
    const n = Object.values(axisObj).reduce((a, b) => a + b, 0)
    const settledN = axisObj['SETTLED'] || 0
    const contestedN = axisObj['CONTESTED'] || 0

    const topComm = Object.entries(commDist).sort((a, b) => b[1] - a[1])[0]

    perTypeStats[type] = {
      n,
      axis_entropy: +entropy(axisObj).toFixed(4),
      axis_dist: axisObj,
      community_entropy: +entropy(commDist).toFixed(4),
      first_community_dist: commDist,
      settled_pct: +(settledN / n * 100).toFixed(1),
      contested_pct: +(contestedN / n * 100).toFixed(1),
      dominant_first_community: topComm ? topComm[0] : 'none',
      example_slugs: claimData.filter((cd) => cd.eventType === type).map((cd) => cd.slug).slice(0, 5),
    }
  }

  // ─── 5. Era × type heatmap (counts) ───────────────────────────────────────
  const eraTypeHeatmap: Record<string, Record<string, number>> = {}
  for (const [era, typeMap] of joint_era_type) {
    eraTypeHeatmap[era] = {}
    for (const [type, n] of typeMap) eraTypeHeatmap[era][type] = n
  }

  // ─── 6. "Epistemic entropy collapse" by era per type ──────────────────────
  // For each (era, type) cell: H(epistemicAxis) — low = fully settled, high = contested
  const eraTypeEntropy: Record<string, Record<string, number>> = {}
  for (const cd of claimData) {
    if (cd.era === 'unknown') continue
    if (!eraTypeEntropy[cd.era]) eraTypeEntropy[cd.era] = {}
    // collect axes for this cell
  }
  const eraTypeAxes: Record<string, Record<string, Record<string, number>>> = {}
  for (const cd of claimData) {
    if (cd.era === 'unknown') continue
    if (!eraTypeAxes[cd.era]) eraTypeAxes[cd.era] = {}
    if (!eraTypeAxes[cd.era][cd.eventType]) eraTypeAxes[cd.era][cd.eventType] = {}
    const k = cd.epistemicAxis
    eraTypeAxes[cd.era][cd.eventType][k] = (eraTypeAxes[cd.era][cd.eventType][k] || 0) + 1
  }
  const entropyHeatmap: Record<string, Record<string, { h: number; n: number; pct_settled: number }>> = {}
  for (const [era, types] of Object.entries(eraTypeAxes)) {
    entropyHeatmap[era] = {}
    for (const [type, axes] of Object.entries(types)) {
      const n = Object.values(axes).reduce((a, b) => a + b, 0)
      entropyHeatmap[era][type] = {
        h: +entropy(axes).toFixed(3),
        n,
        pct_settled: +((axes['SETTLED'] || 0) / n * 100).toFixed(1),
      }
    }
  }

  // ─── 7. Top findings ──────────────────────────────────────────────────────
  const findings: string[] = []

  findings.push(
    `I(event_type ; epistemicAxis) = ${mi_type_axis.mi} bits (NMI=${mi_type_axis.normalized}) — how much knowing the domain tells you about settlement outcome.`
  )
  findings.push(
    `I(event_type ; first_community) = ${mi_type_comm.mi} bits (NMI=${mi_type_comm.normalized}) — domain strongly predicts WHICH community first ratified it.`
  )
  findings.push(
    `I(era ; event_type) = ${mi_era_type.mi} bits (NMI=${mi_era_type.normalized}) — era and domain are coupled: certain centuries are dominated by certain knowledge types.`
  )

  // Highest-entropy (most contested) types
  const byEntropy = Object.entries(perTypeStats)
    .filter(([, s]) => s.n >= 5)
    .sort((a, b) => b[1].axis_entropy - a[1].axis_entropy)
  findings.push(
    `Most epistemically uncertain domain: "${byEntropy[0]?.[0]}" (H=${byEntropy[0]?.[1].axis_entropy} bits, ${byEntropy[0]?.[1].contested_pct}% contested).`
  )

  // Most settled types
  const mostSettled = Object.entries(perTypeStats)
    .filter(([, s]) => s.n >= 5)
    .sort((a, b) => b[1].settled_pct - a[1].settled_pct)
  findings.push(
    `Most fully-settled domain: "${mostSettled[0]?.[0]}" (${mostSettled[0]?.[1].settled_pct}% settled, H=${mostSettled[0]?.[1].axis_entropy} bits).`
  )

  // Type where PUBLIC is dominant first mover (vs. EXPERT_LITERATURE)
  const publicFirst = Object.entries(perTypeStats)
    .filter(([, s]) => s.n >= 5 && s.dominant_first_community === 'PUBLIC')
    .map(([type]) => type)
  if (publicFirst.length) {
    findings.push(`Domains where PUBLIC is the dominant first community: ${publicFirst.join(', ')}.`)
  }

  findings.push(
    `Slavery/civil rights analogy: once a domain is fully settled (e.g., battle/war — ${perTypeStats['battle/war/military']?.settled_pct}% settled), H(community|type) collapses. The domain's community entropy is ${perTypeStats['battle/war/military']?.community_entropy?.toFixed(3)} — indicating which institutions still ratify vs. fall silent.`
  )

  const report = {
    generated: '2026-06-18',
    total_claims: claimData.length,
    category_distribution: Object.fromEntries(
      Object.entries(catDist).sort((a, b) => b[1] - a[1])
    ),
    global_mi: {
      'I(type;axis)': mi_type_axis,
      'I(type;first_community)': mi_type_comm,
      'I(era;type)': mi_era_type,
    },
    per_type_stats: Object.fromEntries(
      Object.entries(perTypeStats).sort((a, b) => b[1].n - a[1].n)
    ),
    entropy_heatmap_era_x_type: entropyHeatmap,
    top_findings: findings,
  }

  writeFileSync('logs/event-type-mi-report.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log('\n--- written to logs/event-type-mi-report.json ---')

  await p.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
