export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref =
  | "mathematics"
  | "statistics"
  | "chemistry"
  | "physics"
  | "computer-science";

export type Status = "open" | "landmark" | "refuted" | "contested";

export type EngEntry = {
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
  entries: EngEntry[];
};

export type MaterialCategory =
  | "metal"
  | "ceramic"
  | "polymer"
  | "composite"
  | "biological"
  | "semiconductor";

// Properties chosen for cross-material comparison. All values at ~20 °C unless noted.
// density g/cm^3; youngsModulus GPa; tensileStrength MPa (typical/yield); thermalConductivity W/(m·K);
// meltingPoint °C; electricalResistivity Ω·m (room T); costRank 1 (cheap) – 5 (very expensive).
export type Material = {
  name: string;
  category: MaterialCategory;
  density: number;
  youngsModulus: number;
  tensileStrength: number;
  thermalConductivity: number;
  meltingPoint: number | null; // null for materials that decompose (wood) or no clean Tm
  electricalResistivity: number; // Ω·m
  costRank: 1 | 2 | 3 | 4 | 5;
  notes?: string;
};
