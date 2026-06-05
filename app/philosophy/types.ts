export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref = "ideologies" | "mathematics" | "computer-science";

export type Status = "open" | "contested" | "resolved" | "refuted";

export type PhilEntry = {
  name: string;
  description: string;
  keyThesis: string;
  notation?: string;
  keyThinkers: string[];
  influencedBy: string[];
  tags: string[];
  status?: Status;
  xref?: Xref[];
  disputed?: boolean;
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
  entries: PhilEntry[];
};
