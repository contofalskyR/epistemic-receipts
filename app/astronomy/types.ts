export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref = "mathematics" | "statistics" | "chemistry" | "physics";

export type Status = "open" | "resolved" | "refuted";

export type AstroEntry = {
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
  entries: AstroEntry[];
};

// ────────────────────────────────────────────────────────────────────────────
// Interactive widget types
// ────────────────────────────────────────────────────────────────────────────

export type HRStar = {
  name: string;
  spectralClass: "O" | "B" | "A" | "F" | "G" | "K" | "M";
  // Effective temperature in Kelvin.
  tempK: number;
  // Bolometric absolute magnitude (lower = more luminous).
  absMag: number;
  // Luminosity in solar units (L/L_sun) — convenience for log scale.
  luminositySolar: number;
  group: "main-sequence" | "giant" | "supergiant" | "white-dwarf" | "subgiant" | "subdwarf";
  note?: string;
};

export type DistanceRung = {
  name: string;
  // Approximate reach in parsecs (or upper bound — use 1e10 for "observable universe").
  reachParsec: number;
  // Lower bound — used to draw the bar.
  minParsec: number;
  description: string;
  example: string;
};

export type EMBand = {
  name: string;
  // Wavelength range in meters (low, high). Stored as a string-friendly tuple at runtime.
  lambdaLow: number;
  lambdaHigh: number;
  windowFromGround: "transparent" | "partial" | "opaque";
  signatureSources: string;
  primaryInstrument: string;
};
