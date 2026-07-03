export type Section = "A" | "B" | "C" | "D" | "E" | "F";

export type Xref =
  | "political-science"
  | "sociology"
  | "psychology"
  | "statistics"
  | "linguistics"
  | "philosophy"
  | "economics"
  | "political-economy"
  | "law"
  | "computer-science"
  | "anthropology"
  | "public-health"
  | "environmental-science"
  | "education"
  | "arts"
  | "history"
  | "logic"
  | "criminology"
  | "ideologies"
  | "mathematics";

export type Status = "open" | "resolved" | "refuted";

export type CommEntry = {
  name: string;
  description: string;
  principle: string;
  lineage?: string;
  figures?: string;
  era?: string;
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
  | "orange"
  | "rose"
  | "fuchsia"
  | "purple"
  | "pink";

export type Family = {
  slug: string;
  number: number;
  name: string;
  blurb: string;
  section: Section;
  color: ColorKey;
  entries: CommEntry[];
};
