export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref =
  | "biology"
  | "psychology"
  | "medicine"
  | "chemistry"
  | "physics"
  | "philosophy"
  | "mathematics"
  | "statistics"
  | "computer-science"
  | "linguistics"
  | "engineering";

export type Status = "open" | "landmark" | "refuted" | "contested";

export type NeuroEntry = {
  name: string;
  description: string;
  keyFact: string;
  formula?: string;
  example?: string;
  researcher?: string;
  tags: string[];
  xref?: Xref[];
  status?: Status;
};

export type ColorKey =
  | "violet"
  | "indigo"
  | "blue"
  | "sky"
  | "cyan"
  | "teal"
  | "emerald"
  | "green"
  | "amber"
  | "rose";

export type Family = {
  slug: string;
  number: number;
  name: string;
  blurb: string;
  section: Section;
  color: ColorKey;
  entries: NeuroEntry[];
};

// ────────────────────────────────────────────────────────────────────────────
// Interactive circuit explorer types
// ────────────────────────────────────────────────────────────────────────────

export type NodeKind =
  | "cortex"
  | "subcortical"
  | "brainstem"
  | "cerebellum"
  | "sensory"
  | "motor";

export type CircuitNode = {
  id: string;
  label: string;
  kind: NodeKind;
  // 720 × 460 schematic canvas
  x: number;
  y: number;
  note: string;
};

export type Neurotransmitter =
  | "Glu"
  | "GABA"
  | "DA"
  | "ACh"
  | "NE"
  | "5-HT"
  | "mixed";

export type CircuitEdge = {
  from: string;
  to: string;
  nt: Neurotransmitter;
  circuits: string[]; // ids of named circuits this edge belongs to
};

export type NamedCircuit = {
  id: string;
  name: string;
  description: string;
  color: string;
  function: string;
};
