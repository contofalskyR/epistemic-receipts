export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref = "medicine" | "chemistry" | "computer-science" | "physics";

export type Status = "open" | "resolved" | "contested";

export type BioEntry = {
  name: string;
  description: string;
  keyFact: string;
  example?: string;
  evolvedFrom: string[];
  tags: string[];
  status?: Status;
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
  entries: BioEntry[];
};
