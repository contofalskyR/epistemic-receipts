export type Section = "A" | "B" | "C" | "D";

export type Xref = "statistics" | "finance";

export type Status = "open" | "solved";

export type MathEntry = {
  name: string;
  description: string;
  statement: string;
  keyResults: string;
  prereqs: string[];
  notation?: string;
  tags: string[];
  status?: Status;
  xref?: Xref[];
  millennium?: boolean;
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
  | "amber";

export type Family = {
  slug: string;
  number: number;
  name: string;
  blurb: string;
  section: Section;
  color: ColorKey;
  entries: MathEntry[];
};
