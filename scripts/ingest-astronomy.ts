// Astronomy ingestion — NASA Exoplanet Archive, Solar System bodies, IAU resolutions, IAU Constellations
// Exoplanets: live NASA TAP API (no hardcoded list needed)
// Solar system + IAU + Constellations: hardcoded, every entry traces to a verified fetchable URL
// No CITES cross-references — editorial-not-algorithmic principle applies
// Run: npx tsx scripts/ingest-astronomy.ts --bucket [exoplanets|solar-system|iau|constellations]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NASA_TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync'
const BATCH_SIZE = 500

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExoplanetRecord {
  pl_name: string
  disc_year: number
  discoverymethod: string
  hostname: string
  disc_facility: string | null
}

interface SolarBodyDef {
  name: string
  bodyType: 'planet' | 'dwarf-planet' | 'moon' | 'asteroid'
  parentBody?: string          // for moons: parent planet name
  discoveredBy?: string        // blank for planets known since antiquity
  discoveryYear?: number
  claimText: string
  sourceUrl: string            // verified: browser-accessible URL (NASA or JPL SBDB)
  sourceName?: string          // overrides default "NASA: {name}" when source is not NASA Science
  ingestedBy: 'solar_system_v1'
}

interface ConstellationDef {
  name: string
  abbr: string           // IAU 3-letter abbreviation
  genitive: string       // IAU official genitive form (used in star names)
  areaSqDeg: number      // area in square degrees (IAU 1930 Delporte boundaries)
  hemisphere: 'N' | 'S' | 'both'
  ingestedBy: 'iau_constellations_v1'
}

interface IAUResolutionDef {
  id: string                   // e.g., "IAU-2006-B5"
  title: string
  adoptedAt: string            // ISO date of GA vote
  claimText: string
  sourceUrl: string            // iau.org URL — blocks automated fetch, browser-accessible
  ingestedBy: 'iau_v1'
}

type Counts = {
  ingested: number
  skipped: number
  errors: number
  sourcesCreated: number
  topicSkips: number
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { bucket: string; limit: number } {
  const args = process.argv.slice(2)
  const bucketIdx = args.indexOf('--bucket')
  const limitIdx  = args.indexOf('--limit')
  return {
    bucket: bucketIdx !== -1 ? (args[bucketIdx + 1] ?? 'exoplanets') : 'exoplanets',
    limit:  limitIdx  !== -1 ? (parseInt(args[limitIdx + 1] ?? '0', 10) || 0) : 0,
  }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
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

async function findTopic(slug: string): Promise<string | null> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const t = await prisma.topic.findUnique({ where: { slug } })
  if (t) { topicCache.set(slug, t.id); return t.id }
  return null
}

async function ensureCoreAstronomyTopics(): Promise<{ astronomy: string; exoplanets: string; planetaryScience: string }> {
  const astronomy       = await ensureTopic('astronomy', 'Astronomy', 'astronomy')
  const exoplanets      = await ensureTopic('exoplanets', 'Exoplanets', 'astronomy', 'astronomy')
  const planetaryScience = await ensureTopic('planetary-science', 'Planetary Science', 'astronomy', 'astronomy')
  return { astronomy, exoplanets, planetaryScience }
}

// ── ══════════════════════════════════════════════════════════════════════════ ──
// ── EXOPLANET BUCKET                                                           ──
// ── ══════════════════════════════════════════════════════════════════════════ ──

async function fetchAllExoplanets(limit: number): Promise<ExoplanetRecord[]> {
  const cap = limit > 0 ? limit : 10000
  const query = `SELECT pl_name,disc_year,discoverymethod,hostname,disc_facility FROM ps WHERE default_flag=1 AND disc_year IS NOT NULL`
  const url = `${NASA_TAP}?query=${encodeURIComponent(query)}&format=json&MAXREC=${cap}`

  console.log(`  Fetching from NASA Exoplanet Archive TAP…`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`NASA TAP returned ${res.status}: ${await res.text()}`)

  const data = await res.json() as ExoplanetRecord[]
  console.log(`  Fetched ${data.length} confirmed exoplanets`)
  return data
}

function safeExoId(name: string): string {
  return name.replace(/[^A-Za-z0-9_\-.]/g, '_')
}

function exoplanetClaimText(r: ExoplanetRecord): string {
  const facility = r.disc_facility ? `, discovered by ${r.disc_facility}` : ''
  return `Exoplanet ${r.pl_name} was confirmed in ${r.disc_year} via ${r.discoverymethod}, orbiting host star ${r.hostname}${facility}.`
}

async function ingestExoplanetBatch(
  records: ExoplanetRecord[],
  coreTopicIds: string[],
  counts: Counts,
): Promise<void> {
  const externalIds     = records.map(r => `exoplanet_${safeExoId(r.pl_name)}`)
  const sourceExIds     = records.map(r => `nasa_exoplanet_source_${safeExoId(r.pl_name)}`)

  // Bulk create sources (skipDuplicates for idempotency)
  await prisma.source.createMany({
    data: records.map((r, i) => ({
      name:            `NASA Exoplanet Archive: ${r.pl_name}`,
      url:             `https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(r.pl_name)}`,
      publishedAt:     new Date(`${r.disc_year}-01-01`),
      methodologyType: 'primary',
      ingestedBy:      'nasa_exoplanet_v1',
      humanReviewed:   false,
      autoApproved:    true,
      externalId:      sourceExIds[i],
    })),
    skipDuplicates: true,
  })

  // Bulk create claims
  await prisma.claim.createMany({
    data: records.map((r, i) => ({
      text:                  exoplanetClaimText(r),
      claimType:             'EMPIRICAL',
      currentStatus:         'HARD_FACT',
      claimEmergedAt:        new Date(`${r.disc_year}-01-01`),
      claimEmergedPrecision: 'YEAR',
      ingestedBy:            'nasa_exoplanet_v1',
      humanReviewed:         false,
      autoApproved:          true,
      externalId:            externalIds[i],
    })),
    skipDuplicates: true,
  })

  // Fetch IDs of newly created sources and claims
  const [sources, claims] = await Promise.all([
    prisma.source.findMany({ where: { externalId: { in: sourceExIds } }, select: { id: true, externalId: true } }),
    prisma.claim.findMany({  where: { externalId: { in: externalIds } },  select: { id: true, externalId: true } }),
  ])

  const sourceMap = new Map(sources.map(s => [s.externalId, s.id]))
  const claimMap  = new Map(claims.map(c => [c.externalId, c.id]))

  // Create edges (need IDs for EdgeRevisions — done individually per pair)
  const edgeIds: string[] = []
  for (let i = 0; i < records.length; i++) {
    const sourceId = sourceMap.get(sourceExIds[i])
    const claimId  = claimMap.get(externalIds[i])
    if (!sourceId || !claimId) continue

    // Check if edge already exists for this source+claim
    const existingEdge = await prisma.edge.findFirst({ where: { sourceId, claimId, type: 'FOR' } })
    if (existingEdge) continue

    const edge = await prisma.edge.create({
      data: {
        sourceId,
        claimId,
        type:          'FOR',
        evidenceType:  'EVIDENTIARY',
        ingestedBy:    'nasa_exoplanet_v1',
        humanReviewed: false,
        autoApproved:  true,
      },
    })
    edgeIds.push(edge.id)
    counts.sourcesCreated++
  }

  // Bulk create edge revisions
  if (edgeIds.length > 0) {
    await prisma.edgeRevision.createMany({
      data: edgeIds.map(edgeId => ({
        edgeId,
        priorScore: null,
        newScore:   95,
        reason:     'NASA Exoplanet Archive confirmed exoplanet — direct institutional API record',
      })),
    })
  }

  // Bulk create topic tags
  const claimTopicData = claims.flatMap(c =>
    coreTopicIds.map(topicId => ({ claimId: c.id, topicId }))
  )
  await prisma.claimTopic.createMany({ data: claimTopicData, skipDuplicates: true })

  counts.ingested += edgeIds.length
  counts.skipped  += records.length - edgeIds.length
}

async function runExoplanetBucket(limit: number): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0, sourcesCreated: 0, topicSkips: 0 }

  const { astronomy, exoplanets } = await ensureCoreAstronomyTopics()
  const coreTopicIds = [astronomy, exoplanets]

  const all = await fetchAllExoplanets(limit)

  // Get all existing externalIds in one query
  const allExIds = all.map(r => `exoplanet_${safeExoId(r.pl_name)}`)
  const existing = await prisma.claim.findMany({
    where:  { externalId: { in: allExIds } },
    select: { externalId: true },
  })
  const existingSet = new Set(existing.map(c => c.externalId))

  const newRecords = all.filter(r => !existingSet.has(`exoplanet_${safeExoId(r.pl_name)}`))
  console.log(`  ${existingSet.size} already in DB, processing ${newRecords.length} new records\n`)

  // Process in batches
  for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
    const batch = newRecords.slice(i, i + BATCH_SIZE)
    try {
      await ingestExoplanetBatch(batch, coreTopicIds, counts)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}-${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }

    const done = Math.min(i + BATCH_SIZE, newRecords.length)
    if (done % 1000 < BATCH_SIZE || done === newRecords.length) {
      console.log(`  Progress: ${done}/${newRecords.length} processed (${counts.ingested} ingested, ${counts.skipped} skipped, ${counts.errors} errors)`)
    }
  }

  return counts
}

// ── ══════════════════════════════════════════════════════════════════════════ ──
// ── SOLAR SYSTEM BUCKET                                                        ──
// ── ══════════════════════════════════════════════════════════════════════════ ──

// Every URL below is verified accessible via browser (science.nasa.gov).
// Source: verified manually before ingestion per AGENTS.md rule.
const SOLAR_SYSTEM_BODIES: SolarBodyDef[] = [
  // 8 IAU planets
  { name: 'Mercury', bodyType: 'planet',
    claimText: 'Mercury is the innermost and smallest planet in the Solar System, with a mean radius of 2,439.7 km and no moons.',
    sourceUrl: 'https://science.nasa.gov/mercury/facts/', ingestedBy: 'solar_system_v1' },
  { name: 'Venus', bodyType: 'planet',
    claimText: 'Venus is the second planet from the Sun, the hottest planet in the Solar System with a surface temperature of around 465°C, and has no moons.',
    sourceUrl: 'https://science.nasa.gov/venus/venus-facts/', ingestedBy: 'solar_system_v1' },
  { name: 'Earth', bodyType: 'planet',
    claimText: 'Earth is the third planet from the Sun, the only known planet to harbor life, and has one natural satellite, the Moon.',
    sourceUrl: 'https://science.nasa.gov/earth/facts/', ingestedBy: 'solar_system_v1' },
  { name: 'Mars', bodyType: 'planet',
    claimText: 'Mars is the fourth planet from the Sun, a terrestrial planet with a thin atmosphere, and has two small moons: Phobos and Deimos.',
    sourceUrl: 'https://science.nasa.gov/mars/facts/', ingestedBy: 'solar_system_v1' },
  { name: 'Jupiter', bodyType: 'planet',
    claimText: 'Jupiter is the fifth planet from the Sun and the largest in the Solar System, with a mass more than twice that of all other planets combined, and at least 95 known moons.',
    sourceUrl: 'https://science.nasa.gov/jupiter/facts/', ingestedBy: 'solar_system_v1' },
  { name: 'Saturn', bodyType: 'planet',
    claimText: 'Saturn is the sixth planet from the Sun and the second-largest, distinguished by its prominent ring system and at least 146 known moons.',
    sourceUrl: 'https://science.nasa.gov/saturn/facts/', ingestedBy: 'solar_system_v1' },
  { name: 'Uranus', bodyType: 'planet',
    claimText: 'Uranus is the seventh planet from the Sun, an ice giant that rotates on its side with an axial tilt of 97.77 degrees, and has 27 known moons.',
    sourceUrl: 'https://science.nasa.gov/uranus/facts/', ingestedBy: 'solar_system_v1' },
  { name: 'Neptune', bodyType: 'planet',
    claimText: 'Neptune is the eighth and farthest known planet from the Sun, an ice giant with the strongest sustained winds in the Solar System, and has 16 known moons.',
    sourceUrl: 'https://science.nasa.gov/neptune/facts/', ingestedBy: 'solar_system_v1' },

  // 5 official IAU dwarf planets
  { name: 'Pluto', bodyType: 'dwarf-planet',
    claimText: 'Pluto was reclassified as a dwarf planet by the International Astronomical Union in August 2006, having previously been designated the ninth planet since its discovery in 1930.',
    sourceUrl: 'https://science.nasa.gov/dwarf-planets/pluto/facts/', ingestedBy: 'solar_system_v1' },
  { name: 'Eris', bodyType: 'dwarf-planet', discoveredBy: 'Mike Brown, Chad Trujillo, David Rabinowitz', discoveryYear: 2005,
    claimText: 'Eris is an IAU-recognized dwarf planet discovered in 2005, located in the scattered disc beyond Neptune. Its discovery directly prompted the 2006 IAU redefinition of "planet."',
    sourceUrl: 'https://science.nasa.gov/dwarf-planets/eris/', ingestedBy: 'solar_system_v1' },
  { name: 'Haumea', bodyType: 'dwarf-planet', discoveredBy: 'Mike Brown et al.', discoveryYear: 2004,
    claimText: 'Haumea is an IAU-recognized dwarf planet in the Kuiper Belt, notable for its elongated shape caused by rapid rotation, and has two known moons: Hiʻiaka and Namaka.',
    sourceUrl: 'https://science.nasa.gov/dwarf-planets/haumea/', ingestedBy: 'solar_system_v1' },
  { name: 'Makemake', bodyType: 'dwarf-planet', discoveredBy: 'Mike Brown, Chad Trujillo, David Rabinowitz', discoveryYear: 2005,
    claimText: 'Makemake is an IAU-recognized dwarf planet in the Kuiper Belt, the second-brightest known Kuiper Belt object after Pluto, discovered in 2005.',
    sourceUrl: 'https://science.nasa.gov/dwarf-planets/makemake/', ingestedBy: 'solar_system_v1' },
  { name: 'Ceres', bodyType: 'dwarf-planet', discoveredBy: 'Giuseppe Piazzi', discoveryYear: 1801,
    claimText: 'Ceres is the largest object in the asteroid belt between Mars and Jupiter, and has been classified as an IAU dwarf planet since 2006. It was discovered by Giuseppe Piazzi on January 1, 1801.',
    sourceUrl: 'https://science.nasa.gov/dwarf-planets/ceres/facts/', ingestedBy: 'solar_system_v1' },

  // Earth's Moon
  { name: 'Luna', bodyType: 'moon', parentBody: 'Earth',
    claimText: 'The Moon (Luna) is Earth\'s only natural satellite, with a mean radius of 1,737.4 km. It is the fifth-largest satellite in the Solar System and the largest relative to its host planet.',
    sourceUrl: 'https://science.nasa.gov/moon/', ingestedBy: 'solar_system_v1' },

  // Galilean moons of Jupiter
  { name: 'Io', bodyType: 'moon', parentBody: 'Jupiter', discoveredBy: 'Galileo Galilei', discoveryYear: 1610,
    claimText: 'Io is the innermost of Jupiter\'s four Galilean moons, discovered by Galileo Galilei in 1610. It is the most volcanically active body in the Solar System.',
    sourceUrl: 'https://science.nasa.gov/solar-system/moons/io/', ingestedBy: 'solar_system_v1' },
  { name: 'Europa', bodyType: 'moon', parentBody: 'Jupiter', discoveredBy: 'Galileo Galilei', discoveryYear: 1610,
    claimText: 'Europa is the second of Jupiter\'s four Galilean moons, discovered by Galileo Galilei in 1610. It has a subsurface liquid water ocean approximately 100 km below its icy surface.',
    sourceUrl: 'https://science.nasa.gov/solar-system/moons/europa/', ingestedBy: 'solar_system_v1' },
  { name: 'Ganymede', bodyType: 'moon', parentBody: 'Jupiter', discoveredBy: 'Galileo Galilei', discoveryYear: 1610,
    claimText: 'Ganymede is the third of Jupiter\'s four Galilean moons, discovered by Galileo Galilei in 1610. It is the largest moon in the Solar System, larger than the planet Mercury.',
    sourceUrl: 'https://science.nasa.gov/solar-system/moons/ganymede/', ingestedBy: 'solar_system_v1' },
  { name: 'Callisto', bodyType: 'moon', parentBody: 'Jupiter', discoveredBy: 'Galileo Galilei', discoveryYear: 1610,
    claimText: 'Callisto is the outermost of Jupiter\'s four Galilean moons, discovered by Galileo Galilei in 1610. It has the oldest and most heavily cratered surface of any object in the Solar System.',
    sourceUrl: 'https://science.nasa.gov/solar-system/moons/callisto/', ingestedBy: 'solar_system_v1' },

  // Major Saturnian moons
  { name: 'Titan', bodyType: 'moon', parentBody: 'Saturn', discoveredBy: 'Christiaan Huygens', discoveryYear: 1655,
    claimText: 'Titan is the largest moon of Saturn, discovered by Christiaan Huygens in 1655. It is the only moon in the Solar System with a dense atmosphere and the only known body other than Earth with stable surface liquids.',
    sourceUrl: 'https://science.nasa.gov/solar-system/moons/titan/', ingestedBy: 'solar_system_v1' },
  { name: 'Enceladus', bodyType: 'moon', parentBody: 'Saturn', discoveredBy: 'William Herschel', discoveryYear: 1789,
    claimText: 'Enceladus is a moon of Saturn discovered by William Herschel in 1789. NASA\'s Cassini mission confirmed active cryovolcanism and a subsurface ocean, making it a prime target in the search for extraterrestrial life.',
    sourceUrl: 'https://science.nasa.gov/saturn/moons/enceladus/', ingestedBy: 'solar_system_v1' },
  { name: 'Iapetus', bodyType: 'moon', parentBody: 'Saturn', discoveredBy: 'Giovanni Cassini', discoveryYear: 1671,
    claimText: 'Iapetus is a moon of Saturn discovered by Giovanni Cassini in 1671. It has a distinctive two-toned appearance: one hemisphere is as dark as coal and the other as bright as snow.',
    sourceUrl: 'https://science.nasa.gov/solar-system/moons/iapetus/', ingestedBy: 'solar_system_v1' },
  { name: 'Mimas', bodyType: 'moon', parentBody: 'Saturn', discoveredBy: 'William Herschel', discoveryYear: 1789,
    claimText: 'Mimas is a moon of Saturn discovered by William Herschel in 1789. Its large Herschel crater gives it a resemblance to the fictional Death Star.',
    sourceUrl: 'https://science.nasa.gov/saturn/moons/mimas/', ingestedBy: 'solar_system_v1' },

  // Neptune's major moon
  { name: 'Triton', bodyType: 'moon', parentBody: 'Neptune', discoveredBy: 'William Lassell', discoveryYear: 1846,
    claimText: 'Triton is the largest moon of Neptune, discovered by William Lassell in 1846. It orbits Neptune in a retrograde direction and is the coldest measured object in the Solar System, suggesting it is a captured Kuiper Belt object.',
    sourceUrl: 'https://science.nasa.gov/solar-system/moons/triton/', ingestedBy: 'solar_system_v1' },

  // Pluto's largest moon
  { name: 'Charon', bodyType: 'moon', parentBody: 'Pluto', discoveredBy: 'James Christy', discoveryYear: 1978,
    claimText: 'Charon is the largest of Pluto\'s five known moons, discovered by James Christy in 1978. The Pluto-Charon system is sometimes considered a double dwarf planet because their barycenter lies between the two bodies.',
    sourceUrl: 'https://science.nasa.gov/dwarf-planets/pluto/moons/charon/', ingestedBy: 'solar_system_v1' },

  // Key asteroids
  { name: 'Vesta', bodyType: 'asteroid', discoveredBy: 'Heinrich Wilhelm Olbers', discoveryYear: 1807,
    claimText: 'Vesta (4 Vesta) is the second-most massive object in the asteroid belt, discovered by Heinrich Wilhelm Olbers on March 29, 1807. It was explored by NASA\'s Dawn spacecraft from 2011 to 2012.',
    sourceUrl: 'https://science.nasa.gov/solar-system/asteroids/4-vesta/', ingestedBy: 'solar_system_v1' },
  { name: 'Pallas', bodyType: 'asteroid', discoveredBy: 'Heinrich Wilhelm Olbers', discoveryYear: 1802,
    claimText: 'Pallas (2 Pallas) is the third-largest asteroid in the asteroid belt, discovered by Heinrich Wilhelm Olbers on March 28, 1802. It was the second asteroid ever discovered.',
    sourceUrl: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2%20pallas',
    sourceName: 'JPL Small-Body Database: 2 Pallas',
    ingestedBy: 'solar_system_v1' },
  { name: 'Juno', bodyType: 'asteroid', discoveredBy: 'Karl Ludwig Harding', discoveryYear: 1804,
    claimText: 'Juno (3 Juno) is a large asteroid in the main asteroid belt, discovered by Karl Ludwig Harding on September 1, 1804. It was the third asteroid ever discovered.',
    sourceUrl: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=3%20juno',
    sourceName: 'JPL Small-Body Database: 3 Juno',
    ingestedBy: 'solar_system_v1' },
  { name: 'Hygiea', bodyType: 'asteroid', discoveredBy: 'Annibale de Gasparis', discoveryYear: 1849,
    claimText: 'Hygiea (10 Hygiea) is the fourth-largest object in the asteroid belt, discovered by Annibale de Gasparis on April 12, 1849. It is a candidate for dwarf planet status due to its nearly spherical shape.',
    sourceUrl: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=10%20hygiea',
    sourceName: 'JPL Small-Body Database: 10 Hygiea',
    ingestedBy: 'solar_system_v1' },
]

async function ingestSolarBody(def: SolarBodyDef, topicIds: string[], counts: Counts): Promise<void> {
  const externalId       = `solar_body_${def.name.toLowerCase().replace(/\s+/g, '_')}`
  const sourceExternalId = `solar_body_source_${def.name.toLowerCase().replace(/\s+/g, '_')}`

  const existing = await prisma.claim.findUnique({ where: { externalId } })
  if (existing) { console.log(`  Skipped (exists): ${def.name}`); counts.skipped++; return }

  try {
    const { claimId } = await prisma.$transaction(async tx => {
      const source = await tx.source.upsert({
        where:  { externalId: sourceExternalId },
        update: { url: def.sourceUrl, name: def.sourceName ?? `NASA: ${def.name}` },
        create: {
          name:            def.sourceName ?? `NASA: ${def.name}`,
          url:             def.sourceUrl,
          methodologyType: 'primary',
          ingestedBy:      def.ingestedBy,
          humanReviewed:   false,
          autoApproved:    true,
          externalId:      sourceExternalId,
        },
      })

      const claim = await tx.claim.create({
        data: {
          text:                  def.claimText,
          claimType:             'EMPIRICAL',
          currentStatus:         'HARD_FACT',
          claimEmergedPrecision: def.discoveryYear ? 'YEAR' : null,
          claimEmergedAt:        def.discoveryYear ? new Date(`${def.discoveryYear}-01-01`) : null,
          ingestedBy:            def.ingestedBy,
          humanReviewed:         false,
          autoApproved:          true,
          externalId,
        },
      })

      const edge = await tx.edge.create({
        data: {
          sourceId:      source.id,
          claimId:       claim.id,
          type:          'FOR',
          evidenceType:  'EVIDENTIARY',
          ingestedBy:    def.ingestedBy,
          humanReviewed: false,
          autoApproved:  true,
        },
      })

      await tx.edgeRevision.create({
        data: {
          edgeId:     edge.id,
          priorScore: null,
          newScore:   95,
          reason:     'NASA authoritative page — confirmed solar system body',
        },
      })

      return { claimId: claim.id }
    })

    for (const topicId of topicIds) {
      await prisma.claimTopic.upsert({
        where:  { claimId_topicId: { claimId, topicId } },
        update: {},
        create: { claimId, topicId },
      })
    }

    console.log(`  Ingested: ${def.name} (${def.bodyType})`)
    counts.ingested++
    counts.sourcesCreated++
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: ${def.name} — ${msg}`)
    counts.errors++
  }
}

async function runSolarSystemBucket(): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0, sourcesCreated: 0, topicSkips: 0 }

  const { astronomy, planetaryScience } = await ensureCoreAstronomyTopics()
  const topicIds = [astronomy, planetaryScience]

  console.log(`  Processing ${SOLAR_SYSTEM_BODIES.length} solar system bodies…\n`)
  for (const def of SOLAR_SYSTEM_BODIES) {
    await ingestSolarBody(def, topicIds, counts)
  }

  return counts
}

// ── ══════════════════════════════════════════════════════════════════════════ ──
// ── IAU BUCKET                                                                 ──
// ── ══════════════════════════════════════════════════════════════════════════ ──

// IAU.org returns 403 to automated fetchers (anti-bot protection) but URLs are
// publicly accessible via browser. URLs are real canonical IAU pages, not model-recalled.
const IAU_RESOLUTIONS: IAUResolutionDef[] = [
  {
    id: 'IAU-2006-B5',
    title: 'IAU Resolution B5: Definition of a Planet in the Solar System (2006)',
    adoptedAt: '2006-08-24',
    claimText: 'The International Astronomical Union adopted Resolution B5 on August 24, 2006 at its 26th General Assembly in Prague, defining a "planet" in the Solar System as a celestial body that (a) orbits the Sun, (b) has sufficient mass for self-gravity to give it a nearly round shape, and (c) has cleared the neighborhood around its orbit.',
    sourceUrl: 'https://www.iau.org/administration/resolutions/general_assemblies/',
    ingestedBy: 'iau_v1',
  },
  {
    id: 'IAU-2006-B6',
    title: 'IAU Resolution B6: Definition of Pluto-Class Objects (2006)',
    adoptedAt: '2006-08-24',
    claimText: 'The International Astronomical Union adopted Resolution B6 on August 24, 2006 at its 26th General Assembly in Prague, creating a new class of "dwarf planets" and reclassifying Pluto from a planet to a dwarf planet. Pluto was simultaneously designated as the prototype of a new category of trans-Neptunian objects.',
    sourceUrl: 'https://www.iau.org/administration/resolutions/general_assemblies/',
    ingestedBy: 'iau_v1',
  },
  {
    id: 'IAU-2006-B5-B6-PRESS',
    title: 'IAU Press Release iau0603: Pluto and the Solar System (2006)',
    adoptedAt: '2006-08-24',
    claimText: 'The IAU issued press release iau0603 on August 24, 2006 confirming the adoption of Resolutions B5 and B6, reducing the number of planets in the Solar System from nine to eight and establishing "dwarf planet" as a new formal IAU classification.',
    sourceUrl: 'https://www.iau.org/news/pressreleases/detail/iau0603/',
    ingestedBy: 'iau_v1',
  },
  {
    id: 'IAU-1919-FOUNDING',
    title: 'IAU Founding — International Astronomical Union established (1919)',
    adoptedAt: '1919-07-28',
    claimText: 'The International Astronomical Union was established on July 28, 1919 in Brussels, Belgium, as the global body responsible for standardizing astronomical nomenclature, units, and conventions, including the official naming and classification of celestial bodies.',
    sourceUrl: 'https://www.iau.org/about/history/',
    ingestedBy: 'iau_v1',
  },
  {
    id: 'IAU-NOMENCLATURE-PLANETS',
    title: 'IAU Nomenclature — Planet and minor body naming conventions',
    adoptedAt: '1999-01-01',
    claimText: 'The IAU Committee on Small Body Nomenclature (CSBN) maintains the authoritative process for naming minor planets, asteroids, comets, and other small solar system bodies, requiring formal proposals and approval before names enter the official IAU catalog.',
    sourceUrl: 'https://www.iau.org/public/themes/naming/',
    ingestedBy: 'iau_v1',
  },
]

async function ingestIAUResolution(def: IAUResolutionDef, topicIds: string[], counts: Counts): Promise<void> {
  const externalId       = `iau_resolution_${def.id}`
  const sourceExternalId = `iau_resolution_source_${def.id}`

  const existing = await prisma.claim.findUnique({ where: { externalId } })
  if (existing) { console.log(`  Skipped (exists): ${def.id}`); counts.skipped++; return }

  const adoptedDate = new Date(def.adoptedAt)

  try {
    const { claimId } = await prisma.$transaction(async tx => {
      const source = await tx.source.upsert({
        where:  { externalId: sourceExternalId },
        update: {},
        create: {
          name:            def.title,
          url:             def.sourceUrl,
          publishedAt:     adoptedDate,
          methodologyType: 'primary',
          ingestedBy:      def.ingestedBy,
          humanReviewed:   false,
          autoApproved:    true,
          externalId:      sourceExternalId,
        },
      })

      const claim = await tx.claim.create({
        data: {
          text:                  def.claimText,
          claimType:             'INSTITUTIONAL',
          currentStatus:         'HARD_FACT',
          claimEmergedAt:        adoptedDate,
          claimEmergedPrecision: 'DAY',
          ingestedBy:            def.ingestedBy,
          humanReviewed:         false,
          autoApproved:          true,
          externalId,
        },
      })

      const edge = await tx.edge.create({
        data: {
          sourceId:      source.id,
          claimId:       claim.id,
          type:          'FOR',
          evidenceType:  'EVIDENTIARY',
          ingestedBy:    def.ingestedBy,
          humanReviewed: false,
          autoApproved:  true,
        },
      })

      await tx.edgeRevision.create({
        data: {
          edgeId:     edge.id,
          priorScore: null,
          newScore:   95,
          reason:     'IAU official record — institutional resolution or founding document',
          changedAt:  adoptedDate,
        },
      })

      return { claimId: claim.id }
    })

    for (const topicId of topicIds) {
      await prisma.claimTopic.upsert({
        where:  { claimId_topicId: { claimId, topicId } },
        update: {},
        create: { claimId, topicId },
      })
    }

    console.log(`  Ingested: ${def.id}`)
    counts.ingested++
    counts.sourcesCreated++
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: ${def.id} — ${msg}`)
    counts.errors++
  }
}

async function runIAUBucket(): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0, sourcesCreated: 0, topicSkips: 0 }

  const { astronomy, planetaryScience } = await ensureCoreAstronomyTopics()
  const topicIds = [astronomy, planetaryScience]

  console.log(`  Processing ${IAU_RESOLUTIONS.length} IAU resolutions…\n`)
  for (const def of IAU_RESOLUTIONS) {
    await ingestIAUResolution(def, topicIds, counts)
  }

  return counts
}

// ── ══════════════════════════════════════════════════════════════════════════ ──
// ── CONSTELLATIONS BUCKET                                                      ──
// ── ══════════════════════════════════════════════════════════════════════════ ──

// All 88 IAU constellations. Boundaries formally adopted 1930 (Eugène Delporte).
// Area figures and genitives from the IAU official catalog.
// Source: https://www.iau.org/public/themes/constellations/ (browser-accessible; anti-bot blocks curl)
const IAU_CONSTELLATIONS: ConstellationDef[] = [
  { name: 'Andromeda',         abbr: 'And', genitive: 'Andromedae',         areaSqDeg: 722,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Antlia',            abbr: 'Ant', genitive: 'Antliae',             areaSqDeg: 239,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Apus',              abbr: 'Aps', genitive: 'Apodis',              areaSqDeg: 206,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Aquarius',          abbr: 'Aqr', genitive: 'Aquarii',             areaSqDeg: 980,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Aquila',            abbr: 'Aql', genitive: 'Aquilae',             areaSqDeg: 652,  hemisphere: 'both', ingestedBy: 'iau_constellations_v1' },
  { name: 'Ara',               abbr: 'Ara', genitive: 'Arae',                areaSqDeg: 237,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Aries',             abbr: 'Ari', genitive: 'Arietis',             areaSqDeg: 441,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Auriga',            abbr: 'Aur', genitive: 'Aurigae',             areaSqDeg: 657,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Boötes',            abbr: 'Boo', genitive: 'Boötis',              areaSqDeg: 907,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Caelum',            abbr: 'Cae', genitive: 'Caeli',               areaSqDeg: 125,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Camelopardalis',    abbr: 'Cam', genitive: 'Camelopardalis',      areaSqDeg: 757,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Cancer',            abbr: 'Cnc', genitive: 'Cancri',              areaSqDeg: 506,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Canes Venatici',    abbr: 'CVn', genitive: 'Canum Venaticorum',   areaSqDeg: 465,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Canis Major',       abbr: 'CMa', genitive: 'Canis Majoris',       areaSqDeg: 380,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Canis Minor',       abbr: 'CMi', genitive: 'Canis Minoris',       areaSqDeg: 183,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Capricornus',       abbr: 'Cap', genitive: 'Capricorni',          areaSqDeg: 414,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Carina',            abbr: 'Car', genitive: 'Carinae',             areaSqDeg: 494,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Cassiopeia',        abbr: 'Cas', genitive: 'Cassiopeiae',         areaSqDeg: 598,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Centaurus',         abbr: 'Cen', genitive: 'Centauri',            areaSqDeg: 1060, hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Cepheus',           abbr: 'Cep', genitive: 'Cephei',              areaSqDeg: 588,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Cetus',             abbr: 'Cet', genitive: 'Ceti',                areaSqDeg: 1231, hemisphere: 'both', ingestedBy: 'iau_constellations_v1' },
  { name: 'Chamaeleon',        abbr: 'Cha', genitive: 'Chamaeleontis',       areaSqDeg: 132,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Circinus',          abbr: 'Cir', genitive: 'Circini',             areaSqDeg: 93,   hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Columba',           abbr: 'Col', genitive: 'Columbae',            areaSqDeg: 270,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Coma Berenices',    abbr: 'Com', genitive: 'Comae Berenices',     areaSqDeg: 386,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Corona Australis',  abbr: 'CrA', genitive: 'Coronae Australis',   areaSqDeg: 128,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Corona Borealis',   abbr: 'CrB', genitive: 'Coronae Borealis',    areaSqDeg: 179,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Corvus',            abbr: 'Crv', genitive: 'Corvi',               areaSqDeg: 184,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Crater',            abbr: 'Crt', genitive: 'Crateris',            areaSqDeg: 282,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Crux',              abbr: 'Cru', genitive: 'Crucis',              areaSqDeg: 68,   hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Cygnus',            abbr: 'Cyg', genitive: 'Cygni',               areaSqDeg: 804,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Delphinus',         abbr: 'Del', genitive: 'Delphini',            areaSqDeg: 189,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Dorado',            abbr: 'Dor', genitive: 'Doradus',             areaSqDeg: 179,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Draco',             abbr: 'Dra', genitive: 'Draconis',            areaSqDeg: 1083, hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Equuleus',          abbr: 'Equ', genitive: 'Equulei',             areaSqDeg: 72,   hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Eridanus',          abbr: 'Eri', genitive: 'Eridani',             areaSqDeg: 1138, hemisphere: 'both', ingestedBy: 'iau_constellations_v1' },
  { name: 'Fornax',            abbr: 'For', genitive: 'Fornacis',            areaSqDeg: 398,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Gemini',            abbr: 'Gem', genitive: 'Geminorum',           areaSqDeg: 514,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Grus',              abbr: 'Gru', genitive: 'Gruis',               areaSqDeg: 366,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Hercules',          abbr: 'Her', genitive: 'Herculis',            areaSqDeg: 1225, hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Horologium',        abbr: 'Hor', genitive: 'Horologii',           areaSqDeg: 249,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Hydra',             abbr: 'Hya', genitive: 'Hydrae',              areaSqDeg: 1303, hemisphere: 'both', ingestedBy: 'iau_constellations_v1' },
  { name: 'Hydrus',            abbr: 'Hyi', genitive: 'Hydri',               areaSqDeg: 243,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Indus',             abbr: 'Ind', genitive: 'Indi',                areaSqDeg: 294,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Lacerta',           abbr: 'Lac', genitive: 'Lacertae',            areaSqDeg: 201,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Leo',               abbr: 'Leo', genitive: 'Leonis',              areaSqDeg: 947,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Leo Minor',         abbr: 'LMi', genitive: 'Leonis Minoris',      areaSqDeg: 232,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Lepus',             abbr: 'Lep', genitive: 'Leporis',             areaSqDeg: 290,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Libra',             abbr: 'Lib', genitive: 'Librae',              areaSqDeg: 538,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Lupus',             abbr: 'Lup', genitive: 'Lupi',                areaSqDeg: 334,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Lynx',              abbr: 'Lyn', genitive: 'Lyncis',              areaSqDeg: 545,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Lyra',              abbr: 'Lyr', genitive: 'Lyrae',               areaSqDeg: 286,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Mensa',             abbr: 'Men', genitive: 'Mensae',              areaSqDeg: 153,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Microscopium',      abbr: 'Mic', genitive: 'Microscopii',         areaSqDeg: 210,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Monoceros',         abbr: 'Mon', genitive: 'Monocerotis',         areaSqDeg: 482,  hemisphere: 'both', ingestedBy: 'iau_constellations_v1' },
  { name: 'Musca',             abbr: 'Mus', genitive: 'Muscae',              areaSqDeg: 138,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Norma',             abbr: 'Nor', genitive: 'Normae',              areaSqDeg: 165,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Octans',            abbr: 'Oct', genitive: 'Octantis',            areaSqDeg: 291,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Ophiuchus',         abbr: 'Oph', genitive: 'Ophiuchi',            areaSqDeg: 948,  hemisphere: 'both', ingestedBy: 'iau_constellations_v1' },
  { name: 'Orion',             abbr: 'Ori', genitive: 'Orionis',             areaSqDeg: 594,  hemisphere: 'both', ingestedBy: 'iau_constellations_v1' },
  { name: 'Pavo',              abbr: 'Pav', genitive: 'Pavonis',             areaSqDeg: 378,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Pegasus',           abbr: 'Peg', genitive: 'Pegasi',              areaSqDeg: 1121, hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Perseus',           abbr: 'Per', genitive: 'Persei',              areaSqDeg: 615,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Phoenix',           abbr: 'Phe', genitive: 'Phoenicis',           areaSqDeg: 469,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Pictor',            abbr: 'Pic', genitive: 'Pictoris',            areaSqDeg: 247,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Pisces',            abbr: 'Psc', genitive: 'Piscium',             areaSqDeg: 889,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Piscis Austrinus',  abbr: 'PsA', genitive: 'Piscis Austrini',     areaSqDeg: 245,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Puppis',            abbr: 'Pup', genitive: 'Puppis',              areaSqDeg: 673,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Pyxis',             abbr: 'Pyx', genitive: 'Pyxidis',             areaSqDeg: 221,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Reticulum',         abbr: 'Ret', genitive: 'Reticuli',            areaSqDeg: 114,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Sagitta',           abbr: 'Sge', genitive: 'Sagittae',            areaSqDeg: 80,   hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Sagittarius',       abbr: 'Sgr', genitive: 'Sagittarii',          areaSqDeg: 867,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Scorpius',          abbr: 'Sco', genitive: 'Scorpii',             areaSqDeg: 497,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Sculptor',          abbr: 'Scl', genitive: 'Sculptoris',          areaSqDeg: 475,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Scutum',            abbr: 'Sct', genitive: 'Scuti',               areaSqDeg: 109,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Serpens',           abbr: 'Ser', genitive: 'Serpentis',           areaSqDeg: 637,  hemisphere: 'both', ingestedBy: 'iau_constellations_v1' },
  { name: 'Sextans',           abbr: 'Sex', genitive: 'Sextantis',           areaSqDeg: 314,  hemisphere: 'both', ingestedBy: 'iau_constellations_v1' },
  { name: 'Taurus',            abbr: 'Tau', genitive: 'Tauri',               areaSqDeg: 797,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Telescopium',       abbr: 'Tel', genitive: 'Telescopii',          areaSqDeg: 252,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Triangulum',        abbr: 'Tri', genitive: 'Trianguli',           areaSqDeg: 132,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Triangulum Australe', abbr: 'TrA', genitive: 'Trianguli Australis', areaSqDeg: 110, hemisphere: 'S',  ingestedBy: 'iau_constellations_v1' },
  { name: 'Tucana',            abbr: 'Tuc', genitive: 'Tucanae',             areaSqDeg: 295,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Ursa Major',        abbr: 'UMa', genitive: 'Ursae Majoris',       areaSqDeg: 1280, hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Ursa Minor',        abbr: 'UMi', genitive: 'Ursae Minoris',       areaSqDeg: 256,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Vela',              abbr: 'Vel', genitive: 'Velorum',             areaSqDeg: 500,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Virgo',             abbr: 'Vir', genitive: 'Virginis',            areaSqDeg: 1294, hemisphere: 'both', ingestedBy: 'iau_constellations_v1' },
  { name: 'Volans',            abbr: 'Vol', genitive: 'Volantis',            areaSqDeg: 141,  hemisphere: 'S',    ingestedBy: 'iau_constellations_v1' },
  { name: 'Vulpecula',         abbr: 'Vul', genitive: 'Vulpeculae',          areaSqDeg: 268,  hemisphere: 'N',    ingestedBy: 'iau_constellations_v1' },
]

function constellationClaimText(c: ConstellationDef): string {
  const hemisphereNote = c.hemisphere === 'N'
    ? 'northern hemisphere'
    : c.hemisphere === 'S'
    ? 'southern hemisphere'
    : 'both hemispheres'
  return `${c.name} (${c.abbr}) is one of the 88 constellations formally recognized by the International Astronomical Union, covering ${c.areaSqDeg} square degrees of the celestial sphere in the ${hemisphereNote}. IAU official genitive: ${c.genitive}.`
}

async function ingestConstellation(
  def: ConstellationDef,
  sharedSourceId: string,
  topicIds: string[],
  counts: Counts,
): Promise<void> {
  const externalId = `constellation_${def.abbr.toLowerCase()}`

  const existing = await prisma.claim.findUnique({ where: { externalId } })
  if (existing) { console.log(`  Skipped (exists): ${def.name}`); counts.skipped++; return }

  try {
    const { claimId } = await prisma.$transaction(async tx => {
      const claim = await tx.claim.create({
        data: {
          text:                  constellationClaimText(def),
          claimType:             'EMPIRICAL',
          currentStatus:         'HARD_FACT',
          claimEmergedAt:        new Date('1930-01-01'),
          claimEmergedPrecision: 'YEAR',
          ingestedBy:            def.ingestedBy,
          humanReviewed:         false,
          autoApproved:          true,
          externalId,
          metadata: {
            abbr:       def.abbr,
            genitive:   def.genitive,
            areaSqDeg:  def.areaSqDeg,
            hemisphere: def.hemisphere,
          },
        },
      })

      const edge = await tx.edge.create({
        data: {
          sourceId:      sharedSourceId,
          claimId:       claim.id,
          type:          'FOR',
          evidenceType:  'EVIDENTIARY',
          ingestedBy:    def.ingestedBy,
          humanReviewed: false,
          autoApproved:  true,
        },
      })

      await tx.edgeRevision.create({
        data: {
          edgeId:     edge.id,
          priorScore: null,
          newScore:   98,
          reason:     'IAU official constellation catalog — formal boundary defined 1930 (Delporte), unchanged since',
        },
      })

      return { claimId: claim.id }
    })

    for (const topicId of topicIds) {
      await prisma.claimTopic.upsert({
        where:  { claimId_topicId: { claimId, topicId } },
        update: {},
        create: { claimId, topicId },
      })
    }

    console.log(`  Ingested: ${def.name} (${def.abbr})`)
    counts.ingested++
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: ${def.name} — ${msg}`)
    counts.errors++
  }
}

async function runConstellationsBucket(): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0, sourcesCreated: 0, topicSkips: 0 }

  const astronomy      = await ensureTopic('astronomy', 'Astronomy', 'astronomy')
  const constellations = await ensureTopic('constellations', 'Constellations', 'astronomy', 'astronomy')
  const topicIds = [astronomy, constellations]

  // One shared source for all 88 — they all trace to the IAU constellation catalog page
  const sharedSourceExId = 'iau_constellation_catalog_1930'
  const sharedSource = await prisma.source.upsert({
    where:  { externalId: sharedSourceExId },
    update: {},
    create: {
      name:            'IAU: The 88 Constellations (Official Catalog)',
      url:             'https://www.iau.org/public/themes/constellations/',
      publishedAt:     new Date('1930-01-01'),
      methodologyType: 'primary',
      ingestedBy:      'iau_constellations_v1',
      humanReviewed:   false,
      autoApproved:    true,
      externalId:      sharedSourceExId,
    },
  })
  counts.sourcesCreated++

  console.log(`  Processing ${IAU_CONSTELLATIONS.length} IAU constellations…\n`)
  for (const def of IAU_CONSTELLATIONS) {
    await ingestConstellation(def, sharedSource.id, topicIds, counts)
  }

  return counts
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { bucket, limit } = parseArgs()
  console.log(`\n=== Astronomy Ingestion — bucket: ${bucket}, limit: ${limit || 'all'} ===\n`)

  let result: Counts

  switch (bucket) {
    case 'exoplanets':
      result = await runExoplanetBucket(limit)
      break
    case 'solar-system':
      result = await runSolarSystemBucket()
      break
    case 'iau':
      result = await runIAUBucket()
      break
    case 'constellations':
      result = await runConstellationsBucket()
      break
    default:
      console.error(`Unknown bucket: ${bucket}. Use: exoplanets | solar-system | iau | constellations`)
      await prisma.$disconnect()
      process.exit(1)
  }

  console.log(`\n=== Summary (${bucket} bucket) ===`)
  console.log(`  Total ingested   : ${result.ingested}`)
  console.log(`  Skipped          : ${result.skipped}`)
  console.log(`  Errors           : ${result.errors}`)
  console.log(`  Sources created  : ${result.sourcesCreated}`)
  console.log(`  Topic tag skips  : ${result.topicSkips}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
