export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref = "mathematics" | "statistics" | "physics";

export type Status = "open" | "solved" | "refuted";

export type CSEntry = {
  name: string;
  description: string;
  keyInsight: string;
  notation?: string;
  example?: string;
  prereqs: string[];
  tags: string[];
  status?: Status;
  xref?: Xref[];
  famous?: boolean;
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
  entries: CSEntry[];
};
