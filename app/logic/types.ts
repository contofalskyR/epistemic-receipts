export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref = "mathematics" | "computer-science" | "philosophy";

export type Status = "open" | "solved" | "refuted" | "contested";

export type LogicEntry = {
  name: string;
  description: string;
  formalDef: string;
  keyResults: string;
  extends: string[];
  notation?: string;
  tags: string[];
  status?: Status;
  xref?: Xref[];
  historical?: boolean;
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
  entries: LogicEntry[];
};
