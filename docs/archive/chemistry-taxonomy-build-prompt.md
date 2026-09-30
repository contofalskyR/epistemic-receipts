# Build Prompt — Chemistry Taxonomy (mirrors the sibling pages)

> **For the user (not the builder).** This builds `/chemistry` as a sibling of `/statistics`, `/finance`, `/governance`, `/ideologies`, `/sports`, and `/mathematics`. Key decisions:
> - **Second only to the math page in accuracy-sensitivity.** Formulas, equations, and reaction products must be correct; I've vetted the seeds and followed **IUPAC** naming. Flag anything uncertain rather than guessing.
> - **Mandatory rendering note:** the page **must typeset chemistry with MathJax or KaTeX using the `mhchem` extension**, and every formula/equation in the data is written in **`\ce{...}` notation** (e.g. `$\ce{H2O}$`, `$\ce{2H2 + O2 -> 2H2O}$`, `$\ce{SO4^2-}$`). Plain math relations (e.g. `$PV=nRT$`) are ordinary LaTeX. This both fixes the unicode-subscript corruption that bit earlier pages **and** is simply expected for chemistry — do **not** render formulas as plain text with unicode subscripts/superscripts.
> - **New per-entry fields:** the core/searchable field is **`key fact`** (the defining property, principle, or transformation — the "key insight" analogue), plus an optional **`formula`** (in `\ce{...}`), and for reaction entries a **`reaction`** equation and a **`transforms`** field (*reactant class → product class* — **these define the reaction-network edges**). Element entries also carry **periodic coordinates** (symbol, Z, group, period, block, category).
> - **Mandatory headline features (two, because chemistry has two iconic structures a flat list can't capture):**
>   1. **The reaction / transformation network ("synthesis map").** Functional groups and compound classes are **nodes**; named reactions are **directed edges** (`alkene -> alcohol` via hydration, etc.), built from the `transforms` fields. **Reuse the existing Edges model** (same object as the ideology descent edges / the math prerequisite DAG).
>   2. **The interactive periodic table.** Render the elements in their true **period × group grid** from the element dataset, colored by category/block, each cell clickable to its card.
> - **Scale:** 5 color groups (Foundations / Physical / Organic / Inorganic-Materials-Nuclear / Analytical-Bio-Crosscutting) · 21 families · ~248 concept entries, plus a 118-element reference dataset powering the periodic table.
> - **Verify before shipping (the volatile parts):** as of early 2026 the periodic table has **118 confirmed elements** — **oganesson (Z=118) is the heaviest and period 7 is complete**; the last four added were **nihonium, moscovium, tennessine, and oganesson (2016)**. Elements **119 and 120 are being actively pursued** (RIKEN via $\ce{^{51}V + ^{248}Cm}$; Berkeley via a $\ce{^{50}Ti}$ route) but **have not been synthesized or ratified**, and confirmation would take years. Separately, **room-temperature ambient-pressure superconductivity has not been achieved** — the 2023 **LK-99** claim was refuted (its effects traced to impurities) and a separate high-pressure lutetium-hydride claim was **retracted**. Re-verify both before shipping.
>
> Paste everything below the line.

---

## Your task

Create `/chemistry`, reusing the sibling pages' components, schema, and styling so all pages read as a set: a card-based, filterable, **`mhchem`-typeset** field guide to chemistry — from atomic structure, bonding, and the periodic table through physical, organic, inorganic, materials, nuclear, analytical, and biochemistry to the great reactions and open questions — cross-linked to the claims database and threaded by a reaction-transformation network and an interactive periodic table.

## How to build

- **Edit the data layer, not the markup.** Add a `chemistry` dataset shaped like the existing taxonomy data and let the current card/family/filter components render it.
- **Typeset with MathJax or KaTeX + the `mhchem` extension.** Initialize once; render `key fact`, `formula`, and `reaction` (which contain `\ce{...}`) and plain-LaTeX relations in both the collapsed card and the expansion. Make the filter index the **rendered/plain-text** form (so a search for "H2O" or "sulfuric acid" still works).
- **Populate the core field (`key fact`) from the seeds** — preserve their content; they are vetted.
- **Build the reaction-transformation network from `transforms`** and the **periodic table from the element dataset** (see headline features). Recompute both from data.
- **Recompute "N families · M entries" from the data**; never hard-code counts.
- **Cross-link, don't duplicate.** Entries tagged `[xref: mathematics]` (the calculus/linear-algebra/PDE machinery behind physical chemistry) and `[xref: statistics]` (calibration, measurement error, Beer-Lambert regression) should **link to the sibling entry**, not fork a copy.
- **Footer note** matching siblings: the free-text-search caveat plus a "claim cross-references pending" roadmap line, and a **"last updated"** date.

## New fields specific to this page

Every card carries, beyond name + one-line description:
- **`key fact`** — *core, searchable* — the defining property, principle, or transformation.
- **`formula`** *(where applicable)* — molecular formula or general structure, in `\ce{...}`.
- **`reaction`** *(reaction entries)* — the balanced equation, in `\ce{...}`.
- **`transforms`** *(reaction entries)* — *reactant class → product class.* **These are the directed edges of the reaction network.** Name functional-group/compound-class nodes so the builder can resolve them.
- **`example`** *(optional)* — a representative compound, reaction, or application.
- **periodic coordinates** *(element-category entries + the element dataset)* — symbol, atomic number Z, group, period, block (s/p/d/f), and category, powering the periodic-table view.

## Headline features (mandatory)

**1. The reaction / transformation network ("synthesis map").** From the `transforms` fields, construct a **directed graph**: each functional group / compound class is a node; each named reaction is a directed edge `A -> B` ("A transforms into B via this reaction"), e.g. `alkene -> alcohol` (hydration), `alcohol -> aldehyde -> carboxylic acid` (oxidation), `carboxylic acid + alcohol -> ester` (esterification). Requirements:
- Render it **per family** (the organic-reaction subgraph) and, if feasible, as a zoomable site-wide synthesis map.
- **Nodes are clickable** and route to the corresponding card.
- **Reuse the existing Edges model** (same shape as the ideology "descended-from" edges and the math prerequisite DAG).
- Some reactions are reversible or branch — allow multiple edges between nodes; this graph need not be acyclic (unlike the math DAG).

**2. The interactive periodic table.** Render all 118 elements in the standard **period × group layout** from the element dataset, with the f-block (lanthanides/actinides) shown below as usual. Color cells by **category** (or toggle to **block** s/p/d/f). **Each cell is clickable** and opens the relevant card (element category, periodic trend, or block). Surface the **disputed placements** (see below) rather than hard-coding one answer.

These two views are the page's differentiators — feature them above or beside the family list, not buried.

## Expansion structure

Each card expands to: what-it-is / intuition · the `key fact` and `formula`/`reaction` (typeset) · where it sits (which family, and its neighbors in the reaction network or periodic table) · a worked example or canonical application · related claims.

**Optional deep-dive** at `/chemistry/methods` for the ~10 most foundational topics (the atom & orbitals, the periodic law, the covalent bond, the mole & stoichiometry, the ideal gas law, enthalpy/entropy/Gibbs, chemical equilibrium, acid-base & pH, redox & electrochemistry, reaction kinetics) in the siblings' problem → mechanism → worked example → figure → pitfalls → related-claims format. Offer it; leave a stub if not cheap.

## Accuracy / neutrality mandate

Correctness matters here as much as anywhere but the math page. **Do not fabricate.** Flag any formula, product, or value you are unsure of for review — especially **reaction products, balancing, and the volatile facts** (the element count and the superconductivity status above). Where classification is genuinely **disputed**, present it neutrally and don't adjudicate, e.g.: **hydrogen's placement** (group 1 vs above the halogens vs standalone); **group-3 membership** (Sc, Y, then La/Ac *or* Lu/Lr — an unresolved IUPAC question); **which elements are metalloids**; whether the **group-12 metals (Zn/Cd/Hg)** are "transition metals"; whether **biochemistry is "chemistry" or "biology"**; where the **organic/inorganic boundary** falls (carbonates, $\ce{CO2}$); and whether a topic is **"pure" or "applied."** State the dispute; leave it open.

---

# CONTENT PAYLOAD — FAMILIES

> Format per entry: **Name** — short description. *Key fact:* … *Formula:* `$\ce{...}$` (where applicable). *Example:* … `tags`
> Every chemical formula/equation below is `\ce{...}`; render with MathJax/KaTeX + mhchem. Plain math relations are ordinary LaTeX.

## SECTION A — Foundations: Atoms, Periodicity & Bonding
*What matter is made of, how the elements are organized, and how atoms join.* 

### Family 1 — Atomic Structure & the Quantum Atom

> **Atom** — The basic unit of an element. *Key fact:* a dense positive nucleus (protons + neutrons) surrounded by electrons; the proton count fixes the element. *Example:* a carbon atom has 6 protons. `atomic` `foundations`
> **Proton, neutron & electron** — The subatomic constituents. *Key fact:* protons ($+1$) and neutrons (neutral) sit in the nucleus, electrons ($-1$) occupy orbitals; $m_p\approx m_n\approx 1836\,m_e$. *Example:* mass number $A=Z+N$. `atomic`
> **Atomic number (Z)** — The element's identity. *Key fact:* $Z$ is the number of protons; it fixes which element an atom is and its place in the table. *Example:* $Z=8$ is always oxygen. `atomic` `periodicity`
> **Isotopes** — Same element, different neutron count. *Key fact:* equal $Z$ but different mass number $A$; chemically nearly identical. *Example:* $\ce{^{12}C}$, $\ce{^{13}C}$, $\ce{^{14}C}$. `atomic`
> **Atomic mass & the mass unit** — Average mass of an element's atoms. *Key fact:* the standard atomic weight is the abundance-weighted isotope average, in unified atomic mass units (u). *Example:* chlorine $\approx 35.45$ u. `atomic`
> **The Bohr model** — Electrons in quantized orbits. *Key fact:* electrons occupy fixed-energy shells; photons are emitted/absorbed on transitions, $E=h\nu$. *Example:* explains the hydrogen line spectrum. `atomic` `quantum`
> **Quantum-mechanical model (orbitals)** — Electrons as probability clouds. *Key fact:* solutions of the Schrödinger equation give orbitals — regions of high probability — replacing fixed orbits. *Example:* s, p, d, f orbital shapes. `atomic` `quantum` `[xref: mathematics]`
> **Quantum numbers** — Labels for an electron's state. *Key fact:* $n$ (shell), $\ell$ (subshell/shape), $m_\ell$ (orientation), $m_s$ (spin $\pm\tfrac12$). *Example:* a 2p electron has $n=2,\ \ell=1$. `atomic` `quantum`
> **Electron configuration** — How electrons fill orbitals. *Key fact:* electrons occupy the lowest-energy orbitals first. *Formula:* sodium is $\ce{[Ne] 3s^1}$. *Example:* oxygen is $\ce{1s^2 2s^2 2p^4}$. `atomic`
> **Aufbau, Hund & Pauli principles** — The filling rules. *Key fact:* fill lowest energy first (Aufbau), singly before pairing (Hund), and no two electrons share all four quantum numbers (Pauli exclusion). *Example:* nitrogen's three 2p electrons are unpaired. `atomic`
> **Valence electrons** — The outermost, reactive electrons. *Key fact:* electrons in the highest principal shell; they govern bonding and set the group. *Example:* every group-1 metal has one. `atomic` `bonding`
> **Ions (cations & anions)** — Charged atoms. *Key fact:* losing electrons gives cations ($+$), gaining gives anions ($-$). *Formula:* $\ce{Na+}$, $\ce{Cl-}$. `atomic`
> **Ionization energy & electron affinity** — Energy to remove or add an electron. *Key fact:* ionization energy removes the most loosely held electron; electron affinity is the energy change on gaining one; both rise across a period. `atomic` `periodicity`

### Family 2 — The Periodic Table & Periodic Trends

> **The periodic law** — Properties recur with atomic number. *Key fact:* ordering elements by increasing $Z$ makes chemical properties repeat at regular intervals. *Example:* Mendeleev's table predicted undiscovered elements. `periodicity` `foundations`
> **Periods & groups** — Rows and columns. *Key fact:* a period shares the highest shell $n$; a group shares valence count and similar chemistry. *Example:* group 17 is the halogens. `periodicity`
> **s-, p-, d- and f-blocks** — Regions by filling subshell. *Key fact:* the block names the subshell being filled and sets the table's shape. *Example:* the transition metals are the d-block. `periodicity`
> **Metals, nonmetals & metalloids** — Three broad classes. *Key fact:* metals are lustrous conductors that lose electrons; nonmetals gain/share them; metalloids are intermediate. *Note:* which elements count as metalloids is not universally agreed. `periodicity` `classification`
> **Alkali metals (Group 1)** — Soft, very reactive metals. *Key fact:* one valence electron; react vigorously with water. *Reaction:* $\ce{2Na + 2H2O -> 2NaOH + H2}$. *Example:* Li, Na, K, Rb, Cs, Fr. `periodicity`
> **Alkaline earth metals (Group 2)** — Reactive divalent metals. *Key fact:* two valence electrons; form $2+$ ions. *Example:* Be, Mg, Ca, Sr, Ba, Ra. `periodicity`
> **Halogens (Group 17)** — Reactive nonmetals. *Key fact:* one electron short of a full shell; strong oxidizers forming $\ce{X-}$. *Example:* F, Cl, Br, I, At. `periodicity`
> **Noble gases (Group 18)** — Inert, full-shell elements. *Key fact:* complete valence shells make them very unreactive. *Example:* He, Ne, Ar, Kr, Xe, Rn. `periodicity`
> **Transition metals** — The d-block. *Key fact:* variable oxidation states, colored compounds, and catalysis from partially filled d-orbitals. *Example:* Fe, Cu, Ni, Pt. `periodicity` `inorganic`
> **Lanthanides & actinides** — The f-block (rare earths and heavy radioactives). *Key fact:* fill 4f/5f orbitals; lanthanides are similar trivalent metals, actinides are largely radioactive. *Example:* La-Lu; Ac-Lr. `periodicity`
> **Atomic radius (trend)** — Effective atomic size. *Key fact:* decreases across a period (rising nuclear charge) and increases down a group (added shells). `periodicity` `trend`
> **Electronegativity (trend)** — Pull on shared electrons. *Key fact:* increases across a period, decreases down a group; fluorine is highest (~4.0, Pauling scale). *Example:* sets bond polarity. `periodicity` `trend` `bonding`
> **Ionization-energy trend** — Difficulty of removing an electron. *Key fact:* generally rises across a period and falls down a group, with dips at filled/half-filled subshells. `periodicity` `trend`
> **Hydrogen's placement** — A table anomaly. *Key fact:* hydrogen has one valence electron (like group 1) yet is a nonmetal that can gain one (like group 17); its position is genuinely disputed. *Note:* shown neutrally; placement varies by table. `periodicity` `classification`
> **Group-3 membership** — An unresolved layout question. *Key fact:* group 3 is Sc and Y, but the next two are assigned either La and Ac *or* Lu and Lr depending on the convention; IUPAC has not fully settled it. *Note:* present both; do not adjudicate. `periodicity` `classification`

### Family 3 — Chemical Bonding & Molecular Geometry

> **Chemical bond** — What holds atoms together. *Key fact:* atoms bond to lower their energy, often toward a noble-gas electron count (the octet rule). `bonding` `foundations`
> **Ionic bond** — Electron transfer between ions. *Key fact:* electrostatic attraction of cation and anion; forms lattices, not discrete molecules. *Formula:* $\ce{NaCl}$. `bonding`
> **Covalent bond** — Shared electron pairs. *Key fact:* atoms share electrons to fill shells; single/double/triple bonds share 1/2/3 pairs. *Formula:* $\ce{O=O}$ in $\ce{O2}$. `bonding`
> **Metallic bond** — A sea of delocalized electrons. *Key fact:* cations in a mobile electron "sea," giving conductivity and malleability. *Example:* copper. `bonding`
> **Lewis structures** — Dot diagrams of valence electrons. *Key fact:* track bonding and lone pairs to satisfy the octet and reveal formal charge. *Example:* $\ce{H2O}$ has two bonds and two lone pairs on O. `bonding`
> **Octet rule & its exceptions** — Eight-electron stability. *Key fact:* atoms tend toward eight valence electrons; exceptions include $\ce{BF3}$ (incomplete) and $\ce{SF6}$ (expanded). `bonding`
> **Formal charge** — Bookkeeping electron ownership. *Key fact:* $\text{FC}=(\text{valence }e^-)-(\text{lone }e^-)-\tfrac12(\text{bonding }e^-)$; the best Lewis structure minimizes it. `bonding`
> **Resonance** — Several valid Lewis structures. *Key fact:* the real structure is a hybrid of resonance forms; delocalization lowers energy. *Formula:* the carbonate ion $\ce{CO3^2-}$. `bonding`
> **Bond polarity & dipole moment** — Unequal sharing. *Key fact:* an electronegativity difference creates partial charges and a dipole; symmetry can cancel the net moment. *Example:* $\ce{CO2}$ is nonpolar despite polar bonds. `bonding`
> **VSEPR theory** — Predicting molecular shape. *Key fact:* electron pairs arrange to minimize repulsion, setting geometry (linear, trigonal planar, tetrahedral, …). *Example:* $\ce{CH4}$ is tetrahedral ($109.5^\circ$). `bonding` `geometry`
> **Valence-bond theory & hybridization** — Mixing orbitals to bond. *Key fact:* atomic orbitals hybridize ($sp$, $sp^2$, $sp^3$) to match geometry; bonds form by overlap. *Example:* $sp^3$ carbon in methane. `bonding` `geometry`
> **Sigma & pi bonds** — Two overlap types. *Key fact:* $\sigma$ bonds form by head-on overlap (single bonds); $\pi$ bonds by side-on overlap (in double/triple bonds). *Example:* a $\ce{C=C}$ is one $\sigma$ + one $\pi$. `bonding`
> **Molecular-orbital theory** — Electrons in molecule-wide orbitals. *Key fact:* atomic orbitals combine into bonding/antibonding MOs; bond order $=\tfrac12(\text{bonding}-\text{antibonding})$. *Example:* explains $\ce{O2}$'s paramagnetism. `bonding` `[xref: mathematics]`
> **Coordinate (dative) bond** — Both electrons from one atom. *Key fact:* a covalent bond in which one atom donates the whole shared pair. *Formula:* $\ce{NH4+}$ (N donates to $\ce{H+}$). `bonding`

### Family 4 — Intermolecular Forces

> **Intermolecular forces (overview)** — Attractions between molecules. *Key fact:* weaker than bonds, they set melting/boiling points, viscosity, and solubility. `forces` `foundations`
> **London dispersion forces** — Universal induced-dipole attraction. *Key fact:* momentary dipoles induce neighbors; strength grows with electron count and polarizability. *Example:* holds nonpolar molecules and liquid noble gases together. `forces`
> **Dipole-dipole forces** — Between polar molecules. *Key fact:* permanent dipoles align $\delta+$ to $\delta-$. *Example:* in $\ce{HCl}$. `forces`
> **Hydrogen bonding** — A strong dipole interaction with H. *Key fact:* H bonded to N, O, or F is strongly attracted to a lone pair on another N/O/F. *Example:* gives water its high boiling point and ice its lower density. `forces`
> **Ion-dipole forces** — An ion attracting a polar molecule. *Key fact:* strong attraction central to dissolving salts. *Example:* $\ce{Na+}$ hydrated by water. `forces`
> **Van der Waals forces** — Collective term for weak attractions. *Key fact:* an umbrella for dispersion and dipole forces. `forces`
> **Solubility & "like dissolves like"** — Why some things mix. *Key fact:* polar/ionic solutes dissolve in polar solvents, nonpolar in nonpolar, set by matching forces. *Example:* oil and water don't mix. `forces` `solutions`
> **Surface tension, viscosity & capillarity** — Bulk effects of intermolecular forces. *Key fact:* stronger forces raise surface tension and viscosity and drive capillary rise. *Example:* water beads on a waxy leaf. `forces`

## SECTION B — Physical Chemistry: Matter, Energy, Rates & Equilibrium
*The quantitative laws governing how much, how stable, and how fast.* 

### Family 5 — Stoichiometry & the Mole

> **The mole** — Chemistry's counting unit. *Key fact:* one mole is $6.022\times10^{23}$ entities (Avogadro's number). *Example:* 1 mol of $\ce{^{12}C}$ is 12 g. `stoichiometry` `foundations`
> **Avogadro's number** — Particles per mole. *Key fact:* $N_A=6.022\times10^{23}\ \text{mol}^{-1}$ links the atomic and macroscopic scales. `stoichiometry`
> **Molar mass** — Grams per mole. *Key fact:* numerically equals the formula's atomic-weight sum, in g/mol. *Example:* $\ce{H2O}$ is 18.02 g/mol. `stoichiometry`
> **Empirical vs molecular formula** — Composition notation. *Key fact:* the empirical formula gives the simplest atom ratio; the molecular formula gives actual counts. *Formula:* glucose is $\ce{CH2O}$ (empirical), $\ce{C6H12O6}$ (molecular). `stoichiometry`
> **Balancing equations** — Conserving atoms. *Key fact:* coefficients are set so each element's atom count matches on both sides (mass conservation). *Reaction:* $\ce{CH4 + 2O2 -> CO2 + 2H2O}$. `stoichiometry`
> **Stoichiometric calculations** — Mole ratios from equations. *Key fact:* balanced coefficients give the ratios that convert between reactants and products. `stoichiometry`
> **Limiting reagent** — The reactant that runs out first. *Key fact:* it caps product formed; the others are in excess. `stoichiometry`
> **Percent yield** — Actual vs theoretical product. *Key fact:* $\%\text{ yield}=\dfrac{\text{actual}}{\text{theoretical}}\times100$. `stoichiometry`
> **Concentration & molarity** — Amount per volume. *Key fact:* molarity $M=\dfrac{\text{mol solute}}{\text{L solution}}$; other units include molality and ppm. `stoichiometry` `solutions`
> **Dilution** — Adding solvent to lower concentration. *Key fact:* moles are conserved, so $M_1V_1=M_2V_2$. `stoichiometry` `solutions`

### Family 6 — States of Matter & Gas Laws

> **States of matter** — Solid, liquid, gas (and plasma). *Key fact:* defined by how tightly particles are held — fixed shape and volume (solid), fixed volume only (liquid), neither (gas). `states` `foundations`
> **Phase transitions** — Changes of state. *Key fact:* melting, freezing, vaporization, condensation, sublimation, deposition — each with a characteristic latent heat absorbed/released at constant $T$. `states`
> **Phase diagram** — Map of state vs $T$ and $P$. *Key fact:* shows solid/liquid/gas regions, the triple point, and the critical point. *Example:* $\ce{CO2}$ sublimes at 1 atm. `states`
> **Vapor pressure** — A liquid's escaping tendency. *Key fact:* rises with temperature; boiling occurs when it equals external pressure. *Example:* water boils below 100 °C on mountains. `states`
> **Ideal gas law** — The central gas equation. *Key fact:* $PV=nRT$ with $R=8.314\ \text{J mol}^{-1}\text{K}^{-1}$. *Example:* accurate at low pressure and high temperature. `gases` `[xref: mathematics]`
> **Boyle's law** — Pressure-volume inverse. *Key fact:* at fixed $T,n$, $PV=\text{const}$, so $P\propto 1/V$. `gases`
> **Charles's law** — Volume-temperature direct. *Key fact:* at fixed $P,n$, $V/T=\text{const}$ with $T$ in kelvin. `gases`
> **Avogadro's law** — Volume-amount direct. *Key fact:* equal volumes of gases at the same $T,P$ contain equal numbers of molecules. `gases`
> **Gay-Lussac's law** — Pressure-temperature direct. *Key fact:* at fixed $V,n$, $P/T=\text{const}$. `gases`
> **Dalton's law of partial pressures** — Gas mixtures add. *Key fact:* total pressure is the sum of component partial pressures, $P_\text{tot}=\sum_i P_i$. `gases`
> **Kinetic-molecular theory** — Gases as moving particles. *Key fact:* pressure and temperature emerge from elastic molecular collisions; average kinetic energy $\propto T$. `gases` `[xref: mathematics]`
> **Real gases & van der Waals** — Correcting the ideal law. *Key fact:* $\left(P+\dfrac{an^2}{V^2}\right)(V-nb)=nRT$ accounts for molecular volume and attraction. *Example:* deviations grow at high $P$, low $T$. `gases`
> **Graham's law of effusion** — Lighter gases escape faster. *Key fact:* effusion rate $\propto 1/\sqrt{M}$. *Example:* helium leaks from a balloon faster than air. `gases`

### Family 7 — Thermodynamics & Thermochemistry

> **Chemical thermodynamics** — Energy and spontaneity of reactions. *Key fact:* predicts whether and how far a reaction goes from state functions — not how fast. `thermo` `foundations` `[xref: mathematics]`
> **First law (energy conservation)** — Energy is conserved. *Key fact:* $\Delta U=q+w$; internal energy changes by heat added and work done. `thermo`
> **Enthalpy (H)** — Heat at constant pressure. *Key fact:* $\Delta H=q_p$; exothermic if $\Delta H<0$, endothermic if $>0$. *Example:* combustion is exothermic. `thermo`
> **Hess's law** — Enthalpy adds along any path. *Key fact:* $\Delta H$ is a state function, so it sums over steps regardless of route. *Example:* combine known reactions to get an unknown $\Delta H$. `thermo`
> **Standard enthalpy of formation** — Heat to form a compound from its elements. *Key fact:* $\Delta H_f^\circ$; reaction enthalpy $=\sum\Delta H_f^\circ(\text{products})-\sum\Delta H_f^\circ(\text{reactants})$. `thermo`
> **Entropy (S)** — A measure of energy dispersal/disorder. *Key fact:* spontaneous processes increase the total entropy of the universe. *Example:* gases have higher $S$ than solids. `thermo`
> **Second law of thermodynamics** — Total entropy rises. *Key fact:* $\Delta S_\text{univ}>0$ for any spontaneous process. `thermo`
> **Third law of thermodynamics** — Zero entropy at absolute zero. *Key fact:* a perfect crystal has $S=0$ at $0\ \text{K}$, fixing an absolute entropy scale. `thermo`
> **Gibbs free energy (G)** — The spontaneity criterion. *Key fact:* $\Delta G=\Delta H-T\Delta S$; spontaneous when $\Delta G<0$, and the sign can flip with temperature. `thermo`
> **Calorimetry** — Measuring heat flow. *Key fact:* $q=mc\,\Delta T$ relates heat to mass, specific heat, and temperature change. *Example:* a bomb calorimeter for combustion. `thermo`
> **Heat capacity & specific heat** — Heat to warm a substance. *Key fact:* specific heat $c$ is heat per gram per kelvin; water's is unusually high. `thermo`
> **Bond enthalpy** — Energy to break a bond. *Key fact:* reaction enthalpy $\approx$ (bonds broken) $-$ (bonds formed); stronger bonds release more on forming. `thermo` `bonding`

### Family 8 — Chemical Kinetics

> **Reaction rate** — How fast concentrations change. *Key fact:* the change in concentration per unit time; depends on concentration, temperature, and catalysts. `kinetics` `[xref: mathematics]`
> **Rate law & reaction order** — Rate's concentration dependence. *Key fact:* $\text{rate}=k[A]^m[B]^n$; the orders $m,n$ are found experimentally. *Example:* doubling $[A]$ quadruples a second-order rate. `kinetics`
> **Rate constant (k)** — The proportionality in the rate law. *Key fact:* temperature-dependent; its units depend on the overall order. `kinetics`
> **Integrated rate laws** — Concentration vs time. *Key fact:* zero/first/second order give linear plots of $[A]$, $\ln[A]$, $1/[A]$ vs $t$. *Example:* first order, $\ln[A]=\ln[A]_0-kt$. `kinetics` `[xref: mathematics]`
> **Half-life (kinetic)** — Time to halve a reactant. *Key fact:* for first order, $t_{1/2}=\dfrac{\ln 2}{k}$, independent of concentration. `kinetics`
> **Arrhenius equation** — Temperature dependence of rate. *Key fact:* $k=Ae^{-E_a/RT}$; rate rises sharply with $T$ and falls with activation energy. `kinetics`
> **Activation energy** — The energy barrier. *Key fact:* the minimum energy for reactants to react; lowering it speeds the reaction. `kinetics`
> **Collision theory** — Reactions need effective collisions. *Key fact:* molecules must collide with sufficient energy and correct orientation. `kinetics`
> **Transition-state theory** — The activated complex. *Key fact:* reactants pass through a high-energy transition state at the barrier's peak. `kinetics`
> **Mechanism & rate-determining step** — The molecular sequence. *Key fact:* a reaction proceeds via elementary steps; the slowest step sets the overall rate. `kinetics`
> **Catalysis** — Speeding reactions without being consumed. *Key fact:* a catalyst lowers $E_a$ via an alternate path; homogeneous, heterogeneous, or enzymatic. *Example:* Pt in catalytic converters; enzymes. `kinetics`

### Family 9 — Chemical Equilibrium

> **Chemical equilibrium** — Forward and reverse rates equal. *Key fact:* a dynamic state where concentrations stop changing though both reactions continue. *Reaction:* $\ce{N2 + 3H2 <=> 2NH3}$. `equilibrium` `foundations`
> **Equilibrium constant (K)** — The position of equilibrium. *Key fact:* $K=\dfrac{[\text{products}]^{\text{coeff}}}{[\text{reactants}]^{\text{coeff}}}$; large $K$ favors products. `equilibrium`
> **Kc and Kp** — Concentration vs pressure constants. *Key fact:* $K_c$ uses molarities, $K_p$ uses partial pressures; $K_p=K_c(RT)^{\Delta n}$. `equilibrium`
> **Reaction quotient (Q)** — Progress toward equilibrium. *Key fact:* compare $Q$ to $K$: $Q<K$ shifts forward, $Q>K$ shifts reverse. `equilibrium`
> **Le Chatelier's principle** — Systems counter a disturbance. *Key fact:* changing concentration, pressure, or temperature shifts equilibrium to partly offset the change. *Example:* adding reactant pushes the reaction forward. `equilibrium`
> **ΔG and K** — Thermodynamics meets equilibrium. *Key fact:* $\Delta G^\circ=-RT\ln K$; a negative $\Delta G^\circ$ means $K>1$. `equilibrium` `thermo`
> **Solubility product (Ksp)** — Equilibrium for dissolving salts. *Key fact:* $K_{sp}$ is the ion product at saturation; precipitation occurs once the ion product exceeds it. *Reaction:* $\ce{AgCl <=> Ag+ + Cl-}$. `equilibrium`
> **Common-ion effect** — A shared ion shifts equilibrium. *Key fact:* adding an ion already present lowers solubility or changes pH. `equilibrium`
> **Dynamic equilibrium** — Hidden, continuing activity. *Key fact:* macroscopic properties are constant while microscopic exchange persists. `equilibrium`

### Family 10 — Acids, Bases & Aqueous Equilibria

> **Arrhenius acids & bases** — The first definition. *Key fact:* acids release $\ce{H+}$, bases release $\ce{OH-}$, in water. *Example:* $\ce{HCl}$, $\ce{NaOH}$. `acid-base` `foundations`
> **Brønsted-Lowry acids & bases** — Proton donors and acceptors. *Key fact:* an acid donates $\ce{H+}$, a base accepts it, forming conjugate pairs. *Reaction:* $\ce{NH3 + H2O <=> NH4+ + OH-}$. `acid-base`
> **Lewis acids & bases** — Electron-pair view. *Key fact:* a Lewis acid accepts an electron pair, a base donates one — broader than proton transfer. *Example:* $\ce{BF3}$ is a Lewis acid. `acid-base`
> **Autoionization of water** — Water's self-reaction. *Key fact:* $\ce{2H2O <=> H3O+ + OH-}$ with $K_w=[\ce{H+}][\ce{OH-}]=10^{-14}$ at 25 °C. `acid-base`
> **pH and pOH** — The acidity scale. *Key fact:* $\text{pH}=-\log[\ce{H+}]$ and $\text{pH}+\text{pOH}=14$ at 25 °C. *Example:* pH 7 is neutral. `acid-base`
> **Ka and Kb** — Acid/base strength constants. *Key fact:* the ionization equilibrium constant; larger $K_a$ means a stronger acid, and $K_aK_b=K_w$ for a conjugate pair. `acid-base`
> **Strong vs weak acids/bases** — Degree of ionization. *Key fact:* strong ones ionize completely; weak ones only partially, set by $K_a/K_b$. *Example:* $\ce{HCl}$ strong, $\ce{CH3COOH}$ weak. `acid-base`
> **Buffers** — Resisting pH change. *Key fact:* a weak acid plus its conjugate base absorbs added acid or base. *Example:* the blood bicarbonate buffer. `acid-base`
> **Henderson-Hasselbalch equation** — Buffer pH. *Key fact:* $\text{pH}=\text{p}K_a+\log\dfrac{[\ce{A-}]}{[\ce{HA}]}$. `acid-base`
> **Titration & neutralization** — Quantifying acid or base. *Key fact:* acid and base react to the equivalence point, found with an indicator or pH meter. *Reaction:* $\ce{HCl + NaOH -> NaCl + H2O}$. `acid-base` `analytical`
> **Salt hydrolysis** — Salts that aren't neutral. *Key fact:* ions of weak acids/bases react with water, making some salt solutions acidic or basic. *Example:* $\ce{NH4Cl}$ is acidic. `acid-base`

### Family 11 — Electrochemistry & Redox

> **Oxidation & reduction (redox)** — Electron-transfer reactions. *Key fact:* oxidation is electron loss, reduction is electron gain (OIL RIG); they always occur together. `electrochem` `foundations`
> **Oxidation states** — Bookkeeping charges. *Key fact:* hypothetical charges assigned by electronegativity rules; their change identifies redox. *Example:* O is usually $-2$, H usually $+1$. `electrochem`
> **Half-reactions** — Splitting redox in two. *Key fact:* separate oxidation and reduction equations balanced for atoms and charge. `electrochem`
> **Oxidizing & reducing agents** — The electron traders. *Key fact:* the oxidizing agent is reduced (takes electrons); the reducing agent is oxidized (gives them). `electrochem`
> **Galvanic (voltaic) cell** — Spontaneous redox makes electricity. *Key fact:* separated half-reactions drive electrons through a wire; $\Delta G<0$, cell voltage $>0$. *Example:* the Daniell cell. `electrochem`
> **Electrolytic cell** — Electricity drives nonspontaneous redox. *Key fact:* an external voltage forces a reaction with $\Delta G>0$. *Example:* electrolysis of water. `electrochem`
> **Standard electrode potential** — Ranking redox strength. *Key fact:* half-cell potentials $E^\circ$ vs the standard hydrogen electrode; cell EMF $=E^\circ_\text{cathode}-E^\circ_\text{anode}$. `electrochem`
> **Nernst equation** — Voltage away from standard conditions. *Key fact:* $E=E^\circ-\dfrac{RT}{nF}\ln Q$. `electrochem` `[xref: mathematics]`
> **Faraday's laws of electrolysis** — Charge to mass. *Key fact:* mass deposited is proportional to charge passed; $F=96{,}485\ \text{C mol}^{-1}$. `electrochem`
> **Batteries & fuel cells** — Packaged and flow-through chemical power. *Key fact:* batteries package galvanic cells; fuel cells convert a fuel such as $\ce{H2}$ to electricity continuously. `electrochem` `applied`
> **Corrosion** — Unwanted environmental redox. *Key fact:* metals oxidize in air and water (rusting); prevented by coating or cathodic protection. *Reaction:* $\ce{4Fe + 3O2 -> 2Fe2O3}$. `electrochem`

## SECTION C — Organic Chemistry: The Chemistry of Carbon
*Compound classes (the reaction-network nodes), the named reactions that interconvert them (the edges), 3-D structure, and macromolecules.* 

### Family 12 — Functional Groups & Compound Classes

> **Hydrocarbons** — Compounds of only carbon and hydrogen. *Key fact:* the framework of organic chemistry; saturated (alkanes) or unsaturated (alkenes/alkynes/aromatics). *Formula:* $\ce{CH4}$, $\ce{C6H6}$. `organic` `node`
> **Alkanes** — Single-bonded hydrocarbons. *Key fact:* saturated, $\ce{C_nH_{2n+2}}$; relatively unreactive. *Formula:* methane $\ce{CH4}$, ethane $\ce{C2H6}$. `organic` `node`
> **Alkenes** — Carbon-carbon double bonds. *Key fact:* unsaturated, $\ce{C_nH_{2n}}$; the $\ce{C=C}$ undergoes addition. *Formula:* ethene $\ce{C2H4}$. `organic` `node`
> **Alkynes** — Carbon-carbon triple bonds. *Key fact:* the $\ce{C#C}$ bond is even more unsaturated and reactive. *Formula:* ethyne (acetylene) $\ce{C2H2}$. `organic` `node`
> **Aromatic compounds (arenes)** — Stabilized ring systems. *Key fact:* benzene-type rings with delocalized $\pi$ electrons (Hückel's $4n+2$ rule); unusually stable. *Formula:* benzene $\ce{C6H6}$. `organic` `node`
> **Haloalkanes (alkyl halides)** — Carbon bonded to halogen. *Key fact:* the $\ce{C-X}$ bond is a good site for substitution and elimination. *Formula:* chloromethane $\ce{CH3Cl}$. `organic` `node`
> **Alcohols** — The hydroxyl group. *Key fact:* $\ce{-OH}$ on carbon; primary/secondary/tertiary; hydrogen-bond and oxidize. *Formula:* ethanol $\ce{C2H5OH}$. `organic` `node`
> **Ethers** — Oxygen bridging two carbons. *Key fact:* $\ce{R-O-R'}$; fairly unreactive, useful solvents. *Formula:* diethyl ether $\ce{(C2H5)2O}$. `organic` `node`
> **Aldehydes** — A terminal carbonyl. *Key fact:* $\ce{-CHO}$ at a chain end; readily oxidized to acids. *Formula:* formaldehyde $\ce{HCHO}$. `organic` `node`
> **Ketones** — An internal carbonyl. *Key fact:* a $\ce{C=O}$ between two carbons; resists further oxidation. *Formula:* acetone $\ce{(CH3)2CO}$. `organic` `node`
> **Carboxylic acids** — The carboxyl group. *Key fact:* $\ce{-COOH}$; weakly acidic and hydrogen-bonding. *Formula:* acetic acid $\ce{CH3COOH}$. `organic` `node`
> **Esters** — An acid-plus-alcohol condensation product. *Key fact:* the $\ce{-COO-}$ linkage; often fragrant; hydrolyze back to acid and alcohol. *Formula:* ethyl acetate $\ce{CH3COOC2H5}$. `organic` `node`
> **Amines** — Nitrogen with a lone pair. *Key fact:* $\ce{-NH2}$ and relatives; basic, derived from ammonia. *Formula:* methylamine $\ce{CH3NH2}$. `organic` `node`
> **Amides** — A carbonyl bonded to nitrogen. *Key fact:* the $\ce{-CONH2}$ group; the peptide linkage of proteins; weakly basic. *Formula:* acetamide $\ce{CH3CONH2}$. `organic` `node`
> **Nitriles** — The cyano group. *Key fact:* a $\ce{C#N}$ group; hydrolyzes to acids or reduces to amines. *Formula:* acetonitrile $\ce{CH3CN}$. `organic` `node`
> **Phenols & thiols** — Aromatic $\ce{-OH}$ and sulfur $\ce{-SH}$. *Key fact:* phenols are more acidic ring alcohols; thiols are pungent sulfur analogues of alcohols. *Formula:* phenol $\ce{C6H5OH}$. `organic` `node`

### Family 13 — Organic Reactions & Mechanisms

> **Nucleophilic substitution (SN1/SN2)** — Swapping a leaving group. *Key fact:* a nucleophile replaces a leaving group; SN2 is one-step/bimolecular, SN1 two-step via a carbocation. *Transforms:* haloalkane → alcohol / ether / amine / nitrile. `organic` `mechanism` `edge`
> **Elimination (E1/E2)** — Forming a double bond. *Key fact:* loss of H and a leaving group makes an alkene; E2 is concerted, E1 goes through a carbocation. *Transforms:* haloalkane → alkene. `organic` `mechanism` `edge`
> **Electrophilic addition** — Adding across a double bond. *Key fact:* electrophiles add to alkene/alkyne $\pi$ bonds. *Transforms:* alkene → haloalkane / alcohol. *Reaction:* $\ce{C2H4 + HBr -> C2H5Br}$. `organic` `mechanism` `edge`
> **Markovnikov's rule** — Regioselectivity of addition. *Key fact:* in HX addition, H adds to the carbon already bearing more hydrogens (the more stable carbocation forms). `organic` `mechanism`
> **Hydration of alkenes** — Adding water. *Key fact:* acid-catalyzed addition of water across a $\ce{C=C}$. *Transforms:* alkene → alcohol. `organic` `edge`
> **Hydrogenation** — Adding $\ce{H2}$. *Key fact:* metal-catalyzed (Pt/Pd/Ni) addition of hydrogen to multiple bonds. *Transforms:* alkene / alkyne → alkane. *Example:* hardening vegetable oils. `organic` `edge`
> **Free-radical halogenation** — Replacing H with halogen. *Key fact:* a UV-initiated radical chain on alkanes. *Transforms:* alkane → haloalkane. *Reaction:* $\ce{CH4 + Cl2 ->[h\nu] CH3Cl + HCl}$. `organic` `mechanism` `edge`
> **Electrophilic aromatic substitution** — Functionalizing benzene. *Key fact:* an electrophile replaces a ring H while aromaticity is preserved (nitration, halogenation, Friedel-Crafts). *Transforms:* arene → substituted arene. `organic` `mechanism` `edge`
> **Oxidation of alcohols** — Climbing the oxidation ladder. *Key fact:* primary alcohols oxidize to aldehydes then carboxylic acids, secondary to ketones; tertiary resist. *Transforms:* alcohol → aldehyde / ketone → carboxylic acid. `organic` `edge`
> **Reduction of carbonyls** — Coming back down. *Key fact:* $\ce{NaBH4}$ or $\ce{LiAlH4}$ reduces aldehydes/ketones to alcohols. *Transforms:* aldehyde / ketone → alcohol. `organic` `edge`
> **Esterification (Fischer)** — Making an ester. *Key fact:* acid-catalyzed, reversible condensation of a carboxylic acid and an alcohol, losing water. *Transforms:* carboxylic acid + alcohol → ester. *Reaction:* $\ce{CH3COOH + C2H5OH <=> CH3COOC2H5 + H2O}$. `organic` `edge`
> **Hydrolysis & saponification** — Breaking esters. *Key fact:* esters hydrolyze to acid + alcohol; base hydrolysis (saponification) yields a carboxylate salt — soap. *Transforms:* ester → carboxylic acid / carboxylate + alcohol. `organic` `edge`
> **Grignard reaction** — Building C-C bonds. *Key fact:* an organomagnesium reagent $\ce{RMgX}$ adds to a carbonyl, giving a larger alcohol. *Transforms:* carbonyl → alcohol (new C-C bond). `organic` `edge`
> **Aldol reaction** — Coupling carbonyls. *Key fact:* an enolate attacks another carbonyl to give a $\beta$-hydroxy carbonyl. *Transforms:* aldehyde / ketone → β-hydroxy carbonyl. `organic` `edge`
> **Diels-Alder reaction** — A ring-forming cycloaddition. *Key fact:* a conjugated diene and a dienophile form a six-membered ring in one concerted step. *Transforms:* diene + alkene (dienophile) → cyclohexene. `organic` `edge`
> **Condensation & addition polymerization** — Building macromolecules. *Key fact:* monomers join by losing a small molecule (condensation) or by chain addition across double bonds. *Transforms:* monomer → polymer. *Example:* nylon (condensation), polyethylene (addition). `organic` `edge` `polymers`

### Family 14 — Stereochemistry & Isomerism

> **Isomers (overview)** — Same formula, different molecules. *Key fact:* constitutional isomers differ in connectivity; stereoisomers differ only in 3-D arrangement. `stereochem`
> **Constitutional (structural) isomers** — Different connectivity. *Key fact:* atoms bonded in a different order. *Example:* butane vs isobutane ($\ce{C4H10}$). `stereochem`
> **Stereoisomers** — Same connectivity, different geometry. *Key fact:* differ only in spatial arrangement; include enantiomers and diastereomers. `stereochem`
> **Chirality** — Non-superimposable mirror images. *Key fact:* a stereocenter (often a carbon with four different groups) makes a molecule "handed." *Example:* like your two hands. `stereochem`
> **Enantiomers** — Mirror-image stereoisomers. *Key fact:* identical in most physical properties but rotate polarized light oppositely and react differently with other chiral molecules. `stereochem`
> **Diastereomers** — Non-mirror stereoisomers. *Key fact:* stereoisomers that are not mirror images and differ in physical properties. *Example:* cis/trans pairs. `stereochem`
> **R/S configuration** — Naming chirality. *Key fact:* the Cahn-Ingold-Prelog priority rules assign R (clockwise) or S (counterclockwise) to a stereocenter. `stereochem`
> **Cis-trans (E/Z) isomerism** — Geometry about a double bond. *Key fact:* restricted rotation around a $\ce{C=C}$ fixes groups on the same (cis/Z) or opposite (trans/E) side. `stereochem`
> **Optical activity** — Rotating polarized light. *Key fact:* chiral substances rotate plane-polarized light; a 50:50 racemic mixture shows no net rotation. `stereochem`
> **Conformations** — Shapes from bond rotation. *Key fact:* rotation about single bonds gives staggered/eclipsed (Newman) and chair/boat (cyclohexane) forms of differing energy. `stereochem`

### Family 15 — Polymers & Macromolecules

> **Polymer** — A long chain of repeating units. *Key fact:* many monomers covalently linked; properties depend on chain length and structure. *Example:* polyethylene. `polymers`
> **Monomer & repeat unit** — The building block. *Key fact:* the small molecule that repeats along the chain. *Example:* ethylene becomes polyethylene. `polymers`
> **Addition polymerization** — Chain growth across double bonds. *Key fact:* monomers add with no atoms lost, via radical or ionic chains. *Example:* PVC, polystyrene. `polymers`
> **Condensation polymerization** — Step growth losing a small molecule. *Key fact:* monomers join while releasing water or HCl. *Example:* nylon, polyester (PET). `polymers`
> **Thermoplastics vs thermosets** — Reheatable vs set. *Key fact:* thermoplastics soften and reshape on heating; thermosets cross-link irreversibly. *Example:* PET vs epoxy. `polymers`
> **Cross-linking** — Bonds between chains. *Key fact:* covalent links between chains raise strength and rigidity. *Example:* vulcanized rubber. `polymers`
> **Elastomers** — Rubbery, stretchy polymers. *Key fact:* lightly cross-linked chains snap back after stretching. *Example:* natural rubber. `polymers`
> **Copolymers** — Two or more monomers. *Key fact:* mixing monomer types (random, block, graft) tunes properties. *Example:* ABS plastic. `polymers`
> **Biopolymers** — Natural macromolecules. *Key fact:* polymers made by living systems — proteins, polysaccharides, nucleic acids. *Example:* cellulose, DNA. `polymers`

## SECTION D — Inorganic, Materials & Nuclear Chemistry
*The elements beyond carbon chains, the solid state, and the nucleus.* 

### Family 16 — Inorganic & Coordination Chemistry

> **Inorganic chemistry (scope)** — Chemistry of non-carbon-chain compounds. *Key fact:* covers metals, minerals, salts, and main-group and transition-metal compounds. *Note:* the organic/inorganic boundary (carbonates, $\ce{CO2}$) is partly conventional. `inorganic` `classification`
> **Coordination complex** — A metal with attached ligands. *Key fact:* a central metal ion bonded to surrounding ligands by dative bonds. *Formula:* $\ce{[Cu(NH3)4]^2+}$. `inorganic`
> **Ligands** — Electron-pair donors to a metal. *Key fact:* molecules or ions (e.g. $\ce{H2O}$, $\ce{NH3}$, $\ce{Cl-}$, $\ce{CN-}$) that bind the metal center. `inorganic`
> **Chelation** — A multidentate grip. *Key fact:* a ligand binding through several atoms forms an extra-stable ring. *Example:* EDTA wrapping a metal ion. `inorganic`
> **Coordination number & geometry** — Ligands around a metal. *Key fact:* common counts are 4 (tetrahedral or square planar) and 6 (octahedral). *Formula:* $\ce{[Co(NH3)6]^3+}$ is octahedral. `inorganic` `geometry`
> **Crystal field theory** — Why complexes are colored and magnetic. *Key fact:* ligands split the metal d-orbitals in energy ($\Delta_o$); the gap sets color and high/low-spin state. `inorganic` `[xref: mathematics]`
> **Transition-metal chemistry** — Variable-valence d-block behavior. *Key fact:* multiple oxidation states, complex formation, catalysis, and color. *Example:* $\ce{Fe^2+}$ vs $\ce{Fe^3+}$. `inorganic`
> **Oxidation states of metals** — Many accessible charges. *Key fact:* d-electrons allow several stable charges. *Formula:* manganese spans $+2$ to $+7$ (e.g. $\ce{MnO4-}$). `inorganic`
> **Organometallic compounds** — Metal-carbon bonds. *Key fact:* direct $\ce{M-C}$ bonds; central to homogeneous catalysis. *Example:* ferrocene, Grignard reagents. `inorganic`
> **Hard-soft acid-base (HSAB)** — Matching for stability. *Key fact:* hard acids prefer hard bases and soft prefer soft, predicting complex stability. `inorganic` `acid-base`
> **Main-group chemistry** — The s- and p-block compounds. *Key fact:* the chemistry of nonmetals and post-transition metals — oxides, halides, acids. *Example:* boranes, silicates. `inorganic`
> **Industrial & inorganic catalysts** — Metal-based rate enhancers. *Key fact:* transition metals and their compounds catalyze large-scale reactions. *Example:* iron in the Haber process. `inorganic` `kinetics`

### Family 17 — Materials & Solid-State Chemistry

> **Crystalline vs amorphous solids** — Order vs disorder. *Key fact:* crystals have long-range repeating order; amorphous solids (glass) do not. `materials` `states`
> **Crystal lattice & unit cell** — The repeating motif. *Key fact:* the unit cell tiles space to build the lattice. *Example:* simple cubic, FCC, BCC. `materials`
> **Close packing (FCC, HCP, BCC)** — How atoms stack. *Key fact:* metals pack to maximize density; FCC and HCP reach about 74% packing efficiency. `materials`
> **Types of solids** — Bonding-based classes. *Key fact:* ionic, covalent-network, molecular, and metallic solids differ sharply in hardness, melting point, and conductivity. *Example:* diamond (covalent network) vs ice (molecular). `materials` `bonding`
> **Band theory** — Electrons in solids. *Key fact:* atomic orbitals merge into valence and conduction bands; the band gap sets conductor/semiconductor/insulator behavior. `materials` `[xref: mathematics]`
> **Semiconductors & doping** — Tunable conductors. *Key fact:* small band gaps; adding impurities (n-type or p-type) controls conductivity. *Example:* silicon doped with P or B. `materials`
> **Alloys** — Metal mixtures. *Key fact:* blending metals tunes strength, hardness, and corrosion resistance. *Example:* steel ($\ce{Fe}$ + C), bronze ($\ce{Cu}$ + $\ce{Sn}$). `materials`
> **Ceramics** — Inorganic non-metallic solids. *Key fact:* hard, heat-resistant, brittle covalent/ionic networks. *Example:* alumina, silicon carbide. `materials`
> **Nanomaterials** — Structures at the nanoscale. *Key fact:* properties shift when dimensions approach nanometers (high surface area, quantum effects). *Example:* graphene, carbon nanotubes, quantum dots. `materials`
> **Crystal defects** — Imperfections that matter. *Key fact:* point, line, and plane defects (vacancies, dislocations) govern strength, diffusion, and color. `materials`
> **X-ray crystallography** — Seeing atomic arrangement. *Key fact:* diffraction reveals structure via Bragg's law, $n\lambda=2d\sin\theta$. *Example:* solved the structure of DNA. `materials` `analytical`

### Family 18 — Nuclear & Radiochemistry

> **Radioactivity** — Spontaneous nuclear decay. *Key fact:* unstable nuclei emit radiation to reach stability. *Example:* uranium, radium. `nuclear`
> **Alpha, beta & gamma decay** — Three classic modes. *Key fact:* $\alpha$ emits a $\ce{^4He}$ nucleus, $\beta$ emits an electron/positron, $\gamma$ emits a photon. *Reaction:* $\ce{^{238}U ->[\alpha] ^{234}Th}$. `nuclear`
> **Half-life (nuclear)** — Time for half a sample to decay. *Key fact:* decay is first-order, $N=N_0e^{-\lambda t}$ with $t_{1/2}=\ln 2/\lambda$. `nuclear` `[xref: mathematics]`
> **Nuclear binding energy** — The nucleus's glue. *Key fact:* the mass defect converts to binding energy via $E=mc^2$; iron is the most tightly bound. `nuclear`
> **Mass-energy equivalence** — Mass as energy. *Key fact:* $E=mc^2$ underlies the enormous energy of nuclear reactions. `nuclear`
> **Nuclear fission** — Splitting heavy nuclei. *Key fact:* a heavy nucleus splits into fragments plus neutrons, releasing energy and able to sustain a chain reaction. *Example:* $\ce{^{235}U}$ in reactors. `nuclear`
> **Nuclear fusion** — Joining light nuclei. *Key fact:* light nuclei merge into a heavier one, releasing more energy per nucleon than fission. *Example:* hydrogen fusion powers the Sun. `nuclear`
> **Radioactive decay chains** — Step-by-step to stability. *Key fact:* a heavy isotope decays through a series of daughters to a stable end; e.g. $\ce{^{238}U}$ leads through many steps to $\ce{^{206}Pb}$. `nuclear`
> **Radiometric dating** — Clocks from decay. *Key fact:* known half-lives date materials from isotope ratios. *Example:* $\ce{^{14}C}$ dating of organic remains. `nuclear` `applied`
> **Transmutation & synthetic elements** — Changing one element into another. *Key fact:* bombarding nuclei creates new isotopes and elements; every element past uranium is essentially synthetic. *Example:* plutonium, oganesson. `nuclear`
> **Nuclear medicine & isotopes** — Applied radiochemistry. *Key fact:* radioisotopes diagnose and treat disease. *Example:* $\ce{^{99m}Tc}$ imaging, $\ce{^{131}I}$ therapy. `nuclear` `applied`

## SECTION E — Analytical, Biological & Cross-cutting Chemistry
*How we measure matter, the chemistry of life, and the great reactions and open questions.* 

### Family 19 — Analytical Chemistry & Instrumentation

> **Analytical chemistry (scope)** — Identifying and quantifying matter. *Key fact:* qualitative analysis asks "what is present"; quantitative asks "how much." `analytical`
> **Gravimetric & volumetric analysis** — Classic quantification. *Key fact:* measure the mass of a precipitate (gravimetric) or a volume delivered in a titration (volumetric). `analytical`
> **Beer-Lambert law** — Absorbance vs concentration. *Key fact:* $A=\varepsilon b c$; absorbance is linear in concentration, enabling spectrophotometric assays. `analytical` `[xref: statistics]`
> **UV-visible spectroscopy** — Electronic transitions. *Key fact:* absorption of UV/visible light probes conjugation and concentration. *Example:* measuring colored complexes. `analytical`
> **Infrared (IR) spectroscopy** — Bond vibrations. *Key fact:* functional groups absorb characteristic IR frequencies, fingerprinting structure. *Example:* a strong $\ce{C=O}$ stretch near $1700\ \mathrm{cm^{-1}}$. `analytical`
> **NMR spectroscopy** — Nuclei in a magnetic field. *Key fact:* $\ce{^1H}$ and $\ce{^{13}C}$ environments give chemical shifts and splitting that map structure. *Example:* the workhorse of organic structure determination. `analytical`
> **Mass spectrometry** — Weighing molecular fragments. *Key fact:* ionize, separate by mass-to-charge ($m/z$), and detect; gives molecular mass and a fragmentation pattern. `analytical`
> **Chromatography** — Separating mixtures. *Key fact:* components partition between a mobile and a stationary phase, separating by affinity. *Example:* TLC, GC, HPLC. `analytical`
> **Atomic absorption/emission** — Element-specific light. *Key fact:* atoms absorb or emit characteristic wavelengths, quantifying metals. *Example:* flame tests, AAS. `analytical`
> **Electrochemical analysis** — Measuring via potential or current. *Key fact:* potentiometry (e.g. pH electrodes) and voltammetry quantify species. `analytical` `electrochem`
> **Calibration & standards** — Turning signal into concentration. *Key fact:* a calibration curve from known standards converts instrument response into amount. `analytical` `[xref: statistics]`
> **Measurement error & significant figures** — Honest numbers. *Key fact:* accuracy vs precision; significant figures and stated uncertainty convey reliability. `analytical` `[xref: statistics]`

### Family 20 — Biochemistry & Chemical Biology

> **Biochemistry (scope)** — The chemistry of life. *Key fact:* studies the molecules and reactions of living systems. *Note:* whether biochemistry is "chemistry" or "biology" is a matter of framing; it sits between. `biochem` `classification`
> **Amino acids** — Protein building blocks. *Key fact:* an amine, a carboxyl, and a side chain on one carbon; 20 standard ones, almost all chiral (L). *Example:* glycine, alanine. `biochem`
> **Proteins & the peptide bond** — Folded amino-acid chains. *Key fact:* amino acids link by amide (peptide) bonds; sequence dictates the 3-D fold and function. `biochem`
> **Enzymes** — Biological catalysts. *Key fact:* proteins that hugely accelerate specific reactions by lowering activation energy. *Example:* amylase, DNA polymerase. `biochem` `kinetics`
> **Enzyme kinetics (Michaelis-Menten)** — Rate of catalysis. *Key fact:* $v=\dfrac{V_{\max}[S]}{K_M+[S]}$; the rate saturates at high substrate. `biochem` `[xref: mathematics]`
> **Carbohydrates** — Sugars and polysaccharides. *Key fact:* energy molecules of formula near $\ce{C_nH_{2n}O_n}$; mono-, di-, and polysaccharides. *Example:* glucose, starch, cellulose. `biochem`
> **Lipids** — Fats, oils, and membranes. *Key fact:* hydrophobic molecules that store energy and form bilayer membranes. *Example:* triglycerides, phospholipids. `biochem`
> **Nucleic acids (DNA & RNA)** — Information molecules. *Key fact:* nucleotide polymers that encode and express genetic information; base pairing A-T/U and G-C. `biochem`
> **ATP & bioenergetics** — The cell's energy currency. *Key fact:* ATP hydrolysis releases energy to drive endergonic biochemistry. `biochem` `thermo`
> **Metabolism** — Networks of biochemical reactions. *Key fact:* catabolism breaks molecules down for energy; anabolism builds them up. *Example:* glycolysis, the citric-acid cycle. `biochem`
> **Cofactors & coenzymes** — Helper molecules. *Key fact:* non-protein helpers (metal ions, vitamin-derived $\ce{NAD+}$) that enzymes require. `biochem`
> **pH & buffering in biology** — Life's narrow window. *Key fact:* enzymes work in tight pH ranges held by biological buffers. *Example:* blood near pH 7.4. `biochem` `acid-base`

### Family 21 — Great Reactions, Industrial Processes & Open Questions

> **Combustion** — Burning fuel in oxygen. *Key fact:* rapid exothermic oxidation to $\ce{CO2}$ and $\ce{H2O}$. *Reaction:* $\ce{CH4 + 2O2 -> CO2 + 2H2O}$. `reaction` `applied`
> **Photosynthesis (global reaction)** — Sunlight into sugar. *Key fact:* the basis of the biosphere's carbon and oxygen. *Reaction:* $\ce{6CO2 + 6H2O ->[light] C6H12O6 + 6O2}$. `reaction` `biochem`
> **Haber-Bosch process** — Industrial ammonia. *Key fact:* fixes atmospheric nitrogen for fertilizer, feeding billions; energy-intensive at high $P$ and $T$. *Reaction:* $\ce{N2 + 3H2 <=>[Fe] 2NH3}$. `reaction` `applied` `equilibrium`
> **Contact process** — Sulfuric acid manufacture. *Key fact:* the route to the most-produced industrial chemical. *Reaction:* $\ce{2SO2 + O2 <=>[V2O5] 2SO3}$ (then to $\ce{H2SO4}$). `reaction` `applied`
> **Ostwald process** — Nitric acid from ammonia. *Key fact:* catalytic oxidation of $\ce{NH3}$ to $\ce{NO}$ and on to $\ce{HNO3}$. `reaction` `applied`
> **Chlor-alkali process** — Electrolyzing brine. *Key fact:* electrolysis of aqueous $\ce{NaCl}$ yields $\ce{Cl2}$, $\ce{H2}$, and $\ce{NaOH}$. `reaction` `applied` `electrochem`
> **Hall-Héroult process** — Smelting aluminum. *Key fact:* electrolysis of alumina dissolved in molten cryolite produces aluminum metal. `reaction` `applied` `electrochem`
> **Origin-of-life chemistry (abiogenesis)** — How chemistry became biology. *Key fact:* how self-replicating, metabolizing systems first arose from prebiotic molecules is unresolved; the "RNA world" is a leading hypothesis, not a settled answer. `open-question`
> **Homochirality of life** — Why life is single-handed. *Key fact:* living systems use almost only L-amino acids and D-sugars; why this handedness was selected is open. `open-question`
> **Room-temperature superconductivity** — A still-unmet goal. *Key fact:* no material is an accepted ambient-pressure room-temperature superconductor; the 2023 LK-99 claim was refuted (effects traced to impurities) and a separate high-pressure lutetium-hydride report was retracted. `open-question` `materials`
> **High-temperature superconductivity mechanism** — Theory lags experiment. *Key fact:* the electron-pairing mechanism in cuprate and related high-$T_c$ superconductors is not fully explained. `open-question` `materials`
> **Catalytic ambient nitrogen fixation** — Beating Haber-Bosch. *Key fact:* biological nitrogenase fixes $\ce{N2}$ at ambient conditions; a comparably efficient synthetic catalyst remains a major goal. `open-question` `kinetics`
> **Crystal-structure & reaction prediction** — Predicting matter from first principles. *Key fact:* reliably predicting a compound's crystal structure or a synthesis route from theory alone is still hard, though computation and machine learning are advancing quickly. `open-question` `[xref: mathematics]`

---

# ELEMENT DATASET (for the periodic-table view)

> The interactive periodic table renders **all 118 confirmed elements** in the standard period × group layout (f-block shown below). Use a **canonical 118-element dataset** (symbol, atomic number, name, group, period, block, standard atomic weight, category) for exact placement; the categories and memberships below define the **coloring** and surface the **disputed assignments**. Do not invent elements beyond Z=118.

**Well-defined categories (full membership):**
- **Alkali metals** (group 1): Li, Na, K, Rb, Cs, Fr.
- **Alkaline earth metals** (group 2): Be, Mg, Ca, Sr, Ba, Ra.
- **Halogens** (group 17): F, Cl, Br, I, At (and Ts by position).
- **Noble gases** (group 18): He, Ne, Ar, Kr, Xe, Rn (and Og by position).
- **Lanthanides** (4f, Z 57-71): La, Ce, Pr, Nd, Pm, Sm, Eu, Gd, Tb, Dy, Ho, Er, Tm, Yb, Lu.
- **Actinides** (5f, Z 89-103): Ac, Th, Pa, U, Np, Pu, Am, Cm, Bk, Cf, Es, Fm, Md, No, Lr.

**Fuzzy categories (color, but flag as not universally agreed):**
- **Transition metals** — the d-block (groups 3-12). Whether **group 12 (Zn, Cd, Hg)** counts as transition metals is debated (their d-subshells are full); some schemes exclude them.
- **Metalloids** — commonly B, Si, Ge, As, Sb, Te (sometimes Po, At); the exact set is not standardized.
- **Post-transition ("poor") metals** — e.g. Al, Ga, In, Tl, Sn, Pb, Bi; the boundary with the metalloids is fuzzy.
- **Reactive nonmetals** — H, C, N, O, P, S, Se, plus the halogens.

**Disputed placements to surface (do not hard-code one answer):**
- **Hydrogen** — placed in group 1, above the halogens, or standalone, depending on the table.
- **Group 3** — Sc and Y, then **either La and Ac or Lu and Lr** by convention (an unresolved IUPAC question).
- **Helium** — group 18 by chemistry, but its electron configuration ($\ce{1s^2}$) resembles group 2; a few tables relocate it.

---

# COLOR & GROUPING

- **Color by section, not by family** — five sections, five base hues, drawn from the existing sibling palette (keep the whole page to roughly six hues or fewer):
  - **A — Foundations** (atoms, periodicity, bonding, forces)
  - **B — Physical Chemistry** (stoichiometry, gases, thermo, kinetics, equilibrium, acids/bases, electrochemistry)
  - **C — Organic Chemistry** (functional groups, reactions, stereochemistry, polymers)
  - **D — Inorganic, Materials & Nuclear**
  - **E — Analytical, Biological & Cross-cutting**
- **Shade-vary within a section** so families are distinguishable but clearly siblings; do not give each family an unrelated hue.
- **The periodic-table view is colored separately** by element **category** (with a toggle to **block** s/p/d/f) — this is its own scheme, independent of the five section hues; do not force section colors onto the table.
- **Reaction-network graph:** color nodes by their family/section; keep edges neutral so reaction direction stays readable.

---

# ACCEPTANCE CRITERIA

- [ ] `/chemistry` renders as a sibling of `/statistics`, `/finance`, `/governance`, `/ideologies`, `/sports`, and `/mathematics`, reusing the same components and styling.
- [ ] **MathJax or KaTeX is initialized with the `mhchem` extension**; every `\ce{...}` formula/equation and every plain-LaTeX relation renders correctly in both the collapsed card and the expansion — no raw `\ce{...}` text and no unicode-subscript fallback anywhere.
- [ ] Families are collapsible and color-coded; **five section hues**, shaded within; the "N families · M entries" counts are computed from the data, not hard-coded.
- [ ] A sticky filter plus Expand/Collapse all is present; the filter matches the **rendered/plain-text** form of formulas (searching "H2O", "ammonia", or "sulfuric acid" works).
- [ ] **Headline 1 — reaction-transformation network:** built from the `transforms` fields, reusing the existing **Edges model**; nodes are clickable and route to cards; at minimum the organic-reaction subgraph renders (ideally a zoomable site-wide synthesis map); multiple/branching edges allowed (not required to be acyclic).
- [ ] **Headline 2 — interactive periodic table:** all 118 elements in the standard period × group layout from the element dataset; colored by category (toggle to block); cells clickable; **disputed placements surfaced**, not silently resolved.
- [ ] Cards show name, one-line description, the `key fact` (core/searchable), and `formula`/`reaction` where applicable; expansions follow the structure (intuition · key fact/formula · location & neighbors · worked example · related claims).
- [ ] Optional `/chemistry/methods` deep-dive exists for the ~10 foundational topics, or a stub is left.
- [ ] Entries tagged `[xref: mathematics]` and `[xref: statistics]` **link to the sibling page** rather than duplicating content.
- [ ] **Verified facts are reflected:** the periodic table has **118 confirmed elements** with **oganesson (Z=118) heaviest and period 7 complete** (last four added 2016); **room-temperature ambient-pressure superconductivity is not achieved** (LK-99 refuted; the high-pressure lutetium-hydride claim retracted). Re-verify both at build time.
- [ ] **Disputed classifications are presented neutrally:** hydrogen's placement, group-3 membership, the metalloid set, group-12 as transition metals, biochemistry as "chemistry" vs "biology", the organic/inorganic boundary, and "pure" vs "applied."
- [ ] Footer carries the free-text-search caveat, a "claim cross-references pending" roadmap line, and a **"last updated"** date.
- [ ] Coverage is **exhaustive (~248 entries)** and notable rather than padded; all prose is plain ASCII with chemistry living only inside `\ce{...}`/LaTeX; the file is corruption-free.
