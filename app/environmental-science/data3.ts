import type { Family } from "./types";

export const FAMILIES_13_18: Family[] = [
  // ── Family 13 ─ Pollution & Environmental Toxicology ────────────────────
  {
    slug: "pollution-toxicology",
    number: 13,
    name: "Pollution & Environmental Toxicology",
    blurb: "Contaminants by medium, dose–response, bioaccumulation, and risk assessment.",
    section: "E",
    color: "violet",
    entries: [
      {
        name: "Pollution (concept)",
        description: "Harmful contamination of the environment.",
        principle:
          "The introduction of substances or energy (chemical, thermal, noise, light, radiological) at levels that harm ecosystems, resources, or health; classified by medium (air, water, soil) and by point vs non-point source.",
        tags: ["pollution"],
      },
      {
        name: "Point vs non-point source pollution",
        description: "Pipe vs diffuse.",
        principle:
          "Point sources discharge from a single identifiable location (a pipe, a stack) and are easier to regulate; non-point pollution is diffuse runoff (agriculture, urban streets) and is the harder, larger problem.",
        tags: ["pollution"],
      },
      {
        name: "Air pollution & criteria pollutants",
        description: "Contaminants of the air.",
        principle:
          "Regulated \"criteria\" pollutants — particulate matter (PM2.5/PM10), ozone, NOx, SO2, CO, and lead — cause cardiorespiratory disease and ecological harm; PM2.5 is the deadliest globally. Tracked by the WHO air-quality database and the Global Burden of Disease.",
        tags: ["pollution"],
        xref: ["public-health"],
      },
      {
        name: "Particulate matter (PM2.5/PM10)",
        description: "Airborne particles by size.",
        formula:
          "\\mathrm{PM_{2.5}} \\le 2.5\\ \\mu\\mathrm{m},\\quad \\mathrm{PM_{10}} \\le 10\\ \\mu\\mathrm{m}",
        interpretation:
          "Diameter categories in micrometers (10$^{-6}$ m). Smaller particles penetrate deeper into the lungs and bloodstream, so PM2.5 drives most health burden.",
        tags: ["pollution"],
        xref: ["public-health"],
      },
      {
        name: "Water pollution",
        description: "Contamination of water bodies.",
        principle:
          "Pathogens, nutrients, sediments, metals, organics, and thermal loads degrade freshwater and marine systems; measured by indicators such as dissolved oxygen and biochemical oxygen demand (BOD — the oxygen consumed by microbes degrading organic matter over 5 days).",
        tags: ["pollution", "hydrology"],
      },
      {
        name: "Soil & land contamination",
        description: "Polluted ground.",
        principle:
          "Industrial chemicals, metals, pesticides, and waste contaminate soils, threatening food safety, groundwater, and ecosystems; remediated by containment, extraction, or bioremediation.",
        tags: ["pollution", "soil"],
      },
      {
        name: "Plastic pollution & microplastics",
        description: "Persistent synthetic debris.",
        principle:
          "Durable plastics accumulate in oceans, soils, and organisms; fragmenting into microplastics (<5 mm) that pervade food webs and whose long-term effects are still being characterized.",
        example: "Ocean gyre garbage patches.",
        tags: ["pollution"],
        status: "open",
      },
      {
        name: "Environmental toxicology (ecotoxicology)",
        description: "How pollutants harm organisms.",
        principle:
          "The study of the effects of toxic agents on organisms and ecosystems — uptake, distribution, mechanism of toxicity, and population/community consequences; supplies the hazard side of risk assessment.",
        tags: ["toxicology"],
        xref: ["public-health"],
      },
      {
        name: "Dose–response relationship",
        description: "Effect rising with exposure.",
        principle:
          "Toxic effect scales with dose; the central tenet (\"the dose makes the poison\") underlies standard-setting, with threshold models for most toxicants and linear-no-threshold assumed for carcinogens and radiation. A monotone gradient strengthens causal inference.",
        tags: ["toxicology"],
        xref: ["public-health"],
      },
      {
        name: "LD50 / LC50 & toxicity metrics",
        description: "Quantifying acute toxicity.",
        formula:
          "\\mathrm{LD_{50}}:\\ \\text{dose lethal to } 50\\% \\text{ of a test population}",
        interpretation:
          "LC50 uses concentration instead of dose. Lower LD50 means more acutely toxic; a comparative, not a \"safe-dose,\" measure.",
        tags: ["toxicology"],
      },
      {
        name: "Bioaccumulation & biomagnification",
        description: "Toxins concentrating in food webs.",
        principle:
          "Bioaccumulation is buildup of a persistent substance within an organism faster than it is excreted; biomagnification is its increasing concentration at successive trophic levels.",
        example: "DDT thinning raptor eggshells; mercury in top predators.",
        tags: ["toxicology", "energy"],
      },
      {
        name: "Endocrine disruptors",
        description: "Chemicals that mimic hormones.",
        principle:
          "Substances that interfere with hormonal signaling at low doses, affecting development and reproduction, sometimes with non-monotonic dose responses that complicate regulation.",
        example: "Bisphenol A, certain pesticides.",
        tags: ["toxicology"],
        status: "open",
      },
      {
        name: "Risk assessment (4-step)",
        description: "From hazard to policy.",
        principle:
          "Hazard identification $\\to$ dose–response assessment $\\to$ exposure assessment $\\to$ risk characterization; the formal framework translating toxicology and exposure science into standards and cleanup decisions.",
        tags: ["toxicology", "policy"],
      },
      {
        name: "Environmental justice",
        description: "Unequal pollution burdens.",
        principle:
          "Environmental hazards fall disproportionately on poor and marginalized communities; a determinant of health inequity and a growing focus of policy and law.",
        tags: ["pollution"],
        xref: ["sociology", "public-health"],
      },
    ],
  },

  // ── Family 14 ─ Soil, Land & the Terrestrial Environment ────────────────
  {
    slug: "soil-land",
    number: 14,
    name: "Soil, Land & the Terrestrial Environment",
    blurb: "The pedosphere, land-use change, and the terrestrial systems that support life.",
    section: "F",
    color: "amber",
    entries: [
      {
        name: "Pedosphere & soil formation",
        description: "The living skin of the land.",
        principle:
          "Soil forms over long timescales from parent rock through weathering and biological activity; the classic factors are climate, organisms, relief (topography), parent material, and time (CLORPT).",
        tags: ["soil"],
        xref: ["geology"],
      },
      {
        name: "Soil horizons & the soil profile",
        description: "Layered soil structure.",
        principle:
          "Soils develop horizons (O organic, A topsoil, B subsoil, C parent material) that record formation processes and govern fertility, drainage, and root depth.",
        tags: ["soil"],
      },
      {
        name: "Soil texture & structure",
        description: "The physical makeup of soil.",
        principle:
          "The proportions of sand, silt, and clay (texture) and their aggregation (structure) determine water-holding capacity, aeration, and workability; loams balance the extremes.",
        tags: ["soil"],
      },
      {
        name: "Soil fertility & nutrient retention",
        description: "Soil's capacity to support growth.",
        principle:
          "Cation-exchange capacity, organic matter, pH, and microbial activity govern nutrient availability; the soil is the terrestrial pivot of the nutrient cycles.",
        tags: ["soil", "biogeochemistry"],
      },
      {
        name: "Soil degradation, erosion & desertification",
        description: "Losing productive land.",
        principle:
          "Erosion (wind, water), salinization, compaction, nutrient depletion, and desertification degrade soils faster than they form, threatening food security.",
        example: "The 1930s Dust Bowl.",
        tags: ["soil", "sustainability"],
      },
      {
        name: "Land use & land-cover change",
        description: "Reshaping the surface.",
        principle:
          "Conversion of land (deforestation, agriculture, urbanization) is a primary driver of biodiversity loss and a significant source of greenhouse emissions; tracked by remote sensing.",
        tags: ["land", "climate"],
        xref: ["earth-sciences"],
      },
      {
        name: "Deforestation & afforestation",
        description: "Losing and planting forests.",
        principle:
          "Forest clearing releases stored carbon and destroys habitat, while afforestation/reforestation can sequester carbon and restore function — though tree-planting is no substitute for cutting emissions or protecting intact forest.",
        tags: ["land", "climate", "sustainability"],
      },
      {
        name: "Wetlands & their functions",
        description: "Water-saturated land.",
        principle:
          "Marshes, swamps, bogs, and mangroves store carbon, buffer floods, filter water, and harbor high biodiversity; among the most valuable and most rapidly lost ecosystems.",
        tags: ["land", "hydrology"],
      },
      {
        name: "Terrestrial biomes (physical basis)",
        description: "The land's great vegetation belts.",
        principle:
          "The distribution of forests, grasslands, deserts, and tundra follows the physical environment (temperature, precipitation, seasonality, soils), linking climate to ecosystem type.",
        tags: ["land", "biogeography", "climate"],
      },
    ],
  },

  // ── Family 15 ─ Water, Oceans & the Hydrosphere ────────────────────────
  {
    slug: "water-oceans",
    number: 15,
    name: "Water, Oceans & the Hydrosphere",
    blurb: "Watersheds, groundwater, oceans, and the freshwater/marine systems in crisis.",
    section: "F",
    color: "sky",
    entries: [
      {
        name: "Hydrology & the water balance",
        description: "The accounting of water.",
        formula: "P = Q + ET + \\Delta S",
        interpretation:
          "The catchment water balance: precipitation = runoff + evapotranspiration + change in storage. Partitions incoming water among streamflow, atmospheric return, and storage.",
        tags: ["hydrology"],
        xref: ["earth-sciences"],
      },
      {
        name: "Watersheds & drainage basins",
        description: "The unit of hydrology.",
        principle:
          "The land area draining to a common outlet; the natural management unit for water quality and quantity, integrating everything upstream.",
        tags: ["hydrology"],
      },
      {
        name: "Groundwater & aquifers",
        description: "Water beneath the surface.",
        principle:
          "Water stored in permeable rock and sediment; a vital freshwater source whose over-extraction (mining) lowers water tables, causes subsidence, and can permanently reduce storage.",
        example: "The Ogallala Aquifer.",
        tags: ["hydrology"],
        xref: ["geology"],
      },
      {
        name: "Surface water & freshwater ecosystems",
        description: "Rivers, lakes, and streams.",
        principle:
          "Flowing (lotic) and standing (lentic) freshwaters, structured by flow, light, nutrients, and connectivity; disproportionately biodiverse and disproportionately threatened.",
        tags: ["hydrology"],
      },
      {
        name: "Oceanography (physical)",
        description: "The physics of the sea.",
        principle:
          "The study of ocean currents, temperature and salinity structure, tides, and waves; the ocean stores and redistributes heat, driving climate.",
        tags: ["ocean"],
        xref: ["earth-sciences"],
      },
      {
        name: "Thermohaline & wind-driven circulation",
        description: "The ocean conveyor.",
        principle:
          "Density differences (temperature and salinity) drive deep overturning circulation (including the AMOC), while winds drive surface gyres; together they transport heat poleward and ventilate the deep sea.",
        tags: ["ocean", "climate"],
      },
      {
        name: "Marine ecosystems & productivity",
        description: "Life in the sea.",
        principle:
          "From sunlit surface waters to the deep sea, marine systems are structured by light, nutrients, and upwelling; coastal upwelling zones and shelves are the ocean's productive hotspots.",
        tags: ["ocean", "ecosystem"],
      },
      {
        name: "Coral reefs & their crisis",
        description: "Biodiverse, threatened marine structures.",
        principle:
          "Coral–algae symbioses build the ocean's most diverse ecosystems; warming-driven bleaching, acidification, and pollution threaten them with collapse — a bellwether of ocean stress.",
        tags: ["ocean", "climate"],
      },
      {
        name: "Estuaries & coastal systems",
        description: "Where rivers meet the sea.",
        principle:
          "Highly productive transition zones (estuaries, salt marshes, mangroves) that nurse fisheries, filter pollutants, and buffer storms, while concentrating human pressure.",
        tags: ["ocean", "land"],
      },
      {
        name: "Water scarcity & the water–energy–food nexus",
        description: "Competing demands on water.",
        principle:
          "Freshwater is unevenly distributed and increasingly stressed by population, agriculture, and climate; water, energy, and food systems are tightly coupled, so managing one affects the others.",
        tags: ["hydrology", "sustainability"],
        xref: ["economics"],
      },
    ],
  },

  // ── Family 16 ─ Earth as a System ──────────────────────────────────────
  {
    slug: "earth-as-a-system",
    number: 16,
    name: "Earth as a System",
    blurb: "Coupled spheres, planetary boundaries, deep-time change, and the Anthropocene debate.",
    section: "F",
    color: "indigo",
    entries: [
      {
        name: "Earth-system science",
        description: "The planet as interacting spheres.",
        principle:
          "The integrated study of the atmosphere, hydrosphere, cryosphere, geosphere, and biosphere as a single coupled system with feedbacks; the framework within which global change is understood.",
        tags: ["earthsystem"],
        xref: ["earth-sciences"],
      },
      {
        name: "The spheres (atmosphere, hydrosphere, lithosphere, biosphere, cryosphere)",
        description: "Earth's major subsystems.",
        principle:
          "The classical division of the Earth system into interacting reservoirs of air, water, rock, life, and ice, exchanging energy and matter across their boundaries.",
        tags: ["earthsystem"],
        xref: ["earth-sciences"],
      },
      {
        name: "Biogeochemistry as Earth-system coupling",
        description: "Life and geology intertwined.",
        principle:
          "Organisms shape planetary chemistry (oxygen, carbon, nutrients) while geology shapes life; the cycles are the connective tissue linking the spheres.",
        tags: ["earthsystem", "biogeochemistry"],
      },
      {
        name: "The Gaia hypothesis",
        description: "Life regulating the planet.",
        principle:
          "Lovelock and Margulis's proposal that the biota and environment form a self-regulating system maintaining habitability; influential and heuristically useful, but its stronger \"planet as organism\" claims remain contested.",
        critiques:
          "Weak Gaia (biota influence planetary chemistry) is uncontroversial. Strong Gaia (biota actively regulate for habitability) faces objections from evolutionary theory — natural selection acts on individuals, not planets. Present the debate; don't adjudicate.",
        tags: ["earthsystem"],
        xref: ["biology"],
        status: "contested",
      },
      {
        name: "Planetary boundaries",
        description: "A safe operating space for humanity.",
        principle:
          "The Rockström/Steffen framework identifies ~9 Earth-system processes (climate, biosphere integrity, nutrient flows, land use, freshwater, ocean acidification, novel entities, etc.) with thresholds humanity should not cross; several are assessed as already transgressed.",
        tags: ["earthsystem", "sustainability"],
      },
      {
        name: "The Anthropocene",
        description: "A human-dominated epoch?",
        principle:
          "The proposal that human activity now rivals geological forces, warranting a new epoch; the informal concept is widely used, but the formal stratigraphic proposal (with a mid-20th-century GSSP) was rejected by the geological body in 2024 — a live definitional dispute.",
        tags: ["earthsystem"],
        xref: ["geology"],
        status: "contested",
      },
      {
        name: "Great Oxidation Event & Earth history",
        description: "How the biosphere remade the planet.",
        principle:
          "Cyanobacterial photosynthesis oxygenated the atmosphere ~2.4 billion years ago, transforming surface chemistry and enabling complex life — the deep-time archetype of life reshaping Earth.",
        tags: ["earthsystem"],
        xref: ["earth-sciences", "geology"],
      },
      {
        name: "Milankovitch cycles & natural climate variability",
        description: "Orbital pacing of climate.",
        principle:
          "Cyclic variations in Earth's orbit (eccentricity, obliquity, precession) pace the ice ages over tens of thousands of years; natural variability (solar, volcanic, orbital) is real and well-understood — and distinct from, and far slower than, the current human-driven change.",
        tags: ["earthsystem", "climate"],
        xref: ["astronomy"],
      },
      {
        name: "Remote sensing & Earth observation",
        description: "Watching the planet from above.",
        principle:
          "Satellites and sensors monitor land cover, temperature, ice, vegetation, and pollution globally, providing the data backbone for environmental monitoring and climate science.",
        tags: ["earthsystem"],
        xref: ["statistics"],
      },
    ],
  },

  // ── Family 17 ─ Sustainability & Environmental Economics ────────────────
  {
    slug: "sustainability-economics",
    number: 17,
    name: "Sustainability & Environmental Economics",
    blurb: "Natural capital, externalities, discounting, carbon pricing, and the degrowth debate.",
    section: "G",
    color: "rose",
    entries: [
      {
        name: "Sustainability",
        description: "Meeting present needs without foreclosing the future.",
        principle:
          "The Brundtland definition — development that meets the needs of the present without compromising the ability of future generations to meet theirs; balancing environmental, social, and economic goals.",
        tags: ["sustainability"],
      },
      {
        name: "Sustainable development & the SDGs",
        description: "Development within limits.",
        principle:
          "The reconciliation of economic development, social inclusion, and environmental protection, operationalized globally by the UN Sustainable Development Goals and their indicators.",
        tags: ["sustainability"],
        xref: ["governance"],
      },
      {
        name: "Weak vs strong sustainability",
        description: "Is natural capital substitutable?",
        principle:
          "Weak sustainability holds that human-made capital can substitute for natural capital (only total capital need be maintained); strong sustainability holds that critical natural capital is irreplaceable and must be preserved — a foundational divide.",
        tags: ["sustainability"],
        xref: ["economics"],
        status: "contested",
      },
      {
        name: "Natural capital & ecosystem-service valuation",
        description: "Pricing nature.",
        principle:
          "Treating ecosystems as capital assets yielding service flows, and estimating their economic value to inform decisions.",
        critiques:
          "Proponents argue valuation prevents undervaluation and makes trade-offs explicit. Critics argue some values (existence, sacred, intrinsic) resist and are corrupted by monetization; imputed prices can crowd out non-market motivations and legitimate destruction of what is deemed cheap.",
        tags: ["sustainability"],
        xref: ["economics", "finance"],
      },
      {
        name: "Externalities & environmental economics",
        description: "Costs outside the market.",
        formula:
          "\\text{Pigovian tax}\\ t^{*} = \\text{marginal external damage}",
        interpretation:
          "A negative externality imposes a social cost the polluter does not pay, so private cost < social cost and the good is overproduced; efficiency requires internalizing it (e.g. a Pigovian tax equal to marginal external damage).",
        tags: ["sustainability"],
        xref: ["economics"],
      },
      {
        name: "Tragedy of the commons",
        description: "Overexploitation of shared resources.",
        principle:
          "Individually rational use of an open-access resource leads to collective ruin (Hardin); solutions include property rights, regulation, or — per Ostrom — community self-governance of the commons.",
        example: "Overfishing; shared pasture.",
        tags: ["sustainability"],
        xref: ["economics", "governance"],
      },
      {
        name: "Social cost of carbon & the discount rate",
        description: "Pricing future climate damage.",
        formula:
          "\\mathrm{SCC} = \\sum_{t=0}^{T} \\dfrac{D_t}{(1+r)^{t}}",
        interpretation:
          "Present value of damages from one additional tonne of CO2; hinges critically on the discount rate $r$ applied to future harm. A lower $r$ values future generations more and yields a higher SCC.",
        critiques:
          "A genuine ethical and economic dispute. Stern (2007) argued a near-zero pure time preference is ethically required, giving a high SCC; Nordhaus and others argue market discount rates already reflect intergenerational trade-offs, giving a lower SCC. Both positions are defended in the mainstream literature.",
        tags: ["sustainability"],
        xref: ["economics", "finance"],
        status: "contested",
      },
      {
        name: "Carbon pricing (tax vs cap-and-trade)",
        description: "Putting a price on emissions.",
        principle:
          "A carbon tax sets the price and lets quantity adjust; cap-and-trade sets the quantity and lets the market price emit permits.",
        critiques:
          "Which is preferable — and how to set the level — is contested. Taxes give price certainty (better for investment) but no emissions guarantee; caps give emissions certainty but volatile prices. Weitzman's rule: prefer taxes when marginal damages are flat, caps when steep. Real-world designs (EU ETS, California) mix both.",
        example: "The EU Emissions Trading System.",
        tags: ["sustainability"],
        xref: ["economics", "finance"],
      },
      {
        name: "Environmental Kuznets curve",
        description: "Does growth eventually clean up?",
        principle:
          "The hypothesis that pollution rises then falls as income grows (an inverted U); empirically supported for some local pollutants but not for CO2 or biodiversity — a contested generalization.",
        tags: ["sustainability"],
        xref: ["economics"],
        status: "contested",
      },
      {
        name: "Circular economy",
        description: "Designing out waste.",
        principle:
          "An economic model that keeps materials in use through reuse, repair, remanufacturing, and recycling, contrasted with the linear \"take–make–dispose\" model.",
        tags: ["sustainability"],
      },
      {
        name: "Life-cycle assessment (LCA)",
        description: "Cradle-to-grave impact accounting.",
        principle:
          "A standardized method quantifying the environmental impacts of a product or process across its whole life cycle (extraction $\\to$ production $\\to$ use $\\to$ disposal), to compare options and avoid burden-shifting.",
        tags: ["sustainability"],
      },
      {
        name: "Ecological footprint & carrying capacity of humanity",
        description: "Human demand vs biocapacity.",
        principle:
          "The ecological footprint measures human resource use in \"global hectares\"; overshoot occurs when the footprint exceeds Earth's biocapacity. Humanity is currently in overshoot, using resources faster than they regenerate.",
        tags: ["sustainability"],
      },
      {
        name: "Degrowth vs green growth",
        description: "Two visions of a sustainable economy.",
        principle:
          "Green growth holds that technology and efficiency can decouple growth from environmental harm; degrowth argues that endless growth on a finite planet is impossible and that rich economies must scale down throughput.",
        critiques:
          "A fundamental, unresolved debate. Green-growth proponents point to relative decoupling in some rich economies and to renewables' falling cost curves; degrowth advocates argue absolute decoupling at the required rate is empirically absent and that GDP is a poor welfare measure. Post-growth and doughnut-economics frameworks stake out middle positions.",
        tags: ["sustainability"],
        xref: ["economics"],
        status: "contested",
      },
    ],
  },

  // ── Family 18 ─ Environmental Policy, Law & Management ─────────────────
  {
    slug: "policy-law",
    number: 18,
    name: "Environmental Policy, Law & Management",
    blurb: "Precautionary principle, regulatory design, treaties, energy transition, and geoengineering.",
    section: "G",
    color: "rose",
    entries: [
      {
        name: "Environmental policy",
        description: "Public action on the environment.",
        principle:
          "The body of government commitments, laws, and programs addressing environmental problems, balancing competing interests under scientific uncertainty.",
        tags: ["policy"],
        xref: ["governance"],
      },
      {
        name: "The precautionary principle",
        description: "Act under uncertainty.",
        principle:
          "Where an activity threatens serious or irreversible harm, lack of full scientific certainty should not postpone cost-effective preventive measures; shifts the burden toward caution.",
        critiques:
          "Its stringency and application are contested. Strong forms (require proof of safety before action) can block beneficial innovation; weak forms are criticized as tautological. Where it applies, who bears the burden of proof, and what counts as \"cost-effective\" are all disputed.",
        tags: ["policy"],
      },
      {
        name: "Polluter-pays principle",
        description: "Internalizing the cost of harm.",
        principle:
          "Those who cause pollution should bear the cost of managing it, to prevent harm and remediate damage — a foundational principle of environmental law and taxation.",
        tags: ["policy"],
        xref: ["economics"],
      },
      {
        name: "Command-and-control vs market-based instruments",
        description: "Two regulatory styles.",
        principle:
          "Command-and-control sets legal standards and limits (technology or performance based); market-based instruments (taxes, tradable permits, subsidies) harness price signals — a longstanding debate over efficiency vs certainty.",
        tags: ["policy"],
        xref: ["economics"],
      },
      {
        name: "Environmental impact assessment (EIA)",
        description: "Look before you build.",
        principle:
          "A formal process evaluating the likely environmental effects of a proposed project before approval, mandating disclosure and consideration of alternatives.",
        example: "Required under the US NEPA and equivalents worldwide.",
        tags: ["policy"],
        xref: ["law"],
      },
      {
        name: "Cost–benefit analysis in environmental policy",
        description: "Weighing costs against benefits.",
        formula:
          "\\mathrm{NPV} = \\sum_{t=0}^{T} \\dfrac{B_t - C_t}{(1+r)^{t}}",
        interpretation:
          "Compare the present value of a policy's benefits and costs (net present value, benefit–cost ratio); contentious for the environment because valuing non-market goods and discounting the future involve deep value judgments.",
        tags: ["policy"],
        xref: ["economics"],
      },
      {
        name: "Major environmental legislation",
        description: "Landmark domestic laws.",
        principle:
          "Statutes such as the US Clean Air Act, Clean Water Act, and Endangered Species Act established standards, permitting, and enforcement that shaped environmental protection; analogues exist across jurisdictions.",
        tags: ["policy"],
        xref: ["law", "governance"],
      },
      {
        name: "International environmental agreements",
        description: "Governing shared problems across borders.",
        principle:
          "Treaties addressing transboundary and global commons problems — the Montreal Protocol (ozone), the UNFCCC/Kyoto/Paris regime (climate), the Convention on Biological Diversity, and CITES (wildlife trade).",
        tags: ["policy"],
        xref: ["governance", "law"],
      },
      {
        name: "The Paris Agreement & climate governance",
        description: "The global climate framework.",
        principle:
          "The 2015 treaty under the UNFCCC in which countries pledge nationally determined contributions toward holding warming \"well below 2 $^\\circ$C\" and pursuing 1.5 $^\\circ$C; progress is reviewed at the annual Conference of the Parties (COP). COP30 (Belém, Brazil, Nov 2025) delivered a climate-finance push toward the $1.3 trillion/yr-by-2035 goal and a Just Transition mechanism, but no formal fossil-fuel phase-out roadmap.",
        tags: ["policy"],
        xref: ["governance"],
      },
      {
        name: "Environmental governance & institutions",
        description: "Who decides and enforces.",
        principle:
          "The actors and arrangements — governments, international bodies (UNEP), NGOs, firms, and communities — that make and implement environmental decisions across scales; effectiveness depends on monitoring, compliance, and legitimacy.",
        tags: ["policy"],
        xref: ["governance"],
      },
      {
        name: "Renewable energy & the energy transition",
        description: "Decarbonizing the energy system.",
        principle:
          "The shift from fossil fuels to low-carbon sources (solar, wind, hydro, geothermal, and — contested — nuclear); the central lever for climate mitigation, reshaping the electricity, transport, and industrial systems.",
        critiques:
          "Nuclear's classification as \"clean/sustainable\" is disputed. Proponents point to its low lifecycle emissions and firm dispatchable output; critics to waste, cost overruns, proliferation risk, and the opportunity cost vs cheaper renewables. Similar disputes surround large hydro, biomass, and CCS.",
        tags: ["policy", "sustainability"],
        xref: ["engineering"],
        status: "contested",
      },
      {
        name: "Climate mitigation vs adaptation",
        description: "Two responses to climate change.",
        principle:
          "Mitigation reduces the extent of change by cutting emissions and enhancing sinks; adaptation reduces harm from the change that occurs; both are needed, and their balance and financing are contested.",
        tags: ["policy", "climate"],
      },
      {
        name: "Geoengineering (SRM & CDR)",
        description: "Deliberate large-scale climate intervention.",
        principle:
          "Proposed interventions to counter warming — carbon dioxide removal (afforestation, direct air capture, enhanced weathering) and solar radiation management (stratospheric aerosols, cloud brightening); SRM especially is scientifically uncertain, governance-poor, and ethically fraught.",
        critiques:
          "Deeply contested. CDR at climate-relevant scale is unproven and land/energy intensive; relying on it in scenarios can license delay (moral hazard). SRM would mask warming without addressing CO2, has poorly-known regional effects, faces termination-shock risk if stopped, and has no adequate governance regime. A minority argue research is essential given warming trajectories; a broader view holds that deployment would be premature and destabilizing.",
        tags: ["policy", "climate", "sustainability"],
        status: "contested",
      },
      {
        name: "Resource management & the maximum sustainable yield",
        description: "Harvesting renewables without depletion.",
        formula: "\\mathrm{MSY} = \\dfrac{rK}{4}\\ \\text{at}\\ N = K/2",
        interpretation:
          "Under logistic growth, maximum sustainable yield occurs at half carrying capacity — the largest catch/harvest indefinitely sustainable. Overestimating it (or ignoring stochasticity) is a classic path to fishery collapse.",
        example: "The collapse of the Atlantic cod fishery.",
        tags: ["policy", "sustainability"],
        xref: ["economics"],
      },
    ],
  },
];
