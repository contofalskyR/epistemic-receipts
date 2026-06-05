export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref =
  | "psychology"
  | "economics"
  | "philosophy"
  | "statistics"
  | "ideologies"
  | "governance"
  | "linguistics";

export type Status = "open" | "landmark" | "refuted" | "contested";

export type SocEntry = {
  name: string;
  description: string;
  keyFact: string;
  formula?: string;
  example?: string;
  theorist?: string;
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
  entries: SocEntry[];
};
