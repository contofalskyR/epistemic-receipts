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



  // ═══════════════════════════════════════════════════════════════════════════════
  // STELLAR ASTROPHYSICS (1912–1934)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 11. Leavitt Cepheid period–luminosity relation — 1912 ───────────────────
  {
    externalId: 'trajectory:leavitt-cepheid-period-luminosity-1912',
    text: 'Henrietta Swan Leavitt established in 1912 that the pulsation periods of Cepheid variable stars in the Small Magellanic Cloud are tightly correlated with their apparent brightness — the period–luminosity relation — providing the first standard candle for measuring cosmic distances.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1912-03-03',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1912-03-03',
        datePrecision: 'DAY',
        reason: 'In Harvard College Observatory Circular 173 (issued 3 March 1912 over director Edward Pickering\'s name but explicitly stating the work was "prepared by Miss Leavitt"), Leavitt reported periods for 25 variable stars in the Small Magellanic Cloud and noted a clear linear relation between the logarithm of the period and apparent magnitude. Because the stars lie at essentially the same distance, the relation reflects true (intrinsic) luminosity, supplying a method to infer distance from an easily measured period.',
        source: {
          externalId: 'src:leavitt-pickering-smc-variables-1912',
          name: 'Leavitt HS, Pickering EC. Periods of 25 Variable Stars in the Small Magellanic Cloud. Harvard College Observatory Circular. 1912;173:1–3.',
          url: 'https://ui.adsabs.harvard.edu/abs/1912HarCi.173....1L/abstract',
          publishedAt: '1912-03-03',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1913-01-01',
        datePrecision: 'YEAR',
        reason: 'Ejnar Hertzsprung calibrated the zero-point of Leavitt\'s period–luminosity relation in 1913 (Astronomische Nachrichten 196:201) using the proper motions of nearby galactic Cepheids, converting the relation from a relative correlation into an absolute distance scale. This calibration turned Leavitt\'s law into the working tool that Harlow Shapley used to size the Milky Way (1918) and Edwin Hubble used to establish the extragalactic distance scale, settling the period–luminosity relation as the foundation of the cosmic distance ladder.',
        source: {
          externalId: 'src:hertzsprung-cepheid-calibration-1913',
          name: 'Hertzsprung E. Über die räumliche Verteilung der Veränderlichen vom δ Cephei-Typus. Astronomische Nachrichten. 1913;196:201–208.',
          url: 'https://ui.adsabs.harvard.edu/abs/1913AN....196..201H/abstract',
          publishedAt: '1913-01-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 12. Hertzsprung–Russell diagram — 1914 ──────────────────────────────────
  {
    externalId: 'trajectory:hertzsprung-russell-diagram-1914',
    text: 'Henry Norris Russell established in 1913–1914 that stars segregate into luminous "giant" and fainter "dwarf" sequences when absolute magnitude is plotted against spectral class, producing the diagram (later called the Hertzsprung–Russell diagram) that became the central organizing framework of stellar astrophysics.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1913-12-30',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1914-01-01',
        datePrecision: 'YEAR',
        reason: 'Russell first presented his diagram of absolute magnitude versus spectral type at the American Astronomical Society meeting in December 1913 and published it in 1914 as "Relations Between the Spectra and Other Characteristics of the Stars" (Popular Astronomy 22, and in Nature 93). Building on Ejnar Hertzsprung\'s independent 1911 photometric work, Russell showed that most stars fall on a continuous "dwarf" main sequence while a separate population of "giant" stars occupies the high-luminosity region, revealing systematic structure in the stellar population.',
        source: {
          externalId: 'src:russell-spectra-characteristics-1914',
          name: 'Russell HN. Relations Between the Spectra and Other Characteristics of the Stars. Popular Astronomy. 1914;22:275–294 (Part I), 331–351 (Part II).',
          url: 'https://ui.adsabs.harvard.edu/abs/1914PA.....22..275R/abstract',
          publishedAt: '1914-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1926-01-01',
        datePrecision: 'YEAR',
        reason: 'Arthur Eddington\'s "The Internal Constitution of the Stars" (1926) supplied the physical theory of stellar structure — including the mass–luminosity relation — that explained why stars occupy the main sequence and how luminosity, mass, and temperature are linked, grounding the empirical diagram in physics. The Hertzsprung–Russell diagram became, and remains, the universally adopted framework for stellar classification and the study of stellar evolution, settling its status as foundational.',
        source: {
          externalId: 'src:eddington-internal-constitution-stars-1926',
          name: 'Eddington AS. The Internal Constitution of the Stars. Cambridge: Cambridge University Press. 1926.',
          url: 'https://ui.adsabs.harvard.edu/abs/1926ics..book.....E/abstract',
          publishedAt: '1926-01-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 13. Sirius B identified as white dwarf — 1915 ───────────────────────────
  {
    externalId: 'trajectory:sirius-b-white-dwarf-1915',
    text: 'Walter S. Adams established in 1915 that the faint companion of Sirius (Sirius B) is an extraordinarily dense compact star — roughly Earth-sized yet about one solar mass, implying a density tens of thousands of times that of water — the first identification of what would be recognized as a white dwarf.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1915-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1915-01-01',
        datePrecision: 'YEAR',
        reason: 'Friedrich Bessel had predicted an unseen companion to Sirius from its proper-motion wobble in 1844, and Alvan Graham Clark first sighted Sirius B telescopically on 31 January 1862. Adams, observing its spectrum at Mount Wilson, reported in "The Spectrum of the Companion of Sirius" (PASP 1915) that the companion was hot and white (early A-type) yet very faint, forcing the conclusion that it was about the size of the Earth with the mass of the Sun. The implied density was regarded as physically absurd at the time, so the result entered the literature as an anomaly.',
        source: {
          externalId: 'src:adams-sirius-companion-1915',
          name: 'Adams WS. The Spectrum of the Companion of Sirius. Publications of the Astronomical Society of the Pacific. 1915;27(161):236–237.',
          url: 'https://doi.org/10.1086/122440',
          publishedAt: '1915-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1926-12-01',
        datePrecision: 'MONTH',
        reason: 'Ralph H. Fowler\'s paper "On Dense Matter" (MNRAS, December 1926) applied the new Fermi–Dirac quantum statistics to show that white dwarfs are supported against gravity by electron degeneracy pressure, providing a physical mechanism that made the previously "impossible" density not only plausible but required. This converted Sirius B from an embarrassing anomaly into the prototype of a recognized class of degenerate stars, settling white dwarfs as a real and understood stellar end-state.',
        source: {
          externalId: 'src:fowler-dense-matter-1926',
          name: 'Fowler RH. On Dense Matter. Monthly Notices of the Royal Astronomical Society. 1926;87(2):114–122.',
          url: 'https://doi.org/10.1093/mnras/87.2.114',
          publishedAt: '1926-12-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 14. Payne — stars are mostly hydrogen — 1925 ────────────────────────────
  {
    externalId: 'trajectory:payne-stellar-hydrogen-1925',
    text: 'Cecilia Payne demonstrated in her 1925 Harvard doctoral thesis that stars are composed overwhelmingly of hydrogen and helium, by applying Saha\'s ionization theory to stellar spectra and showing that the differing strengths of absorption lines reflect temperature and ionization rather than differing elemental abundances.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1925-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1925-01-01',
        datePrecision: 'YEAR',
        reason: 'Payne\'s thesis "Stellar Atmospheres," published as Harvard Observatory Monograph No. 1, used Meghnad Saha\'s ionization equation to relate spectral classes to temperature and derived that hydrogen and helium are millions of times more abundant than the metals — overturning the prevailing belief that stars had roughly the Earth\'s composition. Under pressure from Henry Norris Russell, who told her the hydrogen result was "clearly impossible," she added a disclaimer calling the enormous hydrogen and helium abundances "almost certainly not real," so the finding entered the literature in a deliberately hedged form.',
        source: {
          externalId: 'src:payne-stellar-atmospheres-1925',
          name: 'Payne CH. Stellar Atmospheres; A Contribution to the Observational Study of High Temperature in the Reversing Layers of Stars. Harvard Observatory Monograph No. 1. Cambridge, MA. 1925.',
          url: 'https://ui.adsabs.harvard.edu/abs/1925PhDT.........6P/abstract',
          publishedAt: '1925-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1929-07-01',
        datePrecision: 'MONTH',
        reason: 'Henry Norris Russell, working independently from Mount Wilson spectra, published "On the Composition of the Sun\'s Atmosphere" in The Astrophysical Journal (vol. 70, July 1929), deriving abundances for 56 elements and concluding that hydrogen dominates (~92% by number). He explicitly credited Payne\'s prior determination as the most important previous work, and his confirmation removed the doubt he had earlier imposed, settling the hydrogen-dominated composition of stars as established astrophysics.',
        source: {
          externalId: 'src:russell-sun-composition-1929',
          name: 'Russell HN. On the Composition of the Sun\'s Atmosphere. The Astrophysical Journal. 1929;70:11–82.',
          url: 'https://doi.org/10.1086/143197',
          publishedAt: '1929-07-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 15. Baade & Zwicky predict neutron stars from supernovae — 1934 ─────────
  {
    externalId: 'trajectory:baade-zwicky-neutron-star-supernova-1934',
    text: 'Walter Baade and Fritz Zwicky proposed in 1934 that "super-novae" are a distinct, far more energetic class of stellar explosion than ordinary novae, marking the transition of an ordinary star into a neutron star and serving as a source of cosmic rays — the first prediction of the existence of neutron stars.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1934-05-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1934-05-01',
        datePrecision: 'MONTH',
        reason: 'Having first presented the idea at the American Physical Society meeting at Stanford in December 1933 (abstract in Physical Review 45:138, 1934), Baade and Zwicky published "On Super-Novae" in the Proceedings of the National Academy of Sciences (vol. 20, no. 5, 1934), coining the term "super-nova," arguing these events release energies far beyond ordinary novae, and proposing that "a super-nova represents the transition of an ordinary star into a neutron star" — bodies of extremely small radius and very high density. The neutron-star proposal was highly speculative and remained largely an unconfirmed theoretical conjecture for over three decades.',
        source: {
          externalId: 'src:baade-zwicky-supernovae-1934',
          name: 'Baade W, Zwicky F. On Super-Novae. Proceedings of the National Academy of Sciences. 1934;20(5):254–259.',
          url: 'https://doi.org/10.1073/pnas.20.5.254',
          publishedAt: '1934-05-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1968-02-24',
        datePrecision: 'DAY',
        reason: 'The discovery of pulsars, announced by Hewish, Bell and colleagues in Nature on 24 February 1968 and rapidly interpreted by Thomas Gold and Franco Pacini as rapidly rotating magnetized neutron stars — clinched by the Crab pulsar sitting inside a supernova remnant — provided the first empirical confirmation that neutron stars exist and are produced in supernovae, vindicating Baade and Zwicky\'s 1934 prediction 34 years after it was made.',
        source: {
          externalId: 'src:hewish-bell-pulsar-nature-1968',
          name: 'Hewish A, Bell SJ, Pilkington JDH, Scott PF, Collins RA. Observation of a Rapidly Pulsating Radio Source. Nature. 1968;217(5130):709–713.',
          url: 'https://doi.org/10.1038/217709a0',
          publishedAt: '1968-02-24',
          methodologyType: 'primary',
        },
      },
    ],
  },



  // ═══════════════════════════════════════════════════════════════════════════════
  // COSMOLOGY (1927–1998)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 16. Lemaître expanding universe & Hubble constant — 1927 ────────────────
  {
    externalId: 'trajectory:lemaitre-expanding-universe-1927',
    text: 'Georges Lemaître derived from general relativity in 1927 that the universe is expanding and that distant galaxies recede at velocities proportional to their distance, and he made the first empirical estimate of the proportionality constant (now the Hubble constant) from extragalactic nebula data.',
    claimType: 'HYBRID',
    claimEmergedAt: '1927-01-01',
    claimEmergedPrecision: 'YEAR',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1927-01-01',
        datePrecision: 'YEAR',
        reason: 'Lemaître published \'Un univers homogène de masse constante et de rayon croissant rendant compte de la vitesse radiale des nébuleuses extra-galactiques\' in the Annales de la Société Scientifique de Bruxelles (1927), deriving an expanding-universe solution of Einstein\'s equations and the linear velocity–distance relation, with a first estimate of the expansion rate. The journal had limited circulation, so the result was largely unnoticed at the time, entering the record without uptake.',
        source: {
          externalId: 'src:lemaitre-univers-homogene-1927',
          name: 'Lemaître G. Un univers homogène de masse constante et de rayon croissant rendant compte de la vitesse radiale des nébuleuses extra-galactiques. Annales de la Société Scientifique de Bruxelles. 1927;A47:49–59.',
          url: 'https://link.springer.com/article/10.1007/s10714-013-1548-3',
          publishedAt: '1927-01-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2018-10-26',
        datePrecision: 'DAY',
        reason: 'An IAU electronic vote of all individual members, concluding 26 October 2018 (announced 29 October 2018), adopted Resolution B4 recommending that the expansion law be renamed the \'Hubble–Lemaître law\' (78% in favour). The resolution formally recognized Lemaître\'s 1927 priority in deriving the velocity–distance relation, institutionally settling his contribution to the foundation of expanding-universe cosmology.',
        source: {
          externalId: 'src:iau-hubble-lemaitre-resolution-2018',
          name: 'International Astronomical Union. IAU members vote to recommend renaming the Hubble law as the Hubble–Lemaître law (Resolution B4). Press release iau1812. 2018-10-29.',
          url: 'https://iauarchive.eso.org/news/pressreleases/detail/iau1812/',
          publishedAt: '2018-10-29',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 17. Rubin, Ford & Thonnard — galaxy rotation curves & dark matter — 1980 ─
  {
    externalId: 'trajectory:rubin-galaxy-rotation-dark-matter-1980',
    text: 'Vera Rubin, Kent Ford, and Norbert Thonnard reported in 1980 that the rotation curves of 21 Sc spiral galaxies stay flat or rising out to their largest measured radii, implying large amounts of unseen mass extending well beyond the visible disks.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1980-06-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1980-06-01',
        datePrecision: 'MONTH',
        reason: 'Rubin, Ford, and Thonnard published \'Rotational Properties of 21 Sc Galaxies\' in The Astrophysical Journal (vol. 238, pp. 471–487, June 1980), showing rotation curves that remain flat to the outermost measured points instead of falling as Keplerian dynamics predict for the visible mass. They concluded that Sc spirals of all luminosities harbor significant mass beyond the optical image — the strongest systematic observational case for dark matter in galaxies up to that point.',
        source: {
          externalId: 'src:rubin-ford-thonnard-rotation-1980',
          name: 'Rubin VC, Ford WK Jr, Thonnard N. Rotational properties of 21 Sc galaxies with a large range of luminosities and radii, from NGC 4605 (R=4 kpc) to UGC 2885 (R=122 kpc). The Astrophysical Journal. 1980;238:471–487.',
          url: 'https://ui.adsabs.harvard.edu/abs/1980ApJ...238..471R/abstract',
          publishedAt: '1980-06-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1992-09-01',
        datePrecision: 'MONTH',
        reason: 'By the early 1990s flat rotation curves had been confirmed across hundreds of spirals (extended by neutral-hydrogen 21 cm radio data well beyond the optical disk), and independent COBE detection of CMB anisotropy (Smoot et al., ApJ 396:L1, 1992) tied structure formation to a dark-matter-dominated universe. Galactic dark matter became a settled component of the standard cosmological picture, with Rubin\'s rotation-curve work cited as its defining galaxy-scale evidence.',
        source: {
          externalId: 'src:smoot-cobe-dmr-1992',
          name: 'Smoot GF, Bennett CL, Kogut A, et al. Structure in the COBE Differential Microwave Radiometer first-year maps. The Astrophysical Journal. 1992;396:L1–L5.',
          url: 'https://ui.adsabs.harvard.edu/abs/1992ApJ...396L...1S/abstract',
          publishedAt: '1992-09-01',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 18. COBE — CMB blackbody & anisotropy — 1992 ────────────────────────────
  {
    externalId: 'trajectory:cobe-cmb-blackbody-anisotropy-1992',
    text: 'NASA\'s COBE satellite measured the cosmic microwave background to be an almost perfect blackbody (Mather et al., 1990) and detected its predicted intrinsic temperature anisotropies at the ~30 microkelvin level (Smoot et al., announced 23 April 1992), confirming the Hot Big Bang and the seeds of cosmic structure.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1992-04-23',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1992-04-23',
        datePrecision: 'DAY',
        reason: 'The COBE DMR team, led by George Smoot, announced on 23 April 1992 (at the American Physical Society meeting) the first detection of intrinsic CMB temperature anisotropies — scale-invariant fluctuations of ~30 microkelvin matching the Harrison–Zel\'dovich spectrum of inflationary models. Together with the COBE FIRAS blackbody spectrum (Mather et al., ApJ 354:L37, 1990), it provided the primordial density seeds for structure formation, published as Smoot et al., ApJ 396:L1 (1992).',
        source: {
          externalId: 'src:smoot-cobe-dmr-anisotropy-1992',
          name: 'Smoot GF, Bennett CL, Kogut A, et al. Structure in the COBE Differential Microwave Radiometer first-year maps. The Astrophysical Journal. 1992;396:L1–L5.',
          url: 'https://ui.adsabs.harvard.edu/abs/1992ApJ...396L...1S/abstract',
          publishedAt: '1992-09-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2006-10-03',
        datePrecision: 'DAY',
        reason: 'The Royal Swedish Academy of Sciences announced on 3 October 2006 that the Nobel Prize in Physics was awarded to John C. Mather and George F. Smoot \'for their discovery of the blackbody form and anisotropy of the cosmic microwave background radiation.\' The citation institutionally settled COBE\'s results as definitive confirmation of the Hot Big Bang and the origin of large-scale structure.',
        source: {
          externalId: 'src:nobel-cobe-2006',
          name: 'Royal Swedish Academy of Sciences. The Nobel Prize in Physics 2006 — Press release (Mather, Smoot). 2006-10-03.',
          url: 'https://www.nobelprize.org/prizes/physics/2006/press-release/',
          publishedAt: '2006-10-03',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 19. Riess et al. — accelerating expansion & dark energy — 1998 ──────────
  {
    externalId: 'trajectory:accelerating-expansion-dark-energy-1998',
    text: 'Adam Riess and the High-z Supernova Search Team reported in 1998 that distant Type Ia supernovae are ~10–15% fainter (farther) than expected, providing direct evidence that the expansion of the universe is accelerating and implying a positive cosmological constant (dark energy).',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1998-03-13',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1998-03-13',
        datePrecision: 'DAY',
        reason: 'Riess et al. submitted \'Observational Evidence from Supernovae for an Accelerating Universe and a Cosmological Constant\' to The Astronomical Journal on 13 March 1998 (vol. 116, p. 1009). Using 16 high-redshift Type Ia supernovae, the High-z team found them systematically fainter than a decelerating universe predicts, favoring an eternally expanding universe with a positive cosmological constant. Corroborated months later by the Supernova Cosmology Project (Perlmutter et al., ApJ 517:565, 1999).',
        source: {
          externalId: 'src:riess-accelerating-universe-1998',
          name: 'Riess AG, Filippenko AV, Challis P, et al. Observational evidence from supernovae for an accelerating universe and a cosmological constant. The Astronomical Journal. 1998;116(3):1009–1038.',
          url: 'https://iopscience.iop.org/article/10.1086/300499',
          publishedAt: '1998-09-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2011-10-04',
        datePrecision: 'DAY',
        reason: 'The Royal Swedish Academy of Sciences announced on 4 October 2011 that the Nobel Prize in Physics was awarded to Saul Perlmutter, Brian P. Schmidt, and Adam G. Riess \'for the discovery of the accelerating expansion of the Universe through observations of distant supernovae.\' The award institutionally settled cosmic acceleration and dark energy as established components of the standard cosmological model.',
        source: {
          externalId: 'src:nobel-accelerating-universe-2011',
          name: 'Royal Swedish Academy of Sciences. The Nobel Prize in Physics 2011 — Press release (Perlmutter, Schmidt, Riess). 2011-10-04.',
          url: 'https://www.nobelprize.org/prizes/physics/2011/press-release/',
          publishedAt: '2011-10-04',
          methodologyType: 'primary',
        },
      },
    ],
  },



  // ═══════════════════════════════════════════════════════════════════════════════
  // PARTICLE PHYSICS — ANTIMATTER & SYMMETRY (1932–1998)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 20. Anderson discovers the positron — 1932 ──────────────────────────────
  {
    externalId: 'trajectory:anderson-positron-discovery-1932',
    text: 'Carl D. Anderson discovered the positron — a positively charged particle with the mass of an electron, the first known antimatter particle — from cloud-chamber photographs of cosmic-ray tracks, reporting the definitive result in \'The Positive Electron\' in Physical Review on 15 March 1933.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1932-08-02',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1933-03-15',
        datePrecision: 'DAY',
        reason: 'Anderson first noted anomalous positive tracks in a 2 August 1932 cloud-chamber photograph and announced them in a brief Science note in September 1932, but the definitive discovery paper, \'The Positive Electron,\' appeared in Physical Review vol. 43 (pp. 491–494) on 15 March 1933. From 15 positive tracks too lightly ionizing to be protons, he concluded the particles carried unit positive charge with mass comparable to the electron\'s, naming them positrons. The result supplied the first experimental instance of antimatter, matching Dirac\'s 1928–1931 relativistic prediction of a positive electron.',
        source: {
          externalId: 'src:anderson-positive-electron-1933',
          name: 'Anderson CD. The Positive Electron. Physical Review. 1933;43(6):491–494.',
          url: 'https://doi.org/10.1103/PhysRev.43.491',
          publishedAt: '1933-03-15',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1936-01-01',
        datePrecision: 'YEAR',
        reason: 'Patrick Blackett and Giuseppe Occhialini independently confirmed the positron in 1933 (Proc. Roy. Soc. A 139:699), showing positron–electron pairs in cosmic-ray showers and explicitly linking them to Dirac\'s hole theory. Anderson was awarded the Nobel Prize in Physics in 1936 \'for his discovery of the positron,\' institutionally settling antimatter as a real, observed feature of nature and confirming relativistic quantum theory\'s prediction of antiparticles.',
        source: {
          externalId: 'src:nobel-physics-1936-anderson',
          name: 'Nobel Prize Committee. The Nobel Prize in Physics 1936 (Victor F. Hess, Carl D. Anderson). The Royal Swedish Academy of Sciences. 1936.',
          url: 'https://www.nobelprize.org/prizes/physics/1936/summary/',
          publishedAt: '1936-11-12',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 21. Chamberlain & Segrè observe the antiproton — 1955 ───────────────────
  {
    externalId: 'trajectory:chamberlain-segre-antiproton-1955',
    text: 'Owen Chamberlain, Emilio Segrè, Clyde Wiegand, and Thomas Ypsilantis observed the antiproton — the negatively charged antiparticle of the proton — at the Berkeley Bevatron, reporting the discovery in \'Observation of Antiprotons\' in Physical Review on 1 November 1955.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1955-10-01',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1955-11-01',
        datePrecision: 'DAY',
        reason: 'Using the 6.2 GeV Bevatron — built with enough energy to produce proton–antiproton pairs — the Berkeley team selected negative particles of proton mass with a magnetic-spectrometer-plus-velocity (Čerenkov and time-of-flight) system and published \'Observation of Antiprotons\' in Physical Review vol. 100 (pp. 947–950), dated 1 November 1955. The detection confirmed that the proton, like the electron, has a charge-conjugate antiparticle, extending Dirac\'s antimatter framework to baryons.',
        source: {
          externalId: 'src:chamberlain-antiprotons-1955',
          name: 'Chamberlain O, Segrè E, Wiegand C, Ypsilantis T. Observation of Antiprotons. Physical Review. 1955;100(3):947–950.',
          url: 'https://doi.org/10.1103/PhysRev.100.947',
          publishedAt: '1955-11-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1959-01-01',
        datePrecision: 'YEAR',
        reason: 'Antiproton annihilation events were promptly confirmed in emulsion and propane bubble-chamber studies at Berkeley (1956), and the antineutron was found in 1956. Chamberlain and Segrè were awarded the Nobel Prize in Physics in 1959 \'for their discovery of the antiproton,\' institutionally settling the existence of antibaryons and the general principle that every charged particle has an antiparticle.',
        source: {
          externalId: 'src:nobel-physics-1959-antiproton',
          name: 'Nobel Prize Committee. The Nobel Prize in Physics 1959 (Emilio Segrè, Owen Chamberlain). The Royal Swedish Academy of Sciences. 1959.',
          url: 'https://www.nobelprize.org/prizes/physics/1959/summary/',
          publishedAt: '1959-10-26',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 22. Wu — parity violation in beta decay — 1957 ──────────────────────────
  {
    externalId: 'trajectory:wu-parity-violation-1957',
    text: 'Chien-Shiung Wu and collaborators demonstrated that parity is not conserved in the weak interaction by observing an asymmetric angular distribution of electrons emitted from beta decay of polarized cobalt-60 nuclei, reporting the result in Physical Review on 15 February 1957.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1957-01-15',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1957-02-15',
        datePrecision: 'DAY',
        reason: 'Following Lee and Yang\'s 1956 proposal (Phys. Rev. 104:254) that parity conservation had never been tested in the weak interaction, Wu — with Ambler, Hayward, Hoppes, and Hudson at the U.S. National Bureau of Standards — cooled cobalt-60 to ~0.01 K to polarize the nuclei and found beta electrons emitted preferentially opposite to the nuclear spin. Published as \'Experimental Test of Parity Conservation in Beta Decay\' (Phys. Rev. 105:1413–1415, 15 February 1957), the asymmetry showed the weak interaction distinguishes left from right, overturning the assumed mirror symmetry of physical law.',
        source: {
          externalId: 'src:wu-parity-beta-decay-1957',
          name: 'Wu CS, Ambler E, Hayward RW, Hoppes DD, Hudson RP. Experimental Test of Parity Conservation in Beta Decay. Physical Review. 1957;105(4):1413–1415.',
          url: 'https://doi.org/10.1103/PhysRev.105.1413',
          publishedAt: '1957-02-15',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1957-01-01',
        datePrecision: 'YEAR',
        reason: 'Garwin, Lederman, and Weinrich independently confirmed parity violation in pion-muon decay in the same Physical Review issue (105:1415), and the result was rapidly accepted. Lee and Yang were awarded the 1957 Nobel Prize in Physics \'for their penetrating investigation of the so-called parity laws\' — among the fastest Nobel recognitions ever — institutionally settling parity non-conservation as a fundamental property of the weak force.',
        source: {
          externalId: 'src:nobel-physics-1957-parity',
          name: 'Nobel Prize Committee. The Nobel Prize in Physics 1957 (Chen Ning Yang, Tsung-Dao Lee). The Royal Swedish Academy of Sciences. 1957.',
          url: 'https://www.nobelprize.org/prizes/physics/1957/summary/',
          publishedAt: '1957-10-31',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 23. November Revolution — J/ψ and the charm quark — 1974 ────────────────
  {
    externalId: 'trajectory:november-revolution-jpsi-charm-1974',
    text: 'Two teams led by Samuel Ting (Brookhaven) and Burton Richter (SLAC) simultaneously discovered the J/ψ particle, a narrow resonance at ~3.1 GeV revealing a bound state of a fourth (charm) quark, reported in back-to-back Physical Review Letters papers on 2 December 1974 — the \'November Revolution\' of particle physics.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1974-11-11',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1974-12-02',
        datePrecision: 'DAY',
        reason: 'Ting\'s group at Brookhaven (seeing the \'J\' in proton-beryllium collisions) and Richter\'s group at SLAC\'s SPEAR (seeing the \'ψ\' as a sharp resonance in electron-positron annihilation) announced their findings simultaneously on 11 November 1974 and published back-to-back in Physical Review Letters vol. 33 on 2 December 1974: Aubert et al. (pp. 1404–1406) and Augustin et al. (pp. 1406–1408). The anomalously narrow width of the 3.1 GeV state implied a new conserved quantum number, interpreted as charm — the fourth quark predicted by the GIM mechanism — providing decisive evidence for the quark model.',
        source: {
          externalId: 'src:aubert-heavy-particle-j-1974',
          name: 'Aubert JJ, Becker U, Biggs PJ, et al. Experimental Observation of a Heavy Particle J. Physical Review Letters. 1974;33(23):1404–1406.',
          url: 'https://doi.org/10.1103/PhysRevLett.33.1404',
          publishedAt: '1974-12-02',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1976-01-01',
        datePrecision: 'YEAR',
        reason: 'The discovery of charmed mesons (D mesons) in 1976 confirmed the charm interpretation, and Richter and Ting were awarded the 1976 Nobel Prize in Physics \'for their pioneering work in the discovery of a heavy elementary particle of a new kind.\' The award — given just two years after the discovery — institutionally settled the existence of the charm quark and validated the four-quark electroweak Standard Model.',
        source: {
          externalId: 'src:nobel-physics-1976-jpsi',
          name: 'Nobel Prize Committee. The Nobel Prize in Physics 1976 (Burton Richter, Samuel C. C. Ting). The Royal Swedish Academy of Sciences. 1976.',
          url: 'https://www.nobelprize.org/prizes/physics/1976/summary/',
          publishedAt: '1976-10-18',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 24. Super-Kamiokande — neutrino oscillations — 1998 ─────────────────────
  {
    externalId: 'trajectory:superkamiokande-neutrino-oscillation-1998',
    text: 'The Super-Kamiokande Collaboration reported evidence that atmospheric neutrinos oscillate between flavors — a zenith-angle-dependent deficit of muon neutrinos requiring neutrinos to have nonzero mass — in \'Evidence for Oscillation of Atmospheric Neutrinos\' in Physical Review Letters in 1998.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1998-06-05',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1998-08-24',
        datePrecision: 'DAY',
        reason: 'Takaaki Kajita announced the result at the Neutrino \'98 conference in Takayama, Japan, on 5 June 1998; the paper (Fukuda et al., Phys. Rev. Lett. 81:1562, submitted 1 July, published 24 August 1998) reported a zenith-angle-dependent deficit of muon neutrinos from a 535-day Super-Kamiokande exposure. The data fit two-flavor νμ↔ντ oscillations, which require neutrinos to have nonzero mass — the first compelling evidence that neutrinos are massive, contradicting the massless-neutrino assumption of the Standard Model.',
        source: {
          externalId: 'src:fukuda-atmospheric-neutrino-oscillation-1998',
          name: 'Fukuda Y, et al. (Super-Kamiokande Collaboration). Evidence for Oscillation of Atmospheric Neutrinos. Physical Review Letters. 1998;81(8):1562–1567.',
          url: 'https://doi.org/10.1103/PhysRevLett.81.1562',
          publishedAt: '1998-08-24',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '2015-10-06',
        datePrecision: 'DAY',
        reason: 'The Sudbury Neutrino Observatory\'s 2001–2002 measurement of solar neutrino flavor change independently confirmed oscillation and resolved the solar neutrino problem. Takaaki Kajita (Super-Kamiokande) and Arthur McDonald (SNO) were awarded the Nobel Prize in Physics on 6 October 2015 \'for the discovery of neutrino oscillations, which shows that neutrinos have mass,\' institutionally settling that neutrinos are massive and requiring an extension of the Standard Model.',
        source: {
          externalId: 'src:nobel-physics-2015-neutrino-oscillations',
          name: 'Nobel Prize Committee. The Nobel Prize in Physics 2015 (Takaaki Kajita, Arthur B. McDonald). The Royal Swedish Academy of Sciences. October 6, 2015.',
          url: 'https://www.nobelprize.org/prizes/physics/2015/summary/',
          publishedAt: '2015-10-06',
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
      epistemicAxis: t.currentAxis,
      ingestedBy: 'seed:astronomy-trajectories',
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
