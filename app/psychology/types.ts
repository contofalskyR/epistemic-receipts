export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref = "biology" | "statistics" | "medicine" | "philosophy" | "mathematics" | "physics";

export type Status = "open" | "landmark" | "refuted" | "contested";

export type PsychEntry = {
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
  entries: PsychEntry[];
};

export type BrainLobe =
  | "frontal"
  | "parietal"
  | "temporal"
  | "occipital"
  | "limbic"
  | "subcortical"
  | "cerebellum"
  | "brainstem";

export type BrainRegion = {
  name: string;
  abbreviation: string;
  lobe: BrainLobe;
  functions: string[];
  lesionEffects: string;
  // Position on a 720x420 schematic sagittal-ish brain layout.
  x: number;
  y: number;
};

export type BigFiveTrait = {
  key: "O" | "C" | "E" | "A" | "N";
  name: string;
  shortName: string;
  description: string;
  highPole: string;
  lowPole: string;
  facets: string[];
};
