export type Section = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type Xref =
  | "biology"
  | "chemistry"
  | "physics"
  | "mathematics"
  | "statistics"
  | "geology"
  | "earth-sciences"
  | "physiology"
  | "public-health"
  | "economics"
  | "finance"
  | "governance"
  | "law"
  | "sociology"
  | "astronomy"
  | "engineering";

export type Status = "open" | "resolved" | "contested";

export type EnvEntry = {
  name: string;
  description: string;
  // Exactly one of principle or formula, per the build prompt.
  principle?: string;
  formula?: string;
  interpretation?: string;
  example?: string;
  critiques?: string;
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
  entries: EnvEntry[];
};
