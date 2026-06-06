export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref =
  | "geology"
  | "physics"
  | "chemistry"
  | "biology"
  | "astronomy"
  | "statistics";

export type Status = "open" | "resolved" | "refuted" | "landmark";

export type EarthEntry = {
  name: string;
  description: string;
  keyFact: string;
  formula?: string;
  example?: string;
  tags: string[];
  xref?: Xref[];
  status?: Status;
};

export type ColorKey =
  | "sky"
  | "cyan"
  | "teal"
  | "emerald"
  | "green"
  | "lime"
  | "amber"
  | "orange"
  | "rose"
  | "violet"
  | "indigo"
  | "blue";

export type Family = {
  slug: string;
  number: number;
  name: string;
  blurb: string;
  section: Section;
  color: ColorKey;
  entries: EarthEntry[];
};

// ── Earth system flows diagram ─────────────────────────────────────────────
export type ReservoirKey =
  | "sun"
  | "atmosphere"
  | "hydrosphere"
  | "cryosphere"
  | "biosphere"
  | "lithosphere";

export type Reservoir = {
  key: ReservoirKey;
  name: string;
  shortName: string;
  mass: string;          // descriptive mass / size
  residenceTime: string; // characteristic timescale
  description: string;
  facts: string[];
  color: string;         // hex
  cx: number;            // SVG position (center x)
  cy: number;
};

export type Flow = {
  from: ReservoirKey;
  to: ReservoirKey;
  name: string;
  magnitude: string;     // e.g. "~505,000 km³/yr"
  cycle: "water" | "carbon" | "energy" | "nutrient";
  description: string;
};
