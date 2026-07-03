// ── Materials Science Taxonomy — Types + Families 1-4 (Foundations) ────────

export type Section = "A" | "B" | "C" | "D";

export type TetrahedronVertex =
  | "structure"
  | "property"
  | "processing"
  | "performance"
  | "processing→structure"
  | "structure→property"
  | "processing→performance"
  | "property→performance"
  | "structure→processing"
  | "all";

export type Concept = {
  name: string;
  description: string;
  tags: string[];
  statement: string; // core definition/law — use $...$ for LaTeX
  prerequisites: { parents: string[]; divergence: string };
  keyResults: string[];
  tetrahedron: TetrahedronVertex;
  example: string;
  principalCritiques?: string[];
  flagged?: boolean;
};

export type ColorKey =
  | "slate"
  | "blue"
  | "indigo"
  | "purple"
  | "green"
  | "emerald"
  | "teal"
  | "amber"
  | "orange"
  | "cyan"
  | "rose"
  | "yellow"
  | "stone";

export type Family = {
  slug: string;
  number: number;
  name: string;
  blurb: string;
  section: Section;
  color: ColorKey;
  concepts: Concept[];
};

// ── Family 1 — Materials Paradigm ───────────────────────────────────────────

const MATERIALS_PARADIGM: Family = {
  slug: "materials-paradigm",
  number: 1,
  name: "Materials Paradigm",
  blurb: "The materials tetrahedron and the organizing principles of the field.",
  section: "A",
  color: "slate",
  concepts: [
    {
      name: "The materials tetrahedron",
      description: "The central organizing framework of materials science: structure, property, processing, performance.",
      tags: ["paradigm", "framework"],
      statement: "Materials science is organized around four interconnected vertices — structure, properties, processing, and performance — linked by characterization and modeling. Every materials question maps onto this tetrahedron.",
      prerequisites: { parents: [], divergence: "root — the foundational paradigm of the discipline" },
      keyResults: [
        "All materials questions can be framed as relationships between two or more vertices",
        "Processing determines structure; structure determines properties; properties determine performance",
        "Characterization and modeling connect vertices bidirectionally",
      ],
      tetrahedron: "all",
      example: "Heat-treating a steel (processing) changes its microstructure (structure), which alters hardness and toughness (properties), which determines whether it survives as a gear in service (performance).",
    },
    {
      name: "Structure–property relationships",
      description: "The link between a material's internal arrangement and its measurable behavior.",
      tags: ["paradigm", "structure", "property"],
      statement: "A material's properties are determined by its structure at every length scale — from electronic and atomic bonding through crystal structure, defects, microstructure, and macroscale geometry.",
      prerequisites: { parents: ["The materials tetrahedron"], divergence: "the most-studied edge of the tetrahedron" },
      keyResults: [
        "Same composition can yield vastly different properties depending on structure (e.g. diamond vs graphite)",
        "Properties can be tuned by controlling structure at each length scale",
      ],
      tetrahedron: "structure→property",
      example: "Carbon arranged as diamond (sp3 tetrahedral network) is the hardest known natural material; as graphite (sp2 layered sheets) it is one of the softest.",
    },
    {
      name: "Processing–structure relationships",
      description: "How fabrication and treatment steps control internal structure.",
      tags: ["paradigm", "processing", "structure"],
      statement: "The processing route — temperature, pressure, strain rate, atmosphere, cooling rate — determines the resulting structure at every scale, from crystal phase to grain size to defect density.",
      prerequisites: { parents: ["The materials tetrahedron"], divergence: "the engineer's lever: change processing to change structure" },
      keyResults: [
        "Rapid quenching can produce metastable phases (martensite, metallic glasses)",
        "Annealing temperature and time control grain size and defect density",
        "Additive manufacturing creates structures impossible by traditional routes",
      ],
      tetrahedron: "processing→structure",
      example: "Quenching austenitic steel from above 727 C produces hard martensite; slow furnace cooling produces soft pearlite. Same composition, different processing, vastly different structure.",
    },
    {
      name: "Length scales in materials",
      description: "Materials structure spans from sub-angstrom (electronic) to meters (component).",
      tags: ["paradigm", "multiscale"],
      statement: "Materials structure is organized hierarchically across length scales: electronic ($< 1$ A), atomic bonding (~1-3 A), crystal structure (~3-10 A), defects and dislocations (~nm), grains and phases (~$\\mu$m), and macroscale components (~mm-m).",
      prerequisites: { parents: ["The materials tetrahedron"], divergence: "the multi-scale nature of structure" },
      keyResults: [
        "Different characterization tools probe different length scales (TEM for nm, optical microscopy for um, XRD for atomic)",
        "Properties can be dominated by features at any scale",
        "Computational methods (DFT, MD, FEA) map to different length scales",
      ],
      tetrahedron: "structure",
      example: "A turbine blade's performance depends on single-crystal orientation (atomic), gamma-prime precipitate size (nm), grain boundary carbides (um), and blade geometry (cm).",
    },
    {
      name: "Classes of materials",
      description: "The five traditional classes: metals, ceramics, polymers, composites, and electronic materials.",
      tags: ["paradigm", "classification"],
      statement: "Materials are traditionally classified by bonding and structure into metals (metallic bonds, ductile, conductive), ceramics (ionic/covalent, hard, brittle, insulating), polymers (covalent chains + van der Waals, flexible, low density), composites (engineered combinations), and electronic/functional materials (semiconductors, piezoelectrics).",
      prerequisites: { parents: ["The materials tetrahedron"], divergence: "classification by dominant bonding type" },
      keyResults: [
        "Each class has characteristic property ranges (elastic modulus, conductivity, density)",
        "Modern materials increasingly blur class boundaries (metallic glasses, conductive polymers)",
        "Ashby charts visualize property ranges across classes",
      ],
      tetrahedron: "structure→property",
      example: "Ashby's modulus-density chart shows metals clustered at high density/high modulus, polymers at low/low, ceramics at moderate density/very high modulus, and composites spanning the gaps.",
    },
  ],
};

// ── Family 2 — Chemical Bonding ─────────────────────────────────────────────

const CHEMICAL_BONDING: Family = {
  slug: "chemical-bonding",
  number: 2,
  name: "Chemical Bonding",
  blurb: "The atomic-scale forces that hold materials together and determine their fundamental character.",
  section: "A",
  color: "blue",
  concepts: [
    {
      name: "Chemical bonding overview",
      description: "The spectrum of primary and secondary bonds that hold atoms together in solids.",
      tags: ["bonding", "fundamentals"],
      statement: "All material properties ultimately derive from the nature and strength of the bonds between atoms. Primary bonds (metallic, ionic, covalent) involve valence electrons and have energies of 1-10 eV/bond; secondary bonds (van der Waals, hydrogen) involve dipole interactions at 0.01-0.5 eV/bond.",
      prerequisites: { parents: ["Classes of materials"], divergence: "the atomic-level origin of material classes" },
      keyResults: [
        "Bond type determines melting point, elastic modulus, electrical and thermal conductivity",
        "Most real materials exhibit mixed bonding character",
        "Bond energy sets the cohesive energy and thermal expansion coefficient",
      ],
      tetrahedron: "structure",
      example: "Diamond (pure covalent, 7.4 eV/bond) melts at ~3550 C; ice (hydrogen bonds, ~0.2 eV/bond) melts at 0 C. Bond energy scales directly with melting point.",
    },
    {
      name: "Metallic bond",
      description: "Delocalized electron sea shared among positive ion cores.",
      tags: ["bonding", "metals"],
      statement: "In metallic bonding, valence electrons are delocalized into a shared electron gas (the 'sea of electrons') surrounding positive ion cores. This non-directional bonding allows atoms to slide past each other (ductility) and electrons to move freely (electrical/thermal conductivity).",
      prerequisites: { parents: ["Chemical bonding overview"], divergence: "non-directional bonding giving rise to metallic properties" },
      keyResults: [
        "Explains high electrical and thermal conductivity",
        "Non-directional nature explains ductility and malleability",
        "Metallic luster arises from free-electron interaction with light",
      ],
      tetrahedron: "structure→property",
      example: "Copper's high electrical conductivity (~5.96 x 10^7 S/m) arises from its single loosely-bound 4s electron contributing to the delocalized electron sea.",
    },
    {
      name: "Ionic bond",
      description: "Electrostatic attraction between oppositely charged ions formed by electron transfer.",
      tags: ["bonding", "ceramics"],
      statement: "Ionic bonding involves electron transfer from an electropositive atom to an electronegative atom, creating cations and anions held together by Coulombic attraction. The Madelung energy gives the total lattice energy: $E_{lattice} \\propto A \\cdot z^+ z^- / r_0$ where $A$ is the Madelung constant.",
      prerequisites: { parents: ["Chemical bonding overview"], divergence: "charge transfer and Coulombic attraction" },
      keyResults: [
        "Non-directional but specific coordination requirements (radius ratio rules)",
        "High melting points but brittle — displacing ions creates like-charge repulsion",
        "Electrically insulating as solids, conductive as melts or in solution",
      ],
      tetrahedron: "structure→property",
      example: "NaCl has a lattice energy of 786 kJ/mol and melts at 801 C. The Madelung constant for the rock salt structure is 1.748.",
    },
    {
      name: "Covalent bond",
      description: "Shared electron pairs in directional orbitals between atoms.",
      tags: ["bonding", "semiconductors"],
      statement: "Covalent bonding involves the sharing of electron pairs between atoms in highly directional orbitals. The directionality imposes specific bond angles and coordination numbers, producing open structures with low packing efficiency but extreme hardness when three-dimensionally networked.",
      prerequisites: { parents: ["Chemical bonding overview"], divergence: "directional shared-electron bonding" },
      keyResults: [
        "Directionality explains specific crystal structures (diamond cubic, zinc blende)",
        "3D networks (diamond, SiC) are extremely hard; molecules (N2) have weak intermolecular forces",
        "Band gaps arise from covalent bonding — basis of semiconductor behavior",
      ],
      tetrahedron: "structure→property",
      example: "Silicon's diamond-cubic structure with sp3 hybridization produces a band gap of 1.12 eV at 300 K, making it the foundation of the semiconductor industry.",
    },
    {
      name: "Van der Waals bonds",
      description: "Weak secondary bonds from fluctuating or permanent electric dipoles.",
      tags: ["bonding", "polymers"],
      statement: "Van der Waals forces arise from three mechanisms: London dispersion (fluctuating dipoles, universal), Keesom (permanent dipole-dipole), and Debye (induced dipole). Energies are typically 0.01-0.1 eV/bond. Hydrogen bonds (0.1-0.5 eV) are a special strong case involving H bonded to N, O, or F.",
      prerequisites: { parents: ["Chemical bonding overview"], divergence: "weak secondary interactions that dominate polymer and molecular crystal behavior" },
      keyResults: [
        "Dominate interchain bonding in polymers — determine Tg and Tm",
        "Responsible for the layered nature of graphite, MoS2",
        "Hydrogen bonds give water its anomalous properties",
      ],
      tetrahedron: "structure→property",
      example: "Polyethylene chains are covalently bonded internally but held together by van der Waals forces, giving it a low melting point (~135 C) despite strong C-C backbone bonds.",
    },
    {
      name: "Mixed bonding",
      description: "Most real materials exhibit bonding that combines multiple types.",
      tags: ["bonding", "advanced"],
      statement: "Real materials rarely exhibit pure bonding types. The bonding character is a continuum: GaAs is partially ionic (~30%) and partially covalent; transition metal carbides combine metallic, ionic, and covalent character. The Ketelaar triangle maps compounds in the metallic-ionic-covalent space by electronegativity difference and average electronegativity.",
      prerequisites: { parents: ["Metallic bond", "Ionic bond", "Covalent bond"], divergence: "real materials are mixtures of ideal bonding types" },
      keyResults: [
        "Electronegativity difference predicts ionic/covalent ratio (Pauling scale)",
        "Transition metal compounds often have all three bonding types simultaneously",
        "Mixed bonding explains intermediate properties (e.g., TiC is hard yet electrically conductive)",
      ],
      tetrahedron: "structure→property",
      example: "TiC has metallic conductivity, extreme hardness (2800 HV), and a high melting point (3067 C) because Ti-C bonds are simultaneously metallic (d-electrons), covalent (sp-hybridization), and ionic (electronegativity difference ~1.0).",
    },
    {
      name: "Binding energy & interatomic potential",
      description: "The energy-distance curve that determines equilibrium spacing, bond stiffness, and thermal expansion.",
      tags: ["bonding", "thermomechanical"],
      statement: "The interatomic potential $U(r)$ has an attractive term ($\\propto -1/r^n$) and a repulsive term ($\\propto 1/r^m$, $m > n$). The equilibrium spacing $r_0$ is where $dU/dr = 0$. The elastic modulus is proportional to the curvature: $E \\propto d^2U/dr^2|_{r_0}$. Asymmetry of the well explains thermal expansion.",
      prerequisites: { parents: ["Chemical bonding overview"], divergence: "quantitative energy-distance description of bonding" },
      keyResults: [
        "Deeper wells = higher melting point and higher elastic modulus",
        "Asymmetry of the potential well explains thermal expansion (anharmonicity)",
        "Lennard-Jones 6-12 potential is the simplest model: $U = 4\\varepsilon[(\\sigma/r)^{12} - (\\sigma/r)^6]$",
      ],
      tetrahedron: "structure→property",
      example: "Tungsten's deep, symmetric potential well (cohesive energy 8.90 eV/atom) gives it the highest melting point of any metal (3422 C), high modulus (411 GPa), and low thermal expansion (4.5 x 10^-6 /K).",
    },
  ],
};

// ── Family 3 — Crystal Structure ────────────────────────────────────────────

const CRYSTAL_STRUCTURE: Family = {
  slug: "crystal-structure",
  number: 3,
  name: "Crystal Structure",
  blurb: "How atoms arrange themselves in periodic and non-periodic solids.",
  section: "A",
  color: "indigo",
  concepts: [
    {
      name: "Crystalline vs amorphous",
      description: "Long-range periodic order versus short-range order only.",
      tags: ["structure", "fundamentals"],
      statement: "Crystalline materials have atoms arranged in a three-dimensional periodic pattern with long-range translational order. Amorphous (glassy) materials lack long-range order but retain short-range order (nearest-neighbor coordination). The same composition can exist in either state depending on processing (cooling rate).",
      prerequisites: { parents: ["Chemical bonding overview"], divergence: "the two fundamental structural states of condensed matter" },
      keyResults: [
        "Crystals have sharp melting points; glasses have a glass transition range",
        "Crystals diffract X-rays into sharp Bragg peaks; glasses produce diffuse halos",
        "Glasses are thermodynamically metastable — they are kinetically trapped non-equilibrium states",
      ],
      tetrahedron: "structure",
      example: "SiO2 cooled slowly crystallizes as quartz (sharp melting at 1713 C); quenched rapidly it forms fused silica glass (gradual softening above ~1200 C).",
    },
    {
      name: "Crystal lattice & unit cell",
      description: "The mathematical framework for describing periodic atomic arrangements.",
      tags: ["structure", "crystallography"],
      statement: "A crystal lattice is an infinite array of points generated by translation vectors $\\vec{a}_1, \\vec{a}_2, \\vec{a}_3$. The unit cell is the smallest parallelepiped that tiles space by translation. The basis is the set of atoms associated with each lattice point. Crystal structure = lattice + basis.",
      prerequisites: { parents: ["Crystalline vs amorphous"], divergence: "the mathematical description of periodicity" },
      keyResults: [
        "Lattice parameters (a, b, c, alpha, beta, gamma) fully specify the unit cell geometry",
        "Primitive cells contain exactly one lattice point; conventional cells may contain more for convenience",
        "Wigner-Seitz cell is the primitive cell closest to each lattice point",
      ],
      tetrahedron: "structure",
      example: "The FCC conventional unit cell contains 4 atoms (8 corners x 1/8 + 6 faces x 1/2) but the primitive cell is a rhombohedron containing just 1 atom.",
    },
    {
      name: "7 crystal systems & 14 Bravais lattices",
      description: "All possible lattice symmetries in three dimensions.",
      tags: ["structure", "crystallography", "symmetry"],
      statement: "In 3D, there are exactly 7 crystal systems (cubic, tetragonal, orthorhombic, hexagonal, trigonal, monoclinic, triclinic) defined by lattice parameter constraints, and 14 Bravais lattices obtained by adding centering (P, I, F, C) where compatible with symmetry. Auguste Bravais proved this in 1850.",
      prerequisites: { parents: ["Crystal lattice & unit cell"], divergence: "the complete enumeration of 3D lattice types" },
      keyResults: [
        "Cubic has the highest symmetry (a=b=c, 90-degree angles); triclinic has the lowest",
        "Not all centerings are distinct for all systems (e.g., face-centered tetragonal = body-centered tetragonal rotated)",
        "Most engineering metals crystallize in cubic (FCC, BCC) or hexagonal systems",
      ],
      tetrahedron: "structure",
      example: "Iron is BCC below 912 C (alpha-Fe), FCC from 912-1394 C (gamma-Fe), and BCC again above 1394 C (delta-Fe). The crystal system constrains which slip systems are available.",
    },
    {
      name: "230 space groups",
      description: "The complete catalogue of 3D crystallographic symmetry operations.",
      tags: ["structure", "crystallography", "symmetry"],
      statement: "Combining the 14 Bravais lattices with all possible point-group symmetries (rotations, reflections, inversions) and screw axes/glide planes yields exactly 230 space groups. Every crystalline material belongs to one of these groups, which dictates its possible physical properties (Neumann's principle).",
      prerequisites: { parents: ["7 crystal systems & 14 Bravais lattices"], divergence: "full symmetry classification including internal symmetry operations" },
      keyResults: [
        "Space group determines which tensor properties (piezoelectricity, optical activity) can exist",
        "11 of the 32 point groups are centrosymmetric — these cannot be piezoelectric",
        "X-ray crystallography determines space groups via systematic absences in diffraction patterns",
      ],
      tetrahedron: "structure",
      example: "Quartz belongs to space group P3121 or P3221 (chiral). Its lack of inversion symmetry is what makes it piezoelectric — the basis of quartz oscillators in every watch and electronic clock.",
    },
    {
      name: "Miller indices",
      description: "Notation for crystal planes and directions.",
      tags: ["structure", "crystallography"],
      statement: "Miller indices $(hkl)$ describe crystal planes by taking reciprocals of the plane's axis intercepts and clearing fractions. Directions are denoted $[uvw]$. Families of equivalent planes/directions use $\\{hkl\\}$ and $\\langle uvw \\rangle$. In cubic systems, $[hkl]$ is perpendicular to $(hkl)$.",
      prerequisites: { parents: ["Crystal lattice & unit cell"], divergence: "the standard notation for planes and directions" },
      keyResults: [
        "Interplanar spacing in cubic: $d_{hkl} = a / \\sqrt{h^2 + k^2 + l^2}$",
        "Bragg's law links Miller indices to diffraction: $n\\lambda = 2d_{hkl}\\sin\\theta$",
        "Slip planes in metals are the most densely packed planes (lowest Miller index sum)",
      ],
      tetrahedron: "structure",
      example: "In FCC metals, slip occurs on {111} planes (the close-packed planes) in <110> directions — giving 12 independent slip systems (4 planes x 3 directions each).",
    },
    {
      name: "Close-packed structures (FCC & HCP)",
      description: "The two ways to stack close-packed layers, achieving the maximum packing efficiency.",
      tags: ["structure", "metals"],
      statement: "Close-packed layers of spheres can be stacked in sequence ABCABC... (face-centered cubic, FCC) or ABAB... (hexagonal close-packed, HCP). Both achieve the maximum atomic packing factor APF $\\approx 0.74$, proven optimal by Kepler's conjecture (Hales, 2005).",
      prerequisites: { parents: ["7 crystal systems & 14 Bravais lattices"], divergence: "the densest possible atomic arrangements" },
      keyResults: [
        "FCC: Cu, Al, Ni, Au, Ag, Pb, gamma-Fe — generally ductile (12 slip systems)",
        "HCP: Ti, Zn, Mg, Co — often less ductile (fewer independent slip systems unless c/a deviates)",
        "Stacking faults are errors in the ABCABC sequence (FCC) or ABAB sequence (HCP)",
      ],
      tetrahedron: "structure→property",
      example: "Aluminum (FCC) can be rolled to very thin foil because it has 12 independent slip systems. Magnesium (HCP) is harder to form because it has only 3 independent basal slip systems at room temperature.",
    },
    {
      name: "BCC structure",
      description: "Body-centered cubic — common in transition metals and iron at room temperature.",
      tags: ["structure", "metals"],
      statement: "The body-centered cubic structure has atoms at cube corners and the cube center, with APF $\\approx 0.68$ and coordination number 8. BCC metals include Fe (alpha, delta), W, Mo, Cr, V, Nb, Ta. Slip occurs on {110}, {112}, and {123} planes in <111> directions — 48 potential slip systems but thermally activated.",
      prerequisites: { parents: ["7 crystal systems & 14 Bravais lattices"], divergence: "the second-most common metallic structure" },
      keyResults: [
        "Lower packing efficiency than FCC/HCP but higher at high temperatures (entropy-stabilized)",
        "BCC metals show a ductile-to-brittle transition temperature (DBTT) due to thermally activated slip",
        "Screw dislocation cores spread on multiple planes — explains wavy slip and temperature sensitivity",
      ],
      tetrahedron: "structure→property",
      example: "The RMS Titanic sank partly because its hull steel (BCC iron) underwent a ductile-to-brittle transition in the cold North Atlantic water (~-2 C), causing brittle fracture on impact.",
    },
    {
      name: "Atomic packing factor",
      description: "The fraction of unit cell volume occupied by atoms.",
      tags: ["structure", "calculation"],
      statement: "The atomic packing factor is APF $= \\frac{\\text{volume of atoms in cell}}{\\text{volume of unit cell}}$. For hard spheres: FCC and HCP give $\\pi/(3\\sqrt{2}) \\approx 0.74$, BCC gives $\\pi\\sqrt{3}/8 \\approx 0.68$, simple cubic gives $\\pi/6 \\approx 0.52$. The theoretical density is $\\rho = nA/(V_{cell}N_A)$.",
      prerequisites: { parents: ["Close-packed structures (FCC & HCP)", "BCC structure"], divergence: "quantifying packing efficiency" },
      keyResults: [
        "Predicts density from lattice parameter and atomic mass",
        "Higher APF generally means higher density and closer atomic contact",
        "Deviations from ideal APF indicate non-hard-sphere effects (directional bonding)",
      ],
      tetrahedron: "structure→property",
      example: "Iron: a = 2.87 A, BCC (n=2), A = 55.85 g/mol. Theoretical density = 2(55.85)/[(2.87e-8)^3 x 6.022e23] = 7.87 g/cm3, matching the measured value.",
    },
    {
      name: "Ceramic crystal structures",
      description: "Crystal structures determined by stoichiometry, charge balance, and radius ratios.",
      tags: ["structure", "ceramics"],
      statement: "Ceramic structures are governed by (1) charge neutrality, (2) cation-to-anion radius ratio $r_c/r_a$ which determines coordination number (CN 4 for $0.225 \\le r_c/r_a < 0.414$; CN 6 for $0.414 \\le r_c/r_a < 0.732$; CN 8 for $r_c/r_a \\ge 0.732$), and (3) stoichiometry. Common structures include rock salt (NaCl), fluorite (CaF2), perovskite (BaTiO3), and spinel (MgAl2O4).",
      prerequisites: { parents: ["Ionic bond", "7 crystal systems & 14 Bravais lattices"], divergence: "crystallographic rules for ionic compounds" },
      keyResults: [
        "Radius ratio rules predict coordination but have ~20% failure rate for borderline cases",
        "Perovskite structure (ABX3) hosts ferroelectricity, superconductivity, and multiferroic behavior",
        "Pauling's rules provide a broader framework for predicting ionic crystal structures",
      ],
      tetrahedron: "structure",
      example: "BaTiO3 has the perovskite structure with Ba2+ at corners, O2- at face centers, Ti4+ at the body center. Below 120 C, Ti4+ shifts off-center, producing a spontaneous electric polarization (ferroelectricity).",
    },
    {
      name: "Polymorphism & allotropy",
      description: "The ability of a material to exist in multiple crystal structures.",
      tags: ["structure", "phase"],
      statement: "Polymorphism (minerals/ceramics) or allotropy (elements) is the existence of multiple crystal structures for the same composition, stable in different temperature/pressure ranges. Phase transitions between polymorphs can be reconstructive (bonds broken, e.g. quartz-cristobalite) or displacive (small atomic shifts, e.g. alpha-beta quartz at 573 C).",
      prerequisites: { parents: ["7 crystal systems & 14 Bravais lattices"], divergence: "same composition, different structures" },
      keyResults: [
        "Iron: BCC (alpha) -> FCC (gamma, 912 C) -> BCC (delta, 1394 C) -> liquid (1538 C)",
        "Carbon: graphite (thermodynamically stable), diamond (metastable at ambient), fullerenes, nanotubes, graphene",
        "ZrO2: monoclinic -> tetragonal -> cubic; the monoclinic-tetragonal transformation is key to transformation toughening",
      ],
      tetrahedron: "structure",
      example: "Tin undergoes a polymorphic transition at 13.2 C from white tin (metallic, tetragonal) to grey tin (semiconducting, diamond cubic), a slow transformation historically called 'tin pest' that disintegrated tin organ pipes in unheated European cathedrals.",
    },
    {
      name: "Quasicrystals",
      description: "Ordered but non-periodic structures with forbidden rotational symmetries.",
      tags: ["structure", "advanced"],
      statement: "Quasicrystals possess long-range order and sharp diffraction peaks but lack translational periodicity. They exhibit 'forbidden' symmetries (5-fold, 10-fold, 12-fold) impossible in periodic crystals. Discovered by Dan Shechtman in Al-Mn alloys (1982, published 1984), initially rejected by the crystallographic community. The IUCr redefined 'crystal' in 1992 to include any solid with a discrete diffraction pattern. Shechtman received the 2011 Nobel Prize in Chemistry.",
      prerequisites: { parents: ["7 crystal systems & 14 Bravais lattices"], divergence: "order without periodicity — broke the classical definition of 'crystal'" },
      keyResults: [
        "Mathematically described by Penrose tilings and higher-dimensional crystallography",
        "Hard, low-friction surfaces; low thermal conductivity; used as non-stick coatings",
        "Natural quasicrystals found in Khatyrka meteorite (2009)",
      ],
      tetrahedron: "structure",
      example: "The Al-Cu-Fe icosahedral quasicrystal has 5-fold symmetry axes and produces sharp Bragg peaks in electron diffraction — impossible for any periodic crystal. It is used commercially as a non-stick coating on frying pans.",
      flagged: false,
    },
    {
      name: "Single vs polycrystals",
      description: "Materials can be a single continuous crystal or an aggregate of many crystallites (grains).",
      tags: ["structure", "microstructure"],
      statement: "Single crystals have one continuous lattice orientation throughout; their properties are anisotropic (direction-dependent). Polycrystalline materials consist of many grains, each a single crystal with a different orientation, separated by grain boundaries. Polycrystals are often quasi-isotropic if grain orientations are random.",
      prerequisites: { parents: ["Crystal lattice & unit cell"], divergence: "the distinction between perfect and real-world crystals" },
      keyResults: [
        "Single crystals: Si wafers, turbine blade superalloys, quartz oscillators",
        "Grain boundaries impede dislocation motion — smaller grains = stronger (Hall-Petch)",
        "Most engineering metals are polycrystalline with grain sizes of 1-100 um",
      ],
      tetrahedron: "structure→property",
      example: "Jet engine turbine blades are single-crystal Ni-base superalloys (no grain boundaries) to eliminate creep failure along grain boundaries at 1100 C+ operating temperatures.",
    },
    {
      name: "Texture & anisotropy",
      description: "Preferred crystallographic orientation in polycrystals and its effect on properties.",
      tags: ["structure", "processing"],
      statement: "Texture (preferred orientation) develops when grains align during processing (rolling, drawing, solidification). Textured materials are anisotropic: properties vary with direction. Measured by pole figures and orientation distribution functions (ODF). Random texture = isotropic; strong texture = pronounced anisotropy.",
      prerequisites: { parents: ["Single vs polycrystals"], divergence: "the intermediate case — polycrystalline but not random" },
      keyResults: [
        "Deep-drawn steel cups develop 'ears' from plastic anisotropy due to rolling texture",
        "Grain-oriented electrical steel (Goss texture) reduces transformer core losses by >50%",
        "EBSD (electron backscatter diffraction) maps texture grain by grain",
      ],
      tetrahedron: "processing→structure",
      example: "Grain-oriented electrical steel has {110}<001> Goss texture — the easy magnetization direction [001] aligns with the transformer core, reducing hysteresis losses and improving efficiency by over 50%.",
    },
  ],
};

// ── Family 4 — Crystallographic Defects ─────────────────────────────────────

const CRYSTALLOGRAPHIC_DEFECTS: Family = {
  slug: "crystallographic-defects",
  number: 4,
  name: "Crystallographic Defects",
  blurb: "Imperfections in crystal structures that control most engineering properties.",
  section: "A",
  color: "purple",
  concepts: [
    {
      name: "Defects overview",
      description: "Defects are deviations from the perfect crystal lattice, classified by dimensionality.",
      tags: ["defects", "fundamentals"],
      statement: "Crystal defects are classified by dimensionality: 0D (point defects — vacancies, interstitials, substitutionals), 1D (line defects — dislocations), 2D (planar defects — grain boundaries, stacking faults, surfaces), and 3D (volume defects — voids, precipitates, inclusions). Defects are thermodynamically inevitable above 0 K and control most mechanical, electrical, and diffusion properties.",
      prerequisites: { parents: ["Crystal lattice & unit cell"], divergence: "real crystals are never perfect" },
      keyResults: [
        "Perfect crystals would be 100-1000x stronger than real ones — defects explain the gap",
        "Defect engineering is the central strategy of materials design",
        "Equilibrium defect concentration increases exponentially with temperature",
      ],
      tetrahedron: "structure→property",
      example: "The theoretical shear strength of copper is ~7 GPa; the actual yield strength of annealed copper is ~70 MPa — a factor of 100 lower, entirely due to dislocation motion.",
    },
    {
      name: "Point defects",
      description: "Atomic-scale defects: vacancies, interstitials, and impurities.",
      tags: ["defects", "0D"],
      statement: "Point defects include vacancies (missing atoms), self-interstitials (extra atoms in non-lattice sites), and impurity atoms. The equilibrium vacancy concentration follows $n_v/N = \\exp(-Q_v/k_BT)$ where $Q_v$ is the vacancy formation energy (~1 eV for metals). Vacancies mediate solid-state diffusion.",
      prerequisites: { parents: ["Defects overview"], divergence: "zero-dimensional defects" },
      keyResults: [
        "Near melting, ~10^-4 of sites are vacant in typical metals",
        "Vacancies are essential for substitutional diffusion (vacancy mechanism)",
        "Quenching can retain supersaturated vacancy concentrations — drives precipitation hardening",
      ],
      tetrahedron: "structure",
      example: "In aluminum at 660 C (near melting), $n_v/N = \\exp(-0.76 \\text{ eV}/(8.617 \\times 10^{-5} \\text{ eV/K} \\times 933 \\text{ K})) \\approx 9 \\times 10^{-5}$ — about 1 in 11,000 sites is vacant.",
    },
    {
      name: "Substitutional & interstitial solutes",
      description: "Foreign atoms replacing host atoms or fitting into interstitial sites.",
      tags: ["defects", "alloys"],
      statement: "Substitutional solutes replace host atoms on lattice sites; interstitial solutes occupy spaces between host atoms. The Hume-Rothery rules predict extensive substitutional solubility when: (1) atomic radii differ by $< 15\\%$, (2) crystal structures are the same, (3) electronegativities are similar, and (4) valences are similar.",
      prerequisites: { parents: ["Point defects"], divergence: "intentional compositional defects — the basis of alloying" },
      keyResults: [
        "Cu-Ni: complete solid solubility (all four rules satisfied)",
        "C in Fe: interstitial (C radius ~0.77 A vs Fe octahedral hole ~0.36 A in BCC — severe distortion)",
        "Solid-solution strengthening arises from lattice strain around solute atoms",
      ],
      tetrahedron: "structure→property",
      example: "Carbon in BCC iron causes tetragonal distortion of the lattice because C (radius 0.77 A) is too large for the BCC octahedral interstitial site (0.36 A). This severe distortion is why martensite is so hard.",
    },
    {
      name: "Schottky & Frenkel defects",
      description: "Paired point defects in ionic crystals that maintain charge neutrality.",
      tags: ["defects", "ceramics"],
      statement: "In ionic crystals, point defects must maintain overall charge neutrality. A Schottky defect is a pair of cation and anion vacancies. A Frenkel defect is an ion displaced from its site to an interstitial position. The dominant type depends on ion sizes: Schottky dominates when cation and anion are similar-sized; Frenkel dominates when one ion is much smaller.",
      prerequisites: { parents: ["Point defects", "Ionic bond"], divergence: "point defects constrained by charge neutrality" },
      keyResults: [
        "NaCl: predominantly Schottky defects (similar ion sizes)",
        "AgBr: predominantly Frenkel defects (Ag+ is small, mobile interstitially) — basis of photographic film",
        "Non-stoichiometry (e.g., Fe1-xO) creates charge-compensating defects that affect conductivity",
      ],
      tetrahedron: "structure→property",
      example: "In AgBr photographic emulsion, Frenkel defects allow Ag+ ions to migrate to latent image sites when struck by photons — the atomic mechanism behind silver-halide photography.",
    },
    {
      name: "Dislocations",
      description: "Line defects that carry plastic deformation — edge, screw, and mixed types.",
      tags: ["defects", "1D", "mechanical"],
      statement: "Dislocations are line defects characterized by the Burgers vector $\\vec{b}$, determined by a Burgers circuit around the dislocation line. Edge dislocations have $\\vec{b} \\perp$ line direction (extra half-plane); screw dislocations have $\\vec{b} \\parallel$ line direction (helical ramp). Real dislocations are mixed. Dislocation density $\\rho$ is line length per unit volume (units: m/m$^3$ = m$^{-2}$); annealed metals: $\\sim 10^{10}$ m$^{-2}$; cold-worked: $\\sim 10^{15}$ m$^{-2}$.",
      prerequisites: { parents: ["Defects overview", "Crystal lattice & unit cell"], divergence: "one-dimensional defects — the carriers of plastic deformation" },
      keyResults: [
        "Dislocation motion on a slip plane requires only ~1 MPa vs ~1 GPa for perfect-crystal shear",
        "The Peach-Koehler force drives dislocations under applied stress: $\\vec{F} = (\\vec{\\sigma} \\cdot \\vec{b}) \\times \\hat{l}$",
        "Dislocations cannot end inside a crystal — they form loops, exit at surfaces, or connect to other defects",
      ],
      tetrahedron: "structure→property",
      example: "A single dislocation gliding across a copper crystal produces a slip step of exactly one Burgers vector (2.56 A). Billions of dislocations gliding simultaneously produce the macroscopic permanent deformation we observe.",
    },
    {
      name: "Grain boundaries",
      description: "Interfaces between crystals of different orientation in a polycrystal.",
      tags: ["defects", "2D", "microstructure"],
      statement: "Grain boundaries are 2D defects separating crystals of different orientation. Low-angle boundaries ($< 15°$) are arrays of dislocations; high-angle boundaries are disordered regions ~2-3 atoms wide. Special boundaries (e.g., $\\Sigma 3$ twin) have low energy and special properties. Grain boundary energy is typically 0.3-1.0 J/m$^2$ for metals.",
      prerequisites: { parents: ["Dislocations", "Single vs polycrystals"], divergence: "two-dimensional defects between grains" },
      keyResults: [
        "Impede dislocation motion — the basis of Hall-Petch strengthening",
        "Fast diffusion paths (grain boundary diffusivity >> lattice diffusivity)",
        "Preferential sites for corrosion, precipitation, and crack nucleation",
        "Grain boundary engineering (increasing special boundary fraction) improves resistance to intergranular degradation",
      ],
      tetrahedron: "structure→property",
      example: "Grain boundary engineering in Inconel 600 increased the fraction of twin (Sigma-3) boundaries from 35% to 75%, reducing intergranular stress corrosion cracking susceptibility in nuclear reactor environments by 10x.",
    },
    {
      name: "Stacking faults & twins",
      description: "Planar defects that interrupt the normal stacking sequence.",
      tags: ["defects", "2D"],
      statement: "A stacking fault is a local error in the layer stacking sequence (e.g., ...ABCABABCABC... in FCC). Twin boundaries are mirror planes where the stacking sequence reverses (...ABCABCBACBA...). Stacking fault energy (SFE) ranges from ~20 mJ/m$^2$ (Cu-30Zn) to ~200 mJ/m$^2$ (Al). Low SFE promotes wide stacking faults, planar slip, twinning, and higher work hardening rate.",
      prerequisites: { parents: ["Close-packed structures (FCC & HCP)", "Dislocations"], divergence: "planar defects within grains" },
      keyResults: [
        "Low SFE metals (Cu, austenitic stainless) work-harden rapidly — good for forming",
        "Deformation twinning is a strengthening mechanism in TWIP steels and HCP metals",
        "Annealing twins form during recrystallization in low-SFE FCC metals",
      ],
      tetrahedron: "structure→property",
      example: "TWIP (twinning-induced plasticity) steels achieve >50% elongation AND >1000 MPa UTS because deformation twins create dynamic Hall-Petch barriers — the twin boundaries continuously refine the effective grain size during deformation.",
    },
    {
      name: "Volume defects",
      description: "Three-dimensional defects: voids, inclusions, precipitates, and pores.",
      tags: ["defects", "3D"],
      statement: "Volume (3D) defects include voids (vacant volume), inclusions (foreign phases, often from processing), precipitates (second phases formed by solid-state transformation), and porosity (in castings, powder metallurgy, or ceramics). These act as stress concentrators and sites for fracture initiation.",
      prerequisites: { parents: ["Defects overview"], divergence: "three-dimensional defects" },
      keyResults: [
        "Inclusions (MnS, Al2O3 in steel) are major fatigue crack initiators",
        "Precipitates can be strengthening (coherent) or weakening (incoherent, at grain boundaries)",
        "Porosity in ceramics follows Ryshkewitch: $\\sigma = \\sigma_0 \\exp(-nP)$ where P is porosity fraction",
      ],
      tetrahedron: "structure→property",
      example: "Clean steelmaking reduces oxide inclusion content from ~100 ppm to <10 ppm, increasing bearing fatigue life by 10x. Each inclusion is a potential crack nucleus.",
    },
    {
      name: "Surfaces & interfaces",
      description: "The boundary between a material and its environment or another phase.",
      tags: ["defects", "2D", "surface"],
      statement: "Free surfaces have energy $\\gamma \\approx 1$-$3$ J/m$^2$ for metals, arising from broken bonds. Surface atoms have lower coordination, higher energy, and different electronic structure. Interphase boundaries (e.g., matrix-precipitate) can be coherent (lattice continuous, low energy), semi-coherent (misfit dislocations), or incoherent (disordered, high energy).",
      prerequisites: { parents: ["Defects overview", "Chemical bonding overview"], divergence: "the material-environment interface" },
      keyResults: [
        "Surface energy drives sintering, grain growth, and Ostwald ripening",
        "Coherent precipitate interfaces enable effective strengthening (low misfit strain energy)",
        "Catalysis, corrosion, and fracture all occur at surfaces",
      ],
      tetrahedron: "structure→property",
      example: "Nanoparticle catalysts work because the surface-to-volume ratio scales as 1/r. A 2 nm gold nanoparticle has ~50% of its atoms at the surface, making it catalytically active despite bulk gold being inert.",
    },
  ],
};

export const FAMILIES_1_4: Family[] = [
  MATERIALS_PARADIGM,
  CHEMICAL_BONDING,
  CRYSTAL_STRUCTURE,
  CRYSTALLOGRAPHIC_DEFECTS,
];
