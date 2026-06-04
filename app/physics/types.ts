export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref = "mathematics" | "statistics" | "chemistry";

export type Status = "open" | "resolved" | "refuted";

export type PhysEntry = {
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
  entries: PhysEntry[];
};
