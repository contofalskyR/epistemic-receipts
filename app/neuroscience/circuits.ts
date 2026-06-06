import type { CircuitNode, CircuitEdge, NamedCircuit, NodeKind } from "./types";

// Schematic 720 × 460 brain layout — frontal cortex on the left, posterior cortex on the right,
// subcortical nuclei in the middle band, brainstem and cerebellum along the bottom,
// sensory inputs on the far left.

export const NODE_KIND_STYLES: Record<NodeKind, { bg: string; border: string; text: string; label: string }> = {
  cortex:      { bg: "#1e3a8a", border: "#60a5fa", text: "#bfdbfe", label: "Cortex" },
  subcortical: { bg: "#581c87", border: "#a855f7", text: "#e9d5ff", label: "Subcortical" },
  brainstem:   { bg: "#7f1d1d", border: "#ef4444", text: "#fecaca", label: "Brainstem" },
  cerebellum:  { bg: "#5b21b6", border: "#8b5cf6", text: "#ddd6fe", label: "Cerebellum" },
  sensory:     { bg: "#065f46", border: "#10b981", text: "#a7f3d0", label: "Sensory organ" },
  motor:       { bg: "#92400e", border: "#f59e0b", text: "#fde68a", label: "Motor target" },
};

export const CIRCUIT_NODES: CircuitNode[] = [
  // Sensory organs (far left)
  { id: "Retina",    label: "Retina",    kind: "sensory",     x: 18,  y: 310, note: "Photoreceptors → bipolar → ganglion cells (M and P streams)." },
  { id: "Cochlea",   label: "Cochlea",   kind: "sensory",     x: 18,  y: 360, note: "Hair cells transduce sound via tonotopic basilar membrane." },
  { id: "Spinal",    label: "Spinal cord", kind: "motor",     x: 350, y: 430, note: "Dorsal column / spinothalamic in, corticospinal out." },

  // Thalamic relays
  { id: "LGN",       label: "LGN",       kind: "subcortical", x: 145, y: 245, note: "Lateral geniculate — visual thalamic relay; M/P/K layers." },
  { id: "MGN",       label: "MGN",       kind: "subcortical", x: 175, y: 215, note: "Medial geniculate — auditory thalamic relay." },
  { id: "THA",       label: "THA",       kind: "subcortical", x: 315, y: 235, note: "Thalamus — gateway for all senses except smell, plus cortical loops." },

  // Frontal cortex
  { id: "vmPFC",     label: "vmPFC",     kind: "cortex",      x: 70,  y: 130, note: "Ventromedial PFC — value coding, affective decisions." },
  { id: "OFC",       label: "OFC",       kind: "cortex",      x: 100, y: 105, note: "Orbitofrontal cortex — reward valuation, reversal learning." },
  { id: "dlPFC",     label: "dlPFC",     kind: "cortex",      x: 135, y: 95,  note: "Dorsolateral PFC — working memory, cognitive control." },
  { id: "mPFC",      label: "mPFC",      kind: "cortex",      x: 170, y: 130, note: "Medial PFC — self-referential cognition, DMN hub." },
  { id: "ACC",       label: "ACC",       kind: "cortex",      x: 215, y: 100, note: "Anterior cingulate — conflict monitoring, error signal." },
  { id: "SMA",       label: "SMA",       kind: "cortex",      x: 255, y: 85,  note: "Supplementary motor area — internally generated action." },
  { id: "M1",        label: "M1",        kind: "cortex",      x: 295, y: 95,  note: "Primary motor cortex — voluntary movement, somatotopic." },
  { id: "Broca",     label: "Broca",    kind: "cortex",      x: 140, y: 175, note: "Inferior frontal gyrus (BA44/45) — speech production." },
  { id: "AI",        label: "AI",        kind: "cortex",      x: 270, y: 175, note: "Anterior insula — interoception, salience hub." },

  // Parietal / posterior cortex
  { id: "S1",        label: "S1",        kind: "cortex",      x: 345, y: 95,  note: "Primary somatosensory cortex — tactile map." },
  { id: "PPC",       label: "PPC",       kind: "cortex",      x: 405, y: 120, note: "Posterior parietal — spatial attention, reach planning." },
  { id: "AG",        label: "AG",        kind: "cortex",      x: 450, y: 150, note: "Angular gyrus — language, semantics, DMN." },
  { id: "PCC",       label: "PCC",       kind: "cortex",      x: 485, y: 115, note: "Posterior cingulate — DMN core, self-referential memory." },
  { id: "Wernicke",  label: "Wernicke",  kind: "cortex",      x: 430, y: 210, note: "Posterior superior temporal (BA22) — language comprehension." },

  // Occipital / temporal cortex
  { id: "V1",        label: "V1",        kind: "cortex",      x: 645, y: 140, note: "Primary visual cortex — orientation columns, retinotopic." },
  { id: "V2",        label: "V2",        kind: "cortex",      x: 605, y: 175, note: "Secondary visual — contour, texture, illusory contours." },
  { id: "V4",        label: "V4",        kind: "cortex",      x: 555, y: 220, note: "Ventral stream — color and form." },
  { id: "MT",        label: "MT",        kind: "cortex",      x: 570, y: 170, note: "Middle temporal (V5) — visual motion." },
  { id: "IT",        label: "IT",        kind: "cortex",      x: 505, y: 245, note: "Inferotemporal — object and face recognition." },
  { id: "A1",        label: "A1",        kind: "cortex",      x: 385, y: 175, note: "Primary auditory — tonotopic frequency map." },

  // Basal ganglia + limbic
  { id: "Striatum",  label: "Striatum",  kind: "subcortical", x: 220, y: 250, note: "Caudate + putamen — input nucleus of basal ganglia." },
  { id: "NAcc",      label: "NAcc",      kind: "subcortical", x: 180, y: 290, note: "Nucleus accumbens — ventral striatum, reward learning." },
  { id: "GPi",       label: "GPi",       kind: "subcortical", x: 265, y: 275, note: "Internal globus pallidus — BG output (tonic inhibition)." },
  { id: "HYP",       label: "HYP",       kind: "subcortical", x: 250, y: 310, note: "Hypothalamus — homeostasis, endocrine, circadian." },
  { id: "AMY",       label: "AMY",       kind: "subcortical", x: 360, y: 295, note: "Amygdala — threat detection, emotional salience." },
  { id: "HC",        label: "HC",        kind: "subcortical", x: 410, y: 280, note: "Hippocampus — episodic memory, spatial navigation." },
  { id: "Mam",       label: "Mam.",      kind: "subcortical", x: 320, y: 320, note: "Mammillary bodies — Papez circuit waystation." },

  // Brainstem nuclei
  { id: "VTA",       label: "VTA",       kind: "brainstem",   x: 240, y: 365, note: "Ventral tegmental area — dopaminergic mesolimbic/mesocortical." },
  { id: "SNc",       label: "SNc",       kind: "brainstem",   x: 200, y: 360, note: "Substantia nigra pars compacta — nigrostriatal dopamine." },
  { id: "LC",        label: "LC",        kind: "brainstem",   x: 395, y: 365, note: "Locus coeruleus — sole source of cortical noradrenaline." },
  { id: "Raphe",     label: "Raphe",     kind: "brainstem",   x: 360, y: 370, note: "Raphe nuclei — serotonergic projection to forebrain." },
  { id: "Pons",      label: "Pons",      kind: "brainstem",   x: 565, y: 380, note: "Pontine nuclei — relay cortex → cerebellum." },

  // Cerebellum
  { id: "CBL",       label: "CBL",       kind: "cerebellum",  x: 625, y: 335, note: "Cerebellum — coordination, timing, motor learning." },
];

// ────────────────────────────────────────────────────────────────────────────
// Named circuits — each is a coherent functional pathway
// ────────────────────────────────────────────────────────────────────────────

export const NAMED_CIRCUITS: NamedCircuit[] = [
  { id: "ventral",     name: "Visual ventral stream",   description: "Retina → V1 → V2 → V4 → IT.",                                       color: "#60a5fa", function: "Object and face recognition (\"what\")." },
  { id: "dorsal",      name: "Visual dorsal stream",    description: "Retina → V1 → V2 → MT → PPC.",                                       color: "#22d3ee", function: "Spatial location and motion (\"where/how\")." },
  { id: "auditory",    name: "Auditory pathway",        description: "Cochlea → MGN → A1 → Wernicke.",                                     color: "#34d399", function: "Sound to language comprehension." },
  { id: "somato",      name: "Somatosensory pathway",   description: "Spinal → THA → S1 → PPC.",                                           color: "#a7f3d0", function: "Touch, proprioception, body schema." },
  { id: "bg-direct",   name: "Basal-ganglia direct loop", description: "Cortex → Striatum → GPi → THA → Cortex.",                          color: "#f59e0b", function: "Action selection: thalamic disinhibition releases movement." },
  { id: "nigro",       name: "Nigrostriatal dopamine",  description: "SNc → Striatum.",                                                    color: "#fb923c", function: "Movement vigor; lost in Parkinson's disease." },
  { id: "meso-limbic", name: "Mesolimbic reward",       description: "VTA → NAcc → vmPFC.",                                                color: "#fbbf24", function: "Reward prediction error, incentive salience, addiction substrate." },
  { id: "meso-cort",   name: "Mesocortical dopamine",   description: "VTA → dlPFC / OFC.",                                                 color: "#facc15", function: "Working memory and executive function." },
  { id: "papez",       name: "Papez memory circuit",    description: "HC → Mam. → THA → ACC → HC.",                                        color: "#e879f9", function: "Limbic loop for episodic memory consolidation." },
  { id: "dmn",         name: "Default Mode Network",    description: "mPFC ↔ PCC ↔ AG ↔ HC.",                                              color: "#a78bfa", function: "Self-referential thought, mind-wandering, autobiographical memory." },
  { id: "salience",    name: "Salience network",        description: "ACC ↔ AI.",                                                          color: "#f472b6", function: "Detects behaviorally relevant events; toggles DMN ↔ CEN." },
  { id: "cen",         name: "Central executive network", description: "dlPFC ↔ PPC.",                                                      color: "#38bdf8", function: "Working memory, goal-directed control." },
  { id: "cbl-motor",   name: "Cerebellar motor loop",   description: "M1 → Pons → CBL → THA → M1.",                                        color: "#c4b5fd", function: "Online motor calibration and timing." },
  { id: "fear",        name: "Fear / threat circuit",   description: "THA → AMY → ACC; AMY → HC.",                                         color: "#fb7185", function: "Rapid threat detection and fear conditioning." },
  { id: "ne",          name: "Noradrenergic modulation", description: "LC → PFC / ACC.",                                                    color: "#67e8f9", function: "Arousal, vigilance, gain control." },
  { id: "ht",          name: "Serotonergic modulation",  description: "Raphe → PFC / ACC / HC.",                                            color: "#fda4af", function: "Mood, impulsivity, sleep cycles." },
  { id: "language",    name: "Language network",        description: "Wernicke ↔ Broca (arcuate fasciculus).",                              color: "#86efac", function: "Comprehension to production of speech." },
  { id: "cst",         name: "Corticospinal tract",     description: "M1 → Spinal cord.",                                                   color: "#fcd34d", function: "Voluntary motor commands to the body." },
];

// ────────────────────────────────────────────────────────────────────────────
// Directed edges between nodes (with neurotransmitter and circuit membership)
// ────────────────────────────────────────────────────────────────────────────

export const CIRCUIT_EDGES: CircuitEdge[] = [
  // Visual ventral
  { from: "Retina", to: "LGN", nt: "Glu", circuits: ["ventral", "dorsal"] },
  { from: "LGN", to: "V1", nt: "Glu", circuits: ["ventral", "dorsal"] },
  { from: "V1", to: "V2", nt: "Glu", circuits: ["ventral", "dorsal"] },
  { from: "V2", to: "V4", nt: "Glu", circuits: ["ventral"] },
  { from: "V4", to: "IT", nt: "Glu", circuits: ["ventral"] },

  // Visual dorsal
  { from: "V2", to: "MT", nt: "Glu", circuits: ["dorsal"] },
  { from: "MT", to: "PPC", nt: "Glu", circuits: ["dorsal"] },

  // Auditory
  { from: "Cochlea", to: "MGN", nt: "Glu", circuits: ["auditory"] },
  { from: "MGN", to: "A1", nt: "Glu", circuits: ["auditory"] },
  { from: "A1", to: "Wernicke", nt: "Glu", circuits: ["auditory"] },

  // Somatosensory
  { from: "Spinal", to: "THA", nt: "Glu", circuits: ["somato"] },
  { from: "THA", to: "S1", nt: "Glu", circuits: ["somato"] },
  { from: "S1", to: "PPC", nt: "Glu", circuits: ["somato"] },

  // Basal-ganglia direct loop
  { from: "M1", to: "Striatum", nt: "Glu", circuits: ["bg-direct"] },
  { from: "Striatum", to: "GPi", nt: "GABA", circuits: ["bg-direct"] },
  { from: "GPi", to: "THA", nt: "GABA", circuits: ["bg-direct"] },
  { from: "THA", to: "M1", nt: "Glu", circuits: ["bg-direct", "cbl-motor"] },

  // Nigrostriatal
  { from: "SNc", to: "Striatum", nt: "DA", circuits: ["nigro"] },

  // Mesolimbic & mesocortical
  { from: "VTA", to: "NAcc", nt: "DA", circuits: ["meso-limbic"] },
  { from: "NAcc", to: "vmPFC", nt: "GABA", circuits: ["meso-limbic"] },
  { from: "VTA", to: "dlPFC", nt: "DA", circuits: ["meso-cort"] },
  { from: "VTA", to: "OFC", nt: "DA", circuits: ["meso-cort"] },

  // Papez
  { from: "HC", to: "Mam", nt: "Glu", circuits: ["papez"] },
  { from: "Mam", to: "THA", nt: "Glu", circuits: ["papez"] },
  { from: "THA", to: "ACC", nt: "Glu", circuits: ["papez"] },
  { from: "ACC", to: "HC", nt: "Glu", circuits: ["papez"] },

  // DMN (bidirectional, rendered as both directions)
  { from: "mPFC", to: "PCC", nt: "Glu", circuits: ["dmn"] },
  { from: "PCC", to: "mPFC", nt: "Glu", circuits: ["dmn"] },
  { from: "PCC", to: "AG", nt: "Glu", circuits: ["dmn"] },
  { from: "AG", to: "PCC", nt: "Glu", circuits: ["dmn"] },
  { from: "mPFC", to: "HC", nt: "Glu", circuits: ["dmn"] },
  { from: "AG", to: "HC", nt: "Glu", circuits: ["dmn"] },

  // Salience
  { from: "ACC", to: "AI", nt: "Glu", circuits: ["salience"] },
  { from: "AI", to: "ACC", nt: "Glu", circuits: ["salience"] },

  // Central executive
  { from: "dlPFC", to: "PPC", nt: "Glu", circuits: ["cen"] },
  { from: "PPC", to: "dlPFC", nt: "Glu", circuits: ["cen"] },

  // Cerebellar motor
  { from: "M1", to: "Pons", nt: "Glu", circuits: ["cbl-motor"] },
  { from: "Pons", to: "CBL", nt: "Glu", circuits: ["cbl-motor"] },
  { from: "CBL", to: "THA", nt: "Glu", circuits: ["cbl-motor"] },

  // Fear circuit
  { from: "THA", to: "AMY", nt: "Glu", circuits: ["fear"] },
  { from: "AMY", to: "ACC", nt: "Glu", circuits: ["fear"] },
  { from: "AMY", to: "HC", nt: "Glu", circuits: ["fear"] },

  // Noradrenergic
  { from: "LC", to: "dlPFC", nt: "NE", circuits: ["ne"] },
  { from: "LC", to: "ACC", nt: "NE", circuits: ["ne"] },

  // Serotonergic
  { from: "Raphe", to: "dlPFC", nt: "5-HT", circuits: ["ht"] },
  { from: "Raphe", to: "ACC", nt: "5-HT", circuits: ["ht"] },
  { from: "Raphe", to: "HC", nt: "5-HT", circuits: ["ht"] },

  // Language arcuate
  { from: "Wernicke", to: "Broca", nt: "Glu", circuits: ["language"] },
  { from: "Broca", to: "Wernicke", nt: "Glu", circuits: ["language"] },

  // Corticospinal
  { from: "M1", to: "Spinal", nt: "Glu", circuits: ["cst"] },
];
