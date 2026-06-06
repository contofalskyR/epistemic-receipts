import type { Reservoir, Flow } from "./types";

// SVG viewBox: 0..900 wide, 0..560 tall. Reservoirs are positioned
// around an implicit Earth center (~450, 280).
export const RESERVOIRS: Reservoir[] = [
  {
    key: "sun",
    name: "Sun (incoming solar radiation)",
    shortName: "Sun",
    mass: "Solar constant ~1,361 W/m² at TOA",
    residenceTime: "Photons in transit ~8 minutes",
    description:
      "Solar irradiance is the prime forcing of the Earth system. Earth intercepts ~340 W/m² globally averaged; ~30% is reflected (planetary albedo), ~70% absorbed by surface + atmosphere.",
    facts: [
      "Total solar irradiance ~1,361 W/m²; varies ~0.1% on 11-yr solar cycle.",
      "Global mean absorbed ~239 W/m²; balanced by outgoing longwave.",
      "Sun has brightened ~30% over 4.5 Gyr (faint-young-Sun paradox).",
    ],
    color: "#fbbf24",
    cx: 450,
    cy: 60,
  },
  {
    key: "atmosphere",
    name: "Atmosphere",
    shortName: "Atmosphere",
    mass: "~5.15 × 10¹⁸ kg",
    residenceTime: "Water vapor ~9 days; CO₂ ~100s of years",
    description:
      "Thin envelope of N₂/O₂/Ar plus trace gases (CO₂, CH₄, N₂O, O₃, H₂O). Transports heat poleward, condenses precipitation, hosts the GHG effect and reflects via clouds and aerosols.",
    facts: [
      "Composition: N₂ 78%, O₂ 21%, Ar 0.9%, CO₂ 425 ppm (2025), H₂O 0–4% variable.",
      "Greenhouse effect raises surface T by ~33 K vs no-atmosphere blackbody.",
      "Carbon stock ~890 Gt C — small but the fastest-responding reservoir.",
    ],
    color: "#60a5fa",
    cx: 450,
    cy: 200,
  },
  {
    key: "hydrosphere",
    name: "Hydrosphere (ocean + freshwater)",
    shortName: "Hydrosphere",
    mass: "~1.4 × 10²¹ kg (~1.37 × 10⁹ km³ ocean)",
    residenceTime: "Surface mixed layer ~years; deep ocean ~1,000–2,000 yr",
    description:
      "Oceans cover 71% of Earth, hold 97% of water, and store >90% of accumulated climate energy. The dominant climate heat reservoir on decadal to millennial timescales.",
    facts: [
      "Ocean DIC ~38,000 Gt C — 40× atmospheric stock.",
      "Annual evaporation ~426,000 km³ from oceans alone.",
      "Mean salinity ~35 g/kg; mean depth ~3,700 m.",
    ],
    color: "#22d3ee",
    cx: 700,
    cy: 340,
  },
  {
    key: "cryosphere",
    name: "Cryosphere",
    shortName: "Cryosphere",
    mass: "~24 × 10¹⁵ kg ice (~29.5 million km³)",
    residenceTime: "Antarctic ice ~10⁵ yr; sea ice ~years; snow ~months",
    description:
      "All forms of frozen water — ice sheets, glaciers, sea ice, permafrost, snow. High-albedo surface that amplifies polar warming via ice-albedo feedback.",
    facts: [
      "Antarctic + Greenland ice sheets hold ~65 m sea-level-rise equivalent.",
      "Permafrost stores ~1,460 Pg C — 2× atmospheric carbon.",
      "Loss since 1994: ~28 trillion tonnes ice (Slater et al. 2021).",
    ],
    color: "#a5f3fc",
    cx: 200,
    cy: 340,
  },
  {
    key: "biosphere",
    name: "Biosphere",
    shortName: "Biosphere",
    mass: "~2 × 10¹⁵ kg living biomass + ~3 × 10¹⁵ kg dead",
    residenceTime: "Leaves days–years; trees decades–centuries; soil C ~10²–10³ yr",
    description:
      "All living organisms and recently dead organic matter. Photosynthesis fixes ~120 Gt C/yr; respiration returns ~half. Strongly couples atmosphere–hydrosphere–lithosphere through nutrient cycles.",
    facts: [
      "Plant biomass ~450 Gt C; marine phytoplankton ~1 Gt C — but ~50% of net production.",
      "Soil organic carbon ~1,500–2,400 Gt C.",
      "Cumulative photosynthesis built the present O₂-rich atmosphere over ~2.4 Gyr.",
    ],
    color: "#34d399",
    cx: 600,
    cy: 480,
  },
  {
    key: "lithosphere",
    name: "Lithosphere (crust + uppermost mantle)",
    shortName: "Lithosphere",
    mass: "~4.0 × 10²² kg (crust ~2.8 × 10²² kg)",
    residenceTime: "Continental crust ~10⁸–10⁹ yr; oceanic crust ~10⁸ yr",
    description:
      "Outer rigid Earth — continental and oceanic crust + uppermost mantle. Sources mineral nutrients, volatiles via volcanism, and CO₂ sinks via silicate weathering. The slowest-responding reservoir.",
    facts: [
      "Carbonate rock + organic carbon in sediments hold ~10⁸ Gt C (vastly more than all other reservoirs combined).",
      "Volcanic degassing ~280 Mt CO₂/yr ≈ 1/100 of human emissions.",
      "Silicate weathering removes ~0.3 Gt C/yr — Earth's long-term thermostat.",
    ],
    color: "#fb923c",
    cx: 300,
    cy: 480,
  },
];

export const FLOWS: Flow[] = [
  // Energy from Sun
  {
    from: "sun",
    to: "atmosphere",
    name: "Solar shortwave (TOA)",
    magnitude: "~340 W/m² global mean",
    cycle: "energy",
    description:
      "Incoming solar radiation at top of atmosphere — primary energy input. ~30% reflected by clouds, aerosols, and surface (planetary albedo ~0.30); ~70% absorbed.",
  },
  {
    from: "atmosphere",
    to: "sun",
    name: "Outgoing longwave (OLR)",
    magnitude: "~239 W/m²",
    cycle: "energy",
    description:
      "Earth's thermal emission to space. In radiative equilibrium, balances absorbed solar. Current imbalance ~+1.0 W/m² is the climate heating rate (CERES, 2020s).",
  },

  // Water cycle
  {
    from: "hydrosphere",
    to: "atmosphere",
    name: "Ocean evaporation",
    magnitude: "~426,000 km³/yr",
    cycle: "water",
    description:
      "Energy-dominated flux — ~84% of global evaporation. Latent heat absorbed (~2.5 MJ/kg) is the main vertical heat transport.",
  },
  {
    from: "biosphere",
    to: "atmosphere",
    name: "Land evapotranspiration",
    magnitude: "~73,000 km³/yr",
    cycle: "water",
    description:
      "Combined evaporation + plant transpiration over land. ~63% of land precipitation returns to atmosphere this way.",
  },
  {
    from: "atmosphere",
    to: "hydrosphere",
    name: "Ocean precipitation",
    magnitude: "~386,000 km³/yr",
    cycle: "water",
    description:
      "Rain + snow falling on oceans. Slight deficit (vs evaporation) means ocean is a net evaporation source; deficit balanced by river runoff.",
  },
  {
    from: "atmosphere",
    to: "biosphere",
    name: "Land precipitation",
    magnitude: "~113,000 km³/yr",
    cycle: "water",
    description:
      "Rainfall and snowfall over land. ~73,000 km³/yr returns via ET; ~40,000 km³/yr flows to oceans via rivers and groundwater.",
  },
  {
    from: "biosphere",
    to: "hydrosphere",
    name: "River runoff",
    magnitude: "~40,000 km³/yr",
    cycle: "water",
    description:
      "Net land-to-ocean water transport. Closes the water-cycle mass balance. Largest contributors: Amazon (~6,600 km³/yr), Congo, Orinoco, Yangtze.",
  },
  {
    from: "cryosphere",
    to: "hydrosphere",
    name: "Ice-sheet meltwater + calving",
    magnitude: "~1,150 Gt/yr (2010–2020 mean)",
    cycle: "water",
    description:
      "Mass loss from Greenland (~270 Gt/yr) + Antarctica (~150 Gt/yr) + mountain glaciers (~330 Gt/yr) + grounded ice. Drives ~70% of recent SLR.",
  },
  {
    from: "atmosphere",
    to: "cryosphere",
    name: "Snowfall accumulation",
    magnitude: "~2,300 Gt/yr",
    cycle: "water",
    description:
      "Solid precipitation on glaciers and ice sheets. Antarctic SMB ~2,500 Gt/yr; Greenland ~400–500 Gt/yr. Determines whether ice sheets gain or lose mass.",
  },

  // Carbon cycle
  {
    from: "atmosphere",
    to: "biosphere",
    name: "Photosynthesis (GPP)",
    magnitude: "~120 Gt C/yr",
    cycle: "carbon",
    description:
      "Gross primary production fixes atmospheric CO₂ into biomass. ~60 Gt on land + ~60 Gt in ocean. Net (NPP) ~50–60 Gt after autotrophic respiration.",
  },
  {
    from: "biosphere",
    to: "atmosphere",
    name: "Respiration + decomposition",
    magnitude: "~119 Gt C/yr",
    cycle: "carbon",
    description:
      "Heterotrophic + autotrophic respiration plus decay. Nearly balances GPP; net biospheric uptake ~3 Gt C/yr today (anthropogenic CO₂ fertilization + N deposition).",
  },
  {
    from: "atmosphere",
    to: "hydrosphere",
    name: "Air-sea CO₂ flux (net)",
    magnitude: "~+2.8 Gt C/yr (net uptake)",
    cycle: "carbon",
    description:
      "Gross air-sea exchange ~80 Gt C/yr each way; anthropogenic net ~2.8 Gt C/yr. ~30% of cumulative fossil CO₂ has been absorbed by oceans.",
  },
  {
    from: "hydrosphere",
    to: "lithosphere",
    name: "Carbonate burial",
    magnitude: "~0.2 Gt C/yr",
    cycle: "carbon",
    description:
      "Biogenic CaCO₃ (foraminifera, coccolithophores) sinks and is buried in marine sediments. Slow component — but the main long-term CO₂ sink integrated over million-year timescales.",
  },
  {
    from: "lithosphere",
    to: "atmosphere",
    name: "Volcanic degassing",
    magnitude: "~0.08 Gt C/yr",
    cycle: "carbon",
    description:
      "Subaerial + submarine volcanism returns subducted carbon to atmosphere. Closes the slow carbon cycle. Anthropogenic emissions exceed this ~100×.",
  },
  {
    from: "biosphere",
    to: "lithosphere",
    name: "Organic carbon burial",
    magnitude: "~0.2 Gt C/yr",
    cycle: "carbon",
    description:
      "Plant + plankton organic matter buried in sediments without full decay. Over geologic time, formed coal, oil, gas, and kerogen — and built the O₂-rich atmosphere.",
  },

  // Cryosphere coupling
  {
    from: "hydrosphere",
    to: "cryosphere",
    name: "Sea-ice formation",
    magnitude: "~10–18 million km² seasonal",
    cycle: "energy",
    description:
      "Winter freezing in polar oceans. Brine rejection during freeze-up densifies water → drives deep convection (Antarctic Bottom Water, North Atlantic Deep Water).",
  },

  // Nutrient cycles
  {
    from: "lithosphere",
    to: "biosphere",
    name: "Rock weathering — nutrients",
    magnitude: "~0.02 Gt P/yr (and Ca, Mg, Fe)",
    cycle: "nutrient",
    description:
      "Slow release of P, K, Ca, Mg, Fe from silicate and apatite weathering. Sets the long-term limit on biospheric productivity.",
  },
  {
    from: "atmosphere",
    to: "biosphere",
    name: "N deposition + biological fixation",
    magnitude: "~~210 Tg N/yr (anthropogenic) + 200 Tg natural",
    cycle: "nutrient",
    description:
      "Symbiotic N₂ fixers + lightning + Haber-Bosch fertilizer + combustion NOₓ. Human activities have ~doubled the natural N input to ecosystems.",
  },
  {
    from: "biosphere",
    to: "hydrosphere",
    name: "Nutrient runoff (N, P)",
    magnitude: "~50 Tg N/yr + ~9 Tg P/yr",
    cycle: "nutrient",
    description:
      "Nitrate, ammonium, and dissolved P delivered to coastal seas. Cause of >400 documented coastal dead zones (Gulf of Mexico, Baltic, Chesapeake).",
  },
  {
    from: "lithosphere",
    to: "atmosphere",
    name: "Dust + aerosol emission",
    magnitude: "~2,000 Tg/yr mineral dust",
    cycle: "nutrient",
    description:
      "Saharan + Asian + Patagonian dust delivers Fe and P to remote oceans and Amazon basin. Glacial-period dust flux ~10× higher.",
  },
];
