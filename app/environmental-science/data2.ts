import type { Family } from "./types";

export const FAMILIES_7_12: Family[] = [
  // ── Family 7 ─ Biogeography ─────────────────────────────────────────────
  {
    slug: "biogeography",
    number: 7,
    name: "Biogeography",
    blurb: "The geography of biodiversity — dispersal, vicariance, realms, and biomes.",
    section: "B",
    color: "cyan",
    entries: [
      {
        name: "Biogeography",
        description: "The geography of biodiversity.",
        principle:
          "The study of the distribution of species and ecosystems across space and time, and the historical and ecological processes (dispersal, vicariance, speciation, extinction) that produce it.",
        tags: ["biogeography"],
      },
      {
        name: "Island biogeography (MacArthur–Wilson)",
        description: "Diversity as a dynamic balance.",
        formula:
          "S_{\\text{eq}}\\text{ where immigration}(S) = \\text{extinction}(S)",
        interpretation:
          "Species richness on an island reaches equilibrium where immigration = extinction; richness rises with island area and falls with isolation (distance from source). The theoretical basis of reserve design (habitat fragments as \"islands\").",
        tags: ["biogeography", "conservation"],
      },
      {
        name: "Dispersal & vicariance",
        description: "Two ways ranges form.",
        principle:
          "Dispersal spreads taxa across barriers to new areas; vicariance splits a once-continuous range when a barrier (mountain, sea, rift) arises — competing explanations for disjunct distributions.",
        tags: ["biogeography"],
        xref: ["geology"],
      },
      {
        name: "Biogeographic realms & provinces",
        description: "The great faunal regions.",
        principle:
          "Wallace's realms (Palearctic, Nearctic, Neotropical, Afrotropical, Indomalayan, Australasian, etc.) partition the world by shared evolutionary history and characteristic biotas.",
        example: "Wallace's Line separating Asian and Australian faunas.",
        tags: ["biogeography"],
      },
      {
        name: "Continental drift & biogeography",
        description: "Plate tectonics shapes distributions.",
        principle:
          "The breakup of Pangaea/Gondwana explains disjunct distributions of ancient lineages (marsupials, southern beeches) — biogeography as evidence for, and consequence of, moving plates.",
        tags: ["biogeography"],
        xref: ["geology", "earth-sciences"],
      },
      {
        name: "Biomes",
        description: "Climate-defined community types.",
        principle:
          "Large-scale communities determined mainly by temperature and precipitation — tropical rainforest, savanna, desert, temperate forest/grassland, boreal forest (taiga), tundra, and their aquatic analogues; convergent in form across continents.",
        tags: ["biogeography", "climate"],
      },
      {
        name: "Whittaker biome classification",
        description: "Biomes on a climate diagram.",
        principle:
          "Whittaker arranged terrestrial biomes on axes of mean annual temperature and precipitation, predicting vegetation type from climate.",
        tags: ["biogeography", "climate"],
      },
      {
        name: "Terrestrial vs aquatic vs marine realms",
        description: "The three great habitat domains.",
        principle:
          "Environmental science partitions the biosphere into terrestrial, freshwater, and marine systems, each with distinct productivity, nutrient limitation, and biodiversity patterns.",
        tags: ["biogeography"],
      },
      {
        name: "Zoogeography & phytogeography",
        description: "Animal and plant distributions.",
        principle:
          "The sub-disciplines tracking, respectively, animal and plant ranges and the barriers and corridors that shape them.",
        tags: ["biogeography"],
      },
    ],
  },

  // ── Family 8 ─ Conservation Biology ─────────────────────────────────────
  {
    slug: "conservation-biology",
    number: 8,
    name: "Conservation Biology",
    blurb: "The mission-oriented science of preventing biodiversity loss — from Red List to reserves.",
    section: "B",
    color: "cyan",
    entries: [
      {
        name: "Conservation biology",
        description: "The science of protecting biodiversity.",
        principle:
          "A mission-oriented, interdisciplinary field that studies the loss of biodiversity and develops principles and tools to prevent it; explicitly value-laden in its goal (preserving biodiversity) but rigorous in method.",
        tags: ["conservation"],
      },
      {
        name: "Extinction & background extinction rate",
        description: "The pace of loss.",
        formula:
          "\\text{background} \\approx 0.1\\text{–}1\\ \\text{E/MSY}",
        interpretation:
          "Extinctions per million species-years; current rates are estimated at ~100–1,000$\\times$ background. Elevated rates are the signature of a mass extinction.",
        tags: ["conservation"],
        xref: ["statistics"],
      },
      {
        name: "The sixth mass extinction",
        description: "A human-driven biodiversity crisis.",
        principle:
          "Many scientists argue Earth is entering its sixth mass extinction, driven by human activity, with vertebrate and insect declines far above background; the framing's precise magnitude is debated but the elevated loss is not.",
        tags: ["conservation", "climate"],
      },
      {
        name: "Drivers of biodiversity loss (HIPPO)",
        description: "The main threats.",
        principle:
          "Habitat loss, Invasive species, Pollution, human Population growth, and Overharvesting — with climate change now a rising sixth driver; habitat loss is generally the largest. Assessed globally by IPBES.",
        tags: ["conservation", "pollution"],
      },
      {
        name: "IUCN Red List & threat categories",
        description: "The global extinction-risk index.",
        principle:
          "The standard assessment ranking species from Least Concern $\\to$ Near Threatened $\\to$ Vulnerable $\\to$ Endangered $\\to$ Critically Endangered $\\to$ Extinct in the Wild $\\to$ Extinct, by quantitative criteria. As of 2026, >172,600 species have been assessed and >47,000 are threatened (~28% of assessed).",
        tags: ["conservation"],
      },
      {
        name: "Habitat fragmentation",
        description: "Breaking habitat into pieces.",
        principle:
          "Subdividing habitat reduces patch size and increases isolation and edge, raising extinction risk (via island-biogeography and edge effects) even before total area loss becomes lethal.",
        tags: ["conservation", "spatial"],
      },
      {
        name: "Reserve design (SLOSS)",
        description: "How to shape protected areas.",
        principle:
          "The \"Single Large Or Several Small\" debate over reserve configuration, drawing on island biogeography; corridors, buffer zones, and connectivity are now emphasized to counter fragmentation.",
        tags: ["conservation"],
      },
      {
        name: "Wildlife corridors & connectivity",
        description: "Reconnecting fragments.",
        principle:
          "Habitat linkages that allow movement, gene flow, and range shifts between patches, mitigating fragmentation and enabling climate-driven redistribution.",
        tags: ["conservation", "spatial"],
      },
      {
        name: "Minimum viable population & genetic bottlenecks",
        description: "How small is too small.",
        principle:
          "Small populations suffer inbreeding depression, loss of genetic diversity, and demographic/environmental stochasticity; MVP estimates the size needed for a high probability of long-term persistence.",
        tags: ["conservation"],
        xref: ["biology"],
      },
      {
        name: "In-situ vs ex-situ conservation",
        description: "Protecting where, or away.",
        principle:
          "In-situ conserves species in their natural habitat (protected areas); ex-situ conserves them elsewhere (zoos, botanical gardens, seed and gene banks) as a backstop and source for reintroduction.",
        tags: ["conservation"],
      },
      {
        name: "Protected areas & IUCN categories",
        description: "Legally set-aside land and sea.",
        principle:
          "Areas managed for conservation, graded by IUCN from strict reserves (Ia) to sustainable-use areas (VI); global targets (e.g. \"30$\\times$30\") aim to protect 30% of land and ocean by 2030.",
        critiques:
          "Effectiveness and equity are contested: many \"paper parks\" lack enforcement; strict-exclusion models have displaced Indigenous communities; degazettement and downgrading are rising. Rights-based and community-led conservation are proposed correctives.",
        tags: ["conservation"],
        xref: ["governance"],
      },
      {
        name: "Invasive species",
        description: "Introduced species that spread and harm.",
        principle:
          "Non-native species that establish, proliferate, and damage ecosystems, economies, or health, often released from natural enemies; a leading cause of extinctions, especially on islands.",
        example: "Cane toad, zebra mussel, brown tree snake.",
        tags: ["conservation", "invasive"],
      },
      {
        name: "Restoration ecology & rewilding",
        description: "Repairing damaged ecosystems.",
        principle:
          "Actively assisting the recovery of degraded ecosystems (revegetation, reintroduction, hydrologic repair); rewilding restores ecological processes, often via keystone/trophic reintroductions.",
        example: "Wolf reintroduction; wetland restoration.",
        tags: ["conservation", "restoration"],
      },
      {
        name: "CITES & wildlife-trade regulation",
        description: "Governing trade in species.",
        principle:
          "The Convention on International Trade in Endangered Species regulates cross-border trade via appendices that ban or restrict commerce in threatened taxa.",
        tags: ["conservation"],
        xref: ["governance", "law"],
      },
      {
        name: "Payments for ecosystem services & offsets",
        description: "Market tools for conservation.",
        principle:
          "Paying landholders to maintain services (watershed protection, carbon storage) or requiring biodiversity offsets for development.",
        critiques:
          "Efficiency and legitimacy are debated: proponents argue markets align incentives with conservation; critics that offsets license destruction (no like-for-like replacement of unique ecosystems) and that monetizing non-market values crowds out intrinsic motivations. Additionality and permanence are chronic problems.",
        tags: ["conservation"],
        xref: ["finance", "economics"],
      },
    ],
  },

  // ── Family 9 ─ The Major Biogeochemical Cycles ─────────────────────────
  {
    slug: "biogeochemical-cycles",
    number: 9,
    name: "The Major Biogeochemical Cycles",
    blurb: "Carbon, nitrogen, phosphorus, sulfur, oxygen, water — reservoirs, fluxes, human perturbations.",
    section: "C",
    color: "amber",
    entries: [
      {
        name: "Biogeochemical cycle (concept)",
        description: "The circulation of an element.",
        principle:
          "The movement of a chemical element through biotic and abiotic reservoirs (atmosphere, hydrosphere, lithosphere, biosphere) via biological, geological, and chemical processes; gaseous cycles (C, N, O) have large atmospheric pools, sedimentary cycles (P, S) do not.",
        tags: ["biogeochemistry"],
      },
      {
        name: "Reservoirs, fluxes & residence time",
        description: "The accounting of a cycle.",
        formula: "\\tau = \\dfrac{M}{Q}",
        interpretation:
          "Reservoir mass $M$ divided by flux $Q$ through it — how long, on average, an atom stays in a pool; short for atmospheric water, long for deep-ocean carbon or crustal phosphorus.",
        tags: ["biogeochemistry"],
      },
      {
        name: "The carbon cycle",
        description: "Carbon through air, life, ocean, and rock.",
        principle:
          "Carbon moves among the atmosphere (CO2), biosphere (photosynthesis $\\leftrightarrow$ respiration), oceans (dissolution, the biological pump, carbonate), soils, and geologic reservoirs (fossil fuels, carbonate rock); the fast biological and slow geological cycles operate on vastly different timescales.",
        tags: ["biogeochemistry", "climate"],
        xref: ["chemistry"],
      },
      {
        name: "Photosynthesis & respiration (the biological carbon pump)",
        description: "Carbon's biological turnstile.",
        formula:
          "6\\,\\mathrm{CO_2} + 6\\,\\mathrm{H_2O} \\longrightarrow \\mathrm{C_6H_{12}O_6} + 6\\,\\mathrm{O_2}",
        interpretation:
          "Photosynthesis fixes atmospheric carbon into biomass; respiration reverses it. Near-balanced naturally, now offset by fossil emissions.",
        tags: ["biogeochemistry", "energy"],
        xref: ["chemistry", "physiology"],
      },
      {
        name: "Ocean carbon & the carbonate system",
        description: "The sea's vast carbon store.",
        principle:
          "The ocean holds ~50$\\times$ the atmosphere's carbon; CO2 dissolves and equilibrates among $\\mathrm{CO_2}$, $\\mathrm{HCO_3^-}$, and $\\mathrm{CO_3^{2-}}$; the solubility and biological pumps move carbon to depth.",
        tags: ["biogeochemistry"],
        xref: ["chemistry"],
      },
      {
        name: "Anthropogenic carbon perturbation",
        description: "Humans overloading the cycle.",
        principle:
          "Fossil-fuel combustion, cement, and land-use change transfer geologic carbon to the atmosphere faster than natural sinks absorb it, raising CO2 from ~280 ppm (pre-industrial) to ~430 ppm as of 2026; about half of emissions is taken up by ocean and land sinks.",
        tags: ["biogeochemistry", "climate"],
      },
      {
        name: "The nitrogen cycle",
        description: "The most human-altered cycle.",
        principle:
          "Nitrogen cycles through fixation (N2 $\\to$ ammonia), nitrification (ammonia $\\to$ nitrite $\\to$ nitrate), assimilation, ammonification, and denitrification (nitrate $\\to$ N2); atmospheric N2 is inert, so biological fixation gates the whole cycle.",
        tags: ["biogeochemistry"],
        xref: ["chemistry"],
      },
      {
        name: "Nitrogen fixation",
        description: "Making inert N2 usable.",
        principle:
          "Specialized bacteria (free-living and symbiotic, e.g. Rhizobium) and lightning convert atmospheric $\\mathrm{N_2}$ to biologically available ammonia; the Haber–Bosch process now fixes as much nitrogen industrially as all natural pathways combined.",
        tags: ["biogeochemistry"],
        xref: ["chemistry"],
      },
      {
        name: "Human nitrogen loading",
        description: "Doubling reactive nitrogen.",
        principle:
          "Synthetic fertilizer and combustion have roughly doubled the reactive nitrogen entering ecosystems, driving eutrophication, acid deposition, N2O emissions, and coastal dead zones — a planetary-boundary transgression.",
        tags: ["biogeochemistry", "pollution"],
      },
      {
        name: "The phosphorus cycle",
        description: "A slow, sedimentary cycle with no gas phase.",
        principle:
          "Phosphorus weathers from rock, is taken up by organisms, and returns to soils and sediments, ultimately to marine deposits uplifted over geologic time; having no significant atmospheric reservoir, it cycles slowly and is often the limiting nutrient.",
        tags: ["biogeochemistry"],
        xref: ["geology"],
      },
      {
        name: "The sulfur cycle",
        description: "Sulfur through rock, air, and life.",
        principle:
          "Sulfur moves via weathering, biological uptake, volcanic and biogenic emission (e.g. dimethyl sulfide), and deposition; SO2 from fossil fuels drives acid rain and, as sulfate aerosol, exerts a cooling influence.",
        tags: ["biogeochemistry", "pollution"],
        xref: ["chemistry"],
      },
      {
        name: "The oxygen cycle",
        description: "Atmospheric oxygen's balance.",
        principle:
          "Oxygen is produced by photosynthesis and consumed by respiration, combustion, and weathering; tightly coupled to the carbon cycle, with the modern ~21% atmosphere a legacy of the Great Oxidation Event.",
        tags: ["biogeochemistry"],
        xref: ["chemistry", "earth-sciences"],
      },
      {
        name: "The water (hydrologic) cycle",
        description: "The circulation of water.",
        principle:
          "Water moves via evaporation, transpiration, condensation, precipitation, infiltration, and runoff among ocean, atmosphere, ice, surface water, and groundwater; the master cycle that transports heat and other elements.",
        tags: ["biogeochemistry", "hydrology"],
        xref: ["earth-sciences"],
      },
      {
        name: "Nutrient limitation & the Redfield ratio",
        description: "What limits productivity.",
        formula: "\\mathrm{C:N:P} \\approx 106:16:1",
        interpretation:
          "Marine plankton show a characteristic atomic ratio (Redfield); deviations reveal which nutrient limits production. N and P are the usual limiting nutrients on land and in water respectively.",
        tags: ["biogeochemistry"],
        xref: ["chemistry"],
      },
    ],
  },

  // ── Family 10 ─ Climate System & the Greenhouse Effect ─────────────────
  {
    slug: "climate-system",
    number: 10,
    name: "Climate System & the Greenhouse Effect",
    blurb: "Energy balance, greenhouse gases, forcing, sensitivity, feedbacks — the physical machinery.",
    section: "D",
    color: "blue",
    entries: [
      {
        name: "Climate system",
        description: "Earth's coupled climate machinery.",
        principle:
          "The interacting atmosphere, hydrosphere, cryosphere, land surface, and biosphere, driven by solar energy and modulated by their exchanges of energy, water, and carbon; climate is the long-term statistics of weather.",
        tags: ["climate"],
        xref: ["earth-sciences"],
      },
      {
        name: "Weather vs climate",
        description: "Short-term vs long-term.",
        principle:
          "Weather is the atmospheric state now; climate is its distribution over decades (typically a 30-year average). A single cold day no more disproves warming than a single hot day proves it.",
        tags: ["climate"],
      },
      {
        name: "Earth's energy balance",
        description: "Incoming vs outgoing radiation.",
        formula:
          "\\dfrac{S(1-\\alpha)}{4} = \\sigma T_e^{4}",
        interpretation:
          "At equilibrium, absorbed solar $\\approx$ emitted longwave (solar constant $S$, albedo $\\alpha$, effective temperature $T_e$). A positive energy imbalance (currently the case) means the planet is accumulating heat.",
        tags: ["climate"],
        xref: ["physics"],
      },
      {
        name: "The greenhouse effect",
        description: "Why Earth is habitable.",
        principle:
          "Greenhouse gases are transparent to incoming sunlight but absorb and re-emit outgoing infrared, warming the surface ~33 $^\\circ$C above the airless blackbody value; a well-established radiative mechanism, not a hypothesis.",
        tags: ["climate"],
        xref: ["physics", "chemistry"],
      },
      {
        name: "Greenhouse gases",
        description: "The infrared-active gases.",
        principle:
          "Water vapor, CO2, methane (CH4), nitrous oxide (N2O), ozone, and halocarbons absorb infrared; water vapor is the largest natural contributor (and a feedback), while CO2 is the dominant long-lived driver of human-caused warming.",
        tags: ["climate"],
        xref: ["chemistry"],
      },
      {
        name: "Radiative forcing",
        description: "Perturbing the energy balance.",
        formula:
          "\\Delta F_{\\mathrm{CO_2}} \\approx 5.35\\,\\ln\\!\\left(\\dfrac{C}{C_0}\\right)\\ \\mathrm{W\\,m^{-2}}",
        interpretation:
          "The change in net radiative flux at the tropopause from an agent; positive forcing warms, negative cools. The common currency for comparing climate drivers.",
        tags: ["climate"],
        xref: ["physics"],
      },
      {
        name: "Global warming potential (GWP)",
        description: "Comparing greenhouse gases.",
        formula:
          "\\mathrm{GWP} = \\dfrac{\\int_0^{H} a_x\\,C_x(t)\\,dt}{\\int_0^{H} a_{\\mathrm{CO_2}}\\,C_{\\mathrm{CO_2}}(t)\\,dt}",
        interpretation:
          "Time-integrated forcing of a gas relative to CO2 over horizon $H$ (usually 100 yr). Methane's 100-yr GWP is ~28–30, N2O's ~265 — one tonne does far more warming than a tonne of CO2.",
        tags: ["climate"],
        xref: ["chemistry"],
      },
      {
        name: "Equilibrium climate sensitivity (ECS)",
        description: "Warming per CO2 doubling.",
        formula: "\\Delta T_{2\\times}\\ \\text{(K per CO}_2\\text{ doubling)}",
        interpretation:
          "The equilibrium global warming for a doubling of CO2; the IPCC AR6 likely range is ~2.5–4 $^\\circ$C (best estimate ~3 $^\\circ$C).",
        critiques:
          "The single most consequential and most uncertain number in climate science. Aerosol and cloud feedbacks dominate the residual uncertainty; recent 'hot models' with ECS > 5 $^\\circ$C are given lower weight by AR6 but the tail cannot be ruled out.",
        tags: ["climate"],
        xref: ["physics"],
        status: "contested",
      },
      {
        name: "Climate feedbacks",
        description: "Amplifiers and dampers.",
        principle:
          "Positive feedbacks amplify warming (water vapor, ice-albedo, permafrost carbon), negative ones damp it (increased longwave emission, some cloud responses); the net feedback (dominated by uncertain cloud effects) sets sensitivity.",
        tags: ["climate"],
      },
      {
        name: "Albedo & the ice-albedo feedback",
        description: "Reflectivity and its runaway.",
        formula:
          "\\alpha = \\dfrac{\\text{reflected solar}}{\\text{incident solar}}",
        interpretation:
          "Ice/snow have high $\\alpha$, open ocean low. Warming melts reflective ice, exposing dark surfaces that absorb more heat and warm further — a key polar amplifier.",
        tags: ["climate"],
        xref: ["physics"],
      },
      {
        name: "Aerosols & global dimming",
        description: "Particles that cool (mostly).",
        principle:
          "Atmospheric aerosols (sulfate, dust, soot) scatter and absorb sunlight and seed clouds; sulfate aerosols exert a net cooling that has masked part of greenhouse warming, making aerosol forcing the largest uncertainty in the forcing budget.",
        tags: ["climate", "pollution"],
      },
      {
        name: "Carbon budget & net-zero",
        description: "The emissions math of a temperature target.",
        principle:
          "Limiting warming to a target (e.g. 1.5 or 2 $^\\circ$C) implies a finite cumulative CO2 budget; because warming tracks cumulative emissions, stabilizing temperature requires reaching net-zero CO2. IPCC carbon-budget estimates are the reference.",
        tags: ["climate", "sustainability"],
      },
    ],
  },

  // ── Family 11 ─ Climate Change: Evidence, Projection & Impacts ─────────
  {
    slug: "climate-change-impacts",
    number: 11,
    name: "Climate Change: Evidence, Projection & Impacts",
    blurb: "Observations, attribution, models, and impacts — the mainstream scientific picture.",
    section: "D",
    color: "indigo",
    entries: [
      {
        name: "Anthropogenic climate change",
        description: "Human-caused warming of the climate system.",
        principle:
          "The scientific consensus, assessed by the IPCC, that observed warming since the mid-20th century is predominantly caused by human greenhouse-gas emissions; stated here as the mainstream position, not one side of a debate.",
        tags: ["climate"],
      },
      {
        name: "The instrumental temperature record",
        description: "Measured warming.",
        principle:
          "Global surface temperature has risen ~1.1–1.3 $^\\circ$C above pre-industrial levels, established by multiple independent datasets (land, ocean, satellite) that agree on the trend; recent years rank as the warmest in the instrumental era.",
        tags: ["climate"],
        xref: ["statistics"],
      },
      {
        name: "Paleoclimate proxies",
        description: "Reading past climates.",
        principle:
          "Ice cores, tree rings, sediments, corals, and boreholes reconstruct temperature and CO2 before instruments, showing today's CO2 and its rate of rise are unprecedented in hundreds of thousands to millions of years.",
        example: "The Vostok/EPICA ice-core CO2 record.",
        tags: ["climate"],
        xref: ["geology"],
      },
      {
        name: "Detection & attribution",
        description: "Fingerprinting the cause.",
        principle:
          "Statistical comparison of observed patterns with climate-model simulations (with and without human forcing) attributes observed warming to greenhouse gases — including diagnostic fingerprints like stratospheric cooling alongside surface warming.",
        tags: ["climate"],
        xref: ["statistics"],
      },
      {
        name: "Climate models (GCMs & ESMs)",
        description: "Simulating the climate system.",
        principle:
          "General-circulation and Earth-system models solve the physical equations of the coupled climate on a 3-D grid to project future change under emissions scenarios; validated against past and present climate.",
        tags: ["climate"],
        xref: ["statistics", "mathematics"],
      },
      {
        name: "Emissions scenarios (SSPs/RCPs)",
        description: "Plausible futures.",
        principle:
          "Shared Socioeconomic Pathways and Representative Concentration Pathways specify future emissions/forcing trajectories (from strong mitigation to high emissions) that drive model projections; they are scenarios, not predictions.",
        tags: ["climate"],
      },
      {
        name: "The IPCC & its assessments",
        description: "The global scientific synthesis.",
        principle:
          "The Intergovernmental Panel on Climate Change periodically assesses the peer-reviewed literature; AR6 (2021–2023) is the most recent completed assessment, and the AR7 cycle began in 2024 and is underway (WGII second lead-author meeting held May 2026).",
        tags: ["climate"],
        xref: ["governance"],
      },
      {
        name: "Ocean warming, acidification & deoxygenation",
        description: "The ocean's triple stress.",
        formula:
          "\\mathrm{CO_2 + H_2O \\rightleftharpoons H_2CO_3 \\rightleftharpoons H^+ + HCO_3^-}",
        interpretation:
          "The ocean has absorbed most excess heat and about a quarter of emitted CO2; acidification lowers pH as dissolved CO2 forms carbonic acid, and warming reduces oxygen solubility — together stressing marine life.",
        tags: ["climate"],
        xref: ["chemistry"],
      },
      {
        name: "Sea-level rise",
        description: "Rising oceans from heat and ice.",
        principle:
          "Seas rise from thermal expansion of warming water and from melting land ice (glaciers, Greenland, Antarctica); the rate is accelerating, threatening coasts and low-lying nations.",
        tags: ["climate"],
        xref: ["earth-sciences"],
      },
      {
        name: "Cryosphere loss",
        description: "Vanishing ice.",
        principle:
          "Shrinking sea ice, retreating glaciers, thawing permafrost, and ice-sheet mass loss are among the clearest signatures of warming and, via feedbacks (albedo, permafrost carbon), among its amplifiers.",
        tags: ["climate"],
      },
      {
        name: "Extreme events & attribution",
        description: "Warming's sharp edge.",
        principle:
          "Warming shifts the distribution of heatwaves, heavy precipitation, drought, and wildfire; extreme-event attribution quantifies how much human influence changed a given event's likelihood or intensity.",
        tags: ["climate"],
        xref: ["statistics"],
      },
      {
        name: "Climate tipping points",
        description: "Thresholds of abrupt change.",
        principle:
          "Elements of the climate system — ice sheets, the AMOC ocean circulation, permafrost, tropical forests, coral reefs — may cross thresholds into self-sustaining, hard-to-reverse change; their timing and reversibility are actively researched.",
        tags: ["climate"],
        status: "open",
      },
      {
        name: "Climate change and health",
        description: "The human toll.",
        principle:
          "Heat mortality, expanding vector-borne disease ranges, food and water insecurity, air-quality harm, and displacement translate physical change into population-health burden — the intersection with public health.",
        tags: ["climate"],
        xref: ["public-health"],
      },
      {
        name: "Ozone depletion & the Montreal Protocol",
        description: "A solved atmospheric problem (distinct from warming).",
        principle:
          "CFCs catalytically destroyed stratospheric ozone (the \"ozone hole\"); the Montreal Protocol phased them out and the layer is recovering — a rare successful global environmental treaty, and a separate issue from greenhouse warming.",
        tags: ["climate", "pollution"],
        xref: ["chemistry", "governance"],
        status: "resolved",
      },
    ],
  },

  // ── Family 12 ─ Environmental Chemistry ────────────────────────────────
  {
    slug: "environmental-chemistry",
    number: 12,
    name: "Environmental Chemistry",
    blurb: "The chemistry of the atmosphere, waters, soils, and their contaminants.",
    section: "E",
    color: "violet",
    entries: [
      {
        name: "Environmental chemistry",
        description: "Chemistry of the natural environment and its contamination.",
        principle:
          "The study of chemical species, reactions, and transport in air, water, soil, and living systems, including the sources, fate, and effects of pollutants.",
        tags: ["envchem"],
        xref: ["chemistry"],
      },
      {
        name: "Atmospheric chemistry",
        description: "Reactions in the air.",
        principle:
          "The composition and photochemistry of the atmosphere — oxidation by the hydroxyl radical, ozone formation and destruction, aerosol chemistry — governing air quality and the fate of trace gases.",
        tags: ["envchem"],
        xref: ["chemistry"],
      },
      {
        name: "Aquatic chemistry",
        description: "Chemistry of natural waters.",
        formula: "\\mathrm{pH} = -\\log_{10}[\\mathrm{H^+}]",
        interpretation:
          "The speciation, solubility, redox, and acid–base equilibria of natural waters control nutrient availability, contaminant mobility, and the carbonate/pH system.",
        tags: ["envchem", "hydrology"],
        xref: ["chemistry"],
      },
      {
        name: "Soil chemistry",
        description: "The chemistry of the pedosphere.",
        principle:
          "Cation-exchange capacity, pH, organic matter, and mineral weathering govern nutrient retention, contaminant binding, and fertility in soils.",
        tags: ["envchem", "soil"],
        xref: ["geology"],
      },
      {
        name: "Partitioning & environmental fate",
        description: "Where a chemical goes.",
        formula:
          "\\log K_{ow} = \\log\\!\\dfrac{[\\text{solute}]_{\\text{octanol}}}{[\\text{solute}]_{\\text{water}}}",
        interpretation:
          "A contaminant distributes among air, water, soil, sediment, and biota according to its properties; the octanol–water partition coefficient predicts a substance's tendency to bioaccumulate in fat.",
        tags: ["envchem"],
      },
      {
        name: "Persistence & degradation",
        description: "How long contaminants last.",
        principle:
          "Chemicals break down by photolysis, hydrolysis, and microbial metabolism at rates set by structure; persistent compounds resist degradation and accumulate — the \"P\" in POPs.",
        tags: ["envchem"],
      },
      {
        name: "Persistent organic pollutants (POPs)",
        description: "Long-lived, mobile, bioaccumulative toxicants.",
        principle:
          "Synthetic organics (e.g. legacy organochlorines, dioxins, PCBs) that resist breakdown, travel globally, and concentrate up food chains; controlled under the Stockholm Convention.",
        example: "PCBs, dioxins.",
        tags: ["envchem", "pollution"],
        xref: ["governance"],
      },
      {
        name: "Heavy metals",
        description: "Toxic persistent elements.",
        principle:
          "Elements such as lead, mercury, cadmium, and arsenic that are non-degradable, bioaccumulative, and toxic at low doses, often disrupting enzymes and the nervous system.",
        example: "Methylmercury biomagnifying in fish (Minamata).",
        tags: ["envchem", "pollution"],
        xref: ["public-health"],
      },
      {
        name: "Eutrophication",
        description: "Nutrient over-enrichment of water.",
        principle:
          "Excess nitrogen and phosphorus (from fertilizer, sewage, runoff) fuel algal blooms whose decay depletes oxygen, creating hypoxic \"dead zones\" and killing aquatic life.",
        example: "The Gulf of Mexico hypoxic zone.",
        tags: ["envchem", "pollution", "biogeochemistry"],
      },
      {
        name: "Acid deposition (acid rain)",
        description: "Acidifying pollution.",
        formula:
          "\\mathrm{SO_2 + H_2O \\rightarrow H_2SO_3},\\ \\ \\mathrm{2\\,H_2SO_3 + O_2 \\rightarrow 2\\,H_2SO_4}",
        interpretation:
          "SO2 and NOx from combustion form sulfuric and nitric acids that deposit downwind, acidifying lakes, soils, and forests.",
        tags: ["envchem", "pollution"],
        xref: ["chemistry"],
      },
      {
        name: "Photochemical smog & tropospheric ozone",
        description: "Sunlight-driven urban pollution.",
        principle:
          "NOx and volatile organic compounds react under sunlight to form ground-level ozone and other oxidants — harmful to lungs and crops, distinct from protective stratospheric ozone.",
        tags: ["envchem", "pollution"],
      },
      {
        name: "Emerging contaminants",
        description: "Newly recognized pollutants.",
        principle:
          "Substances of rising concern — PFAS (\"forever chemicals\"), microplastics, pharmaceuticals and personal-care products, endocrine disruptors — often unregulated, persistent, and biologically active at trace levels.",
        example: "PFOA/PFOS in drinking water.",
        tags: ["envchem", "pollution"],
        status: "open",
      },
    ],
  },
];
