// Seed: Astronomy & Physics epistemic trajectories
//
// Domain-specific settling curves: each trajectory is a dateable astronomy
// or physics claim with a verifiable epistemic arc — from initial expert
// literature finding through institutional adoption, Nobel recognition,
// IAU rulings, or paradigm-shifting observational confirmation.
//
// Sources: ADS (NASA Astrophysics Data System), arXiv, IAU resolutions,
// Physical Review Letters, Nature, Science, Astrophysical Journal,
// Nobel Prize archives, Philosophical Transactions.
//
// Idempotent: upserts on externalId.
//
// Run:     npx tsx scripts/seed-astronomy-trajectories.ts
// Dry-run: npx tsx scripts/seed-astronomy-trajectories.ts --dry-run

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
  // TELESCOPE & CLASSICAL ERA (1610–1900)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 1. Galileo observes Jupiter's four moons — 1610 ────────────────────────
  {
    externalId: 'trajectory:galileo-jupiter-moons-1610',
    text: 'Galileo Galilei observed on January 7, 1610 that Jupiter was accompanied by four small "stars" that changed position nightly, demonstrating that celestial bodies orbit a center other than Earth and providing direct observational support for the Copernican heliocentric model.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1610-01-07',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1610-03-12',
        datePrecision: 'DAY',
        reason: 'Galileo publishes Sidereus Nuncius (Starry Messenger) on March 12, 1610, reporting his observations of four moons orbiting Jupiter (Io, Europa, Ganymede, Callisto — later named Galilean moons). His nightly tracking of their positions across January 7–15, 1610 demonstrated they were satellites of Jupiter, not fixed stars. This directly challenged the Aristotelian/Ptolemaic model that all heavenly bodies orbit Earth.',
        source: {
          externalId: 'src:galileo-sidereus-nuncius-1610',
          name: 'Galilei G. Sidereus Nuncius. Venice: Thomas Baglioni. March 12, 1610.',
          url: 'https://archive.org/details/GalileoSidereusNuncius',
          publishedAt: '1610-03-12',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1801-01-01',
        datePrecision: 'YEAR',
        reason: 'By 1801, Laplace\'s Mécanique Céleste provides precise orbital mechanics for the Galilean moons, confirming Kepler\'s laws apply to the Jovian system. The moons are fully integrated into Newtonian mechanics, cementing the claim that Jupiter\'s satellites are gravitationally bound to Jupiter — not Earth — as settled astronomical fact.',
        source: {
          externalId: 'src:laplace-mecanique-celeste-1801',
          name: 'Laplace PS. Traité de Mécanique Céleste. Vol. 4. Paris: Courcier. 1801.',
          url: 'https://archive.org/details/traitdemcanique04laplgoog',
          publishedAt: '1801-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 2. Ole Rømer measures speed of light — 1676 ─────────────────────────────
  {
    externalId: 'trajectory:romer-speed-of-light-1676',
    text: 'Ole Rømer demonstrated in November 1676 that light travels at a finite speed by measuring delays in the observed eclipses of Jupiter\'s moon Io that depended on Earth\'s distance from Jupiter, providing the first quantitative measurement of the speed of light.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1676-11-22',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1676-12-07',
        datePrecision: 'DAY',
        reason: 'Rømer presents his findings to the Académie des Sciences in Paris on November 22, 1676, predicting that the November 9 eclipse of Io would be 10 minutes late due to Earth\'s distance from Jupiter. He publishes "Démonstration touchant le mouvement de la lumière trouvé par M. Römer" in the Journal des sçavans on December 7, 1676. He estimates light crosses Earth\'s orbital diameter (2 AU) in 22 minutes, implying a speed of roughly 2×10⁸ m/s — about 25% low but the correct order of magnitude.',
        source: {
          externalId: 'src:romer-light-speed-1676',
          name: 'Römer O. Démonstration touchant le mouvement de la lumière trouvé par M. Römer de l\'Académie Royale des Sciences. Journal des sçavans. December 7, 1676.',
          url: 'https://doi.org/10.3406/jds.1676.1022',
          publishedAt: '1676-12-07',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1729-01-01',
        datePrecision: 'YEAR',
        reason: 'James Bradley\'s 1728–1729 discovery of stellar aberration (the apparent displacement of stars due to Earth\'s orbital velocity) independently confirms the finite speed of light and yields a value of ~295,000 km/s, close to the modern value. Bradley\'s independent confirmation settles the finite speed of light as established physics, and his calculation of c ≈ 10,210 Earth diameters per second improves on Rømer\'s estimate.',
        source: {
          externalId: 'src:bradley-aberration-1729',
          name: 'Bradley J. A Letter from the Reverend Mr. James Bradley to Dr. Edmond Halley; Giving an Account of a New Discovered Motion of the Fix\'d Stars. Philosophical Transactions. 1729;35:637–661.',
          url: 'https://doi.org/10.1098/rstl.1727.0064',
          publishedAt: '1729-01-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 3. William Herschel discovers Uranus — 1781 ─────────────────────────────
  {
    externalId: 'trajectory:herschel-uranus-discovery-1781',
    text: 'William Herschel discovered Uranus on March 13, 1781, the first planet found with a telescope in recorded history, expanding the known solar system beyond the classical five planets for the first time since antiquity.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1781-03-13',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1781-12-01',
        datePrecision: 'MONTH',
        reason: 'Herschel initially reports to the Royal Society on April 26, 1781 that he has found a "curious either nebulous star or perhaps a comet." Multiple astronomers — including Nevil Maskelyne and Johann Elert Bode — confirm it moves too slowly for a comet and has a disc-like appearance consistent with a planet. Herschel publishes "Account of a Comet" in the Philosophical Transactions of the Royal Society (1781). By December 1781 the Royal Society accepts it as a new planet.',
        source: {
          externalId: 'src:herschel-uranus-phil-trans-1781',
          name: 'Herschel W. Account of a Comet. Philosophical Transactions of the Royal Society. 1781;71:492–501.',
          url: 'https://doi.org/10.1098/rstl.1781.0056',
          publishedAt: '1781-12-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1782-01-01',
        datePrecision: 'YEAR',
        reason: 'The Royal Society awards Herschel the Copley Medal in 1781 and King George III appoints him Royal Astronomer in 1782. The name "Uranus" (proposed by Bode) is adopted internationally by the mid-19th century. The discovery is formally settled as a planetary find, extending the solar system for the first time with telescopic technology.',
        source: {
          externalId: 'src:herschel-royal-astronomer-1782',
          name: 'Royal Society of London. Copley Medal Award to William Herschel. 1781. Historical record.',
          url: 'https://royalsociety.org/grants-schemes-awards/awards/copley-medal/',
          publishedAt: '1782-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 4. Neptune discovered — 1846 ────────────────────────────────────────────
  {
    externalId: 'trajectory:neptune-discovery-1846',
    text: 'Neptune was discovered on September 23, 1846 by Johann Galle and Heinrich d\'Arrest at the Berlin Observatory, at the position predicted by Urbain Le Verrier from mathematical analysis of Uranus\'s orbital perturbations, making it the first planet discovered by mathematical prediction.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1846-09-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1846-09-23',
        datePrecision: 'DAY',
        reason: 'On the night of September 23–24, 1846, Johann Galle and Heinrich d\'Arrest locate Neptune within 1° of Le Verrier\'s predicted position, the first observation. Le Verrier had submitted his prediction to Galle on September 18; John Couch Adams had independently predicted Neptune\'s position earlier but Cambridge Observatory delayed action. Galle reports the find to Le Verrier and the Paris Academy of Sciences on September 25, 1846.',
        source: {
          externalId: 'src:galle-neptune-observation-1846',
          name: 'Galle JG. Letter to Le Verrier reporting discovery of Neptune. Astronomische Nachrichten. 1846;25(585):column 349–354.',
          url: 'https://ui.adsabs.harvard.edu/abs/1846AN.....25..349G',
          publishedAt: '1846-09-23',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1847-01-01',
        datePrecision: 'YEAR',
        reason: 'The Royal Astronomical Society awards its Gold Medal jointly to Le Verrier and Adams in 1846 (after initially awarding it only to Adams, then reconsidering). By 1847 international consensus accepts Neptune as the eighth planet. The discovery is paradigm-defining: Newtonian mechanics predicted an unseen world from gravitational perturbations alone, establishing celestial mechanics as predictive science.',
        source: {
          externalId: 'src:ras-neptune-gold-medal-1846',
          name: 'Royal Astronomical Society. Award of Gold Medal. Monthly Notices of the Royal Astronomical Society. 1847;7:121–144.',
          url: 'https://doi.org/10.1093/mnras/7.9.121',
          publishedAt: '1847-01-01',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // MODERN ASTROPHYSICS (1900–1970)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 5. Hubble proves Andromeda is a separate galaxy — 1924 ─────────────────
  {
    externalId: 'trajectory:hubble-andromeda-galaxy-1924',
    text: 'Edwin Hubble demonstrated in late 1924 that the Andromeda Nebula (M31) is a separate galaxy far beyond the Milky Way by identifying Cepheid variable stars within it and computing a distance of approximately 900,000 light-years, resolving the "Great Debate" between island universe and single-galaxy models.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1924-11-23',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1925-01-01',
        datePrecision: 'MONTH',
        reason: 'Hubble announces his Cepheid distance measurements to the American Astronomical Society meeting in January 1925 (the paper submitted November 23, 1924). He identified 12 Cepheid variables in M31 from plates taken with the 100-inch Hooker telescope at Mount Wilson, deriving a distance of ~900,000 light-years (now known to be ~2.5 million light-years, but correct in establishing extragalactic scale). The paper, published in The Astrophysical Journal in 1925, settles the Curtis-Shapley "Great Debate" of 1920 in favor of island universes.',
        source: {
          externalId: 'src:hubble-andromeda-apj-1925',
          name: 'Hubble EP. Cepheids in spiral nebulae. The Observatory. 1925;48:139–142. (Full paper: Popular Astronomy. 1925;33:252–255.)',
          url: 'https://ui.adsabs.harvard.edu/abs/1925PA.....33..252H',
          publishedAt: '1925-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1929-03-15',
        datePrecision: 'MONTH',
        reason: 'Hubble publishes "A Relation between Distance and Radial Velocity among Extra-Galactic Nebulae" in the Proceedings of the National Academy of Sciences (March 15, 1929), demonstrating that galaxies recede at velocities proportional to their distance — Hubble\'s Law. The extragalactic nature of nebulae is now foundational to the model of an expanding universe. The 1924 Andromeda finding is settled as the key empirical step enabling modern cosmology.',
        source: {
          externalId: 'src:hubble-law-pnas-1929',
          name: 'Hubble EP. A relation between distance and radial velocity among extra-galactic nebulae. Proceedings of the National Academy of Sciences. 1929;15(3):168–173.',
          url: 'https://doi.org/10.1073/pnas.15.3.168',
          publishedAt: '1929-03-15',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 6. Penzias & Wilson discover CMB — 1964 ─────────────────────────────────
  {
    externalId: 'trajectory:penzias-wilson-cmb-discovery-1964',
    text: 'Arno Penzias and Robert Wilson detected an isotropic microwave background radiation at 7.35 cm wavelength on May 20, 1964 at Bell Labs, which Dicke, Peebles, Roll, and Wilkinson identified as the cosmic microwave background (CMB) — the thermal afterglow of the Big Bang — providing the decisive empirical confirmation of the Hot Big Bang model.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1964-05-20',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1965-07-01',
        datePrecision: 'MONTH',
        reason: 'Penzias and Wilson publish "A Measurement of Excess Antenna Temperature at 4080 Mc/s" in The Astrophysical Journal (July 1965), reporting an excess antenna temperature of 3.5 K ± 1 K that appears uniform across the sky and cannot be explained by known sources. Simultaneously, Dicke, Peebles, Roll and Wilkinson publish a companion paper interpreting it as the CMB relic from the Big Bang. The discovery kills the Steady State cosmology and confirms the Hot Big Bang.',
        source: {
          externalId: 'src:penzias-wilson-cmb-apj-1965',
          name: 'Penzias AA, Wilson RW. A Measurement of Excess Antenna Temperature at 4080 Mc/s. The Astrophysical Journal. 1965;142:419–421.',
          url: 'https://doi.org/10.1086/148307',
          publishedAt: '1965-07-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1978-10-17',
        datePrecision: 'DAY',
        reason: 'Penzias and Wilson are awarded the Nobel Prize in Physics on October 17, 1978 "for their discovery of cosmic microwave background radiation." The Nobel citation explicitly confirms the CMB as evidence for the Big Bang origin of the universe. The award institutionally settles the CMB as the observational foundation of modern Big Bang cosmology.',
        source: {
          externalId: 'src:nobel-cmb-1978',
          name: 'Nobel Prize Committee. Nobel Prize in Physics 1978. The Royal Swedish Academy of Sciences. October 17, 1978.',
          url: 'https://www.nobelprize.org/prizes/physics/1978/summary/',
          publishedAt: '1978-10-17',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SPACE AGE & HIGH-ENERGY (1970–present)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 7. Pluto reclassified as dwarf planet — 2006 ────────────────────────────
  {
    externalId: 'trajectory:pluto-reclassified-dwarf-planet-2006',
    text: 'The International Astronomical Union voted on August 24, 2006 to reclassify Pluto as a "dwarf planet" under a new three-criteria definition of "planet," reducing the solar system from nine to eight classical planets — the most consequential taxonomic revision in planetary science history.',
    claimType: 'INSTITUTIONAL',
    claimEmergedAt: '2006-08-24',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'CONTESTED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'INSTITUTIONAL',
        occurredAt: '2006-08-24',
        datePrecision: 'DAY',
        reason: 'At the IAU General Assembly in Prague, 424 of ~10,000 IAU members vote to adopt Resolution B5, defining a planet as a body that (a) orbits the Sun, (b) has sufficient mass for hydrostatic equilibrium (roughly spherical shape), and (c) has "cleared the neighbourhood" of its orbit. Pluto fails criterion (c) due to its shared Kuiper Belt environment. The resolution passes 424-84 with 20 abstentions and reclassifies Pluto as the prototype "dwarf planet."',
        source: {
          externalId: 'src:iau-pluto-resolution-2006',
          name: 'International Astronomical Union. IAU 2006 General Assembly: Result of the IAU Resolution votes. Resolution B5: Definition of a Planet in the Solar System. Prague, August 24, 2006.',
          url: 'https://www.iau.org/news/pressreleases/detail/iau0603/',
          publishedAt: '2006-08-24',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2017-09-07',
        datePrecision: 'DAY',
        reason: 'Runyon et al. publish "A Geophysical Planet Definition" in Lunar and Planetary Science Conference (2017) proposing a geophysical rather than orbital definition, under which Pluto would again be a planet. The "clearing the neighbourhood" criterion remains disputed among planetary scientists. A 2019 survey found a majority of planetary scientists opposed the IAU definition. The classification is institutionally settled but remains epistemically contested in the expert literature.',
        source: {
          externalId: 'src:runyon-planet-definition-2017',
          name: 'Runyon KD, et al. A Geophysical Planet Definition. Lunar and Planetary Science Conference 2017. Abstract 1448.',
          url: 'https://www.hou.usra.edu/meetings/lpsc2017/pdf/1448.pdf',
          publishedAt: '2017-09-07',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 8. LIGO detects gravitational waves — 2015 ──────────────────────────────
  {
    externalId: 'trajectory:ligo-gravitational-waves-2015',
    text: 'LIGO detected gravitational waves from the merger of two black holes (GW150914) on September 14, 2015, announced February 11, 2016, providing the first direct observation of gravitational waves and the first direct evidence of binary black hole systems, confirming a 100-year-old prediction of general relativity.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2015-09-14',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2016-02-11',
        datePrecision: 'DAY',
        reason: 'The LIGO Scientific Collaboration and Virgo Collaboration publish "Observation of Gravitational Waves from a Binary Black Hole Merger" in Physical Review Letters on February 11, 2016. The signal GW150914, detected at both Livingston and Hanford detectors on September 14, 2015, shows a characteristic chirp waveform matching two merging black holes of ~29 and ~36 solar masses at ~410 Mpc distance. The paper has over 1000 authors and a 5σ confidence level.',
        source: {
          externalId: 'src:ligo-gw150914-prl-2016',
          name: 'Abbott BP et al. (LIGO Scientific Collaboration and Virgo Collaboration). Observation of Gravitational Waves from a Binary Black Hole Merger. Physical Review Letters. 2016;116(6):061102.',
          url: 'https://doi.org/10.1103/PhysRevLett.116.061102',
          publishedAt: '2016-02-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2017-10-03',
        datePrecision: 'DAY',
        reason: 'Rainer Weiss, Barry Barish, and Kip Thorne are awarded the Nobel Prize in Physics on October 3, 2017 "for decisive contributions to the LIGO detector and the observation of gravitational waves." By this point LIGO and Virgo have detected multiple gravitational wave events (GW150914, GW151226, GW170814, GW170817). The Nobel award cements gravitational wave astronomy as a new observational window on the universe.',
        source: {
          externalId: 'src:nobel-gravitational-waves-2017',
          name: 'Nobel Prize Committee. Nobel Prize in Physics 2017. The Royal Swedish Academy of Sciences. October 3, 2017.',
          url: 'https://www.nobelprize.org/prizes/physics/2017/summary/',
          publishedAt: '2017-10-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 9. Event Horizon Telescope — first black hole image — 2019 ─────────────
  {
    externalId: 'trajectory:eht-black-hole-image-2019',
    text: 'The Event Horizon Telescope collaboration released on April 10, 2019 the first direct image of a black hole\'s shadow — the supermassive black hole M87* at the center of the Messier 87 galaxy — providing the first visual confirmation of a black hole event horizon and testing general relativity in the strong-field regime.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2019-04-10',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2019-04-10',
        datePrecision: 'DAY',
        reason: 'The Event Horizon Telescope Collaboration publishes six simultaneous papers in The Astrophysical Journal Letters on April 10, 2019. Using Earth-sized baseline interferometry across eight radio telescopes at 1.3mm wavelength, the image resolves a bright ring of emission surrounding a central dark region (the shadow) around M87*, a black hole of 6.5 billion solar masses at 16.8 Mpc. The ring diameter and asymmetry are consistent with general relativistic predictions of a Kerr black hole.',
        source: {
          externalId: 'src:eht-m87-apjl-2019',
          name: 'Event Horizon Telescope Collaboration. First M87 Event Horizon Telescope Results. I. The Shadow of the Supermassive Black Hole. The Astrophysical Journal Letters. 2019;875:L1.',
          url: 'https://doi.org/10.3847/2041-8213/ab0ec7',
          publishedAt: '2019-04-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2020-10-06',
        datePrecision: 'DAY',
        reason: 'The Breakthrough Prize and Oscar E. Seltzer Prize are awarded to the EHT collaboration in 2020. More significantly, the Nobel Prize in Physics 2020 is awarded to Roger Penrose, Reinhard Genzel, and Andrea Ghez for black hole discoveries — Genzel and Ghez for the Galactic Center black hole SgrA*, the companion supermassive black hole system. The Nobel citation contextualizes EHT as establishing black holes as observable physical objects, settling the event horizon as empirically confirmed.',
        source: {
          externalId: 'src:nobel-black-hole-2020',
          name: 'Nobel Prize Committee. Nobel Prize in Physics 2020: Black holes. The Royal Swedish Academy of Sciences. October 6, 2020.',
          url: 'https://www.nobelprize.org/prizes/physics/2020/summary/',
          publishedAt: '2020-10-06',
          methodologyType: 'derivative',
        },
      },
    ],
  },

  // ── 10. Higgs boson confirmed — 2012 ────────────────────────────────────────
  {
    externalId: 'trajectory:higgs-boson-confirmed-2012',
    text: 'CERN announced on July 4, 2012 that both the ATLAS and CMS detectors at the Large Hadron Collider had observed a new boson consistent with the Higgs boson at ~125 GeV, completing the Standard Model of particle physics by confirming the mechanism by which fundamental particles acquire mass.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '2012-07-04',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '2012-07-04',
        datePrecision: 'DAY',
        reason: 'CERN announces at a seminar in Geneva on July 4, 2012 that ATLAS observes a new particle at 126.0 ± 0.4(stat) ± 0.4(sys) GeV with 5σ significance, and CMS observes a new boson at 125.3 ± 0.4(stat) ± 0.5(sys) GeV with 4.9σ. Both collaborations (each with ~3,000 physicists) publish simultaneously in Physics Letters B. The discovery is consistent with the scalar Higgs boson predicted in 1964 by Higgs, Brout, Englert, and others.',
        source: {
          externalId: 'src:atlas-higgs-2012',
          name: 'ATLAS Collaboration. Observation of a new particle in the search for the Standard Model Higgs boson with the ATLAS detector at the LHC. Physics Letters B. 2012;716(1):1–29.',
          url: 'https://doi.org/10.1016/j.physletb.2012.08.020',
          publishedAt: '2012-07-04',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2013-10-08',
        datePrecision: 'DAY',
        reason: 'Peter Higgs and François Englert are awarded the Nobel Prize in Physics on October 8, 2013 "for the theoretical discovery of a mechanism that contributes to our understanding of the origin of mass of subatomic particles, and which recently was confirmed through the discovery of the predicted fundamental particle." The Nobel is awarded just 16 months after the experimental confirmation — unusually fast — reflecting the completeness of the evidence.',
        source: {
          externalId: 'src:nobel-higgs-2013',
          name: 'Nobel Prize Committee. Nobel Prize in Physics 2013. The Royal Swedish Academy of Sciences. October 8, 2013.',
          url: 'https://www.nobelprize.org/prizes/physics/2013/summary/',
          publishedAt: '2013-10-08',
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
      ingestedBy: 'seed:astronomy-trajectories',
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
  console.log(`Seeding ${TRAJECTORIES.length} astronomy trajectories${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  if (!DRY_RUN) {
    for (const t of TRAJECTORIES) {
      await upsertTrajectory(t)
    }
  } else {
    for (const t of TRAJECTORIES) {
      console.log(`  [dry] ${t.externalId} — ${t.transitions.length} transitions`)
    }
  }

  console.log(`\nDone. ${TRAJECTORIES.length} astronomy trajectories seeded.`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
