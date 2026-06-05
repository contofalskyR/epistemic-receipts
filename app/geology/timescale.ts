import type { TimeUnit, MohsMineral } from "./types";

// Boundary ages follow the International Chronostratigraphic Chart (ICS) v2023.
// Source: stratigraphy.org/chart. Ages are in millions of years ago (Ma).
// Quaternary boundary at 2.58 Ma; Cretaceous–Paleogene at 66.0 Ma; Permian–Triassic at 251.9 Ma.
export const TIME_UNITS: TimeUnit[] = [
  // ── Eons ────────────────────────────────────────────────────────────────
  { name: "Hadean",       level: "eon", startMa: 4567, endMa: 4031, color: "#3a1a3a", events: ["Earth accretion (4.567 Ga)", "Moon-forming Theia impact (~4.51 Ga)", "Magma ocean", "No preserved crust except detrital zircons (Jack Hills, ≤4.4 Ga)"] },
  { name: "Archean",      level: "eon", startMa: 4031, endMa: 2500, color: "#5b2a5b", events: ["First continental crust (cratons)", "Earliest fossil microbes (~3.5 Ga stromatolites)", "Anoxic atmosphere", "Banded iron formations begin"] },
  { name: "Proterozoic",  level: "eon", startMa: 2500, endMa: 538.8, color: "#7c3f7c", events: ["Great Oxidation Event (~2.4 Ga)", "Eukaryotes (~1.8 Ga)", "Rodinia supercontinent", "Snowball Earth glaciations", "Ediacaran biota"] },
  { name: "Phanerozoic",  level: "eon", startMa: 538.8, endMa: 0,    color: "#0e7c5e", events: ["Cambrian explosion", "Five mass extinctions", "Rise of animals, plants, dinosaurs, mammals"] },
  // ── Eras (Phanerozoic) ──────────────────────────────────────────────────
  { name: "Paleozoic",    level: "era", startMa: 538.8, endMa: 251.9, parent: "Phanerozoic", color: "#7c6f1f", events: ["Cambrian explosion (~538 Ma)", "First land plants & vertebrates", "Pangaea assembles", "Permian–Triassic mass extinction (~96% marine species lost)"] },
  { name: "Mesozoic",     level: "era", startMa: 251.9, endMa: 66.0,  parent: "Phanerozoic", color: "#1f7c4f", events: ["Age of dinosaurs", "Pangaea breaks up", "First mammals & birds", "Flowering plants emerge", "Chicxulub impact ends era"] },
  { name: "Cenozoic",     level: "era", startMa: 66.0,  endMa: 0,     parent: "Phanerozoic", color: "#1f5c7c", events: ["Mammals diversify", "Himalayas rise (India–Asia collision)", "Pleistocene glaciations", "Hominin evolution", "Anthropocene proposed"] },
  // ── Periods (Paleozoic) ─────────────────────────────────────────────────
  { name: "Cambrian",      level: "period", startMa: 538.8, endMa: 485.4, parent: "Paleozoic", color: "#9c8a2f", events: ["Cambrian explosion: most modern animal phyla appear", "Trilobites, brachiopods, anomalocaridids", "Burgess Shale fossils"] },
  { name: "Ordovician",    level: "period", startMa: 485.4, endMa: 443.8, parent: "Paleozoic", color: "#a89a3f", events: ["First land plants (liverworts)", "Great Ordovician biodiversification", "End-Ordovician mass extinction (~85% species, glaciation)"] },
  { name: "Silurian",      level: "period", startMa: 443.8, endMa: 419.2, parent: "Paleozoic", color: "#b4aa4f", events: ["First jawed fish", "Vascular land plants (Cooksonia)", "Coral reefs flourish"] },
  { name: "Devonian",      level: "period", startMa: 419.2, endMa: 358.9, parent: "Paleozoic", color: "#c0ba5f", events: ["Age of Fishes", "First tetrapods (Tiktaalik, Ichthyostega)", "First forests (Archaeopteris)", "Late Devonian extinction"] },
  { name: "Carboniferous", level: "period", startMa: 358.9, endMa: 298.9, parent: "Paleozoic", color: "#9c7a2f", events: ["Vast coal swamps", "First reptiles, winged insects (Meganeura)", "Atmospheric O₂ ~35%", "Pangaea assembling"] },
  { name: "Permian",       level: "period", startMa: 298.9, endMa: 251.9, parent: "Paleozoic", color: "#a82a3f", events: ["Pangaea complete", "Synapsid (proto-mammal) radiation", "End-Permian extinction — worst in Earth history, Siberian Traps volcanism"] },
  // ── Periods (Mesozoic) ──────────────────────────────────────────────────
  { name: "Triassic",      level: "period", startMa: 251.9, endMa: 201.4, parent: "Mesozoic", color: "#2f7c5f", events: ["Recovery from Permian extinction", "First dinosaurs, mammals", "Pangaea begins to break up", "End-Triassic extinction (CAMP volcanism)"] },
  { name: "Jurassic",      level: "period", startMa: 201.4, endMa: 145.0, parent: "Mesozoic", color: "#3f8c6f", events: ["Sauropods, theropods, plesiosaurs", "Archaeopteryx (first bird-like)", "Atlantic Ocean opens", "Coral reefs (modern type) appear"] },
  { name: "Cretaceous",    level: "period", startMa: 145.0, endMa: 66.0,  parent: "Mesozoic", color: "#4f9c7f", events: ["Flowering plants diversify", "T. rex, Triceratops", "K-Pg extinction (Chicxulub impact, Deccan Traps) ends dinosaurs, ammonites, mosasaurs"] },
  // ── Periods (Cenozoic) ──────────────────────────────────────────────────
  { name: "Paleogene",     level: "period", startMa: 66.0,  endMa: 23.03, parent: "Cenozoic", color: "#2f6c8c", events: ["Mammal radiation", "Whales evolve from land mammals", "PETM thermal maximum (~56 Ma)", "Antarctic ice sheet forms (~34 Ma)"] },
  { name: "Neogene",       level: "period", startMa: 23.03, endMa: 2.58,  parent: "Cenozoic", color: "#3f7c9c", events: ["Grasslands spread, grazing mammals diversify", "Hominins diverge from chimps (~7 Ma)", "Mediterranean Salinity Crisis (5.9 Ma)", "Isthmus of Panama closes"] },
  { name: "Quaternary",    level: "period", startMa: 2.58,  endMa: 0,     parent: "Cenozoic", color: "#4f8cac", events: ["Repeated Pleistocene glaciations", "Megafauna (mammoths) & megafaunal extinctions", "Homo sapiens (~300 ka)", "Holocene (11.7 ka) & proposed Anthropocene"] },
];

// ── Mohs hardness scale ────────────────────────────────────────────────────
// Absolute hardness values are approximate Vickers-derived values from Tabor (1954)
// commonly cited in mineralogy texts. They demonstrate that Mohs is ordinal, not linear:
// diamond is ~4× harder than corundum, not 11% harder.
export const MOHS_SCALE: MohsMineral[] = [
  { hardness: 1,  name: "Talc",       formula: "Mg_3 Si_4 O_{10}(OH)_2",      example: "Used in talcum powder; scratched by a fingernail.", absoluteHardness: 1 },
  { hardness: 2,  name: "Gypsum",     formula: "CaSO_4 \\cdot 2H_2O",         example: "Drywall and plaster of Paris.", absoluteHardness: 3 },
  { hardness: 3,  name: "Calcite",    formula: "CaCO_3",                       example: "Marble and limestone; will fizz in dilute HCl.", absoluteHardness: 9 },
  { hardness: 4,  name: "Fluorite",   formula: "CaF_2",                        example: "Octahedral crystals; source of fluorine for HF and toothpaste.", absoluteHardness: 21 },
  { hardness: 5,  name: "Apatite",    formula: "Ca_5(PO_4)_3(F,Cl,OH)",        example: "Main mineral component of bones and teeth.", absoluteHardness: 48 },
  { hardness: 6,  name: "Orthoclase", formula: "KAlSi_3O_8",                   example: "Pink K-feldspar — the most common mineral in granite.", absoluteHardness: 72 },
  { hardness: 7,  name: "Quartz",     formula: "SiO_2",                        example: "Sand grains, glass, piezoelectric oscillators.", absoluteHardness: 100 },
  { hardness: 8,  name: "Topaz",      formula: "Al_2SiO_4(F,OH)_2",            example: "Gemstone; pegmatite mineral.", absoluteHardness: 200 },
  { hardness: 9,  name: "Corundum",   formula: "Al_2O_3",                      example: "Ruby (Cr) and sapphire (Ti/Fe); abrasives (emery).", absoluteHardness: 400 },
  { hardness: 10, name: "Diamond",    formula: "C",                            example: "Hardest natural material; cutting tools and gemstones.", absoluteHardness: 1500 },
];

// Common everyday-object reference hardness for the visual scale.
export const HARDNESS_REFERENCES: { name: string; hardness: number }[] = [
  { name: "Fingernail",       hardness: 2.5 },
  { name: "Copper penny",     hardness: 3.5 },
  { name: "Iron nail",        hardness: 4.5 },
  { name: "Glass plate",      hardness: 5.5 },
  { name: "Steel file",       hardness: 6.5 },
  { name: "Streak plate",     hardness: 7.0 },
];
