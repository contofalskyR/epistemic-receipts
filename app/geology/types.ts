export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref = "physics" | "chemistry" | "statistics";

export type Status = "open" | "resolved" | "refuted" | "landmark";

export type GeoEntry = {
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
  entries: GeoEntry[];
};

// ── Geologic time scale ────────────────────────────────────────────────────
export type TimeLevel = "eon" | "era" | "period" | "epoch";

export type TimeUnit = {
  name: string;
  level: TimeLevel;
  startMa: number; // millions of years ago — older end
  endMa: number;   // younger end (0 = present)
  parent?: string;
  color: string;   // hex
  events: string[]; // key events / life forms
};

// ── Mohs hardness ──────────────────────────────────────────────────────────
export type MohsMineral = {
  hardness: number;          // 1..10
  name: string;
  formula: string;           // chemical formula
  example: string;           // common example of use / occurrence
  absoluteHardness: number;  // Vickers-derived approximate absolute hardness
};
