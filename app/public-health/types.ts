export type Section = "A" | "B" | "C" | "D" | "E" | "F";

export type Xref =
  | "mathematics"
  | "statistics"
  | "medicine"
  | "pharmacology"
  | "environmental-science"
  | "sociology"
  | "economics"
  | "governance"
  | "psychology"
  | "communication";

export type PHEntry = {
  name: string;
  description: string;
  // Exactly one of `definition` (measures/methods, LaTeX-primary) or `principle` (concepts/systems, prose).
  definition?: string;
  principle?: string;
  interpretation?: string;
  example?: string;
  dataSource?: string;
  principalCritiques?: string;
  tags: string[];
  xref?: Xref[];
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
  dataSource?: string;
  entries: PHEntry[];
};
