import type { Family } from "./types";

export const FAMILIES_1_6: Family[] = [
  // ── Family 1 ─ Foundations & Organizing Concepts ────────────────────────
  {
    slug: "foundations",
    number: 1,
    name: "Foundations & Organizing Concepts",
    blurb: "The scales, factors, and organizing ideas that frame all of ecology.",
    section: "A",
    color: "green",
    entries: [
      {
        name: "Ecology",
        description: "The study of interactions between organisms and their environment.",
        principle:
          "Examines the distribution, abundance, and interrelations of organisms and the flows of energy and matter that connect them — from individuals to the biosphere. Whether ecology is a branch of biology or an independent integrative discipline is partly a matter of framing.",
        tags: ["foundations"],
        xref: ["biology"],
      },
      {
        name: "Levels of organization",
        description: "The nested scales of ecology.",
        principle:
          "Organism $\\to$ population $\\to$ community $\\to$ ecosystem $\\to$ landscape $\\to$ biome $\\to$ biosphere; each level has emergent properties not reducible to the one below.",
        tags: ["foundations"],
      },
      {
        name: "Biotic vs abiotic factors",
        description: "The living and non-living environment.",
        principle:
          "Biotic factors are the effects of other organisms (competition, predation, disease); abiotic factors are physical/chemical conditions (temperature, light, water, nutrients, pH) that set the stage for life.",
        tags: ["foundations"],
      },
      {
        name: "Habitat vs niche",
        description: "Address vs profession.",
        principle:
          "A habitat is the physical place an organism lives; a niche is its full role — the multidimensional set of conditions and resources it uses and its functional position in the community.",
        tags: ["foundations"],
      },
      {
        name: "Ecological niche (Hutchinson)",
        description: "The n-dimensional hypervolume.",
        principle:
          "The niche is the set of environmental conditions and resources within which a population can persist; the fundamental niche is the physiological potential, the realized niche the smaller space left after competition and other interactions.",
        tags: ["foundations"],
      },
      {
        name: "Tolerance & limiting factors",
        description: "What bounds a species' range.",
        principle:
          "Each species has a range of tolerance for every environmental variable, with an optimum and stress zones; Liebig's law of the minimum holds that growth is limited by the single scarcest essential resource, and Shelford's law of tolerance by whichever factor is nearest its limit.",
        tags: ["foundations"],
      },
      {
        name: "Ecological gradients & zonation",
        description: "Ordered change across space.",
        principle:
          "Environmental gradients (altitude, latitude, depth, moisture) produce orderly turnover in community composition, as in intertidal zonation or elevational vegetation bands.",
        tags: ["foundations"],
      },
      {
        name: "Biosphere, biome & ecozone",
        description: "The largest ecological units.",
        principle:
          "The biosphere is the global sum of living systems; biomes are broad climate-defined community types (tropical forest, tundra, desert); ecozones/realms group biotas by biogeographic history.",
        tags: ["foundations"],
        xref: ["earth-sciences"],
      },
      {
        name: "Ecological energetics",
        description: "Life as an energy-processing system.",
        principle:
          "Ecosystems are open thermodynamic systems that capture, store, and dissipate energy; the second law dictates losses at every transfer, so energy flows one way while matter cycles.",
        tags: ["foundations"],
        xref: ["physics"],
      },
      {
        name: "Homeostasis & feedback in ecosystems",
        description: "Self-regulation.",
        principle:
          "Negative feedbacks (predator–prey coupling, density dependence) tend to stabilize systems around dynamic equilibria, while positive feedbacks can amplify change toward new states.",
        tags: ["foundations"],
      },
    ],
  },

  // ── Family 2 ─ Population Ecology ────────────────────────────────────────
  {
    slug: "population-ecology",
    number: 2,
    name: "Population Ecology",
    blurb: "How groups of one species grow, decline, and are regulated over time and space.",
    section: "A",
    color: "emerald",
    entries: [
      {
        name: "Population",
        description: "A group of interbreeding individuals of one species.",
        principle:
          "The unit of ecology and evolution, characterized by size, density, dispersion, age structure, and rates of birth, death, immigration, and emigration.",
        tags: ["population"],
      },
      {
        name: "Population density & dispersion",
        description: "How many and how arranged.",
        formula: "D = \\dfrac{N}{A}",
        interpretation:
          "Density is abundance per unit area/volume ($N$ individuals per area $A$); dispersion (clumped, uniform, or random) describes the spatial pattern and reflects resource distribution and social behavior.",
        tags: ["population"],
      },
      {
        name: "Exponential (geometric) growth",
        description: "Unbounded increase.",
        formula: "\\dfrac{dN}{dt} = rN,\\qquad N_t = N_0 e^{rt}",
        interpretation:
          "$r$ is the intrinsic rate of increase; $r > 0$ implies accelerating growth with no resource limit — a short-run or invasion approximation.",
        example: "Bacteria in fresh medium.",
        tags: ["population", "growth"],
      },
      {
        name: "Logistic growth & carrying capacity",
        description: "Growth that saturates.",
        formula: "\\dfrac{dN}{dt} = rN\\left(1 - \\dfrac{N}{K}\\right)",
        interpretation:
          "Growth is fastest at $N = K/2$ and stops at $N = K$; the sigmoid curve is the classic bounded-growth model.",
        example: "Yeast in a closed flask.",
        tags: ["population", "growth"],
      },
      {
        name: "Carrying capacity (K)",
        description: "The environment's sustainable ceiling.",
        formula: "K",
        interpretation:
          "The population size the environment can indefinitely support given resources — the stable equilibrium of the logistic model. Not fixed: shifts with resource supply, disturbance, and degradation.",
        tags: ["population"],
      },
      {
        name: "Intrinsic rate of increase (r)",
        description: "Maximum per-capita growth.",
        formula: "r = b - d",
        interpretation:
          "Per-capita birth minus death rate under ideal conditions; $r_{\\max}$ is the biotic potential. High-$r$ species rebound fast; low-$r$ species recover slowly from decline.",
        tags: ["population"],
      },
      {
        name: "r/K selection",
        description: "Two life-history strategies.",
        principle:
          "r-strategists maximize reproduction in unstable/empty environments (many small offspring, little care — insects, weeds); K-strategists invest in few well-provisioned offspring near carrying capacity (large mammals, trees). A spectrum and a simplification, largely superseded by fuller life-history theory.",
        tags: ["population", "life-history"],
      },
      {
        name: "Density-dependent vs density-independent regulation",
        description: "What limits populations.",
        principle:
          "Density-dependent factors (competition, predation, disease) intensify as density rises and regulate toward $K$; density-independent factors (weather, catastrophe) affect the same fraction regardless of density.",
        tags: ["population"],
      },
      {
        name: "Life tables & survivorship curves",
        description: "Age-specific mortality.",
        principle:
          "Life tables tabulate survival and mortality by age; the three idealized survivorship curves are Type I (high late-life mortality — humans), Type II (constant — many birds), Type III (high early mortality — most fish/insects).",
        tags: ["population"],
        xref: ["statistics"],
      },
      {
        name: "Age structure & demographic transition",
        description: "Population by age.",
        principle:
          "The distribution of ages (via a population pyramid) predicts future growth; expansive pyramids signal rapid growth, constrictive ones decline.",
        tags: ["population", "demography"],
        xref: ["public-health"],
      },
      {
        name: "Metapopulation",
        description: "A population of populations.",
        principle:
          "Spatially separated subpopulations linked by dispersal, persisting regionally through a balance of local extinction and recolonization even as individual patches wink out.",
        example: "Levins' model; butterflies in fragmented meadows.",
        tags: ["population", "spatial"],
      },
      {
        name: "Source–sink dynamics",
        description: "Unequal patches.",
        principle:
          "Source habitats produce a surplus that disperses to sink habitats where deaths exceed births; sinks persist only through immigration, complicating habitat valuation.",
        tags: ["population", "spatial"],
      },
      {
        name: "Allee effect",
        description: "Too few to thrive.",
        principle:
          "Below a threshold density, per-capita growth falls (mates are hard to find, group defense fails), so small populations can spiral to extinction — a key concern in conservation.",
        tags: ["population", "conservation"],
      },
      {
        name: "Population viability & extinction risk",
        description: "Will it persist?",
        principle:
          "Population viability analysis (PVA) models demographic and environmental stochasticity to estimate extinction probability over a time horizon and the minimum viable population size.",
        tags: ["population", "conservation"],
        xref: ["statistics"],
      },
    ],
  },

  // ── Family 3 ─ Species Interactions ─────────────────────────────────────
  {
    slug: "species-interactions",
    number: 3,
    name: "Species Interactions",
    blurb: "The +/-/0 web of effects between species — competition, predation, mutualism.",
    section: "A",
    color: "emerald",
    entries: [
      {
        name: "Species interactions (overview)",
        description: "The ways populations affect each other.",
        principle:
          "Interactions are classified by their sign for each partner — competition (−/−), predation/parasitism/herbivory (+/−), mutualism (+/+), commensalism (+/0), amensalism (−/0).",
        tags: ["interactions"],
      },
      {
        name: "Competition (intra- vs interspecific)",
        description: "Shared limiting resources.",
        principle:
          "Organisms vying for the same limiting resource depress each other's growth; intraspecific competition (within a species) drives density dependence, interspecific (between species) can exclude or partition.",
        tags: ["interactions"],
      },
      {
        name: "Competitive exclusion (Gause's principle)",
        description: "No two coexist on one niche.",
        principle:
          "Two species with identical resource requirements cannot stably coexist; one outcompetes the other unless niches differ.",
        example: "Gause's Paramecium experiments.",
        tags: ["interactions"],
      },
      {
        name: "Resource partitioning & niche differentiation",
        description: "Coexistence by dividing.",
        principle:
          "Competing species persist together by using resources differently in space, time, or kind, reducing overlap.",
        example: "MacArthur's warblers foraging in different parts of the same tree.",
        tags: ["interactions"],
      },
      {
        name: "Lotka–Volterra competition",
        description: "Two-species competition dynamics.",
        formula:
          "\\dfrac{dN_1}{dt} = r_1 N_1\\,\\dfrac{K_1 - N_1 - \\alpha_{12} N_2}{K_1}",
        interpretation:
          "Symmetric equation for $N_2$; $\\alpha_{12}$ is the competition coefficient. The outcome (coexistence or exclusion) depends on the $\\alpha$'s and $K$'s.",
        tags: ["interactions", "model"],
      },
      {
        name: "Predator–prey (Lotka–Volterra) dynamics",
        description: "Coupled oscillation.",
        formula:
          "\\dfrac{dN}{dt} = rN - aNP,\\quad \\dfrac{dP}{dt} = baNP - mP",
        interpretation:
          "Prey $N$, predator $P$. Predicts out-of-phase population cycles.",
        example: "The lynx–hare cycle in Hudson's Bay records.",
        tags: ["interactions", "model"],
      },
      {
        name: "Functional & numerical response",
        description: "How predators react to prey.",
        principle:
          "The functional response is how an individual predator's kill rate changes with prey density (Holling Types I/II/III, saturating via handling time); the numerical response is how predator numbers change.",
        tags: ["interactions"],
      },
      {
        name: "Predation & top-down control",
        description: "Consumers structuring communities.",
        principle:
          "Predators can regulate prey abundance and, indirectly, whole communities; removing them can trigger prey outbreaks and cascades.",
        tags: ["interactions"],
      },
      {
        name: "Herbivory & plant defenses",
        description: "Eating producers.",
        principle:
          "Herbivores consume plant tissue; plants counter with mechanical (thorns) and chemical (toxins, tannins) defenses, driving coevolutionary arms races.",
        tags: ["interactions", "coevolution"],
      },
      {
        name: "Parasitism & host–parasite dynamics",
        description: "Living at another's expense.",
        principle:
          "Parasites derive resources from a host they harm but usually do not immediately kill; host–parasite systems coevolve and can regulate host populations.",
        example: "Myxoma virus and rabbits.",
        tags: ["interactions"],
        xref: ["public-health"],
      },
      {
        name: "Mutualism",
        description: "Both partners benefit.",
        principle:
          "Interactions with net benefit to both species, from obligate (each needs the other) to facultative; the currency is resources, protection, or transport.",
        example: "Mycorrhizae, pollination, coral–zooxanthellae.",
        tags: ["interactions"],
      },
      {
        name: "Commensalism & amensalism",
        description: "One-sided interactions.",
        principle:
          "Commensalism benefits one partner with no effect on the other (epiphytes on trees); amensalism harms one with no effect on the other (allelopathy, trampling).",
        tags: ["interactions"],
      },
      {
        name: "Symbiosis",
        description: "Living together intimately.",
        principle:
          "A close, long-term physical association between species; encompasses mutualism, commensalism, and parasitism depending on the balance of costs and benefits.",
        tags: ["interactions"],
      },
      {
        name: "Keystone species",
        description: "Disproportionate influence.",
        principle:
          "A species whose impact on community structure far exceeds its abundance; its removal restructures or collapses the system.",
        example: "Sea otters controlling urchins and sustaining kelp forests.",
        tags: ["interactions", "conservation"],
      },
      {
        name: "Coevolution",
        description: "Reciprocal evolutionary change.",
        principle:
          "Interacting species impose selection on each other, producing matched adaptations — predator–prey arms races, plant–pollinator specialization, host–parasite escalation.",
        tags: ["interactions"],
        xref: ["biology"],
      },
    ],
  },

  // ── Family 4 ─ Community Ecology ────────────────────────────────────────
  {
    slug: "community-ecology",
    number: 4,
    name: "Community Ecology",
    blurb: "The structure, diversity, and networks of the co-occurring species in a place.",
    section: "A",
    color: "teal",
    entries: [
      {
        name: "Community",
        description: "All the interacting populations in an area.",
        principle:
          "The assemblage of species co-occurring and interacting in a place; described by composition, diversity, structure, and the network of interactions among members. Where the community/ecosystem boundary falls is partly conventional.",
        tags: ["community"],
      },
      {
        name: "Community structure",
        description: "The organization of an assemblage.",
        principle:
          "The identities, relative abundances, and interaction network of species; includes trophic structure, spatial layering (stratification), and dominance.",
        tags: ["community"],
      },
      {
        name: "Foundation species & ecosystem engineers",
        description: "Habitat-builders.",
        principle:
          "Foundation species (corals, kelp, trees) create physical structure that others depend on; ecosystem engineers (beavers, earthworms) modify the environment, altering resource availability for the whole community.",
        tags: ["community"],
      },
      {
        name: "Trophic structure & food chains",
        description: "Who eats whom, in a line.",
        principle:
          "A food chain is a linear sequence of energy transfer from producers through successive consumers; most energy is lost as heat at each step, limiting chain length.",
        tags: ["community", "energy"],
      },
      {
        name: "Food webs",
        description: "The network of feeding links.",
        principle:
          "Real communities are interconnected webs, not chains; a species usually feeds at several levels, and the web's connectance and structure govern stability and the spread of perturbations.",
        tags: ["community", "energy"],
      },
      {
        name: "Trophic cascade",
        description: "Indirect effects rippling down levels.",
        principle:
          "A change at one trophic level propagates through the web — e.g. removing top predators releases herbivores, which suppress plants (a top-down cascade).",
        example: "Wolves $\\to$ elk $\\to$ willow/aspen recovery in Yellowstone.",
        tags: ["community", "energy"],
      },
      {
        name: "Ecological guild",
        description: "Species using resources similarly.",
        principle:
          "A group of species exploiting the same class of resources in similar ways, regardless of taxonomy; guilds are the natural units of competition.",
        example: "Nectar-feeding birds and insects.",
        tags: ["community"],
      },
      {
        name: "Species richness & evenness",
        description: "Two components of diversity.",
        principle:
          "Richness is the number of species present; evenness is how equally abundances are spread among them; diversity indices combine both.",
        tags: ["community", "biodiversity"],
      },
      {
        name: "Rank–abundance & dominance",
        description: "The abundance structure.",
        principle:
          "Communities typically have a few common and many rare species; rank–abundance (Whittaker) plots and dominance indices summarize this skew.",
        tags: ["community", "biodiversity"],
      },
      {
        name: "Ecotone & edge effects",
        description: "Boundaries between communities.",
        principle:
          "An ecotone is the transition zone where two communities meet, often richer (the edge effect); habitat fragmentation multiplies edges, favoring generalists over interior specialists.",
        tags: ["community"],
      },
      {
        name: "Intermediate disturbance hypothesis",
        description: "Diversity peaks in the middle.",
        principle:
          "Species diversity is often highest at intermediate frequencies/intensities of disturbance — enough to prevent competitive monopoly, not so much as to exclude all but pioneers.",
        tags: ["community", "disturbance"],
      },
      {
        name: "Assembly rules & community neutral theory",
        description: "What determines who is present.",
        principle:
          "Niche-based assembly rules hold that deterministic filters (environment, competition) shape communities; the neutral theory counters that chance dispersal and drift among ecologically equivalent species suffice — an active debate.",
        tags: ["community"],
        status: "open",
      },
    ],
  },

  // ── Family 5 ─ Ecosystem Ecology ────────────────────────────────────────
  {
    slug: "ecosystem-ecology",
    number: 5,
    name: "Ecosystem Ecology",
    blurb: "Energy flow, productivity, and the succession/stability of biotic + abiotic systems.",
    section: "A",
    color: "teal",
    entries: [
      {
        name: "Ecosystem",
        description: "A community plus its physical environment.",
        principle:
          "The biotic community together with the abiotic environment, viewed as an interacting system through which energy flows and matter cycles; the level at which productivity and nutrient budgets are defined.",
        tags: ["ecosystem"],
      },
      {
        name: "Energy flow & the trophic pyramid",
        description: "One-way energy through levels.",
        principle:
          "Energy enters as sunlight fixed by producers and flows up trophic levels, dissipating as heat at each transfer; the pyramid of energy always narrows upward.",
        tags: ["ecosystem", "energy"],
      },
      {
        name: "Ten-percent law (trophic efficiency)",
        description: "Energy lost between levels.",
        formula:
          "\\eta_{\\text{trophic}} = \\dfrac{P_{n+1}}{P_n} \\approx 10\\%",
        interpretation:
          "Only ~10% of energy at one level becomes biomass at the next, limiting food chains to ~4–5 links.",
        tags: ["ecosystem", "energy"],
      },
      {
        name: "Primary production (GPP & NPP)",
        description: "Energy fixed by producers.",
        formula: "\\mathrm{NPP} = \\mathrm{GPP} - R_a",
        interpretation:
          "Net = gross primary production minus autotrophic respiration; NPP is the energy available to the rest of the ecosystem and varies enormously by biome.",
        example: "Rainforests and estuaries are highly productive; deserts and open ocean low.",
        tags: ["ecosystem", "energy"],
      },
      {
        name: "Secondary production",
        description: "Consumer biomass gain.",
        principle:
          "The rate at which consumers build new biomass from assimilated food; low compared with primary production because of respiration and assimilation losses.",
        tags: ["ecosystem", "energy"],
      },
      {
        name: "Ecological efficiency",
        description: "Fractions of energy passed on.",
        principle:
          "The product of consumption, assimilation, and production efficiencies determines how much energy moves between levels; ectotherms are more production-efficient than endotherms.",
        tags: ["ecosystem", "energy"],
        xref: ["physiology"],
      },
      {
        name: "Standing crop & biomass pyramids",
        description: "Living mass at each level.",
        principle:
          "The biomass present at a moment; usually pyramid-shaped, but can invert where fast-growing producers (phytoplankton) support larger consumer standing stocks.",
        tags: ["ecosystem"],
      },
      {
        name: "Nutrient cycling in ecosystems",
        description: "Matter reused, unlike energy.",
        principle:
          "Nutrients cycle repeatedly between organisms and the abiotic environment (uptake, transfer through the web, decomposition, release), in contrast to the one-way flow of energy.",
        tags: ["ecosystem", "biogeochemistry"],
      },
      {
        name: "Decomposition & detritus food web",
        description: "The recycling engine.",
        principle:
          "Detritivores and decomposers break dead organic matter into inorganic nutrients, closing cycles; most ecosystem energy actually flows through the detrital, not the grazing, pathway.",
        tags: ["ecosystem", "energy"],
      },
      {
        name: "Ecosystem services",
        description: "Nature's benefits to people.",
        principle:
          "Provisioning (food, water, timber), regulating (climate, flood, pollination), supporting (soil formation, nutrient cycling), and cultural services; a framework linking ecology to human welfare.",
        critiques:
          "Whether and how to monetize services is contested — critics argue some values are incommensurable and pricing corrupts them; proponents that undervaluation is the alternative and worse.",
        tags: ["ecosystem", "sustainability"],
        xref: ["economics"],
      },
      {
        name: "Ecological stability, resistance & resilience",
        description: "Responses to disturbance.",
        principle:
          "Resistance is how much a system withstands disturbance; resilience is how fast it returns; stability blends both. High diversity often (not always) buffers function.",
        tags: ["ecosystem"],
      },
      {
        name: "Regime shifts & tipping points",
        description: "Abrupt state change.",
        principle:
          "Ecosystems can flip suddenly to an alternative stable state when a threshold is crossed, often with hysteresis (hard to reverse).",
        example: "Clear lakes flipping to turbid eutrophic states; coral-to-algal reef shifts.",
        tags: ["ecosystem", "climate"],
      },
      {
        name: "Ecological succession",
        description: "Directional community change over time.",
        principle:
          "The orderly change in community composition after disturbance — primary succession on bare substrate (lava, glacial till) via pioneer species, secondary on disturbed but soil-bearing sites (old fields, burns).",
        tags: ["ecosystem", "succession"],
      },
      {
        name: "Climax community & alternatives",
        description: "The endpoint debate.",
        principle:
          "Classical theory posited a stable climax community determined by climate (Clements); the individualistic (Gleason) and non-equilibrium views hold that succession is contingent and disturbance-driven with no fixed endpoint.",
        critiques:
          "A foundational, unresolved dispute — the Clementsian climax is now widely seen as an idealization, but disturbance-based views vary on how deterministic succession is.",
        tags: ["ecosystem", "succession"],
        status: "contested",
      },
    ],
  },

  // ── Family 6 ─ Biodiversity & Its Measurement ───────────────────────────
  {
    slug: "biodiversity",
    number: 6,
    name: "Biodiversity & Its Measurement",
    blurb: "Diversity as richness, evenness, and turnover — with the metrics that quantify each.",
    section: "B",
    color: "teal",
    entries: [
      {
        name: "Biodiversity",
        description: "The variety of life at all levels.",
        principle:
          "The diversity of genes, species, and ecosystems; underpins ecosystem function and resilience and is the central object of conservation. Tracked at global scale via the IUCN Red List and GBIF occurrence records.",
        tags: ["biodiversity"],
      },
      {
        name: "Genetic, species & ecosystem diversity",
        description: "Three nested levels.",
        principle:
          "Genetic diversity (within-species variation, the raw material of adaptation); species diversity (variety of species); ecosystem diversity (variety of habitats and processes).",
        tags: ["biodiversity"],
      },
      {
        name: "Species richness (S)",
        description: "The simplest diversity measure.",
        formula: "S = \\#\\{\\text{species observed}\\}",
        interpretation:
          "Intuitive but scale- and effort-dependent, and blind to abundance; needs rarefaction to compare unequal samples.",
        tags: ["biodiversity"],
        xref: ["statistics"],
      },
      {
        name: "Shannon diversity index (H')",
        description: "Richness weighted by evenness.",
        formula: "H' = -\\sum_{i} p_i \\ln p_i",
        interpretation:
          "$p_i$ is the proportion of species $i$; higher $H'$ means more species and/or more even abundances; sensitive to rare species.",
        tags: ["biodiversity"],
        xref: ["statistics"],
      },
      {
        name: "Simpson's index (D)",
        description: "Dominance-weighted diversity.",
        formula: "D = \\sum_{i} p_i^{2}",
        interpretation:
          "Dominance; diversity is reported as $1 - D$ or $1/D$. $D$ is the probability that two random individuals are the same species; emphasizes common species.",
        tags: ["biodiversity"],
        xref: ["statistics"],
      },
      {
        name: "Evenness (Pielou's J)",
        description: "How equal the abundances are.",
        formula: "J = \\dfrac{H'}{\\ln S}",
        interpretation:
          "Shannon diversity relative to its maximum; $J$ near 1 means abundances nearly equal; near 0 means one species dominates.",
        tags: ["biodiversity"],
        xref: ["statistics"],
      },
      {
        name: "Alpha, beta & gamma diversity",
        description: "Diversity across scales.",
        formula: "\\gamma \\approx \\alpha \\times \\beta",
        interpretation:
          "Whittaker's partition: $\\alpha$ = local (within-site) diversity, $\\gamma$ = regional diversity, $\\beta$ = turnover between sites. High $\\beta$ means communities differ strongly across space.",
        tags: ["biodiversity"],
      },
      {
        name: "Species–area relationship",
        description: "More area, more species.",
        formula: "S = c A^{z},\\qquad \\log S = \\log c + z\\log A",
        interpretation:
          "With $z$ typically ~0.2–0.35; a steeper $z$ means faster species accumulation with area; the basis of extinction estimates from habitat loss.",
        tags: ["biodiversity", "biogeography"],
      },
      {
        name: "Rarefaction & extrapolation",
        description: "Fair diversity comparison.",
        principle:
          "Because richness rises with sampling effort, rarefaction down-samples larger collections (and coverage-based methods extrapolate) so diversity is compared at equal effort or completeness.",
        tags: ["biodiversity"],
        xref: ["statistics"],
      },
      {
        name: "Endemism & biodiversity hotspots",
        description: "Concentrated, irreplaceable diversity.",
        principle:
          "Endemic species occur nowhere else; hotspots are regions with exceptional endemism under heavy threat (the Myers criteria: >1,500 endemic plants and >70% habitat lost) — priorities for conservation.",
        example: "Madagascar, the Cerrado, the Cape Floristic Region.",
        tags: ["biodiversity", "conservation"],
      },
      {
        name: "Functional & phylogenetic diversity",
        description: "Beyond counting species.",
        principle:
          "Functional diversity measures the range of ecological roles (traits) present; phylogenetic diversity measures the evolutionary breadth spanned — both can matter more for function than raw richness.",
        tags: ["biodiversity"],
        xref: ["biology"],
      },
      {
        name: "Latitudinal diversity gradient",
        description: "More species toward the tropics.",
        principle:
          "Species richness generally rises from poles to equator for most taxa — one of ecology's oldest patterns, with contested explanations (energy, area, time, evolutionary rates).",
        tags: ["biodiversity", "biogeography"],
        status: "open",
      },
    ],
  },
];
